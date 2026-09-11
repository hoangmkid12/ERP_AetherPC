import React from 'react';
import { Truck, Clock, Camera, Eye } from 'lucide-react';
import { getDeliveryIncidentStatus } from '../deliveryHelpers';

// Shared full-width mobile card used by PendingTab / ActiveTab / HistoryTab.
// `variant` controls which action buttons render:
//   'pending' -> just the "Nhận Chuyến" claim button
//   'active'  -> the full status-based action set (POD / fail / resume / etc.)
//   'history' -> read-only, tap to view detail only
export default function OrderCard({ order: ord, variant, fmt, getOrderTimeClassification, onOpenDetail, actions = {} }) {
  const incidentStatus = getDeliveryIncidentStatus(ord);
  const { isDelivered, isAwaiting, isRescheduled, isRejected, isReturning } = incidentStatus;

  const timeInfo = getOrderTimeClassification(ord);
  const codAmount = parseFloat(ord.totalAmount || ord.total || 0);
  const isPrepaid = ord.paymentStatus === 'PAID' || ord.paymentMethod === 'ONLINE_GATEWAY' || ord.paymentMethod === 'BANK_TRANSFER' || codAmount === 0;
  const addrStr = (ord.shippingAddress || '').toLowerCase();
  const isHCM = addrStr.includes('hồ chí minh') || addrStr.includes('hcm') || addrStr.includes('tp.hcm') || addrStr.includes('quận');

  const orderId = ord.orderId || ord.id;

  const statusBadge = {
    text: incidentStatus.badgeText,
    bg: incidentStatus.badgeBg,
    color: incidentStatus.badgeColor
  };

  return (
    <div className="delivery-card" onClick={() => onOpenDetail && onOpenDetail(ord)} style={{ cursor: onOpenDetail ? 'pointer' : 'default' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isDelivered ? 'var(--success)' : 'var(--primary)' }}>
          #{orderId}
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800,
          backgroundColor: statusBadge.bg, color: statusBadge.color, whiteSpace: 'nowrap'
        }}>
          {statusBadge.text}
        </span>
      </div>

      {timeInfo.isNew && !isDelivered && (
        <div style={{ fontSize: '0.68rem', color: '#ea580c', fontWeight: 800, marginBottom: '0.35rem' }}>
          MỚI BÀN GIAO
        </div>
      )}

      {/* Customer */}
      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.2rem' }}>
        {ord.customerName}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
        <span>{ord.phone}</span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.55rem', display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
        <span>{ord.shippingAddress || 'TP. Hồ Chí Minh'}</span>
        <span style={{
          flexShrink: 0, padding: '1px 5px', borderRadius: '3px', fontSize: '0.65rem', fontWeight: 700,
          backgroundColor: isHCM ? 'rgba(22,163,74,0.1)' : 'rgba(124,58,237,0.1)',
          color: isHCM ? 'var(--success)' : '#7c3aed'
        }}>
          {isHCM ? 'HCM' : 'Tỉnh'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.55rem' }}>
        <Clock size={12} />
        <span>{isDelivered ? `Đã giao: ${timeInfo.formatted}` : isAwaiting ? 'Chờ khách gọi lại (24h)' : timeInfo.formatted}</span>
      </div>

      {/* COD box */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.55rem 0.7rem', borderRadius: 'var(--radius-md)', marginBottom: '0.65rem',
        backgroundColor: isPrepaid ? 'rgba(37,99,235,0.08)' : 'rgba(22,163,74,0.08)'
      }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isPrepaid ? 'var(--primary)' : 'var(--success)' }}>
          {isDelivered ? 'ĐÃ THU' : isPrepaid ? 'ĐÃ TRẢ ONLINE' : 'CẦN THU COD'}
        </span>
        <strong style={{ fontSize: '0.92rem', color: isPrepaid ? 'var(--primary)' : 'var(--success)' }}>
          {isPrepaid ? '0 đ' : fmt(codAmount)}
        </strong>
      </div>

      {/* Actions */}
      {variant === 'pending' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); actions.onClaim && actions.onClaim(orderId); }}
          style={{ width: '100%', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.65rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
        >
          <Truck size={16} /> Nhận Chuyến & Xuất Kho
        </button>
      )}

      {variant === 'history' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenDetail && onOpenDetail(ord); }}
          style={{ width: '100%', backgroundColor: 'transparent', color: 'var(--primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '0.5rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
        >
          <Eye size={14} /> Xem Chi Tiết
        </button>
      )}

      {variant === 'active' && (
        <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
          {isDelivered ? (
            <>
              <button
                type="button"
                onClick={() => onOpenDetail && onOpenDetail(ord)}
                style={{ flex: 1, backgroundColor: 'rgba(22,163,74,0.1)', color: 'var(--success)', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.55rem', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Xem Chi Tiết & Ảnh POD
              </button>
              <button
                type="button"
                onClick={() => actions.onRedeliver && actions.onRedeliver(orderId)}
                title="Nếu giao nhầm hoặc cần chụp lại POD"
                style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '0.55rem 0.7rem', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Giao Lại
              </button>
            </>
          ) : isAwaiting ? (
            <>
              <button
                type="button"
                onClick={() => actions.onResume && actions.onResume(orderId)}
                style={{ flex: 1.2, backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.55rem', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Khách Đã Gọi Lại
              </button>
              <button
                type="button"
                onClick={() => actions.onForceReturn && actions.onForceReturn(ord)}
                style={{ flex: 0.8, backgroundColor: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '0.55rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Hoàn Kho
              </button>
            </>
          ) : isRescheduled ? (
            <>
              <button
                type="button"
                onClick={() => actions.onResume && actions.onResume(orderId)}
                style={{ flex: 1.2, backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.55rem', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Giao Tiếp Theo Hẹn
              </button>
              <button
                type="button"
                onClick={() => actions.onForceReturn && actions.onForceReturn(ord)}
                style={{ flex: 0.8, backgroundColor: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '0.55rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Hoàn Kho
              </button>
            </>
          ) : isRejected ? (
            <>
              <button
                type="button"
                onClick={() => actions.onForceReturn && actions.onForceReturn(ord)}
                style={{ flex: 1.2, backgroundColor: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.55rem', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Xác Nhận Hoàn Kho
              </button>
              <button
                type="button"
                onClick={() => actions.onEscalate && actions.onEscalate(orderId)}
                style={{ flex: 0.9, backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.55rem', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Báo CSKH
              </button>
            </>
          ) : isReturning ? (
            <button
              type="button"
              onClick={() => actions.onResume && actions.onResume(orderId)}
              style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', padding: '0.55rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Khách Đổi Ý → Tiếp Tục Giao
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => actions.onDeliver && actions.onDeliver(ord)}
                style={{ flex: 1, backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.6rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
              >
                <Camera size={15} /> Giao Thành Công
              </button>
              <button
                type="button"
                onClick={() => actions.onFail && actions.onFail(ord)}
                style={{ backgroundColor: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Báo Lỗi
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
