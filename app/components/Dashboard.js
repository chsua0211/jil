'use client';

import { useState } from 'react';
import NewsPanel from './NewsPanel';
import Watchlist from './Watchlist';
import Chat from './Chat';
import Portfolio from './Portfolio';
import PerformanceChart from './PerformanceChart';
import SurveyModal from './SurveyModal';
import AnalystPanel from './AnalystPanel';

const TABS = [
  { id: 'home', label: '🏠 홈', title: '홈' },
  { id: 'portfolio', label: '💼 포트폴리오', title: '포트폴리오' },
  { id: 'watch', label: '⭐ 관심종목·뉴스', title: '관심종목·뉴스' },
];

export default function Dashboard() {
  const [tab, setTab] = useState('home'); // 첫 화면은 채팅(홈)
  const [showSurvey, setShowSurvey] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chatPrompt, setChatPrompt] = useState(null);

  const refresh = () => setRefreshKey((k) => k + 1);

  // 리스크 분석: 홈 탭으로 이동하면서 챗봇에 질문 전달
  const askRisk = () => {
    setTab('home');
    setChatPrompt(
      '내 포트폴리오 리스크 분석해줘. 종목/섹터 쏠림, 수익률 상태, 내 손절 원칙 기준으로 위험한 종목 있는지, 그리고 개선 방향까지 알려줘.'
    );
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 16px' }}>
      {/* 헤더: 탭 네비게이션 */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '10px 18px',
                  background: active ? 'var(--accent)' : 'var(--panel-2)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 10,
                  color: active ? '#fff' : 'var(--text)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowSurvey(true)}
            style={{
              padding: '10px 14px',
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            🧠 성향 설정
          </button>
        </div>
      </header>

      {/* ── 탭 1: 홈 (채팅 전체 화면) ── */}
      {tab === 'home' && (
        <Chat
          fullHeight
          externalPrompt={chatPrompt}
          onExternalConsumed={() => setChatPrompt(null)}
          onDataChanged={refresh}
        />
      )}

      {/* ── 탭 2: 포트폴리오 (성과 비교 차트 + 자산 현황) ── */}
      {tab === 'portfolio' && (
        <div>
          <PerformanceChart refreshKey={refreshKey} />
          <Portfolio refreshKey={refreshKey} onAskRisk={askRisk} />
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
            💡 종목 추가·수정·삭제는 채팅으로 해요. 예: &quot;엔비디아 10주 평단 150에 추가해줘&quot;,
            &quot;엔비디아에 1억 있어&quot;, &quot;테슬라 포트폴리오에서 빼줘&quot;
          </p>
        </div>
      )}

      {/* ── 탭 3: 관심종목 + 최신 뉴스 + 애널리스트 ── */}
      {tab === 'watch' && (
        <div>
          <div
            className="grid-main"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.2fr',
              gap: 12,
              alignItems: 'start',
            }}
          >
            <Watchlist key={`watch-${refreshKey}`} onChange={refresh} />
            <NewsPanel key={`news-${refreshKey}`} />
          </div>
          <div style={{ marginTop: 12 }}>
            <AnalystPanel />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
            💡 채팅에서도 관리할 수 있어요. 예: &quot;테슬라 관심종목에 넣어줘&quot;
          </p>
        </div>
      )}

      {showSurvey && (
        <SurveyModal
          onClose={() => setShowSurvey(false)}
          onSaved={() => {
            setShowSurvey(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
