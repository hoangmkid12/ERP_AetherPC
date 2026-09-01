import { create } from 'zustand';
import { api } from '../services/api';
import { notify } from '../context/NotificationContext';

/**
 * @typedef {Object} Employee
 * @property {number} id
 * @property {string} fullname
 * @property {string} username
 * @property {string} role
 * @property {number} salary
 * @property {string} attendance
 * @property {boolean} salaryPaid
 * @property {string} phone
 */

/**
 * @typedef {Object} AttendanceLog
 * @property {string} id
 * @property {number} empId
 * @property {string} date
 * @property {string} status
 */

/**
 * @typedef {Object} LeaveRequest
 * @property {number} id
 * @property {string} empName
 * @property {string} role
 * @property {string} reason
 * @property {string} startDate
 * @property {string} endDate
 * @property {string} status
 */

/**
 * @typedef {Object} Payroll
 * @property {number} id
 * @property {number} empId
 * @property {string} empName
 * @property {number} salary
 * @property {number} deductions
 * @property {number} netAmount
 * @property {string} period
 */

const INITIAL_STATE = {
  employees: [],
  attendanceLogs: [],
  leaveRequests: [],
  payrolls: [],
  error: null,
};

const STORAGE_KEYS = {
  employees: 'erp_employees',
  attendanceLogs: 'erp_attendance_logs',
  leaveRequests: 'erp_leave_requests',
  payrolls: 'erp_payrolls',
};

const loadFromLocalStorage = () => {
  const state = { ...INITIAL_STATE };
  try {
    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        state[key] = JSON.parse(stored);
      }
    });
  } catch (e) {
    console.error('Error loading HR data from localStorage:', e);
  }
  return state;
};

