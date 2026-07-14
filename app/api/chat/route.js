import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../../../lib/supabase';
import { recordTrade } from '../../../lib/snapshot';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// 채팅 임시기억 유지 시간 (12시간)
const CHAT_TTL_MS = 12 * 60 * 60 * 1000;

// ── [신규] GET: 12시간 지난 채팅 자동 삭제 후, 남은 채팅 반환 ──
// Chat.js가 처음 켜질 때 이걸 불러와서 대화를 이어감 (새로고침 대응)
export async function GET() {
  try {
    const supabase = getSupabase();
    const cutoff = new Date(Date.now() - CHAT_TTL_MS).toISOString();

    // 12시간 지난 메시지 삭제
    await supabase.from('chat_messages').delete().lt('created_at', cutoff);

    // 남은 메시지 시간순 반환
    const { data } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .order('created_at');

    return Response.json({ messages: data || [] });
  } catch (e) {
    return Response.json({ messages: [], error: e.message }, { status: 500 });
  }
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

// ── [신규] 대화 히스토리 정리 ──
// DB에서 불러온 히스토리는 저장 실패/빈 응답 등으로 역할이 꼬여 있을 수 있음.
// Anthropic API는 user/assistant가 번갈아 나와야 하므로:
// 1) 빈 내용 제거  2) 같은 역할 연속이면 합침  3) 첫 메시지는 user가 되도록 정리
function sanitizeHistory(history) {
  const clean = [];
  for (const m of history || []) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const content = typeof m.content === 'string' ? m.content.trim() : '';
    if (!content) continue;
    const last = clean[clean.length - 1];
    if (last && last.role === m.role) {
      last.content += '\n\n' + content;
    } else {
      clean.push({ role: m.role, content });
    }
  }
  while (clean.length && clean[0].role !== 'user') clean.shift();
  return clean;
}

// ── 챗봇이 쓸 수 있는 도구들 (포트폴리오/관심종목 조작) ──
const CUSTOM_TOOLS = [
  {
    name: 'portfolio_add_by_amount',
    description:
      '투자 금액으로 포트폴리오에 종목을 등록합니다. 정일님이 "엔비디아에 1억 있어"처럼 금액만 말씀하시면 이 도구를 사용하세요. 실시간 현재가를 조회해서 보유 주 수를 역산하고, 평단가는 오늘 현재가로 기록합니다. 금액은 원화(KRW) 또는 달러(USD) 모두 가능합니다.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: '종목 티커 (예: NVDA)' },
        amount: { type: 'number', description: '투자 금액 숫자 (예: 100000000)' },
        currency: {
          type: 'string',
          enum: ['KRW', 'USD'],
          description: '금액의 통화. "1억", "5천만원"이면 KRW, "$5000"이면 USD',
        },
      },
      required: ['symbol', 'amount', 'currency'],
    },
  },
  {
    name: 'portfolio_add',
    description:
      '주 수를 알 때 포트폴리오에 종목을 추가합니다. 평단가를 모르면 생략하세요 (오늘 현재가로 자동 기록). 정일님이 평단을 원화로 말씀하시면(예: "평단 145만원") avg_cost_currency를 KRW로 지정하세요. 자동으로 달러로 환산됩니다. 금액만 아는 경우엔 portfolio_add_by_amount를 대신 사용하세요.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: '종목 티커 (예: NVDA)' },
        shares: { type: 'number', description: '보유 수량' },
        avg_cost: { type: 'number', description: '평단가 숫자 (모르면 생략, 현재가로 자동 기록)' },
        avg_cost_currency: {
          type: 'string',
          enum: ['KRW', 'USD'],
          description: '평단가의 통화. "만원", "원"이면 KRW, "$"나 "달러"면 USD. 생략 시 USD.',
        },
      },
      required: ['symbol', 'shares'],
    },
  },
  {
    name: 'portfolio_update',
    description: '포트폴리오의 기존 종목 수량이나 평단가를 수정합니다. 티커로 종목을 찾습니다. 평단을 원화로 말씀하시면 avg_cost_currency를 KRW로 지정하세요.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: '수정할 종목 티커' },
        shares: { type: 'number', description: '새 수량 (변경 시)' },
        avg_cost: { type: 'number', description: '새 평단가 (변경 시)' },
        avg_cost_currency: {
          type: 'string',
          enum: ['KRW', 'USD'],
          description: '평단가의 통화. "만원", "원"이면 KRW. 생략 시 USD.',
        },
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
    name: 'memory_add',
    description:
      '정일님이 "기억해줘"라고 요청하신 정보를 영구 저장합니다. 이후 모든 대화에서 이 정보를 참고하게 됩니다. 단일 정보는 간결한 한 문장으로 저장하세요. 정일님이 "지금까지 내용 요약해서 기억해줘"처럼 대화 요약 저장을 요청하시면, 이번 대화의 핵심(논의한 종목, 결론, 정일님의 의견·결정사항)을 2~5문장으로 요약해서 저장하세요.',
    input_schema: {
      type: 'object',
      properties: { content: { type: 'string', description: '기억할 내용 (단일 정보는 한 문장, 대화 요약은 2~5문장)' } },
      required: ['content'],
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

// 실시간 현재가 조회 (티커 검증 겸용). 없는 종목이면 null 반환.
async function fetchPrice(symbol) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
    );
    const q = await res.json();
    // 존재하지 않는 티커는 c(현재가)가 0으로 옴
    if (!q.c || q.c === 0) return null;
    return q.c;
  } catch {
    return null;
  }
}

