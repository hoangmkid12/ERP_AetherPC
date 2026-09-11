import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHRStore, useUtilityStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { DELIVERY_REGIONS } from '../../utils/deliveryRegions';
import { ATTENDANCE_STATUS, LEAVE_STATUS, PAYROLL_STATUS, getStatusInfo, getStatusLabel } from '../../utils/statusLabels';
import { notify } from '../../context/NotificationContext';
import { 
  Users, UserPlus, CheckCircle, Clock, XCircle, DollarSign, CalendarCheck, 
  Key, Eye, EyeOff, Search, FileEdit, Award, Sparkles, Check, X, Calendar, 
  Clipboard, Send, RefreshCw, Briefcase, Filter, ShieldCheck, AlertCircle, ChevronRight, 
  Edit3, User, Printer, Phone, Mail, MapPin, CreditCard, Building, TrendingUp, AlertTriangle
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
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
  DELIVERY: '#64748b'
};

const DEPARTMENTS = [
  'Ban Giám Đốc', 'Kinh Doanh', 'Kho Vận', 'Mua Hàng', 'Kiểm Định QA/QC',
  'Kỹ Thuật Lắp Ráp', 'Nhân Sự', 'Kế Toán', 'Chăm Sóc KH', 'Giao Vận', 'IT'
];

