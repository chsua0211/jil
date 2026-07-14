// 관심 종목들의 실시간 주가를 Finnhub에서 가져옴.
// ?symbols=AAPL,NVDA,TSLA 형태로 여러 개 한 번에.

export async function GET(request) {
  const key = process.env.FINNHUB_API_KEY;
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get('symbols') || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  try {
    const quotes = await Promise.all(
      symbols.map(async (symbol) => {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`,
          { next: { revalidate: 60 } } // 1분 캐시
        );
        const d = await res.json();
        return {
          symbol,
          price: d.c,          // 현재가
          change: d.d,         // 변동액
          changePercent: d.dp, // 변동률(%)
          high: d.h,
          low: d.l,
        };
      })
    );

    return Response.json({ quotes });
  } catch (e) {
    return Response.json({ quotes: [], error: e.message }, { status: 500 });
  }
}
