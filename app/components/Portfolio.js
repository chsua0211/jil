'use client';

import { useState, useEffect } from 'react';
import StockChartModal from './StockChartModal';

const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmt2 = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtKrw = (n) => '₩' + Math.round(Number(n)).toLocaleString('ko-KR');

// 억/만 단위로 짧게 (예: 9억 7,600만원)
const fmtKrwShort = (n) => {
  const v = Math.round(Number(n));
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e8) {
    const eok = Math.floor(abs / 1e8);
    const man = Math.round((abs % 1e8) / 1e4);
    return `${sign}${eok}억${man > 0 ? ` ${man.toLocaleString('ko-KR')}만` : ''}원`;
  }
  if (abs >= 1e4) return `${sign}${Math.round(abs / 1e4).toLocaleString('ko-KR')}만원`;
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
};

// 현황 보기 전용 패널. 종목 추가/수정/삭제는 채팅으로.
export default function Portfolio({ refreshKey }) {
  const [data, setData] = useState({ holdings: [], total: null, usdKrw: null });
  const [loading, setLoading] = useState(true);
  const [chartSymbol, setChartSymbol] = useState(null); // 클릭한 종목의 차트 모달

  const load = () => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // 1분마다 실시간 갱신
    return () => clearInterval(t);
  }, [refreshKey]);

  const t = data.total;
  const rate = data.usdKrw || 1400;
  const totalUp = t && t.pnl >= 0;

  return (
    <div className="panel">
      <div className="panel-title">
        💼 내 포트폴리오
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>
          환율 {Math.round(rate).toLocaleString('ko-KR')}원/$ · 1분마다 갱신
        </span>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>불러오는 중...</p>}

      {!loading && data.holdings.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
          아직 등록된 종목이 없어요. 홈 탭 채팅에 &quot;엔비디아에 1억 있어&quot;처럼 말씀하시면
          자동으로 등록되고, 실시간 자산 현황이 여기 표시돼요.
        </p>
      )}

      {/* 총 자산 요약 (달러 + 원화) */}
      {t && (
        <div
          style={{
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>총 평가액</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(t.value)}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>
              ≈ {fmtKrwShort(t.value * rate)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>총 손익</div>
            <div className={totalUp ? 'up' : 'down'} style={{ fontSize: 18, fontWeight: 700 }}>
              {totalUp ? '+' : ''}{fmt(t.pnl)} ({totalUp ? '+' : ''}{t.pnlPct.toFixed(1)}%)
            </div>
            <div className={totalUp ? 'up' : 'down'} style={{ fontSize: 13, marginTop: 2 }}>
              ≈ {totalUp ? '+' : ''}{fmtKrwShort(t.pnl * rate)}
            </div>
          </div>
        </div>
      )}

      {/* 보유 종목 테이블 */}
      {data.holdings.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                <th style={thStyle('left')}>종목</th>
                <th style={thStyle('right')}>수량</th>
                <th style={thStyle('right')}>평단</th>
                <th style={thStyle('right')}>현재가</th>
                <th style={thStyle('right')}>일일</th>
                <th style={thStyle('right')}>평가액</th>
                <th style={thStyle('right')}>수익률</th>
                <th style={thStyle('right')}>비중</th>
              </tr>
            </thead>
            <tbody>
              {data.holdings.map((h) => {
                const up = h.pnlPct >= 0;
                return (
                  <tr
                    key={h.id}
                    onClick={() => setChartSymbol(h.symbol)}
                    title="클릭하면 차트를 볼 수 있어요"
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '9px 4px', fontWeight: 600 }}>
                      {h.symbol} <span style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 400 }}>📊</span>
                    </td>
                    <td style={tdR}>{h.shares}</td>
                    <td style={tdR}>
                      {fmt2(h.avgCost)}
                      <div style={subKrw}>{fmtKrw(h.avgCost * rate)}</div>
                    </td>
                    <td style={tdR}>
                      {fmt2(h.price)}
                      <div style={subKrw}>{fmtKrw(h.price * rate)}</div>
                    </td>
                    <td style={tdR} className={(h.dayChangePct ?? 0) >= 0 ? 'up' : 'down'}>
                      {(h.dayChangePct ?? 0) >= 0 ? '+' : ''}{(h.dayChangePct ?? 0).toFixed(2)}%
                    </td>
                    <td style={tdR}>
                      {fmt(h.value)}
                      <div style={subKrw}>{fmtKrwShort(h.value * rate)}</div>
                    </td>
                    <td style={tdR} className={up ? 'up' : 'down'}>
                      {up ? '+' : ''}{h.pnlPct.toFixed(1)}%
                    </td>
                    <td style={tdR}>{h.weight.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {chartSymbol && (
        <StockChartModal symbol={chartSymbol} onClose={() => setChartSymbol(null)} />
      )}
    </div>
  );
}

const thStyle = (align) => ({
  textAlign: align,
  padding: '4px',
  fontWeight: 500,
});

const tdR = { padding: '9px 4px', textAlign: 'right', verticalAlign: 'top' };

const subKrw = { fontSize: 11, color: 'var(--text-faint)', marginTop: 1 };
