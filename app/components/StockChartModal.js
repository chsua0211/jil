'use client';

import { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

// 봉 간격 선택지
const INTERVALS = [
  { id: '1m', label: '1분봉', desc: '오늘 · 한국시간' },
  { id: '10m', label: '10분봉', desc: '최근 5거래일 · 한국시간' },
  { id: '1d', label: '일봉', desc: '최근 6개월' },
];

const KST_OFFSET = 9 * 3600; // 차트 라이브러리가 UTC로 표시하므로 한국시간으로 보정

export default function StockChartModal({ symbol, onClose }) {
  const [iv, setIv] = useState('1d');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastCandle, setLastCandle] = useState(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setLastCandle(null);

    fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${iv}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error || !d.candles?.length) {
          setError(d.error || '차트 데이터가 없어요.');
          return;
        }
        if (!containerRef.current) return;

        // 이전 차트 제거 후 새로 그림
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
        const intraday = iv !== '1d';
        const chart = createChart(containerRef.current, {
          autoSize: true,
          layout: {
            background: { type: 'solid', color: 'transparent' },
            textColor: '#8a95a5',
            fontSize: 11,
          },
          grid: {
            vertLines: { color: '#232d3d' },
            horzLines: { color: '#232d3d' },
          },
          timeScale: {
            borderColor: '#232d3d',
            timeVisible: intraday,
            secondsVisible: false,
          },
          rightPriceScale: { borderColor: '#232d3d' },
          crosshair: {
            horzLine: { labelBackgroundColor: '#4a8cff' },
            vertLine: { labelBackgroundColor: '#4a8cff' },
          },
        });
        const series = chart.addCandlestickSeries({
          upColor: '#2ec26e',
          downColor: '#f6465d',
          borderUpColor: '#2ec26e',
          borderDownColor: '#f6465d',
          wickUpColor: '#2ec26e',
          wickDownColor: '#f6465d',
        });
        const data = d.candles.map((c) =>
          intraday
            ? { ...c, time: c.time + KST_OFFSET } // 분봉은 한국시간으로 보정
            : { ...c, time: new Date(c.time * 1000).toISOString().slice(0, 10) } // 일봉은 날짜만
        );
        series.setData(data);
        chart.timeScale().fitContent();
        chartRef.current = chart;
        setLastCandle(d.candles[d.candles.length - 1]);
      })
      .catch(() => !cancelled && setError('차트 데이터를 불러오지 못했어요.'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [symbol, iv]);

  // 모달이 닫힐 때 차트 정리
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  const meta = INTERVALS.find((x) => x.id === iv);
  const up = lastCandle && lastCandle.close >= lastCandle.open;

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
        style={{ width: 'min(860px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="panel-title" style={{ marginBottom: 10 }}>
          📊 {symbol}
          {lastCandle && (
            <span className={up ? 'up' : 'down'} style={{ fontSize: 13, fontWeight: 700 }}>
              ${lastCandle.close.toFixed(2)}
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

        {loading && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>차트 불러오는 중...</p>}
        {!loading && error && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>{error}</p>}

        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: 420,
            display: loading || error ? 'none' : 'block',
          }}
        />
        {!loading && !error && iv === '1m' && (
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>
            ⓘ 미국 장이 열려 있는 동안의 1분봉이에요. 장 마감 후에는 마지막 거래일 기준으로 표시돼요.
          </p>
        )}
      </div>
    </div>
  );
}
