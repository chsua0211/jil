import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 저장된 설문 불러오기
export async function GET() {
  const { data } = await supabase
    .from('investor_profile')
    .select('answers, summary')
    .eq('id', 1)
    .single();
  return Response.json(data || { answers: {}, summary: '' });
}

// 설문 저장 + AI가 "정베 스타일" 한 문단으로 요약
export async function POST(request) {
  try {
    const { answers } = await request.json();

    const answerText = Object.entries(answers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    // AI에게 정베 스타일 요약 부탁
    let summary = '';
    try {
      const res = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `아래는 '정베'라는 사람의 투자 성향 설문 답변이야. 이걸 바탕으로 정베의 투자 스타일을 3~4문장으로 요약해줘. 나중에 AI가 이 요약을 읽고 정베처럼 조언할 거야. 핵심 성향, 종목 선호, 매매 습관, 위험 태도가 드러나게 써줘.\n\n${answerText}`,
          },
        ],
      });
      summary = res.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
    } catch {
      summary = '';
    }

    await supabase
      .from('investor_profile')
      .update({ answers, summary, updated_at: new Date().toISOString() })
      .eq('id', 1);

    return Response.json({ ok: true, summary });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
