import React, { useEffect, useState } from 'react';
import { X, ScanFace, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import { notify, confirm } from '../../../context/NotificationContext';
import FaceCamera from '../../../components/HR/FaceCamera';
import { btn, overlay, modal } from './hrUi';

/** HR xem ảnh khuôn mặt đã đăng ký, xóa để nhân viên đăng ký lại, hoặc đăng ký hộ tại quầy. */
export default function FaceAdminModal({ employee, onClose, onChanged }) {
  const [face, setFace] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const name = employee.fullName || employee.fullname;

  const load = () => api.get(`/hr/employees/${employee.id}/face`).then(r => setFace(r.data)).catch(() => setFace({}));
  useEffect(() => { load(); }, [employee.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = async () => {
    if (!(await confirm(`Xóa dữ liệu khuôn mặt của ${name}? Nhân viên sẽ phải đăng ký lại trước khi chấm công.`))) return;
    try {
      const res = await api.delete(`/hr/employees/${employee.id}/face`);
      notify(res.message, 'success');
      onChanged();
      load();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div style={overlay}>
      <div style={modal(480)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Khuôn mặt chấm công · {name}</h3>
          <button type="button" onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {capturing ? (
          <FaceCamera
            mode="register"
            compact
            submitLabel="Đăng ký lại"
            onCapture={async ({ descriptor, image }) => {
              const res = await api.post(`/hr/employees/${employee.id}/face`, { descriptor, image });
              notify(res.message, 'success');
              onChanged();
              load();
              return { message: res.message, image };
            }}
          />
        ) : face?.faceRegisteredAt ? (
          <div style={{ textAlign: 'center' }}>
            {face.faceImage
              ? <img src={face.faceImage} alt="" style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: '50%', border: '4px solid #bbf7d0' }} />
              : <ScanFace size={96} color="#16a34a" />}
            <div style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 700, marginTop: '0.5rem' }}>
              Đã đăng ký lúc {new Date(face.faceRegisteredAt).toLocaleString('vi-VN')}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.84rem', padding: '1.5rem 0' }}>
            <ScanFace size={64} color="#94a3b8" />
            <div style={{ marginTop: '0.5rem' }}>Nhân viên chưa đăng ký khuôn mặt. Nhân viên có thể tự đăng ký tại mục Thông Tin Cá Nhân, hoặc HR đăng ký hộ bằng camera của máy này.</div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.1rem', flexWrap: 'wrap' }}>
          {face?.faceRegisteredAt && !capturing && (
            <button type="button" onClick={reset} style={btn('#ffffff', '#dc2626', { border: '1px solid #fecaca' })}><Trash2 size={15} /> Xóa để đăng ký lại</button>
          )}
          {!capturing && (
            <button type="button" onClick={() => setCapturing(true)} style={btn('#2563eb')}><ScanFace size={15} /> {face?.faceRegisteredAt ? 'Đăng ký lại bằng camera' : 'Đăng ký hộ bằng camera'}</button>
          )}
          <button type="button" onClick={onClose} style={btn('#ffffff', '#475569')}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
