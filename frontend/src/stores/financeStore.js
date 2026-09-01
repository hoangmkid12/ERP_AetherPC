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
   * Fetch all purchase orders from API
   */
  getPurchaseOrders: async () => {
    try {
      set({ error: null });
      const data = await api.get('/purchase-orders');
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
   * Create a ledger entry
   */
  createLedgerEntry: async (entryData) => {
    try {
      set({ error: null });
      const newEntry = await api.post('/ledger', entryData);
      
      set(state => {
        const updated = [...state.ledger, newEntry];
        try {
          localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(updated));
        } catch (e) {}
        return { ledger: updated };
      });
      
      return newEntry;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create ledger entry';
      set({ error: errorMsg });
      console.error('Error creating ledger entry:', err);
      throw err;
    }
  },

  /**
   * Update a ledger entry
   */
  updateLedgerEntry: async (entryId, entryData) => {
    try {
      set({ error: null });
      const updated = await api.put(`/ledger/${entryId}`, entryData);
      
      set(state => {
        const ledger = state.ledger.map(e => e.id === entryId ? updated : e);
        try {
          localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(ledger));
        } catch (e) {}
        return { ledger };
      });
      
      return updated;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update ledger entry';
      set({ error: errorMsg });
      console.error('Error updating ledger entry:', err);
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
   * Create a purchase order
   */
  createPurchaseOrder: async (poData) => {
    try {
      set({ error: null });
      const newPO = await api.post('/purchase-orders', poData);
      
      set(state => {
        const updated = [...state.purchaseOrders, newPO];
        try {
          localStorage.setItem(STORAGE_KEYS.purchaseOrders, JSON.stringify(updated));
        } catch (e) {}
        return { purchaseOrders: updated };
      });
      
      return newPO;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create purchase order';
      set({ error: errorMsg });
      console.error('Error creating purchase order:', err);
      throw err;
    }
  },

  /**
   * Update a purchase order
   */
  updatePurchaseOrder: async (poId, poData) => {
    try {
      set({ error: null });
      const updated = await api.put(`/purchase-orders/${poId}`, poData);
      
      set(state => {
        const purchaseOrders = state.purchaseOrders.map(po => 
          (po.id === poId || po.poNumber === poId) ? updated : po
        );
        try {
          localStorage.setItem(STORAGE_KEYS.purchaseOrders, JSON.stringify(purchaseOrders));
        } catch (e) {}
        return { purchaseOrders };
      });
      
      return updated;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update purchase order';
      set({ error: errorMsg });
      console.error('Error updating purchase order:', err);
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
   * Pay Supplier PO (finance)
   */
  paySupplierPO: (poId) => {
    const po = get().purchaseOrders.find(p => p.id === poId || p.poNumber === poId);
    if (!po) return;
    const dateStr = new Date().toLocaleDateString('vi-VN');

    set(state => {
      const updatedPOs = state.purchaseOrders.map(p => {
        if (p.id === poId || p.poNumber === poId) {
          return { ...p, status: 'PAID' };
        }
        return p;
      });

      const realCost = po.totalAmount || (po.quantity || 0) * (po.unitPrice || po.unitCost || 0);
      const newTx = {
        id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        type: 'EXPENSE',
        amount: realCost,
        date: dateStr,
        description: `Thanh toán NCC: ${po.supplier?.name || po.supplierCode || ''} — ${po.poNumber || po.id}`
      };
      const nextLedger = [newTx, ...state.ledger];

      try {
        localStorage.setItem(STORAGE_KEYS.purchaseOrders, JSON.stringify(updatedPOs));
        localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(nextLedger));
      } catch (e) {}

      return { purchaseOrders: updatedPOs, ledger: nextLedger };
    });
  },

  /**
   * Add Manual Ledger Entry
   */
  addLedgerEntry: (typeOrEntry, amount, description, date = null, category = 'Vận hành văn phòng') => {
    let entryType = 'EXPENSE';
    let entryAmount = 0;
    let entryDesc = '';
    let entryDate = date || new Date().toLocaleDateString('vi-VN');
    let entryCat = category;
    let customId = null;
    let referenceId = null;

    if (typeof typeOrEntry === 'object' && typeOrEntry !== null) {
      entryType = String(typeOrEntry.type || 'EXPENSE').toUpperCase();
      entryAmount = parseFloat(typeOrEntry.amount) || 0;
      entryDesc = typeOrEntry.description || '';
      entryDate = typeOrEntry.date || new Date().toLocaleDateString('vi-VN');
      entryCat = typeOrEntry.category || category;
      customId = typeOrEntry.id;
      referenceId = typeOrEntry.referenceId;
    } else {
      entryType = String(typeOrEntry || 'EXPENSE').toUpperCase();
      entryAmount = parseFloat(amount) || 0;
      entryDesc = description || '';
      entryDate = date || new Date().toLocaleDateString('vi-VN');
      entryCat = category;
    }

    const newTxId = customId || `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
    const newTx = {
      id: newTxId,
      type: entryType,
      amount: entryAmount,
      date: entryDate,
      description: entryDesc,
      category: entryCat,
      ...(referenceId ? { referenceId } : {})
    };

    set(state => {
      const nextLedger = [newTx, ...(state.ledger || [])];
      try {
        localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(nextLedger));
      } catch (e) {}
      return { ledger: nextLedger };
    });

    api.post('/ledger', newTx).catch(() => {});
    return newTx;
  },

  /**
   * Disburse single employee payroll
   */
  disbursePayroll: (empId) => {
    const hrState = useHRStore.getState();
    const payrolls = hrState.payrolls || [];
    const payrollItem = payrolls.find(p => p.empId === empId);
    if (!payrollItem) return;

    const dateStr = new Date().toLocaleDateString('vi-VN');
    const empName = payrollItem.name || payrollItem.empName || `Nhân viên #${payrollItem.empId}`;

    set(state => {
      const newTxId = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
      const newTx = {
        id: newTxId,
        type: 'EXPENSE',
        amount: payrollItem.netSalary || payrollItem.netAmount || 0,
        date: dateStr,
        description: `Chi trả lương thực nhận nhân viên ${empName} (Công hưởng lương: ${payrollItem.presentDays || 26}/26 ngày)`
      };
      const nextLedger = [newTx, ...state.ledger];
      try { localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(nextLedger)); } catch (e) {}
      return { ledger: nextLedger };
    });

    const nextPayrolls = payrolls.map(p => {
      if (p.empId === empId) {
        return { ...p, status: 'PAID', disbursedDate: dateStr };
      }
      return p;
    });
    const updatedEmployees = (hrState.employees || []).map(e => e.id === empId ? { ...e, salaryPaid: true } : e);
    useHRStore.setState({ payrolls: nextPayrolls, employees: updatedEmployees });
    try {
      localStorage.setItem('erp_payrolls', JSON.stringify(nextPayrolls));
      localStorage.setItem('erp_employees', JSON.stringify(updatedEmployees));
    } catch (e) {}

    notify(`💸 Đã giải ngân thành công ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payrollItem.netSalary || payrollItem.netAmount || 0)} cho nhân viên ${empName}!`, 'success');
  },

  /**
   * Disburse all approved payrolls
   */
  disburseAllPayrolls: () => {
    const hrState = useHRStore.getState();
    const payrolls = hrState.payrolls || [];
    const eligiblePayrolls = payrolls.filter(p => p.status === 'APPROVED_BY_CEO' || p.status === 'SUBMITTED_TO_ACCOUNTING');
    if (eligiblePayrolls.length === 0) {
      notify('⚠️ Không có bảng lương nào đang chờ giải ngân!', 'error');
      return;
    }

    const dateStr = new Date().toLocaleDateString('vi-VN');
    const newTxs = eligiblePayrolls.map(p => {
      const empName = p.name || p.empName || `Nhân viên #${p.empId}`;
      return {
        id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        type: 'EXPENSE',
        amount: p.netSalary || p.netAmount || 0,
        date: dateStr,
        description: `Chi trả lương thực nhận nhân viên ${empName} (Công hưởng lương: ${p.presentDays || 26}/26 ngày)`
      };
    });

    set(state => {
      const nextLedger = [...newTxs, ...state.ledger];
      try { localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(nextLedger)); } catch (e) {}
      return { ledger: nextLedger };
    });

    const eligibleIds = eligiblePayrolls.map(p => p.empId);
    const nextPayrolls = payrolls.map(p => {
      if (eligibleIds.includes(p.empId)) {
        return { ...p, status: 'PAID', disbursedDate: dateStr };
      }
      return p;
    });
    useHRStore.setState({ payrolls: nextPayrolls });
    try { localStorage.setItem('erp_payrolls', JSON.stringify(nextPayrolls)); } catch (e) {}

    notify(`✅ Kế toán đã giải ngân chi trả lương thành công cho ${eligiblePayrolls.length} nhân viên!`, 'success');
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
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  },

  /**
   * Get total expenses
   */
  getTotalExpenses: () => {
    return get().ledger
      .filter(e => e.type === 'EXPENSE')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
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
    return get().purchaseOrders.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
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
