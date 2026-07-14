'use client';

import { useState, useEffect } from 'react';

const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmt2 = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 현황 보기 전용 패널. 입력/수정은 헤더의 포트폴리오 버튼 → 팝업에서.
export default function Portfolio({ onAskRisk, refreshKey }) {
  const [data, setData] = useState({ holdings: [], total: null });
  const [loading, setLoading] = useState(true);

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
  const totalUp = t && t.pnl >= 0;

  return (
    <div className="panel">
      <div className="panel-title">
        💼 내 포트폴리오
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>
          1분마다 갱신
        </span>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>불러오는 중...</p>}

      {!loading && data.holdings.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
          상단의 💼 포트폴리오 버튼에서 보유 종목을 입력해 보세요. 실시간 자산 현황이 여기 표시돼요.
        </p>
      )}

      {/* 총 자산 요약 */}
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
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>총 손익</div>
            <div className={totalUp ? 'up' : 'down'} style={{ fontSize: 18, fontWeight: 700 }}>
              {totalUp ? '+' : ''}{fmt(t.pnl)} ({totalUp ? '+' : ''}{t.pnlPct.toFixed(1)}%)
            </div>
          </div>
          <button
            onClick={onAskRisk}
            style={{
              padding: '9px 14px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            🛡️ AI 리스크 분석
          </button>
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
                <th style={thStyle('right')}>평가액</th>
                <th style={thStyle('right')}>수익률</th>
                <th style={thStyle('right')}>비중</th>
              </tr>
            </thead>
            <tbody>
              {data.holdings.map((h) => {
                const up = h.pnlPct >= 0;
                return (
                  <tr key={h.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 4px', fontWeight: 600 }}>{h.symbol}</td>
                    <td style={tdR}>{h.shares}</td>
                    <td style={tdR}>{fmt2(h.avgCost)}</td>
                    <td style={tdR}>{fmt2(h.price)}</td>
                    <td style={tdR}>{fmt(h.value)}</td>
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
    </div>
  );
}

const thStyle = (align) => ({
  textAlign: align,
  padding: '4px',
  fontWeight: 500,
});

const tdR = { padding: '9px 4px', textAlign: 'right' };
