import React from 'react';
import { Calendar, RotateCcw } from 'lucide-react';

/**
 * Helper kiểm tra một giá trị ngày có nằm trong khoảng [startDate, endDate] hay không.
 * Hỗ trợ các định dạng: ISO string, YYYY-MM-DD, DD/MM/YYYY, Timestamp, Date object.
 */
export function isDateInRange(dateValue, startDate, endDate) {
  if (!startDate && !endDate) return true;
  if (!dateValue) return false;

  let d = null;
  if (dateValue instanceof Date) {
    d = dateValue;
  } else if (typeof dateValue === 'number') {
    d = new Date(dateValue);
  } else if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    // Khớp định dạng DD/MM/YYYY hoặc DD-MM-YYYY (vd: 15/06/2026)
    const vn = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (vn) {
      // Cả dạng "HH:mm DD/MM/YYYY" của đơn hàng: lấy đúng phần ngày, không lấy nhầm giờ
      d = new Date(Number(vn[3]), Number(vn[2]) - 1, Number(vn[1]));
    } else {
      d = new Date(trimmed);
    }
  }

  if (!d || isNaN(d.getTime())) return true;

  // Lấy chuỗi YYYY-MM-DD cục bộ theo giờ VN
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  const dStr = `${y}-${m}-${dayStr}`;

  if (startDate && dStr < startDate) return false;
  if (endDate && dStr > endDate) return false;
  return true;
}

/**
 * Component bộ lọc khoảng thời gian chuẩn dùng cho mọi Báo Cáo trong ERP.
 */
export default function DateRangeFilter({
  startDate = '',
  endDate = '',
  onChange,
  onReset,
  label = 'Khoảng thời gian báo cáo',
  compact = false,
  style = {}
}) {
  const applyPreset = (presetKey) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    const fmt = (year, monthIdx, dayNum) => {
      const sY = year;
      const sM = String(monthIdx + 1).padStart(2, '0');
      const sD = String(dayNum).padStart(2, '0');
      return `${sY}-${sM}-${sD}`;
    };

    let start = '';
    let end = '';

    switch (presetKey) {
      case 'TODAY':
        start = fmt(y, m, d);
        end = fmt(y, m, d);
        break;
      case 'THIS_WEEK': {
        // Tuần làm việc theo lịch Việt Nam: Thứ Hai → Chủ Nhật của tuần hiện tại
        const offset = (now.getDay() + 6) % 7;
        const monday = new Date(y, m, d - offset);
        const sunday = new Date(y, m, d - offset + 6);
        start = fmt(monday.getFullYear(), monday.getMonth(), monday.getDate());
        end = fmt(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());
        break;
      }
      case 'THIS_MONTH': {
        start = fmt(y, m, 1);
        const lastDay = new Date(y, m + 1, 0).getDate();
        end = fmt(y, m, lastDay);
        break;
      }
      case 'THIS_QUARTER': {
        const qStartMonth = Math.floor(m / 3) * 3;
        start = fmt(y, qStartMonth, 1);
        const qEndMonth = qStartMonth + 2;
        const lastDayQ = new Date(y, qEndMonth + 1, 0).getDate();
        end = fmt(y, qEndMonth, lastDayQ);
        break;
      }
      case 'THIS_YEAR': {
        start = `${y}-01-01`;
        end = `${y}-12-31`;
        break;
      }
      case 'ALL':
      default:
        start = '';
        end = '';
        break;
    }

    if (typeof onChange === 'function') {
      onChange({ startDate: start, endDate: end, preset: presetKey });
    }
  };

  const handleStartChange = (val) => {
    if (typeof onChange === 'function') {
      onChange({ startDate: val, endDate, preset: 'CUSTOM' });
    }
  };

  const handleEndChange = (val) => {
    if (typeof onChange === 'function') {
      onChange({ startDate, endDate: val, preset: 'CUSTOM' });
    }
  };

  const handleClear = () => {
    if (typeof onReset === 'function') {
      onReset();
    } else if (typeof onChange === 'function') {
      onChange({ startDate: '', endDate: '', preset: 'ALL' });
    }
  };

  const isFiltered = Boolean(startDate || endDate);

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e3e8ef',
      padding: compact ? '0.65rem 0.85rem' : '0.85rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.75rem',
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      ...style
    }}>
      {/* Tiêu đề & Cụm chọn ngày */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1e293b', fontWeight: 700, fontSize: '0.82rem' }}>
          <Calendar size={16} style={{ color: '#2563eb' }} />
          <span>{label}:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartChange(e.target.value)}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #e3e8ef',
              fontSize: '0.82rem',
              color: '#0f172a',
              outline: 'none',
              backgroundColor: startDate ? '#eff6ff' : '#ffffff'
            }}
          />
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>đến</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => handleEndChange(e.target.value)}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #e3e8ef',
              fontSize: '0.82rem',
              color: '#0f172a',
              outline: 'none',
              backgroundColor: endDate ? '#eff6ff' : '#ffffff'
            }}
          />
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={handleClear}
            title="Xóa bộ lọc ngày"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.4rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid #fecaca',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={12} />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      {/* Cụm phím chọn nhanh thời gian (Presets) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
        {[
          { key: 'TODAY', label: 'Hôm nay' },
          { key: 'THIS_WEEK', label: 'Tuần này' },
          { key: 'THIS_MONTH', label: 'Tháng này' },
          { key: 'THIS_QUARTER', label: 'Quý này' },
          { key: 'THIS_YEAR', label: 'Năm nay' },
          { key: 'ALL', label: 'Tất cả' }
        ].map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '5px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              color: '#475569',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#eff6ff';
              e.currentTarget.style.color = '#2563eb';
              e.currentTarget.style.borderColor = '#bfdbfe';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.color = '#475569';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
