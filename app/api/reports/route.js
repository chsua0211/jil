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

import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 번역(AI)까지 여유 있게

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
    const pub = decode(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '');
    let date = null;
    if (pub) {
      const dt = new Date(pub);
      if (!isNaN(dt.getTime())) date = dt.toISOString().slice(0, 10);
    }
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
    // 카테고리·메뉴 링크 제외: 실제 기사 URL은 날짜를 포함 (20260721 또는 2026/07/17)
    if (url.includes('/category/') || /\s/.test(url)) continue;
    if (!/20\d{6}/.test(url) && !/20\d{2}\/\d{2}\/\d{2}/.test(url)) continue;
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

// ─── 영문 헤드라인 → 한국어 번역 ────────────────────────────────
// 이미 번역한 제목은 메모리 캐시로 재사용 → 새 헤드라인만 AI 호출
const transCache = new Map(); // 영문 title → 한국어 titleKo

async function translateTitles(reports) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // 번역 불가 시 원문 그대로
    for (const r of reports) r.titleKo = r.title;
    return reports;
  }

  // 번역 대상: 한글이 없는 제목 중 캐시에 없는 것
  const targets = [];
  for (const r of reports) {
    if (/[가-힣]/.test(r.title)) {
      r.titleKo = r.title; // 이미 한국어 (한경 컨센서스 등)
    } else if (transCache.has(r.title)) {
      r.titleKo = transCache.get(r.title);
    } else {
      targets.push(r);
    }
  }

  if (targets.length) {
    try {
      const anthropic = new Anthropic({ apiKey: key });
      const list = targets.map((r, i) => `${i}. ${r.title}`).join('\n');
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        messages: [
          {
            role: 'user',
            content: `아래 영문 반도체·투자 리서치 헤드라인들을 자연스러운 한국어로 번역하세요.
- 티커·기업명·기술 약어(TSMC, Nvidia, HBM, EUV, DRAM, NAND 등)는 그대로 두거나 통용 표기로
- 기사 제목답게 간결하게, 의역 OK
- 설명·주석 없이 번역문만

JSON 배열만 출력: [{"i":0,"ko":"번역문"}, ...]

${list}`,
          },
        ],
      });
      const text = msg.content?.[0]?.text || '[]';
      const match = text.replace(/```json|```/g, '').match(/\[[\s\S]*\]/);
      if (match) {
        for (const item of JSON.parse(match[0])) {
          const t = targets[item?.i];
          if (t && item?.ko) {
            t.titleKo = String(item.ko);
            transCache.set(t.title, String(item.ko));
          }
        }
      }
    } catch (e) {
      console.error('[reports] 번역 실패:', e?.message || e);
    }
  }

  // 번역 실패한 항목은 원문으로 폴백
  for (const r of reports) if (!r.titleKo) r.titleKo = r.title;
  return reports;
}

export async function GET() {
  const results = await Promise.allSettled([
    fromTrendforce('https://www.trendforce.com/presscenter', 'presscenter/news/', 'TrendForce 프레스'),
    fromTrendforce('https://www.trendforce.com/news', '/news/', 'TrendForce 뉴스'),
    fromRss('https://semianalysis.com/feed/', 'SemiAnalysis'),
    fromRss('https://www.fabricatedknowledge.com/feed', 'Fabricated Knowledge'),
    fromRss('https://www.federalreserve.gov/feeds/press_all.xml', '연준(Fed)', 5),
    fromRss('https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', 'WSJ 마켓', 6),
    fromHankyung(),
  ]);

  let reports = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  reports = await translateTitles(reports);

  return Response.json({ reports, updatedAt: new Date().toISOString() });
}
