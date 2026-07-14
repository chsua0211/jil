'use client';

import { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { sma, ichimoku, CloudPrimitive } from '../../lib/chartIndicators';

// 봉 간격 선택지
const INTERVALS = [
  { id: '1m', label: '1분봉', desc: '최근 2거래일 · 한국시간', dt: 60, visibleBars: 200, rangeLabel: '2일' },
  { id: '10m', label: '10분봉', desc: '최근 1개월 · 한국시간', dt: 600, visibleBars: 150, rangeLabel: '1개월' },
  { id: '1d', label: '일봉', desc: '최근 2년', dt: 86400, visibleBars: 130, rangeLabel: '52주' },
];

// 이동평균선 설정 (증권사 스타일 4개)
const MA_SET = [
  { period: 5, color: '#fbbf24' },
  { period: 20, color: '#f472b6' },
  { period: 60, color: '#60a5fa' },
  { period: 120, color: '#a78bfa' },
];

// 일목균형표 선 색
const ICHI_COLORS = {
  tenkan: '#f6465d', // 전환선
  kijun: '#4a8cff', // 기준선
  chikou: '#2ec26e', // 후행스팬
  spanA: 'rgba(46, 194, 110, 0.5)', // 선행스팬1
  spanB: 'rgba(246, 70, 93, 0.5)', // 선행스팬2
};

const KST_OFFSET = 9 * 3600; // 분봉은 한국시간으로 보정해서 표시

export default function StockChartModal({ symbol, onClose }) {
  const [iv, setIv] = useState('1d');
  const [candles, setCandles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMA, setShowMA] = useState(true);
  const [showIchi, setShowIchi] = useState(true);
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 1) 캔들 데이터 가져오기
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setCandles([]);

    fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${iv}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error || !d.candles?.length) setError(d.error || '차트 데이터가 없어요.');
        else setCandles(d.candles);
      })
      .catch(() => !cancelled && setError('차트 데이터를 불러오지 못했어요.'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [symbol, iv]);

  // 2) 차트 그리기 (데이터·지표 토글이 바뀔 때마다 다시)
  useEffect(() => {
    if (!candles.length || !containerRef.current) return;

    const meta = INTERVALS.find((x) => x.id === iv);
    const intraday = iv !== '1d';
    // 계산은 원본 초 단위로, 표시는 분봉=한국시간 숫자 / 일봉=날짜 문자열
    const toChartTime = (t) =>
      intraday ? t + KST_OFFSET : new Date(t * 1000).toISOString().slice(0, 10);

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8a95a5',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1c2634' },
        horzLines: { color: '#1c2634' },
      },
      timeScale: {
        borderColor: '#232d3d',
        timeVisible: intraday,
        secondsVisible: false,
        rightOffset: 2,
      },
      rightPriceScale: { borderColor: '#232d3d' },
      crosshair: {
        horzLine: { labelBackgroundColor: '#4a8cff' },
        vertLine: { labelBackgroundColor: '#4a8cff' },
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#2ec26e',
      downColor: '#f6465d',
      borderUpColor: '#2ec26e',
      borderDownColor: '#f6465d',
      wickUpColor: '#2ec26e',
      wickDownColor: '#f6465d',
    });
    candleSeries.setData(candles.map((c) => ({ ...c, time: toChartTime(c.time) })));

    const lineOpts = {
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    };
    const toLine = (arr) => arr.map((p) => ({ time: toChartTime(p.t), value: p.value }));

    // 이동평균선 4개
    if (showMA) {
      for (const { period, color } of MA_SET) {
        const data = sma(candles, period);
        if (!data.length) continue;
        chart.addLineSeries({ ...lineOpts, color }).setData(toLine(data));
      }
    }

    // 일목균형표: 구름대(채우기) + 전환·기준·후행·선행스팬
    if (showIchi && candles.length >= 52) {
      const ichi = ichimoku(candles, meta.dt);
      const cloudPoints = ichi.cloud.map((p) => ({ time: toChartTime(p.t), a: p.a, b: p.b }));
      candleSeries.attachPrimitive(new CloudPrimitive(cloudPoints));

      chart.addLineSeries({ ...lineOpts, color: ICHI_COLORS.spanA }).setData(
        cloudPoints.map((p) => ({ time: p.time, value: p.a }))
      );
      chart.addLineSeries({ ...lineOpts, color: ICHI_COLORS.spanB }).setData(
        cloudPoints.map((p) => ({ time: p.time, value: p.b }))
      );
      chart.addLineSeries({ ...lineOpts, color: ICHI_COLORS.tenkan }).setData(toLine(ichi.tenkan));
      chart.addLineSeries({ ...lineOpts, color: ICHI_COLORS.kijun }).setData(toLine(ichi.kijun));
      chart
        .addLineSeries({ ...lineOpts, color: ICHI_COLORS.chikou, lineStyle: 2 })
        .setData(toLine(ichi.chikou));
    }

    // 증권사처럼 최근 구간만 보여주고 왼쪽으로 스크롤 가능하게
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, candles.length - meta.visibleBars),
      to: candles.length + (showIchi ? 27 : 2),
    });

    chartRef.current = chart;
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, iv, showMA, showIchi]);

  const meta = INTERVALS.find((x) => x.id === iv);

  // 고점·저점 대비 등락 (일봉은 52주 기준, 분봉은 로드된 기간 기준)
  let stats = null;
  if (candles.length) {
    const scope = iv === '1d' ? candles.slice(-252) : candles;
    let hi = -Infinity;
    let lo = Infinity;
    for (const c of scope) {
      if (c.high > hi) hi = c.high;
      if (c.low < lo) lo = c.low;
    }
    const last = candles[candles.length - 1].close;
    stats = {
      last,
      hi,
      lo,
      fromHi: ((last - hi) / hi) * 100,
      fromLo: ((last - lo) / lo) * 100,
      prevUp: last >= candles[candles.length - 1].open,
    };
  }

  const chip = (active, color) => ({
    padding: '3px 9px',
    fontSize: 11,
    fontWeight: 600,
    background: active ? 'var(--panel-2)' : 'transparent',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    borderRadius: 6,
    color: active ? color : 'var(--text-faint)',
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{ width: 'min(920px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* 헤더: 종목 + 현재가 + 간격 버튼 */}
        <div className="panel-title" style={{ marginBottom: 8 }}>
          📊 {symbol}
          {stats && (
            <span className={stats.prevUp ? 'up' : 'down'} style={{ fontSize: 14, fontWeight: 700 }}>
              ${stats.last.toFixed(2)}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 400 }}>{meta.desc}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
            {INTERVALS.map((x) => {
              const active = iv === x.id;
              return (
                <button
                  key={x.id}
                  onClick={() => setIv(x.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    background: active ? 'var(--accent)' : 'var(--panel-2)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 6,
                    color: active ? '#fff' : 'var(--text-dim)',
                  }}
                >
                  {x.label}
                </button>
              );
            })}
            <button
              onClick={onClose}
              aria-label="닫기"
              style={{
                marginLeft: 6,
                padding: '4px 10px',
                fontSize: 13,
                background: 'var(--panel-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-dim)',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 고점·저점 대비 등락 요약 */}
        {stats && (
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              padding: '8px 12px',
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 8,
              fontSize: 12,
            }}
          >
            <span>
              <span style={{ color: 'var(--text-faint)' }}>{meta.rangeLabel} 최고 </span>
              <b>${stats.hi.toFixed(2)}</b>{' '}
              <span className={stats.fromHi >= 0 ? 'up' : 'down'} style={{ fontWeight: 700 }}>
                고점대비 {stats.fromHi >= 0 ? '+' : ''}
                {stats.fromHi.toFixed(1)}%
              </span>
            </span>
            <span>
              <span style={{ color: 'var(--text-faint)' }}>{meta.rangeLabel} 최저 </span>
              <b>${stats.lo.toFixed(2)}</b>{' '}
              <span className={stats.fromLo >= 0 ? 'up' : 'down'} style={{ fontWeight: 700 }}>
                저점대비 {stats.fromLo >= 0 ? '+' : ''}
                {stats.fromLo.toFixed(1)}%
              </span>
            </span>
          </div>
        )}

        {/* 지표 토글 + 범례 */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <button onClick={() => setShowMA(!showMA)} style={chip(showMA, '#fbbf24')}>
            이동평균선
          </button>
          {showMA &&
            MA_SET.map((m) => (
              <span key={m.period} style={{ fontSize: 10, color: m.color, fontWeight: 600 }}>
                ─ {m.period}
              </span>
            ))}
          <button
            onClick={() => setShowIchi(!showIchi)}
            style={{ ...chip(showIchi, '#4a8cff'), marginLeft: 8 }}
          >
            일목균형표
          </button>
          {showIchi && (
            <>
              <span style={{ fontSize: 10, color: ICHI_COLORS.tenkan, fontWeight: 600 }}>─ 전환</span>
              <span style={{ fontSize: 10, color: ICHI_COLORS.kijun, fontWeight: 600 }}>─ 기준</span>
              <span style={{ fontSize: 10, color: ICHI_COLORS.chikou, fontWeight: 600 }}>┄ 후행</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>▨ 구름대</span>
            </>
          )}
        </div>

        {loading && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>차트 불러오는 중...</p>}
        {!loading && error && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>{error}</p>}

        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: 440,
            display: loading || error ? 'none' : 'block',
          }}
        />
        {!loading && !error && (
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
            ⓘ 차트를 좌우로 드래그하면 과거 봉을, 휠로 확대·축소를 할 수 있어요.
            {iv !== '1d' && ' 분봉은 미국 정규장 시간만 표시돼요 (한국시간).'}
          </p>
        )}
      </div>
    </div>
  );
}
