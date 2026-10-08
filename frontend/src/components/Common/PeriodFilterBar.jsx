import React from 'react';
import { Calendar } from 'lucide-react';

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
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

export const isDateInPeriod = (dateVal, period) => {
  if (!period || period === 'ALL') return true;
  const d = parsePeriodDate(dateVal);
  if (!d) return true;

  const now = new Date();

  const toYMD = (dateObj) => {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const itemYMD = toYMD(d);
  const todayYMD = toYMD(now);

  if (period === 'TODAY') {
    return itemYMD === todayYMD;
  }

  if (period === 'THIS_WEEK') {
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return d >= monday && d <= sunday;
  }

  if (period === 'THIS_MONTH') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  if (period === 'THIS_QUARTER') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const itemQuarter = Math.floor(d.getMonth() / 3);
    return itemQuarter === currentQuarter && d.getFullYear() === now.getFullYear();
  }

  if (period === 'THIS_YEAR') {
    return d.getFullYear() === now.getFullYear();
  }

  return true;
};

export const PERIOD_OPTIONS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'TODAY', label: 'Hôm nay' },
  { key: 'THIS_WEEK', label: 'Tuần này' },
  { key: 'THIS_MONTH', label: 'Tháng này' },
  { key: 'THIS_QUARTER', label: 'Quý này' },
  { key: 'THIS_YEAR', label: 'Năm nay' }
];

/**
 * Thanh nút bấm lọc kỳ thời gian chuẩn Odoo / ERP AetherPC
 */
export default function PeriodFilterBar({
  period = 'ALL',
  onChange,
  style = {}
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        flexWrap: 'wrap',
        backgroundColor: '#ffffff',
        padding: '0.3rem 0.55rem',
        borderRadius: '8px',
        border: '1px solid #e3e8ef',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        ...style
      }}
    >
      <Calendar size={15} style={{ color: '#2563eb', marginRight: '0.15rem' }} />
      {PERIOD_OPTIONS.map(p => {
        const active = period === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange && onChange(p.key)}
            style={{
              padding: '0.28rem 0.6rem',
              fontSize: '0.78rem',
              fontWeight: active ? 800 : 600,
              borderRadius: '5px',
              border: 'none',
              backgroundColor: active ? '#2563eb' : 'transparent',
              color: active ? '#ffffff' : '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              lineHeight: 1.2
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.backgroundColor = '#f1f5f9';
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
