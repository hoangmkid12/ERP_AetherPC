import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, RefreshCw, Undo2, ChevronLeft } from 'lucide-react';

// Photo-proof capture flow for a Shipper handing a package back to the
// warehouse (RETURNING_TO_WAREHOUSE). Mirrors PODModal's camera/watermark
// capture step so Thủ Kho/QC can visually verify the package condition on
// arrival, the same way customers get visual proof of delivery.
export default function ReturnProofModal({ order: ord, onClose, onConfirm }) {
  const videoRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [proofPhoto, setProofPhoto] = useState('');
  const [returnNote, setReturnNote] = useState('');

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
      stream.getTracks().forEach(track => track.stop());
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
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const ordIdStr = ord.orderId || ord.id;

    const stampText = `HOÀN KHO | ${timeStr} | ${dateStr} | Đơn: #${ordIdStr}`;
    ctx.font = 'bold 13px sans-serif';
    const textWidth = ctx.measureText(stampText).width;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(10, canvas.height - 38, textWidth + 20, 28, 4) : ctx.fillRect(10, canvas.height - 38, textWidth + 20, 28);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(stampText, 18, canvas.height - 19);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setProofPhoto(dataUrl);
    stopCamera();
  };

  const retakePhoto = () => {
    setProofPhoto('');
    startCamera();
  };

  const handleSubmit = () => {
    onConfirm({
      returnProofPhoto: proofPhoto,
      returnNote: returnNote.trim(),
      returnedAt: new Date().toISOString()
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
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Hoàn Kho #{ord.orderId || ord.id}</strong>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chụp ảnh minh chứng kiện hàng trước khi bàn giao kho</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="delivery-icon-btn"><X size={18} /></button>
        </div>

        {step === 'camera' ? (
          <>
            {/* CAMERA STEP */}
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
                    <div style={{ width: '78%', height: '55%', border: '2px dashed rgba(245,158,11,0.8)', borderRadius: '8px' }} />
                  </div>
                  <div style={{
                    position: 'absolute', bottom: '90px', left: '10px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)', color: '#fff',
                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800,
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    border: '1px solid rgba(245, 158, 11, 0.6)'
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
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

            <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-glass)', flexShrink: 0 }}>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!isCameraActive}
                style={{
                  width: '100%', padding: '0.75rem', fontSize: '0.88rem', fontWeight: 800,
                  backgroundColor: isCameraActive ? 'var(--warning)' : '#94a3b8', color: '#fff',
                  border: 'none', borderRadius: 'var(--radius-md)', cursor: isCameraActive ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                <Camera size={18} /> Bấm Chụp Ảnh Kiện Hàng
              </button>
              <button
                type="button"
                onClick={() => onConfirm({ returnProofPhoto: '', returnNote: returnNote.trim(), returnedAt: new Date().toISOString() })}
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.55rem', fontSize: '0.76rem', fontWeight: 700, backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
              >
                Bỏ Qua Chụp Ảnh, Hoàn Kho Ngay
              </button>
            </div>
          </>
        ) : (
          <>
            {/* DETAILS STEP */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.82rem' }}>
              <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <img src={proofPhoto} alt="Return Proof" style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
                <span style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: 'rgba(217,119,6,0.9)', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                  ẢNH HOÀN KHO
                </span>
                <button
                  type="button"
                  onClick={retakePhoto}
                  style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(15,23,42,0.75)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.35rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <RefreshCw size={13} /> Chụp Lại
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
                  Ghi Chú Tình Trạng Kiện Hàng:
                </label>
                <textarea
                  rows={3}
                  placeholder="Ví dụ: Hộp nguyên vẹn, khách từ chối nhận không rõ lý do..."
                  value={returnNote}
                  onChange={e => setReturnNote(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', boxSizing: 'border-box', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-glass)', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleSubmit}
                style={{ width: '100%', backgroundColor: 'var(--warning)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Undo2 size={16} /> Xác Nhận Hoàn Kho
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
