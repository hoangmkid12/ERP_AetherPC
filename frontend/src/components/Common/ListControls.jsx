import React from 'react';
import { RotateCcw } from 'lucide-react';
import { isDateInPeriod, parsePeriodDate } from './PeriodFilterBar';

// Bộ điều khiển danh sách dùng chung cho Kho / Mua Hàng / Bán Hàng: chọn kỳ
// thời gian, sắp xếp tăng/giảm và thanh lọc có nút "Xoá lọc" + đếm kết quả,
// để mọi tab có cùng kích thước ô lọc (cao 38px) và cùng cách xếp hàng.

export const FILTER_CONTROL_STYLE = {
  height: '38px',
  padding: '0 0.7rem',
  fontSize: '0.82rem',
  border: '1px solid #e3e8ef',
  borderRadius: '6px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  boxSizing: 'border-box',
  cursor: 'pointer',
  minWidth: 0
};

export const FILTER_SEARCH_STYLE = { ...FILTER_CONTROL_STYLE, cursor: 'text', flex: '2 1 240px', padding: '0 0.85rem' };

export const LIST_PERIOD_OPTIONS = [
  { key: 'ALL', label: 'Mọi thời gian' },
  { key: 'TODAY', label: 'Hôm nay' },
  { key: 'LAST_7_DAYS', label: '7 ngày qua' },
  { key: 'THIS_WEEK', label: 'Tuần này' },
  { key: 'LAST_30_DAYS', label: '30 ngày qua' },
  { key: 'THIS_MONTH', label: 'Tháng này' },
  { key: 'LAST_MONTH', label: 'Tháng trước' },
  { key: 'THIS_QUARTER', label: 'Quý này' },
  { key: 'THIS_YEAR', label: 'Năm nay' }
];

export function PeriodSelect({ value, onChange, style = {}, title = 'Lọc theo thời gian' }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} title={title} style={{ ...FILTER_CONTROL_STYLE, flex: '0 1 150px', ...style }}>
      {LIST_PERIOD_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}

// options: [{ key, label }]
export function SortSelect({ value, onChange, options, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      title={`Sắp xếp: ${options.find(o => o.key === value)?.label || ''}`}
      aria-label="Sắp xếp"
      style={{ ...FILTER_CONTROL_STYLE, flex: '0 1 190px', ...style }}
    >
      {options.map(o => <option key={o.key} value={o.key}>↕ {o.label}</option>)}
    </select>
  );
}

/**
 * Thanh lọc: các ô lọc xếp ngang, tự xuống dòng; bên phải là số kết quả và
 * nút xoá lọc (chỉ hiện khi đang lọc). Class admin-filter-toolbar đã có quy
 * tắc xếp dọc trên điện thoại (index.css).
 */
export function FilterToolbar({ children, shown, total, onReset, dirty = false, style = {} }) {
  return (
    <div
      className="admin-filter-toolbar"
      style={{
        backgroundColor: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e3e8ef',
        marginBottom: '1.25rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', ...style
      }}
    >
      {children}
      {(typeof shown === 'number' || dirty) && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {typeof shown === 'number' && (
            <span style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
              {typeof total === 'number' && total !== shown ? `${shown}/${total}` : shown} kết quả
            </span>
          )}
          {dirty && onReset && (
            <button
              type="button"
              onClick={onReset}
              style={{ ...FILTER_CONTROL_STYLE, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#475569', fontWeight: 700, padding: '0 0.7rem' }}
            >
              <RotateCcw size={13} /> Xoá lọc
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sắp xếp ───────────────────────────────────────────────────────────
const toTime = v => parsePeriodDate(v)?.getTime() ?? 0;
const toNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

export const byDateDesc = get => (a, b) => toTime(get(b)) - toTime(get(a));
export const byDateAsc = get => (a, b) => toTime(get(a)) - toTime(get(b));
export const byNumDesc = get => (a, b) => toNum(get(b)) - toNum(get(a));
export const byNumAsc = get => (a, b) => toNum(get(a)) - toNum(get(b));
export const byText = get => (a, b) => String(get(a) || '').localeCompare(String(get(b) || ''), 'vi', { numeric: true, sensitivity: 'base' });

/** Trả bản sao đã sắp xếp; sortKey không có trong sorters (vd 'DEFAULT') giữ nguyên thứ tự gốc */
export function sortItems(list, sortKey, sorters) {
  const cmp = sorters?.[sortKey];
  return cmp ? [...list].sort(cmp) : list;
}

export const inPeriod = (value, period) => isDateInPeriod(value, period);