export const useHRStore = create((set, get) => ({
  ...INITIAL_STATE,

  /**
   * Initialize state: hydrate from localStorage for an instant paint, then
   * always refresh from the API so the store reflects the server, not
   * whatever happened to be cached in this browser.
   */
  initialize: async () => {
    const state = loadFromLocalStorage();
    set(state);
    await Promise.allSettled([
      get().getEmployees(),
      get().getAttendanceLogs(),
      get().getLeaveRequests(),
      get().getPayrolls(),
    ]);
  },

  /**
   * Fetch all employees from API
   */
  getEmployees: async () => {
    try {
      set({ error: null });
      let employees = [];
      try {
        const data = await api.get('/hr/employees');
        employees = Array.isArray(data) ? data : (data?.data || []);
      } catch (_) {
        try {
          const data = await api.get('/employees');
          employees = Array.isArray(data) ? data : (data?.data || []);
        } catch (e) {
          console.warn('Backend getEmployees offline, using local cache:', e.message);
        }
      }
      
      if (employees.length > 0) {
        set({ employees });
        try {
          localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees));
        } catch (e) {}
      }
      
      return employees;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch employees';
      set({ error: errorMsg });
      console.error('Error fetching employees:', err);
      throw err;
    }
  },

  /**
   * Fetch all attendance logs from API
   */
  getAttendanceLogs: async () => {
    try {
      set({ error: null });
      const data = await api.get('/attendance');
      const attendanceLogs = Array.isArray(data) ? data : (data?.data || []);
      
      set({ attendanceLogs });
      try {
        localStorage.setItem(STORAGE_KEYS.attendanceLogs, JSON.stringify(attendanceLogs));
      } catch (e) {}
      
      return attendanceLogs;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch attendance logs';
      set({ error: errorMsg });
      console.error('Error fetching attendance logs:', err);
      throw err;
    }
  },

  /**
   * Fetch all leave requests from API
   */
  getLeaveRequests: async () => {
    try {
      set({ error: null });
      let leaveRequests = [];
      try {
        const data = await api.get('/hr/leaves');
        leaveRequests = Array.isArray(data) ? data : (data?.data || []);
      } catch (_) {
        const data = await api.get('/leaves');
        leaveRequests = Array.isArray(data) ? data : (data?.data || []);
      }
      
      set({ leaveRequests });
      try {
        localStorage.setItem(STORAGE_KEYS.leaveRequests, JSON.stringify(leaveRequests));
      } catch (e) {}
      
      return leaveRequests;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch leave requests';
      set({ error: errorMsg });
      console.error('Error fetching leave requests:', err);
      throw err;
    }
  },

  /**
   * Fetch all payrolls from API
   */
  getPayrolls: async () => {
    try {
      set({ error: null });
      const data = await api.get('/payrolls');
      const payrolls = Array.isArray(data) ? data : (data?.data || []);
      
      set({ payrolls });
      try {
        localStorage.setItem(STORAGE_KEYS.payrolls, JSON.stringify(payrolls));
      } catch (e) {}
      
      return payrolls;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch payrolls';
      set({ error: errorMsg });
      console.error('Error fetching payrolls:', err);
      throw err;
    }
  },

  /**
   * Create a new employee
   */
  createEmployee: async (employeeData) => {
    try {
      set({ error: null });
      const lowerUser = (employeeData.username || employeeData.email?.split('@')[0] || '').trim().toLowerCase();
      let newEmployee = null;
      try {
        newEmployee = await api.post('/hr/employees', employeeData);
      } catch (_) {
        newEmployee = await api.post('/employees', employeeData);
      }

      const newEmpObj = {
        id: newEmployee?.id || Date.now(),
        fullname: employeeData.fullName || employeeData.fullname || lowerUser,
        username: lowerUser,
        email: employeeData.email || `${lowerUser}@kltn-erp.vn`,
        role: employeeData.role || 'DELIVERY',
        department: employeeData.department || 'Giao Vận',
        deliveryRegion: employeeData.deliveryRegion || 'HCM_KV1',
        phone: employeeData.phone || '',
        salary: parseFloat(employeeData.baseSalary || employeeData.salary) || 8500000,
        baseSalary: parseFloat(employeeData.baseSalary || employeeData.salary) || 8500000,
        attendance: 'PRESENT',
        salaryPaid: false
      };
      
      set(state => {
        const updated = [...state.employees.filter(e => e.username !== lowerUser), newEmpObj];
        try {
          localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(updated));
        } catch (e) {}
        return { employees: updated };
      });

      return newEmpObj;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create employee';
      set({ error: errorMsg });
      console.error('Error creating employee:', err);
      throw err;
    }
  },

  /**
   * Add a new employee (Helper wrapper for SystemAdmin and HRManager)
   */
  addEmployee: async (fullname, username, role, salary, department, deliveryRegion, phone) => {
    const lowerUser = (username || '').trim().toLowerCase();
    const payload = {
      fullName: fullname,
      fullname: fullname,
      username: lowerUser,
      email: lowerUser.includes('@') ? lowerUser : `${lowerUser}@kltn-erp.vn`,
      department: department || (role === 'DELIVERY' ? 'Giao Vận' : 'Kinh Doanh'),
      role: role || 'SALES',
      baseSalary: parseFloat(salary) || 8500000,
      salary: parseFloat(salary) || 8500000,
      deliveryRegion: role === 'DELIVERY' ? (deliveryRegion || 'HCM_KV1') : null,
      phone: phone || '',
      password: '123456'
    };
    return await get().createEmployee(payload);
  },

  /**
   * Update an employee
   */
  updateEmployee: async (employeeId, employeeData) => {
    try {
      set({ error: null });
      const updated = await api.put(`/employees/${employeeId}`, employeeData);
      
      set(state => {
        const employees = state.employees.map(e => e.id === employeeId ? updated : e);
        try {
          localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees));
        } catch (e) {}
        return { employees };
      });
      
      return updated;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update employee';
      set({ error: errorMsg });
      console.error('Error updating employee:', err);
      throw err;
    }
  },

  /**
   * Delete an employee
   */
  deleteEmployee: async (employeeId) => {
    try {
      set({ error: null });
      await api.delete(`/employees/${employeeId}`);
      
      set(state => {
        const employees = state.employees.filter(e => e.id !== employeeId);
        try {
          localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees));
        } catch (e) {}
        return { employees };
      });
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete employee';
      set({ error: errorMsg });
      console.error('Error deleting employee:', err);
      throw err;
    }
  },

  /**
   * Mark attendance for 1 employee/1 day — awaits the real upsert endpoint
   * (POST /hr/attendance) and only applies the change locally on confirmed
   * server success. Throws on failure so the caller (HRManager.jsx) can show
   * a real error instead of a checkbox that silently never persisted.
   */
  updateAttendanceLogSync: async (empId, dateStr, status) => {
    const res = await api.post('/hr/attendance', { empId, date: dateStr, status });
    const savedLog = res?.data;
    if (!savedLog) throw new Error(res?.message || 'Không thể lưu chấm công.');

    set(state => {
      const existingIndex = state.attendanceLogs.findIndex(log => log.empId === empId && log.date === dateStr);
      const nextLogs = existingIndex !== -1
        ? state.attendanceLogs.map((log, index) => (index === existingIndex ? savedLog : log))
        : [savedLog, ...state.attendanceLogs];

      const todayStr = new Date().toLocaleDateString('vi-VN');
      const updatedEmployees = dateStr === todayStr
        ? state.employees.map(emp => (emp.id === empId ? { ...emp, attendance: status } : emp))
        : state.employees;

      try {
        localStorage.setItem(STORAGE_KEYS.attendanceLogs, JSON.stringify(nextLogs));
        localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(updatedEmployees));
      } catch (e) {}

      return { attendanceLogs: nextLogs, employees: updatedEmployees };
    });

    return savedLog;
  },

  /**
   * Approve leave request — real endpoint is PATCH /hr/leaves/:id/approve,
   * not the PUT /leaves/:id this used to call (a path that never existed).
   */
  approveLeaveRequest: async (id) => {
    const res = await api.patch(`/hr/leaves/${id}/approve`);
    const updated = res?.data;
    if (!updated) throw new Error(res?.message || 'Không thể duyệt đơn nghỉ phép.');
    set(state => ({ leaveRequests: state.leaveRequests.map(r => (r.id === id ? { ...r, ...updated } : r)) }));
    try {
      localStorage.setItem(STORAGE_KEYS.leaveRequests, JSON.stringify(get().leaveRequests));
    } catch (e) {}
    return updated;
  },

  /**
   * Reject leave request — real endpoint is PATCH /hr/leaves/:id/reject.
   */
  rejectLeaveRequest: async (id, reason = '') => {
    const res = await api.patch(`/hr/leaves/${id}/reject`, { reason });
    const updated = res?.data;
    if (!updated) throw new Error(res?.message || 'Không thể từ chối đơn nghỉ phép.');
    set(state => ({ leaveRequests: state.leaveRequests.map(r => (r.id === id ? { ...r, ...updated, rejectReason: reason } : r)) }));
    try {
      localStorage.setItem(STORAGE_KEYS.leaveRequests, JSON.stringify(get().leaveRequests));
    } catch (e) {}
    return updated;
  },

  /**
   * Lập bảng lương kỳ mới — server tự tính lương cho toàn bộ nhân viên ACTIVE
   * theo đúng công thức đã hiển thị ở tab "Bảng Lương" (hoa hồng SALES, thưởng
   * ASSEMBLY, khấu trừ cố định) — không còn gửi nguyên mảng tính sẵn ở client.
   */
  submitPayrolls: async (period) => {
    const res = await api.post('/hr/payrolls', { period });
    if (!res?.success) throw new Error(res?.message || 'Không thể lập bảng lương.');
    await get().getPayrolls();
    return res.data;
  },

  /**
   * Approve payroll by CEO — real endpoint is PATCH /hr/payrolls/approve-ceo.
   */
  approvePayrollByCEO: async (period) => {
    const res = await api.patch('/hr/payrolls/approve-ceo', period ? { period } : {});
    if (!res?.success) throw new Error(res?.message || 'Không thể duyệt bảng lương.');
    await get().getPayrolls();
    return res.data;
  },

  /**
   * Add employee locally (offline support)
   */
  addLocalEmployee: (employee) => {
    set(state => {
      const updated = [...state.employees, employee];
      try {
        localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(updated));
      } catch (e) {}
      return { employees: updated };
    });
  },

  /**
   * Clear all HR data
   */
  clearAll: () => {
    set(INITIAL_STATE);
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (e) {}
  },

  /**
   * Get employee by ID
   */
  getEmployeeById: (employeeId) => {
    return get().employees.find(e => e.id === employeeId);
  },

  /**
   * Get employees by role
   */
  getEmployeesByRole: (role) => {
    return get().employees.filter(e => e.role === role);
  },

  /**
   * Get attendance logs for a specific employee
   */
  getEmployeeAttendance: (empId) => {
    return get().attendanceLogs.filter(l => l.empId === empId);
  },

  /**
   * Get pending leave requests
   */
  getPendingLeaveRequests: () => {
    return get().leaveRequests.filter(l => l.status === 'PENDING');
  },

  /**
   * Get approved leave requests
   */
  getApprovedLeaveRequests: () => {
    return get().leaveRequests.filter(l => l.status === 'APPROVED');
  },

  /**
   * Get payrolls for a specific employee
   */
  getEmployeePayrolls: (empId) => {
    return get().payrolls.filter(p => p.empId === empId);
  },

  /**
   * Get total payroll amount
   */
  getTotalPayrollAmount: () => {
    return get().payrolls.reduce((sum, p) => sum + (p.netAmount || 0), 0);
  },
}));
