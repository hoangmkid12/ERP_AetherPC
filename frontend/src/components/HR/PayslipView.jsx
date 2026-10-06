import React, { useRef } from 'react';
import { Printer } from 'lucide-react';
import { PAYROLL_STATUS, getStatusInfo, getStatusLabel } from '../../utils/statusLabels';
import { getRoleName } from '../../utils/rbacEngine';

export const fmtVnd = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + 'đ';
const fmtNum = (n, digits = 1) => (Number(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: digits });
export const periodLabel = (period) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  return m ? `Tháng ${m[2]}/${m[1]}` : (period || '');
};

const Row = ({ label, value, strong, color, sub }) => (
  <tr>
    <td style={{ padding: '0.4rem 0.6rem', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>
      {label}
      {sub && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{sub}</div>}
    </td>
    <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: strong ? 800 : 600, color: color || '#0f172a', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
      {value}
    </td>
  </tr>
);

const Section = ({ title, children }) => (
  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
    <div style={{ backgroundColor: '#f8fafc', padding: '0.45rem 0.6rem', fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{title}</div>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}><tbody>{children}</tbody></table>
  </div>
);

/**
 * Phiếu lương chi tiết. `p` là bản ghi trả về từ /hr/payrolls (đã serialize).
 * Phiếu cũ (trước khi có cột chi tiết) chỉ hiển thị các khoản tổng hợp.
 */
export default function PayslipView({ p, showEmployerCost = false, companyName = 'CÔNG TY AETHERPC' }) {
  const ref = useRef(null);
  if (!p) return null;
  const detailed = p.grossSalary != null;
  const emp = p.employee || {};
  const st = getStatusInfo(PAYROLL_STATUS, p.status);

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Phiếu lương ${p.empName || ''} ${periodLabel(p.period)}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a} table{border-collapse:collapse;width:100%} td{font-size:13px}
      h2{margin:0} .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px} @media print{button{display:none}}</style></head>
      <body>${ref.current?.innerHTML || ''}<p style="margin-top:32px;display:flex;justify-content:space-between;font-size:13px">
      <span>Người lập phiếu<br><br><br>Phòng Nhân Sự</span><span>Người nhận<br><br><br>${p.empName || ''}</span></p>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div>
      <div ref={ref}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>{companyName}</div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.15rem 0' }}>PHIẾU LƯƠNG {periodLabel(p.period).toUpperCase()}</h2>
            <div style={{ fontSize: '0.8rem', color: '#334155' }}>
              <strong>{p.empName || emp.fullName}</strong>
              {emp.employeeCode ? ` · ${emp.employeeCode}` : ''} · {emp.jobTitle || getRoleName(emp.role)}{emp.department ? ` · ${emp.department}` : ''}
            </div>
            {(emp.bankAccount || emp.bankName) && (
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>Tài khoản nhận lương: {emp.bankAccount || '—'} {emp.bankName ? `(${emp.bankName})` : ''}</div>
            )}
          </div>
          <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, backgroundColor: st.bg, color: st.color }}>
            {getStatusLabel(PAYROLL_STATUS, p.status)}
          </span>
        </div>

        {detailed ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            <Section title="Ngày công">
              <Row label="Công chuẩn của tháng" value={`${fmtNum(p.standardDays)} ngày`} />
              <Row label="Ngày đi làm thực tế" value={`${fmtNum(p.workDays)} ngày`} />
              <Row label="Nghỉ phép có lương / nghỉ lễ" value={`${fmtNum(p.paidLeaveDays)} ngày`} />
              <Row label="Vắng không lương" value={`${fmtNum(p.unpaidDays)} ngày`} color={p.unpaidDays ? '#dc2626' : undefined} />
              <Row label="Đi muộn / về sớm" value={`${p.lateMinutes || 0} phút`} color={p.lateMinutes ? '#d97706' : undefined} />
              <Row label="Giờ tăng ca" value={`${fmtNum(p.overtimeHours)} giờ`} />
            </Section>

            <Section title="Thu nhập">
              <Row label="Lương hợp đồng" sub="Lương cơ bản + phụ cấp chức vụ" value={fmtVnd(p.contractSalary)} color="#64748b" />
              <Row label="Lương theo ngày công" value={fmtVnd(p.baseSalary)} />
              <Row label="Phụ cấp (ăn trưa, xăng xe, điện thoại)" value={fmtVnd(p.allowances)} />
              <Row label="Tiền tăng ca" sub="150% ngày thường · 200% ngày nghỉ · 300% ngày lễ" value={fmtVnd(p.overtimePay)} />
              {Number(p.commission) > 0 && <Row label="Hoa hồng bán hàng" value={fmtVnd(p.commission)} />}
              {Number(p.assemblyBonus) > 0 && <Row label="Thưởng lắp ráp" value={fmtVnd(p.assemblyBonus)} />}
              {Number(p.otherBonus) > 0 && <Row label="Thưởng khác" value={fmtVnd(p.otherBonus)} />}
              <Row label="Tổng thu nhập (Gross)" value={fmtVnd(p.grossSalary)} strong color="#16a34a" />
            </Section>

            <Section title="Khấu trừ">
              <Row label="Bảo hiểm bắt buộc (10,5%)" sub={`BHXH 8% · BHYT 1,5% · BHTN 1% trên ${fmtVnd(p.insuranceSalary)}`} value={`-${fmtVnd(p.employeeInsurance)}`} />
              <Row label="Thu nhập tính thuế" sub={`Đã trừ giảm trừ gia cảnh${emp.dependents ? ` (${emp.dependents} người phụ thuộc)` : ''}`} value={fmtVnd(p.taxableIncome)} color="#64748b" />
              <Row label="Thuế TNCN" value={`-${fmtVnd(p.personalIncomeTax)}`} />
              {Number(p.latePenalty) > 0 && <Row label="Khấu trừ chuyên cần" sub="Đi muộn/về sớm, vắng không phép" value={`-${fmtVnd(p.latePenalty)}`} />}
              {Number(p.otherDeductions) > 0 && <Row label="Khấu trừ khác" value={`-${fmtVnd(p.otherDeductions)}`} />}
              <Row label="Tổng khấu trừ" value={`-${fmtVnd(p.deductions)}`} strong color="#dc2626" />
            </Section>
          </div>
        ) : (
          <Section title="Tổng hợp">
            <Row label="Lương theo công" value={fmtVnd(p.baseSalary)} />
            <Row label="Phụ cấp" value={fmtVnd(p.allowances)} />
            <Row label="Thưởng" value={fmtVnd(p.bonuses)} />
            <Row label="Khấu trừ" value={`-${fmtVnd(p.deductions)}`} color="#dc2626" />
          </Section>
        )}

        {p.note && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#475569', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>
            <strong>Ghi chú:</strong> {p.note}
          </div>
        )}

        <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.75rem 1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontWeight: 800, color: '#1e3a8a' }}>THỰC LĨNH</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1d4ed8' }}>{fmtVnd(p.netSalary ?? p.netAmount)}</span>
        </div>

        {showEmployerCost && detailed && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
            Chi phí doanh nghiệp: BH phần công ty đóng (21,5%) {fmtVnd(p.employerInsurance)} · Tổng chi phí nhân sự {fmtVnd(Number(p.grossSalary) + Number(p.employerInsurance))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
        <button type="button" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.9rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
          <Printer size={14} /> In phiếu lương
        </button>
      </div>
    </div>
  );
}
