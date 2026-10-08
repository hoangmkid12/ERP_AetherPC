import React, { useState } from 'react';
import { X, Save, Lightbulb } from 'lucide-react';
import { DELIVERY_REGIONS } from '../../../utils/deliveryRegions';
import { input, label, btn, overlay, modal, fmtMoney, ROLE_OPTIONS, DEPARTMENTS, DEFAULT_DEPT_BY_ROLE, SALARY_SUGGESTION } from './hrUi';

const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');

/**
 * Form hồ sơ nhân viên dùng cho cả thêm mới (employee = null) và chỉnh sửa.
 * onSubmit(payload) trả Promise; lỗi được hiển thị ngay trong form.
 */
export default function EmployeeFormModal({ employee, onClose, onSubmit }) {
  const isNew = !employee;
  const [f, setF] = useState(() => ({
    fullName: employee?.fullName || employee?.fullname || '',
    username: '',
    role: employee?.role || 'EMPLOYEE',
    department: employee?.department || 'Hành Chính',
    jobTitle: employee?.jobTitle || '',
    hireDate: toDateInput(employee?.hireDate) || new Date().toISOString().slice(0, 10),
    phone: employee?.phone || '',
    deliveryRegion: employee?.deliveryRegion || 'HCM_KV1',
    baseSalary: employee?.baseSalary ?? SALARY_SUGGESTION.EMPLOYEE[0],
    responsibilityAllowance: employee?.responsibilityAllowance ?? 0,
    allowance: employee?.allowance ?? SALARY_SUGGESTION.EMPLOYEE[2],
    dependents: employee?.dependents ?? 0,
    annualLeaveQuota: employee?.annualLeaveQuota ?? 12,
    idNumber: employee?.idNumber || '',
    personalTaxCode: employee?.personalTaxCode || '',
    bankName: employee?.bankName || '',
    bankAccount: employee?.bankAccount || ''
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

  const applySuggestion = (role) => {
    const s = SALARY_SUGGESTION[role];
    if (s) setF(p => ({ ...p, baseSalary: s[0], responsibilityAllowance: s[1], allowance: s[2] }));
  };

  const submit = async () => {
    setError(null);
    if (!f.fullName.trim()) return setError('Vui lòng nhập họ tên.');
    if (isNew && !f.username.trim()) return setError('Vui lòng nhập tên đăng nhập.');
    setSaving(true);
    try {
      const username = f.username.trim().toLowerCase();
      await onSubmit({
        fullName: f.fullName.trim(),
        ...(isNew ? { email: username.includes('@') ? username : `${username}@kltn-erp.vn`, password: '123456' } : {}),
        role: f.role,
        department: f.department,
        jobTitle: f.jobTitle,
        hireDate: f.hireDate,
        phone: f.phone,
        deliveryRegion: f.role === 'DELIVERY' ? f.deliveryRegion : null,
        baseSalary: Number(f.baseSalary) || 0,
        responsibilityAllowance: Number(f.responsibilityAllowance) || 0,
        allowance: Number(f.allowance) || 0,
        dependents: Number(f.dependents) || 0,
        annualLeaveQuota: Number(f.annualLeaveQuota) || 12,
        idNumber: f.idNumber,
        personalTaxCode: f.personalTaxCode,
        bankName: f.bankName,
        bankAccount: f.bankAccount
      });
    } catch (err) {
      setError(err.message || 'Không lưu được hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' };
  const section = { fontSize: '0.77rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', margin: '0.4rem 0 -0.2rem' };

  return (
    <div style={overlay}>
      <div style={modal(640)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{isNew ? 'Thêm Hồ Sơ Nhân Viên Mới' : `Sửa Hồ Sơ: ${f.fullName}`}</h3>
          <button type="button" onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div style={section}>Thông tin công việc</div>
          <div style={grid2}>
            <div><label style={label}>Họ và tên *</label><input style={input} value={f.fullName} onChange={set('fullName')} placeholder="Ví dụ: Hoàng Minh Trí" /></div>
            {isNew
              ? <div><label style={label}>Tên đăng nhập *</label><input style={input} value={f.username} onChange={set('username')} placeholder="trihm → trihm@kltn-erp.vn" /></div>
              : <div><label style={label}>Số điện thoại</label><input style={input} value={f.phone} onChange={set('phone')} /></div>}
          </div>
          <div style={grid2}>
            <div>
              <label style={label}>Vai trò hệ thống *</label>
              <select style={input} value={f.role} onChange={e => { const role = e.target.value; setF(p => ({ ...p, role, department: DEFAULT_DEPT_BY_ROLE[role] || p.department })); if (isNew) applySuggestion(role); }}>
                {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Phòng ban</label>
              <select style={input} value={f.department} onChange={set('department')}>
                {[...new Set([...DEPARTMENTS, f.department])].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={grid2}>
            <div><label style={label}>Chức danh</label><input style={input} value={f.jobTitle} onChange={set('jobTitle')} placeholder="Ví dụ: Chuyên viên hành chính" /></div>
            <div><label style={label}>Ngày vào làm</label><input type="date" style={input} value={f.hireDate} onChange={set('hireDate')} /></div>
          </div>
          {isNew && <div><label style={label}>Số điện thoại</label><input style={input} value={f.phone} onChange={set('phone')} /></div>}
          {f.role === 'DELIVERY' && (
            <div>
              <label style={label}>Khu vực giao hàng</label>
              <select style={input} value={f.deliveryRegion} onChange={set('deliveryRegion')}>
                {DELIVERY_REGIONS.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ ...section, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Lương & phụ cấp (VNĐ/tháng)</span>
            <button type="button" onClick={() => applySuggestion(f.role)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', border: 'none', background: 'none', color: '#d97706', fontSize: '0.77rem', fontWeight: 700, cursor: 'pointer', textTransform: 'none' }}>
              <Lightbulb size={13} /> Áp khung lương gợi ý
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
            <div><label style={label}>Lương cơ bản *</label><input type="number" style={input} value={f.baseSalary} onChange={set('baseSalary')} /></div>
            <div><label style={label}>PC chức vụ (đóng BH)</label><input type="number" style={input} value={f.responsibilityAllowance} onChange={set('responsibilityAllowance')} /></div>
            <div><label style={label}>PC ăn trưa, xăng xe</label><input type="number" style={input} value={f.allowance} onChange={set('allowance')} /></div>
          </div>
          <div style={{ fontSize: '0.77rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '6px', padding: '0.45rem 0.6rem' }}>
            Thu nhập cố định: <strong>{fmtMoney(Number(f.baseSalary) + Number(f.responsibilityAllowance) + Number(f.allowance))}đ</strong> ·
            Lương đóng BHXH: <strong>{fmtMoney(Number(f.baseSalary) + Number(f.responsibilityAllowance))}đ</strong> ·
            Lương cơ bản không được thấp hơn lương tối thiểu vùng.
          </div>
          <div style={grid2}>
            <div><label style={label}>Người phụ thuộc (giảm trừ thuế)</label><input type="number" min="0" style={input} value={f.dependents} onChange={set('dependents')} /></div>
            <div><label style={label}>Ngày phép năm cơ bản</label><input type="number" min="12" style={input} value={f.annualLeaveQuota} onChange={set('annualLeaveQuota')} /></div>
          </div>

          <div style={section}>Giấy tờ & tài khoản nhận lương</div>
          <div style={grid2}>
            <div><label style={label}>Số CCCD</label><input style={input} value={f.idNumber} onChange={set('idNumber')} /></div>
            <div><label style={label}>Mã số thuế cá nhân</label><input style={input} value={f.personalTaxCode} onChange={set('personalTaxCode')} /></div>
          </div>
          <div style={grid2}>
            <div><label style={label}>Ngân hàng</label><input style={input} value={f.bankName} onChange={set('bankName')} /></div>
            <div><label style={label}>Số tài khoản</label><input style={input} value={f.bankAccount} onChange={set('bankAccount')} /></div>
          </div>

          {isNew && <div style={{ fontSize: '0.79rem', color: '#64748b' }}>Mật khẩu mặc định: <code>123456</code> — nhân viên nên đổi sau lần đăng nhập đầu tiên.</div>}
          {error && <div style={{ fontSize: '0.8rem', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.3rem' }}>
            <button type="button" onClick={onClose} style={btn('#ffffff', '#475569')}>Hủy</button>
            <button type="button" onClick={submit} disabled={saving} style={btn(saving ? '#9ca3af' : '#2563eb')}><Save size={15} /> {saving ? 'Đang lưu...' : isNew ? 'Tạo Hồ Sơ' : 'Lưu Thay Đổi'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
