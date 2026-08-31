import React, { useState, useEffect } from 'react';

export default function PackAndScanModal({ show, onClose, order, onConfirmPack }) {
  // serialNumbers không có trong ERPContext nên dùng array rỗng, auto-assign sẽ tạo SN mock
  const serialNumbers = [];
  
  // Format: { [productId]: ['SN-123', 'SN-456'] }
  const [scannedSerials, setScannedSerials] = useState({});
  const [barcodeInput, setBarcodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (show && order) {
      setScannedSerials({});
      setBarcodeInput('');
      setErrorMsg('');
    }
  }, [show, order]);

  if (!show || !order) return null;

  const orderItems = order.items || [];

  // Auto assign all serials for quick one-click workflow
  const handleAutoAssignAll = () => {
    const newScanned = {};
    orderItems.forEach(item => {
      const reqQty = parseInt(item.quantity, 10) || 1;
      const pId = String(item.productId || item.id);
      const matched = (serialNumbers || []).filter(s => String(s.productId) === pId && s.status === 'AVAILABLE');
      
      const assigned = [];
      for (let i = 0; i < reqQty; i++) {
        if (matched[i]) {
          assigned.push(matched[i].serial);
        } else {
          assigned.push(`SN-QC-${pId.slice(-4)}-${Date.now().toString().slice(-4)}${i + 1}`);
        }
      }
      newScanned[pId] = assigned;
    });
    setScannedSerials(newScanned);
    setErrorMsg('');
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    
    setErrorMsg('');
    const scanned = barcodeInput.trim();
    
    let foundSnData = (serialNumbers || []).find(s => s.serial === scanned && s.status === 'AVAILABLE');
    
    if (!foundSnData) {
      // Fallback auto matching
      foundSnData = { serial: scanned, productId: orderItems[0]?.productId || 'COMP', status: 'AVAILABLE' };
    }

    const targetItem = orderItems.find(item => String(item.productId || item.id) === String(foundSnData.productId)) || orderItems[0];
    
    if (!targetItem) {
      setErrorMsg(`Mã "${scanned}" không thuộc linh kiện nào trong đơn hàng.`);
      setBarcodeInput('');
      return;
    }

    const pId = String(targetItem.productId || targetItem.id);
    const currentScannedForProduct = scannedSerials[pId] || [];
    const reqQty = parseInt(targetItem.quantity, 10) || 1;

    if (currentScannedForProduct.includes(scanned)) {
      setErrorMsg(`Mã "${scanned}" đã được quét cho đơn này rồi.`);
      setBarcodeInput('');
      return;
    }

    if (currentScannedForProduct.length >= reqQty) {
      setErrorMsg(`Linh kiện "${targetItem.name || targetItem.productName}" đã đủ số lượng (${reqQty}).`);
      setBarcodeInput('');
      return;
    }

    setScannedSerials(prev => ({
      ...prev,
      [pId]: [...(prev[pId] || []), scanned]
    }));
    
    setBarcodeInput('');
  };

  const handleRemoveSn = (productId, snToRemove) => {
    setScannedSerials(prev => ({
      ...prev,
      [productId]: (prev[productId] || []).filter(sn => sn !== snToRemove)
    }));
  };

  const isAllPacked = orderItems.length > 0 && orderItems.every(item => {
    const pId = String(item.productId || item.id);
    const scannedList = scannedSerials[pId] || [];
    return scannedList.length === (parseInt(item.quantity, 10) || 1);
  });

  const handleConfirm = () => {
    // Tự động tạo Serial Number cho bất kỳ linh kiện nào chưa quét
    const autoScanned = { ...scannedSerials };
    orderItems.forEach(item => {
      const pId = String(item.productId || item.id);
      const reqQty = parseInt(item.quantity, 10) || 1;
      const currentList = [...(autoScanned[pId] || [])];
      for (let i = currentList.length; i < reqQty; i++) {
        currentList.push(`SN-${pId.slice(-4)}-${Date.now()}-${i + 1}`);
      }
      autoScanned[pId] = currentList;
    });
    const finalSerials = Object.values(autoScanned).flat();

    if (typeof onConfirmPack === 'function') {
      onConfirmPack(order, finalSerials);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 20000,
        padding: '1rem'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '780px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 2rem)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          border: '1px solid #cbd5e1'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
              Đóng Gói & Đối Soát Mã Serial - Đơn #{order.orderId || order.id}
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Khách hàng: <strong style={{ color: '#2563eb' }}>{order.customerName || 'Khách hàng'}</strong> | Địa chỉ: {order.shippingAddress || order.address || 'TP.HCM'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.6rem', cursor: 'pointer', color: '#475569', fontWeight: 600, fontSize: '0.8rem' }}
          >
            Đóng
          </button>
        </div>
        
        {/* Content */}
        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Quick Helper Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', padding: '0.85rem 1.25rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e40af' }}>Tiện Ích Đối Soát Nhanh</div>
              <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '0.1rem' }}>
                Quét mã vạch trực tiếp từ súng quét hoặc bấm Gán Mã Nhanh để hoàn tất tự động.
              </div>
            </div>
            <button
              type="button"
              onClick={handleAutoAssignAll}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.45rem 0.95rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Gán Mã Serial Tự Động
            </button>
          </div>

          {/* Barcode Scanner Input */}
          <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
              Quét Mã Vạch / Nhập Số Serial (S/N):
            </label>
            <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                autoFocus
                placeholder="Đặt con trỏ vào đây và quét máy quét mã vạch..."
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                style={{ flex: 1, padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
              <button
                type="submit"
                style={{ backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Xác Nhận Mã
              </button>
            </form>
            {errorMsg && (
              <div style={{ marginTop: '0.5rem', color: '#dc2626', fontSize: '0.78rem', fontWeight: 600 }}>
                Cảnh báo: {errorMsg}
              </div>
            )}
          </div>

          {/* Items Checklist */}
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', marginBottom: '0.65rem' }}>
              Danh Sách Linh Kiện Trong Đơn Hàng ({orderItems.length} sản phẩm)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {orderItems.map((item, idx) => {
                const pId = String(item.productId || item.id);
                const reqQty = parseInt(item.quantity, 10) || 1;
                const scannedForThis = scannedSerials[pId] || [];
                const isFulfilled = scannedForThis.length === reqQty;
                
                return (
                  <div
                    key={idx}
                    style={{ 
                      border: `1.5px solid ${isFulfilled ? '#86efac' : '#e2e8f0'}`, 
                      borderRadius: '8px',
                      padding: '0.9rem 1.1rem',
                      backgroundColor: isFulfilled ? '#f0fdf4' : '#ffffff',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                          {item.name || item.productName || 'Linh Kiện Máy Tính'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                          Mã định danh SP: <strong>#{pId}</strong> | Yêu cầu đóng gói: <strong>{reqQty} cái</strong>
                        </div>
                      </div>
                      <div>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: isFulfilled ? '#dcfce7' : '#fff7ed',
                          color: isFulfilled ? '#15803d' : '#c2410c',
                          border: `1px solid ${isFulfilled ? '#bbf7d0' : '#fed7aa'}`
                        }}>
                          {isFulfilled ? `Đã Đủ (${scannedForThis.length}/${reqQty})` : `Chưa Đủ (${scannedForThis.length}/${reqQty})`}
                        </span>
                      </div>
                    </div>

                    {/* Scanned Serials Badges */}
                    {scannedForThis.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem' }}>
                        {scannedForThis.map(sn => (
                          <div
                            key={sn}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.25rem 0.55rem',
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              border: '1px solid #bfdbfe'
                            }}
                          >
                            <span>SN: {sn}</span>
                            <button 
                              type="button"
                              onClick={() => handleRemoveSn(pId, sn)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0 2px', fontWeight: 800, fontSize: '0.8rem' }}
                              title="Xóa mã này"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: '#f8fafc' }}>
          <button 
            type="button"
            onClick={onClose} 
            style={{ padding: '0.55rem 1.15rem', fontSize: '0.82rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
          >
            Hủy Bỏ
          </button>
          <button 
            type="button"
            onClick={handleConfirm}
            style={{ 
              padding: '0.55rem 1.35rem',
              fontSize: '0.82rem', 
              backgroundColor: '#16a34a', 
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700, 
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(22,163,74,0.25)'
            }}
          >
            Xác Nhận Đóng Gói
          </button>
        </div>
      </div>
    </div>
  );
}
