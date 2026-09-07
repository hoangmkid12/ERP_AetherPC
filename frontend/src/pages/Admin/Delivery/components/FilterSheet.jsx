import React from 'react';
import { X } from 'lucide-react';

// Generic bottom-sheet shell (adapted from the .mobile-filters-drawer
// pattern in index.css, slide-up instead of slide-in-from-right) reused by
// ActiveTab / ReturnsTab / HistoryTab to host their own filter form fields.
export default function FilterSheet({ isOpen, onClose, title = 'Bộ Lọc', onReset, children }) {
  if (!isOpen) return null;

  return (
    <div className="delivery-filter-sheet-overlay" onClick={onClose}>
      <div className="delivery-filter-sheet" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{title}</strong>
          <button type="button" onClick={onClose} className="delivery-icon-btn"><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {children}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '0.6rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Xóa Lọc
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.6rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
          >
            Áp Dụng
          </button>
        </div>
      </div>
    </div>
  );
}
