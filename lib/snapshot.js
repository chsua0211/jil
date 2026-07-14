import { getSupabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// 포트폴리오 일별 스냅샷 기록
//
// portfolio_history 테이블에 하루 한 줄씩 저장:
//  - value: 그날 마지막으로 확인한 포트폴리오 평가액 (USD)
//  - flow:  그날 매매로 들어오거나(+매수) 나간(-매도) 돈의 합계 (USD)
//
// 성과 차트는 이 기록으로 시간가중수익률을 계산하므로,
// 돈을 새로 넣어 평가액이 커진 것은 수익으로 치지 않는다.
// ─────────────────────────────────────────────────────────────

// 날짜 키는 한국 시간 기준 (사용자가 체감하는 "오늘"과 맞춤)
export function todayKst() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}

export async function fetchPrice(symbol) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`,
      { next: { revalidate: 60 } }
    );
    const q = await res.json();
    if (!q.c || q.c === 0) return null;
    return q.c;
  } catch {
    return null;
  }
}

// 현재 보유 종목 전체의 평가액 계산.
// 시세를 하나라도 못 가져오면 { value: null } — 잘못된 값으로 기록을 오염시키지 않기 위함.
async function computePortfolioValue() {
  const supabase = getSupabase();
  const { data: holdings } = await supabase.from('portfolio').select('symbol, shares');
  if (!holdings || holdings.length === 0) return { value: 0, empty: true };

  const prices = await Promise.all(holdings.map((h) => fetchPrice(h.symbol)));
  let value = 0;
  for (let i = 0; i < holdings.length; i++) {
    if (prices[i] === null) return { value: null }; // 시세 실패 → 기록 보류
    value += prices[i] * Number(holdings[i].shares);
  }
  return { value };
}

// 오늘 스냅샷 upsert. value는 덮어쓰고, flow는 그날 안에서 누적.
async function upsertSnapshot({ value, flow = 0 }) {
  const supabase = getSupabase();
  const date = todayKst();
  const { data: existing } = await supabase
    .from('portfolio_history')
    .select('date, flow')
    .eq('date', date)
    .maybeSingle();

  if (existing) {
    const patch = { flow: Number(existing.flow || 0) + flow };
    if (value !== null && value !== undefined) patch.value = value;
    await supabase.from('portfolio_history').update(patch).eq('date', date);
  } else {
    await supabase.from('portfolio_history').insert({ date, value: value ?? null, flow });
  }
}

// 평가액만 기록 (차트 조회 시 호출)
export async function recordValueSnapshot() {
  try {
    const { value } = await computePortfolioValue();
    await upsertSnapshot({ value });
  } catch {
    // 스냅샷 실패가 화면 기능을 막으면 안 됨
  }
}

// 매매 기록: flow(+매수 금액 / -매도 금액)를 누적하고 평가액도 갱신
export async function recordTrade(flow) {
  try {
    const { value } = await computePortfolioValue();
    await upsertSnapshot({ value, flow: Number(flow) || 0 });
  } catch {
    // 매매 자체는 이미 성공했으므로 기록 실패는 조용히 넘어감
  }
}
