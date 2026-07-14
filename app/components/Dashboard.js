'use client';

import { useState, useEffect } from 'react';
import NewsPanel from './NewsPanel';
import Watchlist from './Watchlist';
import Chat from './Chat';
import Portfolio from './Portfolio';
import PerformanceChart from './PerformanceChart';
import SurveyModal from './SurveyModal';
import AnalystPanel from './AnalystPanel';
import Calendar from './Calendar';
import Reports from './Reports';
import { IconHome, IconChat, IconBriefcase, IconStar, IconCalendar, IconReport, IconTune } from './icons';

// 화면 목록 (런처 버블 + 안쪽 화면의 독에서 공용)
const VIEWS = [
  { id: 'chat', Icon: IconChat, title: 'AI 채팅' },
  { id: 'portfolio', Icon: IconBriefcase, title: '포트폴리오' },
  { id: 'watch', Icon: IconStar, title: '관심종목·뉴스' },
  { id: 'calendar', Icon: IconCalendar, title: '캘린더' },
  { id: 'reports', Icon: IconReport, title: '리포트' },
];

// 시간대별 인사말
function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return '좋은 아침이에요, 정일님';
  if (h >= 12 && h < 18) return '좋은 오후예요, 정일님';
  return '좋은 저녁이에요, 정일님';
}

// 미국 정규장 개장 여부 (뉴욕 시간 월~금 9:30~16:00, 휴장일은 고려 안 함)
function usMarketOpen() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const day = get('weekday');
    const mins = Number(get('hour')) * 60 + Number(get('minute'));
    if (day === 'Sat' || day === 'Sun') return false;
    return mins >= 9 * 60 + 30 && mins < 16 * 60;
  } catch {
    return false;
  }
}

// 초까지 흐르는 디지털 시계
function Clock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div style={{ height: 56 }} />;
  const two = (n) => String(n).padStart(2, '0');
  return (
    <div
      style={{
        fontSize: 48,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: 3,
        lineHeight: 1.1,
      }}
    >
      {two(now.getHours())}:{two(now.getMinutes())}
      <span style={{ color: 'var(--text-dim)' }}>:{two(now.getSeconds())}</span>
    </div>
  );
}

// 런처 버블 배치: 크기가 다른 원들이 살짝 닿을 정도로 촘촘하게 (비대칭 클러스터)
// left/top은 390x300 컨테이너 기준 px
const BUBBLES = [
  { id: 'chat', size: 150, left: 125, top: 95, main: true, iconSize: 34 },
  { id: 'portfolio', size: 116, left: 40, top: 30, iconSize: 26 },
  { id: 'watch', size: 104, left: 258, top: 180, iconSize: 24 },
  { id: 'calendar', size: 96, left: 248, top: 36, iconSize: 22 },
  { id: 'reports', size: 80, left: 308, top: 115, iconSize: 20 },
];

export default function Dashboard() {
  const [tab, setTab] = useState('launcher'); // 첫 화면은 버블 런처
  const [showSurvey, setShowSurvey] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chatPrompt, setChatPrompt] = useState(null);
  const [reveal, setReveal] = useState(null); // 원형 확장 전환 상태

  const refresh = () => setRefreshKey((k) => k + 1);

  // 버블을 누르면: 그 위치에서 동그라미가 화면 전체로 커진 뒤 화면 전환
  const openView = (e, target) => {
    if (reveal) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
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

      {/* ── 첫 화면: 시계 + 비대칭 버블 런처 ── */}
      {tab === 'launcher' && (
        <div
          style={{
            minHeight: '86vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 26,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <Clock />
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 10 }}>{greeting()}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
              {' · '}
              <span style={{ color: open ? 'var(--up)' : 'var(--text-faint)' }}>
                미국장 {open ? '개장중' : '마감'}
              </span>
            </div>
          </div>

          <div className="bubble-field" style={{ position: 'relative', width: 390, height: 316 }}>
            {BUBBLES.map((b) => {
              const view = VIEWS.find((v) => v.id === b.id);
              return (
                <button
                  key={b.id}
                  onClick={(e) => openView(e, b.id)}
                  aria-label={view.title}
                  className={`bubble${b.main ? ' bubble-main' : ''}`}
                  style={{ width: b.size, height: b.size, left: b.left, top: b.top }}
                >
                  <view.Icon width={b.iconSize} height={b.iconSize} />
                  <span style={{ fontSize: b.main ? 13 : 12, fontWeight: 600 }}>{view.title}</span>
                </button>
              );
            })}

            {/* 앞으로 추가될 탭 자리 */}
            <div
              className="bubble bubble-ghost"
              style={{ width: 60, height: 60, left: 155, top: 255 }}
              title="앞으로 추가될 탭 자리"
              aria-hidden="true"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>

            {/* 성향 설정 (작은 버블) */}
            <button
              onClick={() => setShowSurvey(true)}
              aria-label="성향 설정"
              title="성향 설정"
              className="bubble"
              style={{ width: 64, height: 64, left: 76, top: 230 }}
            >
              <IconTune width={18} height={18} />
            </button>
          </div>
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

      {/* ── 캘린더 ── */}
      {tab === 'calendar' && <Calendar />}

      {/* ── 리포트 ── */}
      {tab === 'reports' && <Reports />}

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
