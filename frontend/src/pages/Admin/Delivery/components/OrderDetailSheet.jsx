import React from 'react';
import { X, Phone, MapPin, Package, CheckCircle, AlertTriangle } from 'lucide-react';
import { ORDER_STATUS, getStatusLabel, getStatusInfo } from '../../../../utils/statusLabels';

// Full-screen order detail view. Replaces the old dead "Xem Chi Tiết & Ảnh
// POD" button which used to set `selectedOrder` but had no modal reading it.
export default function OrderDetailSheet({ order: ord, onClose, fmt, actions = {} }) {
  if (!ord) return null;

  const orderId = ord.orderId || ord.id;
  const codAmount = parseFloat(ord.totalAmount || ord.total || 0);
  const isPrepaid = ord.paymentStatus === 'PAID' || ord.paymentMethod === 'ONLINE_GATEWAY' || ord.paymentMethod === 'BANK_TRANSFER' || codAmount === 0;
  const isDelivered = ord.status === 'DELIVERED';
  const isFailed = ord.status === 'SHIPPING_FAILED';
  const statusInfo = getStatusInfo(ORDER_STATUS, ord.status);

  const Row = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border-glass)', fontSize: '0.82rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <div className="delivery-fullscreen-modal" onClick={onClose}>
      <div className="delivery-fullscreen-modal-inner" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-glass)', flexShrink: 0 }}>
          <div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Đơn Hàng #{orderId}</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chi tiết & minh chứng giao hàng</div>
          </div>
          <button type="button" onClick={onClose} className="delivery-icon-btn"><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
            backgroundColor: `${statusInfo.color}20`, color: statusInfo.color, marginBottom: '0.85rem'
          }}>
            {getStatusLabel(ORDER_STATUS, ord.status)}
          </span>

          <div className="delivery-card" style={{ marginBottom: '0.85rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
              <Package size={16} /> Thông Tin Khách Hàng
            </div>
            <Row label="Khách nhận" value={ord.customerName} />
            <Row label="Số điện thoại" value={
              <a href={`tel:${ord.phone}`} style={{ color: 'var(--primary)' }}>{ord.phone}</a>
            } />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.55rem 0', fontSize: '0.82rem' }}>
              <MapPin size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ color: 'var(--text-primary)' }}>{ord.shippingAddress || 'TP. Hồ Chí Minh'}</span>
            </div>
          </div>

          <div className="delivery-card" style={{ marginBottom: '0.85rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Thanh Toán
            </div>
            <Row label="Hình thức" value={isPrepaid ? 'Đã trả online' : 'Thu hộ COD'} />
            <Row label="Số tiền" value={isPrepaid ? '0 đ' : fmt(codAmount)} />
            {ord.actualPaymentMethod && <Row label="Thanh toán thực tế" value={ord.actualPaymentMethod === 'BANK_TRANSFER' ? `Chuyển khoản (${ord.bankRefCode || ''})` : ord.actualPaymentMethod === 'CASH' ? 'Tiền mặt' : 'Đã trả trước'} />}
            {ord.receivedByType && <Row label="Người nhận" value={ord.receivedByType === 'DIRECT_CUSTOMER' ? 'Khách chính chủ' : (ord.receiverNameActual || 'Nhận thay')} />}
          </div>

          {isDelivered && (
            <div className="delivery-card" style={{ marginBottom: '0.85rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)' }}>
                <CheckCircle size={16} /> Minh Chứng Giao Hàng (POD)
              </div>
              {ord.proofPhoto ? (
                <img src={ord.proofPhoto} alt="POD" style={{ width: '100%', borderRadius: 'var(--radius-md)', display: 'block', marginBottom: '0.6rem' }} />
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>Không có ảnh minh chứng.</div>
              )}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {ord.receiverNote || 'Khách đã ký nhận nguyên vẹn.'}
              </div>
              {ord.deliveredAt && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Giao lúc: {new Date(ord.deliveredAt).toLocaleString('vi-VN')}
                </div>
              )}
            </div>
          )}

          {isFailed && (
            <div className="delivery-card" style={{ marginBottom: '0.85rem', borderColor: 'var(--danger)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger)' }}>
                <AlertTriangle size={16} /> Sự Cố Giao Hàng
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                {ord.failReason || 'Không rõ lý do'}
              </div>
              {ord.failNote && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ghi chú: {ord.failNote}</div>}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Lần giao thất bại: {ord.deliveryAttempts || 1}/3
              </div>
            </div>
          )}
        </div>

        {/* Footer actions — only for a plain "en route" order; SHIPPING_FAILED /
            RETURNING_TO_WAREHOUSE orders have their own resume/escalate flows
            surfaced from the ActiveTab card, not duplicated here. */}
        {actions.onDeliver && ord.status === 'SHIPPED' && (
          <div style={{ display: 'flex', gap: '0.6rem', padding: '0.85rem 1rem', borderTop: '1px solid var(--border-glass)', background: 'var(--bg-primary)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => { onClose(); actions.onDeliver(ord); }}
              style={{ flex: 1, backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.65rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}
            >
              Giao Thành Công
            </button>
            {actions.onFail && (
              <button
                type="button"
                onClick={() => { onClose(); actions.onFail(ord); }}
                style={{ backgroundColor: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.9rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Báo Lỗi
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
