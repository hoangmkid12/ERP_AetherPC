import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScanFace, Hand, Image as ImageIcon, Edit3, X, Save, RefreshCw, Search } from 'lucide-react';
import { api } from '../../../services/api';
import { notify } from '../../../context/NotificationContext';
import { getRoleName } from '../../../utils/rbacEngine';
import { ATTENDANCE_STATUS, getStatusInfo, getStatusLabel } from '../../../utils/statusLabels';
import { card, input, label, th, td, theadRow, btn, smallBtn, overlay, modal } from './hrUi';

const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

/** Chấm công theo ngày cho HR: xem giờ vào/ra từ máy chấm khuôn mặt, điều chỉnh thủ công, xem ảnh bằng chứng. */
export default function AttendancePanel({ employees, onChanged }) {
  const [date, setDate] = useState(todayIso());
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [photos, setPhotos] = useState(null);

  const month = date.slice(0, 7);
  const load = useCallback(() => {
    setLoading(true);
    api.get(`/hr/attendance?month=${month}`).then(r => setLogs(r.data || [])).catch(err => notify(err.message, 'error')).finally(() => setLoading(false));
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const active = employees.filter(e => e.status !== 'INACTIVE');
  const byEmp = useMemo(() => {
    const m = {};
    for (const l of logs) if (l.isoDate === date) m[l.employeeId] = l;
    return m;
  }, [logs, date]);

  const rows = active.filter(e => !q || `${e.fullname || e.fullName} ${e.department} ${e.employeeCode}`.toLowerCase().includes(q.toLowerCase()));
  const counts = active.reduce((c, e) => {
    const s = byEmp[e.id]?.status;
    if (s === 'PRESENT') c.present += 1; else if (s === 'LATE') c.late += 1; else if (s === 'ABSENT') c.absent += 1; else c.none += 1;
    if (byEmp[e.id]?.checkInMethod === 'FACE') c.face += 1;
    return c;
  }, { present: 0, late: 0, absent: 0, none: 0, face: 0 });

  const quickMark = async (empId, status) => {
    try {
      await api.post('/hr/attendance', { employeeId: empId, date, status });
      load();
      onChanged?.();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const openPhotos = async (log) => {
    try {
      const r = await api.get(`/hr/attendance/${log.id}/photos`);
      setPhotos({ ...r.data, log });
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const chip = (bg, color, text) => <span style={{ fontSize: '0.74rem', backgroundColor: bg, color, padding: '4px 9px', borderRadius: '6px', fontWeight: 700 }}>{text}</span>;

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ ...label, margin: 0 }}>Ngày chấm công:</label>
          <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={{ ...input, width: 'auto' }} />
          <button type="button" onClick={load} style={btn('#ffffff', '#334155')}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Tải lại</button>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#94a3b8' }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm nhân viên..." style={{ ...input, width: 200, paddingLeft: '1.7rem' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {chip('#f0fdf4', '#16a34a', `Đúng giờ: ${counts.present}`)}
          {chip('#fffbeb', '#d97706', `Đi muộn: ${counts.late}`)}
          {chip('#fef2f2', '#dc2626', `Vắng: ${counts.absent}`)}
          {chip('#f1f5f9', '#64748b', `Chưa chấm: ${counts.none}`)}
          {chip('#eff6ff', '#2563eb', `Chấm bằng khuôn mặt: ${counts.face}`)}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead><tr style={theadRow}>
            <th style={th}>Nhân viên</th><th style={th}>Vào ca</th><th style={th}>Ra ca</th><th style={th}>Muộn/Sớm</th>
            <th style={th}>Giờ làm</th><th style={th}>Tăng ca</th><th style={th}>Trạng thái</th><th style={{ ...th, textAlign: 'center' }}>Thao tác</th>
          </tr></thead>
          <tbody>
            {rows.map(emp => {
              const l = byEmp[emp.id];
              const st = l ? getStatusInfo(ATTENDANCE_STATUS, l.status) : null;
              const MethodIcon = l?.checkInMethod === 'FACE' ? ScanFace : l ? Hand : null;
              return (
                <tr key={emp.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{emp.fullname || emp.fullName}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{emp.employeeCode} · {emp.jobTitle || getRoleName(emp.role)}{!emp.hasFace && <span style={{ color: '#d97706' }}> · chưa đăng ký khuôn mặt</span>}</div>
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }}>
                      {MethodIcon && <MethodIcon size={13} color={l.checkInMethod === 'FACE' ? '#2563eb' : '#94a3b8'} />}{l?.checkIn || '—'}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>{l?.checkOut || '—'}</td>
                  <td style={{ ...td, color: (l?.lateMinutes || l?.earlyLeaveMinutes) ? '#d97706' : '#94a3b8' }}>
                    {l ? `${l.lateMinutes || 0}′ / ${l.earlyLeaveMinutes || 0}′` : '—'}
                  </td>
                  <td style={td}>{l?.workHours ? `${l.workHours}h` : '—'}</td>
                  <td style={td}>{l?.overtimeHours ? `${l.overtimeHours}h` : '—'}</td>
                  <td style={td}>
                    {st ? <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: st.bg, color: st.color }}>{getStatusLabel(ATTENDANCE_STATUS, l.status)}</span>
                      : <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#64748b' }}>Chưa chấm</span>}
                    {l?.note && <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>{l.note}</div>}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setEditing({ emp, log: l })} style={smallBtn('#2563eb', '#bfdbfe')}><Edit3 size={12} /> Sửa giờ</button>
                      {!l && <button type="button" onClick={() => quickMark(emp.id, 'PRESENT')} style={smallBtn('#16a34a', '#bbf7d0')}>Có mặt</button>}
                      {l?.status !== 'ABSENT' && <button type="button" onClick={() => quickMark(emp.id, 'ABSENT')} style={smallBtn('#dc2626', '#fecaca')}>Vắng</button>}
                      {l?.hasPhoto && <button type="button" onClick={() => openPhotos(l)} style={smallBtn('#7c3aed', '#ddd6fe')}><ImageIcon size={12} /> Ảnh</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditAttendanceModal
          emp={editing.emp}
          log={editing.log}
          date={date}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); onChanged?.(); }}
        />
      )}

      {photos && (
        <div style={overlay} onClick={() => setPhotos(null)}>
          <div style={modal(640)} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Ảnh chấm công · {photos.fullName} · {photos.log.date}</h3>
              <button type="button" onClick={() => setPhotos(null)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center', fontSize: '0.76rem', color: '#475569' }}>
              {[['Khuôn mặt đã đăng ký', photos.registeredFace], [`Vào ca ${photos.log.checkIn || ''}`, photos.checkInPhoto], [`Ra ca ${photos.log.checkOut || ''}`, photos.checkOutPhoto]].map(([t, src]) => (
                <div key={t}>
                  {src ? <img src={src} alt={t} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    : <div style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Không có ảnh</div>}
                  <div style={{ marginTop: '0.3rem', fontWeight: 700 }}>{t}</div>
                </div>
              ))}
            </div>
            {photos.log.faceDistance != null && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.76rem', color: '#64748b' }}>
                Độ sai khác khuôn mặt lúc vào ca: <strong>{photos.log.faceDistance}</strong> (càng nhỏ càng giống; ngưỡng chấp nhận theo cấu hình).
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditAttendanceModal({ emp, log, date, onClose, onSaved }) {
  const [f, setF] = useState({
    checkIn: log?.checkIn || '08:00',
    checkOut: log?.checkOut || '',
    overtimeHours: log?.overtimeHours ?? '',
    status: log?.status === 'ABSENT' ? 'ABSENT' : 'AUTO',
    note: log?.note || ''
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.note.trim()) return notify('Vui lòng ghi lý do điều chỉnh để lưu vết.', 'error');
    setSaving(true);
    try {
      await api.post('/hr/attendance', {
        employeeId: emp.id,
        date,
        ...(f.status === 'ABSENT'
          ? { status: 'ABSENT' }
          : { checkIn: f.checkIn, checkOut: f.checkOut || null, ...(f.status === 'PRESENT' ? { status: 'PRESENT' } : {}), ...(f.overtimeHours !== '' ? { overtimeHours: f.overtimeHours } : {}) }),
        note: f.note
      });
      notify('Đã cập nhật chấm công.', 'success');
      onSaved();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal(460)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Điều chỉnh chấm công · {emp.fullname || emp.fullName}</h3>
          <button type="button" onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div>
            <label style={label}>Kết quả</label>
            <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))} style={input}>
              <option value="AUTO">Tính tự động theo giờ vào/ra (đúng giờ hoặc đi muộn)</option>
              <option value="PRESENT">Có mặt — miễn tính đi muộn (có lý do chính đáng)</option>
              <option value="ABSENT">Vắng mặt không phép</option>
            </select>
          </div>
          {f.status !== 'ABSENT' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
              <div><label style={label}>Giờ vào</label><input type="time" value={f.checkIn} onChange={e => setF(p => ({ ...p, checkIn: e.target.value }))} style={input} /></div>
              <div><label style={label}>Giờ ra</label><input type="time" value={f.checkOut} onChange={e => setF(p => ({ ...p, checkOut: e.target.value }))} style={input} /></div>
              <div><label style={label}>Tăng ca (giờ)</label><input type="number" step="0.5" min="0" placeholder="Tự tính" value={f.overtimeHours} onChange={e => setF(p => ({ ...p, overtimeHours: e.target.value }))} style={input} /></div>
            </div>
          )}
          <div><label style={label}>Lý do điều chỉnh *</label><textarea rows={2} value={f.note} onChange={e => setF(p => ({ ...p, note: e.target.value }))} style={{ ...input, resize: 'vertical' }} placeholder="Ví dụ: Quên chấm công, có xác nhận của trưởng bộ phận" /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={btn('#ffffff', '#475569')}>Hủy</button>
            <button type="button" onClick={save} disabled={saving} style={btn(saving ? '#9ca3af' : '#2563eb')}><Save size={15} /> Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}
