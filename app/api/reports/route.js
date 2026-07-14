// ─────────────────────────────────────────────────────────────
// 리포트 탭: 리서치 소스들의 최신 헤드라인 수집
// GET /api/reports → { reports: [{ source, title, url, date }] }
//
// 소스 (research-sources 목록 중 서버 스크랩이 되는 곳):
//  - TrendForce 프레스센터 / News  (반도체 원데이터)
//  - SemiAnalysis, Fabricated Knowledge  (RSS)
//  - 한경 컨센서스  (국내 증권사 리포트 PDF)
// 각 소스는 5분 캐시 → 새로고침해도 원사이트에 과도한 요청 없음
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

const UA = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
};

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: UA,
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 300 }, // 5분 캐시
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// RSS 공통 파서 (SemiAnalysis, Fabricated Knowledge)
async function fromRss(url, source, limit = 6) {
  const xml = await fetchText(url);
  if (!xml) return [];
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = decode(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
    const link = decode(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '');
    const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    const date = pub ? new Date(pub).toISOString().slice(0, 10) : null;
    if (title && link) items.push({ source, title, url: link, date });
    if (items.length >= limit) break;
  }
  return items;
}

// TrendForce 프레스센터 / News (링크 텍스트에서 제목 추출)
async function fromTrendforce(pageUrl, linkPattern, source, limit = 6) {
  const html = await fetchText(pageUrl);
  if (!html) return [];
  const seen = new Set();
  const items = [];
  for (const m of html.matchAll(new RegExp(`<a[^>]+href="([^"]*${linkPattern}[^"]+)"[^>]*>([\\s\\S]*?)</a>`, 'g'))) {
    let url = m[1];
    const title = decode(m[2]);
    if (title.length < 20) continue; // 썸네일·더보기 링크 제외
    if (url.startsWith('/')) url = `https://www.trendforce.com${url}`;
    if (seen.has(url)) continue;
    seen.add(url);
    // URL 앞의 YYYYMMDD를 날짜로
    const d = url.match(/(20\d{2})(\d{2})(\d{2})/);
    items.push({
      source,
      title,
      url,
      date: d ? `${d[1]}-${d[2]}-${d[3]}` : null,
    });
    if (items.length >= limit) break;
  }
  return items;
}

// 한경 컨센서스 (국내 증권사 리포트, 클릭 시 PDF)
async function fromHankyung(limit = 8) {
  const html = await fetchText('http://consensus.hankyung.com/');
  if (!html) return [];
  const items = [];
  const seen = new Set();
  for (const row of html.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
    const r = row[0];
    const idx = r.match(/report_idx=(\d+)/)?.[1];
    const titleRaw = r.match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1];
    if (!idx || !titleRaw || seen.has(idx)) continue;
    const title = decode(titleRaw);
    if (!title) continue;
    seen.add(idx);
    const date = r.match(/(20\d{2}-\d{2}-\d{2})/)?.[1] || null;
    items.push({
      source: '한경 컨센서스',
      title,
      url: `http://consensus.hankyung.com/analysis/downpdf?report_idx=${idx}`,
      date,
    });
    if (items.length >= limit) break;
  }
  return items;
}

export async function GET() {
  const results = await Promise.allSettled([
    fromTrendforce('https://www.trendforce.com/presscenter', 'presscenter/news/', 'TrendForce 프레스'),
    fromTrendforce('https://www.trendforce.com/news', '/news/', 'TrendForce 뉴스'),
    fromRss('https://semianalysis.com/feed/', 'SemiAnalysis'),
    fromRss('https://www.fabricatedknowledge.com/feed', 'Fabricated Knowledge'),
    fromHankyung(),
  ]);

  const reports = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return Response.json({ reports, updatedAt: new Date().toISOString() });
}
