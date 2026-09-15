import React from 'react';

// Mốc tiến trình giao hàng kiểu Shopee — dùng ở trang admin Delivery và trang
// theo dõi đơn công khai (/track/:orderId). Đây là bản rút gọn của stepper
// trong MyOrders.jsx (chỉ luồng giao hàng chuẩn, không xử lý các nhánh
// đổi/trả hàng vốn chỉ liên quan tới trải nghiệm "Đơn Mua Của Tôi").
export default function DeliveryProgressStepper({ status }) {
  if (status === 'CANCELLED') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '0.75rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>✓</div>
          <span>Đặt hàng</span>
        </div>
        <div style={{ width: '80px', height: '2px', backgroundColor: '#ef4444' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.15)', border: '1.5px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>✕</div>
          <strong style={{ fontSize: '0.85rem' }}>Đã hủy đơn</strong>
        </div>
      </div>
    );
  }

  const steps = [
    'Đã đặt hàng',
    status === 'PENDING' ? 'Chờ xác nhận' : 'Đã xác nhận',
    'Chuẩn bị hàng',
    'Đang giao hàng',
    'Đã giao'
  ];

  let activeIdx = 1;
  if (status === 'PENDING' || status === 'WAITING_PAYMENT') {
    activeIdx = 1;
  } else if (['CONFIRMED', 'PROCESSING', 'PACKED', 'READY_TO_SHIP', 'AWAITING_STOCK'].includes(status)) {
    activeIdx = 2;
  } else if (['SHIPPED', 'OUT_FOR_DELIVERY', 'SHIPPING_FAILED'].includes(status)) {
    activeIdx = 3;
  } else if (['DELIVERED', 'COMPLETED'].includes(status)) {
    activeIdx = 4;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', width: '100%', padding: '0.5rem 0' }}>
      {steps.map((stepName, idx) => {
        const isDone = idx < activeIdx || (idx === activeIdx && ['DELIVERED', 'COMPLETED'].includes(status));
        const isActive = idx === activeIdx && !isDone;
        const isLineActive = idx <= activeIdx;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <div style={{
                flex: 1,
                height: '2.5px',
                backgroundColor: isLineActive ? '#2563eb' : '#e2e8f0',
                margin: '0 0.25rem',
                marginBottom: '1.25rem',
                transition: 'all 0.3s ease'
              }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '55px' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: isDone ? '#2563eb' : isActive ? '#eff6ff' : '#f8fafc',
                border: isActive ? '2px solid #2563eb' : isDone ? '2px solid #2563eb' : '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDone ? '#ffffff' : isActive ? '#2563eb' : '#64748b',
                fontSize: '0.75rem',
                fontWeight: 800,
                boxShadow: isActive ? '0 0 10px rgba(37,99,235,0.3)' : 'none',
                transition: 'all 0.3s ease'
              }}>
                {isDone ? '✓' : idx + 1}
              </div>
              <span style={{
                fontSize: '0.7rem',
                color: isDone || isActive ? '#0f172a' : '#64748b',
                marginTop: '0.4rem',
                textAlign: 'center',
                fontWeight: isActive || isDone ? 750 : 500,
                whiteSpace: 'nowrap'
              }}>
                {stepName}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
