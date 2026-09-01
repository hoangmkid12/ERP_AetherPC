import { create } from 'zustand';
import { api } from '../services/api';
import { notify } from '../context/NotificationContext';
import { useHRStore } from './hrStore';

/**
 * @typedef {Object} LedgerEntry
 * @property {string} id
 * @property {string} type
 * @property {number} amount
 * @property {string} date
 * @property {string} description
 * @property {string} category
 */

/**
 * @typedef {Object} PurchaseOrder
 * @property {string} id
 * @property {string} poNumber
 * @property {string} supplierCode
 * @property {Object} supplier
 * @property {string} createdBy
 * @property {string} expectedDeliveryDate
 * @property {number} totalAmount
 * @property {string} status
 * @property {Array} items
 */

const INITIAL_STATE = {
  ledger: [],
  purchaseOrders: [],
  error: null,
};

const STORAGE_KEYS = {
  ledger: 'erp_ledger',
  purchaseOrders: 'erp_pos',
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
    console.error('Error loading finance data from localStorage:', e);
  }
  return state;
};

export const useFinanceStore = create((set, get) => ({
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
      get().getLedger(),
      get().getPurchaseOrders(),
    ]);
  },

  /**
   * Fetch all ledger entries from API
   */
  getLedger: async () => {
    try {
      set({ error: null });
      const data = await api.get('/ledger');
      const ledger = Array.isArray(data) ? data : (data?.data || []);
      
      set({ ledger });
      try {
        localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(ledger));
      } catch (e) {}
      
      return ledger;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch ledger';
      set({ error: errorMsg });
      console.error('Error fetching ledger:', err);
      throw err;
    }
  },

  /**
   * Fetch all purchase orders from API — the real P2P purchasing backend
   * lives at /purchasing/orders (purchase.routes.js); this store previously
   * called a nonexistent /purchase-orders and always 404'd silently.
   */
  getPurchaseOrders: async () => {
    try {
      set({ error: null });
      const data = await api.get('/purchasing/orders');
      const purchaseOrders = Array.isArray(data) ? data : (data?.data || []);

      set({ purchaseOrders });
      try {
        localStorage.setItem(STORAGE_KEYS.purchaseOrders, JSON.stringify(purchaseOrders));
      } catch (e) {}

      return purchaseOrders;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch purchase orders';
      set({ error: errorMsg });
      console.error('Error fetching purchase orders:', err);
      throw err;
    }
  },

  /**
   * Delete a ledger entry
   */
  deleteLedgerEntry: async (entryId) => {
    try {
      set({ error: null });
      await api.delete(`/ledger/${entryId}`);

      set(state => {
        const ledger = state.ledger.filter(e => e.id !== entryId);
        try {
          localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(ledger));
        } catch (e) {}
        return { ledger };
      });
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete ledger entry';
      set({ error: errorMsg });
      console.error('Error deleting ledger entry:', err);
      throw err;
    }
  },

  /**
   * Update Purchase Order Status (offline/online)
   */
  updatePurchaseOrderStatus: (poId, newStatus, extraData = null) => {
    const extraObj = typeof extraData === 'object' && extraData !== null ? extraData : (typeof extraData === 'string' ? { cancelReason: extraData, note: extraData } : {});

    set(state => {
      const matchesTarget = (po) => po.id === poId || po.poNumber === poId || String(po.id) === String(poId) || String(po.poNumber) === String(poId);
      const exists = state.purchaseOrders.some(matchesTarget);

      // If the PO isn't in this store's local cache yet (e.g. it was just created directly
      // via the real backend, which this store never fetched), don't fabricate a placeholder
      // entry — a minimal object keyed by the raw numeric id (missing supplierCode/supplier,
      // and using that id as poNumber) becomes a duplicate, identity-mismatched "ghost" PO
      // once merged against the real API-sourced entry elsewhere (Dashboard/Purchasing),
      // which is what made freshly-quoted/approved orders show a generic supplier name or
      // seem to vanish. The next API-driven refetch brings in the real, complete record.
      if (!exists) return state;

      const updatedPOs = state.purchaseOrders.map(po => {
        if (!matchesTarget(po)) return po;
        return {
          ...po,
          status: newStatus,
          ...extraObj,
          ...(extraObj.expectedDeliveryDate ? { expectedDeliveryDate: extraObj.expectedDeliveryDate } : {}),
          ...(extraObj.supplierNote ? { supplierNote: extraObj.supplierNote, note: extraObj.supplierNote } : {})
        };
      });

      try {
        localStorage.setItem(STORAGE_KEYS.purchaseOrders, JSON.stringify(updatedPOs));
      } catch (e) {}

      return { purchaseOrders: updatedPOs };
    });

    api.patch(`/purchasing/orders/${poId}/status`, { status: newStatus, ...extraObj }).catch(() => {});
  },

  /**
   * Add Manual Ledger Entry — awaits the real POST /ledger and only applies
   * the entry locally on confirmed server success (throws on failure so the
   * caller can show a real error instead of a fabricated "saved" state).
   * LedgerEntry has no `category` column, so it's folded into the
   * description text rather than silently dropped.
   */
  addLedgerEntry: async (typeOrEntry, amount, description, date = null, category = 'Vận hành văn phòng') => {
    let entryType = 'EXPENSE';
    let entryAmount = 0;
    let entryDesc = '';
    let entryDate = date || new Date().toLocaleDateString('vi-VN');
    let entryCat = category;
    let referenceId = null;

    if (typeof typeOrEntry === 'object' && typeOrEntry !== null) {
      entryType = String(typeOrEntry.type || 'EXPENSE').toUpperCase();
      entryAmount = parseFloat(typeOrEntry.amount) || 0;
      entryDesc = typeOrEntry.description || '';
      entryDate = typeOrEntry.date || new Date().toLocaleDateString('vi-VN');
      entryCat = typeOrEntry.category || category;
      referenceId = typeOrEntry.referenceId;
    } else {
      entryType = String(typeOrEntry || 'EXPENSE').toUpperCase();
      entryAmount = parseFloat(amount) || 0;
      entryDesc = description || '';
      entryDate = date || new Date().toLocaleDateString('vi-VN');
      entryCat = category;
    }

    const fullDescription = entryCat ? `[${entryCat}] ${entryDesc}` : entryDesc;
    const res = await api.post('/ledger', {
      type: entryType,
      amount: entryAmount,
      description: fullDescription,
      date: entryDate,
      ...(referenceId ? { referenceId } : {})
    });
    const newTx = res?.data;
    if (!newTx) throw new Error(res?.message || 'Không thể ghi bút toán vào Sổ Cái.');

    set(state => {
      const nextLedger = [newTx, ...(state.ledger || [])];
      try {
        localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(nextLedger));
      } catch (e) {}
      return { ledger: nextLedger };
    });

    return newTx;
  },

  /**
   * Disburse single employee payroll
   */
  disbursePayroll: async (payrollId) => {
    const res = await api.post(`/hr/payrolls/${payrollId}/disburse`);
    if (!res?.success) throw new Error(res?.message || 'Không thể giải ngân bảng lương.');

    // Backend already wrote the real Payroll status + LedgerEntry — refresh
    // both caches from the server instead of guessing the new state locally.
    await Promise.allSettled([get().getLedger(), useHRStore.getState().getPayrolls()]);

    const empName = res.data?.empName || `Nhân viên #${res.data?.empId}`;
    notify(`Đã giải ngân thành công ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(res.data?.netAmount || 0)} cho nhân viên ${empName}.`, 'success');
    return res.data;
  },

  /**
   * Disburse all approved payrolls
   */
  disburseAllPayrolls: async () => {
    const res = await api.post('/hr/payrolls/disburse-all');
    if (!res?.success) throw new Error(res?.message || 'Không có bảng lương nào đang chờ giải ngân.');

    await Promise.allSettled([get().getLedger(), useHRStore.getState().getPayrolls()]);

    notify(`Kế toán đã giải ngân chi trả lương thành công cho ${res.data?.count || 0} nhân viên.`, 'success');
    return res.data;
  },

  /**
   * Delete a purchase order
   */
  deletePurchaseOrder: async (poId) => {
    try {
      set({ error: null });
      await api.delete(`/purchase-orders/${poId}`);
      
      set(state => {
        const purchaseOrders = state.purchaseOrders.filter(po => 
          po.id !== poId && po.poNumber !== poId
        );
        try {
          localStorage.setItem(STORAGE_KEYS.purchaseOrders, JSON.stringify(purchaseOrders));
        } catch (e) {}
        return { purchaseOrders };
      });
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete purchase order';
      set({ error: errorMsg });
      console.error('Error deleting purchase order:', err);
      throw err;
    }
  },

  /**
   * Add ledger entry locally (offline support)
   */
  addLocalLedgerEntry: (entry) => {
    set(state => {
      const updated = [...state.ledger, entry];
      try {
        localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(updated));
      } catch (e) {}
      return { ledger: updated };
    });
  },

  /**
   * Add purchase order locally (offline support)
   */
  addLocalPurchaseOrder: (po) => {
    set(state => {
      const updated = [...state.purchaseOrders, po];
      try {
        localStorage.setItem(STORAGE_KEYS.purchaseOrders, JSON.stringify(updated));
      } catch (e) {}
      return { purchaseOrders: updated };
    });
  },

  /**
   * Clear all finance data
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
   * Get ledger entry by ID
   */
  getLedgerEntryById: (entryId) => {
    return get().ledger.find(e => e.id === entryId);
  },

  /**
   * Get purchase order by ID or PO number
   */
  getPurchaseOrderById: (poId) => {
    return get().purchaseOrders.find(po => po.id === poId || po.poNumber === poId);
  },

  /**
   * Get income entries from ledger
   */
  getIncomeEntries: () => {
    return get().ledger.filter(e => e.type === 'INCOME');
  },

  /**
   * Get expense entries from ledger
   */
  getExpenseEntries: () => {
    return get().ledger.filter(e => e.type === 'EXPENSE');
  },

  /**
   * Get ledger entries by date range
   */
  getLedgerByDateRange: (startDate, endDate) => {
    return get().ledger.filter(e => {
      const eDate = new Date(e.date);
      return eDate >= new Date(startDate) && eDate <= new Date(endDate);
    });
  },

  /**
   * Get total income
   */
  getTotalIncome: () => {
    return get().ledger
      .filter(e => e.type === 'INCOME')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  },

  /**
   * Get total expenses
   */
  getTotalExpenses: () => {
    return get().ledger
      .filter(e => e.type === 'EXPENSE')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  },

  /**
   * Get net balance
   */
  getNetBalance: () => {
    const getTotalIncome = get().getTotalIncome;
    const getTotalExpenses = get().getTotalExpenses;
    return getTotalIncome() - getTotalExpenses();
  },

  /**
   * Get purchase orders by status
   */
  getPOsByStatus: (status) => {
    return get().purchaseOrders.filter(po => po.status === status);
  },

  /**
   * Get purchase orders by supplier
   */
  getPOsBySupplier: (supplierCode) => {
    return get().purchaseOrders.filter(po => po.supplierCode === supplierCode);
  },

  /**
   * Get total purchase order amount
   */
  getTotalPOAmount: () => {
    return get().purchaseOrders.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);
  },

  /**
   * Get pending purchase orders
   */
  getPendingPOs: () => {
    return get().purchaseOrders.filter(po => 
      po.status === 'PENDING' || po.status === 'QUOTED' || po.status === 'RFQ'
    );
  },
}));
