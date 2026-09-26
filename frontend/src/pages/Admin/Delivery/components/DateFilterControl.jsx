import React, { useState } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { getDateFilterLabel } from '../deliveryHelpers';

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
  fontSize: '0.72rem',
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
  const [showCustomModal, setShowCustomModal] = useState(false);

  const now = new Date();
  const todayStr = toIsoDateString(now);

  const yDate = new Date(now);
  yDate.setDate(yDate.getDate() - 1);
  const yesterdayStr = toIsoDateString(yDate);

  const past7 = new Date(now);
  past7.setDate(past7.getDate() - 6);
  const past7Str = toIsoDateString(past7);

  const monthStartStr = toIsoDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEndStr = toIsoDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));

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

  const quickPresets = [
    {
      id: 'ALL',
      label: 'Tất Cả',
      action: handleClearDate,
      isActive: dateFilter?.period === 'ALL' || (!currentRange.start && !currentRange.end)
    },
    {
      id: 'TODAY',
      label: 'Hôm Nay',
      action: () => {
        onChange({
          ...dateFilter,
          period: 'TODAY',
          customStartDate: todayStr,
          customEndDate: todayStr
        });
        if (onQuickSelect) onQuickSelect('TODAY');
      },
      isActive: dateFilter?.period === 'TODAY' || (currentRange.start === todayStr && currentRange.end === todayStr)
    },
    {
      id: 'YESTERDAY',
      label: 'Hôm Qua',
      action: () => {
        onChange({
          ...dateFilter,
          period: 'CUSTOM',
          customStartDate: yesterdayStr,
          customEndDate: yesterdayStr
        });
        if (onQuickSelect) onQuickSelect('YESTERDAY');
      },
      isActive: dateFilter?.period === 'YESTERDAY' || (currentRange.start === yesterdayStr && currentRange.end === yesterdayStr)
    },
    {
      id: '7DAYS',
      label: '7 Ngày Qua',
      action: () => {
        onChange({
          ...dateFilter,
          period: 'CUSTOM',
          customStartDate: past7Str,
          customEndDate: todayStr
        });
        if (onQuickSelect) onQuickSelect('7DAYS');
      },
      isActive: currentRange.start === past7Str && currentRange.end === todayStr
    },
    {
      id: 'THIS_MONTH',
      label: 'Tháng Này',
      action: () => {
        onChange({
          ...dateFilter,
          period: 'CUSTOM',
          customStartDate: monthStartStr,
          customEndDate: monthEndStr
        });
        if (onQuickSelect) onQuickSelect('THIS_MONTH');
      },
      isActive: dateFilter?.period === 'THIS_MONTH' || (currentRange.start === monthStartStr && currentRange.end === monthEndStr)
    }
  ];

  // --- Inline Bar (Used on Top of OverviewTab or Tabs) ---
  if (variant === 'inline') {
    const inlineItems = [
      { id: 'TODAY', label: 'Hôm Nay' },
      { id: 'THIS_MONTH', label: 'Tháng Này' },
      { id: 'THIS_YEAR', label: 'Năm Nay' },
      { id: 'ALL', label: 'Tất Cả' }
    ];

    const isCustomActive = !inlineItems.some(item => item.id === dateFilter.period);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: 1 }}>
            {inlineItems.map(item => {
              const active = dateFilter.period === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'ALL') handleClearDate();
                    else if (item.id === 'TODAY') {
                      onChange({ ...dateFilter, period: 'TODAY', customStartDate: todayStr, customEndDate: todayStr });
                      if (onQuickSelect) onQuickSelect('TODAY');
                    } else if (item.id === 'THIS_MONTH') {
                      onChange({ ...dateFilter, period: 'THIS_MONTH', customStartDate: monthStartStr, customEndDate: monthEndStr });
                      if (onQuickSelect) onQuickSelect('THIS_MONTH');
                    } else {
                      onChange({ ...dateFilter, period: item.id });
                      if (onQuickSelect) onQuickSelect(item.id);
                    }
                  }}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '20px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: active ? '1.5px solid var(--primary)' : '1px solid var(--border-glass)',
                    backgroundColor: active ? 'var(--primary)' : 'var(--bg-primary)',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                    boxShadow: active ? '0 2px 6px rgba(37,99,235,0.25)' : 'none'
                  }}
                >
                  {item.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowCustomModal(!showCustomModal)}
              style={{
                padding: '0.35rem 0.7rem',
                borderRadius: '20px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                border: isCustomActive ? '1.5px solid var(--primary)' : '1px solid var(--border-glass)',
                backgroundColor: isCustomActive ? 'rgba(37,99,235,0.12)' : 'var(--bg-primary)',
                color: isCustomActive ? 'var(--primary)' : 'var(--text-secondary)'
              }}
            >
              <Calendar size={12} />
              <span>{isCustomActive ? getDateFilterLabel(dateFilter) : 'Chọn Ngày...'}</span>
              <ChevronDown size={11} />
            </button>
          </div>
        </div>

        {/* Inline Extended Filter Drawer */}
        {showCustomModal && (
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem',
            marginTop: '0.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Calendar size={13} style={{ color: 'var(--primary)' }} />
                Chọn Khoảng Thời Gian
              </span>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Từ ngày</span>
                <input
                  type="date"
                  value={currentRange.start}
                  onChange={e => handleStartDateChange(e.target.value)}
                  style={{ ...selectStyle, padding: '0.45rem 0.5rem' }}
                />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Đến ngày</span>
                <input
                  type="date"
                  value={currentRange.end}
                  onChange={e => handleEndDateChange(e.target.value)}
                  style={{ ...selectStyle, padding: '0.45rem 0.5rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {quickPresets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={preset.action}
                  style={{
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: preset.isActive ? '1.5px solid var(--primary)' : '1px solid var(--border-glass)',
                    backgroundColor: preset.isActive ? 'rgba(37,99,235,0.1)' : 'var(--bg-primary)',
                    color: preset.isActive ? 'var(--primary)' : 'var(--text-secondary)'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
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
              fontSize: '0.72rem',
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
          <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
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
          <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
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

      {/* Quick preset buttons */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
        {quickPresets.map(preset => (
          <button
            key={preset.id}
            type="button"
            onClick={preset.action}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: preset.isActive ? '1.5px solid var(--primary)' : '1px solid var(--border-glass)',
              backgroundColor: preset.isActive ? 'rgba(37,99,235,0.1)' : 'var(--bg-primary)',
              color: preset.isActive ? 'var(--primary)' : 'var(--text-secondary)'
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
