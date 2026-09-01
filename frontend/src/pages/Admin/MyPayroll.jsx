import React, { useState } from 'react';
import { useHRStore, useUtilityStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { DollarSign, Calendar, Clipboard, TrendingUp, CheckCircle, Clock, XCircle, FileText, AlertCircle, Award, Printer, ShieldCheck, User } from 'lucide-react';

export default function MyPayroll() {
  const { user } = useAuth();
  const attendanceLogs = useHRStore(state => state.attendanceLogs) || [];
  const leaveRequests = useHRStore(state => state.leaveRequests) || [];
  const payrolls = useHRStore(state => state.payrolls) || [];
  const employees = useHRStore(state => state.employees) || [];
  const assemblyJobs = useUtilityStore(state => state.assemblyJobs) || [];

  const [showPayslipModal, setShowPayslipModal] = useState(false);

  if (!user) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '1rem' }}>
        Vui lòng đăng nhập để xem thông tin thu nhập cá nhân.
      </div>
    );
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const storedPayroll = payrolls.find(p => p && String(p.empId) === String(user?.id));

  // Fallback calculation if payroll not yet submitted
  const completedAssemblyCount = assemblyJobs.filter(j => j && j.status === 'COMPLETED').length;

  const empLogs = attendanceLogs.filter(l => l && String(l.empId) === String(user?.id));
  const presentDays = empLogs.filter(l => l.status === 'PRESENT').length;
  const lateDays = empLogs.filter(l => l.status === 'LATE').length;
  const absentDays = empLogs.filter(l => l.status === 'ABSENT').length;
  const approvedLeaves = leaveRequests.filter(l => l && (l.empId === user?.id || l.employeeName === user?.fullname) && l.status === 'APPROVED').length;

  const empDetails = employees.find(e => e.id === user?.id || e.username === user?.username) || {};
  const baseSalary = empDetails.baseSalary || user.baseSalary || 10000000;

  // Cùng hằng số hoa hồng cố định với bảng lương chính thức (HRManager.jsx)
  // — tránh 2 công thức khác nhau cho cùng một khoản hoa hồng.
  const salesBonus = user?.role === 'SALES' ? 1250000 : 0;
  const assemblyBonus = user?.role === 'ASSEMBLY' ? completedAssemblyCount * 150000 : 0;
  const totalBonus = salesBonus + assemblyBonus;
  const lateFine = lateDays * 50000;
  const insuranceDeduction = Math.round(baseSalary * 0.105);

  const calculatedNetSalary = Math.max(0, baseSalary + totalBonus - lateFine - insuranceDeduction);

  const isOfficial = !!storedPayroll;
  const activePayroll = storedPayroll || {
    baseSalary,
    presentDays,
    lateDays,
    absentDays,
    leaveDays: approvedLeaves,
    bonus: totalBonus,
    lateFine,
    insuranceDeduction,
    netSalary: calculatedNetSalary,
    status: 'DRAFT'
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '0.78rem' }}>Dự Thảo (Live)</span>;
      case 'SUBMITTED_TO_ACCOUNTING':
        return <span style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '0.78rem' }}>Chờ Kế Toán Duyệt Chi</span>;
      case 'DISBURSED':
      case 'COMPLETED':
      case 'PAID':
        return <span style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '0.78rem' }}>Đã Chi Trả Lương</span>;
      default:
        return <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '0.78rem' }}>{status}</span>;
    }
  };

  return (
    <div style={{ padding: '1.75rem', fontFamily: "'Inter', system-ui, sans-serif", color: '#0f172a' }}>
      
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        marginBottom: '1.75rem',
        backgroundColor: '#ffffff',
        padding: '1.5rem 1.75rem',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 12px rgba(15,23,42,0.03)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <DollarSign style={{ color: '#16a34a' }} size={28} /> Tra Cứu Thu Nhập & Bảng Công Cá Nhân
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Xin chào <strong>{user.fullname || user.username}</strong>! Theo dõi lương cứng, thưởng KPI sales, thưởng lắp ráp và phiếu lương điện tử.
          </p>
        </div>

        <button
          onClick={() => setShowPayslipModal(true)}
          style={{
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '0.65rem 1.3rem',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(79,70,229,0.25)'
          }}
        >
          <Printer size={18} /> In / Xem Phiếu Lương Điện Tử
        </button>
      </div>

      {/* Main Income Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        
        {/* Net Salary Summary Card */}
        <div style={{ border: '1.5px solid #bbf7d0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 4px 12px rgba(22,163,74,0.05)', backgroundColor: '#f0fdf4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>LƯƠNG THỰC NHẬN THÁNG NÀY</span>
            {getStatusBadge(activePayroll.status)}
          </div>

          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#16a34a', margin: '0.75rem 0 0.5rem', letterSpacing: '-0.5px' }}>
            {formatPrice(activePayroll.netSalary)}
          </div>

          <div style={{ fontSize: '0.8rem', color: '#166534' }}>
            {isOfficial ? '✓ Bảng lương chính thức đã chốt bởi HR & Kế toán.' : '* Số liệu dự tính thời gian thực dựa trên kết quả làm việc hiện tại.'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #bbf7d0', paddingTop: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>Lương Cơ Bản</span>
              <div style={{ fontWeight: 800, color: '#0f172a', marginTop: '0.2rem', fontSize: '0.95rem' }}>{formatPrice(activePayroll.baseSalary)}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>Khoản Thưởng KPI</span>
              <div style={{ fontWeight: 800, color: '#2563eb', marginTop: '0.2rem', fontSize: '0.95rem' }}>+{formatPrice(activePayroll.bonus || totalBonus)}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>Bảo Hiểm (10.5%)</span>
              <div style={{ fontWeight: 800, color: '#dc2626', marginTop: '0.2rem', fontSize: '0.95rem' }}>-{formatPrice(activePayroll.insuranceDeduction || insuranceDeduction)}</div>
            </div>
          </div>
        </div>

        {/* Working Days Stats Card */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 2px 6px rgba(15,23,42,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clipboard size={16} style={{ color: '#4f46e5' }} /> Tổng Hợp Công & Điểm Danh
          </h3>

          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Số ngày Có Mặt (Present):</span>
              <strong style={{ color: '#16a34a', fontWeight: 800 }}>{presentDays} ngày</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Số lần Đi Trễ (-50k):</span>
              <strong style={{ color: '#d97706', fontWeight: 800 }}>{lateDays} lần</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Nghỉ phép hưởng lương:</span>
              <strong style={{ color: '#2563eb', fontWeight: 800 }}>{approvedLeaves} ngày</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>Tổng ngày công tính lương:</span>
              <strong style={{ fontSize: '1.05rem', color: '#16a34a', fontWeight: 900 }}>{presentDays + approvedLeaves} / 26 ngày công</strong>
            </div>
          </div>
        </div>

      </div>

      {/* ── MODAL IN PHIẾU LƯƠNG ĐIỆN TỬ ── */}
      {showPayslipModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
          <div style={{ width: '100%', maxWidth: '640px', backgroundColor: '#ffffff', borderRadius: '18px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(15,23,42,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>PHIẾU LƯƠNG ĐIỆN TỬ CÁ NHÂN</h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>AetherPC ERP • Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</div>
              </div>
              <button onClick={() => setShowPayslipModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                <div>Họ và tên: <strong style={{ color: '#0f172a' }}>{user.fullname || user.username}</strong></div>
                <div>Phòng ban: <strong style={{ color: '#4f46e5' }}>{user.role}</strong></div>
                <div>Mã nhân viên: <strong style={{ color: '#0f172a' }}>#{user.id}</strong></div>
                <div>Trạng thái: <strong>{activePayroll.status === 'PAID' ? 'Đã Thanh Toán' : 'Chờ Giải Ngân'}</strong></div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.73rem' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Khoản Mục Thu Nhập & Khấu Trừ</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Số Tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>Lương căn bản</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>{formatPrice(activePayroll.baseSalary)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>Thưởng Hoa hồng Sales / Thưởng PC</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>+{formatPrice(activePayroll.bonus || totalBonus)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>Phạt đi muộn</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>-{formatPrice(activePayroll.lateFine || lateFine)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>Bảo hiểm trích đóng (10.5%)</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>-{formatPrice(activePayroll.insuranceDeduction || insuranceDeduction)}</td>
                    </tr>
                    <tr style={{ backgroundColor: '#f0fdf4', borderTop: '2px solid #bbf7d0' }}>
                      <td style={{ padding: '1rem', fontWeight: 900, color: '#15803d' }}>LƯƠNG THỰC NHẬN CHUYỂN KHOẢN:</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 900, fontSize: '1.25rem', color: '#16a34a' }}>{formatPrice(activePayroll.netSalary)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => window.print()}
                style={{ padding: '0.65rem 1.4rem', borderRadius: '10px', backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={16} /> In Phiếu Lương
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
