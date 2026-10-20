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
      justifyContent: 'flex-start',
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

    </div>
  );
}
