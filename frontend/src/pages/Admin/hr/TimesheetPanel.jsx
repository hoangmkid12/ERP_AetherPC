import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  LogIn, LogOut, Hourglass, Search, Filter, RotateCw,
  HelpCircle, Download, Calendar, X, CheckCircle2,
  ScanFace, AlertCircle, Clock
} from 'lucide-react';
import { api } from '../../../services/api';
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

export default function TimesheetPanel() {
  // 1. Quản lý thời gian & khoảng ngày lọc
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Mặc định: Ngày đầu tháng đến ngày cuối tháng hiện tại
  const defaultStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const defaultEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('ALL');

  // 2. Đồng hồ số thời gian thực (Live Digital Clock)
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

  // 3. State dữ liệu
  const [employees, setEmployees] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
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

  // Modal Chú thích & Modal Camera Chấm công
  const [showLegend, setShowLegend] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // 4. Load dữ liệu từ Backend
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, attRes, leaveRes, holRes, setRes, todayRes] = await Promise.allSettled([
        api.get('/hr/employees'),
        api.get(`/hr/attendance?from=${startDate}&to=${endDate}`),
        api.get('/hr/leaves'),
        api.get('/hr/holidays'),
        api.get('/hr/settings'),
        api.get('/hr/me/attendance/today')
      ]);

      if (empRes.status === 'fulfilled' && empRes.value?.data) {
        setEmployees(empRes.value.data.filter(e => e.status !== 'INACTIVE'));
      }
      if (attRes.status === 'fulfilled' && attRes.value?.data) {
        setAttendanceLogs(attRes.value.data || []);
      }
      if (leaveRes.status === 'fulfilled' && leaveRes.value?.data) {
        setLeaveRequests(leaveRes.value.data || []);
      }
      if (holRes.status === 'fulfilled' && holRes.value?.data) {
        setHolidays(holRes.value.data || []);
      }
      if (setRes.status === 'fulfilled' && setRes.value?.data) {
        setShiftSettings({
          workStartTime: setRes.value.data.workStartTime || '08:00',
          workEndTime: setRes.value.data.workEndTime || '17:30',
          workOnSaturday: Boolean(setRes.value.data.workOnSaturday)
        });
      }
      if (todayRes.status === 'fulfilled' && todayRes.value?.data) {
        const rec = todayRes.value.data.record;
        setTodayRecord({
          checkIn: rec?.checkIn || '--',
          checkOut: rec?.checkOut || '--',
          workHours: rec?.workHours != null ? `${rec.workHours}h` : '--'
        });
      }
    } catch (err) {
      notify(err.message || 'Không thể tải dữ liệu bảng công.', 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 5. Danh sách các ngày trong khoảng ngày đã chọn (Dates columns)
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

  // 6. Lọc nhân viên theo tìm kiếm và phòng ban
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

  // 7. Tạo Index tra cứu dữ liệu chấm công nhanh [empId][isoDate]
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

  // Index tra cứu ngày lễ [isoDate]
  const holidaySet = useMemo(() => {
    const set = new Set();
    for (const h of holidays) {
      if (h.date) set.add(h.date.slice(0, 10));
    }
    return set;
  }, [holidays]);

  // Index tra cứu ngày nghỉ phép đã duyệt [empId][isoDate]
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

  // 8. Tính tổng số ngày công (D) và tổng số giờ làm (H) cho từng nhân viên
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

  // 9. Xuất file Excel / CSV đầy đủ ma trận
  const exportMatrixCsv = () => {
    const filename = `bang-cham-cong-${startDate}-den-${endDate}.csv`;
    const headers = [
      'Mã NV',
      'Họ và Tên',
      'Chức Vụ',
      'Phòng Ban',
      'Tổng Ngày (D)',
      'Tổng Giờ (H)',
      ...daysList.map(d => `${d.dayOfWeekName} ${d.dateFormatted}`)
    ];

    const rows = filteredEmployees.map(emp => {
      const empLogs = attendanceIndex[emp.id] || {};
      const empLeaves = approvedLeavesIndex[emp.id] || {};
      const stats = employeeSummary[emp.id] || { days: 0, hours: 0 };

      const dayCells = daysList.map(d => {
        const log = empLogs[d.isoDate];
        if (log && log.checkIn) {
          return `${log.checkIn} - ${log.checkOut || '--'}`;
        }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER WIDGETS (KHUNG ĐỒNG HỒ & THÔNG TIN CA LÀM VIỆC) */}
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
      {/* 2. FILTER & TOOLBAR (TÌM KIẾM, PHÒNG BAN, KHOẢNG NGÀY & THAO TÁC) */}
      {/* ========================================================================= */}
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
        {/* Bộ lọc bên trái */}
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

          {/* Chọn khoảng ngày: Từ ngày */}
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
          </div>

          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>—</span>

          {/* Chọn khoảng ngày: Đến ngày */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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

        {/* Nút tác vụ bên phải */}
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

      {/* ========================================================================= */}
      {/* 3. MA TRẬN CHẤM CÔNG CHI TIẾT THEO NGÀY (TIMESHEET MATRIX TABLE) */}
      {/* ========================================================================= */}
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
            
            {/* Header bảng */}
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                
                {/* Cột 1: Nhân viên (Cố định Sticky) */}
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

                {/* Cột 2: Ngày (D) / giờ (H) (Cố định Sticky) */}
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

                {/* Các cột ngày trong khoảng thời gian */}
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

            {/* Dữ liệu từng nhân viên */}
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={daysList.length + 2} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? 'Đang tải dữ liệu chấm công...' : 'Không tìm thấy nhân viên nào phù hợp.'}
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
                      {/* Cột 1: Thông tin nhân viên (Avatar tròn + Tên + Chức danh) */}
                      <td style={{
                        padding: '0.65rem 1rem',
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        backgroundColor: isEven ? '#ffffff' : '#fafafa',
                        borderRight: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {/* Avatar tròn viết tắt */}
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

                          {/* Tên & Chức vụ */}
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

                      {/* Cột 2: Ngày (D) / Giờ (H) */}
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

                      {/* Các cột từng ngày */}
                      {daysList.map(d => {
                        const log = empLogs[d.isoDate];
                        const isRed = d.isSunday || d.isSaturday;

                        // Trường hợp 1: Có dữ liệu chấm công (CheckIn / CheckOut)
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
                              <div style={{ color: isLate ? '#d97706' : '#0f172a' }}>
                                {log.checkIn}
                              </div>
                              <div style={{ color: isEarly ? '#d97706' : '#0f172a' }}>
                                {log.checkOut || '--'}
                              </div>
                            </td>
                          );
                        }

                        // Trường hợp 2: Có đơn nghỉ phép đã duyệt
                        if (empLeaves[d.isoDate]) {
                          const leaveType = empLeaves[d.isoDate];
                          const code = leaveType === 'Không Lương' ? 'KL' : leaveType === 'Nghỉ Ốm' ? 'Ô' : 'P';
                          return (
                            <td
                              key={d.isoDate}
                              style={{
                                padding: '0.45rem 0.25rem',
                                textAlign: 'center',
                                borderRight: '1px solid #f1f5f9',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                fontSize: '0.78rem',
                                fontWeight: 800
                              }}
                              title={`Nghỉ phép: ${leaveType}`}
                            >
                              {code}
                            </td>
                          );
                        }

                        // Trường hợp 3: Ngày lễ
                        if (holidaySet.has(d.isoDate)) {
                          return (
                            <td
                              key={d.isoDate}
                              style={{
                                padding: '0.45rem 0.25rem',
                                textAlign: 'center',
                                borderRight: '1px solid #f1f5f9',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                fontSize: '0.72rem',
                                fontWeight: 800
                              }}
                              title="Ngày nghỉ lễ"
                            >
                              Lễ
                            </td>
                          );
                        }

                        // Trường hợp 4: Ngày nghỉ cuối tuần (Thứ 7 / Chủ Nhật)
                        if (d.isWeekend) {
                          return (
                            <td
                              key={d.isoDate}
                              style={{
                                padding: '0.45rem 0.25rem',
                                textAlign: 'center',
                                borderRight: '1px solid #f1f5f9',
                                backgroundColor: '#fffdf5',
                                color: '#6366f1',
                                fontSize: '0.8rem',
                                fontWeight: 700
                              }}
                            >
                              N
                            </td>
                          );
                        }

                        // Trường hợp 5: Ngày thường chưa có dữ liệu chấm công
                        return (
                          <td
                            key={d.isoDate}
                            style={{
                              padding: '0.45rem 0.25rem',
                              textAlign: 'center',
                              borderRight: '1px solid #f1f5f9',
                              color: '#94a3b8',
                              fontSize: '0.85rem'
                            }}
                          >
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

      {/* ========================================================================= */}
      {/* 4. MODAL CHÚ THÍCH (GIẢI THÍCH KÝ HIỆU & MÀU SẮC) */}
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
                <div><strong>Giờ màu đen:</strong> Vào ca và ra ca đúng giờ quy định.</div>
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
      {/* 5. MODAL CAMERA CHẤM CÔNG NHẬN DIỆN KHUÔN MẶT */}
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
