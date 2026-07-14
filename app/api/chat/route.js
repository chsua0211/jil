import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../../../lib/supabase';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// 정베의 설문 답변을 사람이 읽을 수 있는 문장으로 변환
function describeProfile(answers, summary) {
  if (!answers || Object.keys(answers).length === 0) {
    return '아직 성향 설문을 안 했어. 일반적인 투자 관점으로 답하되, 정베가 설문을 채우면 더 정확해진다고 알려줘.';
  }
  const lines = Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`);
  let text = '아래는 정베가 직접 답한 투자 성향이야:\n' + lines.join('\n');
  if (summary) text += `\n\n[정베 스타일 요약]\n${summary}`;
  return text;
}

// 메시지에서 티커로 보이는 대문자 1~5글자 단어를 뽑아냄 (예: NVDA, TSLA)
function extractTicker(text) {
  const m = text.match(/\b[A-Z]{1,5}\b/g);
  return m ? m[0] : null;
}

export async function POST(request) {
  try {
    const { message, history = [] } = await request.json();
    const supabase = getSupabase();
    const anthropic = getAnthropic();

    // 1) 정베 스타일 불러오기
    const { data: profile } = await supabase
      .from('investor_profile')
      .select('answers, summary')
      .eq('id', 1)
      .single();

    const profileText = describeProfile(profile?.answers, profile?.summary);

    // 1-2) 메시지에 티커가 있고 애널리스트 관련 질문이면 데이터 미리 가져오기
    let analystContext = '';
    const ticker = extractTicker(message);
    const wantsAnalyst = /애널리스트|목표주가|투자의견|리포트|상향|하향|목표가/.test(message);
    if (ticker && wantsAnalyst) {
      try {
        const origin = new URL(request.url).origin;
        const aRes = await fetch(`${origin}/api/analyst?symbol=${ticker}`);
        const a = await aRes.json();
        if (a.recommendation || a.priceTarget) {
          analystContext = `\n\n[참고: ${ticker} 애널리스트 데이터]\n`;
          if (a.priceTarget) analystContext += `목표주가 평균 $${a.priceTarget.mean} (최고 $${a.priceTarget.high}, 최저 $${a.priceTarget.low})\n`;
          if (a.recommendation) {
            const r = a.recommendation;
            analystContext += `투자의견: 강력매수 ${r.strongBuy}, 매수 ${r.buy}, 보유 ${r.hold}, 매도 ${r.sell}, 강력매도 ${r.strongSell}\n`;
          }
          if (a.changes?.length) {
            analystContext += '최근 변경: ' + a.changes.map((c) => `${c.company} ${c.to}(${c.action})`).join(', ');
          }
        }
      } catch {}
    }

    // 2) 시스템 프롬프트: 여기가 "정베 분신"의 핵심
    const system = `너는 '정일(정베)'의 투자 분신 AI야. 정베 대신 그의 관점으로 미국 주식을 분석해.

${profileText}

규칙:
- 정베의 성향에 맞춰서 조언해. 예를 들어 정베가 성장주 위주면 성장주 관점으로, 손절 원칙이 -10%면 그 기준으로 얘기해.
- 최신 정보가 필요하면 web_search 도구로 직접 찾아봐. 뉴스, 실적, 주가 흐름 등.
- 딱딱한 애널리스트 말투 말고, 친구처럼 편하게 반말로. 근데 근거는 확실하게.
- 투자 조언은 참고용이고 최종 판단은 정베 몫이라는 걸 자연스럽게 인지시켜.
- 확실하지 않은 건 솔직하게 모른다고 해. 없는 숫자 지어내지 마.`;

    // 3) Claude 호출 (웹 검색 도구 포함). 애널리스트 데이터 있으면 메시지에 첨부.
    const userContent = message + analystContext;
    const messages = [...history, { role: 'user', content: userContent }];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system,
      messages,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    });

    // 4) 텍스트 응답만 추출
    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    // 5) 대화 기록 저장 (실패해도 응답엔 영향 없게)
    supabase.from('chat_messages').insert([
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ]).then(() => {}, () => {});

    return Response.json({ reply });
  } catch (e) {
    return Response.json({ reply: '', error: e.message }, { status: 500 });
  }
}
