import { getSupabase } from '../../../lib/supabase';

// 포트폴리오 조회: 보유 종목 + 실시간 주가 합쳐서 평가액/수익률/비중까지 계산해서 반환
export async function GET() {
  const supabase = getSupabase();
  const key = process.env.FINNHUB_API_KEY;

  const { data: holdings } = await supabase
    .from('portfolio')
    .select('*')
    .order('created_at');

  if (!holdings || holdings.length === 0) {
    return Response.json({ holdings: [], total: null });
  }

  // 실시간 주가 가져오기
  const enriched = await Promise.all(
    holdings.map(async (h) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${h.symbol}&token=${key}`,
          { next: { revalidate: 60 } }
        );
        const q = await res.json();
        const price = q.c || 0;
        const value = price * Number(h.shares);            // 현재 평가액
        const cost = Number(h.avg_cost) * Number(h.shares); // 매수 원금
        const pnl = value - cost;                            // 손익
        const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;    // 수익률
        return {
          id: h.id,
          symbol: h.symbol,
          shares: Number(h.shares),
          avgCost: Number(h.avg_cost),
          price,
          dayChangePct: q.dp ?? 0,
          value,
          cost,
          pnl,
          pnlPct,
        };
      } catch {
        return {
          id: h.id,
          symbol: h.symbol,
          shares: Number(h.shares),
          avgCost: Number(h.avg_cost),
          price: 0, dayChangePct: 0, value: 0,
          cost: Number(h.avg_cost) * Number(h.shares),
          pnl: 0, pnlPct: 0,
        };
      }
    })
  );

  // 전체 합계 + 비중 계산
  const totalValue = enriched.reduce((s, h) => s + h.value, 0);
  const totalCost = enriched.reduce((s, h) => s + h.cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const withWeight = enriched.map((h) => ({
    ...h,
    weight: totalValue > 0 ? (h.value / totalValue) * 100 : 0, // 포트폴리오 내 비중(%)
  }));

  return Response.json({
    holdings: withWeight,
    total: { value: totalValue, cost: totalCost, pnl: totalPnl, pnlPct: totalPnlPct },
  });
}

// 종목 추가: { symbol, shares, avgCost }
export async function POST(request) {
  const supabase = getSupabase();
  const { symbol, shares, avgCost } = await request.json();
  if (!symbol || !shares) {
    return Response.json({ ok: false, error: '종목과 수량을 입력해 주세요.' }, { status: 400 });
  }
  const sym = symbol.toUpperCase().trim();

  // 실존 티커 검증 겸 현재가 조회
  let price = 0;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${sym}&token=${process.env.FINNHUB_API_KEY}`
    );
    const q = await res.json();
    price = q.c || 0;
  } catch {}
  if (!price) {
    return Response.json(
      { ok: false, error: `${sym}은(는) 존재하지 않는 티커이거나 시세를 찾을 수 없어요. 다시 확인해 주세요.` },
      { status: 400 }
    );
  }

  // 평단가 비우면 오늘 현재가로 자동 기록 (대략치)
  const cost = avgCost ? Number(avgCost) : price;

  const { error } = await supabase.from('portfolio').insert({
    symbol: sym,
    shares: Number(shares),
    avg_cost: cost,
  });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, usedCurrentPrice: !avgCost, price });
}

// 종목 수정: { id, shares, avgCost }
export async function PUT(request) {
  const supabase = getSupabase();
  const { id, shares, avgCost } = await request.json();
  const { error } = await supabase
    .from('portfolio')
    .update({ shares: Number(shares), avg_cost: Number(avgCost) })
    .eq('id', id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

// 종목 삭제: { id }
export async function DELETE(request) {
  const supabase = getSupabase();
  const { id } = await request.json();
  const { error } = await supabase.from('portfolio').delete().eq('id', id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
