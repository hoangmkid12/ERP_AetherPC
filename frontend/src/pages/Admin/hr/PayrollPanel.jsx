import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Send, Download, Eye, Edit3, X, Save, AlertTriangle } from 'lucide-react';
import { api } from '../../../services/api';
import { notify, confirm } from '../../../context/NotificationContext';
import { useHRStore } from '../../../stores';
import { getRoleName } from '../../../utils/rbacEngine';
import { PAYROLL_STATUS, getStatusInfo, getStatusLabel } from '../../../utils/statusLabels';
import PayslipView, { periodLabel } from '../../../components/HR/PayslipView';
import { card, input, label, th, td, theadRow, btn, smallBtn, overlay, modal, fmtMoney, previousPeriod, downloadCsv } from './hrUi';

const EDITABLE = ['DRAFT', 'REJECTED_BY_CEO'];
const sum = (rows, k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

/** Bảng lương theo kỳ: tính lương → rà soát/điều chỉnh → trình Ban Giám Đốc duyệt. */
export default function PayrollPanel() {
  const [period, setPeriod] = useState(previousPeriod());
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [adjusting, setAdjusting] = useState(null);

  const load = useCallback(() => {
    api.get(`/hr/payrolls?period=${period}`).then(r => setRows(r.data || [])).catch(err => notify(err.message, 'error'));
  }, [period]);
  useEffect(() => { load(); }, [load]);

  const refreshStore = () => useHRStore.getState().getPayrolls?.().catch(() => {});

  const calculate = async () => {
    setBusy(true);
    try {
      const res = await api.post('/hr/payrolls', { period });
      notify(res.message, 'success');
      setRows(res.data || []);
      refreshStore();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!(await confirm(`Trình Ban Giám Đốc duyệt bảng lương ${periodLabel(period)}? Sau khi trình sẽ không chỉnh sửa được nữa (trừ khi bị trả về).`))) return;
    setBusy(true);
    try {
      const res = await api.post('/hr/payrolls/submit', { period });
      notify(res.message, 'success');
      load();
      refreshStore();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const editableCount = rows.filter(r => EDITABLE.includes(r.status)).length;
  const rejected = rows.find(r => r.status === 'REJECTED_BY_CEO' && r.rejectReason);
  const detailed = rows.filter(r => r.grossSalary != null);
  const totals = useMemo(() => ({
    gross: sum(detailed, 'grossSalary'),
    ins: sum(detailed, 'employeeInsurance'),
    pit: sum(detailed, 'personalIncomeTax'),
    net: sum(rows, 'netAmount'),
    employer: sum(detailed, 'employerInsurance')
  }), [rows, detailed]);

  const exportCsv = () => downloadCsv(
    `bang-luong-${period}.csv`,
    ['Mã NV', 'Họ tên', 'Chức danh', 'Lương HĐ', 'Công chuẩn', 'Ngày công', 'Phép/Lễ', 'Lương theo công', 'Phụ cấp', 'Tăng ca', 'Hoa hồng', 'Thưởng lắp ráp', 'Thưởng khác',
      'Tổng thu nhập', 'BH NLĐ (10,5%)', 'Thu nhập tính thuế', 'Thuế TNCN', 'Khấu trừ chuyên cần', 'Khấu trừ khác', 'Thực lĩnh', 'BH DN (21,5%)', 'Ngân hàng', 'Số TK', 'Trạng thái'],
    rows.map(r => [r.employee?.employeeCode, r.empName, r.employee?.jobTitle || getRoleName(r.employee?.role), r.contractSalary, r.standardDays, r.workDays, r.paidLeaveDays,
      r.baseSalary, r.allowances, r.overtimePay, r.commission, r.assemblyBonus, r.otherBonus, r.grossSalary, r.employeeInsurance, r.taxableIncome, r.personalIncomeTax,
      r.latePenalty, r.otherDeductions, r.netAmount, r.employerInsurance, r.employee?.bankName, r.employee?.bankAccount, getStatusLabel(PAYROLL_STATUS, r.status)])
  );

  const stat = (t, v, c = '#0f172a') => (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.8rem', backgroundColor: '#f8fafc' }}>
      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>{t}</div>
      <div style={{ fontSize: '1rem', fontWeight: 900, color: c }}>{fmtMoney(v)}đ</div>
    </div>
  );

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ ...label, margin: 0 }}>Kỳ lương:</label>
          <input type="month" value={period} onChange={e => e.target.value && setPeriod(e.target.value)} style={{ ...input, width: 'auto' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={calculate} disabled={busy} style={btn(busy ? '#9ca3af' : '#2563eb')}><Calculator size={15} /> {rows.length ? 'Tính lại lương' : 'Tính lương kỳ này'}</button>
          <button type="button" onClick={submit} disabled={busy || editableCount === 0} style={btn(busy || editableCount === 0 ? '#9ca3af' : '#16a34a')}><Send size={15} /> Trình Ban Giám Đốc duyệt</button>
          <button type="button" onClick={exportCsv} disabled={!rows.length} style={btn('#ffffff', '#0f172a')}><Download size={15} /> Xuất Excel</button>
        </div>
      </div>

      {rejected && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.9rem', fontSize: '0.8rem' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span><strong>Ban Giám Đốc trả bảng lương về:</strong> {rejected.rejectReason}. Điều chỉnh các phiếu liên quan rồi bấm "Trình Ban Giám Đốc duyệt" lại.</span>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
          {stat('Tổng thu nhập (Gross)', totals.gross, '#16a34a')}
          {stat('BH người lao động đóng', totals.ins)}
          {stat('Thuế TNCN khấu trừ', totals.pit)}
          {stat('Tổng thực lĩnh', totals.net, '#1d4ed8')}
          {stat('BH doanh nghiệp đóng', totals.employer)}
          {stat('Tổng chi phí nhân sự', totals.gross + totals.employer, '#b45309')}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead><tr style={theadRow}>
            <th style={th}>Nhân viên</th><th style={{ ...th, textAlign: 'right' }}>Công</th><th style={{ ...th, textAlign: 'right' }}>Tổng thu nhập</th>
            <th style={{ ...th, textAlign: 'right' }}>BH 10,5%</th><th style={{ ...th, textAlign: 'right' }}>Thuế TNCN</th><th style={{ ...th, textAlign: 'right' }}>Khấu trừ khác</th>
            <th style={{ ...th, textAlign: 'right' }}>Thực lĩnh</th><th style={{ ...th, textAlign: 'center' }}>Trạng thái</th><th style={{ ...th, textAlign: 'center' }}>Thao tác</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const st = getStatusInfo(PAYROLL_STATUS, r.status);
              return (
                <tr key={r.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{r.empName}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{r.employee?.jobTitle || getRoleName(r.employee?.role)}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.standardDays != null ? `${Number(r.workDays) + Number(r.paidLeaveDays)}/${r.standardDays}` : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{fmtMoney(r.grossSalary ?? (r.baseSalary + r.allowances + r.bonuses))}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.employeeInsurance != null ? fmtMoney(r.employeeInsurance) : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.personalIncomeTax != null ? fmtMoney(r.personalIncomeTax) : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#dc2626' }}>{fmtMoney((Number(r.latePenalty) || 0) + (Number(r.otherDeductions) || 0))}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 900 }}>{fmtMoney(r.netAmount)}</td>
                  <td style={{ ...td, textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: st.bg, color: st.color }}>{getStatusLabel(PAYROLL_STATUS, r.status)}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                      <button type="button" onClick={() => setViewing(r)} style={smallBtn('#2563eb', '#bfdbfe')}><Eye size={12} /> Phiếu</button>
                      {EDITABLE.includes(r.status) && <button type="button" onClick={() => setAdjusting(r)} style={smallBtn('#d97706', '#fde68a')}><Edit3 size={12} /> Điều chỉnh</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                Chưa có bảng lương {periodLabel(period)}. Bấm "Tính lương kỳ này" để hệ thống tổng hợp từ bảng công, nghỉ phép, doanh số và lệnh lắp ráp.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#64748b', lineHeight: 1.55 }}>
        Công thức: Lương theo công = (lương cơ bản + phụ cấp chức vụ) × (ngày đi làm + phép/lễ) / công chuẩn · Tăng ca 150%/200%/300% ·
        BH NLĐ 10,5% (trần 20 × lương cơ sở) · Thuế TNCN lũy tiến sau giảm trừ gia cảnh · Khấu trừ chuyên cần theo số phút đi muộn/về sớm.
      </div>

      {viewing && (
        <div style={overlay} onClick={() => setViewing(null)}>
          <div style={modal(860)} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setViewing(null)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <PayslipView p={viewing} showEmployerCost />
          </div>
        </div>
      )}

      {adjusting && <AdjustModal row={adjusting} onClose={() => setAdjusting(null)} onSaved={(updated) => { setAdjusting(null); setRows(rs => rs.map(r => r.id === updated.id ? updated : r)); }} />}
    </div>
  );
}

function AdjustModal({ row, onClose, onSaved }) {
  const [f, setF] = useState({ otherBonus: row.otherBonus || 0, otherDeductions: row.otherDeductions || 0, note: row.note || '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/hr/payrolls/${row.id}/adjust`, f);
      notify('Đã điều chỉnh và tính lại phiếu lương.', 'success');
      onSaved(res.data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div style={overlay}>
      <div style={modal(440)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Điều chỉnh lương · {row.empName}</h3>
          <button type="button" onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div><label style={label}>Thưởng khác (VNĐ) — tính thuế TNCN</label><input type="number" min="0" value={f.otherBonus} onChange={e => setF(p => ({ ...p, otherBonus: e.target.value }))} style={input} /></div>
          <div><label style={label}>Khấu trừ khác (VNĐ) — tạm ứng, bồi thường...</label><input type="number" min="0" value={f.otherDeductions} onChange={e => setF(p => ({ ...p, otherDeductions: e.target.value }))} style={input} /></div>
          <div><label style={label}>Lý do *</label><textarea rows={2} value={f.note} onChange={e => setF(p => ({ ...p, note: e.target.value }))} style={{ ...input, resize: 'vertical' }} placeholder="Ví dụ: Thưởng nhân viên xuất sắc tháng; trừ tạm ứng 1.000.000đ" /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={btn('#ffffff', '#475569')}>Hủy</button>
            <button type="button" onClick={save} disabled={saving} style={btn(saving ? '#9ca3af' : '#2563eb')}><Save size={15} /> Lưu & tính lại</button>
          </div>
        </div>
      </div>
    </div>
  );
}
