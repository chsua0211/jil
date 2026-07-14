import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../../../lib/supabase';

// ─────────────────────────────────────────────────────────────
// 캘린더 일정 API
// GET /api/calendar (?refresh=1 로 강제 새로고침)
//
// 자동 수집 (마지막 수집 후 6시간 지나면 다시):
//  1) 보유 + 관심 종목의 실적 발표일 (Finnhub earnings calendar)
//  2) 최신 시장 뉴스에서 Claude가 날짜가 명시된 주요 일정을 추출
//     (FOMC, CPI 발표, 신제품 공개 등)
// (date, title)이 같으면 중복 저장하지 않음.
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // AI 추출까지 여유 있게

const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

// 보유 + 관심 종목의 실적 발표 일정
async function collectEarnings(supabase) {
  const key = process.env.FINNHUB_API_KEY;
  const [{ data: pf }, { data: wl }] = await Promise.all([
    supabase.from('portfolio').select('symbol'),
    supabase.from('watchlist').select('symbol'),
  ]);
  const symbols = [...new Set([...(pf || []), ...(wl || [])].map((r) => r.symbol.toUpperCase()))];
  if (!symbols.length) return [];

  const from = day(0);
  const to = day(90);
  const rows = [];
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${sym}&token=${key}`,
          { next: { revalidate: 3600 } }
        );
        const d = await res.json();
        for (const e of d?.earningsCalendar || []) {
          if (!e.date) continue;
          rows.push({
            date: e.date,
            title: `${sym} 실적 발표`,
            description: e.hour === 'bmo' ? '개장 전 발표' : e.hour === 'amc' ? '장 마감 후 발표' : '',
            source: 'earnings',
          });
        }
      } catch {}
    })
  );
  return rows;
}

// 뉴스에서 날짜가 명시된 주요 일정을 Claude로 추출
async function collectFromNews() {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${process.env.FINNHUB_API_KEY}`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    const news = (Array.isArray(data) ? data : [])
      .slice(0, 20)
      .map((n) => `- ${n.headline}${n.summary ? ` :: ${n.summary.slice(0, 150)}` : ''}`)
      .join('\n');
    if (!news) return [];

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `오늘은 ${day(0)}입니다. 아래 미국 시장 뉴스에서 "앞으로 예정된" 주요 일정만 추출하세요.
- 날짜가 명확히 특정되는 것만 (예: FOMC 회의, CPI/고용지표 발표일, 실적 발표, 신제품 공개, 매크로 이벤트)
- 이미 지난 일이나 날짜가 불명확한 것은 제외
- 제목은 한국어로 간결하게 (15자 내외)
- 없으면 빈 배열

JSON 배열만 출력하세요. 형식: [{"date":"YYYY-MM-DD","title":"...","description":"한 줄 설명"}]

뉴스:
${news}`,
        },
      ],
    });
    const text = msg.content?.[0]?.text || '[]';
    const jsonText = text.replace(/```json|```/g, '').trim();
    const match = jsonText.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const events = JSON.parse(match[0]);
    const today = day(0);
    return events
      .filter((e) => e?.date && e?.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= today)
      .map((e) => ({
        date: e.date,
        title: String(e.title).slice(0, 60),
        description: String(e.description || '').slice(0, 120),
        source: 'ai',
      }));
  } catch {
    return [];
  }
}

async function collectEvents(supabase) {
  const [earnings, aiEvents] = await Promise.all([
    collectEarnings(supabase),
    collectFromNews(),
  ]);
  const rows = [...earnings, ...aiEvents];
  if (rows.length) {
    await supabase
      .from('calendar_events')
      .upsert(rows, { onConflict: 'date,title', ignoreDuplicates: true });
  }
}

export async function GET(request) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('refresh') === '1';

    // 마지막 자동 수집이 6시간 넘었으면 다시 수집
    const { data: latest } = await supabase
      .from('calendar_events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    const stale =
      !latest?.length || Date.now() - new Date(latest[0].created_at).getTime() > 6 * 3600e3;
    if (force || stale) await collectEvents(supabase);

    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('date', day(-30))
      .lte('date', day(90))
      .order('date');
    if (error) throw error;

    return Response.json({ events: events || [] });
  } catch (e) {
    return Response.json({ events: [], error: e.message }, { status: 500 });
  }
}

// 일정 삭제 (잘못 추출된 일정 정리용)
export async function DELETE(request) {
  const supabase = getSupabase();
  const { id } = await request.json();
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
