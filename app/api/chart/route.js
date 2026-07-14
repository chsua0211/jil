import { getSupabase } from '../../../lib/supabase';

// ─────────────────────────────────────────────────────────────
// 성과 비교 차트 데이터: 내 포트폴리오 지수 vs S&P500 선물 vs 나스닥 선물
// GET /api/chart?days=90
//
// 과거 포트폴리오 평가액 기록이 없으므로,
// "현재 보유 종목·수량을 과거에도 그대로 들고 있었다면"을 가정하고
// 각 종목의 과거 일별 종가(Stooq, 무료·키 불필요)로 합산 지수를 역산함.
// 세 지수 모두 시작일 = 100으로 정규화해서 수익률 비교가 바로 보이게 함.
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

// Stooq에서 일별 종가 가져오기: { 'YYYY-MM-DD': close, ... }
async function fetchStooqCloses(stooqSymbol, fromDate) {
  const d1 = fromDate.replace(/-/g, '');
  const d2 = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&d1=${d1}&d2=${d2}&i=d`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } }); // 1시간 캐시
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null; // 데이터 없음
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

    // 2) 벤치마크 + 보유종목 과거 종가를 병렬로 가져오기
    //    Stooq 심볼: S&P500 선물 = es.f, 나스닥100 선물 = nq.f, 미국 개별주 = 티커.us
    const [spxMap, ndqMap, ...stockMaps] = await Promise.all([
      fetchStooqCloses('es.f', fromDate),
      fetchStooqCloses('nq.f', fromDate),
      ...symbols.map((s) => fetchStooqCloses(`${s.toLowerCase()}.us`, fromDate)),
    ]);

    if (!spxMap || !ndqMap) {
      return Response.json(
        { points: [], excluded: [], error: '지수 데이터를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.' },
        { status: 502 }
      );
    }

    // 데이터를 못 가져온 종목은 제외하고 알려줌 (신규상장 등 Stooq에 없을 수 있음)
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

    // 3) 거래일 목록: S&P500 선물 기준 (거래일)
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
