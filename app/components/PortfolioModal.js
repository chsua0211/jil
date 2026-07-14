'use client';

import { useState, useEffect } from 'react';

const fmt2 = (n) =>
  '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PortfolioModal({ onClose, onSaved }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);

  // 새 종목 입력
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [adding, setAdding] = useState(false);

  // 수정 중인 행: { id, shares, avgCost }
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () => {
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((d) => {
        setHoldings(d.holdings || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!symbol.trim() || !shares || !avgCost || adding) return;
    setAdding(true);
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, shares, avgCost }),
    });
    const d = await res.json();
    setAdding(false);
    if (!d.ok) {
      alert(d.error || '추가에 실패했어요.');
      return;
    }
    setSymbol('');
    setShares('');
    setAvgCost('');
    load();
  };

  const startEdit = (h) => {
    setEditing({ id: h.id, shares: String(h.shares), avgCost: String(h.avgCost) });
  };

  const saveEdit = async () => {
    if (!editing || savingEdit) return;
    if (!editing.shares || !editing.avgCost) {
      alert('수량과 평단가를 입력해 주세요.');
      return;
    }
    setSavingEdit(true);
    const res = await fetch('/api/portfolio', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id, shares: editing.shares, avgCost: editing.avgCost }),
    });
    const d = await res.json();
    setSavingEdit(false);
    if (!d.ok) {
      alert(d.error || '수정에 실패했어요.');
      return;
    }
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm('이 종목을 포트폴리오에서 삭제할까요?')) return;
    await fetch('/api/portfolio', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const close = () => {
    onSaved && onSaved(); // 대시보드 현황 갱신
    onClose();
  };

  return (
    <div
      onClick={close}
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
        style={{ width: 620, maxWidth: '100%', maxHeight: '88vh', padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18 }}>💼 포트폴리오 관리</h2>
          <button
            onClick={close}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20 }}
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>
          보유 종목을 입력하시면 실시간 자산 현황이 계산되고, AI가 포트폴리오 기반으로
          조언해 드려요.
        </p>

        {/* 새 종목 추가 */}
        <div
          style={{
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
            종목 추가
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="티커 (NVDA)"
              style={inputStyle(110)}
            />
            <input
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="수량"
              type="number"
              min="0"
              step="any"
              style={inputStyle(90)}
            />
            <input
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="평단가 ($)"
              type="number"
              min="0"
              step="any"
              style={inputStyle(110)}
            />
            <button onClick={add} disabled={adding} style={btnStyle(adding)}>
              {adding ? '추가 중...' : '추가'}
            </button>
          </div>
        </div>

        {/* 보유 종목 목록 (수정/삭제) */}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
          보유 종목
        </div>

        {loading && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>불러오는 중...</p>}

        {!loading && holdings.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
            아직 등록된 종목이 없어요. 위에서 추가해 보세요.
          </p>
        )}

        {holdings.map((h) => {
          const isEditing = editing?.id === h.id;
          return (
            <div
              key={h.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 60, fontWeight: 600, fontSize: 14 }}>{h.symbol}</div>

              {isEditing ? (
                <>
                  <input
                    value={editing.shares}
                    onChange={(e) => setEditing({ ...editing, shares: e.target.value })}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="수량"
                    style={inputStyle(80)}
                  />
                  <input
                    value={editing.avgCost}
                    onChange={(e) => setEditing({ ...editing, avgCost: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="평단가"
                    style={inputStyle(100)}
                  />
                  <button onClick={saveEdit} disabled={savingEdit} style={btnStyle(savingEdit)}>
                    {savingEdit ? '저장 중' : '저장'}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    style={{
                      padding: '9px 12px',
                      background: 'var(--panel-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-dim)',
                      fontSize: 13,
                    }}
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                    {h.shares}주 · 평단 {fmt2(h.avgCost)}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => startEdit(h)}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--panel-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--text)',
                        fontSize: 12,
                      }}
                    >
                      ✏️ 수정
                    </button>
                    <button
                      onClick={() => remove(h.id)}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--panel-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--down)',
                        fontSize: 12,
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        <button
          onClick={close}
          style={{
            width: '100%',
            marginTop: 20,
            padding: 13,
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          완료
        </button>
      </div>
    </div>
  );
}

const inputStyle = (w) => ({
  width: w,
  flex: '1 1 auto',
  padding: '9px 10px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
});

const btnStyle = (busy) => ({
  padding: '9px 16px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  opacity: busy ? 0.6 : 1,
});
