// ─────────────────────────────────────────────────────────────
// 종목 캔들(봉) 차트 데이터
// GET /api/candles?symbol=NVDA&interval=1m|10m|1d
//
// 데이터 소스: Yahoo Finance (키 불필요)
//  - 1m : 최근 2거래일, 1분봉
//  - 10m: 최근 1개월, 5분봉을 2개씩 합쳐 10분봉으로 만듦
//         (Yahoo에 10분 간격이 없어서 서버에서 합성)
//  - 1d : 최근 2년, 일봉
// 범위를 넉넉히 잡는 이유: 이동평균 120개·일목균형표(52+26칸) 계산에 과거 봉이 필요함
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

const YAHOO_HEADERS = {
  // UA 없으면 Yahoo가 요청을 거부하는 경우가 있음
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
};

// interval 파라미터 → Yahoo 요청 설정
const INTERVAL_CONFIG = {
  '1m': { yahooInterval: '1m', range: '2d', revalidate: 60 },
  '10m': { yahooInterval: '5m', range: '1mo', revalidate: 120 },
  '1d': { yahooInterval: '1d', range: '2y', revalidate: 3600 },
};

async function fetchYahooCandles(symbol, { yahooInterval, range, revalidate }) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${yahooInterval}`;
  const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate } });
  if (!res.ok) return null;
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!timestamps || !quote) return null;

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ time: timestamps[i], open: o, high: h, low: l, close: c });
  }
  return candles.length ? candles : null;
}

// 5분봉 → 10분봉 합성: 10분 경계(600초) 단위로 묶어서 OHLC 재계산
function aggregateTo10m(candles) {
  const buckets = new Map();
  for (const c of candles) {
    const bucket = Math.floor(c.time / 600) * 600;
    const b = buckets.get(bucket);
    if (!b) {
      buckets.set(bucket, { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close });
    } else {
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close;
    }
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') || '').toUpperCase().trim();
    const interval = searchParams.get('interval') || '1d';
    if (!symbol) {
      return Response.json({ candles: [], error: '종목이 지정되지 않았어요.' }, { status: 400 });
    }
    const config = INTERVAL_CONFIG[interval];
    if (!config) {
      return Response.json({ candles: [], error: '지원하지 않는 간격이에요. (1m/10m/1d)' }, { status: 400 });
    }

    let candles = await fetchYahooCandles(symbol, config);
    if (!candles) {
      return Response.json(
        { candles: [], error: `${symbol}의 차트 데이터를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.` },
        { status: 502 }
      );
    }
    if (interval === '10m') candles = aggregateTo10m(candles);

    return Response.json({ candles });
  } catch (e) {
    return Response.json({ candles: [], error: e.message }, { status: 500 });
  }
}
