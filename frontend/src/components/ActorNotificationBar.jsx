import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ArrowRight, RefreshCw } from 'lucide-react';
import { useRoleTasks } from '../hooks/useRoleTasks';

// Trung Tâm Nhiệm Vụ theo vai trò — định nghĩa việc và dữ liệu nằm ở hooks/useRoleTasks.js (dùng chung với số trên menu).

export default function ActorNotificationBar() {
  const navigate = useNavigate();
  const { config, data, loading, reload: load } = useRoleTasks();
  const [expanded, setExpanded] = useState(false);
  if (!config) return null;

  const pending = config.tasks.filter(t => t.count > 0);
  const total = pending.reduce((s, t) => s + t.count, 0);
  const Icon = config.icon || Bell;
  const accent = pending.some(t => t.urgent) ? '#d97706' : pending.length > 0 ? '#2563eb' : '#16a34a';

  // Tóm tắt 1 dòng khi thu gọn
  const summaryText = loading && Object.keys(data).length === 0 && pending.length === 0
    ? 'Đang tải...'
    : pending.length === 0
      ? (config.info || 'Không có việc tồn đọng — quy trình của bạn đã xử lý hết.')
      : pending.length === 1
        ? `${pending[0].count} ${pending[0].label}`
        : `${pending.length} đầu việc đang chờ xử lý`;

  return (
    <div style={{
      marginBottom: '1.5rem', borderRadius: '12px',
      backgroundColor: '#ffffff', border: '1px solid #e3e8ef', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      overflow: 'hidden'
    }}>
      {/* ── Header luôn hiển thị ── */}
      <div
        onClick={() => pending.length > 0 && setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          justifyContent: 'space-between', flexWrap: 'wrap',
          padding: '0.85rem 1.25rem',
          cursor: pending.length > 0 ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {/* Trái: icon + tiêu đề + badge + summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#f1f5f9',
            border: '1px solid #e3e8ef', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Icon size={18} style={{ color: accent }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>{config.title}</h4>
              {pending.length > 0 && (
                <span style={{
                  backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '10px',
                  fontSize: '0.75rem', fontWeight: 700, border: '1px solid #fde68a', flexShrink: 0
                }}>
                  {total} việc cần làm
                </span>
              )}
            </div>
            {/* 1 dòng tóm tắt luôn hiện khi thu gọn */}
            {!expanded && (
              <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.15rem 0 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summaryText}
              </p>
            )}
          </div>
        </div>

        {/* Phải: nút refresh + nút toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); load(); }}
            title="Làm mới"
            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.35rem', cursor: 'pointer', color: '#64748b', display: 'flex' }}
          >
            <RefreshCw size={14} />
          </button>
          {pending.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(e2 => !e2); }}
              title={expanded ? 'Thu gọn' : 'Xem chi tiết'}
              style={{
                background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px',
                padding: '0.35rem 0.6rem', cursor: 'pointer', color: '#64748b',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                fontSize: '0.77rem', fontWeight: 600,
                transition: 'background 0.15s'
              }}
            >
              <span>{expanded ? 'Thu gọn' : 'Chi tiết'}</span>
              <span style={{
                display: 'inline-block',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                lineHeight: 1
              }}>▾</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Danh sách task — chỉ hiện khi expanded ── */}
      {expanded && pending.length > 0 && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '0 1.25rem 0.85rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.6rem 0 0.5rem' }}>
            Các việc đang chờ bạn xử lý ở bước hiện tại của quy trình:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {pending.map(t => (
              <div key={t.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap',
                padding: '0.45rem 0.75rem', borderRadius: '8px',
                backgroundColor: t.urgent ? '#fffbeb' : '#f8fafc', border: `1px solid ${t.urgent ? '#fde68a' : '#e2e8f0'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                  <strong style={{
                    minWidth: '26px', textAlign: 'center', padding: '1px 6px', borderRadius: '6px',
                    backgroundColor: t.urgent ? '#d97706' : '#2563eb', color: '#ffffff', fontSize: '0.8rem'
                  }}>
                    {t.count}
                  </strong>
                  <span>{t.label}</span>
                </div>
                <button
                  onClick={() => navigate(t.path)}
                  style={{
                    fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: '6px', display: 'flex',
                    alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: '#ffffff',
                    backgroundColor: t.urgent ? '#d97706' : '#2563eb', border: 'none', cursor: 'pointer'
                  }}
                >
                  <span>{t.action}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

