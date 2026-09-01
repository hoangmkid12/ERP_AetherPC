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
   * Create an attendance log
   */
  createAttendanceLog: async (logData) => {
    try {
      set({ error: null });
      const newLog = await api.post('/attendance', logData);
      
      set(state => {
        const updated = [...state.attendanceLogs, newLog];
        try {
          localStorage.setItem(STORAGE_KEYS.attendanceLogs, JSON.stringify(updated));
        } catch (e) {}
        return { attendanceLogs: updated };
      });
      
      return newLog;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create attendance log';
      set({ error: errorMsg });
      console.error('Error creating attendance log:', err);
      throw err;
    }
  },

  /**
   * Update attendance log
   */
  updateAttendanceLog: async (logId, logData) => {
    try {
      set({ error: null });
      const updated = await api.put(`/attendance/${logId}`, logData);
      
      set(state => {
        const attendanceLogs = state.attendanceLogs.map(l => l.id === logId ? updated : l);
        try {
          localStorage.setItem(STORAGE_KEYS.attendanceLogs, JSON.stringify(attendanceLogs));
        } catch (e) {}
        return { attendanceLogs };
      });
      
      return updated;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update attendance log';
      set({ error: errorMsg });
      console.error('Error updating attendance log:', err);
      throw err;
    }
  },

  /**
   * Create a leave request
   */
  createLeaveRequest: async (leaveData) => {
    try {
      set({ error: null });
      const newLeave = await api.post('/leaves', leaveData);
      
      set(state => {
        const updated = [...state.leaveRequests, newLeave];
        try {
          localStorage.setItem(STORAGE_KEYS.leaveRequests, JSON.stringify(updated));
        } catch (e) {}
        return { leaveRequests: updated };
      });
      
      return newLeave;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create leave request';
      set({ error: errorMsg });
      console.error('Error creating leave request:', err);
      throw err;
    }
  },

  /**
   * Update a leave request
   */
  updateLeaveRequest: async (leaveId, leaveData) => {
    try {
      set({ error: null });
      const updated = await api.put(`/leaves/${leaveId}`, leaveData);
      
      set(state => {
        const leaveRequests = state.leaveRequests.map(l => l.id === leaveId ? updated : l);
        try {
          localStorage.setItem(STORAGE_KEYS.leaveRequests, JSON.stringify(leaveRequests));
        } catch (e) {}
        return { leaveRequests };
      });
      
      return updated;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update leave request';
      set({ error: errorMsg });
      console.error('Error updating leave request:', err);
      throw err;
    }
  },

  /**
   * Delete a leave request
   */
  deleteLeaveRequest: async (leaveId) => {
    try {
      set({ error: null });
      await api.delete(`/leaves/${leaveId}`);
      
      set(state => {
        const leaveRequests = state.leaveRequests.filter(l => l.id !== leaveId);
        try {
          localStorage.setItem(STORAGE_KEYS.leaveRequests, JSON.stringify(leaveRequests));
        } catch (e) {}
        return { leaveRequests };
      });
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete leave request';
      set({ error: errorMsg });
      console.error('Error deleting leave request:', err);
      throw err;
    }
  },

  /**
   * Create a payroll
   */
  createPayroll: async (payrollData) => {
    try {
      set({ error: null });
      const newPayroll = await api.post('/payrolls', payrollData);
      
      set(state => {
        const updated = [...state.payrolls, newPayroll];
        try {
          localStorage.setItem(STORAGE_KEYS.payrolls, JSON.stringify(updated));
        } catch (e) {}
        return { payrolls: updated };
      });
      
      return newPayroll;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create payroll';
      set({ error: errorMsg });
      console.error('Error creating payroll:', err);
      throw err;
    }
  },

  /**
   * Update a payroll
   */
  updatePayroll: async (payrollId, payrollData) => {
    try {
      set({ error: null });
      const updated = await api.put(`/payrolls/${payrollId}`, payrollData);
      
      set(state => {
        const payrolls = state.payrolls.map(p => p.id === payrollId ? updated : p);
        try {
          localStorage.setItem(STORAGE_KEYS.payrolls, JSON.stringify(payrolls));
        } catch (e) {}
        return { payrolls };
      });
      
      return updated;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update payroll';
      set({ error: errorMsg });
      console.error('Error updating payroll:', err);
      throw err;
    }
  },

  /**
   * Delete a payroll
   */
  deletePayroll: async (payrollId) => {
    try {
      set({ error: null });
      await api.delete(`/payrolls/${payrollId}`);
      
      set(state => {
        const payrolls = state.payrolls.filter(p => p.id !== payrollId);
        try {
          localStorage.setItem(STORAGE_KEYS.payrolls, JSON.stringify(payrolls));
        } catch (e) {}
        return { payrolls };
      });
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete payroll';
      set({ error: errorMsg });
      console.error('Error deleting payroll:', err);
      throw err;
    }
  },

  /**
   * Update attendance log sync
   */
  updateAttendanceLogSync: (empId, dateStr, status) => {
    set(state => {
      const existingIndex = state.attendanceLogs.findIndex(log => log.empId === empId && log.date === dateStr);
      let nextLogs = [];
      if (existingIndex !== -1) {
        nextLogs = state.attendanceLogs.map((log, index) => 
          index === existingIndex ? { ...log, status } : log
        );
      } else {
        const newLog = {
          id: `ATT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          empId,
          date: dateStr,
          status
        };
        nextLogs = [newLog, ...state.attendanceLogs];
      }

      const todayStr = new Date().toLocaleDateString('vi-VN');
      let updatedEmployees = state.employees;
      if (dateStr === todayStr) {
        updatedEmployees = state.employees.map(emp => emp.id === empId ? { ...emp, attendance: status } : emp);
      }

      try {
        localStorage.setItem(STORAGE_KEYS.attendanceLogs, JSON.stringify(nextLogs));
        localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(updatedEmployees));
      } catch (e) {}

      return { attendanceLogs: nextLogs, employees: updatedEmployees };
    });
  },

  /**
   * Approve leave request
   */
  approveLeaveRequest: (id) => {
    set(state => {
      const leaveRequests = state.leaveRequests.map(r => r.id === id ? { ...r, status: 'APPROVED' } : r);
      try { localStorage.setItem(STORAGE_KEYS.leaveRequests, JSON.stringify(leaveRequests)); } catch (e) {}
      return { leaveRequests };
    });
    api.put(`/leaves/${id}`, { status: 'APPROVED' }).catch(() => {});
  },

  /**
   * Reject leave request
   */
  rejectLeaveRequest: (id, reason = '') => {
    set(state => {
      const leaveRequests = state.leaveRequests.map(r => r.id === id ? { ...r, status: 'REJECTED', rejectReason: reason } : r);
      try { localStorage.setItem(STORAGE_KEYS.leaveRequests, JSON.stringify(leaveRequests)); } catch (e) {}
      return { leaveRequests };
    });
    api.put(`/leaves/${id}`, { status: 'REJECTED', rejectReason: reason }).catch(() => {});
  },

  /**
   * Submit payrolls
   */
  submitPayrolls: (payrollList) => {
    set(state => {
      try { localStorage.setItem(STORAGE_KEYS.payrolls, JSON.stringify(payrollList)); } catch (e) {}
      return { payrolls: payrollList };
    });
    api.post('/payrolls', payrollList).catch(() => {});
  },

  /**
   * Approve payroll by CEO
   */
  approvePayrollByCEO: () => {
    set(state => {
      const nextPayrolls = state.payrolls.map(p => ({ ...p, status: 'APPROVED_BY_CEO' }));
      try { localStorage.setItem(STORAGE_KEYS.payrolls, JSON.stringify(nextPayrolls)); } catch (e) {}
      return { payrolls: nextPayrolls };
    });
    notify('CEO đã phê duyệt bảng lương tháng này thành công. Đã gửi lệnh chi cho Kế toán giải ngân.', 'success');
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
