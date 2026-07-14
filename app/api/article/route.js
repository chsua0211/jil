// 기사 본문 추출: 원문 페이지를 서버에서 가져와 텍스트만 골라냄
// GET /api/article?url=https://...
// (iframe 임베드는 언론사가 자주 차단하므로, 텍스트 스크랩 방식으로 표시)

export const dynamic = 'force-dynamic';

const UA = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
};

// 개인용 앱이지만 내부망 주소로의 요청은 막아둠 (SSRF 방지)
function isAllowedUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '0.0.0.0' || h === '[::1]') return false;
    if (/^127\.|^10\.|^192\.168\.|^169\.254\./.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

// HTML 엔티티 최소 디코딩
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// 문단 후보 추출: <p> 태그 위주.
// 너무 짧거나 문장부호가 없는 조각(메뉴·링크 모음 등)은 버림
function extractParagraphs(scope) {
  const paras = [];
  for (const m of scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = stripTags(m[1]);
    if (t.length >= 60 && /[.!?…]/.test(t)) paras.push(t);
  }
  return paras;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url') || '';
    if (!isAllowedUrl(url)) {
      return Response.json({ text: '', error: '유효하지 않은 주소예요.' }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: UA,
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 }, // 같은 기사는 1시간 캐시
    });
    if (!res.ok) throw new Error(`원문 서버 응답 ${res.status}`);
    let html = await res.text();

    // 스크립트/스타일/메뉴 등 본문과 무관한 블록 제거
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<([a-z-]*(?:header|nav|menu|footer|aside)[a-z-]*)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<form[\s\S]*?<\/form>/gi, '')
      .replace(/<figure[\s\S]*?<\/figure>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    const title =
      stripTags(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '') ||
      stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');

    // <article> 블록이 있으면 우선, 없거나 짧으면 페이지 전체에서 추출
    const articleBlock = html.match(/<article[\s\S]*?<\/article>/i)?.[0];
    let paras = articleBlock ? extractParagraphs(articleBlock) : [];
    if (paras.join('').length < 300) paras = extractParagraphs(html);

    const text = paras.join('\n\n');
    if (text.length < 200) {
      return Response.json({
        title,
        text: '',
        error: '이 언론사는 본문을 가져올 수 없게 막아뒀어요. 아래 버튼으로 원문을 열어 주세요.',
      });
    }

    return Response.json({ title, text: text.slice(0, 20000) });
  } catch {
    return Response.json({
      title: '',
      text: '',
      error: '본문을 가져오지 못했어요. 아래 버튼으로 원문을 열어 주세요.',
    });
  }
}
