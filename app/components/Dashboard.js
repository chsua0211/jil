'use client';

import { useState, useEffect } from 'react';
import NewsPanel from './NewsPanel';
import Watchlist from './Watchlist';
import Chat from './Chat';
import AnalystPanel from './AnalystPanel';
import SurveyModal from './SurveyModal';

export default function Dashboard() {
  const [showSurvey, setShowSurvey] = useState(false);
  const [hasProfile, setHasProfile] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // 설문 했는지 확인 (안 했으면 배너 노출)
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => setHasProfile(d.answers && Object.keys(d.answers).length > 0));
  }, [refreshKey]);

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

      {/* 설문 안 했을 때 배너 */}
      {!hasProfile && (
        <div
          onClick={() => setShowSurvey(true)}
          className="panel"
          style={{
            marginBottom: 16,
            cursor: 'pointer',
            borderColor: 'var(--accent)',
            background: 'var(--accent-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>👋</span>
          <span style={{ fontSize: 14 }}>
            먼저 성향 설문을 채워 주세요. 그래야 AI가 <b>정일님 스타일로</b> 분석해 드려요!
          </span>
        </div>
      )}

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
