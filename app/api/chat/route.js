import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../../../lib/supabase';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// 정일님의 설문 답변을 사람이 읽을 수 있는 문장으로 변환
function describeProfile(answers, summary) {
  if (!answers || Object.keys(answers).length === 0) {
    return '아직 성향 설문을 안 하셨어요. 일반적인 투자 관점으로 답하되, 정일님이 설문을 채우시면 더 정확해진다고 안내해 주세요.';
  }
  const lines = Object.entries(answers)
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.join(', ') : v;
      return val ? `- ${k}: ${val}` : null;
    })
    .filter(Boolean);
  if (lines.length === 0) {
    return '아직 성향 설문을 안 하셨어요. 일반적인 투자 관점으로 답하되, 정일님이 설문을 채우시면 더 정확해진다고 안내해 주세요.';
  }
  let text = '아래는 정일님이 직접 답하신 투자 성향입니다:\n' + lines.join('\n');
  if (summary) text += `\n\n[정일님 스타일 요약]\n${summary}`;
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

    // 1) 정일님 스타일 불러오기
    const { data: profile } = await supabase
      .from('investor_profile')
      .select('answers, summary')
      .eq('id', 1)
      .single();

    const profileText = describeProfile(profile?.answers, profile?.summary);

    // 1-1) 정일님 포트폴리오 불러오기 (실시간 평가 포함) — 매 대화마다 AI가 포트폴리오를 알고 답함
    let portfolioText = '아직 포트폴리오가 입력되지 않았습니다.';
    try {
      const origin = new URL(request.url).origin;
      const pRes = await fetch(`${origin}/api/portfolio`);
      const p = await pRes.json();
      if (p.holdings && p.holdings.length > 0) {
        const lines = p.holdings.map(
          (h) =>
            `- ${h.symbol}: ${h.shares}주, 평단 $${h.avgCost.toFixed(2)}, 현재가 $${h.price.toFixed(2)}, 평가액 $${h.value.toFixed(0)}, 수익률 ${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(1)}%, 비중 ${h.weight.toFixed(1)}%`
        );
        portfolioText =
          `[정일님의 현재 포트폴리오]\n` +
          lines.join('\n') +
          `\n총 평가액 $${p.total.value.toFixed(0)}, 총 손익 ${p.total.pnl >= 0 ? '+' : ''}$${p.total.pnl.toFixed(0)} (${p.total.pnlPct >= 0 ? '+' : ''}${p.total.pnlPct.toFixed(1)}%)`;
      }
    } catch {}

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

    // 2) 시스템 프롬프트: 여기가 투자 분신의 핵심
    const system = `당신은 '정일님'의 개인 투자 파트너 AI입니다. 단순히 정보를 검색해주는 봇이 아니라, 정일님의 포트폴리오와 성향을 모두 알고 있는 자산관리 파트너처럼 행동합니다.

${profileText}

${portfolioText}

규칙:
- 사용자는 항상 '정일님'이라고 부릅니다. '정베' 같은 다른 호칭은 절대 쓰지 않습니다.
- 항상 정중한 존댓말로 답합니다.
- 모든 조언은 정일님의 실제 포트폴리오를 기준으로 합니다. 예: 어떤 종목 이야기가 나오면 정일님이 그 종목을 보유 중인지, 수익률이 어떤지, 비중이 얼마인지 먼저 확인하고 그에 맞게 답합니다.
- 정일님의 성향(손절 원칙, 위험 태도 등)과 실제 수익률을 연결해서 조언합니다. 예: 손절 원칙이 -10%인데 어떤 종목이 -12%면 그 사실을 짚어줍니다.
- 리스크 분석 시 구체적으로: 특정 종목/섹터 쏠림(비중 30% 이상이면 집중 리스크 언급), 전체 손익 상태, 변동성 큰 종목 여부 등을 포트폴리오 숫자에 근거해 설명합니다.
- 최신 정보가 필요하면 web_search 도구로 직접 찾아봅니다. 뉴스, 실적, 주가 흐름 등.
- 딱딱한 애널리스트 말투보다는 친근하면서도 정중하게. 근거는 확실하게 제시합니다.
- 투자 조언은 참고용이고 최종 판단은 정일님 몫이라는 점을 자연스럽게 안내합니다.
- 확실하지 않은 건 솔직하게 모른다고 말합니다. 없는 숫자를 지어내지 않습니다. 위 포트폴리오 숫자는 실시간 데이터이므로 그대로 신뢰하고 사용합니다.`;

    // 3) Claude 호출. 웹 검색 도구를 먼저 시도하고, 안 되면 검색 없이 다시 답한다.
    const userContent = message + analystContext;
    const messages = [...history, { role: 'user', content: userContent }];

    let response;
    try {
      // 웹 검색 도구 포함 시도
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system,
        messages,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      });
    } catch (searchErr) {
      // 웹 검색이 아직 활성화 안 됐거나 문제가 있으면, 검색 없이 답한다.
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system:
          system +
          '\n\n(참고: 지금은 실시간 웹 검색을 쓸 수 없어요. 알고 있는 지식과 주어진 데이터만으로 답하고, 최신 정보가 필요한 부분은 확실하지 않을 수 있다고 안내해 주세요.)',
        messages,
      });
    }

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
