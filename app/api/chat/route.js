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

// ── 챗봇이 쓸 수 있는 도구들 (포트폴리오/관심종목 조작) ──
const CUSTOM_TOOLS = [
  {
    name: 'portfolio_add',
    description: '정일님의 포트폴리오에 보유 종목을 추가합니다. 티커, 수량, 평단가(USD)가 모두 필요합니다.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: '종목 티커 (예: NVDA)' },
        shares: { type: 'number', description: '보유 수량' },
        avg_cost: { type: 'number', description: '평단가 (USD)' },
      },
      required: ['symbol', 'shares', 'avg_cost'],
    },
  },
  {
    name: 'portfolio_update',
    description: '포트폴리오의 기존 종목 수량이나 평단가를 수정합니다. 티커로 종목을 찾습니다.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: '수정할 종목 티커' },
        shares: { type: 'number', description: '새 수량 (변경 시)' },
        avg_cost: { type: 'number', description: '새 평단가 (변경 시)' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'portfolio_remove',
    description: '포트폴리오에서 종목을 삭제합니다.',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: '삭제할 종목 티커' } },
      required: ['symbol'],
    },
  },
  {
    name: 'watchlist_add',
    description: '관심종목 목록에 종목을 추가합니다.',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: '추가할 종목 티커' } },
      required: ['symbol'],
    },
  },
  {
    name: 'watchlist_remove',
    description: '관심종목 목록에서 종목을 삭제합니다.',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: '삭제할 종목 티커' } },
      required: ['symbol'],
    },
  },
];

// 도구 실행기: Claude가 도구를 쓰겠다고 하면 실제 DB 조작을 수행
async function executeTool(supabase, name, input) {
  const sym = (input.symbol || '').toUpperCase().trim();
  try {
    if (name === 'portfolio_add') {
      const { error } = await supabase.from('portfolio').insert({
        symbol: sym,
        shares: Number(input.shares),
        avg_cost: Number(input.avg_cost),
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: `${sym} ${input.shares}주(평단 $${input.avg_cost}) 추가됨` };
    }
    if (name === 'portfolio_update') {
      const { data: rows } = await supabase.from('portfolio').select('*').eq('symbol', sym).limit(1);
      if (!rows || rows.length === 0) return { ok: false, error: `포트폴리오에 ${sym}이(가) 없습니다.` };
      const patch = {};
      if (input.shares !== undefined) patch.shares = Number(input.shares);
      if (input.avg_cost !== undefined) patch.avg_cost = Number(input.avg_cost);
      if (Object.keys(patch).length === 0) return { ok: false, error: '변경할 값이 없습니다.' };
      const { error } = await supabase.from('portfolio').update(patch).eq('id', rows[0].id);
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: `${sym} 수정됨` };
    }
    if (name === 'portfolio_remove') {
      const { error } = await supabase.from('portfolio').delete().eq('symbol', sym);
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: `${sym} 포트폴리오에서 삭제됨` };
    }
    if (name === 'watchlist_add') {
      const { error } = await supabase.from('watchlist').insert({ symbol: sym });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: `${sym} 관심종목에 추가됨` };
    }
    if (name === 'watchlist_remove') {
      const { error } = await supabase.from('watchlist').delete().eq('symbol', sym);
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: `${sym} 관심종목에서 삭제됨` };
    }
    return { ok: false, error: '알 수 없는 도구' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
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

    // 1-1) 포트폴리오 (실시간 평가 포함)
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

    // 1-2) 관심종목 목록
    let watchlistText = '관심종목 없음';
    try {
      const { data: wl } = await supabase.from('watchlist').select('symbol').order('created_at');
      if (wl && wl.length > 0) watchlistText = wl.map((w) => w.symbol).join(', ');
    } catch {}

    // 2) 시스템 프롬프트
    const system = `당신은 '정일님'의 개인 투자 파트너 AI입니다. 단순히 정보를 검색해주는 봇이 아니라, 정일님의 포트폴리오와 성향을 모두 알고 있는 자산관리 파트너처럼 행동합니다.

${profileText}

${portfolioText}

[관심종목] ${watchlistText}

규칙:
- 사용자는 항상 '정일님'이라고 부릅니다. '정베' 같은 다른 호칭은 절대 쓰지 않습니다.
- 항상 정중한 존댓말로 답합니다.
- 모든 조언은 정일님의 실제 포트폴리오를 기준으로 합니다.
- 정일님의 성향(손절 원칙, 위험 태도 등)과 실제 수익률을 연결해서 조언합니다.
- 리스크 분석 시 구체적으로: 종목/섹터 쏠림(비중 30% 이상이면 집중 리스크 언급), 전체 손익 상태, 변동성 등을 숫자에 근거해 설명합니다.
- 정일님이 포트폴리오나 관심종목의 추가/수정/삭제를 요청하시면 도구(portfolio_add, portfolio_update, portfolio_remove, watchlist_add, watchlist_remove)를 사용해서 실제로 반영합니다. 반영 후 결과를 확인해 드립니다.
- 포트폴리오 추가는 티커·수량·평단가가 모두 필요합니다. 빠진 정보가 있으면 물어보세요.
- 최신 정보가 필요하면 web_search 도구로 직접 찾아봅니다.
- 딱딱한 애널리스트 말투보다는 친근하면서도 정중하게. 근거는 확실하게 제시합니다.
- 투자 조언은 참고용이고 최종 판단은 정일님 몫이라는 점을 자연스럽게 안내합니다.
- 확실하지 않은 건 솔직하게 모른다고 말합니다. 없는 숫자를 지어내지 않습니다.`;

    // 3) Claude 호출 + 도구 사용 루프
    let messages = [...history, { role: 'user', content: message }];
    let toolsUsed = false;

    // 웹검색 사용 가능 여부에 따라 도구 구성 (안 되면 커스텀 도구만)
    const callClaude = async (msgs, includeWebSearch) => {
      const tools = includeWebSearch
        ? [{ type: 'web_search_20250305', name: 'web_search' }, ...CUSTOM_TOOLS]
        : CUSTOM_TOOLS;
      return anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system,
        messages: msgs,
        tools,
      });
    };

    let useWebSearch = true;
    let response;
    try {
      response = await callClaude(messages, true);
    } catch {
      useWebSearch = false;
      response = await callClaude(messages, false);
    }

    // 도구 사용 루프 (최대 5회)
    let iterations = 0;
    while (response.stop_reason === 'tool_use' && iterations < 5) {
      iterations++;
      messages = [...messages, { role: 'assistant', content: response.content }];

      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          toolsUsed = true;
          const result = await executeTool(supabase, block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      messages = [...messages, { role: 'user', content: toolResults }];
      response = await callClaude(messages, useWebSearch);
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

    return Response.json({ reply, toolsUsed });
  } catch (e) {
    return Response.json({ reply: '', error: e.message }, { status: 500 });
  }
}
