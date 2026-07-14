'use client';

import { useState } from 'react';
import NewsPanel from './NewsPanel';
import Watchlist from './Watchlist';
import Chat from './Chat';
import Portfolio from './Portfolio';
import PerformanceChart from './PerformanceChart';
import SurveyModal from './SurveyModal';
import AnalystPanel from './AnalystPanel';
import HomeDashboard, { greeting, usMarketOpen } from './HomeDashboard';
import { IconHome, IconChart, IconChat, IconBriefcase, IconStar, IconTune } from './icons';

// 화면 목록 (런처의 큰 원 + 안쪽 화면의 독에서 공용)
const VIEWS = [
  { id: 'dashboard', Icon: IconChart, title: '대시보드' },
  { id: 'chat', Icon: IconChat, title: 'AI 채팅' },
  { id: 'portfolio', Icon: IconBriefcase, title: '포트폴리오' },
  { id: 'watch', Icon: IconStar, title: '관심종목·뉴스' },
];

export default function Dashboard() {
  const [tab, setTab] = useState('launcher'); // 첫 화면은 원형 런처
  const [showSurvey, setShowSurvey] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chatPrompt, setChatPrompt] = useState(null);
  const [reveal, setReveal] = useState(null); // 원형 확장 전환 상태

  const refresh = () => setRefreshKey((k) => k + 1);

  // 런처의 원을 누르면: 그 위치에서 동그라미가 화면 전체로 커진 뒤 화면 전환
  const openView = (e, target) => {
    if (reveal) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // 화면 네 모서리까지 모두 덮는 확대 배율
    const dist = Math.hypot(
      Math.max(cx, window.innerWidth - cx),
      Math.max(cy, window.innerHeight - cy)
    );
    const scale = (dist * 2) / 100 + 0.6;
    setReveal({ cx, cy, scale, on: false, fade: false });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setReveal((v) => v && { ...v, on: true }))
    );
    setTimeout(() => {
      setTab(target);
      setReveal((v) => v && { ...v, fade: true });
    }, 460);
    setTimeout(() => setReveal(null), 820);
  };

  const open = usMarketOpen();

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: tab === 'launcher' ? 16 : '16px 76px 16px 16px' }}>
      {/* ── 원형 확장 전환 오버레이 ── */}
      {reveal && (
        <div
          style={{
            position: 'fixed',
            left: reveal.cx - 50,
            top: reveal.cy - 50,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'var(--accent)',
            transform: `scale(${reveal.on ? reveal.scale : 0.4})`,
            opacity: reveal.fade ? 0 : 1,
            transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.32s ease',
            zIndex: 999,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── 첫 화면: 가운데 원형 런처 ── */}
      {tab === 'launcher' && (
        <div
          style={{
            minHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 34,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 23, fontWeight: 700 }}>{greeting()}</div>
            <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 6 }}>
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
              {' · '}
              <span style={{ color: open ? 'var(--up)' : 'var(--text-faint)' }}>
                미국장 {open ? '개장중' : '마감'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', justifyContent: 'center' }}>
            {VIEWS.map(({ id, Icon, title }) => (
              <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <button onClick={(e) => openView(e, id)} className="launch-circle" aria-label={title}>
                  <Icon width={32} height={32} />
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{title}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowSurvey(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 999,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-faint)',
              fontSize: 12,
            }}
          >
            <IconTune width={15} height={15} /> 성향 설정
          </button>
        </div>
      )}

      {/* ── 안쪽 화면에서만 보이는 오른쪽 독 ── */}
      {tab !== 'launcher' && (
        <nav className="dock" aria-label="화면 이동">
          <button
            onClick={() => setTab('launcher')}
            title="처음으로"
            aria-label="처음으로"
            className="dock-btn"
          >
            <IconHome />
          </button>
          {VIEWS.map(({ id, Icon, title }) => (
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
      )}

      {tab !== 'launcher' && (
        <header style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>
            {VIEWS.find((v) => v.id === tab)?.title}
          </h1>
        </header>
      )}

      {/* ── 대시보드 (자산 요약) ── */}
      {tab === 'dashboard' && <HomeDashboard refreshKey={refreshKey} />}

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
