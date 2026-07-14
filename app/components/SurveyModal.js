'use client';

import { useState, useEffect } from 'react';
import { SURVEY } from '../../lib/survey';

export default function SurveyModal({ onClose, onSaved }) {
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);

  // 기존 답변 불러오기
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => d.answers && setAnswers(d.answers));
  }, []);

  const pick = (id, val) => setAnswers((a) => ({ ...a, [id]: val }));

  const save = async () => {
    setSaving(true);
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel scroll"
        style={{ width: 560, maxWidth: '100%', maxHeight: '88vh', padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18 }}>🧠 정일님 투자 성향</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20 }}
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>
          답하실수록 AI가 더 정일님 스타일로 분석해 드려요. 언제든 다시 고치실 수 있어요.
        </p>

        {SURVEY.map((sec) => (
          <div key={sec.section} style={{ marginBottom: 22 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--accent)',
                marginBottom: 12,
              }}
            >
              {sec.section}
            </div>

            {sec.questions.map((qq) => (
              <div key={qq.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, marginBottom: 8 }}>{qq.q}</div>

                {qq.type === 'text' ? (
                  <textarea
                    value={answers[qq.id] || ''}
                    onChange={(e) => pick(qq.id, e.target.value)}
                    rows={2}
                    style={{
                      width: '100%',
                      padding: 10,
                      background: 'var(--panel-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text)',
                      fontSize: 13,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {qq.options.map((opt) => {
                      const active = answers[qq.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => pick(qq.id, opt)}
                          style={{
                            padding: '8px 12px',
                            background: active ? 'var(--accent)' : 'var(--panel-2)',
                            border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 8,
                            color: active ? '#fff' : 'var(--text)',
                            fontSize: 13,
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <button
          onClick={save}
          disabled={saving}
          style={{
            width: '100%',
            padding: 13,
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'AI가 스타일 정리 중...' : '저장하고 분신 업데이트'}
        </button>
      </div>
    </div>
  );
}
