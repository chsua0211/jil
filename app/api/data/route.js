import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 관심종목 + 스크랩 뉴스 둘 다 불러오기
export async function GET() {
  const [{ data: watchlist }, { data: saved }] = await Promise.all([
    supabase.from('watchlist').select('*').order('created_at'),
    supabase.from('saved_news').select('*').order('created_at', { ascending: false }),
  ]);
  return Response.json({ watchlist: watchlist || [], saved: saved || [] });
}

// 추가: { type: 'watch'|'news', payload: {...} }
export async function POST(request) {
  const { type, payload } = await request.json();
  if (type === 'watch') {
    await supabase.from('watchlist').insert({ symbol: payload.symbol.toUpperCase() });
  } else if (type === 'news') {
    await supabase.from('saved_news').insert(payload);
  }
  return Response.json({ ok: true });
}

// 삭제: { type: 'watch'|'news', id }
export async function DELETE(request) {
  const { type, id } = await request.json();
  const table = type === 'watch' ? 'watchlist' : 'saved_news';
  await supabase.from(table).delete().eq('id', id);
  return Response.json({ ok: true });
}
