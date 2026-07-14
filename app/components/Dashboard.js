'use client';

import { useState } from 'react';
import NewsPanel from './NewsPanel';
import Watchlist from './Watchlist';
import Chat from './Chat';
import Portfolio from './Portfolio';
import PerformanceChart from './PerformanceChart';
import SurveyModal from './SurveyModal';
import AnalystPanel from './AnalystPanel';

// 오른쪽 원형 아이콘 내비게이션 항목
const NAV = [
  { id: 'home', icon: '🏠', title: '홈 대시보드' },
  { id: 'chat', icon: '💬', title: 'AI 채팅' },
  { id: 'portfolio', icon: '💼', title: '포트폴리오' },
  { id: 'watch', icon: '⭐', title: '관심종목·뉴스' },
];

const VIEW_TITLE = {
  home: '🏠 홈 대시보드',
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

  // 리스크 분석: 채팅으로 이동하면서 챗봇에 질문 전달
  const askRisk = () => {
    setTab('chat');
    setChatPrompt(
      '내 포트폴리오 리스크 분석해줘. 종목/섹터 쏠림, 수익률 상태, 내 손절 원칙 기준으로 위험한 종목 있는지, 그리고 개선 방향까지 알려줘.'
    );
  };

  // 원형 아이콘 버튼 스타일
  const circle = (active) => ({
    width: 48,
    height: 48,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    background: active ? 'var(--accent)' : 'var(--panel)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
    transition: 'transform 0.1s, background 0.15s',
  });

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 76px 16px 16px' }}>
      {/* ── 오른쪽 고정 원형 아이콘 내비게이션 ── */}
      <nav
        style={{
          position: 'fixed',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 100,
        }}
      >
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            title={n.title}
            aria-label={n.title}
            style={circle(tab === n.id)}
          >
            {n.icon}
          </button>
        ))}
        <button
          onClick={() => setShowSurvey(true)}
          title="성향 설정"
          aria-label="성향 설정"
          style={circle(false)}
        >
          🧠
        </button>
      </nav>

      {/* 현재 화면 제목 */}
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>{VIEW_TITLE[tab]}</h1>
      </header>

      {/* ── 홈 대시보드: 한눈에 보는 요약 ── */}
      {tab === 'home' && (
        <div>
          <PerformanceChart refreshKey={refreshKey} />
          <div style={{ marginBottom: 12 }}>
            <Portfolio refreshKey={refreshKey} onAskRisk={askRisk} />
          </div>
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
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
            💡 오른쪽 동그란 버튼으로 화면을 이동해요. 종목을 클릭하면 차트가 열려요.
          </p>
        </div>
      )}

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
          <Portfolio refreshKey={refreshKey} onAskRisk={askRisk} />
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
