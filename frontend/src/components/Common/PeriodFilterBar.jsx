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
    // Khớp DD/MM/YYYY hoặc DD/MM/YYYY HH:mm
    const vn = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (vn) {
      const d = new Date(Number(vn[3]), Number(vn[2]) - 1, Number(vn[1]));
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

export const isDateInPeriod = (dateVal, period) => {
  if (!period || period === 'ALL') return true;
  const d = parsePeriodDate(dateVal);
  if (!d) return false;

  const now = new Date();

  // So sánh theo ngày (bỏ qua giờ phút giây)
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'TODAY') {
    return itemDate.getTime() === today.getTime();
  }

  if (period === 'THIS_WEEK') {
    const day = today.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day; // Thứ 2 là đầu tuần
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return itemDate >= monday && itemDate <= sunday;
  }

  if (period === 'THIS_MONTH') {
    return itemDate.getFullYear() === today.getFullYear() && itemDate.getMonth() === today.getMonth();
  }

  if (period === 'THIS_QUARTER') {
    const currentQuarter = Math.floor(today.getMonth() / 3);
    const itemQuarter = Math.floor(itemDate.getMonth() / 3);
    return itemDate.getFullYear() === today.getFullYear() && itemQuarter === currentQuarter;
  }

  if (period === 'THIS_YEAR') {
    return itemDate.getFullYear() === today.getFullYear();
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
 * Hỗ trợ linh hoạt cả các prop: selectedPeriod/period và onSelectPeriod/onChange
 */
export default function PeriodFilterBar({
  period,
  selectedPeriod,
  onChange,
  onSelectPeriod,
  style = {}
}) {
  const activeKey = selectedPeriod || period || 'ALL';

  const handleClick = (key) => {
    if (typeof onSelectPeriod === 'function') {
      onSelectPeriod(key);
    }
    if (typeof onChange === 'function') {
      onChange(key);
    }
  };

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
        const active = activeKey === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => handleClick(p.key)}
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
