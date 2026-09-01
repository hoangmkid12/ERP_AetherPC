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
   * Update an assembly job (supports status, checklist, and component serials).
   * Awaits the real API call and only applies the change locally on confirmed
   * server success — the server is the one enforcing the QA-checklist/serial
   * gate before allowing COMPLETED, and (for a job linked to a real order)
   * cascades the real Order.status forward. A caller that needs to react to
   * failure (e.g. completeAssembly) should await the returned promise; the
   * many lightweight call sites (toggle a checkbox, start a job) intentionally
   * don't await — a dropped network blip there just leaves the checkbox
   * unsynced until the next successful save, which is low-stakes.
   */
  updateAssemblyJob: async (jobId, statusOrData, checklist = null, componentSerials = null) => {
    let status = typeof statusOrData === 'string' ? statusOrData : statusOrData?.status;
    let chk = checklist || (typeof statusOrData === 'object' ? statusOrData?.checklist : null);
    let serials = componentSerials || (typeof statusOrData === 'object' ? statusOrData?.componentSerials : null);

    const res = await api.put(`/assembly-jobs/${jobId}`, { status, checklist: chk, componentSerials: serials });
    const savedJob = res?.data;
    if (!savedJob) throw new Error(res?.message || 'Không thể lưu lệnh lắp ráp.');

    set(state => {
      const assemblyJobs = state.assemblyJobs.map(job => (job.id === jobId ? savedJob : job));
      try {
        localStorage.setItem(STORAGE_KEYS.assemblyJobs, JSON.stringify(assemblyJobs));
      } catch (e) {}
      return { assemblyJobs };
    });

    // The backend already advanced the real Order when it completed the job —
    // refresh the sales store's cache from the server instead of guessing.
    if (savedJob.status === 'COMPLETED' && savedJob.orderId) {
      try {
        const salesState = useSalesStore.getState();
        if (typeof salesState.fetchOrders === 'function') await salesState.fetchOrders();
        else if (typeof salesState.getOrders === 'function') await salesState.getOrders();
      } catch (_) {}
    }

    return savedJob;
  },

  /**
   * Create Assembly Job — supports manual job creation from Assembly.jsx
   * (which already builds a full job object with its own id/checklist) as
   * well as auto-creation from just an orderId. Awaits the real API call and
   * returns the server-assigned job (real jobCode as `id`) — the caller must
   * use that returned job's id, not invent its own, since the server is the
   * source of truth for ids now.
   */
  createAssemblyJob: async (orderIdOrData, customerName = '', components = []) => {
    const jobInput = (typeof orderIdOrData === 'object' && orderIdOrData !== null)
      ? orderIdOrData
      : { orderId: orderIdOrData, customer: customerName, components };

    const finalOrderId = jobInput.orderId || null;
    const finalCust = jobInput.customer || jobInput.customerName || 'Khách hàng';
    const finalComps = jobInput.components || [];

    if (finalOrderId) {
      const jobExists = get().assemblyJobs.some(j => j.orderId === finalOrderId);
      if (jobExists) return null;
    }

    const res = await api.post('/assembly-jobs', {
      orderId: finalOrderId,
      customerName: finalCust,
      components: finalComps,
      status: jobInput.status || 'PENDING',
      checklist: jobInput.checklist || { biosPost: false, osInstall: false, stressTest: false, qcSeal: false },
      componentSerials: jobInput.componentSerials || {}
    });
    const newJob = res?.data;
    if (!newJob) throw new Error(res?.message || 'Không thể tạo lệnh lắp ráp.');

    set(state => {
      const assemblyJobs = [newJob, ...state.assemblyJobs];
      try {
        localStorage.setItem(STORAGE_KEYS.assemblyJobs, JSON.stringify(assemblyJobs));
      } catch (e) {}
      return { assemblyJobs };
    });

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
