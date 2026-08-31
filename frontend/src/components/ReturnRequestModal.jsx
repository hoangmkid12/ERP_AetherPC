import React, { useState, useEffect } from 'react';
import { X, RefreshCw, DollarSign, Camera, AlertTriangle, Building, CreditCard, User, Upload } from 'lucide-react';
import { useSalesStore } from '../stores';

export default function ReturnRequestModal({ show, onClose, order }) {
  const addReturnRequest = useSalesStore(state => state.addReturnRequest);
  
  const [returnType, setReturnType] = useState('REFUND'); // 'REFUND' or 'EXCHANGE'
  const [reason, setReason] = useState('Lỗi do Nhà sản xuất');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [bankName, setBankName] = useState('MB Bank');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (show && order) {
      setReturnType('REFUND');
      setReason('Lỗi do Nhà sản xuất');
      setDescription('');
      setEvidenceUrl('');
      setBankName('MB Bank');
      setBankAccountNo('');
      setBankAccountName((order.customerName || '').toUpperCase());
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [show, order]);

  if (!show || !order) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setEvidenceUrl(uploadEvent.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Vui lòng nhập chi tiết tình trạng hàng hóa.');
      return;
    }
    if (returnType === 'REFUND' && (!bankAccountNo.trim() || !bankAccountName.trim())) {
      setErrorMsg('Vui lòng nhập đầy đủ Số tài khoản & Tên chủ tài khoản để Kế toán hoàn tiền.');
      return;
    }

    setIsSubmitting(true);
    
    const reqData = {
      orderId: order.orderId || order.id,
      customerName: order.customerName,
      customerEmail: order.email || order.customerEmail || 'Khách hàng',
      phone: order.phone || '',
      address: order.shippingAddress || '',
      reason,
      description,
      evidenceUrl,
      type: returnType,
      refundAmount: parseFloat(order.totalAmount || order.total || 0),
      bankName: returnType === 'REFUND' ? bankName : '',
      bankAccountNo: returnType === 'REFUND' ? bankAccountNo : '',
      bankAccountName: returnType === 'REFUND' ? bankAccountName.toUpperCase() : '',
      totalAmount: order.totalAmount,
      items: order.items
    };

    try {
      await addReturnRequest(reqData);
      alert('Đã gửi Yêu cầu Hoàn trả / Hoàn tiền thành công! Shipper và CSKH sẽ liên hệ thu hồi hàng.');
      setIsSubmitting(false);
      onClose(true);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi gửi yêu cầu đổi trả');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '640px',
        display: 'flex', flexDirection: 'column', maxHeight: '92vh', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
      }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
            <RefreshCw size={20} color="#2563eb" />
            Yêu Cầu Trả Hàng & Hoàn Tiền 100%
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          
          <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>Đơn hàng: #{order.orderId || order.id}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Khách hàng: {order.customerName} ({order.phone})</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Số tiền hoàn dự kiến:</div>
              <div style={{ fontWeight: 800, color: '#16a34a', fontSize: '1.05rem' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.totalAmount || order.total || 0)}</div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.45rem', color: '#334155', fontSize: '0.85rem' }}>Hình thức giải quyết *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem', border: `2px solid ${returnType === 'REFUND' ? '#16a34a' : '#cbd5e1'}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: returnType === 'REFUND' ? '#f0fdf4' : '#fff' }}>
                <input 
                  type="radio" name="returnType" value="REFUND" 
                  checked={returnType === 'REFUND'} onChange={() => setReturnType('REFUND')} 
                  style={{ width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontWeight: 800, color: '#15803d', fontSize: '0.85rem' }}>Trả hàng & Hoàn tiền 100%</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Kế toán chuyển khoản hoàn đủ tiền cho bạn.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem', border: `2px solid ${returnType === 'EXCHANGE' ? '#2563eb' : '#cbd5e1'}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: returnType === 'EXCHANGE' ? '#eff6ff' : '#fff' }}>
                <input 
                  type="radio" name="returnType" value="EXCHANGE" 
                  checked={returnType === 'EXCHANGE'} onChange={() => setReturnType('EXCHANGE')} 
                  style={{ width: '16px', height: '16px' }}
                />
                <div>
                  <div style={{ fontWeight: 800, color: '#1d4ed8', fontSize: '0.85rem' }}>Đổi sản phẩm mới</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Kho sẽ xuất linh kiện mới 100% đổi lại.</div>
                </div>
              </label>
            </div>
          </div>

          {/* Ngân hàng nhận tiền hoàn (Nếu chọn Hoàn tiền) */}
          {returnType === 'REFUND' && (
            <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1.5px solid #86efac', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CreditCard size={16} />
                <span>Thông Tin Tài Khoản Nhận Tiền Hoàn (Kế Toán Chi Trực Tiếp)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Ngân hàng *</label>
                  <select
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.82rem', backgroundColor: '#ffffff', fontWeight: 600 }}
                  >
                    <option value="MB Bank">MB Bank (Quân Đội)</option>
                    <option value="Vietcombank">Vietcombank</option>
                    <option value="Techcombank">Techcombank</option>
                    <option value="VietinBank">VietinBank</option>
                    <option value="BIDV">BIDV</option>
                    <option value="ACB">ACB</option>
                    <option value="VPBank">VPBank</option>
                    <option value="TPBank">TPBank</option>
                    <option value="Sacombank">Sacombank</option>
                    <option value="Agribank">Agribank</option>
                    <option value="MoMo">Ví MoMo</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Số tài khoản nhận *</label>
                  <input
                    type="text"
                    value={bankAccountNo}
                    onChange={e => setBankAccountNo(e.target.value)}
                    placeholder="VD: 0901234567..."
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.82rem', backgroundColor: '#ffffff', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>Tên chủ tài khoản (Không dấu) *</label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={e => setBankAccountName(e.target.value.toUpperCase())}
                  placeholder="VD: NGUYEN VAN A"
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '0.82rem', backgroundColor: '#ffffff', fontWeight: 700, boxSizing: 'border-box', textTransform: 'uppercase' }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem', color: '#334155', fontSize: '0.85rem' }}>Lý do hoàn trả *</label>
            <select 
              value={reason} onChange={e => setReason(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
            >
              <option value="Lỗi do Nhà sản xuất">Lỗi phần cứng do Nhà sản xuất (Không lên nguồn, lỗi chip, sập nguồn...)</option>
              <option value="Giao sai linh kiện / Sai mã">Giao sai model linh kiện so với đơn đặt</option>
              <option value="Thiếu phụ kiện / Móp hộp">Thiếu phụ kiện hoặc móp rách khi nhận</option>
              <option value="Hàng không đúng mô tả">Hàng không đúng thông số cam kết</option>
              <option value="Khách đổi ý">Đổi ý không còn nhu cầu sử dụng (Hàng nguyên seal)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem', color: '#334155', fontSize: '0.85rem' }}>Mô tả chi tiết tình trạng *</label>
            <textarea 
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Vui lòng mô tả chi tiết lỗi phát sinh để Kỹ thuật viên QC thẩm định nhanh chóng..."
              rows={2}
              style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 700, marginBottom: '0.35rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
              <Camera size={15}/> Ảnh chụp sản phẩm lỗi / Video minh chứng
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="text" 
                value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)}
                placeholder="Dán link ảnh hoặc tải ảnh trực tiếp bên cạnh..."
                style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
              <label style={{ padding: '0.45rem 0.85rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Upload size={14} /> Tải Ảnh
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
            {evidenceUrl && (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img src={evidenceUrl} alt="Minh chứng lỗi" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>✓ Đã đính kèm ảnh minh chứng</span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700, border: '1px solid #fca5a5' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.55rem 1.25rem', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', color: '#475569' }}>
              Đóng
            </button>
            <button type="submit" disabled={isSubmitting} style={{ padding: '0.55rem 1.5rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 800, fontSize: '0.82rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? 'Đang gửi...' : '✓ Xác Nhận Gửi Yêu Cầu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
