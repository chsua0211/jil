'use client';

import { useState } from 'react';

export default function AnalystPanel() {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { brief, data }

  const analyze = async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym || loading) return;
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/analyst-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: sym }),
    });
    const d = await res.json();
    setResult(d);
    setLoading(false);
  };

  const rec = result?.data?.recommendation;
  const pt = result?.data?.priceTarget;
  const changes = result?.data?.changes || [];

  // 투자의견 막대 비율 계산
  const totalRec = rec ? rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell : 0;
  const buyPct = totalRec ? Math.round(((rec.strongBuy + rec.buy) / totalRec) * 100) : 0;

  return (
    <div className="panel">
      <div className="panel-title">📊 애널리스트 리포트 분석</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && analyze()}
          placeholder="종목 티커 (예: NVDA)"
          style={{
            flex: 1,
            padding: '9px 12px',
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={analyze}
          disabled={loading}
          style={{
            padding: '9px 16px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '분석 중...' : '분석'}
        </button>
      </div>

      {loading && (
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          애널리스트 데이터 가져와서 정베 스타일로 해석 중...
        </p>
      )}

      {result && !loading && (
        <div>
          {/* 데이터 카드 */}
          {(rec || pt) && (
            <div
              style={{
                background: 'var(--panel-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 14,
                marginBottom: 14,
              }}
            >
              {pt && (
                <div style={{ marginBottom: rec ? 14 : 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                    목표주가
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 700 }}>
                      ${pt.mean?.toFixed(1)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                      (${pt.low?.toFixed(0)} ~ ${pt.high?.toFixed(0)})
                    </span>
                  </div>
                </div>
              )}

              {rec && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-dim)',
                      marginBottom: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>투자의견 ({rec.period})</span>
                    <span className="up">매수 {buyPct}%</span>
                  </div>
                  {/* 의견 분포 막대 */}
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                    {rec.strongBuy + rec.buy > 0 && (
                      <div
                        style={{
                          flex: rec.strongBuy + rec.buy,
                          background: 'var(--up)',
                        }}
                      />
                    )}
                    {rec.hold > 0 && (
                      <div style={{ flex: rec.hold, background: 'var(--text-faint)' }} />
                    )}
                    {rec.sell + rec.strongSell > 0 && (
                      <div
                        style={{
                          flex: rec.sell + rec.strongSell,
                          background: 'var(--down)',
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: 'var(--text-faint)',
                      marginTop: 6,
                    }}
                  >
                    <span className="up">매수 {rec.strongBuy + rec.buy}</span>
                    <span>보유 {rec.hold}</span>
                    <span className="down">매도 {rec.sell + rec.strongSell}</span>
                  </div>
                </div>
              )}

              {/* 최근 의견 변경 */}
              {changes.length > 0 && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                    최근 의견 변경
                  </div>
                  {changes.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 12,
                        marginBottom: 4,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{c.company}</span>
                      <span
                        className={
                          c.action === 'up' ? 'up' : c.action === 'down' ? 'down' : ''
                        }
                        style={{ color: c.action === 'up' ? '' : c.action === 'down' ? '' : 'var(--text-dim)' }}
                      >
                        {c.to} {c.action === 'up' ? '↑' : c.action === 'down' ? '↓' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 정베 스타일 해석 */}
          {result.brief && (
            <div
              style={{
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent)',
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  marginBottom: 8,
                }}
              >
                🤖 정베 관점 분석
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {result.brief}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
