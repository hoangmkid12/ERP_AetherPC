import React, { useState } from 'react';
import { X, MapPinOff, PackageX, Ban, ChevronRight } from 'lucide-react';

// Bottom sheet cho nút "Từ Chối" ở tab Chờ Nhận — shipper chọn nhanh 1 lý do
// hoặc gõ lý do khác, rồi gỡ gán bản thân khỏi đơn để Kho phân công lại. Mirror
// cấu trúc/giao diện của QuickFailSheet.jsx cho nhất quán trong toàn app.
const QUICK_REASONS = [
  { key: 'too_far', label: 'Ngoài Khu Vực Phụ Trách', icon: MapPinOff, color: '#d97706' },
  { key: 'overloaded', label: 'Đang Quá Tải Đơn Khác', icon: PackageX, color: '#dc2626' },
  { key: 'other', label: 'Lý Do Khác', icon: Ban, color: 'var(--text-muted)' }
];

export default function RejectAssignmentSheet({ order, onConfirm, onClose }) {
  const [selectedKey, setSelectedKey] = useState(null);
  const [customReason, setCustomReason] = useState('');

  if (!order) return null;

  const selected = QUICK_REASONS.find(r => r.key === selectedKey);
  const canSubmit = selectedKey && (selectedKey !== 'other' || customReason.trim().length > 0);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const reason = selectedKey === 'other' ? customReason.trim() : selected.label;
    onConfirm(reason);
  };

  return (
    <div className="delivery-filter-sheet-overlay" onClick={onClose}>
      <div className="delivery-filter-sheet" onClick={e => e.stopPropagation()}>
        <div className="delivery-sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--danger)', margin: 0 }}>
              Từ Chối Đơn #{order.orderId || order.id}
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Đơn sẽ quay lại chờ Kho phân công cho shipper khác</span>
          </div>
          <button type="button" onClick={onClose} className="delivery-icon-btn"><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {QUICK_REASONS.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              type="button"
              className="delivery-tap-target"
              onClick={() => setSelectedKey(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                padding: '0.75rem 0.9rem', borderRadius: 'var(--radius-md)',
                border: selectedKey === key ? `1.5px solid ${color}` : '1.5px solid transparent',
                backgroundColor: `${color}12`,
                cursor: 'pointer', textAlign: 'left'
              }}
            >
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <Icon size={16} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: '0.85rem', color }}>{label}</div>
              <ChevronRight size={16} color={color} />
            </button>
          ))}

          {selectedKey === 'other' && (
            <textarea
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              rows={2}
              style={{ width: '100%', padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', fontSize: '0.82rem', boxSizing: 'border-box', resize: 'vertical' }}
            />
          )}

          <button
            type="button"
            className="delivery-tap-target"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: '100%', marginTop: '0.3rem', padding: '0.75rem', borderRadius: 'var(--radius-md)',
              border: 'none', backgroundColor: canSubmit ? 'var(--danger)' : 'var(--bg-tertiary)',
              color: canSubmit ? '#fff' : 'var(--text-muted)', fontWeight: 800, fontSize: '0.85rem',
              cursor: canSubmit ? 'pointer' : 'not-allowed'
            }}
          >
            Xác Nhận Từ Chối
          </button>
        </div>
      </div>
    </div>
  );
}
