import React from 'react';
import { X, Package, User, Phone, MapPin, CreditCard, Calendar, Tag, ShieldCheck, Mail } from 'lucide-react';
import { ORDER_STATUS, getStatusInfo } from '../utils/statusLabels';

export default function OrderDetailModal({ order, onClose }) {
  if (!order) return null;

  const statusInfo = getStatusInfo(ORDER_STATUS, order.status);

  const fmt = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0 đ';
    return Number(amount).toLocaleString('vi-VN') + ' đ';
  };

  const items = order.items && Array.isArray(order.items) ? order.items : [];

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e2e8f0',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '3px solid #6366f1',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Left Title Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0, paddingRight: '1rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(79, 70, 229, 0.4) 100%)',
              border: '1px solid rgba(129, 140, 248, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a5b4fc',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              flexShrink: 0
            }}>
              <Package size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Chi Tiết Đơn Hàng #{order.orderId}
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                <Calendar size={13} style={{ color: '#818cf8', flexShrink: 0 }} /> 
                Ngày đặt: <strong style={{ color: '#f8fafc' }}>{order.date || new Date(order.createdAt).toLocaleDateString('vi-VN')}</strong>
                <span style={{ margin: '0 0.3rem', color: '#64748b' }}>•</span>
                <span style={{ color: '#a5b4fc', fontSize: '0.78rem', fontWeight: 600 }}>Kênh: {order.type || 'ONLINE'}</span>
              </p>
            </div>
          </div>

          {/* Right Status & Close Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto', flexShrink: 0 }}>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              padding: '0.45rem 1rem',
              borderRadius: '20px',
              color: statusInfo.color,
              backgroundColor: statusInfo.bg,
              border: `1.5px solid ${statusInfo.border}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              whiteSpace: 'nowrap'
            }}>
              {statusInfo.label}
            </span>

            <button 
              onClick={onClose}
              title="Đóng chi tiết"
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                cursor: 'pointer',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.8)'; e.currentTarget.style.borderColor = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: '#f8fafc' }}>
          
          {/* Info Summary Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1.25rem'
          }}>
            {/* Customer Info Card */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '1.25rem',
              boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justify: 'center' }}>
                  <User size={15} />
                </div>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Thông Tin Khách Hàng
                </h4>
              </div>

              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ flex: '0 0 95px', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Họ và tên:</span>
                  <strong style={{ flex: 1, color: '#0f172a', fontWeight: 700 }}>{order.customerName || 'Khách hàng'}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ flex: '0 0 95px', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Số điện thoại:</span>
                  <strong style={{ flex: 1, color: '#0f172a', fontWeight: 700 }}>{order.phone || order.customerPhone || 'Chưa cung cấp'}</strong>
                </div>

                {order.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ flex: '0 0 95px', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Email:</span>
                    <span style={{ color: '#2563eb', fontWeight: 700, backgroundColor: '#eff6ff', border: '1px solid #dbeafe', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                      {order.email}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', paddingTop: '0.1rem' }}>
                  <span style={{ flex: '0 0 95px', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Địa chỉ giao:</span>
                  <span style={{ flex: 1, color: '#0f172a', fontWeight: 600, wordBreak: 'break-word', lineHeight: '1.4' }}>
                    {order.shippingAddress || order.address || 'Nhận tại cửa hàng (POS)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Summary Card */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '1.25rem',
              boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#ecfdf5', color: '#16a34a', display: 'flex', alignItems: 'center', justify: 'center' }}>
                  <CreditCard size={15} />
                </div>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Thanh Toán & Giá Trị
                </h4>
              </div>

              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ flex: '0 0 100px', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Thanh toán:</span>
                  <strong style={{ flex: 1, color: '#0f172a', fontWeight: 700, lineHeight: '1.4' }}>
                    {order.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản Ngân hàng' : order.paymentMethod === 'ONLINE_GATEWAY' ? 'Cổng thanh toán Online' : 'COD (Tiền mặt khi nhận)'}
                  </strong>
                </div>

                {(() => {
                  const itemsSubtotal = (items || []).reduce((sum, i) => sum + (Number(i.price || i.unitPrice || 0) * Number(i.quantity || 1)), 0);
                  const effectiveSubtotal = order.subtotal || (itemsSubtotal > 0 ? itemsSubtotal : order.totalAmount);
                  const calculatedFee = order.totalAmount > effectiveSubtotal ? order.totalAmount - effectiveSubtotal : 0;
                  const effectiveShippingFee = order.shippingFee !== undefined ? order.shippingFee : calculatedFee;

                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ flex: '0 0 120px', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Tạm tính linh kiện:</span>
                        <span style={{ flex: 1, textAlign: 'right', fontWeight: 700, color: '#334155' }}>{fmt(effectiveSubtotal)}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ flex: '0 0 120px', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Phí giao hàng:</span>
                        <span style={{ flex: 1, textAlign: 'right', fontWeight: 700, color: effectiveShippingFee > 0 ? '#0f172a' : '#16a34a' }}>
                          {effectiveShippingFee > 0 ? `+${fmt(effectiveShippingFee)}` : 'MIỄN PHÍ'}
                        </span>
                      </div>
                    </>
                  );
                })()}

                {/* Total Box */}
                <div style={{ 
                  display: 'flex', 
                  justify: 'space-between', 
                  alignItems: 'center',
                  backgroundColor: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  marginTop: '0.4rem'
                }}>
                  <span style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.85rem', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>TỔNG THANH TOÁN:</span>
                  <strong style={{ fontSize: '1.25rem', color: '#dc2626', fontWeight: 900, letterSpacing: '-0.3px', marginLeft: '0.75rem' }}>{fmt(order.totalAmount)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery & POD Proof Card (Hiển thị khi đơn đã giao hoặc có minh chứng POD) */}
          {(order.status === 'DELIVERED' || order.proofPhoto || order.actualPaymentMethod) && (
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: '14px',
              padding: '1.25rem',
              boxShadow: '0 2px 6px rgba(22,163,74,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #bbf7d0', paddingBottom: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justify: 'center' }}>
                    <ShieldCheck size={16} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Biên Bản Giao Hàng & Minh Chứng Ký Nhận Thực Tế (POD)
                  </h4>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', border: '1px solid #86efac' }}>
                  ĐÃ GIAO THÀNH CÔNG
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#475569', display: 'block', marginBottom: '0.15rem' }}>Người nhận thực tế:</span>
                  <strong style={{ color: '#0f172a' }}>
                    {order.receivedByType === 'REPRESENTATIVE'
                      ? `${order.receiverNameActual || 'Người nhận thay'} (Nhận thay khách hàng)`
                      : `${order.customerName || 'Khách hàng'} (Chính chủ nhận)`}
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#475569', display: 'block', marginBottom: '0.15rem' }}>Hình thức thanh toán thực tế:</span>
                  <strong style={{ color: order.actualPaymentMethod === 'BANK_TRANSFER' ? '#2563eb' : '#16a34a' }}>
                    {order.actualPaymentMethod === 'BANK_TRANSFER'
                      ? `Chuyển khoản VietQR ${order.bankRefCode ? `(Mã GD: ${order.bankRefCode})` : ''}`
                      : (order.actualPaymentMethod === 'CASH' ? 'Tiền mặt khi giao (COD)' : 'Đã thanh toán Online trước')}
                  </strong>
                </div>

                {order.deliveredAt && (
                  <div>
                    <span style={{ color: '#475569', display: 'block', marginBottom: '0.15rem' }}>Thời điểm hoàn tất:</span>
                    <strong style={{ color: '#0f172a' }}>
                      {new Date(order.deliveredAt).toLocaleString('vi-VN')}
                    </strong>
                  </div>
                )}

                {order.receiverNote && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: '#475569', display: 'block', marginBottom: '0.15rem' }}>Ghi chú ký nhận / đồng kiểm:</span>
                    <div style={{ backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0', color: '#1e293b', fontStyle: 'italic' }}>
                      "{order.receiverNote}"
                    </div>
                  </div>
                )}
              </div>

              {/* Photos Grid (POD Photo + Payment Proof Photo) */}
              {(order.proofPhoto || order.paymentProofPhoto) && (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.4rem', paddingTop: '0.6rem', borderTop: '1px dashed #bbf7d0' }}>
                  {order.proofPhoto && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#15803d' }}>Ảnh chụp ký nhận POD:</span>
                      <img
                        src={order.proofPhoto}
                        alt="Minh chứng POD"
                        style={{ width: '160px', height: '110px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid #86efac', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
                      />
                    </div>
                  )}

                  {order.paymentProofPhoto && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563eb' }}>Biên lai chuyển khoản:</span>
                      <img
                        src={order.paymentProofPhoto}
                        alt="Biên lai chuyển khoản"
                        style={{ width: '160px', height: '110px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid #93c5fd', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Item List Table */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.25rem',
            boxShadow: '0 2px 6px rgba(15,23,42,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justify: 'center' }}>
                  <Package size={15} />
                </div>
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Danh Sách Sản Phẩm Đặt Mua ({items.length})
                </h4>
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.73rem', letterSpacing: '0.6px' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Sản Phẩm</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '65px' }}>SL</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', width: '130px' }}>Đơn Giá</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', width: '140px' }}>Thành Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                        Không có dữ liệu chi tiết danh mục sản phẩm
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const qty = it.quantity || 1;
                      const price = it.price || 0;
                      const total = it.totalPrice || (price * qty);
                      return (
                        <tr 
                          key={idx} 
                          style={{ 
                            borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none', 
                            backgroundColor: '#ffffff',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                        >
                          <td style={{ padding: '0.85rem 1rem', color: '#0f172a' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', lineHeight: '1.4', color: '#0f172a' }}>
                              {it.name || it.productName || `Mã sản phẩm #${it.productId}`}
                            </div>
                            {it.sku && <span style={{ fontSize: '0.72rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', marginTop: '3px', display: 'inline-block' }}>SKU: {it.sku}</span>}
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center', fontWeight: 800, color: '#334155' }}>
                            <span style={{ backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>x{qty}</span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#475569', fontWeight: 600 }}>
                            {fmt(price)}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#2563eb', fontWeight: 800, fontSize: '0.9rem' }}>
                            {fmt(total)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justify: 'flex-end',
          alignItems: 'center'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.6rem 1.75rem',
              borderRadius: '10px',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4338ca'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4f46e5'; e.currentTarget.style.transform = 'none'; }}
          >
            Đóng Chi Tiết
          </button>
        </div>
      </div>
    </div>
  );
}
