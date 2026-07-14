'use client';

import { useState, useEffect } from 'react';

function timeAgo(ts) {
  const diff = Date.now() / 1000 - ts;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function NewsPanel() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch('/api/news')
      .then((r) => r.json())
      .then((d) => {
        setNews(d.news || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 300000); // 5분마다 자동 갱신
    return () => clearInterval(t);
  }, []);

  const scrap = async (n) => {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'news',
        payload: { headline: n.headline, url: n.url, source: n.source, symbol: n.symbol },
      }),
    });
    alert('스크랩했어!');
  };

  return (
    <div className="panel scroll" style={{ maxHeight: 620 }}>
      <div className="panel-title">
        📰 실시간 뉴스
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>
          5분마다 갱신
        </span>
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>불러오는 중...</p>}

      {news.map((n, i) => (
        <div
          key={i}
          style={{
            padding: '10px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <a
            href={n.url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 13,
              color: 'var(--text)',
              textDecoration: 'none',
              lineHeight: 1.45,
              display: 'block',
              marginBottom: 6,
            }}
          >
            {n.headline}
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{n.source}</span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {n.datetime ? timeAgo(n.datetime) : ''}
            </span>
            <button
              onClick={() => scrap(n)}
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
              }}
            >
              🔖 스크랩
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
