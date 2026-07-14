'use client';

import { useState } from 'react';
import NewsPanel from './NewsPanel';
import Watchlist from './Watchlist';
import Chat from './Chat';
import AnalystPanel from './AnalystPanel';
import SurveyModal from './SurveyModal';

export default function Dashboard() {
  const [showSurvey, setShowSurvey] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px' }}>
      {/* 헤더 */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            📈
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>정일님의 투자 브리핑</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>미국장 · 실시간</div>
          </div>
        </div>
        <button
          onClick={() => setShowSurvey(true)}
          style={{
            padding: '8px 14px',
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          🧠 성향 설정
        </button>
      </header>

      {/* 3단 그리드 */}
      <div
        className="grid-main"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.85fr 1.05fr',
          gap: 12,
          alignItems: 'start',
        }}
      >
        <NewsPanel key={`news-${refreshKey}`} />
        <Watchlist key={`watch-${refreshKey}`} onChange={() => setRefreshKey((k) => k + 1)} />
        <Chat />
      </div>

      {/* 애널리스트 리포트 분석 (전체 폭) */}
      <div style={{ marginTop: 12 }}>
        <AnalystPanel />
      </div>

      {showSurvey && (
        <SurveyModal
          onClose={() => setShowSurvey(false)}
          onSaved={() => {
            setShowSurvey(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
