import { create } from 'zustand';
import { api } from '../services/api';
import { useSalesStore } from './salesStore';
import { useInventoryStore } from './inventoryStore';

/**
 * @typedef {Object} AssemblyJob
 * @property {string} id
 * @property {string} orderId
 * @property {string} customer
 * @property {string} date
 * @property {string} status
 * @property {Array} components
 * @property {Object} checklist
 */

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} title
 * @property {string} message
 * @property {Array} targetRoles
 * @property {string} type
 * @property {boolean} read
 * @property {string} createdAt
 */

const INITIAL_STATE = {
  assemblyJobs: [],
  loading: false,
  customNotifs: [],
  error: null,
};

const STORAGE_KEYS = {
  assemblyJobs: 'erp_jobs',
  customNotifs: 'erp_system_notifications',
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
    console.error('Error loading utility data from localStorage:', e);
  }
  return state;
};

export const useUtilityStore = create((set, get) => ({
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
      get().getAssemblyJobs(),
    ]);
  },

  /**
   * Set loading state
   */
  setLoading: (loading) => {
    set({ loading });
  },

  /**
   * Fetch all assembly jobs from API
   */
  getAssemblyJobs: async () => {
    try {
      set({ error: null, loading: true });
      const data = await api.get('/assembly-jobs');
      const assemblyJobs = Array.isArray(data) ? data : (data?.data || []);
      
      set({ assemblyJobs, loading: false });
      try {
        localStorage.setItem(STORAGE_KEYS.assemblyJobs, JSON.stringify(assemblyJobs));
      } catch (e) {}
      
      return assemblyJobs;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch assembly jobs';
      set({ error: errorMsg, loading: false });
      console.error('Error fetching assembly jobs:', err);
      throw err;
    }
  },

  /**
   * Create an assembly job
   */
  createAssemblyJob: async (jobData) => {
    try {
      set({ error: null });
      const newJob = await api.post('/assembly-jobs', jobData);
      
      set(state => {
        const updated = [...state.assemblyJobs, newJob];
        try {
          localStorage.setItem(STORAGE_KEYS.assemblyJobs, JSON.stringify(updated));
        } catch (e) {}
        return { assemblyJobs: updated };
      });
      
      return newJob;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create assembly job';
      set({ error: errorMsg });
      console.error('Error creating assembly job:', err);
      throw err;
    }
  },

  /**
   * Update an assembly job (supports status, checklist, and component serials)
   */
  updateAssemblyJob: (jobId, statusOrData, checklist = null, componentSerials = null) => {
    let status = typeof statusOrData === 'string' ? statusOrData : statusOrData?.status;
    let chk = checklist || (typeof statusOrData === 'object' ? statusOrData?.checklist : null);
    let serials = componentSerials || (typeof statusOrData === 'object' ? statusOrData?.componentSerials : null);

    set(state => {
      const assemblyJobs = state.assemblyJobs.map(job => {
        if (job.id === jobId) {
          return { 
            ...job, 
            status: status || job.status, 
            checklist: chk || job.checklist, 
            componentSerials: serials || job.componentSerials || {}
          };
        }
        return job;
      });
      try {
        localStorage.setItem(STORAGE_KEYS.assemblyJobs, JSON.stringify(assemblyJobs));
      } catch (e) {}
      return { assemblyJobs };
    });

    if (status === 'COMPLETED') {
      const job = get().assemblyJobs.find(j => j.id === jobId);
      if (job && job.orderId) {
        try {
          const salesState = useSalesStore.getState();
          const updatedOrders = (salesState.orders || []).map(o => {
            if (o.orderId === job.orderId) {
              return { ...o, status: 'CONFIRMED' };
            }
            return o;
          });
          useSalesStore.setState({ orders: updatedOrders });
          localStorage.setItem('erp_orders', JSON.stringify(updatedOrders));
        } catch (_) {}
      }
    }

    api.put(`/assembly-jobs/${jobId}`, { status, checklist: chk, componentSerials: serials }).catch(() => {});
  },

  /**
   * Create Assembly Job (supports manual job creation)
   */
  createAssemblyJob: (orderIdOrData, customerName = '', components = []) => {
    let finalOrderId = '';
    let finalCust = '';
    let finalComps = [];

    if (typeof orderIdOrData === 'object' && orderIdOrData !== null) {
      finalOrderId = orderIdOrData.orderId || `MANUAL-${Date.now()}`;
      finalCust = orderIdOrData.customer || orderIdOrData.customerName || 'Khách hàng';
      finalComps = orderIdOrData.components || [];
    } else {
      finalOrderId = orderIdOrData || `MANUAL-${Date.now()}`;
      finalCust = customerName || 'Khách hàng';
      finalComps = components || [];
    }

    const jobExists = get().assemblyJobs.some(j => j.orderId === finalOrderId);
    if (jobExists) return null;

    const dateStr = new Date().toLocaleDateString('vi-VN');
    const newJob = {
      id: `JOB-${Math.floor(900 + Math.random() * 99)}`,
      orderId: finalOrderId,
      customer: finalCust,
      date: dateStr,
      status: 'PENDING',
      components: finalComps,
      checklist: { socketCheck: false, thermalPaste: false, cableRouting: false, biosBoot: false, stressTest: false }
    };

    set(state => {
      const assemblyJobs = [newJob, ...state.assemblyJobs];
      try {
        localStorage.setItem(STORAGE_KEYS.assemblyJobs, JSON.stringify(assemblyJobs));
      } catch (e) {}
      return { assemblyJobs };
    });

    api.post('/assembly-jobs', newJob).catch(() => {});
    return newJob;
  },

  /**
   * Delete an assembly job
   */
  deleteAssemblyJob: async (jobId) => {
    try {
      set({ error: null });
      await api.delete(`/assembly-jobs/${jobId}`);
      
      set(state => {
        const assemblyJobs = state.assemblyJobs.filter(j => j.id !== jobId);
        try {
          localStorage.setItem(STORAGE_KEYS.assemblyJobs, JSON.stringify(assemblyJobs));
        } catch (e) {}
        return { assemblyJobs };
      });
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete assembly job';
      set({ error: errorMsg });
      console.error('Error deleting assembly job:', err);
      throw err;
    }
  },

  /**
   * Add assembly job locally (offline support)
   */
  addLocalAssemblyJob: (job) => {
    set(state => {
      const updated = [...state.assemblyJobs, job];
      try {
        localStorage.setItem(STORAGE_KEYS.assemblyJobs, JSON.stringify(updated));
      } catch (e) {}
      return { assemblyJobs: updated };
    });
  },

  /**
   * Send system notification
   */
  sendSystemNotification: (notifData) => {
    const newNotif = {
      id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      createdAt: new Date().toISOString(),
      targetRoles: notifData.targetRoles || ['PURCHASING', 'CEO', 'ADMIN'],
      title: notifData.title || 'Thông báo hệ thống',
      message: notifData.message || '',
      link: notifData.link || '/admin/purchasing',
      navState: notifData.navState || {},
      type: notifData.type || 'RFQ_ALERT',
      itemData: notifData.itemData || null,
      read: false
    };

    set(state => {
      const updated = [newNotif, ...state.customNotifs];
      try {
        localStorage.setItem(STORAGE_KEYS.customNotifs, JSON.stringify(updated));
      } catch (e) {}
      return { customNotifs: updated };
    });

    window.dispatchEvent(new Event('erp-notification-sent'));
    return newNotif;
  },

  /**
   * Mark notification as read
   */
  markNotificationAsRead: (notifId) => {
    set(state => {
      const updated = state.customNotifs.map(n => 
        n.id === notifId ? { ...n, read: true } : n
      );
      try {
        localStorage.setItem(STORAGE_KEYS.customNotifs, JSON.stringify(updated));
      } catch (e) {}
      return { customNotifs: updated };
    });
  },

  /**
   * Mark all notifications as read
   */
  markAllNotificationsAsRead: () => {
    set(state => {
      const updated = state.customNotifs.map(n => ({ ...n, read: true }));
      try {
        localStorage.setItem(STORAGE_KEYS.customNotifs, JSON.stringify(updated));
      } catch (e) {}
      return { customNotifs: updated };
    });
  },

  /**
   * Delete a notification
   */
  deleteNotification: (notifId) => {
    set(state => {
      const updated = state.customNotifs.filter(n => n.id !== notifId);
      try {
        localStorage.setItem(STORAGE_KEYS.customNotifs, JSON.stringify(updated));
      } catch (e) {}
      return { customNotifs: updated };
    });
  },

  /**
   * Clear all notifications
   */
  clearNotifications: () => {
    set({ customNotifs: [] });
    try {
      localStorage.removeItem(STORAGE_KEYS.customNotifs);
    } catch (e) {}
  },

  /**
   * Add notification locally (offline support)
   */
  addLocalNotification: (notif) => {
    set(state => {
      const updated = [...state.customNotifs, notif];
      try {
        localStorage.setItem(STORAGE_KEYS.customNotifs, JSON.stringify(updated));
      } catch (e) {}
      return { customNotifs: updated };
    });
  },

  /**
   * Clear all utility data
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
   * Get assembly job by ID
   */
  getAssemblyJobById: (jobId) => {
    return get().assemblyJobs.find(j => j.id === jobId);
  },

  /**
   * Get assembly jobs by order ID
   */
  getAssemblyJobsByOrderId: (orderId) => {
    return get().assemblyJobs.filter(j => j.orderId === orderId);
  },

  /**
   * Get assembly jobs by status
   */
  getAssemblyJobsByStatus: (status) => {
    return get().assemblyJobs.filter(j => j.status === status);
  },

  /**
   * Get unread notifications count
   */
  getUnreadNotificationsCount: () => {
    return get().customNotifs.filter(n => !n.read).length;
  },

  /**
   * Get notifications for specific roles
   */
  getNotificationsForRole: (role) => {
    return get().customNotifs.filter(n => n.targetRoles.includes(role));
  },

  /**
   * Get unread notifications for specific roles
   */
  getUnreadNotificationsForRole: (role) => {
    return get().customNotifs.filter(n => 
      !n.read && n.targetRoles.includes(role)
    );
  },

  /**
   * Get notifications by type
   */
  getNotificationsByType: (type) => {
    return get().customNotifs.filter(n => n.type === type);
  },

  /**
   * Get assembling jobs
   */
  getAssemblingJobs: () => {
    return get().assemblyJobs.filter(j => j.status === 'ASSEMBLING');
  },

  /**
   * Get completed assembly jobs
   */
  getCompletedAssemblyJobs: () => {
    return get().assemblyJobs.filter(j => j.status === 'COMPLETED');
  },
}));
