// 애널리스트 리서치 데이터를 Finnhub에서 가져옴.
// 원문 리포트(유료/기관 전용)는 못 가져오지만, 핵심 결론(목표주가·투자의견·상향하향)은 정식 제공됨.
// ?symbol=NVDA

export async function GET(request) {
  const key = process.env.FINNHUB_API_KEY;
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || '').toUpperCase();

  if (!symbol) return Response.json({ error: '종목을 입력해줘' }, { status: 400 });

  try {
    const base = 'https://finnhub.io/api/v1';
    const [recRes, ptRes, udRes] = await Promise.all([
      fetch(`${base}/stock/recommendation?symbol=${symbol}&token=${key}`, { next: { revalidate: 3600 } }),
      fetch(`${base}/stock/price-target?symbol=${symbol}&token=${key}`, { next: { revalidate: 3600 } }),
      fetch(`${base}/stock/upgrade-downgrade?symbol=${symbol}&token=${key}`, { next: { revalidate: 3600 } }),
    ]);

    const rec = await recRes.json();       // [{ buy, hold, sell, strongBuy, strongSell, period }]
    const pt = await ptRes.json();          // { targetHigh, targetLow, targetMean, targetMedian }
    const ud = await udRes.json();          // [{ company, fromGrade, toGrade, gradeTime, action }]

    // 최신 투자의견 집계 (가장 최근 달)
    const latest = Array.isArray(rec) && rec.length ? rec[0] : null;
    const recommendation = latest
      ? {
          period: latest.period,
          strongBuy: latest.strongBuy,
          buy: latest.buy,
          hold: latest.hold,
          sell: latest.sell,
          strongSell: latest.strongSell,
        }
      : null;

    // 최근 상향/하향 5건
    const changes = (Array.isArray(ud) ? ud : []).slice(0, 5).map((u) => ({
      company: u.company,          // 어느 증권사
      from: u.fromGrade,
      to: u.toGrade,
      action: u.action,            // up / down / maintain / init
      time: u.gradeTime,
    }));

    const priceTarget = pt && pt.targetMean
      ? {
          mean: pt.targetMean,
          high: pt.targetHigh,
          low: pt.targetLow,
          median: pt.targetMedian,
        }
      : null;

    return Response.json({ symbol, recommendation, priceTarget, changes });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
