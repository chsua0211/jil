'use client';

import { useState, useEffect } from 'react';

// 리포트 탭: 리서치 소스들의 최신 헤드라인 목록 (5분마다 자동 새로고침)
// 클릭하면 원문 사이트가 새 탭으로 열림

const SOURCE_COLORS = {
  'TrendForce 프레스': '#f0a12f',
  'TrendForce 뉴스': '#e8b566',
  SemiAnalysis: '#4a8cff',
  'Fabricated Knowledge': '#8a7dff',
  '한경 컨센서스': '#2ec26e',
};

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [filter, setFilter] = useState('전체');

  const load = () => {
    fetch('/api/reports')
      .then((r) => r.json())
      .then((d) => {
        setReports(d.reports || []);
        setUpdatedAt(d.updatedAt ? new Date(d.updatedAt) : new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 300000); // 5분마다 새로고침
    return () => clearInterval(t);
  }, []);

  const sources = ['전체', ...Object.keys(SOURCE_COLORS)];
  const shown = filter === '전체' ? reports : reports.filter((r) => r.source === filter);

  return (
    <div className="panel">
      <div className="panel-title">
        📑 리서치 헤드라인
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>
          {updatedAt &&
            `${updatedAt.getHours().toString().padStart(2, '0')}:${updatedAt
              .getMinutes()
              .toString()
              .padStart(2, '0')} 갱신 · `}
          5분마다 자동 새로고침
        </span>
      </div>

      {/* 소스 필터 */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
        {sources.map((s) => {
          const active = filter === s;
          const color = SOURCE_COLORS[s] || 'var(--accent)';
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 999,
                background: active ? `${s === '전체' ? 'var(--accent)' : color}` : 'var(--panel-2)',
                border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                color: active ? '#fff' : 'var(--text-dim)',
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>헤드라인 모으는 중...</p>}
      {!loading && shown.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
          가져온 헤드라인이 없어요. 잠시 후 자동으로 다시 시도해요.
        </p>
      )}

      {shown.map((r, i) => (
        <a
          key={`${r.url}-${i}`}
          href={r.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            padding: '10px 0',
            borderBottom: '1px solid var(--border)',
            textDecoration: 'none',
            color: 'var(--text)',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 7px',
              borderRadius: 999,
              background: `${SOURCE_COLORS[r.source] || '#8a95a5'}22`,
              color: SOURCE_COLORS[r.source] || '#8a95a5',
              whiteSpace: 'nowrap',
            }}
          >
            {r.source}
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.5, flex: 1 }}>
            {r.titleKo || r.title}
            {r.titleKo && r.titleKo !== r.title && (
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                {r.title}
              </span>
            )}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
            {r.date ? r.date.slice(5).replace('-', '/') : ''} ↗
          </span>
        </a>
      ))}

      <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>
        ⓘ 헤드라인을 클릭하면 원문 사이트가 새 탭으로 열려요. 한경 컨센서스는 리포트 PDF가 바로 열려요.
      </p>
    </div>
  );
}
