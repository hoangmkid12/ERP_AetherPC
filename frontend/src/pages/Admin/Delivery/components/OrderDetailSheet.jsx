import React from 'react';
import { X, Phone, MapPin, Package, CheckCircle, AlertTriangle, Camera, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import { ORDER_STATUS, getStatusLabel, getStatusInfo, isOrderPrepaid } from '../../../../utils/statusLabels';
import DeliveryProgressStepper from '../../../../components/DeliveryProgressStepper';
import useSafeViewportHeight from '../../../../hooks/useSafeViewportHeight';

// Full-screen order detail view. Replaces the old dead "Xem Chi Tiết & Ảnh
// POD" button which used to set `selectedOrder` but had no modal reading it.
export default function OrderDetailSheet({ order: ord, onClose, fmt, actions = {} }) {
  const safeVh = useSafeViewportHeight();
  if (!ord) return null;

  const orderId = ord.orderId || ord.id;
  const codAmount = parseFloat(ord.totalAmount || ord.total || 0);
  const isPrepaid = isOrderPrepaid(ord);
  const isDelivered = ord.status === 'DELIVERED';
  const isFailed = ord.status === 'SHIPPING_FAILED';
  const statusInfo = getStatusInfo(ORDER_STATUS, ord.status);

  const formatMoney = (val) => (fmt ? fmt(val) : `${Number(val || 0).toLocaleString('vi-VN')} ₫`);

  const Row = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border-glass)', fontSize: '0.82rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <div className="delivery-fullscreen-modal" style={{ height: `${safeVh}px` }} onClick={onClose}>
      <div className="delivery-fullscreen-modal-inner" style={{ height: `${safeVh}px` }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-glass)', flexShrink: 0 }}>
          <div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Đơn Hàng #{orderId}</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chi tiết & minh chứng giao hàng</div>
          </div>
          <button type="button" onClick={onClose} className="delivery-icon-btn"><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem' }}>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
            backgroundColor: `${statusInfo.color}20`, color: statusInfo.color, marginBottom: '0.85rem'
          }}>
            {getStatusLabel(ORDER_STATUS, ord.status)}
          </span>

          <div className="delivery-card" style={{ marginBottom: '0.85rem' }}>
            <DeliveryProgressStepper status={ord.status} />
          </div>

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
            <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
              <CreditCard size={16} /> Thanh Toán
            </div>
            <Row label="Tổng tiền đơn hàng" value={formatMoney(codAmount)} />
            <Row label="Hình thức đặt hàng" value={isPrepaid ? 'Đã trả online' : 'Thu hộ khi nhận hàng (COD)'} />

            {isDelivered ? (
              <>
                <Row
                  label="Hình thức đã thu"
                  value={
                    ord.actualPaymentMethod === 'CASH'
                      ? 'Tiền mặt'
                      : ord.actualPaymentMethod === 'BANK_TRANSFER'
                        ? 'Chuyển khoản VietQR'
                        : ord.actualPaymentMethod === 'SPLIT'
                          ? 'Kết hợp (Tiền mặt + QR)'
                          : isPrepaid
                            ? 'Đã trả trước qua cổng online'
                            : 'Đã thanh toán'
                  }
                />
                <Row
                  label="Số tiền đã thu"
                  value={
                    ord.actualPaymentMethod === 'CASH'
                      ? `${formatMoney(codAmount)} (Tiền mặt)`
                      : ord.actualPaymentMethod === 'BANK_TRANSFER'
                        ? `${formatMoney(codAmount)} (Chuyển khoản)`
                        : isPrepaid
                          ? '0 ₫ (Không thu thêm)'
                          : formatMoney(codAmount)
                  }
                />
                {ord.bankRefCode && <Row label="Mã GD ngân hàng" value={ord.bankRefCode} />}
              </>
            ) : (
              <Row
                label="Cần thu khi giao"
                value={isPrepaid ? '0 ₫ (Đã thanh toán trước)' : formatMoney(codAmount)}
              />
            )}

            {ord.receivedByType && (
              <Row
                label="Người nhận thực tế"
                value={
                  ord.receivedByType === 'DIRECT_CUSTOMER'
                    ? 'Khách chính chủ'
                    : (ord.receiverNameActual ? `Nhận thay (${ord.receiverNameActual})` : 'Người nhận thay')
                }
              />
            )}

            {/* Thông báo tiền mặt đang giữ cho Shipper */}
            {isDelivered && ord.actualPaymentMethod === 'CASH' && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.7rem 0.85rem',
                backgroundColor: 'rgba(22, 163, 74, 0.08)',
                border: '1.5px solid #86efac',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#15803d'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800 }}>
                  <Banknote size={16} /> Đã thu đủ: {formatMoney(codAmount)} tiền mặt
                </div>
                <div style={{ fontSize: '0.74rem', color: '#166534', marginTop: '3px', lineHeight: 1.4 }}>
                  Shipper đang giữ <strong>{formatMoney(codAmount)}</strong> tiền mặt COD từ đơn này. Hãy đối soát và nộp lại cho Kế toán / Thu ngân khi hết ca làm việc.
                </div>
              </div>
            )}

            {/* Thông báo chuyển khoản */}
            {isDelivered && ord.actualPaymentMethod === 'BANK_TRANSFER' && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.7rem 0.85rem',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                border: '1.5px solid #93c5fd',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#1d4ed8'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800 }}>
                  <ShieldCheck size={16} /> Đã chuyển khoản: {formatMoney(codAmount)} (VietQR)
                </div>
                <div style={{ fontSize: '0.74rem', color: '#1e40af', marginTop: '3px', lineHeight: 1.4 }}>
                  Mã giao dịch: <strong>{ord.bankRefCode || 'Đã ghi nhận'}</strong> (Tiền đã vào thẳng tài khoản công ty, Shipper không giữ tiền mặt).
                </div>
              </div>
            )}
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
                {ord.receiverNote || 'Không có ghi chú.'}
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

          {ord.status === 'RETURNING_TO_WAREHOUSE' && (ord.returnProofPhoto || ord.returnNote) && (
            <div className="delivery-card" style={{ marginBottom: '0.85rem', borderColor: 'var(--warning)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.5rem', color: 'var(--warning)' }}>
                Ảnh Minh Chứng Hoàn Kho
              </div>
              {ord.returnProofPhoto ? (
                <img src={ord.returnProofPhoto} alt="Return Proof" style={{ width: '100%', borderRadius: 'var(--radius-md)', display: 'block', marginBottom: '0.6rem' }} />
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>Shipper đã bỏ qua chụp ảnh cho lần hoàn kho này.</div>
              )}
              {ord.returnNote && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ghi chú: {ord.returnNote}</div>}
            </div>
          )}

          {/* Footer actions — only for a plain "en route" order; SHIPPING_FAILED /
              RETURNING_TO_WAREHOUSE orders have their own resume/escalate flows
              surfaced from the ActiveTab card, not duplicated here. Ghim bằng
              position:sticky+bottom:0 ngay trong vùng cuộn (thay vì sibling
              flex-shrink:0 ngoài) để không bị khoảng trắng che trên điện
              thoại thật khi 100dvh tính trễ/sai lúc thanh địa chỉ ẩn/hiện. */}
          {actions.onDeliver && ord.status === 'SHIPPED' && (
            <div className="delivery-modal-action-bar" style={{ position: 'sticky', bottom: 0, zIndex: 10, display: 'flex', gap: '0.6rem', padding: '0.85rem 1rem 0', borderTop: '1px solid var(--border-glass)', background: 'var(--bg-primary)' }}>
              <button
                type="button"
                className="delivery-tap-target"
                onClick={() => { onClose(); actions.onDeliver(ord); }}
                style={{ flex: 1, backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.65rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Camera size={16} /> Giao Thành Công
              </button>
              {actions.onFail && (
                <button
                  type="button"
                  className="delivery-tap-target"
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
    </div>
  );
}
