import React from 'react';
import { Calendar, X } from 'lucide-react';

const selectStyle = {
  width: '100%',
  padding: '0.55rem 0.65rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-glass)',
  fontSize: '0.8rem',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontWeight: 600,
  boxSizing: 'border-box'
};

const labelStyle = {
  display: 'block',
  fontSize: '0.77rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  marginBottom: '0.25rem'
};

const toIsoDateString = (d) => {
  if (!d) return '';
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getEffectiveDateRange = (df, now) => {
  if (!df) return { start: '', end: '' };
  const todayStr = toIsoDateString(now);

  if (df.period === 'TODAY') {
    return {
      start: df.customStartDate || todayStr,
      end: df.customEndDate || todayStr
    };
  }
  if (df.period === 'YESTERDAY') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = toIsoDateString(y);
    return {
      start: df.customStartDate || yStr,
      end: df.customEndDate || yStr
    };
  }
  if (df.period === 'THIS_WEEK') {
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + diffToMonday);
    return {
      start: df.customStartDate || toIsoDateString(monday),
      end: df.customEndDate || todayStr
    };
  }
  if (df.period === 'THIS_MONTH') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: df.customStartDate || toIsoDateString(startOfMonth),
      end: df.customEndDate || toIsoDateString(endOfMonth)
    };
  }
  if (df.period === 'SPECIFIC_DATE') {
    return {
      start: df.selectedDate || '',
      end: df.selectedDate || ''
    };
  }
  if (df.period === 'CUSTOM') {
    return {
      start: df.customStartDate || '',
      end: df.customEndDate || ''
    };
  }
  if (df.period === 'ALL') {
    return { start: '', end: '' };
  }
  return {
    start: df.customStartDate || '',
    end: df.customEndDate || ''
  };
};

export default function DateFilterControl({
  dateFilter,
  onChange,
  variant = 'sheet', // 'sheet' | 'inline'
  onQuickSelect
}) {

  const now = new Date();
  const todayStr = toIsoDateString(now);

  const currentRange = getEffectiveDateRange(dateFilter, now);

  const handleStartDateChange = (val) => {
    const nextStart = val;
    const nextEnd = currentRange.end;
    const isBothEmpty = !nextStart && !nextEnd;
    onChange({
      ...dateFilter,
      period: isBothEmpty ? 'ALL' : 'CUSTOM',
      customStartDate: nextStart,
      customEndDate: nextEnd
    });
  };

  const handleEndDateChange = (val) => {
    const nextStart = currentRange.start;
    const nextEnd = val;
    const isBothEmpty = !nextStart && !nextEnd;
    onChange({
      ...dateFilter,
      period: isBothEmpty ? 'ALL' : 'CUSTOM',
      customStartDate: nextStart,
      customEndDate: nextEnd
    });
  };

  const handleClearDate = () => {
    onChange({
      ...dateFilter,
      period: 'ALL',
      customStartDate: '',
      customEndDate: '',
      selectedDate: '',
      selectedMonth: '',
      selectedYear: ''
    });
    if (onQuickSelect) onQuickSelect('ALL');
  };

  // --- Inline Bar (Used on Top of OverviewTab or Tabs) ---
  if (variant === 'inline') {
    const active = Boolean(currentRange.start || currentRange.end);
    const inputStyle = { ...selectStyle, width: 'auto', flex: '1 1 0', minWidth: 0, padding: '0.4rem 0.5rem', cursor: 'pointer' };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
        <Calendar size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <input type="date" aria-label="Từ ngày" value={currentRange.start} max={currentRange.end || undefined} onChange={e => handleStartDateChange(e.target.value)} style={inputStyle} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>–</span>
        <input type="date" aria-label="Đến ngày" value={currentRange.end} min={currentRange.start || undefined} onChange={e => handleEndDateChange(e.target.value)} style={inputStyle} />
        {active && (
          <button type="button" onClick={handleClearDate} title="Bỏ lọc ngày" aria-label="Bỏ lọc ngày"
            style={{ background: 'none', border: 'none', padding: '0.2rem', display: 'inline-flex', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        )}
      </div>
    );
  }

  // --- Form Sheet (Used inside FilterSheet for ActiveTab, HistoryTab, ReturnsTab) ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Calendar size={13} style={{ color: 'var(--primary)' }} />
          Khoảng thời gian
        </label>
        {(currentRange.start || currentRange.end || dateFilter?.period !== 'ALL') && (
          <button
            type="button"
            onClick={handleClearDate}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.77rem',
              color: 'var(--primary)',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '0 0.2rem'
            }}
          >
            Xóa ngày
          </button>
        )}
      </div>

      {/* Date Pickers: Từ ngày - Đến ngày */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
            Từ ngày
          </span>
          <input
            type="date"
            value={currentRange.start}
            onChange={e => handleStartDateChange(e.target.value)}
            style={{
              ...selectStyle,
              padding: '0.5rem 0.55rem',
              cursor: 'pointer'
            }}
          />
        </div>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
            Đến ngày
          </span>
          <input
            type="date"
            value={currentRange.end}
            onChange={e => handleEndDateChange(e.target.value)}
            style={{
              ...selectStyle,
              padding: '0.5rem 0.55rem',
              cursor: 'pointer'
            }}
          />
        </div>
      </div>

    </div>
  );
}
