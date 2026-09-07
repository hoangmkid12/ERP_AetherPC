import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

// Delivery-failure report flow. Keeps the reason dropdown + attempt
// counter + free-text note from the old Delivery.jsx (these ARE read by
// the update handler). Drops the old 3-radio "Hướng Xử Lý" group — it was
// purely cosmetic (never read by handleFailDelivery, no matching backend
// field) so it's intentionally not carried over, per the in-scope bug fix.
export default function FailModal({ order: failModal, onClose, onConfirm }) {
  const [failReason, setFailReason] = useState('');
  const [failNote, setFailNote] = useState('');

  const attemptCount = (failModal.deliveryAttempts || 0) + 1;
  const isMaxAttempt = attemptCount >= 3;

  const handleSubmit = () => {
    if (!failReason) return;
    const isNoContact = failReason.includes('Không liên lạc được');
    const now = new Date();
    const deadline24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    onConfirm({
      failReason,
      failNote,
      failedAt: now.toISOString(),
      callbackDeadline: isNoContact ? deadline24h : null,
      isAwaitingCallback: isNoContact,
      deliveryAttempts: attemptCount
    });
  };

  return (
    <div className="delivery-filter-sheet-overlay" onClick={onClose}>
      <div
        className="delivery-filter-sheet"
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.9rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--danger)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={18} /> Báo Sự Cố #{failModal.orderId || failModal.id}
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{failModal.customerName} · {failModal.phone}</span>
          </div>
          <button type="button" onClick={onClose} className="delivery-icon-btn"><X size={16} /></button>
        </div>

        <div style={{
          padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '0.9rem',
          backgroundColor: isMaxAttempt ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.1)',
        }}>
          <div style={{ fontWeight: 800, fontSize: '0.8rem', color: isMaxAttempt ? 'var(--danger)' : 'var(--warning)' }}>
            Giao Thất Bại Lần {attemptCount} / 3
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            {isMaxAttempt
              ? 'Đơn đã thất bại 3 lần. Hệ thống sẽ tự động CHUYỂN HOÀN VỀ KHO.'
              : 'Quy chuẩn cho phép giao tối đa 3 lần trước khi hoàn kho.'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.82rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Lý Do Không Giao Được *
            </label>
            <select
              value={failReason}
              onChange={e => setFailReason(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-glass)', fontSize: '0.82rem', fontWeight: 600, boxSizing: 'border-box' }}
            >
              <option value="">-- Chọn lý do cụ thể --</option>
              <option value="Khách hẹn giao lại ngày khác (Bận việc / Đi vắng)">Khách hẹn giao lại ngày khác</option>
              <option value="Không liên lạc được (Gọi 3 cuộc không nghe máy / Thuê bao)">Không liên lạc được (3 cuộc)</option>
              <option value="Khách từ chối nhận hàng (Bom hàng / Không còn nhu cầu)">Khách từ chối nhận hàng</option>
              <option value="Sai địa chỉ nhận hàng / Không tìm thấy số nhà">Sai địa chỉ nhận hàng</option>
              <option value="Kiện hàng bị móp méo / Hư hỏng do vận chuyển">Kiện hàng bị hư hỏng</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Ghi Chú Chi Tiết:
            </label>
            <textarea
              rows={3}
              placeholder="Ví dụ: Khách bảo đi công tác, hẹn giao lại sáng thứ Bảy..."
              value={failNote}
              onChange={e => setFailNote(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', boxSizing: 'border-box', fontSize: '0.82rem' }}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!failReason}
            style={{
              width: '100%', backgroundColor: failReason ? 'var(--danger)' : '#94a3b8', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '0.85rem',
              fontWeight: 800, cursor: failReason ? 'pointer' : 'not-allowed'
            }}
          >
            Xác Nhận Báo Lỗi & Lưu Lịch
          </button>
        </div>
      </div>
    </div>
  );
}
