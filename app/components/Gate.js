'use client';

import { useState } from 'react';

export default function Gate({ onUnlock }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setErr(false);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const { ok } = await res.json();
    setLoading(false);
    if (ok) onUnlock();
    else setErr(true);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div className="panel" style={{ width: 340, textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>📈</div>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>정베의 투자 브리핑</h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
          너의 투자 분신이 기다리고 있어
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="비밀번호"
          style={{
            width: '100%',
            padding: '12px 14px',
            background: 'var(--panel-2)',
            border: `1px solid ${err ? 'var(--down)' : 'var(--border)'}`,
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 15,
            outline: 'none',
            marginBottom: 12,
          }}
        />
        {err && (
          <p style={{ color: 'var(--down)', fontSize: 12, marginBottom: 12 }}>
            비밀번호가 틀렸어
          </p>
        )}
        <button
          onClick={submit}
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '확인 중...' : '들어가기'}
        </button>
      </div>
    </div>
  );
}
