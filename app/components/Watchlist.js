'use client';

import { useState, useEffect } from 'react';

export default function Watchlist({ onChange }) {
  const [items, setItems] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [input, setInput] = useState('');

  const loadList = async () => {
    const res = await fetch('/api/data');
    const { watchlist } = await res.json();
    setItems(watchlist);
    if (watchlist.length) loadQuotes(watchlist.map((w) => w.symbol));
  };

  const loadQuotes = async (symbols) => {
    const res = await fetch(`/api/quote?symbols=${symbols.join(',')}`);
    const { quotes } = await res.json();
    const map = {};
    quotes.forEach((q) => (map[q.symbol] = q));
    setQuotes(map);
  };

  useEffect(() => {
    loadList();
    const t = setInterval(() => {
      if (items.length) loadQuotes(items.map((w) => w.symbol));
    }, 60000); // 1분마다 주가 갱신
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [items.length]);

  const add = async () => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'watch', payload: { symbol: sym } }),
    });
    setInput('');
    loadList();
    onChange && onChange();
  };

  const remove = async (id) => {
    await fetch('/api/data', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'watch', id }),
    });
    loadList();
  };

  return (
    <div className="panel">
      <div className="panel-title">⭐ 관심 종목</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="티커 (예: NVDA)"
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={add}
          style={{
            padding: '8px 12px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          추가
        </button>
      </div>

      {items.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          관심 종목을 추가해 보세요
        </p>
      )}

      {items.map((it) => {
        const q = quotes[it.symbol];
        const up = q && q.changePercent >= 0;
        return (
          <div
            key={it.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{it.symbol}</div>
              <button
                onClick={() => remove(it.id)}
                style={{
                  fontSize: 10,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-faint)',
                  padding: 0,
                }}
              >
                삭제
              </button>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {q ? `$${q.price?.toFixed(2)}` : '—'}
              </div>
              <div className={up ? 'up' : 'down'} style={{ fontSize: 12 }}>
                {q ? `${up ? '+' : ''}${q.changePercent?.toFixed(2)}%` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
