import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// 브라우저에서 /api/debug 열면 환경변수·DB연결·테이블·쓰기권한을 자동 검사
export async function GET() {
  const report = { env: {}, tables: {}, write: {} };

  // 1) 환경변수 존재 여부 (값은 노출 안 함, 길이만)
  const envs = [
    'ANTHROPIC_API_KEY',
    'FINNHUB_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'ACCESS_PASSWORD',
  ];
  for (const k of envs) {
    const v = process.env[k];
    report.env[k] = v ? `설정됨 (${v.length}자)` : '❌ 없음';
  }
  // URL 앞부분만 노출 (프로젝트 확인용)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  report.env.SUPABASE_PROJECT = url ? url.replace('https://', '').split('.')[0] : '❌';

  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    report.conclusion = '❌ Supabase 환경변수가 없어요. Vercel Environment Variables 확인 후 Redeploy 필요.';
    return Response.json(report);
  }

  const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // 2) 각 테이블 읽기 테스트
  const tables = ['investor_profile', 'portfolio', 'watchlist', 'saved_news', 'chat_messages', 'memories'];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('*').limit(1);
    report.tables[t] = error ? `❌ ${error.message}` : '✅ 읽기 OK';
  }

  // 3) 쓰기 테스트 (memories에 넣었다 바로 삭제)
  const { data: ins, error: insErr } = await supabase
    .from('memories')
    .insert({ content: '__debug_test__' })
    .select();
  if (insErr) {
    report.write.memories = `❌ 쓰기 실패: ${insErr.message}`;
  } else {
    report.write.memories = '✅ 쓰기 OK';
    if (ins?.[0]?.id) await supabase.from('memories').delete().eq('id', ins[0].id);
  }

  // 4) investor_profile upsert 테스트 (설문 저장과 동일한 동작)
  const { error: upErr } = await supabase
    .from('investor_profile')
    .upsert({ id: 1, updated_at: new Date().toISOString() });
  report.write.investor_profile = upErr ? `❌ upsert 실패: ${upErr.message}` : '✅ upsert OK';

  // 결론
  const fails = JSON.stringify(report).match(/❌/g)?.length || 0;
  report.conclusion = fails === 0
    ? '✅ 전부 정상! 이래도 저장이 안 되면 최신 코드가 배포됐는지 확인 필요.'
    : `❌ ${fails}개 문제 발견. 위의 ❌ 항목을 확인하세요.`;

  return Response.json(report);
}
