import React from 'react';
import { CheckCircle2, ChevronRight, MapPin, Phone, ArrowLeft, Package, Sparkles } from 'lucide-react';

export default function NextOrderPromptModal({
  deliveredOrder,
  nextOrder,
  remainingCount,
  onContinue,
  onBackToList
}) {
  if (!nextOrder) return null;

  const nextId = nextOrder.orderId || nextOrder.id;
  const custName = nextOrder.customerName || nextOrder.customer?.name || 'Khách hàng';
  const phone = nextOrder.phone || nextOrder.customer?.phone;
  const address = nextOrder.shippingAddress || nextOrder.address || '';
  const cod = parseFloat(nextOrder.totalAmount || nextOrder.total || 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary, #ffffff)',
        borderRadius: 'var(--radius-lg, 16px)',
        border: '1.5px solid var(--border-glass, #e2e8f0)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        width: '100%', maxWidth: '420px',
        overflow: 'hidden',
        animation: 'scaleUp 0.2s ease-out'
      }}>
        {/* Header thành công */}
        <div style={{
          padding: '1.25rem 1.25rem 1rem',
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(34,197,94,0.12) 0%, transparent 100%)',
          borderBottom: '1px solid var(--border-glass, #f1f5f9)'
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            backgroundColor: '#dcfce7', color: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 0.6rem',
            boxShadow: '0 4px 12px rgba(34,197,94,0.25)'
          }}>
            <CheckCircle2 size={30} />
          </div>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
            Giao Thành Công!
          </h3>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>
            Đã lưu minh chứng & cập nhật đơn #{deliveredOrder?.orderId || deliveredOrder?.id}
          </p>
        </div>

        {/* Thẻ gợi ý đơn tiếp theo theo lộ trình */}
        <div style={{ padding: '1.15rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '0.6rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', fontWeight: 800, color: '#2563eb' }}>
              <Sparkles size={14} />
              <span>ĐƠN TIẾP THEO THEO LỘ TRÌNH</span>
            </div>
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
              borderRadius: '999px', backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563eb'
            }}>
              Còn {remainingCount} đơn
            </span>
          </div>

          <div style={{
            padding: '0.85rem',
            borderRadius: 'var(--radius-md, 12px)',
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
            border: '1.5px solid var(--border-glass, #e2e8f0)',
            display: 'flex', flexDirection: 'column', gap: '0.45rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary, #0f172a)' }}>
                #{nextId} · {custName}
              </strong>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: cod > 0 ? '#ea580c' : '#16a34a' }}>
                {cod > 0 ? `${cod.toLocaleString('vi-VN')} ₫` : 'Đã thanh toán'}
              </span>
            </div>

            {phone && (
              <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Phone size={12} /> {phone}
              </div>
            )}

            <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '0.35rem', lineHeight: 1.3 }}>
              <MapPin size={13} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
              <span>{address}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '1.15rem' }}>
            <button
              type="button"
              onClick={onContinue}
              style={{
                width: '100%', padding: '0.8rem',
                borderRadius: 'var(--radius-md, 12px)',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#ffffff', border: 'none',
                fontWeight: 800, fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)'
              }}
            >
              <span>🚀 Tiếp Tục Giao Đơn #{nextId}</span>
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              onClick={onBackToList}
              style={{
                width: '100%', padding: '0.65rem',
                borderRadius: 'var(--radius-md, 12px)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #64748b)',
                border: '1px solid var(--border-glass, #cbd5e1)',
                fontWeight: 700, fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem'
              }}
            >
              <ArrowLeft size={14} />
              <span>Về danh sách đơn (Giao tự do)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
