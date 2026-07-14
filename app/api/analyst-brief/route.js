import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../../../lib/supabase';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// 종목 심볼을 받아서: 애널리스트 데이터 가져오기 → 정일님 스타일로 해석
export async function POST(request) {
  try {
    const { symbol } = await request.json();
    const sym = (symbol || '').toUpperCase();
    if (!sym) return Response.json({ error: '종목을 입력해줘' }, { status: 400 });

    // 1) 애널리스트 데이터 가져오기 (내부 API 재사용)
    const origin = new URL(request.url).origin;
    const dataRes = await fetch(`${origin}/api/analyst?symbol=${sym}`);
    const data = await dataRes.json();

    if (data.error || (!data.recommendation && !data.priceTarget)) {
      return Response.json({
        brief: `${sym}에 대한 애널리스트 데이터를 찾지 못했어요. 티커가 맞는지 확인해 주세요.`,
        data,
      });
    }

    // 2) 정일님 스타일 불러오기
    const supabase = getSupabase();
    const anthropic = getAnthropic();
    const { data: profile } = await supabase
      .from('investor_profile')
      .select('answers, summary')
      .eq('id', 1)
      .single();

    const profileText =
      profile?.summary ||
      (profile?.answers && Object.keys(profile.answers).length
        ? Object.entries(profile.answers)
            .map(([k, v]) => {
              const val = Array.isArray(v) ? v.join(', ') : v;
              return val ? `${k}: ${val}` : null;
            })
            .filter(Boolean)
            .join(', ')
        : '아직 성향 설문 없음');

    // 3) 데이터를 텍스트로 정리
    const r = data.recommendation;
    const recText = r
      ? `투자의견(${r.period}): 강력매수 ${r.strongBuy}, 매수 ${r.buy}, 보유 ${r.hold}, 매도 ${r.sell}, 강력매도 ${r.strongSell}`
      : '투자의견 데이터 없음';
    const ptText = data.priceTarget
      ? `목표주가: 평균 $${data.priceTarget.mean}, 최고 $${data.priceTarget.high}, 최저 $${data.priceTarget.low}`
      : '목표주가 데이터 없음';
    const chgText = data.changes?.length
      ? '최근 의견 변경:\n' +
        data.changes.map((c) => `- ${c.company}: ${c.from || '?'} → ${c.to} (${c.action})`).join('\n')
      : '최근 의견 변경 없음';

    // 4) Claude에게 정일님 스타일 해석 요청
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      system: `당신은 '정일님'의 투자 분신 AI입니다. 아래 정일님의 투자 성향에 맞춰서 애널리스트 데이터를 해석하고 조언합니다.

[정일님 스타일]
${profileText}

규칙:
- 사용자는 항상 '정일님'이라고 부릅니다. '정베' 같은 다른 호칭은 절대 쓰지 않습니다.
- 항상 정중한 존댓말로 답합니다.
- 반드시 주어진 데이터(목표주가, 투자의견, 상향/하향)를 근거로 삼습니다. 없는 숫자를 지어내지 않습니다.
- 정일님 성향에 맞춰 해석합니다. (예: 성장주 선호면 성장 관점, 손절 -10%면 그 기준 언급)
- 친근하면서도 정중하게. 근거는 확실하게 제시합니다.
- 마지막에 "이건 참고용이고 판단은 정일님 몫"이라는 뉘앙스를 자연스럽게 담습니다.
- 형식: (1) 한 줄 요약 (2) 데이터가 말하는 것 (3) 정일님 관점 조언`,
      messages: [
        {
          role: 'user',
          content: `${sym} 애널리스트 리서치 데이터입니다. 정일님 스타일로 해석하고 조언해 주세요.\n\n${recText}\n${ptText}\n${chgText}`,
        },
      ],
    });

    const brief = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

    return Response.json({ brief, data });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
