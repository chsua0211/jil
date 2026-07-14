// 미국장 뉴스를 Finnhub에서 가져옴.
// ?symbol=AAPL 붙이면 특정 종목 뉴스, 없으면 시장 전체 뉴스.

export async function GET(request) {
  const key = process.env.FINNHUB_API_KEY;
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  try {
    let url;
    if (symbol) {
      // 특정 종목 뉴스 (최근 2주)
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
      url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${key}`;
    } else {
      // 시장 전체 뉴스
      url = `https://finnhub.io/api/v1/news?category=general&token=${key}`;
    }

    const res = await fetch(url, { next: { revalidate: 300 } }); // 5분 캐시
    const data = await res.json();

    const news = (Array.isArray(data) ? data : [])
      .slice(0, 15)
      .map((n) => ({
        headline: n.headline,
        summary: n.summary,
        url: n.url,
        source: n.source,
        datetime: n.datetime,
        symbol: symbol || null,
      }));

    return Response.json({ news });
  } catch (e) {
    return Response.json({ news: [], error: e.message }, { status: 500 });
  }
}
