import React, { useState, useMemo, useEffect } from 'react';
import ActorNotificationBar from '../../components/ActorNotificationBar';
import { useSearchParams } from 'react-router-dom';
import { useHRStore, useUtilityStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { DELIVERY_REGIONS } from '../../utils/deliveryRegions';
import { ATTENDANCE_STATUS, LEAVE_STATUS, PAYROLL_STATUS, getStatusInfo, getStatusLabel } from '../../utils/statusLabels';
import { notify, promptText } from '../../context/NotificationContext';
import { api } from '../../services/api';
import AttendancePanel from './hr/AttendancePanel';
import TimesheetPanel from './hr/TimesheetPanel';
import PayrollPanel from './hr/PayrollPanel';
import HrSettingsPanel from './hr/HrSettingsPanel';
import EmployeeFormModal from './hr/EmployeeFormModal';
import FaceAdminModal from './hr/FaceAdminModal';
import { 
  Users, UserPlus, CheckCircle, Clock, XCircle, DollarSign, CalendarCheck, 
  Key, Eye, EyeOff, Search, FileEdit, Award, Sparkles, Check, X, Calendar, 
  Clipboard, Send, RefreshCw, Briefcase, Filter, ShieldCheck, AlertCircle, ChevronRight, 
  Edit3, User, Printer, Phone, Mail, MapPin, CreditCard, Building, TrendingUp, AlertTriangle, ScanFace
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { getRoleName } from '../../utils/rbacEngine';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement, 
  LineElement, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const ROLE_COLORS = {
  ADMIN: '#ef4444',
  CEO: '#f59e0b',
  SALES_MANAGER: '#1d4ed8',
  SALES: '#2563eb',
  WAREHOUSE_MANAGER: '#059669',
  WAREHOUSE: '#10b981',
  PURCHASING: '#f97316',
  QC: '#8b5cf6',
  QA: '#8b5cf6',
  ASSEMBLY: '#0ea5e9',
  HR: '#ec4899',
  ACCOUNTANT: '#14b8a6',
  CSKH: '#06b6d4',
  DELIVERY: '#64748b',
  EMPLOYEE: '#475569'
};


export default function HRManager() {
  const employees = useHRStore(state => state.employees) || [];
  const attendanceLogs = useHRStore(state => state.attendanceLogs) || [];
  const setEmployeeStatus = useHRStore(state => state.setEmployeeStatus);
  const resetEmployeePassword = useHRStore(state => state.resetEmployeePassword);
  const leaveRequests = useHRStore(state => state.leaveRequests) || [];
  const getLeaveRequests = useHRStore(state => state.getLeaveRequests);
  const createMyLeaveRequest = useHRStore(state => state.createMyLeaveRequest);
  const approveLeaveRequest = useHRStore(state => state.approveLeaveRequest);
  const rejectLeaveRequest = useHRStore(state => state.rejectLeaveRequest);
  const payrolls = useHRStore(state => state.payrolls) || [];
  const assemblyJobs = useUtilityStore(state => state.assemblyJobs) || [];
  const { isCEO, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab from URL (?tab=overview|attendance|employees|leaves|payroll)
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab = (tKey) => {
    setSearchParams({ tab: tKey });
    setSearch('');
  };

  // State for creating leave request modal
  const [showCreateLeaveModal, setShowCreateLeaveModal] = useState(false);
  const [leaveModalForm, setLeaveModalForm] = useState({
    employeeId: '',
    type: 'Phép Năm',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [submittingLeaveModal, setSubmittingLeaveModal] = useState(false);

  useEffect(() => {
    if (activeTab === 'leaves' && typeof getLeaveRequests === 'function') {
      getLeaveRequests().catch(() => {});
    }
  }, [activeTab]);

  const handleCreateLeaveModalSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!leaveModalForm.startDate || !leaveModalForm.endDate) {
      notify('Vui lòng chọn ngày bắt đầu và ngày kết thúc.', 'error');
      return;
    }
    setSubmittingLeaveModal(true);
    try {
      await createMyLeaveRequest(leaveModalForm);
      notify('Đã tạo đơn xin nghỉ phép thành công.', 'success');
      setShowCreateLeaveModal(false);
      setLeaveModalForm({ employeeId: '', type: 'Phép Năm', startDate: '', endDate: '', reason: '' });
      if (typeof getLeaveRequests === 'function') {
        getLeaveRequests().catch(() => {});
      }
    } catch (err) {
      notify(err.message || 'Không thể tạo đơn nghỉ phép.', 'error');
    } finally {
      setSubmittingLeaveModal(false);
    }
  };

  // Thêm/sửa hồ sơ dùng chung EmployeeFormModal; editingEmp = null nghĩa là thêm mới.
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [faceEmp, setFaceEmp] = useState(null);
  const [viewingEmpDetail, setViewingEmpDetail] = useState(null);
  const [togglingStatusId, setTogglingStatusId] = useState(null);

  const refreshEmployees = () => useHRStore.getState().getEmployees?.().catch(() => {});

  const handleEmployeeFormSubmit = async (payload) => {
    if (editingEmp) {
      await api.put(`/hr/employees/${editingEmp.id}`, payload);
      notify('Đã cập nhật hồ sơ nhân viên.', 'success');
    } else {
      await api.post('/hr/employees', payload);
      notify(`Đã tạo hồ sơ ${payload.fullName}. Tài khoản đăng nhập: ${payload.email} / 123456.`, 'success');
    }
    await refreshEmployees();
    setShowAddEmpModal(false);
    setEditingEmp(null);
  };

  const handleToggleStatus = async (emp) => {
    if (typeof setEmployeeStatus !== 'function') return;
    const nextStatus = emp.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    setTogglingStatusId(emp.id);
    try {
      await setEmployeeStatus(emp.id, nextStatus);
      notify(nextStatus === 'INACTIVE' ? `Đã vô hiệu hóa tài khoản ${emp.fullname}.` : `Đã kích hoạt lại tài khoản ${emp.fullname}.`, 'success');
    } catch (err) {
      notify(err.message || 'Không thể cập nhật trạng thái.', 'error');
    } finally {
      setTogglingStatusId(null);
    }
  };

  const handleResetPassword = async (emp) => {
    if (typeof resetEmployeePassword !== 'function') return;
    try {
      const res = await resetEmployeePassword(emp.id);
      notify(res?.message || `Đã đặt lại mật khẩu cho ${emp.fullname} về mặc định.`, 'success');
    } catch (err) {
      notify(err.message || 'Không thể đặt lại mật khẩu.', 'error');
    }
  };

  // Search & Filter
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Date management state
  const today = new Date();
  const formatInputDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  const [inputDate, setInputDate] = useState(formatInputDate(today));
  const [selectedDate, setSelectedDate] = useState(today.toLocaleDateString('vi-VN'));

  const handleDateChange = (val) => {
    setInputDate(val);
    if (!val) return;
    const parts = val.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      setSelectedDate(d.toLocaleDateString('vi-VN'));
    }
  };

  const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

  // Helper to fetch status from log list safely
  const getEmployeeStatusForDate = (empId, dateStr) => {
    const log = (attendanceLogs || []).find(l => l && l.empId === empId && l.date === dateStr);
    return log ? log.status : 'UNMARKED';
  };


  const attendanceForSelectedDate = useMemo(() => {
    const present = employees.filter(e => getEmployeeStatusForDate(e.id, selectedDate) === 'PRESENT').length;
    const late = employees.filter(e => getEmployeeStatusForDate(e.id, selectedDate) === 'LATE').length;
    const absent = employees.filter(e => getEmployeeStatusForDate(e.id, selectedDate) === 'ABSENT').length;
    return { present, late, absent };
  }, [employees, attendanceLogs, selectedDate]);

  const totalEmployees = (employees || []).filter(e => e.status !== 'INACTIVE').length;
  const presentCount = attendanceForSelectedDate.present;
  const lateCount = attendanceForSelectedDate.late;
  const absentCount = attendanceForSelectedDate.absent;
  
  const attendanceRate = totalEmployees > 0
    ? Math.round(((presentCount + lateCount) / totalEmployees) * 100)
    : 0;

  const pendingLeavesCount = (leaveRequests || []).filter(r => r && (r.status === 'PENDING' || r.status === 'PENDING_CEO')).length;

  // Quỹ lương cố định = lương cơ bản + phụ cấp chức vụ + phụ cấp ăn trưa/đi lại của nhân viên đang làm việc.
  const activeEmployees = (employees || []).filter(e => e.status !== 'INACTIVE');
  const totalBaseSalaryFund = activeEmployees.reduce((sum, e) => sum + (Number(e.baseSalary ?? e.salary) || 0) + (Number(e.responsibilityAllowance) || 0) + (Number(e.allowance) || 0), 0);
  const departmentCount = new Set(activeEmployees.map(e => e.department).filter(Boolean)).size;
  const faceRegisteredCount = activeEmployees.filter(e => e.hasFace).length;

  const stats = [
    { label: 'Tổng Nhân Sự Đang Làm Việc', value: `${activeEmployees.length} nhân sự`, change: `${departmentCount} phòng ban · ${faceRegisteredCount} đã đăng ký khuôn mặt`, icon: <Users size={20} />, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Có Mặt Đúng Giờ', value: `${presentCount} nhân viên`, change: `Ngày ${selectedDate}`, icon: <CheckCircle size={20} />, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Đi Muộn / Vắng Mặt', value: `${lateCount + absentCount} trường hợp`, change: `${lateCount} đi muộn · ${absentCount} vắng`, icon: <Clock size={20} />, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Đơn Nghỉ Phép Chờ Duyệt', value: `${pendingLeavesCount} đơn phép`, change: 'Cần Nhân Sự phê duyệt', icon: <CalendarCheck size={20} />, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Quỹ Lương Cố Định Tháng', value: fmt(totalBaseSalaryFund), change: 'Lương cơ bản + phụ cấp (chưa gồm tăng ca, hoa hồng)', icon: <DollarSign size={20} />, color: '#0ea5e9', bg: '#f0f9ff' },
    { label: 'Tỷ Lệ Chuyên Cần Trong Ngày', value: `${attendanceRate}%`, change: 'Mục tiêu doanh nghiệp ≥ 95%', icon: <Award size={20} />, color: '#ec4899', bg: '#fdf2f8' }
  ];

  // Chart 1: Department Distribution Doughnut
  const deptCounts = {};
  activeEmployees.forEach(emp => {
    const dept = emp.department || 'Khác';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });
  const deptChartData = {
    labels: Object.keys(deptCounts),
    datasets: [
      {
        data: Object.values(deptCounts),
        backgroundColor: ['#3b82f6', '#10b981', '#0ea5e9', '#ec4899', '#f59e0b', '#8b5cf6', '#64748b']
      }
    ]
  };

  // Chart 2: chuyên cần 6 ngày làm việc gần nhất, lấy từ dữ liệu chấm công thật.
  const recentWorkdays = [];
  for (let d = new Date(today); recentWorkdays.length < 6; d.setDate(d.getDate() - 1)) {
    if (d.getDay() !== 0) recentWorkdays.unshift(new Date(d));
  }
  const countFor = (day, statuses) => (attendanceLogs || []).filter(l => l && l.date === day.toLocaleDateString('vi-VN') && statuses.includes(l.status)).length;
  const weeklyAttendanceData = {
    labels: recentWorkdays.map(d => `${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`),
    datasets: [
      { label: 'Có Mặt Đúng Giờ', data: recentWorkdays.map(d => countFor(d, ['PRESENT'])), backgroundColor: '#16a34a' },
      { label: 'Đi Muộn', data: recentWorkdays.map(d => countFor(d, ['LATE'])), backgroundColor: '#f59e0b' },
      { label: 'Vắng Mặt', data: recentWorkdays.map(d => countFor(d, ['ABSENT'])), backgroundColor: '#ef4444' }
    ]
  };

  // Kỳ lương gần nhất để hiển thị ở thẻ tổng hợp.
  const latestPeriod = (payrolls || []).map(p => p.period).filter(p => /^\d{4}-\d{2}$/.test(p)).sort().pop();
  const latestPayrolls = (payrolls || []).filter(p => p.period === latestPeriod);
  const latestBonuses = latestPayrolls.reduce((s, p) => s + (Number(p.bonuses) || 0), 0);
  const latestNet = latestPayrolls.reduce((s, p) => s + (Number(p.netAmount) || 0), 0);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = search.toLowerCase();
      const matchSearch = !search || 
        emp.fullname?.toLowerCase().includes(q) || 
        emp.username?.toLowerCase().includes(q) || 
        emp.role?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q);
      const matchRole = roleFilter === 'ALL' || emp.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [employees, search, roleFilter]);

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={24} style={{ color: '#2563eb' }} />
            {activeTab === 'overview' && 'Tổng Quan Nhân Sự Toàn Doanh Nghiệp'}
            {activeTab === 'attendance' && 'Chấm Công & Giám Sát Chuyên Cần Hàng Ngày'}
            {activeTab === 'employees' && 'Hồ Sơ Nhân Sự & Hợp Đồng Lao Động'}
            {activeTab === 'leaves' && 'Quản Lý Đơn Xin Nghỉ Phép'}
            {activeTab === 'payroll' && 'Tính Lương & Trình Ban Giám Đốc Phê Duyệt'}
            {activeTab === 'timesheet' && 'Bảng Công Tháng'}
            {activeTab === 'settings' && 'Cấu Hình Chấm Công & Tính Lương'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            Quản trị nhân sự, theo dõi chấm công, phê duyệt nghỉ phép và tính toán chế độ đãi ngộ
          </p>
        </div>

        {activeTab === 'employees' && (
          <button
            onClick={() => { setEditingEmp(null); setShowAddEmpModal(true); }}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <UserPlus size={16} />
            <span>Thêm Nhân Viên Mới</span>
          </button>
        )}

      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN NHÂN SỰ) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          <ActorNotificationBar />
          {/* 6 Balanced KPI Cards (2 Rows x 3 Columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
            {stats.map((st, sIdx) => (
              <div
                key={sIdx}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  padding: '1.1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '102px',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {st.label}
                  </span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: st.bg, color: st.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {st.icon}
                  </div>
                </div>

                <div style={{ marginTop: '0.45rem' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {st.value}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                    {st.change}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', height: '320px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Phân Bổ Nhân Sự Theo Phòng Ban
              </h3>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={deptChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
                  }}
                />
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', height: '320px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Hiệu Suất Chuyên Cần Trong Tuần
              </h3>
              <div style={{ flex: 1, position: 'relative' }}>
                <Bar
                  data={weeklyAttendanceData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
                    scales: {
                      y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                      x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Quick Hub: Pending Leaves & Recent Attendance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
                Đơn Xin Nghỉ Phép Cần Duyệt Gấp
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {leaveRequests.filter(l => l.status === 'PENDING' || l.status === 'PENDING_CEO').slice(0, 3).map((l, lIdx) => (
                  <div key={l.id || lIdx} style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{l.employee?.fullName || `Nhân viên #${l.employeeId ?? l.id}`}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Lý do: {l.reason || 'Nghỉ ốm'} (Từ {l.startDate ? new Date(l.startDate).toLocaleDateString('vi-VN') : '---'})</span>
                    </div>
                    <button
                      onClick={() => setTab('leaves')}
                      style={{ backgroundColor: '#8b5cf6', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Duyệt Đơn
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
                Tổng Hợp Quỹ Lương
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>Lương + phụ cấp cố định / tháng:</span>
                  <strong>{fmt(totalBaseSalaryFund)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>Tăng ca, hoa hồng, thưởng {latestPeriod ? `kỳ ${latestPeriod}` : '(chưa có kỳ lương)'}:</span>
                  <strong style={{ color: '#16a34a' }}>+ {fmt(latestBonuses)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>Tổng thực lĩnh {latestPeriod ? `kỳ ${latestPeriod}` : ''}:</span>
                  <strong>{fmt(latestNet)}</strong>
                </div>
                <button
                  onClick={() => setTab('payroll')}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Xem Bảng Lương Chi Tiết
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ATTENDANCE (CHẤM CÔNG HÀNG NGÀY) */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <AttendancePanel employees={employees} onChanged={() => useHRStore.getState().getAttendanceLogs?.().catch(() => {})} />
      )}

      {activeTab === 'timesheet' && <TimesheetPanel />}

      {activeTab === 'settings' && <HrSettingsPanel />}

      {/* ========================================================================= */}
      {/* TAB 3: EMPLOYEES (HỒ SƠ NHÂN VIÊN) */}
      {/* ========================================================================= */}
      {activeTab === 'employees' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <input
                type="text"
                placeholder="Tìm nhân viên theo tên, username, chức vụ..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>Lọc Phòng Ban:</span>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', color: '#0f172a' }}
              >
                <option value="ALL">Tất cả chức danh</option>
                {Object.keys(ROLE_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã NV</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Họ và Tên</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Đăng nhập</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Chức Danh</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Phòng Ban</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Lương + Phụ Cấp</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Khuôn Mặt</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, eIdx) => (
                  <tr key={emp.id || eIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#64748b' }}>{emp.employeeCode || `NV-${emp.id}`}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: emp.status === 'INACTIVE' ? '#94a3b8' : '#0f172a' }}>
                      {emp.fullname}
                      {emp.status === 'INACTIVE' && <span style={{ marginLeft: '0.35rem', fontSize: '0.65rem', color: '#dc2626', fontWeight: 800 }}>ĐÃ NGHỈ</span>}
                      {emp.jobTitle && <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>{emp.jobTitle}</div>}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <code style={{ fontSize: '0.78rem', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                        {emp.username}
                      </code>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: `${ROLE_COLORS[emp.role] || '#6366f1'}15`, color: ROLE_COLORS[emp.role] || '#6366f1' }}>
                          {getRoleName(emp.role)}
                        </span>
                        {emp.role === 'DELIVERY' && emp.deliveryRegion && (
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe'
                          }}>
                            {DELIVERY_REGIONS.find(r => r.code === emp.deliveryRegion)?.shortName || emp.deliveryRegion}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>{emp.department || 'Kinh Doanh'}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {fmt(emp.salary || emp.baseSalary)}
                      {(Number(emp.responsibilityAllowance) > 0 || Number(emp.allowance) > 0) && (
                        <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>+ {fmt(Number(emp.responsibilityAllowance || 0) + Number(emp.allowance || 0))} PC</div>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setFaceEmp(emp)}
                        title={emp.hasFace ? 'Đã đăng ký khuôn mặt — bấm để xem/đặt lại' : 'Chưa đăng ký — bấm để đăng ký hộ'}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', backgroundColor: emp.hasFace ? '#f0fdf4' : '#fffbeb', color: emp.hasFace ? '#16a34a' : '#d97706', border: `1px solid ${emp.hasFace ? '#bbf7d0' : '#fde68a'}`, borderRadius: '12px', padding: '0.2rem 0.55rem', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                      >
                        <ScanFace size={12} /> {emp.hasFace ? 'Đã đăng ký' : 'Chưa có'}
                      </button>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setViewingEmpDetail(emp)}
                          style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Hồ Sơ
                        </button>
                        <button
                          onClick={() => { setShowAddEmpModal(false); setEditingEmp(emp); }}
                          style={{ backgroundColor: '#ffffff', color: '#d97706', border: '1px solid #fde68a', borderRadius: '4px', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleResetPassword(emp)}
                          title="Đặt lại mật khẩu về mặc định (123456)"
                          style={{ backgroundColor: '#ffffff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: '4px', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Reset MK
                        </button>
                        <button
                          onClick={() => handleToggleStatus(emp)}
                          disabled={togglingStatusId === emp.id}
                          style={{
                            backgroundColor: '#ffffff',
                            color: emp.status === 'INACTIVE' ? '#16a34a' : '#dc2626',
                            border: `1px solid ${emp.status === 'INACTIVE' ? '#bbf7d0' : '#fecaca'}`,
                            borderRadius: '4px', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 700,
                            cursor: togglingStatusId === emp.id ? 'default' : 'pointer'
                          }}
                        >
                          {emp.status === 'INACTIVE' ? 'Kích Hoạt' : 'Vô Hiệu Hóa'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LEAVES (QUẢN LÝ NGHỈ PHÉP) */}
      {/* ========================================================================= */}
      {activeTab === 'leaves' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CalendarCheck size={18} style={{ color: '#8b5cf6' }} />
                <span>Danh Sách Đơn Xin Nghỉ Phép Của Nhân Sự</span>
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0.2rem 0 0 0' }}>
                Phê duyệt chế độ nghỉ phép năm, nghỉ ốm và việc riêng cho cán bộ nhân viên
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateLeaveModal(true)}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.55rem 1.25rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              + Tạo Đơn Nghỉ Phép
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Nhân Viên</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Loại Nghỉ Phép</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Khoảng Thời Gian</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Lý Do Xin Nghỉ</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Trạng Thái</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác HR</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((lv, lIdx) => (
                  <tr key={lv.id || lIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{lv.employee?.fullName || `Nhân viên #${lv.employeeId ?? lv.id}`}</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#2563eb', fontWeight: 600 }}>{lv.type || 'Phép Năm'}</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                      {lv.startDate ? new Date(lv.startDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : '---'} → {lv.endDate ? new Date(lv.endDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : '---'}
                      {lv.days != null && <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 700 }}>{lv.days} ngày làm việc</div>}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#64748b' }}>"{lv.reason || 'Có việc gia đình'}"</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      {/* Bất kỳ trạng thái nào khác APPROVED/REJECTED (kể cả PENDING_CEO) đều coi là "Chờ Duyệt" — giữ đúng hành vi gốc trước khi có dictionary chung. */}
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        backgroundColor: getStatusInfo(LEAVE_STATUS, ['APPROVED', 'REJECTED'].includes(lv.status) ? lv.status : 'PENDING').bg,
                        color: getStatusInfo(LEAVE_STATUS, ['APPROVED', 'REJECTED'].includes(lv.status) ? lv.status : 'PENDING').color
                      }}>
                        {getStatusLabel(LEAVE_STATUS, ['APPROVED', 'REJECTED'].includes(lv.status) ? lv.status : 'PENDING')}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      {lv.status === 'PENDING' || lv.status === 'PENDING_CEO' ? (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                          <button
                            onClick={() => {
                              approveLeaveRequest(lv.id)
                                .then(() => notify('Đã duyệt đơn xin nghỉ phép.', 'success'))
                                .catch(err => notify(err.message || 'Không thể duyệt đơn nghỉ phép.', 'error'));
                            }}
                            style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            ✓ Duyệt
                          </button>
                          <button
                            onClick={async () => {
                              const reason = await promptText('Lý do từ chối đơn nghỉ phép:', '');
                              if (reason === null) return;
                              rejectLeaveRequest(lv.id, reason)
                                .then(() => notify('✕ Đã từ chối đơn nghỉ phép.', 'info'))
                                .catch(err => notify(err.message || 'Không thể từ chối đơn nghỉ phép.', 'error'));
                            }}
                            style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ✕ Từ Chối
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Đã xử lý</span>
                      )}
                    </td>
                  </tr>
                ))}
                {leaveRequests.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                      <CalendarCheck size={38} style={{ margin: '0 auto 0.6rem', display: 'block', opacity: 0.35 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#64748b' }}>Hiện chưa có đơn xin nghỉ phép nào</div>
                      <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Các đơn xin nghỉ phép của cán bộ nhân sự gửi lên sẽ xuất hiện tại đây để HR/CEO xét duyệt.</div>
                      <button
                        type="button"
                        onClick={() => setShowCreateLeaveModal(true)}
                        style={{ marginTop: '0.85rem', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.45rem 1.1rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Tạo Đơn Xin Nghỉ Mới
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PAYROLL (BẢNG LƯƠNG & TRÌNH CEO) */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && <PayrollPanel />}

      {/* ================= MODAL: THÊM / SỬA HỒ SƠ NHÂN VIÊN ================= */}
      {(showAddEmpModal || editingEmp) && (
        <EmployeeFormModal
          employee={editingEmp}
          onClose={() => { setShowAddEmpModal(false); setEditingEmp(null); }}
          onSubmit={handleEmployeeFormSubmit}
        />
      )}

      {faceEmp && <FaceAdminModal employee={faceEmp} onClose={() => setFaceEmp(null)} onChanged={refreshEmployees} />}

      {/* ================= MODAL: XEM HỒ SƠ CHI TIẾT ================= */}
      {viewingEmpDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '520px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Hồ Sơ Nhân Sự #{viewingEmpDetail.id}</h3>
              <button onClick={() => setViewingEmpDetail(null)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
              <div><strong>Họ và tên:</strong> {viewingEmpDetail.fullname}</div>
              <div><strong>Tài khoản đăng nhập:</strong> <code style={{ color: '#2563eb' }}>{viewingEmpDetail.username}</code></div>
              <div><strong>Chức danh:</strong> <span style={{ fontWeight: 800, color: ROLE_COLORS[viewingEmpDetail.role] }}>{getRoleName(viewingEmpDetail.role)}</span></div>
              <div><strong>Phòng ban:</strong> {viewingEmpDetail.department || 'Kinh Doanh'}</div>
              <div><strong>Chức vụ:</strong> {viewingEmpDetail.jobTitle || '—'}</div>
              <div><strong>Ngày vào làm:</strong> {viewingEmpDetail.hireDate ? new Date(viewingEmpDetail.hireDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : '—'}</div>
              <div><strong>Lương cơ bản:</strong> <strong style={{ color: '#16a34a' }}>{fmt(viewingEmpDetail.salary || viewingEmpDetail.baseSalary)}</strong></div>
              <div><strong>Phụ cấp chức vụ (đóng BH):</strong> {fmt(viewingEmpDetail.responsibilityAllowance)}</div>
              <div><strong>Phụ cấp ăn trưa, đi lại:</strong> {fmt(viewingEmpDetail.allowance)}</div>
              <div><strong>Người phụ thuộc:</strong> {viewingEmpDetail.dependents || 0} · <strong>Phép năm cơ bản:</strong> {viewingEmpDetail.annualLeaveQuota || 12} ngày</div>
              <div><strong>CCCD:</strong> {viewingEmpDetail.idNumber || '—'} · <strong>MST cá nhân:</strong> {viewingEmpDetail.personalTaxCode || '—'}</div>
              <div><strong>Tài khoản nhận lương:</strong> {viewingEmpDetail.bankAccount || '—'} {viewingEmpDetail.bankName ? `(${viewingEmpDetail.bankName})` : ''}</div>
              <div><strong>Chấm công khuôn mặt:</strong> {viewingEmpDetail.hasFace ? <span style={{ color: '#16a34a', fontWeight: 700 }}>Đã đăng ký</span> : <span style={{ color: '#d97706', fontWeight: 700 }}>Chưa đăng ký</span>}</div>
              <div><strong>Trạng thái lao động:</strong> {viewingEmpDetail.status === 'INACTIVE' ? <span style={{ color: '#dc2626', fontWeight: 700 }}>Đã nghỉ việc</span> : <span style={{ color: '#16a34a', fontWeight: 700 }}>Đang làm việc</span>}</div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setViewingEmpDetail(null)}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Đóng
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: TẠO ĐƠN XIN NGHỈ PHÉP ================= */}
      {showCreateLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.5rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CalendarCheck size={20} style={{ color: '#8b5cf6' }} />
                <span>Tạo Đơn Xin Nghỉ Phép</span>
              </h3>
              <button onClick={() => setShowCreateLeaveModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateLeaveModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>Nhân Viên Xin Nghỉ</label>
                <select
                  value={leaveModalForm.employeeId}
                  onChange={e => setLeaveModalForm({ ...leaveModalForm, employeeId: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.82rem', backgroundColor: '#fff' }}
                >
                  <option value="">-- Chính tôi ({user?.fullname || user?.username || 'HR'}) --</option>
                  {employees.filter(e => e.status === 'ACTIVE').map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullname || emp.fullName} ({emp.department} - {emp.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>Loại Nghỉ Phép *</label>
                <select
                  value={leaveModalForm.type}
                  onChange={e => setLeaveModalForm({ ...leaveModalForm, type: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.82rem', backgroundColor: '#fff' }}
                >
                  <option value="Phép Năm">Nghỉ Phép Năm</option>
                  <option value="Nghỉ Ốm">Nghỉ Ốm / Điều Trị Y Tế</option>
                  <option value="Việc Riêng">Việc Riêng (Có Lương)</option>
                  <option value="Nghỉ Thai Sản">Chế Độ Thai Sản</option>
                  <option value="Không Lương">Nghỉ Không Lương (Trừ Công)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>Từ Ngày *</label>
                  <input
                    type="date"
                    required
                    value={leaveModalForm.startDate}
                    onChange={e => setLeaveModalForm({ ...leaveModalForm, startDate: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>Đến Ngày *</label>
                  <input
                    type="date"
                    required
                    value={leaveModalForm.endDate}
                    onChange={e => setLeaveModalForm({ ...leaveModalForm, endDate: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>Lý Do Xin Nghỉ</label>
                <textarea
                  rows={3}
                  placeholder="Nhập lý do cụ thể..."
                  value={leaveModalForm.reason}
                  onChange={e => setLeaveModalForm({ ...leaveModalForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.82rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateLeaveModal(false)}
                  style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', color: '#64748b' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingLeaveModal}
                  style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700, cursor: submittingLeaveModal ? 'not-allowed' : 'pointer' }}
                >
                  {submittingLeaveModal ? 'Đang gửi...' : 'Gửi Đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
