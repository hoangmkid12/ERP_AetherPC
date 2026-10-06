import React, { useEffect, useState } from 'react';
import { Download, Info } from 'lucide-react';
import { api } from '../../../services/api';
import { notify } from '../../../context/NotificationContext';
import { getRoleName } from '../../../utils/rbacEngine';
import { periodLabel } from '../../../components/HR/PayslipView';
import { card, input, label, th, td, theadRow, btn, currentPeriod, downloadCsv } from './hrUi';

/** Bảng công tháng — cùng quy tắc với tính lương (công chuẩn, nghỉ lễ, nghỉ phép, vắng, đi muộn, tăng ca). */
export default function TimesheetPanel() {
  const [month, setMonth] = useState(currentPeriod());
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/hr/attendance/timesheet?month=${month}`).then(r => setData(r.data)).catch(err => notify(err.message, 'error'));
  }, [month]);

  const rows = data?.rows || [];
  const exportCsv = () => downloadCsv(
    `bang-cong-${month}.csv`,
    ['Mã NV', 'Họ tên', 'Phòng ban', 'Công chuẩn', 'Ngày đi làm', 'Nghỉ phép/lễ có lương', 'Vắng/không lương', 'Đi muộn (lần)', 'Đi muộn/về sớm (phút)', 'Tăng ca (giờ)', 'Ngày chấm khuôn mặt'],
    rows.map(r => [r.employeeCode, r.fullName, r.department, r.standardDays, r.workDays, r.paidLeaveDays, r.unpaidDays, r.lateDays, r.lateMinutes, r.overtimeHours, r.faceDays])
  );

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ ...label, margin: 0 }}>Bảng công:</label>
          <input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} style={{ ...input, width: 'auto' }} />
        </div>
        <button type="button" onClick={exportCsv} disabled={!rows.length} style={btn('#ffffff', '#0f172a')}><Download size={15} /> Xuất Excel (CSV)</button>
      </div>

      {data && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.76rem', color: '#475569', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.55rem 0.7rem', marginBottom: '0.9rem' }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {periodLabel(month)} có <strong>{rows[0]?.standardDays ?? '-'}</strong> ngày công chuẩn{data.holidays.length ? `, gồm ${data.holidays.length} ngày lễ hưởng nguyên lương` : ''}.
            {data.strictMode
              ? ' Chế độ chấm công NGHIÊM NGẶT: ngày làm việc không có dữ liệu chấm công bị tính là vắng.'
              : ' Chế độ chuyển đổi: ngày làm việc chưa có dữ liệu chấm công tạm tính đủ công (đổi trong tab Cấu Hình Công & Lương).'}
          </span>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead><tr style={theadRow}>
            <th style={th}>Nhân viên</th><th style={{ ...th, textAlign: 'right' }}>Công chuẩn</th><th style={{ ...th, textAlign: 'right' }}>Đi làm</th>
            <th style={{ ...th, textAlign: 'right' }}>Phép/Lễ</th><th style={{ ...th, textAlign: 'right' }}>Vắng</th><th style={{ ...th, textAlign: 'right' }}>Đi muộn</th>
            <th style={{ ...th, textAlign: 'right' }}>Tăng ca</th><th style={{ ...th, textAlign: 'right' }}>Chấm khuôn mặt</th><th style={{ ...th, textAlign: 'right' }}>Tỷ lệ chuyên cần</th>
          </tr></thead>
          <tbody>
            {!data && <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Đang tổng hợp bảng công...</td></tr>}
            {rows.map(r => {
              const rate = r.standardDays ? Math.round(((r.workDays + r.paidLeaveDays) / r.standardDays) * 100) : 0;
              return (
                <tr key={r.employeeId}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{r.fullName}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{r.employeeCode} · {getRoleName(r.role)}{!r.hasFace && <span style={{ color: '#d97706' }}> · chưa đăng ký khuôn mặt</span>}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.standardDays}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{r.workDays}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.paidLeaveDays}</td>
                  <td style={{ ...td, textAlign: 'right', color: r.unpaidDays ? '#dc2626' : undefined, fontWeight: r.unpaidDays ? 800 : 400 }}>{r.unpaidDays}</td>
                  <td style={{ ...td, textAlign: 'right', color: r.lateDays ? '#d97706' : undefined }}>{r.lateDays} lần · {r.lateMinutes}′</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.overtimeHours}h</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.faceDays}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: rate >= 95 ? '#16a34a' : rate >= 85 ? '#d97706' : '#dc2626' }}>{rate}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
