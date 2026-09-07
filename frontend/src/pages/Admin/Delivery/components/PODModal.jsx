import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, RefreshCw, CreditCard, ChevronLeft } from 'lucide-react';

// Proof-of-Delivery capture flow. Carries over the EXACT camera/watermark
// capture logic, VietQR bank-transfer branching and receiver-type handling
// from the old Delivery.jsx page — only the presentation changed to a
// full-screen two-step mobile flow (camera step -> confirm-details step)
// instead of a centered maxWidth:600px dialog.
export default function PODModal({ order: deliverModal, user, onClose, onConfirm, fmt }) {
  const videoRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const codAmount = parseFloat(deliverModal.totalAmount || deliverModal.total || 0);
  const isPrepaid = deliverModal.paymentStatus === 'PAID' || deliverModal.paymentMethod === 'ONLINE_GATEWAY' || deliverModal.paymentMethod === 'BANK_TRANSFER' || codAmount === 0;

  const [proofPhoto, setProofPhoto] = useState('');
  const [receiverNote, setReceiverNote] = useState('Khách đã đồng kiểm tem niêm phong và ký nhận đầy đủ.');
  const [actualPaymentMethod, setActualPaymentMethod] = useState(isPrepaid ? 'PREPAID' : 'CASH');
  const [bankRefCode, setBankRefCode] = useState('');
  const [paymentProofPhoto, setPaymentProofPhoto] = useState('');
  const [receivedByType, setReceivedByType] = useState('DIRECT_CUSTOMER');
  const [receiverNameActual, setReceiverNameActual] = useState(deliverModal.customerName || '');
  const [showVietQR, setShowVietQR] = useState(false);

  const startCamera = async () => {
    try {
      setCameraError('');
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setCameraError('Không thể mở Camera thực tế (Trình duyệt chưa cấp quyền máy ảnh hoặc không có webcam).');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    startCamera();
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const now = new Date();
      const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const ordIdStr = deliverModal.orderId || deliverModal.id;
      const shipperNameStr = user?.fullname || user?.name || 'Shipper';

      const stampText = `${timeStr} | ${dateStr} | Đơn: #${ordIdStr} | NV: ${shipperNameStr}`;
      ctx.font = 'bold 13px sans-serif';
      const textWidth = ctx.measureText(stampText).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(10, canvas.height - 38, textWidth + 20, 28, 4) : ctx.fillRect(10, canvas.height - 38, textWidth + 20, 28);
      ctx.fill();

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(stampText, 18, canvas.height - 19);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setProofPhoto(dataUrl);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setProofPhoto('');
    startCamera();
  };

  const cleanOrdCode = String(deliverModal.orderId || deliverModal.id || '').replace(/[^a-zA-Z0-9]/g, '');
  const qrUrl = `https://img.vietqr.io/image/970415-1133668899-compact2.jpg?amount=${Math.round(codAmount)}&addInfo=DH%20${cleanOrdCode}&accountName=AETHERPC%20ERP%20CORP`;

  const handleSubmit = () => {
    const payMethodFinal = isPrepaid ? 'PREPAID' : actualPaymentMethod;
    const receiverNameFinal = receivedByType === 'DIRECT_CUSTOMER' ? (deliverModal.customerName || 'Khách hàng') : (receiverNameActual || 'Người nhận thay');
    const bankRefFinal = payMethodFinal === 'BANK_TRANSFER' ? (bankRefCode || `VQR-${Date.now().toString().slice(-6)}`) : null;

    onConfirm({
      proofPhoto,
      receiverNote: receiverNote || 'Khách đã ký nhận nguyên vẹn',
      actualPaymentMethod: payMethodFinal,
      bankRefCode: bankRefFinal,
      paymentProofPhoto: payMethodFinal === 'BANK_TRANSFER' ? paymentProofPhoto : null,
      receivedByType,
      receiverNameActual: receiverNameFinal,
      deliveredAt: new Date().toISOString()
    });
  };

  const step = proofPhoto ? 'details' : 'camera';

  return (
    <div className="delivery-fullscreen-modal">
      <div className="delivery-fullscreen-modal-inner">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-glass)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {step === 'details' && (
              <button type="button" onClick={retakePhoto} className="delivery-icon-btn"><ChevronLeft size={18} /></button>
            )}
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Biên Bản Giao Hàng #{deliverModal.orderId || deliverModal.id}</strong>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{deliverModal.customerName} · {deliverModal.phone}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="delivery-icon-btn"><X size={18} /></button>
        </div>

        {step === 'camera' ? (
          <>
            {/* CAMERA STEP — full screen viewfinder */}
            <div style={{ flex: 1, position: 'relative', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: isCameraActive ? 'block' : 'none' }}
              />

              {isCameraActive && (
                <>
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '78%', height: '55%', border: '2px dashed rgba(37,99,235,0.7)', borderRadius: '8px' }} />
                  </div>
                  <div style={{
                    position: 'absolute', bottom: '90px', left: '10px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)', color: '#fff',
                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800,
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    border: '1px solid rgba(34, 197, 94, 0.6)'
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                    <span>{currentTime.toLocaleTimeString('vi-VN')} - {currentTime.toLocaleDateString('vi-VN')}</span>
                  </div>
                </>
              )}

              {!isCameraActive && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#cbd5e1' }}>
                  <Camera size={32} style={{ color: '#94a3b8', margin: '0 auto 0.5rem' }} />
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                    {cameraError || 'Đang kết nối Camera thiết bị...'}
                  </div>
                  <button
                    type="button"
                    onClick={startCamera}
                    style={{ marginTop: '0.6rem', padding: '0.4rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Thử Mở Lại Camera
                  </button>
                </div>
              )}
            </div>

            {/* Sticky capture button */}
            <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-glass)', flexShrink: 0 }}>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!isCameraActive}
                style={{
                  width: '100%', padding: '0.75rem', fontSize: '0.88rem', fontWeight: 800,
                  backgroundColor: isCameraActive ? 'var(--danger)' : '#94a3b8', color: '#fff',
                  border: 'none', borderRadius: 'var(--radius-md)', cursor: isCameraActive ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                <Camera size={18} /> Bấm Chụp Ảnh Minh Chứng
              </button>
            </div>
          </>
        ) : (
          <>
            {/* DETAILS STEP — scrollable confirm form */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.82rem' }}>

              {/* Captured photo preview */}
              <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <img src={proofPhoto} alt="POD Captured" style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
                <span style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: 'rgba(22,163,74,0.9)', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                  ẢNH HỢP LỆ (POD)
                </span>
                <button
                  type="button"
                  onClick={retakePhoto}
                  style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(15,23,42,0.75)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <RefreshCw size={13} /> Chụp Lại
                </button>
              </div>

              {/* 1. Payment Method & Collection Box */}
              {isPrepaid ? (
                <div style={{ padding: '0.75rem 0.9rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <CreditCard size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--primary)' }}>
                      Đã Thanh Toán 100% Online / Chuyển Khoản Trước
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      Tiền COD thu hộ: 0 đ. Chỉ cần kiểm tra người nhận.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '0.8rem 0.9rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(22,163,74,0.08)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--success)' }}>
                    Thu COD: {fmt(codAmount)}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => { setActualPaymentMethod('CASH'); setShowVietQR(false); }}
                      style={{
                        padding: '0.55rem 0.5rem', borderRadius: 'var(--radius-md)',
                        border: actualPaymentMethod === 'CASH' ? '2px solid var(--success)' : '1px solid var(--border-glass)',
                        backgroundColor: actualPaymentMethod === 'CASH' ? 'rgba(22,163,74,0.12)' : 'var(--bg-primary)',
                        color: actualPaymentMethod === 'CASH' ? 'var(--success)' : 'var(--text-secondary)',
                        fontWeight: 750, fontSize: '0.78rem', cursor: 'pointer'
                      }}
                    >
                      Tiền Mặt
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActualPaymentMethod('BANK_TRANSFER'); setShowVietQR(true); }}
                      style={{
                        padding: '0.55rem 0.5rem', borderRadius: 'var(--radius-md)',
                        border: actualPaymentMethod === 'BANK_TRANSFER' ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                        backgroundColor: actualPaymentMethod === 'BANK_TRANSFER' ? 'rgba(37,99,235,0.12)' : 'var(--bg-primary)',
                        color: actualPaymentMethod === 'BANK_TRANSFER' ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 750, fontSize: '0.78rem', cursor: 'pointer'
                      }}
                    >
                      Quét QR / CK
                    </button>
                  </div>

                  {actualPaymentMethod === 'CASH' && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--success)', fontWeight: 600 }}>
                      Xác nhận đã thu đủ {fmt(codAmount)} tiền mặt từ khách.
                    </div>
                  )}
                </div>
              )}

              {/* VietQR box */}
              {actualPaymentMethod === 'BANK_TRANSFER' && !isPrepaid && (
                <div style={{ padding: '0.9rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(37,99,235,0.08)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <strong style={{ color: 'var(--primary)', fontSize: '0.82rem' }}>Mã VietQR Thanh Toán Động (Napas247)</strong>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <img src={qrUrl} alt="VietQR Payment" style={{ width: '110px', height: 'auto', borderRadius: '6px', backgroundColor: '#fff', padding: '0.3rem', flexShrink: 0 }} />
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div>VietinBank — 1133668899</div>
                      <div>CTY TNHH AETHERPC ERP</div>
                      <div style={{ color: 'var(--danger)', fontWeight: 800 }}>{fmt(codAmount)}</div>
                      <div>ND: <code>DH {cleanOrdCode}</code></div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.2rem' }}>
                      Mã Giao Dịch Ngân Hàng:
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: MB992812..."
                      value={bankRefCode}
                      onChange={e => setBankRefCode(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', fontSize: '0.8rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.2rem' }}>
                      Biên Lai Chuyển Khoản (Nếu có):
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => setPaymentProofPhoto(reader.result);
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{ width: '100%', fontSize: '0.74rem', color: 'var(--text-secondary)' }}
                    />
                  </div>
                </div>
              )}

              {/* 2. Recipient Verification */}
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                <label style={{ display: 'block', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                  Người Nhận Hàng Thực Tế:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <input type="radio" name="receivedByType" checked={receivedByType === 'DIRECT_CUSTOMER'} onChange={() => setReceivedByType('DIRECT_CUSTOMER')} />
                    <span>Khách chính chủ nhận</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <input type="radio" name="receivedByType" checked={receivedByType === 'REPRESENTATIVE'} onChange={() => setReceivedByType('REPRESENTATIVE')} />
                    <span>Nhận thay (Người thân / Bảo vệ)</span>
                  </label>
                </div>

                {receivedByType === 'REPRESENTATIVE' && (
                  <input
                    type="text"
                    placeholder="Họ tên & quan hệ người nhận thay..."
                    value={receiverNameActual}
                    onChange={e => setReceiverNameActual(e.target.value)}
                    style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--primary)', fontSize: '0.8rem', boxSizing: 'border-box' }}
                  />
                )}
              </div>

              {/* 3. Receiver note */}
              <div>
                <label style={{ display: 'block', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
                  Ghi Chú Ký Nhận:
                </label>
                <input
                  type="text"
                  value={receiverNote}
                  onChange={e => setReceiverNote(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', boxSizing: 'border-box', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            {/* Sticky submit */}
            <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-glass)', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleSubmit}
                style={{ width: '100%', backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
              >
                {isPrepaid ? 'Xác Nhận Bàn Giao Hàng' : (actualPaymentMethod === 'BANK_TRANSFER' ? 'Xác Nhận Đã Nhận CK' : 'Xác Nhận Thu Tiền & Giao')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
