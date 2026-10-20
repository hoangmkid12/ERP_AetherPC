import React from 'react';
import { Calendar, X } from 'lucide-react';

/**
 * Helper chuẩn hóa và kiểm tra ngày tháng theo bộ lọc kỳ thời gian (Period).
 * Hỗ trợ các định dạng: ISO string, YYYY-MM-DD, DD/MM/YYYY, Timestamp number, Date object.
 */
export const parsePeriodDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // Khớp DD/MM/YYYY ở bất kỳ vị trí nào — đơn hàng lưu "HH:mm DD/MM/YYYY"; neo ^ trước đây làm
    // đơn tạo trong ngày không khớp và bị loại khỏi mọi thống kê theo kỳ.
    const vn = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (vn) {
      const d = new Date(Number(vn[3]), Number(vn[2]) - 1, Number(vn[1]));
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

// Giá trị kỳ lọc: 'ALL' (không lọc) hoặc 'RANGE:<từ ngày>:<đến ngày>' theo YYYY-MM-DD,
// một đầu có thể bỏ trống (chỉ "từ ngày" hoặc chỉ "đến ngày").
export const toRangeValue = (from, to) => (from || to ? `RANGE:${from || ''}:${to || ''}` : 'ALL');
export const parseRangeValue = (value) => {
  if (typeof value !== 'string' || !value.startsWith('RANGE:')) return { from: '', to: '' };
  const [, from = '', to = ''] = value.split(':');
  return { from, to };
};

const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const isDateInPeriod = (dateVal, period) => {
  if (!period || period === 'ALL') return true;
  const d = parsePeriodDate(dateVal);
  if (!d) return false;
  if (period.startsWith('RANGE:')) {
    const { from, to } = parseRangeValue(period);
    const ymd = toYmd(d);
    if (from && ymd < from) return false;
    if (to && ymd > to) return false;
    return true;
  }
  // Mã kỳ cũ (giữ tương thích nếu nơi khác còn truyền): chỉ còn "hôm nay"
  if (period === 'TODAY') return toYmd(d) === toYmd(new Date());
  return true;
};

const dateInputStyle = (active) => ({
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: '0.8rem',
  color: active ? '#0f172a' : '#64748b',
  fontWeight: active ? 700 : 500,
  width: '118px',
  minWidth: 0,
  padding: 0,
  fontFamily: 'inherit',
  cursor: 'pointer'
});

/**
 * Ô chọn khoảng ngày gọn một dòng: [lịch] Từ ngày – Đến ngày [x].
 * Dùng chung cho thanh tổng quan và thanh lọc danh sách của mọi phân hệ.
 */
export function DateRangeInput({ from = '', to = '', onChange, height = '38px', title = 'Lọc theo khoảng ngày', style = {} }) {
  const active = Boolean(from || to);
  return (
    <div
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height, boxSizing: 'border-box',
        padding: '0 0.6rem', borderRadius: '6px', backgroundColor: active ? '#eff6ff' : '#ffffff',
        border: `1px solid ${active ? '#93c5fd' : '#e3e8ef'}`, flex: '0 1 auto', maxWidth: '100%', ...style
      }}
    >
      <Calendar size={14} style={{ color: '#2563eb', flexShrink: 0 }} />
      <input type="date" aria-label="Từ ngày" value={from} max={to || undefined} onChange={e => onChange(e.target.value, to)} style={dateInputStyle(Boolean(from))} />
      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>–</span>
      <input type="date" aria-label="Đến ngày" value={to} min={from || undefined} onChange={e => onChange(from, e.target.value)} style={dateInputStyle(Boolean(to))} />
      {active && (
        <button
          type="button"
          onClick={() => onChange('', '')}
          title="Bỏ lọc ngày"
          aria-label="Bỏ lọc ngày"
          style={{ border: 'none', background: 'none', padding: 0, display: 'inline-flex', color: '#64748b', cursor: 'pointer' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * Bộ lọc kỳ của các trang tổng quan. Giữ tên prop cũ (period/selectedPeriod,
 * onChange/onSelectPeriod) để các phân hệ không phải sửa.
 */
export default function PeriodFilterBar({ period, selectedPeriod, onChange, onSelectPeriod, style = {} }) {
  const value = selectedPeriod || period || 'ALL';
  const { from, to } = parseRangeValue(value);
  const emit = (f, t) => {
    const next = toRangeValue(f, t);
    if (typeof onSelectPeriod === 'function') onSelectPeriod(next);
    if (typeof onChange === 'function') onChange(next);
  };
  return <DateRangeInput from={from} to={to} onChange={emit} title="Kỳ thống kê" style={style} />;
}
