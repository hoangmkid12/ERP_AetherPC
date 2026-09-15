import React from 'react';
import { X } from 'lucide-react';
import useSafeViewportHeight from '../../../../hooks/useSafeViewportHeight';
import PODCaptureSection from './PODCaptureSection';

// Proof-of-Delivery entry point used by OrderDetailSheet's "Giao Thành
// Công" footer button — the secondary path (tap into an order's full
// detail view, still SHIPPED, and mark it delivered from there). Opens
// straight into the camera (autoStartCamera) exactly like before; all the
// actual capture/payment/swipe logic lives in PODCaptureSection so it can
// also be embedded inline inside DeliveryNavigationModal's consolidated
// "Bắt Đầu Giao" screen without duplicating it.
export default function PODModal({ order: deliverModal, user, onClose, onConfirm, fmt }) {
  const safeVh = useSafeViewportHeight();

  return (
    <div className="delivery-fullscreen-modal" style={{ height: `${safeVh}px` }}>
      <div className="delivery-fullscreen-modal-inner" style={{ height: `${safeVh}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-glass)', flexShrink: 0 }}>
          <div>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Biên Bản Giao Hàng #{deliverModal.orderId || deliverModal.id}</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{deliverModal.customerName} · {deliverModal.phone}</div>
          </div>
          <button type="button" onClick={onClose} className="delivery-icon-btn"><X size={18} /></button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem' }}>
          <PODCaptureSection order={deliverModal} user={user} fmt={fmt} onConfirm={onConfirm} autoStartCamera />
        </div>
      </div>
    </div>
  );
}