// 원/달러 환율 조회 (실패 시 대략치 사용)
async function fetchUsdKrw() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await res.json();
    if (d?.rates?.KRW) return d.rates.KRW;
  } catch {}
  return 1400; // 조회 실패 시 대략치
}

// 평단가를 USD로 정규화 + 이상치 감지
// 반환: { ok: true, usd, note } 또는 { ok: false, error }
async function normalizeAvgCost(rawCost, currency, currentPrice) {
  let usd = Number(rawCost);
  let note = '';
  if (currency === 'KRW') {
    const rate = await fetchUsdKrw();
    usd = Math.round((usd / rate) * 100) / 100;
    note = ` (원화 ${Number(rawCost).toLocaleString()}원 → 환율 ${Math.round(rate)}원/$ 환산)`;
  }
  // 이상치 감지: 평단이 현재가의 15배 이상 or 1/15 이하면 통화 착오 가능성이 높음
  if (currentPrice && (usd > currentPrice * 15 || usd < currentPrice / 15)) {
    return {
      ok: false,
      error: `평단가 $${usd.toLocaleString()}는 현재가 $${currentPrice.toFixed(2)}와 차이가 너무 큽니다. 원화 금액을 달러로 입력하신 것 아닌지 정일님께 확인해 주세요. 원화가 맞다면 avg_cost_currency를 'KRW'로 지정해 다시 시도하세요.`,
    };
  }
  return { ok: true, usd, note };
}

