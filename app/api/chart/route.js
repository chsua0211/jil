import { getSupabase } from '../../../lib/supabase';
import { recordValueSnapshot } from '../../../lib/snapshot';

// ─────────────────────────────────────────────────────────────
// 성과 비교 차트: 내 포트폴리오 vs S&P500 선물 vs 나스닥 선물
// GET /api/chart?days=90
//
// 내 포트폴리오 선은 portfolio_history에 매일 쌓이는 실제 기록으로 그린다.
//  - 차트를 열 때마다 오늘 평가액이 자동 기록됨
//  - 매수/매도 금액(flow)은 매매 시점에 기록됨
//  - 수익률은 시간가중수익률: 돈을 새로 넣거나 뺀 것은 수익으로 치지 않음
//    일수익률 r = (오늘 평가액 - 오늘 매매금액) / 어제 평가액
//
// 벤치마크(선물)는 Yahoo Finance (실패 시 Stooq 폴백)에서 과거 종가를 가져옴.
// 세 지수 모두 구간 시작일 = 100으로 정규화.
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

const YAHOO_HEADERS = {
  // UA 없으면 Yahoo가 요청을 거부하는 경우가 있음
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
};

// ── 소스 1: Yahoo Finance ── 반환: { 'YYYY-MM-DD': close, ... } 또는 null
async function fetchYahooCloses(yahooSymbol, fromDate) {
  try {
    const period1 = Math.floor(new Date(fromDate).getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol
    )}?period1=${period1}&period2=${period2}&interval=1d`;
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const timestamps = result?.timestamp;
    const closes = result?.indicators?.quote?.[0]?.close;
    if (!timestamps || !closes) return null;

    const map = {};
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c === null || c === undefined || c <= 0) continue;
      const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      map[date] = c;
    }
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}

// ── 소스 2: Stooq (폴백) ──
async function fetchStooqCloses(stooqSymbol, fromDate) {
  try {
    const d1 = fromDate.replace(/-/g, '');
    const d2 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&d1=${d1}&d2=${d2}&i=d`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const text = await res.text();
    if (!text.startsWith('Date')) return null;
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    const map = {};
    for (const line of lines.slice(1)) {
      const cols = line.split(',');
      const date = cols[0];
      const close = Number(cols[4]);
      if (date && close > 0) map[date] = close;
    }
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}

async function fetchCloses({ yahoo, stooq }, fromDate) {
  const fromYahoo = await fetchYahooCloses(yahoo, fromDate);
  if (fromYahoo) return fromYahoo;
  return fetchStooqCloses(stooq, fromDate);
}

// 해당 날짜 또는 그 이전의 가장 가까운 종가 (주말·휴장일 대비)
function closeOnOrBefore(closeMap, sortedDates, date) {
  let found = null;
  for (const d of sortedDates) {
    if (d > date) break;
    found = closeMap[d];
  }
  return found;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(7, Number(searchParams.get('days')) || 90));

    // 0) 오늘 평가액을 기록 (기록이 매일 쌓이는 핵심 지점)
    await recordValueSnapshot();

    // 1) 지금까지 쌓인 스냅샷 전체 (지수는 처음부터 이어 계산해야 정확함)
    const supabase = getSupabase();
    const { data: rows } = await supabase
      .from('portfolio_history')
      .select('date, value, flow')
      .order('date');

    // 시세 조회 실패로 value가 비어 있는 날은 건너뛰되, 그날의 매매금액은 다음 날로 이월
    const chain = [];
    let pendingFlow = 0;
    for (const row of rows || []) {
      const flow = Number(row.flow || 0) + pendingFlow;
      if (row.value === null || row.value === undefined) {
        pendingFlow = flow;
        continue;
      }
      pendingFlow = 0;
      chain.push({ date: row.date, value: Number(row.value), flow });
    }

    if (chain.length < 2) {
      return Response.json({
        points: [],
        error:
          '아직 기록이 쌓이는 중이에요. 오늘부터 매일 포트폴리오 평가액이 기록되고, 매매도 반영돼요. 내일부터 그래프가 보이기 시작합니다!',
      });
    }

    // 2) 시간가중수익률 지수 (첫 기록일 = 100)
    //    일수익률 = (오늘 평가액 - 오늘 매매금액) / 어제 평가액
    //    → 매수로 돈이 들어와도, 매도로 돈이 나가도 수익률은 왜곡되지 않음
    const index = [100];
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1];
      const cur = chain[i];
      const r = prev.value > 0 ? (cur.value - cur.flow) / prev.value : 1;
      index.push(index[i - 1] * (r > 0 ? r : 1));
    }

    // 3) 요청 구간으로 자르기
    const fromDate = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    let start = chain.findIndex((p) => p.date >= fromDate);
    if (start === -1) start = chain.length - 1;
    const windowChain = chain.slice(start);
    const windowIndex = index.slice(start);
    if (windowChain.length < 2) {
      return Response.json({
        points: [],
        error: '이 구간에는 아직 데이터가 부족해요. 더 짧은 기간을 선택하거나 내일 다시 확인해 주세요.',
      });
    }

    // 4) 벤치마크 종가 (구간 첫 기록일 기준, 주말 대비 며칠 여유)
    const benchFrom = new Date(new Date(windowChain[0].date).getTime() - 7 * 864e5)
      .toISOString()
      .slice(0, 10);
    const [spxMap, ndqMap] = await Promise.all([
      fetchCloses({ yahoo: 'ES=F', stooq: 'es.f' }, benchFrom),
      fetchCloses({ yahoo: 'NQ=F', stooq: 'nq.f' }, benchFrom),
    ]);
    if (!spxMap || !ndqMap) {
      const failed = [!spxMap && 'S&P500 선물', !ndqMap && '나스닥 선물'].filter(Boolean).join(', ');
      return Response.json(
        { points: [], error: `지수 데이터를 가져오지 못했어요 (${failed}). 잠시 후 다시 시도해 주세요.` },
        { status: 502 }
      );
    }
    const spxDates = Object.keys(spxMap).sort();
    const ndqDates = Object.keys(ndqMap).sort();

    // 5) 구간 시작일 = 100으로 세 지수 모두 정규화
    const myBase = windowIndex[0];
    const spxBase = closeOnOrBefore(spxMap, spxDates, windowChain[0].date);
    const ndqBase = closeOnOrBefore(ndqMap, ndqDates, windowChain[0].date);

    const points = [];
    for (let i = 0; i < windowChain.length; i++) {
      const date = windowChain[i].date;
      const spx = spxBase ? closeOnOrBefore(spxMap, spxDates, date) : null;
      const ndq = ndqBase ? closeOnOrBefore(ndqMap, ndqDates, date) : null;
      if (!spx || !ndq) continue;
      points.push({
        date,
        my: Math.round((windowIndex[i] / myBase) * 10000) / 100,
        spx: Math.round((spx / spxBase) * 10000) / 100,
        ndq: Math.round((ndq / ndqBase) * 10000) / 100,
      });
    }

    if (points.length < 2) {
      return Response.json({ points: [], error: '그래프를 그릴 데이터가 부족해요.' });
    }

    return Response.json({ points });
  } catch (e) {
    return Response.json({ points: [], error: e.message }, { status: 500 });
  }
}
