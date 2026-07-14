import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../../../lib/supabase';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// 저장된 설문 불러오기
export async function GET() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('investor_profile')
    .select('answers, summary')
    .eq('id', 1)
    .single();
  return Response.json(data || { answers: {}, summary: '' });
}

// 설문 저장 + AI가 "정일님 스타일" 한 문단으로 요약
export async function POST(request) {
  try {
    const { answers } = await request.json();
    const anthropic = getAnthropic();
    const supabase = getSupabase();

    // 배열 답변은 쉼표로 합치고, 빈 답은 제외
    const answerText = Object.entries(answers)
      .map(([k, v]) => {
        const val = Array.isArray(v) ? v.join(', ') : v;
        return val ? `${k}: ${val}` : null;
      })
      .filter(Boolean)
      .join('\n');

    // 답이 하나라도 있을 때만 AI 요약. 없으면 요약 건너뛰고 저장만 (덜 채워도 저장됨).
    let summary = '';
    if (answerText.trim()) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          messages: [
            {
              role: 'user',
              content: `아래는 '정일님'의 투자 성향 설문 답변입니다. 이걸 바탕으로 정일님의 투자 스타일을 3~4문장으로 요약해 주세요. 나중에 AI가 이 요약을 읽고 정일님 스타일로 조언할 것입니다. 핵심 성향, 종목 선호, 매매 습관, 위험 태도가 드러나게 써 주세요.\n\n${answerText}`,
            },
          ],
        });
        summary = res.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
      } catch {
        summary = '';
      }
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
