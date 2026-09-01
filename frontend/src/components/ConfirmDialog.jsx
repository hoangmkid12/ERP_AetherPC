import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// Shared modal chrome for both the yes/no confirm() dialog and the
// text-input prompt() dialog — same overlay/card/button styling either way.
export default function ConfirmDialog({
  open,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  danger = false,
  showInput = false,
  inputDefaultValue = '',
  inputPlaceholder = '',
  onConfirm,
  onCancel
}) {
  const [inputValue, setInputValue] = useState(inputDefaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setInputValue(inputDefaultValue);
      if (showInput) setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, inputDefaultValue, showInput]);

  if (!open) return null;

  const handleConfirmClick = () => {
    if (showInput) onConfirm(inputValue);
    else onConfirm();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          padding: '1.5rem',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', marginBottom: showInput ? '1rem' : '1.5rem' }}>
          <div
            style={{
              flexShrink: 0,
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: danger ? '#fef2f2' : '#eff6ff',
              color: danger ? '#ef4444' : '#2563eb'
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.95rem', color: '#1e293b', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
            {message}
          </p>
        </div>

        {showInput && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputPlaceholder}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmClick(); }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.9rem',
              marginBottom: '1.5rem',
              fontFamily: 'inherit'
            }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            style={{
              padding: '0.55rem 1.2rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: danger ? '#ef4444' : '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
