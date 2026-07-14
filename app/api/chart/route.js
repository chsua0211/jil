import { getSupabase } from '../../../lib/supabase';

// ─────────────────────────────────────────────────────────────
// 성과 비교 차트 데이터: 내 포트폴리오 지수 vs S&P500 선물 vs 나스닥 선물
// GET /api/chart?days=90
//
// 데이터 소스: Yahoo Finance (메인) → 실패 시 Stooq (폴백)
//  * Stooq는 일일 요청 한도가 낮아서 서버(Vercel)에서 자주 막힘
//  * Yahoo는 키 없이 사용 가능하고 한도가 훨씬 널널함
//
// 과거 포트폴리오 평가액 기록이 없으므로,
// "현재 보유 종목·수량을 과거에도 그대로 들고 있었다면"을 가정하고
// 각 종목의 과거 일별 종가로 합산 지수를 역산함.
// 세 지수 모두 시작일 = 100으로 정규화해서 수익률 비교가 바로 보이게 함.
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

const YAHOO_HEADERS = {
  // UA 없으면 Yahoo가 요청을 거부하는 경우가 있음
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
};

// ── 소스 1: Yahoo Finance ──
// 반환: { 'YYYY-MM-DD': close, ... } 또는 null
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
    // 한도 초과 시 CSV 대신 안내 문구가 옴 → 첫 줄이 Date로 시작하는지 확인
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

// Yahoo 먼저, 안 되면 Stooq
async function fetchCloses({ yahoo, stooq }, fromDate) {
  const fromYahoo = await fetchYahooCloses(yahoo, fromDate);
  if (fromYahoo) return fromYahoo;
  return fetchStooqCloses(stooq, fromDate);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(7, Number(searchParams.get('days')) || 90));
    const fromDate = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

    // 1) 보유 종목
    const supabase = getSupabase();
    const { data: holdings } = await supabase.from('portfolio').select('symbol, shares');
    if (!holdings || holdings.length === 0) {
      return Response.json({ points: [], excluded: [], error: '포트폴리오가 비어 있어요.' });
    }

    // 같은 티커 여러 줄이면 수량 합산
    const shareMap = {};
    for (const h of holdings) {
      const sym = h.symbol.toUpperCase();
      shareMap[sym] = (shareMap[sym] || 0) + Number(h.shares);
    }
    const symbols = Object.keys(shareMap);

    // 2) 벤치마크(선물) + 보유종목 과거 종가를 병렬로 가져오기
    //    Yahoo: 선물 ES=F / NQ=F, 개별주는 티커 그대로
    //    Stooq: 선물 es.f / nq.f, 미국 개별주는 티커.us
    const [spxMap, ndqMap, ...stockMaps] = await Promise.all([
      fetchCloses({ yahoo: 'ES=F', stooq: 'es.f' }, fromDate),
      fetchCloses({ yahoo: 'NQ=F', stooq: 'nq.f' }, fromDate),
      ...symbols.map((s) =>
        fetchCloses({ yahoo: s, stooq: `${s.toLowerCase()}.us` }, fromDate)
      ),
    ]);

    if (!spxMap || !ndqMap) {
      const failed = [!spxMap && 'S&P500 선물', !ndqMap && '나스닥 선물'].filter(Boolean).join(', ');
      return Response.json(
        {
          points: [],
          excluded: [],
          error: `지수 데이터를 가져오지 못했어요 (${failed}). 잠시 후 다시 시도해 주세요.`,
        },
        { status: 502 }
      );
    }

    // 데이터를 못 가져온 종목은 제외하고 알려줌 (신규상장 등)
    const priceMaps = {};
    const excluded = [];
    symbols.forEach((s, i) => {
      if (stockMaps[i]) priceMaps[s] = stockMaps[i];
      else excluded.push(s);
    });
    const usable = Object.keys(priceMaps);
    if (usable.length === 0) {
      return Response.json({ points: [], excluded, error: '보유 종목의 과거 시세를 찾지 못했어요.' });
    }

    // 3) 거래일 목록: S&P500 선물 기준
    const dates = Object.keys(spxMap).sort();

    // 4) 날짜별 포트폴리오 평가액 (휴장·결측일은 직전 가격으로 이어붙임)
    const lastPrice = {};
    const rawPoints = [];
    for (const date of dates) {
      let value = 0;
      let ready = true;
      for (const s of usable) {
        if (priceMaps[s][date] !== undefined) lastPrice[s] = priceMaps[s][date];
        if (lastPrice[s] === undefined) { ready = false; break; } // 아직 첫 시세 전
        value += lastPrice[s] * shareMap[s];
      }
      if (!ready) continue; // 모든 종목 시세가 갖춰진 날부터 시작
      rawPoints.push({ date, my: value, spx: spxMap[date], ndq: ndqMap[date] ?? null });
    }
    // 나스닥 결측일도 직전 값으로 채움
    let lastNdq = null;
    for (const p of rawPoints) {
      if (p.ndq !== null) lastNdq = p.ndq;
      else p.ndq = lastNdq;
    }
    const points = rawPoints.filter((p) => p.ndq !== null);
    if (points.length < 2) {
      return Response.json({ points: [], excluded, error: '그래프를 그릴 데이터가 부족해요.' });
    }

    // 5) 시작일 = 100 정규화
    const base = points[0];
    const normalized = points.map((p) => ({
      date: p.date,
      my: Math.round((p.my / base.my) * 10000) / 100,
      spx: Math.round((p.spx / base.spx) * 10000) / 100,
      ndq: Math.round((p.ndq / base.ndq) * 10000) / 100,
    }));

    return Response.json({ points: normalized, excluded });
  } catch (e) {
    return Response.json({ points: [], excluded: [], error: e.message }, { status: 500 });
  }
}
