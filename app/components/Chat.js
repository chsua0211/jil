'use client';

import { useState, useRef, useEffect } from 'react';

export default function Chat({ externalPrompt, onExternalConsumed }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '안녕하세요 정일님! 궁금한 종목이나 시장 얘기 물어봐 주세요. 최신 정보를 찾아서 정일님 스타일대로 분석해 드릴게요.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // 외부(리스크 분석 버튼 등)에서 질문이 들어오면 자동 전송
  useEffect(() => {
    if (externalPrompt && !loading) {
      sendText(externalPrompt);
      onExternalConsumed && onExternalConsumed();
    }
    // eslint-disable-next-line
  }, [externalPrompt]);

  const sendText = async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || loading) return;

    const newMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages
            .filter((m) => m.role !== 'assistant' || m.content !== messages[0].content)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const { reply, error } = await res.json();
      setMessages([
        ...newMessages,
        { role: 'assistant', content: reply || `문제가 생겼어요: ${error || '알 수 없음'}` },
      ]);
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: '연결에 문제가 생겼어요. 다시 시도해 주세요.' }]);
    }
    setLoading(false);
  };

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: 620 }}>
      <div className="panel-title">🤖 AI 투자 분신</div>

      <div className="scroll" style={{ flex: 1, paddingRight: 4 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                maxWidth: '88%',
                padding: '9px 12px',
                borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: m.role === 'user' ? 'var(--accent)' : 'var(--panel-2)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '4px 2px' }}>
            분석 중이에요... (최신 정보 찾는 중일 수 있어요)
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          marginTop: 10,
          borderTop: '1px solid var(--border)',
          paddingTop: 10,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendText(input)}
          placeholder="예: 엔비디아 지금 어떤가요?"
          style={{
            flex: 1,
            padding: '10px 12px',
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={() => sendText(input)}
          disabled={loading}
          style={{
            padding: '10px 14px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            opacity: loading ? 0.6 : 1,
          }}
        >
          전송
        </button>
      </div>
    </div>
  );
}