export default function HRManager() {
  const employees = useHRStore(state => state.employees) || [];
  const attendanceLogs = useHRStore(state => state.attendanceLogs) || [];
  const updateAttendanceLog = useHRStore(state => state.updateAttendanceLogSync || state.updateAttendanceLog);
  const addEmployee = useHRStore(state => state.addEmployee);
  const updateEmployee = useHRStore(state => state.updateEmployee);
  const deleteEmployee = useHRStore(state => state.deleteEmployee);
  const setEmployeeStatus = useHRStore(state => state.setEmployeeStatus);
  const resetEmployeePassword = useHRStore(state => state.resetEmployeePassword);
  const leaveRequests = useHRStore(state => state.leaveRequests) || [];
  const approveLeaveRequest = useHRStore(state => state.approveLeaveRequest);
  const rejectLeaveRequest = useHRStore(state => state.rejectLeaveRequest);
  const payrolls = useHRStore(state => state.payrolls) || [];
  const submitPayrolls = useHRStore(state => state.submitPayrolls);
  const assemblyJobs = useUtilityStore(state => state.assemblyJobs) || [];
  const { isCEO } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab from URL (?tab=overview|attendance|employees|leaves|payroll)
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab = (tKey) => {
    setSearchParams({ tab: tKey });
    setSearch('');
  };

  // New employee form state
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [newEmpForm, setNewEmpForm] = useState({
    fullname: '',
    username: '',
    role: 'SALES',
    department: 'Kinh Doanh',
    deliveryRegion: 'HCM_KV1',
    phone: '',
    salary: '8500000'
  });

  // Edit employee state
  const [editingEmp, setEditingEmp] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [viewingEmpDetail, setViewingEmpDetail] = useState(null);
  const [togglingStatusId, setTogglingStatusId] = useState(null);

  const openEditModal = (emp) => {
    setEditingEmp(emp);
    setEditForm({
      fullName: emp.fullname || emp.fullName || '',
      department: emp.department || 'Kinh Doanh',
      role: emp.role || 'SALES',
      phone: emp.phone || '',
      deliveryRegion: emp.deliveryRegion || 'HCM_KV1',
      baseSalary: emp.salary || emp.baseSalary || 0
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEmp || typeof updateEmployee !== 'function') return;
    setSavingEdit(true);
    try {
      await updateEmployee(editingEmp.id, {
        fullName: editForm.fullName,
        department: editForm.department,
        role: editForm.role,
        phone: editForm.role === 'DELIVERY' ? editForm.phone : editForm.phone,
        deliveryRegion: editForm.role === 'DELIVERY' ? editForm.deliveryRegion : null,
        baseSalary: editForm.baseSalary
      });
      notify('Đã cập nhật hồ sơ nhân viên.', 'success');
      setEditingEmp(null);
      setEditForm(null);
    } catch (err) {
      notify(`Cập nhật thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setSavingEdit(false);
    }
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

  const handleMarkAttendance = (empId, dateStr, status) => {
    if (typeof updateAttendanceLog !== 'function') return;
    updateAttendanceLog(empId, dateStr, status).catch(err => notify(err.message || 'Không thể lưu chấm công.', 'error'));
  };

  const attendanceForSelectedDate = useMemo(() => {
    const present = employees.filter(e => getEmployeeStatusForDate(e.id, selectedDate) === 'PRESENT').length;
    const late = employees.filter(e => getEmployeeStatusForDate(e.id, selectedDate) === 'LATE').length;
    const absent = employees.filter(e => getEmployeeStatusForDate(e.id, selectedDate) === 'ABSENT').length;
    return { present, late, absent };
  }, [employees, attendanceLogs, selectedDate]);

  const totalEmployees = (employees || []).length;
  const presentCount = attendanceForSelectedDate.present;
  const lateCount = attendanceForSelectedDate.late;
  const absentCount = attendanceForSelectedDate.absent;
  
  const attendanceRate = totalEmployees > 0 
    ? Math.round(((presentCount + lateCount) / totalEmployees) * 100) 
    : 96;

  const pendingLeavesCount = (leaveRequests || []).filter(r => r && (r.status === 'PENDING' || r.status === 'PENDING_CEO')).length;

  const totalBaseSalaryFund = (employees || []).reduce((sum, e) => sum + (parseInt(e.salary || e.baseSalary || 0)), 0);

  const stats = [
    { label: 'Tổng Nhân Sự Toàn Công Ty', value: `${totalEmployees} nhân sự`, change: '11 phòng ban chức năng', icon: <Users size={20} />, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Điểm Danh Đúng Giờ', value: `${presentCount || Math.max(1, totalEmployees - 2)} nhân viên`, change: `Ngày ${selectedDate}`, icon: <CheckCircle size={20} />, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Đi Muộn / Vắng Mặt', value: `${lateCount + absentCount || 1} trường hợp`, change: 'Cần lưu ý nhắc nhở', icon: <Clock size={20} />, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Đơn Nghỉ Phép Chờ Duyệt', value: `${pendingLeavesCount} đơn phép`, change: 'Cần HR & CEO phê duyệt', icon: <CalendarCheck size={20} />, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Quỹ Lương Cơ Bản Tháng', value: fmt(totalBaseSalaryFund), change: 'Dự toán ngân sách lương cứng', icon: <DollarSign size={20} />, color: '#0ea5e9', bg: '#f0f9ff' },
    { label: 'Tỷ Lệ Chuyên Cần (SLA)', value: `${attendanceRate}%`, change: 'Mục tiêu doanh nghiệp ≥ 95%', icon: <Award size={20} />, color: '#ec4899', bg: '#fdf2f8' }
  ];

  // Chart 1: Department Distribution Doughnut
  const deptCounts = {};
  employees.forEach(emp => {
    const dept = emp.department || 'Kinh Doanh';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });
  const deptChartData = {
    labels: Object.keys(deptCounts).length > 0 ? Object.keys(deptCounts) : ['Kinh Doanh', 'Kho Vận', 'Kỹ Thuật', 'Kế Toán', 'Khác'],
    datasets: [
      {
        data: Object.values(deptCounts).length > 0 ? Object.values(deptCounts) : [4, 3, 2, 2, 1],
        backgroundColor: ['#3b82f6', '#10b981', '#0ea5e9', '#ec4899', '#f59e0b', '#8b5cf6', '#64748b']
      }
    ]
  };

  // Chart 2: Weekly Attendance Performance Bar
  const weeklyAttendanceData = {
    labels: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'],
    datasets: [
      {
        label: 'Có Mặt Đúng Giờ',
        data: [12, 14, 13, 15, 14, 11],
        backgroundColor: '#16a34a'
      },
      {
        label: 'Đi Muộn / Nghỉ Phép',
        data: [2, 0, 1, 0, 1, 3],
        backgroundColor: '#f59e0b'
      }
    ]
  };

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

  // Bảng lương thật — sắp xếp mới nhất trước, theo đúng dữ liệu server tính
  // (26 ngày công, khấu trừ bảo hiểm 10.5%, hoa hồng/thưởng lắp ráp thật).
  const sortedPayrolls = useMemo(() => {
    return [...payrolls].sort((a, b) => {
      if (a.period !== b.period) return String(b.period).localeCompare(String(a.period));
      return (a.empName || '').localeCompare(b.empName || '');
    });
  }, [payrolls]);

  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const handleAddEmployee = async () => {
    if (!newEmpForm.fullname || !newEmpForm.username || !newEmpForm.salary) {
      notify('Vui lòng điền đầy đủ họ tên, username và lương cơ bản!', 'error');
      return;
    }
    if (typeof addEmployee !== 'function') return;
    const regionToSave = newEmpForm.role === 'DELIVERY' ? newEmpForm.deliveryRegion : null;
    const phoneToSave = newEmpForm.role === 'DELIVERY' ? newEmpForm.phone : '';
    setCreatingEmployee(true);
    try {
      await addEmployee(newEmpForm.fullname, newEmpForm.username, newEmpForm.role, newEmpForm.salary, newEmpForm.department, regionToSave, phoneToSave);
      setNewEmpForm({ fullname: '', username: '', role: 'SALES', department: 'Kinh Doanh', deliveryRegion: 'HCM_KV1', phone: '', salary: '8500000' });
      setShowAddEmpModal(false);
      notify('Đã tạo hồ sơ nhân viên mới thành công.', 'success');
    } catch (err) {
      notify(`Tạo nhân viên thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setCreatingEmployee(false);
    }
  };

  const [submittingPayroll, setSubmittingPayroll] = useState(false);
  const handleSubmitPayrollToCEO = async () => {
    if (typeof submitPayrolls !== 'function') return;
    const period = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    setSubmittingPayroll(true);
    try {
      await submitPayrolls(period);
      notify(`Đã lập bảng lương kỳ ${period} và gửi lên Ban Giám Đốc (CEO) để phê duyệt.`, 'success');
    } catch (err) {
      notify(`Không thể lập bảng lương: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setSubmittingPayroll(false);
    }
  };

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
            {activeTab === 'payroll' && 'Tổng Hợp Bảng Lương & Trình CEO Phê Duyệt'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            Quản trị nhân sự, theo dõi chấm công, phê duyệt nghỉ phép và tính toán chế độ đãi ngộ
          </p>
        </div>

        {activeTab === 'employees' && (
          <button
            onClick={() => setShowAddEmpModal(true)}
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

        {activeTab === 'payroll' && (
          <button
            onClick={handleSubmitPayrollToCEO}
            disabled={submittingPayroll}
            style={{
              backgroundColor: submittingPayroll ? '#9ca3af' : '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.45rem 1.1rem',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: submittingPayroll ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Send size={15} />
            <span>{submittingPayroll ? 'Đang xử lý...' : 'Trình CEO Phê Duyệt Lương'}</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN NHÂN SỰ) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
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
                Tổng Hợp Bảng Lương Dự Kiến Tháng
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>Lương Cứng Cơ Bản:</span>
                  <strong>{fmt(totalBaseSalaryFund)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>Thưởng Doanh Số & Lắp Ráp:</span>
                  <strong style={{ color: '#16a34a' }}>+ 12.500.000 ₫</strong>
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
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>Ngày Chấm Công:</label>
              <input
                type="date"
                value={inputDate}
                onChange={e => handleDateChange(e.target.value)}
                style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
              <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 700, backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '6px' }}>
                Đang xem: {selectedDate}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>
                ✓ Có mặt: {presentCount}
              </span>
              <span style={{ fontSize: '0.75rem', backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>
                Đi muộn: {lateCount}
              </span>
              <span style={{ fontSize: '0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>
                ✕ Vắng mặt: {absentCount}
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã NV</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Họ và Tên</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Phòng Ban & Chức Danh</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Trạng Thái Hiện Tại</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác Chấm Nhanh</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, eIdx) => {
                  const currentStatus = getEmployeeStatusForDate(emp.id, selectedDate);
                  return (
                    <tr key={emp.id || eIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#64748b' }}>NV-{emp.id || eIdx + 1}</td>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{emp.fullname}</td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: `${ROLE_COLORS[emp.role] || '#6366f1'}15`, color: ROLE_COLORS[emp.role] || '#6366f1' }}>
                          {emp.role}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.4rem' }}>({emp.department || 'Kinh Doanh'})</span>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        {/* 'Chưa chấm' không phải trạng thái backend thật (PRESENT/LATE/ABSENT) — là suy diễn phía client khi chưa có dữ liệu chấm công, nên không đưa vào dictionary chung. */}
                        {['PRESENT', 'LATE', 'ABSENT'].includes(currentStatus) ? (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            backgroundColor: getStatusInfo(ATTENDANCE_STATUS, currentStatus).bg,
                            color: getStatusInfo(ATTENDANCE_STATUS, currentStatus).color
                          }}>
                            {getStatusLabel(ATTENDANCE_STATUS, currentStatus)}
                          </span>
                        ) : (
                          <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#64748b' }}>
                            Chưa chấm
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                          <button
                            onClick={() => handleMarkAttendance(emp.id, selectedDate, 'PRESENT')}
                            style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Có Mặt
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(emp.id, selectedDate, 'LATE')}
                            style={{ backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Đi Muộn
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(emp.id, selectedDate, 'ABSENT')}
                            style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Vắng
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <th style={{ padding: '0.65rem 0.85rem' }}>Username</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Chức Danh</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Phòng Ban</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Lương Cơ Bản</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, eIdx) => (
                  <tr key={emp.id || eIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#64748b' }}>NV-{emp.id || eIdx + 1}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{emp.fullname}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <code style={{ fontSize: '0.78rem', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                        {emp.username}
                      </code>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: `${ROLE_COLORS[emp.role] || '#6366f1'}15`, color: ROLE_COLORS[emp.role] || '#6366f1' }}>
                          {emp.role}
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
                          onClick={() => openEditModal(emp)}
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
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CalendarCheck size={18} style={{ color: '#8b5cf6' }} />
            <span>Danh Sách Đơn Xin Nghỉ Phép Của Nhân Sự</span>
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '1.25rem' }}>
            Phê duyệt chế độ nghỉ phép năm, nghỉ ốm và việc riêng cho cán bộ nhân viên
          </p>

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
                    <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>{lv.startDate ? new Date(lv.startDate).toLocaleDateString('vi-VN') : '---'} → {lv.endDate ? new Date(lv.endDate).toLocaleDateString('vi-VN') : '---'}</td>
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
                            onClick={() => {
                              rejectLeaveRequest(lv.id)
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PAYROLL (BẢNG LƯƠNG & TRÌNH CEO) */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Bảng Lương Thật (Kỳ {today.getMonth() + 1}/{today.getFullYear()} và các kỳ trước)
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
                Theo 26 ngày công, khấu trừ 10.5% bảo hiểm (BHXH+BHYT+BHTN), hoa hồng Sales theo doanh số thật, thưởng lắp ráp theo số máy đã hoàn thành thật
              </p>
            </div>

            <button
              onClick={handleSubmitPayrollToCEO}
              disabled={submittingPayroll}
              style={{ backgroundColor: submittingPayroll ? '#9ca3af' : '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: submittingPayroll ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Send size={15} /> {submittingPayroll ? 'Đang xử lý...' : `Lập Bảng Lương Kỳ ${today.getMonth() + 1}/${today.getFullYear()}`}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Kỳ Lương</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Họ và Tên</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Chức Danh</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Lương Theo Công</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Thưởng/Phụ Cấp</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Khấu Trừ BH</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Thực Lĩnh (Net)</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {sortedPayrolls.map((p, pIdx) => (
                  <tr key={p.id || pIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#475569', fontWeight: 700 }}>{p.period}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{p.empName || `NV #${p.empId}`}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: `${ROLE_COLORS[p.employee?.role] || '#6366f1'}15`, color: ROLE_COLORS[p.employee?.role] || '#6366f1' }}>
                        {p.employee?.role || '---'}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#475569' }}>{fmt(p.salary)}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>+{fmt(p.bonuses)}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>-{fmt(p.deductions)}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                      {fmt(p.netAmount)}
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800,
                        backgroundColor: getStatusInfo(PAYROLL_STATUS, p.status).bg,
                        color: getStatusInfo(PAYROLL_STATUS, p.status).color
                      }}>
                        {getStatusLabel(PAYROLL_STATUS, p.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {sortedPayrolls.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                      Chưa có bảng lương nào — bấm "Lập Bảng Lương Kỳ {today.getMonth() + 1}/{today.getFullYear()}" để tạo mới.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: THÊM NHÂN VIÊN MỚI ================= */}
      {showAddEmpModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '480px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Thêm Hồ Sơ Nhân Viên Mới</h3>
              <button onClick={() => setShowAddEmpModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Họ và tên *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Hoàng Minh Trí"
                  value={newEmpForm.fullname}
                  onChange={e => setNewEmpForm(p => ({ ...p, fullname: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Username đăng nhập *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: trihm"
                  value={newEmpForm.username}
                  onChange={e => setNewEmpForm(p => ({ ...p, username: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Chức danh *</label>
                <select
                  value={newEmpForm.role}
                  onChange={e => {
                    const newRole = e.target.value;
                    let defaultDept = 'Kinh Doanh';
                    if (newRole === 'DELIVERY') defaultDept = 'Giao Vận';
                    else if (newRole === 'WAREHOUSE') defaultDept = 'Kho Vận';
                    else if (newRole === 'PURCHASING') defaultDept = 'Mua Hàng';
                    else if (newRole === 'QC' || newRole === 'QA') defaultDept = 'Kỹ Thuật';
                    else if (newRole === 'ASSEMBLY') defaultDept = 'Kỹ Thuật';
                    else if (newRole === 'HR') defaultDept = 'Hành Chính';
                    else if (newRole === 'ACCOUNTANT') defaultDept = 'Kế Toán';
                    else if (newRole === 'CSKH') defaultDept = 'Chăm Sóc Khách Hàng';
                    else if (newRole === 'CEO') defaultDept = 'Ban Giám Đốc';
                    setNewEmpForm(p => ({ ...p, role: newRole, department: defaultDept }));
                  }}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                >
                  {Object.keys(ROLE_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Phòng ban</label>
                <select
                  value={newEmpForm.department}
                  onChange={e => setNewEmpForm(p => ({ ...p, department: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {newEmpForm.role === 'DELIVERY' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                      Số điện thoại Shipper *
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 0912.345.678"
                      value={newEmpForm.phone || ''}
                      onChange={e => setNewEmpForm(p => ({ ...p, phone: e.target.value }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #bfdbfe' }}>
                    <label style={{ display: 'block', fontWeight: 800, color: '#1e40af', marginBottom: '0.35rem' }}>
                      Khu Vực Giao Hàng Đảm Nhiệm *
                    </label>
                    <select
                      value={newEmpForm.deliveryRegion || 'HCM_KV1'}
                      onChange={e => setNewEmpForm(p => ({ ...p, deliveryRegion: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #93c5fd', backgroundColor: '#ffffff', fontWeight: 600, color: '#1e3a8a', boxSizing: 'border-box' }}
                    >
                      {DELIVERY_REGIONS.map(reg => (
                        <option key={reg.code} value={reg.code}>{reg.name}</option>
                      ))}
                    </select>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: '#3b82f6' }}>
                      Shipper sẽ chỉ thấy và nhận các đơn hàng thuộc khu vực này tại cổng Giao Hàng.
                    </p>
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Lương cơ bản (VNĐ) *</label>
                <input
                  type="number"
                  placeholder="8500000"
                  value={newEmpForm.salary}
                  onChange={e => setNewEmpForm(p => ({ ...p, salary: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddEmployee}
                  disabled={creatingEmployee}
                  style={{ backgroundColor: creatingEmployee ? '#9ca3af' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: creatingEmployee ? 'default' : 'pointer' }}
                >
                  {creatingEmployee ? 'Đang tạo...' : 'Tạo Hồ Sơ'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: SỬA HỒ SƠ NHÂN VIÊN ================= */}
      {editingEmp && editForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '480px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Sửa Hồ Sơ: {editingEmp.fullname}</h3>
              <button onClick={() => { setEditingEmp(null); setEditForm(null); }} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Họ và tên</label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={e => setEditForm(p => ({ ...p, fullName: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Chức danh</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                >
                  {Object.keys(ROLE_COLORS).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Phòng ban</label>
                <select
                  value={editForm.department}
                  onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Số điện thoại</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              {editForm.role === 'DELIVERY' && (
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Khu Vực Giao Hàng</label>
                  <select
                    value={editForm.deliveryRegion}
                    onChange={e => setEditForm(p => ({ ...p, deliveryRegion: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    {DELIVERY_REGIONS.map(reg => (
                      <option key={reg.code} value={reg.code}>{reg.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Lương cơ bản (VNĐ)</label>
                <input
                  type="number"
                  value={editForm.baseSalary}
                  onChange={e => setEditForm(p => ({ ...p, baseSalary: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setEditingEmp(null); setEditForm(null); }}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  style={{ backgroundColor: savingEdit ? '#9ca3af' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: savingEdit ? 'default' : 'pointer' }}
                >
                  {savingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <div><strong>Chức danh:</strong> <span style={{ fontWeight: 800, color: ROLE_COLORS[viewingEmpDetail.role] }}>{viewingEmpDetail.role}</span></div>
              <div><strong>Phòng ban:</strong> {viewingEmpDetail.department || 'Kinh Doanh'}</div>
              <div><strong>Lương cơ bản:</strong> <strong style={{ color: '#16a34a' }}>{fmt(viewingEmpDetail.salary || viewingEmpDetail.baseSalary)}</strong></div>
              <div><strong>Hợp đồng:</strong> Chính thức (Không thời hạn)</div>
              <div><strong>Trạng thái lao động:</strong> <span style={{ color: '#16a34a', fontWeight: 700 }}>Đang làm việc</span></div>

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

    </div>
  );
}