// 도구 실행기: Claude가 도구를 쓰겠다고 하면 실제 DB 조작을 수행
async function executeTool(supabase, name, input) {
  const sym = (input.symbol || '').toUpperCase().trim();
  try {
    if (name === 'portfolio_add_by_amount') {
      const price = await fetchPrice(sym);
      if (!price) return { ok: false, error: `${sym}은(는) 존재하지 않는 티커이거나 시세를 찾을 수 없습니다. 티커를 다시 확인해 주세요.` };

      let usdAmount = Number(input.amount);
      let rate = null;
      if (input.currency === 'KRW') {
        rate = await fetchUsdKrw();
        usdAmount = usdAmount / rate;
      }
      const shares = Math.round((usdAmount / price) * 100) / 100; // 소수 둘째자리
      if (shares <= 0) return { ok: false, error: '금액이 너무 작아서 계산할 수 없습니다.' };

      const { error } = await supabase.from('portfolio').insert({
        symbol: sym,
        shares,
        avg_cost: price,
      });
      if (error) return { ok: false, error: error.message };
      await recordTrade(shares * price); // 성과 차트용 매수 기록
      return {
        ok: true,
        message: `${sym} 등록 완료: 현재가 $${price.toFixed(2)} 기준 약 ${shares}주${rate ? ` (환율 ${Math.round(rate)}원/$ 적용)` : ''}. 평단가는 오늘 현재가로 기록됨 (대략치)`,
      };
    }
    if (name === 'portfolio_add') {
      const price = await fetchPrice(sym);
      if (!price) return { ok: false, error: `${sym}은(는) 존재하지 않는 티커이거나 시세를 찾을 수 없습니다. 티커를 다시 확인해 주세요.` };
      let avgCost = price;
      let note = ', 오늘 현재가로 기록';
      if (input.avg_cost !== undefined) {
        const norm = await normalizeAvgCost(input.avg_cost, input.avg_cost_currency, price);
        if (!norm.ok) return norm;
        avgCost = norm.usd;
        note = norm.note;
      }
      const { error } = await supabase.from('portfolio').insert({
        symbol: sym,
        shares: Number(input.shares),
        avg_cost: avgCost,
      });
      if (error) return { ok: false, error: error.message };
      await recordTrade(Number(input.shares) * price); // 성과 차트용 매수 기록
      return {
        ok: true,
        message: `${sym} ${input.shares}주 추가됨 (평단 $${avgCost.toFixed(2)}${note})`,
      };
    }
    if (name === 'portfolio_update') {
      const { data: rows } = await supabase.from('portfolio').select('*').eq('symbol', sym).limit(1);
      if (!rows || rows.length === 0) return { ok: false, error: `포트폴리오에 ${sym}이(가) 없습니다.` };
      const patch = {};
      let note = '';
      if (input.shares !== undefined) patch.shares = Number(input.shares);
      if (input.avg_cost !== undefined) {
        const price = await fetchPrice(sym);
        const norm = await normalizeAvgCost(input.avg_cost, input.avg_cost_currency, price);
        if (!norm.ok) return norm;
        patch.avg_cost = norm.usd;
        note = norm.note;
      }
      if (Object.keys(patch).length === 0) return { ok: false, error: '변경할 값이 없습니다.' };
      const { error } = await supabase.from('portfolio').update(patch).eq('id', rows[0].id);
      if (error) return { ok: false, error: error.message };
      // 수량이 바뀌었으면 그 차이만큼 매매로 기록 (성과 차트용)
      if (patch.shares !== undefined) {
        const delta = Number(patch.shares) - Number(rows[0].shares);
        if (delta !== 0) {
          const p = (await fetchPrice(sym)) || Number(rows[0].avg_cost) || 0;
          await recordTrade(delta * p);
        }
      }
      return { ok: true, message: `${sym} 수정됨${patch.avg_cost !== undefined ? ` (평단 $${patch.avg_cost.toFixed(2)}${note})` : ''}` };
    }
    if (name === 'portfolio_remove') {
      // 삭제 = 전량 매도 → 성과 차트용 flow 계산을 위해 삭제 전 수량 확보
      const { data: rows } = await supabase.from('portfolio').select('shares, avg_cost').eq('symbol', sym);
      const { error } = await supabase.from('portfolio').delete().eq('symbol', sym);
      if (error) return { ok: false, error: error.message };
      if (rows && rows.length > 0) {
        const totalShares = rows.reduce((s, r) => s + Number(r.shares), 0);
        const p = (await fetchPrice(sym)) || Number(rows[0].avg_cost) || 0;
        await recordTrade(-totalShares * p);
      }
      return { ok: true, message: `${sym} 포트폴리오에서 삭제됨` };
    }
    if (name === 'memory_add') {
      const { error } = await supabase.from('memories').insert({ content: input.content });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: '기억했습니다: ' + input.content };
    }
    if (name === 'watchlist_add') {
      const price = await fetchPrice(sym);
      if (!price) return { ok: false, error: `${sym}은(는) 존재하지 않는 티커이거나 시세를 찾을 수 없습니다.` };
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
    const { message, history = [], remember = false } = await request.json();
    const supabase = getSupabase();
    const anthropic = getAnthropic();

    // 0) 기억 버튼 켜고 보낸 메시지는 바로 DB에 저장
    if (remember && message?.trim()) {
      await supabase.from('memories').insert({ content: message.trim() });
    }

    // 0-1) 저장된 기억 전부 불러오기 (모든 대화에서 참고)
    let memoriesText = '';
    try {
      const { data: mems } = await supabase
        .from('memories')
        .select('content, created_at')
        .order('created_at');
      if (mems && mems.length > 0) {
        memoriesText =
          '\n\n[정일님이 기억시킨 정보]\n' + mems.map((m) => `- ${m.content}`).join('\n');
      }
    } catch {}

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
${memoriesText}

${portfolioText}

[관심종목] ${watchlistText}

규칙:
- 사용자는 항상 '정일님'이라고 부릅니다. '정베' 같은 다른 호칭은 절대 쓰지 않습니다.
- 항상 정중한 존댓말로 답합니다.
- 모든 조언은 정일님의 실제 포트폴리오를 기준으로 합니다.
- 정일님의 성향(손절 원칙, 위험 태도 등)과 실제 수익률을 연결해서 조언합니다.
- 리스크 분석 시 구체적으로: 종목/섹터 쏠림(비중 30% 이상이면 집중 리스크 언급), 전체 손익 상태, 변동성 등을 숫자에 근거해 설명합니다.
- 정일님이 포트폴리오나 관심종목의 추가/수정/삭제를 요청하시면 도구를 사용해서 실제로 반영합니다. 반영 후 결과를 확인해 드립니다.
- 정일님은 보통 "엔비디아에 1억 있어"처럼 금액으로 말씀하십니다. 이때는 portfolio_add_by_amount 도구를 쓰세요. 실시간 현재가로 주 수가 자동 역산됩니다. 한국어 금액 표현을 숫자로 정확히 변환하세요: 1억 = 100000000, 5천만원 = 50000000, 3백만원 = 3000000. "원", "억", "만원"이면 currency는 KRW, "$"나 "달러"면 USD입니다.
- 주 수를 직접 말씀하시면 portfolio_add를 쓰되, 평단가를 안 말씀하셨으면 avg_cost를 생략하세요 (현재가로 자동 기록).
- 평단가를 원화로 말씀하시면(예: "평단 145만원") 반드시 avg_cost_currency를 'KRW'로 지정하세요. 자동으로 달러 환산됩니다. 평단가는 1주당 가격입니다. "만원"·"원" 단위면 KRW, "$"·"달러"면 USD입니다.
- 존재하지 않는 티커는 도구가 거부합니다. 회사 이름으로 말씀하시면 올바른 티커로 변환하세요 (예: 엔비디아 → NVDA, 테슬라 → TSLA, 애플 → AAPL).
- 등록된 평단가는 대략치(등록 당시 현재가)임을 알고 계시고, 수익률도 그 기준의 대략적인 수치라고 이해하세요.
- 정일님이 "기억해줘", "메모해둬" 등으로 요청하시면 memory_add 도구로 핵심을 저장합니다. [정일님이 기억시킨 정보]는 항상 참고해서 답합니다.
- 정일님이 "지금까지 내용 요약해서 기억해줘"처럼 대화 요약 저장을 요청하시면: 이번 대화에서 논의한 종목, 핵심 결론, 정일님의 의견이나 결정사항을 2~5문장으로 요약한 뒤 memory_add 도구로 저장합니다. 저장 후에는 무엇을 기억했는지 요약 내용을 보여드립니다.
- 최신 정보가 필요하면 web_search 도구로 직접 찾아봅니다.
- 딱딱한 애널리스트 말투보다는 친근하면서도 정중하게. 근거는 확실하게 제시합니다.
- 투자 조언은 참고용이고 최종 판단은 정일님 몫이라는 점을 자연스럽게 안내합니다.
- 확실하지 않은 건 솔직하게 모른다고 말합니다. 없는 숫자를 지어내지 않습니다.`;

    // 3) Claude 호출 + 도구 사용 루프
    // 히스토리 정리: 빈 내용 제거 + 역할 교대 보장 (DB에서 불러온 기록 대응)
    let messages = sanitizeHistory([...history, { role: 'user', content: message }]);
    let toolsUsed = false;

    // 웹검색 사용 가능 여부에 따라 도구 구성 (안 되면 커스텀 도구만)
    const callClaude = async (msgs, includeWebSearch) => {
      const tools = includeWebSearch
        ? [{ type: 'web_search_20250305', name: 'web_search' }, ...CUSTOM_TOOLS]
        : CUSTOM_TOOLS;
      return anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000, // 사실상 제한 없음 (한글 수만 자 분량)
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
    // 빈 응답은 저장하지 않음 → 나중에 불러올 때 히스토리가 꼬이지 않게
    const toSave = [{ role: 'user', content: message }];
    if (reply) toSave.push({ role: 'assistant', content: reply });
    supabase.from('chat_messages').insert(toSave).then(() => {}, () => {});

    return Response.json({ reply, toolsUsed });
  } catch (e) {
    return Response.json({ reply: '', error: e.message }, { status: 500 });
  }
}
