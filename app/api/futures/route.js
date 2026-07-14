// 홈 대시보드용 지수 선물 등락률 (S&P500 선물 ES=F, 나스닥 선물 NQ=F)
// GET /api/futures → { spx: { pct }, ndq: { pct } }  (실패한 쪽은 null)

export const dynamic = 'force-dynamic';

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
};

// 마지막 종가 vs 그 전 종가 비교
async function fetchChangePct(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=5d&interval=1d`;
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 120 } });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const closes = (result?.indicators?.quote?.[0]?.close || []).filter((c) => c != null && c > 0);
    if (closes.length < 2) return null;
    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    return { pct: ((last - prev) / prev) * 100 };
  } catch {
    return null;
  }
}

export async function GET() {
  const [spx, ndq] = await Promise.all([fetchChangePct('ES=F'), fetchChangePct('NQ=F')]);
  return Response.json({ spx, ndq });
}
