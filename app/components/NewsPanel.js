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
  const [selected, setSelected] = useState(null); // 팝업으로 보는 중인 기사
  const [scrapped, setScrapped] = useState({}); // url → true (중복 스크랩 방지)
  const [article, setArticle] = useState(null); // 스크랩한 본문 { text, error }

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

  // 기사 클릭 → 자동 스크랩 + 팝업 열기 (본문은 서버에서 텍스트만 긁어옴)
  const open = (n) => {
    setSelected(n);
    setArticle(null);
    if (n.url) {
      fetch(`/api/article?url=${encodeURIComponent(n.url)}`)
        .then((r) => r.json())
        .then(setArticle)
        .catch(() => setArticle({ text: '', error: '본문을 가져오지 못했어요.' }));
    }
    if (n.url && !scrapped[n.url]) {
      setScrapped((s) => ({ ...s, [n.url]: true }));
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'news',
          payload: { headline: n.headline, url: n.url, source: n.source, symbol: n.symbol },
        }),
      }).catch(() => {});
    }
  };

  return (
    <>
      <div className="panel scroll" style={{ maxHeight: 620 }}>
        <div className="panel-title">
          📰 실시간 뉴스
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>
            누르면 스크랩 + 팝업 · 5분마다 갱신
          </span>
        </div>

        {loading && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>불러오는 중...</p>}

        {news.map((n, i) => (
          <div
            key={i}
            onClick={() => open(n)}
            style={{
              padding: '10px 0',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: 'var(--text)',
                lineHeight: 1.45,
                marginBottom: 6,
              }}
            >
              {n.headline}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{n.source}</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {n.datetime ? timeAgo(n.datetime) : ''}
              </span>
              {scrapped[n.url] && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>
                  🔖 스크랩됨
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── 기사 팝업 ── */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel"
            style={{
              width: 900,
              maxWidth: '100%',
              height: '86vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 20,
            }}
          >
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 16, lineHeight: 1.4, marginBottom: 4 }}>
                  {selected.headline}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  {selected.source}
                  {selected.datetime ? ` · ${timeAgo(selected.datetime)}` : ''}
                  <span style={{ color: 'var(--accent)', marginLeft: 8 }}>🔖 스크랩됨</span>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: 22,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* 요약 */}
            {selected.summary && (
              <div
                style={{
                  background: 'var(--panel-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: 'var(--text-dim)',
                  marginBottom: 10,
                  maxHeight: 120,
                  overflowY: 'auto',
                }}
              >
                {selected.summary}
              </div>
            )}

            {/* 스크랩한 본문 텍스트 */}
            <div
              className="scroll"
              style={{
                flex: 1,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--panel-2)',
                padding: '14px 18px',
                overflowY: 'auto',
              }}
            >
              {!article && (
                <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>본문 가져오는 중...</p>
              )}
              {article && article.text && (
                <div style={{ fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                  {article.text}
                </div>
              )}
              {article && !article.text && (
                <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
                  {article.error || '본문을 가져오지 못했어요.'}
                </p>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 10,
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-faint)', flex: 1 }}>
                ⓘ 원문에서 텍스트만 가져온 거라 사진·표는 빠져 있어요.
              </span>
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '9px 16px',
                  background: 'var(--accent)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                원문 새 탭에서 열기 ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
