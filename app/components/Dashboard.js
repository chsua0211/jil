'use client';

import { useState } from 'react';
import NewsPanel from './NewsPanel';
import Watchlist from './Watchlist';
import Chat from './Chat';
import Portfolio from './Portfolio';
import PerformanceChart from './PerformanceChart';
import SurveyModal from './SurveyModal';
import AnalystPanel from './AnalystPanel';
import HomeDashboard from './HomeDashboard';
import { IconHome, IconChat, IconBriefcase, IconStar, IconTune } from './icons';

// 오른쪽 원형 아이콘 독 항목
const NAV = [
  { id: 'home', Icon: IconHome, title: '홈 대시보드' },
  { id: 'chat', Icon: IconChat, title: 'AI 채팅' },
  { id: 'portfolio', Icon: IconBriefcase, title: '포트폴리오' },
  { id: 'watch', Icon: IconStar, title: '관심종목·뉴스' },
];

const VIEW_TITLE = {
  chat: '💬 AI 채팅',
  portfolio: '💼 포트폴리오',
  watch: '⭐ 관심종목·뉴스',
};

export default function Dashboard() {
  const [tab, setTab] = useState('home'); // 첫 화면은 홈 대시보드
  const [showSurvey, setShowSurvey] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chatPrompt, setChatPrompt] = useState(null);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 76px 16px 16px' }}>
      {/* ── 오른쪽 고정 아이콘 독 ── */}
      <nav className="dock" aria-label="화면 이동">
        {NAV.map(({ id, Icon, title }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            title={title}
            aria-label={title}
            className={`dock-btn${tab === id ? ' active' : ''}`}
          >
            <Icon />
          </button>
        ))}
        <span className="dock-sep" />
        <button
          onClick={() => setShowSurvey(true)}
          title="성향 설정"
          aria-label="성향 설정"
          className="dock-btn"
        >
          <IconTune />
        </button>
      </nav>

      {/* 홈은 인사말이 헤더 역할, 나머지 화면만 제목 표시 */}
      {tab !== 'home' && (
        <header style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{VIEW_TITLE[tab]}</h1>
        </header>
      )}

      {/* ── 홈 대시보드 ── */}
      {tab === 'home' && <HomeDashboard refreshKey={refreshKey} />}

      {/* ── 채팅 ── */}
      {tab === 'chat' && (
        <Chat
          fullHeight
          externalPrompt={chatPrompt}
          onExternalConsumed={() => setChatPrompt(null)}
          onDataChanged={refresh}
        />
      )}

      {/* ── 포트폴리오 (성과 비교 차트 + 자산 현황) ── */}
      {tab === 'portfolio' && (
        <div>
          <PerformanceChart refreshKey={refreshKey} />
          <Portfolio refreshKey={refreshKey} />
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
            💡 종목 추가·수정·삭제는 채팅으로 해요. 예: &quot;엔비디아 10주 평단 150에 추가해줘&quot;,
            &quot;엔비디아에 1억 있어&quot;, &quot;테슬라 포트폴리오에서 빼줘&quot;
          </p>
        </div>
      )}

      {/* ── 관심종목 + 최신 뉴스 + 애널리스트 ── */}
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
