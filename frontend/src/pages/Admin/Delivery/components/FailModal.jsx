import React, { useState } from 'react';
import { X, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { buildFailPayload } from '../deliveryHelpers';

export default function FailModal({ order: failModal, onClose, onConfirm }) {
  const [failReason, setFailReason] = useState('');
  const [failNote, setFailNote] = useState('');

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const [appointDateType, setAppointDateType] = useState('TODAY'); // 'TODAY' | 'TOMORROW' | 'CUSTOM'
  const [customDate, setCustomDate] = useState(tomorrowStr);
  const [appointTimeSlot, setAppointTimeSlot] = useState('13:30 - 15:30');
  const [exactTime, setExactTime] = useState('14:30');

  const attemptCount = (failModal.deliveryAttempts || 0) + 1;
  const isMaxAttempt = attemptCount >= 3;

  const isRescheduleReason = failReason.toLowerCase().includes('hẹn') || failReason.toLowerCase().includes('ngày khác');

  const handleSubmit = () => {
    if (!failReason) return;

    let finalNote = failNote;
    let extraData = {};

    if (isRescheduleReason) {
      const selectedDate = appointDateType === 'TODAY' ? todayStr : (appointDateType === 'TOMORROW' ? tomorrowStr : customDate);
      const selectedTime = appointTimeSlot === 'EXACT' ? exactTime : appointTimeSlot;
      const tag = `[HEN:${selectedDate}_${selectedTime}]`;
      finalNote = `${tag} ${failNote}`.trim();
      extraData = {
        appointmentDate: selectedDate,
        appointmentTimeWindow: selectedTime
      };
    }

    onConfirm(buildFailPayload(failModal, failReason, finalNote, extraData));
  };

  return (
    <div className="delivery-filter-sheet-overlay" onClick={onClose}>
      <div
        className="delivery-filter-sheet"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="delivery-sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--danger)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={18} /> Báo Sự Cố #{failModal.orderId || failModal.id}
            </h3>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{failModal.customerName} · {failModal.phone}</span>
          </div>
          <button type="button" onClick={onClose} className="delivery-icon-btn"><X size={16} /></button>
        </div>

        <div style={{
          padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '0.9rem',
          backgroundColor: isMaxAttempt ? 'rgba(220,38,38,0.1)' : 'rgba(217,119,6,0.1)',
        }}>
          <div style={{ fontWeight: 800, fontSize: '0.8rem', color: isMaxAttempt ? 'var(--danger)' : 'var(--warning)' }}>
            Giao Thất Bại Lần {attemptCount} / 3
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            {isMaxAttempt
              ? 'Đơn đã thất bại 3 lần. Hệ thống sẽ tự động CHUYỂN HOÀN VỀ KHO.'
              : 'Quy chuẩn cho phép giao tối đa 3 lần trước khi hoàn kho.'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.82rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Lý Do Không Giao Được *
            </label>
            <select
              value={failReason}
              onChange={e => setFailReason(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-glass)', fontSize: '0.82rem', fontWeight: 600, boxSizing: 'border-box' }}
            >
              <option value="">-- Chọn lý do cụ thể --</option>
              <option value="Khách hẹn giao lại ngày khác (Bận việc / Đi vắng)">Khách hẹn giao lại ngày khác</option>
              <option value="Không liên lạc được (Gọi 3 cuộc không nghe máy / Thuê bao)">Không liên lạc được (3 cuộc)</option>
              <option value="Khách từ chối nhận hàng (Bom hàng / Không còn nhu cầu)">Khách từ chối nhận hàng</option>
              <option value="Sai địa chỉ nhận hàng / Không tìm thấy số nhà">Sai địa chỉ nhận hàng</option>
              <option value="Kiện hàng bị móp méo / Hư hỏng do vận chuyển">Kiện hàng bị hư hỏng</option>
            </select>
          </div>

          {/* Form Hẹn Lại Giờ Cụ Thể (Hiện khi khách hẹn) */}
          {isRescheduleReason && (
            <div style={{
              backgroundColor: 'rgba(124, 58, 237, 0.06)',
              border: '1.5px solid rgba(124, 58, 237, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#7c3aed', fontWeight: 800, fontSize: '0.8rem' }}>
                <Clock size={15} />
                Lịch Hẹn Giao Cụ Thể Của Khách
              </div>

              {/* Chọn Ngày */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  <Calendar size={12} style={{ display: 'inline', marginRight: '3px' }} />
                  Ngày hẹn giao lại
                </label>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'TODAY', label: 'Hôm Nay' },
                    { id: 'TOMORROW', label: 'Ngày Mai' },
                    { id: 'CUSTOM', label: 'Ngày Khác...' }
                  ].map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setAppointDateType(d.id)}
                      style={{
                        padding: '0.3rem 0.65rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                        border: appointDateType === d.id ? '1.5px solid #7c3aed' : '1px solid var(--border-glass)',
                        backgroundColor: appointDateType === d.id ? '#7c3aed' : 'var(--bg-primary)',
                        color: appointDateType === d.id ? '#fff' : 'var(--text-secondary)'
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {appointDateType === 'CUSTOM' && (
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    min={todayStr}
                    style={{ marginTop: '0.4rem', width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', fontSize: '0.78rem', boxSizing: 'border-box' }}
                  />
                )}
              </div>

              {/* Chọn Khung Giờ */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  <Clock size={12} style={{ display: 'inline', marginRight: '3px' }} />
                  Khung giờ hẹn giao
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
                  {[
                    { label: 'Sáng (08:30 - 11:30)', value: '08:30 - 11:30' },
                    { label: 'Đầu chiều (13:30 - 15:30)', value: '13:30 - 15:30' },
                    { label: 'Cuối chiều (15:30 - 18:00)', value: '15:30 - 18:00' },
                    { label: 'Tối (18:00 - 20:30)', value: '18:00 - 20:30' },
                    { label: 'Cả ngày (Giờ tự do)', value: 'Cả ngày' },
                    { label: 'Giờ cụ thể...', value: 'EXACT' }
                  ].map(slot => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setAppointTimeSlot(slot.value)}
                      style={{
                        padding: '0.4rem 0.45rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center',
                        border: appointTimeSlot === slot.value ? '1.5px solid #7c3aed' : '1px solid var(--border-glass)',
                        backgroundColor: appointTimeSlot === slot.value ? 'rgba(124,58,237,0.12)' : 'var(--bg-primary)',
                        color: appointTimeSlot === slot.value ? '#7c3aed' : 'var(--text-secondary)'
                      }}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
                {appointTimeSlot === 'EXACT' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Khách hẹn lúc:</span>
                    <input
                      type="time"
                      value={exactTime}
                      onChange={e => setExactTime(e.target.value)}
                      style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid #7c3aed', fontSize: '0.82rem', fontWeight: 700 }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Ghi Chú Chi Tiết:
            </label>
            <textarea
              rows={2}
              placeholder="Ví dụ: Khách bảo đi công tác về sau 17h, gọi trước khi đến..."
              value={failNote}
              onChange={e => setFailNote(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', boxSizing: 'border-box', fontSize: '0.82rem' }}
            />
          </div>

          <button
            type="button"
            className="delivery-tap-target"
            onClick={handleSubmit}
            disabled={!failReason}
            style={{
              width: '100%', backgroundColor: failReason ? 'var(--danger)' : '#94a3b8', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '0.85rem',
              fontWeight: 800, cursor: failReason ? 'pointer' : 'not-allowed'
            }}
          >
            Xác Nhận Báo Lỗi & Lưu Lịch Hẹn
          </button>
        </div>
      </div>
    </div>
  );
}
