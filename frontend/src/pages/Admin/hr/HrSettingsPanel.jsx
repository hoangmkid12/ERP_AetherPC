import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Clock, Wallet, CalendarDays, Scale } from 'lucide-react';
import { api } from '../../../services/api';
import { notify, confirm } from '../../../context/NotificationContext';
import { card, input, label, th, td, theadRow, btn, smallBtn, fmtMoney } from './hrUi';

const fmtDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('vi-VN', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Cấu hình chính sách chấm công – tính lương và danh sách ngày lễ. */
export default function HrSettingsPanel() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  useEffect(() => { api.get('/hr/settings').then(r => setS(r.data)).catch(err => notify(err.message, 'error')); }, []);
  const loadHolidays = () => api.get(`/hr/holidays?year=${year}`).then(r => setHolidays(r.data || [])).catch(() => {});
  useEffect(() => { loadHolidays(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <div style={card}>Đang tải cấu hình...</div>;
  const set = (k, cast = (v) => v) => (e) => setS(p => ({ ...p, [k]: cast(e.target.type === 'checkbox' ? e.target.checked : e.target.value) }));

  const save = async () => {
    setSaving(true);
    try {
      const { policy, standardHoursPerDay, ...payload } = s;
      const r = await api.put('/hr/settings', payload);
      setS(p => ({ ...p, ...r.data }));
      notify('Đã lưu cấu hình chấm công & tính lương.', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name.trim()) return notify('Nhập ngày và tên ngày lễ.', 'error');
    try {
      await api.post('/hr/holidays', newHoliday);
      setNewHoliday({ date: '', name: '' });
      loadHolidays();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const removeHoliday = async (h) => {
    if (!(await confirm(`Xóa ngày lễ "${h.name}" (${fmtDate(h.date)})?`))) return;
    try {
      await api.delete(`/hr/holidays/${h.id}`);
      loadHolidays();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const section = (Icon, title, color) => (
    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Icon size={17} style={{ color }} /> {title}</h3>
  );
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' };
  const hint = { fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' };
  const policy = s.policy;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={card}>
        {section(Clock, 'Ca làm việc & quy tắc chấm công', '#2563eb')}
        <div style={grid}>
          <div><label style={label}>Giờ vào ca</label><input type="time" value={s.workStartTime} onChange={set('workStartTime')} style={input} /></div>
          <div><label style={label}>Giờ tan ca</label><input type="time" value={s.workEndTime} onChange={set('workEndTime')} style={input} /></div>
          <div><label style={label}>Nghỉ trưa (phút)</label><input type="number" min="0" value={s.breakMinutes} onChange={set('breakMinutes', Number)} style={input} /></div>
          <div><label style={label}>Cho phép trễ (phút)</label><input type="number" min="0" value={s.lateGraceMinutes} onChange={set('lateGraceMinutes', Number)} style={input} /><div style={hint}>Trễ quá mức này mới tính đi muộn.</div></div>
          <div>
            <label style={label}>Ngưỡng so khớp khuôn mặt</label>
            <input type="number" step="0.01" min="0.3" max="0.7" value={s.faceMatchThreshold} onChange={set('faceMatchThreshold', Number)} style={input} />
            <div style={hint}>Nhỏ hơn = khắt khe hơn. Khuyến nghị 0,45–0,55.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.85rem', fontSize: '0.8rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={s.workOnSaturday} onChange={set('workOnSaturday')} /> Làm việc thứ Bảy (công chuẩn T2–T7)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={s.attendanceStrictMode} onChange={set('attendanceStrictMode')} /> Chấm công nghiêm ngặt (ngày không có dữ liệu = vắng)
          </label>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.6rem' }}>
          Số giờ làm chuẩn mỗi ngày theo cấu hình hiện tại: <strong>{s.standardHoursPerDay}h</strong>.
        </div>
      </div>

      <div style={card}>
        {section(Wallet, 'Tham số tính lương', '#16a34a')}
        <div style={grid}>
          <div><label style={label}>Lương tối thiểu vùng (VNĐ)</label><input type="number" value={s.regionMinimumWage} onChange={set('regionMinimumWage', Number)} style={input} /><div style={hint}>Vùng I: 5.310.000đ (NĐ 293/2025).</div></div>
          <div><label style={label}>Hoa hồng bán hàng (% doanh số)</label><input type="number" step="0.1" min="0" max="20" value={s.salesCommissionFlat} onChange={set('salesCommissionFlat', Number)} style={input} /><div style={hint}>Trên doanh số bán tại quầy của Nhân Viên Bán Hàng.</div></div>
          <div><label style={label}>Thưởng lắp ráp (VNĐ/bộ)</label><input type="number" value={s.assemblyBonus} onChange={set('assemblyBonus', Number)} style={input} /><div style={hint}>Theo số lệnh lắp ráp nghiệm thu trong kỳ.</div></div>
          <div><label style={label}>Phạt vắng không phép (VNĐ/ngày)</label><input type="number" value={s.absencePenalty} onChange={set('absencePenalty', Number)} style={input} /><div style={hint}>Ngoài việc không được tính công. 0 = không phạt.</div></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={save} disabled={saving} style={btn(saving ? '#9ca3af' : '#2563eb')}><Save size={15} /> Lưu cấu hình</button>
        </div>
      </div>

      <div style={card}>
        {section(CalendarDays, 'Ngày nghỉ lễ, Tết (hưởng nguyên lương · đi làm tính 300%)', '#dc2626')}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.85rem' }}>
          <div><label style={label}>Năm</label><input type="number" value={year} onChange={e => setYear(Number(e.target.value) || year)} style={{ ...input, width: 100 }} /></div>
          <div><label style={label}>Ngày</label><input type="date" value={newHoliday.date} onChange={e => setNewHoliday(p => ({ ...p, date: e.target.value }))} style={input} /></div>
          <div style={{ flex: 1, minWidth: 200 }}><label style={label}>Tên ngày lễ</label><input value={newHoliday.name} onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))} style={input} placeholder="Ví dụ: Tết Nguyên đán (Mùng 1)" /></div>
          <button type="button" onClick={addHoliday} style={btn('#0f172a')}><Plus size={15} /> Thêm</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead><tr style={theadRow}><th style={th}>Ngày</th><th style={th}>Tên</th><th style={{ ...th, textAlign: 'right' }}></th></tr></thead>
          <tbody>
            {holidays.map(h => (
              <tr key={h.id}>
                <td style={{ ...td, fontWeight: 700 }}>{fmtDate(h.date)}</td>
                <td style={td}>{h.name}</td>
                <td style={{ ...td, textAlign: 'right' }}><button type="button" onClick={() => removeHoliday(h)} style={smallBtn('#dc2626', '#fecaca')}><Trash2 size={12} /></button></td>
              </tr>
            ))}
            {holidays.length === 0 && <tr><td colSpan={3} style={{ ...td, color: '#94a3b8', textAlign: 'center' }}>Chưa khai báo ngày lễ nào cho năm {year}.</td></tr>}
          </tbody>
        </table>
      </div>

      {policy && (
        <div style={card}>
          {section(Scale, 'Căn cứ pháp lý đang áp dụng (chỉ xem)', '#7c3aed')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', fontSize: '0.78rem', color: '#334155' }}>
            <div>
              <strong>Bảo hiểm bắt buộc</strong>
              <div>NLĐ đóng: BHXH 8% · BHYT 1,5% · BHTN 1% (10,5%)</div>
              <div>DN đóng: BHXH 17,5% · BHYT 3% · BHTN 1% (21,5%)</div>
              <div>Trần lương đóng BHXH/BHYT: {fmtMoney(policy.insuranceRates.cap)}đ</div>
            </div>
            <div>
              <strong>Giảm trừ gia cảnh</strong>
              <div>Bản thân: {fmtMoney(policy.familyDeduction.self)}đ/tháng</div>
              <div>Mỗi người phụ thuộc: {fmtMoney(policy.familyDeduction.dependent)}đ/tháng</div>
              <div style={{ marginTop: '0.3rem' }}><strong>Tăng ca:</strong> 150% ngày thường · 200% ngày nghỉ · 300% ngày lễ</div>
            </div>
            <div>
              <strong>Biểu thuế TNCN lũy tiến (kỳ {policy.period})</strong>
              {policy.taxBrackets.map((b, i) => (
                <div key={i}>{b.upper ? `Đến ${fmtMoney(b.upper)}đ` : 'Phần còn lại'}: {Math.round(b.rate * 100)}%</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
