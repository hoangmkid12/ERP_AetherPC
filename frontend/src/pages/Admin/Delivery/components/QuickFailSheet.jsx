import React from 'react';
import { X, PhoneOff, PackageX, ChevronRight } from 'lucide-react';
import { buildFailPayload } from '../deliveryHelpers';

// Rút gọn của FailModal cho luồng "Bắt Đầu Giao" gộp màn hình — chỉ 2 lý do
// phổ biến nhất, bấm là xong, không cần chọn dropdown/nhập textarea. Các lý
// do ít gặp hơn (sai địa chỉ, hàng hỏng, khách hẹn lại...) vẫn xử lý được
// qua "Lý do khác..." mở FailModal đầy đủ, không mất khả năng cũ.
const QUICK_REASONS = [
  {
    key: 'no_contact',
    label: 'Khách Không Nghe Máy',
    desc: 'Gọi không được, thuê bao — hệ thống tự nhắc gọi lại trong 24h',
    icon: PhoneOff,
    color: '#d97706',
    reason: 'Không liên lạc được (Gọi 3 cuộc không nghe máy / Thuê bao)'
  },
  {
    key: 'rejected',
    label: 'Khách Từ Chối Nhận Hàng',
    desc: 'Không còn nhu cầu / bom hàng — chuyển hoàn kho',
    icon: PackageX,
    color: '#dc2626',
    reason: 'Khách từ chối nhận hàng (Bom hàng / Không còn nhu cầu)'
  }
];

export default function QuickFailSheet({ order, onConfirm, onOpenFullFail, onClose }) {
  if (!order) return null;

  const attemptCount = (order.deliveryAttempts || 0) + 1;

  return (
    <div className="delivery-filter-sheet-overlay" onClick={onClose}>
      <div className="delivery-filter-sheet" onClick={e => e.stopPropagation()}>
        <div className="delivery-sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--danger)', margin: 0 }}>
              Không Giao Được #{order.orderId || order.id}
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Lần {attemptCount} / 3 — chọn lý do để xử lý ngay</span>
          </div>
          <button type="button" onClick={onClose} className="delivery-icon-btn"><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {QUICK_REASONS.map(({ key, label, desc, icon: Icon, color, reason }) => (
            <button
              key={key}
              type="button"
              className="delivery-tap-target"
              onClick={() => onConfirm(buildFailPayload(order, reason, ''))}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                padding: '0.85rem 0.9rem', borderRadius: 'var(--radius-md)',
                border: `1.5px solid ${color}33`, backgroundColor: `${color}12`,
                cursor: 'pointer', textAlign: 'left'
              }}
            >
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color }}>{label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{desc}</div>
              </div>
              <ChevronRight size={16} color={color} />
            </button>
          ))}

          <button
            type="button"
            onClick={() => onOpenFullFail(order)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem',
              fontWeight: 700, cursor: 'pointer', padding: '0.5rem', textAlign: 'center', textDecoration: 'underline'
            }}
          >
            Lý do khác (sai địa chỉ, hàng hỏng, khách hẹn lại...)
          </button>
        </div>
      </div>
    </div>
  );
}
