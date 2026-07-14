'use client';

import { useState, useEffect } from 'react';
import PerformanceChart from './PerformanceChart';
import StockChartModal from './StockChartModal';
import { IconBriefcase, IconStar } from './icons';

const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

// 억/만 단위로 짧게 (예: 1억 2,140만원)
const fmtKrwShort = (n) => {
  const v = Math.round(Number(n));
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e8) {
    const eok = Math.floor(abs / 1e8);
    const man = Math.round((abs % 1e8) / 1e4);
    return `${sign}${eok}억${man > 0 ? ` ${man.toLocaleString('ko-KR')}만` : ''}원`;
  }
  if (abs >= 1e4) return `${sign}${Math.round(abs / 1e4).toLocaleString('ko-KR')}만원`;
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
};

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

// 뉴스 상대 시간 (예: 12분 전)
function timeAgo(unixSec) {
  const diff = Math.max(0, Date.now() / 1000 - unixSec);
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}분 전`;
  if (diff < 86400) return `${Math.round(diff / 3600)}시간 전`;
  return `${Math.round(diff / 86400)}일 전`;
}

// 카드 헤더의 색깔 아이콘 칩
function IconChip({ color, children }) {
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        background: `${color}22`,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </span>
  );
}

const card = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '14px 16px',
};

export default function HomeDashboard({ refreshKey }) {
  const [pf, setPf] = useState(null); // /api/portfolio
  const [watch, setWatch] = useState([]); // 관심종목 + 시세
  const [news, setNews] = useState([]);
  const [fut, setFut] = useState(null); // 지수 선물
  const [spark, setSpark] = useState([]); // 총자산 미니 추세선
  const [chartSymbol, setChartSymbol] = useState(null);

  useEffect(() => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then(setPf)
      .catch(() => {});

    fetch('/api/data')
      .then((r) => r.json())
      .then(async ({ watchlist }) => {
        const items = (watchlist || []).slice(0, 5);
        if (!items.length) return setWatch([]);
        const res = await fetch(`/api/quote?symbols=${items.map((w) => w.symbol).join(',')}`);
        const { quotes } = await res.json();
        setWatch(quotes || []);
      })
      .catch(() => {});

    fetch('/api/news')
      .then((r) => r.json())
      .then((d) => setNews((d.news || []).slice(0, 3)))
      .catch(() => {});

    fetch('/api/futures')
      .then((r) => r.json())
      .then(setFut)
      .catch(() => {});

    fetch('/api/chart?days=30')
      .then((r) => r.json())
      .then((d) => setSpark((d.points || []).map((p) => p.my)))
      .catch(() => {});
  }, [refreshKey]);

  const t = pf?.total;
  const rate = pf?.usdKrw || 1400;
  const holdings = pf?.holdings || [];
  const totalUp = t && t.pnl >= 0;

  // 오늘 손익: 각 종목의 당일 등락률로 역산
  let todayPnl = null;
  if (holdings.length && t?.value > 0) {
    todayPnl = holdings.reduce((s, h) => {
      const dp = Number(h.dayChangePct) || 0;
      if (dp <= -100) return s;
      return s + (h.value - h.value / (1 + dp / 100));
    }, 0);
  }
  const todayBase = todayPnl !== null ? t.value - todayPnl : 0;
  const todayPct = todayPnl !== null && todayBase > 0 ? (todayPnl / todayBase) * 100 : 0;

  const top3 = [...holdings].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const open = usMarketOpen();

  // 미니 추세선 좌표
  let sparkPts = '';
  if (spark.length > 1) {
    const min = Math.min(...spark);
    const max = Math.max(...spark);
    const span = max - min || 1;
    sparkPts = spark
      .map((v, i) => `${(i / (spark.length - 1)) * 260},${36 - ((v - min) / span) * 32}`)
      .join(' ');
  }

  const pct = (v, digits = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;

  return (
    <div>
      {/* 인사말 + 장 상태 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{greeting()}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 999,
            background: open ? 'rgba(46,194,110,0.12)' : 'var(--panel-2)',
            color: open ? 'var(--up)' : 'var(--text-dim)',
            border: `1px solid ${open ? 'rgba(46,194,110,0.35)' : 'var(--border)'}`,
            fontWeight: 600,
          }}
        >
          ● 미국장 {open ? '개장중' : '마감'}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--panel-2)',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
          }}
        >
          환율 {Math.round(rate).toLocaleString('ko-KR')}원/$
        </span>
      </div>

      {/* 히어로: 총 자산 + 미니 지표 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1.6 1 240px', padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>총 평가액</div>
          {t ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 27, fontWeight: 700 }}>{fmt(t.value)}</span>
                <span
                  className={totalUp ? 'up' : 'down'}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: totalUp ? 'rgba(46,194,110,0.12)' : 'rgba(246,70,93,0.12)',
                  }}
                >
                  {totalUp ? '+' : ''}{fmt(t.pnl)} ({pct(t.pnlPct)})
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                ≈ {fmtKrwShort(t.value * rate)}
              </div>
              {sparkPts && (
                <svg viewBox="0 0 260 40" style={{ width: '100%', height: 40, marginTop: 8 }} aria-hidden="true">
                  <polyline points={sparkPts} fill="none" stroke="var(--accent)" strokeWidth="2" />
                </svg>
              )}
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
              아직 등록된 종목이 없어요. 채팅에 &quot;엔비디아에 1억 있어&quot;처럼 말씀해 보세요.
            </p>
          )}
        </div>

        <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...card, flex: 1, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>오늘 손익</div>
            {todayPnl !== null ? (
              <div className={todayPnl >= 0 ? 'up' : 'down'} style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                {todayPnl >= 0 ? '+' : ''}{fmt(todayPnl)} ({pct(todayPct)})
              </div>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--text-faint)', marginTop: 2 }}>—</div>
            )}
          </div>
          <div style={{ ...card, flex: 1, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>S&amp;P500 · 나스닥 선물</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
              {fut?.spx ? <span className={fut.spx.pct >= 0 ? 'up' : 'down'}>{pct(fut.spx.pct)}</span> : '—'}
              <span style={{ color: 'var(--text-faint)' }}> · </span>
              {fut?.ndq ? <span className={fut.ndq.pct >= 0 ? 'up' : 'down'}>{pct(fut.ndq.pct)}</span> : '—'}
            </div>
          </div>
          <div style={{ ...card, flex: 1, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>보유 종목</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{holdings.length}개</div>
          </div>
        </div>
      </div>

      {/* 성과 비교 차트 */}
      <PerformanceChart refreshKey={refreshKey} />

      {/* 3단 요약: 보유 Top3 / 관심종목 / 뉴스 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <IconChip color="#2ec26e"><IconBriefcase /></IconChip>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>보유 비중 Top 3</span>
          </div>
          {top3.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>보유 종목이 없어요</p>
          )}
          {top3.map((h) => (
            <div key={h.id} onClick={() => setChartSymbol(h.symbol)} style={{ cursor: 'pointer', marginBottom: 9 }}>
              <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{h.symbol}</span>
                <span className={h.pnlPct >= 0 ? 'up' : 'down'} style={{ fontWeight: 600 }}>{pct(h.pnlPct)}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--panel-2)', marginTop: 5 }}>
                <div style={{ width: `${Math.min(100, h.weight)}%`, height: 4, borderRadius: 2, background: 'var(--accent)' }} />
              </div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <IconChip color="#f0a12f"><IconStar /></IconChip>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>관심 종목</span>
          </div>
          {watch.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>관심 종목이 없어요</p>
          )}
          {watch.map((q, i) => (
            <div
              key={q.symbol}
              onClick={() => setChartSymbol(q.symbol)}
              style={{
                fontSize: 12,
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: i < watch.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 600 }}>{q.symbol}</span>
              <span className={(q.changePercent ?? 0) >= 0 ? 'up' : 'down'}>
                ${q.price?.toFixed(2)} {pct(q.changePercent ?? 0, 2)}
              </span>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <IconChip color="#f472b6">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5z" />
                <path d="M17 8h3v9a2 2 0 0 1-2 2" />
                <path d="M7 9h7M7 13h7M7 17h4" />
              </svg>
            </IconChip>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>주요 뉴스</span>
          </div>
          {news.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>뉴스를 불러오는 중...</p>}
          {news.map((n, i) => (
            <a
              key={i}
              href={n.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                fontSize: 12,
                lineHeight: 1.5,
                padding: '5px 0',
                color: 'var(--text)',
                textDecoration: 'none',
                borderBottom: i < news.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              {n.headline}{' '}
              <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>· {timeAgo(n.datetime)}</span>
            </a>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
        💡 종목을 클릭하면 차트가 열려요. 자세한 내용은 오른쪽 버튼으로 각 화면에서 볼 수 있어요.
      </p>

      {chartSymbol && <StockChartModal symbol={chartSymbol} onClose={() => setChartSymbol(null)} />}
    </div>
  );
}
