import React, { useState } from 'react';
import { Calendar, ChevronDown, Check, Clock } from 'lucide-react';
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

export default function DateFilterControl({
  dateFilter,
  onChange,
  variant = 'sheet', // 'sheet' | 'inline'
  onQuickSelect
}) {
  const [showCustomModal, setShowCustomModal] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const yearOptions = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const handlePeriodChange = (newPeriod) => {
    const updated = { ...dateFilter, period: newPeriod };
    if (newPeriod === 'SPECIFIC_DATE' && !updated.selectedDate) {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      updated.selectedDate = `${y}-${m}-${d}`;
    }
    if (newPeriod === 'SPECIFIC_MONTH' && !updated.selectedMonth) {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      updated.selectedMonth = `${y}-${m}`;
    }
    if (newPeriod === 'SPECIFIC_YEAR' && !updated.selectedYear) {
      updated.selectedYear = String(currentYear);
    }
    onChange(updated);
    if (onQuickSelect) onQuickSelect(newPeriod);
  };

  // --- Inline Bar (Used on Top of OverviewTab or Tabs) ---
  if (variant === 'inline') {
    const quickItems = [
      { id: 'TODAY', label: 'Hôm Nay' },
      { id: 'THIS_MONTH', label: 'Tháng Này' },
      { id: 'THIS_YEAR', label: 'Năm Nay' },
      { id: 'ALL', label: 'Tất Cả' }
    ];

    const isCustomActive = !quickItems.some(item => item.id === dateFilter.period);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: 1 }}>
            {quickItems.map(item => {
              const active = dateFilter.period === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePeriodChange(item.id)}
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
              <span>{isCustomActive ? getDateFilterLabel(dateFilter) : 'Tùy Chọn...'}</span>
              <ChevronDown size={11} />
            </button>
          </div>
        </div>

        {/* Inline Extended Filter Drawer / Card */}
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
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Bộ Lọc Thời Gian Chi Tiết
              </span>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              <div>
                <label style={labelStyle}>Lọc theo</label>
                <select
                  value={dateFilter.period}
                  onChange={e => handlePeriodChange(e.target.value)}
                  style={selectStyle}
                >
                  <option value="TODAY">Hôm Nay (Realtime)</option>
                  <option value="YESTERDAY">Hôm Qua</option>
                  <option value="THIS_WEEK">Tuần Này</option>
                  <option value="SPECIFIC_DATE">Theo Ngày Cụ Thể</option>
                  <option value="THIS_MONTH">Tháng Này</option>
                  <option value="SPECIFIC_MONTH">Theo Tháng Cụ Thể</option>
                  <option value="THIS_YEAR">Năm Nay</option>
                  <option value="SPECIFIC_YEAR">Theo Năm Cụ Thể</option>
                  <option value="CUSTOM">Khoảng Ngày Tùy Chọn</option>
                  <option value="ALL">Tất Cả Thời Gian</option>
                </select>
              </div>

              {dateFilter.period === 'SPECIFIC_DATE' && (
                <div>
                  <label style={labelStyle}>Chọn ngày</label>
                  <input
                    type="date"
                    value={dateFilter.selectedDate || ''}
                    onChange={e => onChange({ ...dateFilter, selectedDate: e.target.value })}
                    style={selectStyle}
                  />
                </div>
              )}

              {dateFilter.period === 'SPECIFIC_MONTH' && (
                <div>
                  <label style={labelStyle}>Chọn tháng</label>
                  <input
                    type="month"
                    value={dateFilter.selectedMonth || ''}
                    onChange={e => onChange({ ...dateFilter, selectedMonth: e.target.value })}
                    style={selectStyle}
                  />
                </div>
              )}

              {dateFilter.period === 'SPECIFIC_YEAR' && (
                <div>
                  <label style={labelStyle}>Chọn năm</label>
                  <select
                    value={dateFilter.selectedYear || String(currentYear)}
                    onChange={e => onChange({ ...dateFilter, selectedYear: e.target.value })}
                    style={selectStyle}
                  >
                    {yearOptions.map(y => (
                      <option key={y} value={String(y)}>Năm {y}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {dateFilter.period === 'CUSTOM' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Từ ngày</label>
                  <input
                    type="date"
                    value={dateFilter.customStartDate || ''}
                    onChange={e => onChange({ ...dateFilter, customStartDate: e.target.value })}
                    style={selectStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Đến ngày</label>
                  <input
                    type="date"
                    value={dateFilter.customEndDate || ''}
                    onChange={e => onChange({ ...dateFilter, customEndDate: e.target.value })}
                    style={selectStyle}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Form Sheet (Used inside FilterSheet) ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <div>
        <label style={labelStyle}>Khoảng thời gian</label>
        <select
          value={dateFilter.period}
          onChange={e => handlePeriodChange(e.target.value)}
          style={selectStyle}
        >
          <option value="TODAY">Hôm Nay (Realtime)</option>
          <option value="YESTERDAY">Hôm Qua</option>
          <option value="THIS_WEEK">Tuần Này</option>
          <option value="SPECIFIC_DATE">Theo Ngày Cụ Thể...</option>
          <option value="THIS_MONTH">Tháng Này</option>
          <option value="SPECIFIC_MONTH">Theo Tháng Cụ Thể...</option>
          <option value="THIS_YEAR">Năm Nay</option>
          <option value="SPECIFIC_YEAR">Theo Năm Cụ Thể...</option>
          <option value="CUSTOM">Khoảng Ngày Tùy Chọn...</option>
          <option value="ALL">Tất Cả Thời Gian</option>
        </select>
      </div>

      {dateFilter.period === 'SPECIFIC_DATE' && (
        <div>
          <label style={labelStyle}><Calendar size={11} /> Chọn ngày cụ thể</label>
          <input
            type="date"
            value={dateFilter.selectedDate || ''}
            onChange={e => onChange({ ...dateFilter, selectedDate: e.target.value })}
            style={selectStyle}
          />
        </div>
      )}

      {dateFilter.period === 'SPECIFIC_MONTH' && (
        <div>
          <label style={labelStyle}><Calendar size={11} /> Chọn tháng cụ thể</label>
          <input
            type="month"
            value={dateFilter.selectedMonth || ''}
            onChange={e => onChange({ ...dateFilter, selectedMonth: e.target.value })}
            style={selectStyle}
          />
        </div>
      )}

      {dateFilter.period === 'SPECIFIC_YEAR' && (
        <div>
          <label style={labelStyle}><Calendar size={11} /> Chọn năm</label>
          <select
            value={dateFilter.selectedYear || String(currentYear)}
            onChange={e => onChange({ ...dateFilter, selectedYear: e.target.value })}
            style={selectStyle}
          >
            {yearOptions.map(y => (
              <option key={y} value={String(y)}>Năm {y}</option>
            ))}
          </select>
        </div>
      )}

      {dateFilter.period === 'CUSTOM' && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}><Calendar size={11} /> Từ ngày</label>
            <input
              type="date"
              value={dateFilter.customStartDate || ''}
              onChange={e => onChange({ ...dateFilter, customStartDate: e.target.value })}
              style={selectStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Đến ngày</label>
            <input
              type="date"
              value={dateFilter.customEndDate || ''}
              onChange={e => onChange({ ...dateFilter, customEndDate: e.target.value })}
              style={selectStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}
