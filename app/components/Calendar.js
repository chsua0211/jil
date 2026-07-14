'use client';

import { useState, useEffect } from 'react';

// 캘린더 탭: 월 달력 + 다가오는 일정 리스트
// 일정은 /api/calendar가 자동 수집 (실적 발표 + AI가 뉴스에서 추출)

const SOURCE_META = {
  earnings: { label: '실적', color: '#f0a12f' },
  ai: { label: '뉴스', color: '#4a8cff' },
};

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  const load = (refresh = false) => {
    setLoading(true);
    setError('');
    fetch(`/api/calendar${refresh ? '?refresh=1' : ''}`)
      .then((r) => r.json())
      .then((d) => {
        setEvents(d.events || []);
        if (d.error) setError(d.error);
      })
      .catch(() => setError('일정을 불러오지 못했어요.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    await fetch('/api/calendar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setEvents((ev) => ev.filter((e) => e.id !== id));
  };

  // 날짜별 이벤트 맵
  const byDate = {};
  for (const e of events) (byDate[e.date] = byDate[e.date] || []).push(e);

  // 달력 격자 (일요일 시작)
  const first = new Date(cursor.y, cursor.m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayKey = keyOf(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const upcoming = events.filter((e) => e.date >= todayKey).slice(0, 12);
  const dday = (date) => {
    const diff = Math.round((new Date(date) - new Date(todayKey)) / 864e5);
    return diff === 0 ? 'D-Day' : `D-${diff}`;
  };

  const move = (delta) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const navBtn = {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    background: 'var(--panel-2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-dim)',
  };

  return (
    <div>
      {/* 월 달력 */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-title">
          🗓️ {cursor.y}년 {cursor.m + 1}월
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button onClick={() => move(-1)} style={navBtn} aria-label="이전 달">◀</button>
            <button
              onClick={() => {
                const now = new Date();
                setCursor({ y: now.getFullYear(), m: now.getMonth() });
              }}
              style={navBtn}
            >
              오늘
            </button>
            <button onClick={() => move(1)} style={navBtn} aria-label="다음 달">▶</button>
            <button onClick={() => load(true)} style={{ ...navBtn, marginLeft: 6 }} title="뉴스에서 일정 다시 수집">
              ↻ 새로고침
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div
              key={d}
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: i === 0 ? 'var(--down)' : i === 6 ? 'var(--accent)' : 'var(--text-faint)',
                padding: '2px 0',
              }}
            >
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`p${i}`} />;
            const k = keyOf(cursor.y, cursor.m, d);
            const evts = byDate[k] || [];
            const isToday = k === todayKey;
            return (
              <div
                key={k}
                style={{
                  minHeight: 62,
                  borderRadius: 8,
                  padding: '4px 5px',
                  background: isToday ? 'rgba(74,140,255,0.10)' : 'var(--panel-2)',
                  border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'var(--accent)' : 'var(--text-dim)',
                    marginBottom: 2,
                  }}
                >
                  {d}
                </div>
                {evts.slice(0, 2).map((e) => (
                  <div
                    key={e.id}
                    title={`${e.title}${e.description ? ` — ${e.description}` : ''}`}
                    style={{
                      fontSize: 10,
                      lineHeight: 1.3,
                      marginBottom: 2,
                      padding: '1px 4px',
                      borderRadius: 4,
                      background: `${(SOURCE_META[e.source] || SOURCE_META.ai).color}22`,
                      color: (SOURCE_META[e.source] || SOURCE_META.ai).color,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {e.title}
                  </div>
                ))}
                {evts.length > 2 && (
                  <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>+{evts.length - 2}</div>
                )}
              </div>
            );
          })}
        </div>

        {loading && (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
            일정 수집 중... (뉴스를 읽고 있어요, 첫 로딩은 몇 초 걸릴 수 있어요)
          </p>
        )}
        {!loading && error && (
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>{error}</p>
        )}
      </div>

      {/* 다가오는 일정 */}
      <div className="panel">
        <div className="panel-title">⏰ 다가오는 일정</div>
        {!loading && upcoming.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            예정된 일정이 없어요. 뉴스에서 일정이 발견되면 자동으로 추가돼요.
          </p>
        )}
        {upcoming.map((e) => {
          const meta = SOURCE_META[e.source] || SOURCE_META.ai;
          return (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  minWidth: 44,
                }}
              >
                {dday(e.date)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', minWidth: 42 }}>
                {e.date.slice(5).replace('-', '/')}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</span>
              {e.description && (
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{e.description}</span>
              )}
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: `${meta.color}22`,
                  color: meta.color,
                  fontWeight: 600,
                }}
              >
                {meta.label}
              </span>
              <button
                onClick={() => remove(e.id)}
                title="일정 삭제"
                aria-label="일정 삭제"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-faint)',
                  fontSize: 12,
                  padding: '0 2px',
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>
          ⓘ 보유·관심 종목의 실적 발표일과, AI가 뉴스에서 찾은 주요 일정(FOMC·경제지표 등)이 자동으로
          모여요. 6시간마다 갱신되고, ↻ 새로고침으로 바로 수집할 수도 있어요.
        </p>
      </div>
    </div>
  );
}
