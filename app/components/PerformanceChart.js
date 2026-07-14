'use client';

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

const PERIODS = [
  { days: 30, label: '1개월' },
  { days: 90, label: '3개월' },
  { days: 180, label: '6개월' },
  { days: 365, label: '1년' },
];

const LINE_META = {
  my: { name: '내 포트폴리오', color: '#4a8cff' },
  spx: { name: 'S&P500 선물', color: '#2ec26e' },
  ndq: { name: '나스닥 선물', color: '#f0a12f' },
};

export default function PerformanceChart({ refreshKey }) {
  const [days, setDays] = useState(90);
  const [points, setPoints] = useState([]);
  const [excluded, setExcluded] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/chart?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setPoints(d.points || []);
        setExcluded(d.excluded || []);
        if (d.error) setError(d.error);
      })
      .catch(() => setError('차트 데이터를 불러오지 못했어요.'))
      .finally(() => setLoading(false));
  }, [days, refreshKey]);

  const last = points[points.length - 1];

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-title">
        📈 성과 비교 (시작일 = 100)
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {PERIODS.map((p) => {
            const active = days === p.days;
            return (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: active ? 'var(--accent)' : 'var(--panel-2)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 6,
                  color: active ? '#fff' : 'var(--text-dim)',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>차트 그리는 중...</p>}
      {!loading && error && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>{error}</p>}

      {!loading && !error && points.length > 1 && (
        <>
          {/* 기간 수익률 요약 */}
          {last && (
            <div style={{ display: 'flex', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
              {['my', 'spx', 'ndq'].map((k) => {
                const pct = last[k] - 100;
                const up = pct >= 0;
                return (
                  <div key={k} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: LINE_META[k].color,
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ color: 'var(--text-dim)' }}>{LINE_META[k].name}</span>
                    <span className={up ? 'up' : 'down'} style={{ fontWeight: 700 }}>
                      {up ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                  tickFormatter={(d) => d.slice(5)} // MM-DD
                  minTickGap={40}
                  stroke="var(--border)"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                  stroke="var(--border)"
                />
                <ReferenceLine y={100} stroke="var(--text-faint)" strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--panel-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--text-dim)' }}
                  formatter={(value, key) => [
                    `${value.toFixed(1)} (${value - 100 >= 0 ? '+' : ''}${(value - 100).toFixed(1)}%)`,
                    LINE_META[key]?.name || key,
                  ]}
                />
                <Legend
                  formatter={(key) => (
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {LINE_META[key]?.name || key}
                    </span>
                  )}
                />
                {['my', 'spx', 'ndq'].map((k) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={LINE_META[k].color}
                    strokeWidth={k === 'my' ? 2.5 : 1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
            ⓘ 현재 보유 종목·수량을 기간 내내 그대로 들고 있었다고 가정한 지수예요 (매매 시점 미반영).
            {excluded.length > 0 && ` 시세를 못 찾은 종목은 제외됨: ${excluded.join(', ')}`}
          </p>
        </>
      )}
    </div>
  );
}
