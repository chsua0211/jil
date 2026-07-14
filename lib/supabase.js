import { createClient } from '@supabase/supabase-js';

// 빌드 시점에 환경변수가 없어도 터지지 않도록, 실제 호출될 때 클라이언트를 만든다.
let _client = null;

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Supabase 환경변수가 설정되지 않았어. Vercel의 Environment Variables를 확인해줘.');
  }
  _client = createClient(url, anon);
  return _client;
}
