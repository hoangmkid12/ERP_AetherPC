import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  LogIn, LogOut, Hourglass, Search, Filter, RotateCw,
  HelpCircle, Download, Calendar, X, CheckCircle2,
  ScanFace, AlertCircle, Clock, ChevronLeft, ChevronRight,
  List, CalendarDays
} from 'lucide-react';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { notify } from '../../../context/NotificationContext';
import { getRoleName } from '../../../utils/rbacEngine';
import { DEPARTMENTS, downloadCsv } from './hrUi';
import FaceCamera from '../../../components/HR/FaceCamera';

// Helper: Lấy 2 chữ cái viết tắt đại diện cho tên nhân viên
// Vd: "Nguyễn Hà Quang Đức" -> "QĐ", "Đỗ Văn Sơn" -> "VS", "Nguyễn Viết Dũng" -> "VD"
const getInitials = (fullName) => {
  if (!fullName) return 'NV';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const last1 = parts[parts.length - 1];
  const last2 = parts[parts.length - 2];
  return (last2[0] + last1[0]).toUpperCase();
};

// Helper format ngày Việt Nam: Thứ Tư, 07/10/2026
const formatVnDateHeader = (dateObj) => {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = days[dateObj.getDay()];
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dayName}, ${dd}/${mm}/${yyyy}`;
};

export default function TimesheetPanel({ defaultView }) {
  const { user } = useAuth();

  // 1. Kiểm tra quyền Quản lý
  // Admin, CEO, HR có toàn quyền quản lý toàn doanh nghiệp.
  // Các role Trưởng phòng / Quản lý (SALES_MANAGER, WAREHOUSE_MANAGER...) có quyền quản lý phòng của mình.
  const isCompanyManager = ['ADMIN', 'CEO', 'HR'].includes(user?.role);
  const isDeptManager = ['SALES_MANAGER', 'WAREHOUSE_MANAGER'].includes(user?.role) || (user?.role || '').includes('MANAGER');
  const canManageAttendance = isCompanyManager || isDeptManager;

  // Nếu không có quyền quản lý, BẮT BUỘC chỉ xem "Chấm công của tôi"
  const [activeView, setActiveView] = useState(() => {
    if (defaultView) return defaultView;
    return canManageAttendance ? 'manage' : 'my';
  });

  useEffect(() => {
    if (!canManageAttendance && activeView !== 'my') {
      setActiveView('my');
    }
  }, [canManageAttendance, activeView]);

  // Bộ phận mặc định nếu là Quản lý phòng ban
  const defaultDept = useMemo(() => {
    if (user?.role === 'SALES_MANAGER') return 'Kinh Doanh';
    if (user?.role === 'WAREHOUSE_MANAGER') return 'Kho Vận';
    return 'ALL';
  }, [user]);

  // 2. Thời gian & Lọc ngày tháng
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12

  // Chế độ xem cá nhân: 'calendar' (Lịch) hoặc 'list' (Danh sách)
  const [personalViewMode, setPersonalViewMode] = useState('calendar');

  // Khoảng ngày cho Bảng ma trận quản lý
  const defaultStart = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const defaultEnd = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState(defaultDept);

  // Đồng bộ khi đổi Tháng / Năm ở bộ chọn
  useEffect(() => {
    const s = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const e = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setStartDate(s);
    setEndDate(e);
  }, [selectedYear, selectedMonth]);

  // 3. Đồng hồ số thời gian thực (Live Digital Clock)
  const [currentTime, setCurrentTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. State dữ liệu
  const [employees, setEmployees] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [myAttendanceLogs, setMyAttendanceLogs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [shiftSettings, setShiftSettings] = useState({
    workStartTime: '08:00',
    workEndTime: '17:30',
    workOnSaturday: false
  });
  const [todayRecord, setTodayRecord] = useState({
    checkIn: '--',
    checkOut: '--',
    workHours: '--'
  });
  const [loading, setLoading] = useState(false);

  // Modals
  const [showLegend, setShowLegend] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // 5. Fetch API dữ liệu
  const fetchData = useCallback(async () => {
    setLoading(true);
    const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    try {
      const promises = [
        api.get('/hr/settings'),
        api.get('/hr/me/attendance/today'),
        api.get(`/hr/me/attendance?month=${monthStr}`),
        api.get('/hr/holidays'),
        api.get('/hr/leaves')
      ];

      // Nếu có quyền quản lý, tải thêm danh sách nhân viên và toàn bộ logs
      if (canManageAttendance) {
        promises.push(api.get('/hr/employees'));
        promises.push(api.get(`/hr/attendance?from=${startDate}&to=${endDate}`));
      }

      const results = await Promise.allSettled(promises);

      // Cài đặt ca
      if (results[0].status === 'fulfilled' && results[0].value?.data) {
        setShiftSettings({
          workStartTime: results[0].value.data.workStartTime || '08:00',
          workEndTime: results[0].value.data.workEndTime || '17:30',
          workOnSaturday: Boolean(results[0].value.data.workOnSaturday)
        });
      }

      // Check-in hôm nay
      if (results[1].status === 'fulfilled' && results[1].value?.data) {
        const rec = results[1].value.data.record;
        setTodayRecord({
          checkIn: rec?.checkIn || '--',
          checkOut: rec?.checkOut || '--',
          workHours: rec?.workHours != null ? `${rec.workHours}h` : '--'
        });
      }

      // Lịch sử chấm công của chính tôi
      if (results[2].status === 'fulfilled' && results[2].value?.data) {
        setMyAttendanceLogs(results[2].value.data.records || []);
      }

      // Ngày lễ
      if (results[3].status === 'fulfilled' && results[3].value?.data) {
        setHolidays(results[3].value.data || []);
      }

      // Nghỉ phép
      if (results[4].status === 'fulfilled' && results[4].value?.data) {
        setLeaveRequests(results[4].value.data || []);
      }

      // Dữ liệu quản lý (nếu có quyền)
      if (canManageAttendance) {
        if (results[5]?.status === 'fulfilled' && results[5].value?.data) {
          setEmployees(results[5].value.data.filter(e => e.status !== 'INACTIVE'));
        }
        if (results[6]?.status === 'fulfilled' && results[6].value?.data) {
          setAttendanceLogs(results[6].value.data || []);
        }
      }
    } catch (err) {
      notify(err.message || 'Lỗi tải dữ liệu chấm công.', 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedYear, selectedMonth, canManageAttendance]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 6. Tính toán Lịch tháng cho "Chấm công của tôi" (7 cột Thứ Hai -> Chủ Nhật)
  const personalCalendarDays = useMemo(() => {
    const days = [];
    const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const daysInCurrentMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    // Thứ trong tuần của ngày 1 (0 = CN, 1 = T2... 6 = T7).
    // Chuẩn Việt Nam: Tuần bắt đầu từ Thứ Hai (0: T2 ... 6: CN)
    const firstDayDow = (firstDayOfMonth.getDay() + 6) % 7;

    // Các ngày từ tháng trước bù vào tuần đầu
    const daysInPrevMonth = new Date(selectedYear, selectedMonth - 1, 0).getDate();
    for (let i = firstDayDow - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const iso = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        formatted: `${String(d).padStart(2, '0')}/${String(prevMonth).padStart(2, '0')}`,
        isoDate: iso,
        isCurrentMonth: false,
        isWeekend: false
      });
    }

    // Các ngày của tháng hiện tại
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const curDate = new Date(selectedYear, selectedMonth - 1, d);
      const dow = (curDate.getDay() + 6) % 7; // 0 = T2, 5 = T7, 6 = CN
      const iso = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isWeekend = dow === 5 || dow === 6; // T7 hoặc CN
      days.push({
        dayNumber: d,
        formatted: `${String(d).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}`,
        isoDate: iso,
        isCurrentMonth: true,
        isWeekend,
        isSunday: dow === 6,
        isSaturday: dow === 5
      });
    }

    // Bù thêm ngày của tháng sau cho đủ bội số của 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
      const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
      const iso = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        formatted: `${String(d).padStart(2, '0')}/${String(nextMonth).padStart(2, '0')}`,
        isoDate: iso,
        isCurrentMonth: false,
        isWeekend: false
      });
    }

    return days;
  }, [selectedYear, selectedMonth]);

  // Index map logs cá nhân [isoDate] -> log
  const myLogsIndex = useMemo(() => {
    const map = {};
    for (const log of myAttendanceLogs) {
      if (log.isoDate) map[log.isoDate] = log;
    }
    return map;
  }, [myAttendanceLogs]);

  // 7. Dữ liệu cho Bảng Ma Trận Quản Lý (Matrix Columns)
  const daysList = useMemo(() => {
    const list = [];
    if (!startDate || !endDate) return list;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return list;

    const current = new Date(start);
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${d}`;
      const dow = current.getDay();

      list.push({
        isoDate: iso,
        dateFormatted: `${d}/${m}`,
        dayOfWeekName: dayNames[dow],
        isWeekend: dow === 0 || (dow === 6 && !shiftSettings.workOnSaturday),
        isSunday: dow === 0,
        isSaturday: dow === 6
      });
      current.setDate(current.getDate() + 1);
    }
    return list;
  }, [startDate, endDate, shiftSettings.workOnSaturday]);

  // Lọc nhân viên theo phòng ban & tìm kiếm
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        (emp.fullName || emp.fullname || '').toLowerCase().includes(q) ||
        (emp.employeeCode || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q);

      const matchDept = department === 'ALL' || emp.department === department;
      return matchSearch && matchDept;
    });
  }, [employees, search, department]);

  // Index map logs quản lý [empId][isoDate] -> log
  const attendanceIndex = useMemo(() => {
    const idx = {};
    for (const log of attendanceLogs) {
      const empId = log.employeeId || log.empId;
      if (!empId) continue;
      if (!idx[empId]) idx[empId] = {};
      idx[empId][log.isoDate] = log;
    }
    return idx;
  }, [attendanceLogs]);

  // Index ngày lễ
  const holidaySet = useMemo(() => {
    const set = new Set();
    for (const h of holidays) {
      if (h.date) set.add(h.date.slice(0, 10));
    }
    return set;
  }, [holidays]);

  // Index nghỉ phép đã duyệt
  const approvedLeavesIndex = useMemo(() => {
    const idx = {};
    for (const l of leaveRequests) {
      if (l.status !== 'APPROVED') continue;
      const empId = l.employeeId;
      if (!empId) continue;
      if (!idx[empId]) idx[empId] = {};

      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const iso = cur.toISOString().slice(0, 10);
        idx[empId][iso] = l.type || 'P';
        cur.setDate(cur.getDate() + 1);
      }
    }
    return idx;
  }, [leaveRequests]);

  // Thống kê ngày & giờ công từng nhân viên
  const employeeSummary = useMemo(() => {
    const summary = {};
    for (const emp of employees) {
      const empLogs = attendanceIndex[emp.id] || {};
      let totalDays = 0;
      let totalHours = 0;

      for (const day of daysList) {
        const log = empLogs[day.isoDate];
        if (log && ['PRESENT', 'LATE'].includes(log.status)) {
          totalDays += 1;
          totalHours += Number(log.workHours || 0);
        }
      }
      summary[emp.id] = {
        days: totalDays,
        hours: Math.round(totalHours * 10) / 10
      };
    }
    return summary;
  }, [employees, daysList, attendanceIndex]);

  // Xuất CSV ma trận
  const exportMatrixCsv = () => {
    const filename = `bang-cham-cong-${startDate}-den-${endDate}.csv`;
    const headers = [
      'Mã NV', 'Họ và Tên', 'Chức Vụ', 'Phòng Ban', 'Tổng Ngày (D)', 'Tổng Giờ (H)',
      ...daysList.map(d => `${d.dayOfWeekName} ${d.dateFormatted}`)
    ];

    const rows = filteredEmployees.map(emp => {
      const empLogs = attendanceIndex[emp.id] || {};
      const empLeaves = approvedLeavesIndex[emp.id] || {};
      const stats = employeeSummary[emp.id] || { days: 0, hours: 0 };

      const dayCells = daysList.map(d => {
        const log = empLogs[d.isoDate];
        if (log && log.checkIn) return `${log.checkIn} - ${log.checkOut || '--'}`;
        if (empLeaves[d.isoDate]) return 'Nghỉ phép';
        if (holidaySet.has(d.isoDate)) return 'Nghỉ lễ';
        if (d.isWeekend) return 'N';
        return '-';
      });

      return [
        emp.employeeCode || `NV-${emp.id}`,
        emp.fullName || emp.fullname,
        emp.jobTitle || getRoleName(emp.role),
        emp.department || 'Chung',
        stats.days,
        stats.hours,
        ...dayCells
      ];
    });

    downloadCsv(filename, headers, rows);
  };

  const isCheckedIn = todayRecord.checkIn !== '--';

  // Điều hướng Tháng / Năm
  const prevMonthHandler = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const nextMonthHandler = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ========================================================================= */}
      {/* TIÊU ĐỀ BẢNG CHẤM CÔNG & NÚT CHUYỂN ĐỔI (QUẢN LÝ / CHẤM CÔNG CỦA TÔI) */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Bảng chấm công
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            Theo dõi, quản lý và xử lý dữ liệu chấm công
          </p>
        </div>

        {/* NÚT CHUYỂN ĐỔI: CHỈ HIỂN THỊ KHI CÓ QUYỀN QUẢN LÝ */}
        {canManageAttendance && (
          <div style={{
            display: 'inline-flex',
            backgroundColor: '#f1f5f9',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              onClick={() => setActiveView('manage')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '6px',
                border: activeView === 'manage' ? '1px solid #cbd5e1' : 'none',
                backgroundColor: activeView === 'manage' ? '#ffffff' : 'transparent',
                color: activeView === 'manage' ? '#0f172a' : '#64748b',
                fontSize: '0.82rem',
                fontWeight: activeView === 'manage' ? 700 : 600,
                cursor: 'pointer',
                boxShadow: activeView === 'manage' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Quản lý chấm công
            </button>
            <button
              type="button"
              onClick={() => setActiveView('my')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '6px',
                border: activeView === 'my' ? '1px solid #cbd5e1' : 'none',
                backgroundColor: activeView === 'my' ? '#ffffff' : 'transparent',
                color: activeView === 'my' ? '#0f172a' : '#64748b',
                fontSize: '0.82rem',
                fontWeight: activeView === 'my' ? 700 : 600,
                cursor: 'pointer',
                boxShadow: activeView === 'my' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Chấm công của tôi
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* KHỐI ĐỒNG HỒ & THÔNG TIN CA LÀM VIỆC (DÙNG CHUNG CHO CẢ 2 CHẾ ĐỘ) */}
      {/* ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'stretch' }}>
        
        {/* Card Trái: Ngày hiện tại, Đồng hồ số lớn & Nút CHECK IN */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '130px'
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
              {formatVnDateHeader(now)}
            </div>
            <div style={{
              fontSize: '2.4rem',
              fontWeight: 800,
              color: '#0284c7',
              lineHeight: 1.15,
              margin: '0.35rem 0'
            }}>
              {currentTime}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCameraModal(true)}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.55rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              width: 'fit-content',
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0369a1'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0284c7'}
          >
            {isCheckedIn ? <LogOut size={16} /> : <LogIn size={16} />}
            <span>{isCheckedIn ? 'CHECK OUT' : 'CHECK IN'}</span>
          </button>
        </div>

        {/* Card Phải: Ca T2 - T6 & 3 ô Giờ vào ca, Giờ ra ca, Tổng giờ làm */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
            Ca {shiftSettings.workOnSaturday ? 'T2 - T7' : 'T2 - T6'} ({shiftSettings.workStartTime} - {shiftSettings.workEndTime})
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {/* Box 1: Giờ vào ca */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#ecfdf5',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <LogIn size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Giờ vào ca</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{todayRecord.checkIn}</div>
              </div>
            </div>

            {/* Box 2: Giờ ra ca */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <LogOut size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Giờ ra ca</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{todayRecord.checkOut}</div>
              </div>
            </div>

            {/* Box 3: Tổng giờ làm */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Hourglass size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Tổng giờ làm</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{todayRecord.workHours}</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* TRƯỜNG HỢP 1: GIAO DIỆN "CHẤM CÔNG CỦA TÔI" (LỊCH THÁNG CÁ NHÂN) */}
      {/* ========================================================================= */}
      {activeView === 'my' && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          
          {/* Header phần Lịch sử chấm công */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Lịch sử chấm công
              </h3>
            </div>

            {/* Chuyển đổi Lịch / Danh sách */}
            <div style={{
              display: 'inline-flex',
              backgroundColor: '#f1f5f9',
              padding: '2px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}>
              <button
                type="button"
                onClick={() => setPersonalViewMode('calendar')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '5px',
                  border: personalViewMode === 'calendar' ? '1px solid #cbd5e1' : 'none',
                  backgroundColor: personalViewMode === 'calendar' ? '#ffffff' : 'transparent',
                  color: personalViewMode === 'calendar' ? '#0f172a' : '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: personalViewMode === 'calendar' ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                <CalendarDays size={14} />
                <span>Lịch</span>
              </button>
              <button
                type="button"
                onClick={() => setPersonalViewMode('list')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '5px',
                  border: personalViewMode === 'list' ? '1px solid #cbd5e1' : 'none',
                  backgroundColor: personalViewMode === 'list' ? '#ffffff' : 'transparent',
                  color: personalViewMode === 'list' ? '#0f172a' : '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: personalViewMode === 'list' ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                <List size={14} />
                <span>Danh sách</span>
              </button>
            </div>
          </div>

          {/* Thanh chuyển tháng/năm & Chú thích phân loại */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            paddingTop: '0.25rem',
            paddingBottom: '0.5rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            {/* Bộ chọn Tháng / Năm */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={prevMonthHandler}
                style={{
                  padding: '0.35rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{
                  padding: '0.4rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  backgroundColor: '#ffffff'
                }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  padding: '0.4rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  backgroundColor: '#ffffff'
                }}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={nextMonthHandler}
                style={{
                  padding: '0.35rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Các nhãn chú thích (Legend) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid #16a34a', display: 'inline-block' }} />
                <span style={{ color: '#475569', fontWeight: 600 }}>Đủ công</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid #f59e0b', display: 'inline-block' }} />
                <span style={{ color: '#475569', fontWeight: 600 }}>Không đủ công</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid #dc2626', display: 'inline-block' }} />
                <span style={{ color: '#475569', fontWeight: 600 }}>Nghỉ phép</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid #8b5cf6', display: 'inline-block' }} />
                <span style={{ color: '#475569', fontWeight: 600 }}>OT</span>
              </div>
            </div>
          </div>

          {/* DẠNG 1: LỊCH THÁNG (CALENDAR GRID THEO Ô) */}
          {personalViewMode === 'calendar' && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
              
              {/* Header 7 cột: Thứ hai -> Chủ nhật */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                textAlign: 'center',
                padding: '0.65rem 0',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                <div style={{ color: '#475569' }}>Thứ hai</div>
                <div style={{ color: '#475569' }}>Thứ ba</div>
                <div style={{ color: '#475569' }}>Thứ tư</div>
                <div style={{ color: '#475569' }}>Thứ năm</div>
                <div style={{ color: '#475569' }}>Thứ sáu</div>
                <div style={{ color: '#ef4444' }}>Thứ bảy</div>
                <div style={{ color: '#ef4444' }}>Chủ nhật</div>
              </div>

              {/* Các ô ngày trong tháng */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                backgroundColor: '#ffffff'
              }}>
                {personalCalendarDays.map((cell, idx) => {
                  const log = myLogsIndex[cell.isoDate];
                  const hasLog = Boolean(log && log.checkIn);
                  const isLate = log?.lateMinutes > 0;
                  const isEarly = log?.earlyLeaveMinutes > 0;
                  const hasOT = Boolean(log?.overtimeHours > 0);

                  return (
                    <div
                      key={idx}
                      style={{
                        minHeight: '84px',
                        borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid #f1f5f9',
                        borderBottom: '1px solid #f1f5f9',
                        padding: '0.45rem',
                        backgroundColor: !cell.isCurrentMonth
                          ? '#fafafa'
                          : cell.isWeekend
                          ? '#fffdf5'
                          : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxSizing: 'border-box'
                      }}
                    >
                      {/* Số ngày ở góc trên */}
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: cell.isCurrentMonth ? 700 : 500,
                        color: !cell.isCurrentMonth ? '#cbd5e1' : cell.isWeekend ? '#94a3b8' : '#334155'
                      }}>
                        {cell.formatted}
                      </div>

                      {/* Nội dung trạng thái ở giữa ô */}
                      <div style={{ textAlign: 'center', margin: 'auto 0' }}>
                        {cell.isCurrentMonth && (
                          hasLog ? (
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.25 }}>
                              <div style={{ color: isLate ? '#d97706' : '#16a34a' }}>
                                {log.checkIn}
                              </div>
                              <div style={{ color: isEarly ? '#d97706' : '#0f172a' }}>
                                {log.checkOut || '--'}
                              </div>
                              {hasOT && (
                                <span style={{ fontSize: '0.62rem', backgroundColor: '#f3e8ff', color: '#7e22ce', padding: '1px 4px', borderRadius: '4px', fontWeight: 800 }}>
                                  +{log.overtimeHours}h OT
                                </span>
                              )}
                            </div>
                          ) : cell.isWeekend ? (
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8' }}>
                              N
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                              -
                            </span>
                          )
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* DẠNG 2: DANH SÁCH CHI TIẾT (LIST VIEW) */}
          {personalViewMode === 'list' && (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Ngày</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Giờ Vào</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Giờ Ra</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Đi Muộn</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Về Sớm</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Giờ Làm</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Tăng Ca</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {myAttendanceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                        Chưa có dữ liệu chấm công nào trong tháng này.
                      </td>
                    </tr>
                  ) : (
                    myAttendanceLogs.map((r, i) => (
                      <tr key={r.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>{r.date}</td>
                        <td style={{ padding: '0.65rem 0.85rem', color: r.lateMinutes ? '#d97706' : '#16a34a', fontWeight: 700 }}>{r.checkIn || '—'}</td>
                        <td style={{ padding: '0.65rem 0.85rem', color: r.earlyLeaveMinutes ? '#d97706' : '#0f172a', fontWeight: 700 }}>{r.checkOut || '—'}</td>
                        <td style={{ padding: '0.65rem 0.85rem', color: r.lateMinutes ? '#d97706' : '#94a3b8' }}>{r.lateMinutes ? `${r.lateMinutes}′` : '—'}</td>
                        <td style={{ padding: '0.65rem 0.85rem', color: r.earlyLeaveMinutes ? '#d97706' : '#94a3b8' }}>{r.earlyLeaveMinutes ? `${r.earlyLeaveMinutes}′` : '—'}</td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>{r.workHours ? `${r.workHours}h` : '—'}</td>
                        <td style={{ padding: '0.65rem 0.85rem', color: r.overtimeHours ? '#7e22ce' : '#94a3b8' }}>{r.overtimeHours ? `+${r.overtimeHours}h` : '—'}</td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            backgroundColor: r.status === 'PRESENT' ? '#f0fdf4' : r.status === 'LATE' ? '#fffbeb' : '#fef2f2',
                            color: r.status === 'PRESENT' ? '#16a34a' : r.status === 'LATE' ? '#d97706' : '#dc2626'
                          }}>
                            {r.status === 'PRESENT' ? 'Đúng giờ' : r.status === 'LATE' ? 'Đi muộn' : 'Vắng'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TRƯỜNG HỢP 2: GIAO DIỆN "QUẢN LÝ CHẤM CÔNG" (CHỈ HIỂN THỊ KHI LÀ QUẢN LÝ) */}
      {/* ========================================================================= */}
      {activeView === 'manage' && canManageAttendance && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Thanh Filter & Actions */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
              
              {/* Ô Tìm kiếm */}
              <div style={{ position: 'relative', minWidth: '200px' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem 0.45rem 2rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Lọc phòng ban */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Filter size={14} style={{ color: '#64748b' }} />
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  style={{
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    outline: 'none'
                  }}
                >
                  <option value="ALL">Tất cả phòng ban</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Khoảng ngày */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => e.target.value && setStartDate(e.target.value)}
                  style={{
                    padding: '0.4rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
                <span style={{ color: '#94a3b8' }}>—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => e.target.value && setEndDate(e.target.value)}
                  style={{
                    padding: '0.4rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
              </div>

            </div>

            {/* Các nút bấm */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={fetchData}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span>Làm mới</span>
                <RotateCw size={14} className={loading ? 'spin' : ''} />
              </button>

              <button
                type="button"
                onClick={() => setShowLegend(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span>Chú thích</span>
                <HelpCircle size={14} />
              </button>

              <button
                type="button"
                onClick={exportMatrixCsv}
                disabled={!filteredEmployees.length}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                <span>Xuất Excel</span>
              </button>
            </div>
          </div>

          {/* Bảng Ma Trận Chấm Công Toàn Bộ Nhân Viên */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden'
          }}>
            <div style={{ overflowX: 'auto', maxHeight: '720px' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8rem',
                textAlign: 'left'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{
                      padding: '0.75rem 1rem',
                      fontWeight: 700,
                      color: '#475569',
                      minWidth: '250px',
                      position: 'sticky',
                      left: 0,
                      zIndex: 20,
                      backgroundColor: '#f8fafc',
                      borderRight: '1px solid #e2e8f0'
                    }}>
                      Nhân viên
                    </th>
                    <th style={{
                      padding: '0.75rem 0.65rem',
                      fontWeight: 700,
                      color: '#475569',
                      minWidth: '90px',
                      position: 'sticky',
                      left: '250px',
                      zIndex: 20,
                      backgroundColor: '#f8fafc',
                      borderRight: '1px solid #e2e8f0',
                      textAlign: 'center'
                    }}>
                      <div>Ngày (D) /</div>
                      <div>giờ (H)</div>
                    </th>
                    {daysList.map(d => {
                      const isRed = d.isSunday || d.isSaturday;
                      return (
                        <th
                          key={d.isoDate}
                          style={{
                            padding: '0.55rem 0.4rem',
                            minWidth: '64px',
                            textAlign: 'center',
                            borderRight: '1px solid #f1f5f9',
                            backgroundColor: isRed ? '#fffdf5' : '#f8fafc'
                          }}
                        >
                          <div style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: isRed ? '#ef4444' : '#475569',
                            marginBottom: '2px'
                          }}>
                            {d.dayOfWeekName}
                          </div>
                          <div style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: isRed ? '#ef4444' : '#64748b'
                          }}>
                            {d.dateFormatted}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={daysList.length + 2} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                        {loading ? 'Đang tải dữ liệu...' : 'Không tìm thấy nhân viên nào phù hợp.'}
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp, idx) => {
                      const empLogs = attendanceIndex[emp.id] || {};
                      const empLeaves = approvedLeavesIndex[emp.id] || {};
                      const stats = employeeSummary[emp.id] || { days: 0, hours: 0 };
                      const initials = getInitials(emp.fullName || emp.fullname);
                      const isEven = idx % 2 === 0;

                      return (
                        <tr
                          key={emp.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: isEven ? '#ffffff' : '#fafafa'
                          }}
                        >
                          <td style={{
                            padding: '0.65rem 1rem',
                            position: 'sticky',
                            left: 0,
                            zIndex: 10,
                            backgroundColor: isEven ? '#ffffff' : '#fafafa',
                            borderRight: '1px solid #e2e8f0'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                color: '#475569',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {initials}
                              </div>
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <div style={{
                                  fontWeight: 700,
                                  color: '#0f172a',
                                  fontSize: '0.84rem',
                                  whiteSpace: 'nowrap',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden'
                                }}>
                                  {emp.fullName || emp.fullname}
                                </div>
                                <div style={{
                                  fontSize: '0.7rem',
                                  color: '#64748b',
                                  whiteSpace: 'nowrap',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  textTransform: 'uppercase',
                                  marginTop: '2px'
                                }}>
                                  {emp.jobTitle || getRoleName(emp.role)} • {emp.department || 'Chung'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{
                            padding: '0.65rem 0.5rem',
                            position: 'sticky',
                            left: '250px',
                            zIndex: 10,
                            backgroundColor: isEven ? '#ffffff' : '#fafafa',
                            borderRight: '1px solid #e2e8f0',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#334155',
                            lineHeight: 1.4
                          }}>
                            <div>D: {stats.days}</div>
                            <div>H: {stats.hours}</div>
                          </td>

                          {daysList.map(d => {
                            const log = empLogs[d.isoDate];
                            const isRed = d.isSunday || d.isSaturday;

                            if (log && log.checkIn) {
                              const isLate = log.lateMinutes > 0;
                              const isEarly = log.earlyLeaveMinutes > 0;
                              return (
                                <td
                                  key={d.isoDate}
                                  style={{
                                    padding: '0.45rem 0.25rem',
                                    textAlign: 'center',
                                    borderRight: '1px solid #f1f5f9',
                                    backgroundColor: isRed ? '#fffdf5' : undefined,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    lineHeight: 1.3
                                  }}
                                >
                                  <div style={{ color: isLate ? '#d97706' : '#0f172a' }}>{log.checkIn}</div>
                                  <div style={{ color: isEarly ? '#d97706' : '#0f172a' }}>{log.checkOut || '--'}</div>
                                </td>
                              );
                            }

                            if (empLeaves[d.isoDate]) {
                              const leaveType = empLeaves[d.isoDate];
                              const code = leaveType === 'Không Lương' ? 'KL' : leaveType === 'Nghỉ Ốm' ? 'Ô' : 'P';
                              return (
                                <td key={d.isoDate} style={{ padding: '0.45rem 0.25rem', textAlign: 'center', borderRight: '1px solid #f1f5f9', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '0.78rem', fontWeight: 800 }}>
                                  {code}
                                </td>
                              );
                            }

                            if (holidaySet.has(d.isoDate)) {
                              return (
                                <td key={d.isoDate} style={{ padding: '0.45rem 0.25rem', textAlign: 'center', borderRight: '1px solid #f1f5f9', backgroundColor: '#fef2f2', color: '#ef4444', fontSize: '0.72rem', fontWeight: 800 }}>
                                  Lễ
                                </td>
                              );
                            }

                            if (d.isWeekend) {
                              return (
                                <td key={d.isoDate} style={{ padding: '0.45rem 0.25rem', textAlign: 'center', borderRight: '1px solid #f1f5f9', backgroundColor: '#fffdf5', color: '#6366f1', fontSize: '0.8rem', fontWeight: 700 }}>
                                  N
                                </td>
                              );
                            }

                            return (
                              <td key={d.isoDate} style={{ padding: '0.45rem 0.25rem', textAlign: 'center', borderRight: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '0.85rem' }}>
                                -
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CHÚ THÍCH KÝ HIỆU BẢNG CÔNG */}
      {/* ========================================================================= */}
      {showLegend && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #cbd5e1',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <HelpCircle size={18} style={{ color: '#2563eb' }} />
                <span>Chú Thích Ký Hiệu Bảng Công</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowLegend(false)}
                style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '40px', height: '28px', backgroundColor: '#fffdf5', border: '1px solid #fef08a', color: '#6366f1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>N</span>
                <div><strong>N:</strong> Nghỉ định kỳ cuối tuần (Thứ 7 & Chủ Nhật theo ca T2 - T6).</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '40px', height: '28px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#94a3b8', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>-</span>
                <div><strong>-:</strong> Ngày làm việc chưa có dữ liệu chấm công (chưa check-in/out).</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                  <div>08:00</div>
                  <div>18:00</div>
                </div>
                <div><strong>Giờ màu đen / xanh:</strong> Vào ca và ra ca đúng giờ quy định.</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#d97706', lineHeight: 1.2 }}>
                  <div>16:40</div>
                  <div>16:41</div>
                </div>
                <div><strong>Giờ màu cam (Vàng):</strong> Có vi phạm đi muộn hoặc về sớm so với ca làm việc.</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '40px', height: '28px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>P</span>
                <div><strong>P:</strong> Nghỉ phép năm có hưởng nguyên lương (đã duyệt đơn).</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '40px', height: '28px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>KL</span>
                <div><strong>KL:</strong> Nghỉ không hưởng lương (trừ công).</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '40px', height: '28px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>Lễ</span>
                <div><strong>Lễ:</strong> Ngày nghỉ lễ tết theo quy định Luật Lao Động (hưởng 100% lương).</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '40px', height: '28px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.7rem' }}>D / H</span>
                <div><strong>D:</strong> Tổng ngày công tích lũy · <strong>H:</strong> Tổng giờ làm việc thực tế.</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setShowLegend(false)}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Đã Hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CAMERA CHẤM CÔNG NHẬN DIỆN KHUÔN MẶT */}
      {/* ========================================================================= */}
      {showCameraModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(5px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ScanFace size={22} style={{ color: '#0284c7' }} />
                <span>Chấm Công Bằng Khuôn Mặt · {isCheckedIn ? 'RA CA (CHECK OUT)' : 'VÀO CA (CHECK IN)'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCameraModal(false)}
                style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <FaceCamera
              mode="verify"
              submitLabel={isCheckedIn ? 'Xác nhận Ra ca' : 'Xác nhận Vào ca'}
              onCapture={async ({ descriptor, image }) => {
                const res = await api.post('/hr/me/attendance/check', { descriptor, image });
                notify(res.message, res.data?.lateMinutes ? 'info' : 'success');
                setShowCameraModal(false);
                fetchData();
                return { message: res.message, image };
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
