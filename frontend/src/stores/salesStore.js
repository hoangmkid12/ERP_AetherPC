import { create } from 'zustand';
import { api } from '../services/api';
import { useInventoryStore } from './inventoryStore';
import { useFinanceStore } from './financeStore';

/**
 * @typedef {Object} Order
 * @property {string} orderId
 * @property {string} customerName
 * @property {string} phone
 * @property {string} email
 * @property {string} shippingAddress
 * @property {number} totalAmount
 * @property {string} status
 * @property {string} type
 * @property {Array} items
 * @property {string} date
 */

/**
 * @typedef {Object} ReturnRequest
 * @property {string} id
 * @property {string} orderId
 * @property {string} customerName
 * @property {string} type
 * @property {string} reason
 * @property {string} status
 * @property {string} date
 */

/**
 * @typedef {Object} Complaint
 * @property {string} id
 * @property {string} customerName
 * @property {string} subject
 * @property {string} description
 * @property {string} priority
 * @property {string} status
 * @property {string} assignedTo
 */

const INITIAL_STATE = {
  orders: [],
  returnRequests: [],
  complaints: [],
  error: null,
};

const STORAGE_KEYS = {
  orders: 'erp_orders',
  returnRequests: 'erp_return_requests',
  complaints: 'erp_complaints',
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
    console.error('Error loading sales data from localStorage:', e);
  }
  return state;
};

export const useSalesStore = create((set, get) => ({
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
      get().getOrders(),
      get().getReturnRequests(),
      get().getComplaints(),
    ]);
  },

  /**
   * Fetch all orders from API
   */
  getOrders: async () => {
    try {
      set({ error: null });
      const data = await api.get('/orders');
      const orders = Array.isArray(data) ? data : (data?.data || []);
      
      set({ orders });
      try {
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
      } catch (e) {}
      
      return orders;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch orders';
      set({ error: errorMsg });
      console.error('Error fetching orders:', err);
      throw err;
    }
  },

  /**
   * Fetch all return requests from API & localStorage
   */
  getReturnRequests: async () => {
    try {
      set({ error: null });
      let apiReturns = [];
      try {
        const data = await api.get('/orders/returns');
        apiReturns = Array.isArray(data) ? data : (data?.data || []);
      } catch (e) {
        console.warn('[SalesStore] /orders/returns notice:', e.message);
      }
      
      let localReturns = [];
      try {
        localReturns = JSON.parse(localStorage.getItem(STORAGE_KEYS.returnRequests) || '[]');
      } catch (e) {}

      const map = new Map();
      localReturns.forEach(r => {
        const k = String(r.id || r.orderId || '');
        if (k) map.set(k, r);
      });
      apiReturns.forEach(r => {
        const k = String(r.id || r.orderId || '');
        if (k) map.set(k, { ...map.get(k), ...r });
      });

      const merged = Array.from(map.values());
      set({ returnRequests: merged });
      try {
        localStorage.setItem(STORAGE_KEYS.returnRequests, JSON.stringify(merged));
      } catch (e) {}
      
      return merged;
    } catch (err) {
      console.error('Error fetching return requests:', err);
    }
  },

  /**
   * Fetch all complaints from API
   */
  getComplaints: async () => {
    try {
      set({ error: null });
      const data = await api.get('/complaints');
      const complaints = Array.isArray(data) ? data : (data?.data || []);
      
      set({ complaints });
      try {
        localStorage.setItem(STORAGE_KEYS.complaints, JSON.stringify(complaints));
      } catch (e) {}
      
      return complaints;
    } catch (err) {
      const errorMsg = err.message || 'Failed to fetch complaints';
      set({ error: errorMsg });
      console.error('Error fetching complaints:', err);
      throw err;
    }
  },

  /**
   * Process checkout for Online & POS orders
   */
  processCheckout: (customerName, phone, items, type = 'ONLINE', customTotal = null, shippingAddress = '', paymentMethod = 'COD', customerEmail = '') => {
    const dateStr = new Date().toLocaleDateString('vi-VN');
    const newOrderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const totalAmount = customTotal !== null ? customTotal : items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

    let orderStatus = 'PENDING';
    
    if (type === 'POS') {
      orderStatus = 'DELIVERED';
      
      // Update inventory stock
      try {
        if (useInventoryStore) {
          const invState = useInventoryStore.getState();
          const updatedInventory = (invState.inventory || []).map(invItem => {
            const matchInOrder = items.find(oItem => String(oItem.productId || oItem.id) === String(invItem.id));
            if (matchInOrder) {
              const nextStock = Math.max(0, invItem.stock - (matchInOrder.quantity || 1));
              return { ...invItem, stock: nextStock };
            }
            return invItem;
          });
          useInventoryStore.setState({ inventory: updatedInventory });
          localStorage.setItem('erp_inventory', JSON.stringify(updatedInventory));
        }
      } catch (_) {}

      // Record transaction
      try {
        if (useFinanceStore) {
          useFinanceStore.getState().addLocalLedgerEntry({
            id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
            type: 'INCOME',
            amount: totalAmount,
            date: dateStr,
            description: `Thu tiền đơn hàng POS lẻ ${newOrderId}`
          });
        }
      } catch (_) {}
    }

    let userEmail = customerEmail;
    if (!userEmail) {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) userEmail = JSON.parse(storedUser).email || '';
      } catch (e) {}
    }

    const newOrder = {
      orderId: newOrderId,
      customerName,
      phone,
      email: userEmail,
      shippingAddress: shippingAddress || (type === 'POS' ? 'Bán tại cửa hàng (POS)' : 'Địa chỉ giao hàng mặc định'),
      totalAmount,
      date: dateStr,
      status: orderStatus,
      type,
      items,
      createdAtTime: Date.now()
    };
    
    set(state => {
      const orders = [newOrder, ...state.orders];
      try {
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
      } catch (e) {}
      return { orders };
    });

    api.post('/orders', {
      orderId: newOrderId,
      customerName,
      phone,
      email: userEmail,
      items: items.map(it => ({ productId: it.productId || it.id, quantity: it.quantity || 1 })),
      paymentMethod: paymentMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'COD',
      shippingAddress: shippingAddress || (type === 'POS' ? 'Bán tại cửa hàng (POS)' : 'Hồ Chí Minh'),
      shippingCity: 'Hồ Chí Minh',
      notes: type === 'POS' ? 'Đơn bán lẻ tại quầy (POS)' : 'Đặt hàng online (Đồng bộ)',
      type
    }).catch(err => console.warn('[SalesStore] Checkout sync notice:', err.message));

    return newOrderId;
  },

  /**
   * Update order details (name, phone, address, notes)
   */
  updateOrderDetails: (orderId, details) => {
    set(state => {
      const orders = state.orders.map(o => {
        if ((o.orderId === orderId || o.id === orderId) && o.status === 'PENDING') {
          return {
            ...o,
            customerName: details.customerName || o.customerName,
            phone: details.phone || o.phone,
            shippingAddress: details.shippingAddress || o.shippingAddress,
            lastNote: details.notes !== undefined ? details.notes : o.lastNote
          };
        }
        return o;
      });
      try {
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
      } catch (e) {}
      return { orders };
    });

    api.patch(`/orders/${orderId}/details`, details).catch(err => console.warn('[SalesStore] Order details sync notice:', err.message));
  },

  /**
   * Create a new order
   */
  createOrder: async (orderData) => {
    try {
      set({ error: null });
      const newOrder = await api.post('/orders', orderData);
      
      set(state => {
        const updated = [...state.orders, newOrder];
        try {
          localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(updated));
        } catch (e) {}
        return { orders: updated };
      });
      
      return newOrder;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create order';
      set({ error: errorMsg });
      console.error('Error creating order:', err);
      throw err;
    }
  },

  /**
   * Update order status with notes and extra data (including POD, payment method, bankRefCode)
   */
  updateOrderStatus: async (orderId, newStatus, note = null, extraData = {}) => {
    if (typeof note === 'object' && note !== null) {
      extraData = { ...note };
      note = note.note || note.failNote || note.receiverNote || null;
    }

    // Confirm with the backend first — only reflect the change locally once
    // the server accepts it, so the UI never shows a status the API rejected.
    try {
      await api.patch(`/orders/${orderId}/status`, {
        status: newStatus,
        note,
        ...extraData
      });
    } catch (err) {
      console.error(`[SalesStore] Failed to update order #${orderId} status:`, err.message);
      throw err;
    }

    set(state => {
      const orders = state.orders.map(o => {
        if (o.orderId === orderId || o.id === orderId) {
          const isDelivered = newStatus === 'DELIVERED';
          return {
            ...o,
            status: newStatus,
            ...(isDelivered ? {
              paymentStatus: 'PAID',
              deliveredAt: extraData.deliveredAt || new Date().toISOString(),
              actualPaymentMethod: extraData.actualPaymentMethod || (o.paymentMethod === 'COD' ? 'CASH' : 'PREPAID'),
              bankRefCode: extraData.bankRefCode || null,
              paymentProofPhoto: extraData.paymentProofPhoto || null,
              receivedByType: extraData.receivedByType || 'DIRECT_CUSTOMER',
              receiverNameActual: extraData.receiverNameActual || (extraData.receivedByType === 'DIRECT_CUSTOMER' ? (o.customerName || 'Khách hàng') : 'Người nhận thay')
            } : {}),
            ...(note ? { lastNote: note } : {}),
            ...extraData
          };
        }
        return o;
      });

      try {
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
      } catch (e) {}

      return { orders };
    });
  },

  /**
   * Claim order for delivery
   */
  claimOrderForDelivery: async (orderId, shipperUser) => {
    const orders = get().orders;
    const targetOrder = orders.find(o => o.orderId === orderId || String(o.id) === String(orderId));
    if (!targetOrder) {
      return { success: false, message: `Không tìm thấy đơn hàng ${orderId} trong hệ thống!` };
    }

    const shipperId = shipperUser?.id || shipperUser?.username || 'SHIPPER';
    const shipperName = shipperUser?.fullname || shipperUser?.name || shipperUser?.username || 'Giao Hàng';

    if (targetOrder.assignedShipperId && String(targetOrder.assignedShipperId) !== String(shipperId)) {
      return {
        success: false,
        message: `Đơn hàng ${orderId} đã được Shipper "${targetOrder.assignedShipperName || targetOrder.assignedShipperId}" nhận trước đó.`
      };
    }

    const nowStr = new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const noteText = `Đã lấy hàng & đang vận chuyển giao – Shipper: ${shipperName} (${nowStr})`;

    try {
      await get().updateOrderStatus(orderId, 'SHIPPED', noteText, {
        assignedShipperId: shipperId,
        assignedShipperName: shipperName,
        assignedAt: new Date().toISOString(),
        assignmentMethod: 'SELF_CLAIM'
      });
    } catch (err) {
      return { success: false, message: `Không thể nhận đơn hàng ${orderId}: ${err.message}` };
    }

    return { success: true, message: `Đã nhận đơn hàng ${orderId} thành công.` };
  },

  /**
   * Add a new return request (Customer / CSKH)
   */
  addReturnRequest: async (returnData) => {
    const newReturn = {
      id: returnData.id || `RMA-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: returnData.status || 'RETURN_APPROVED',
      type: returnData.type || 'REFUND',
      ...returnData
    };

    set(state => {
      const updated = [newReturn, ...state.returnRequests.filter(r => r.id !== newReturn.id)];
      try {
        localStorage.setItem(STORAGE_KEYS.returnRequests, JSON.stringify(updated));
      } catch (e) {}
      return { returnRequests: updated };
    });

    // Cập nhật trạng thái đơn hàng tương ứng
    if (returnData.orderId) {
      get().updateOrderStatus(
        returnData.orderId,
        'RETURNING_TO_WAREHOUSE',
        `Khách hàng tạo yêu cầu ${returnData.type === 'REFUND' ? 'Trả hàng Hoàn tiền 100%' : 'Đổi sản phẩm mới'}. Lý do: ${returnData.reason || 'N/A'}. (STK hoàn: ${returnData.bankAccountNo || 'N/A'} - ${returnData.bankName || 'N/A'})`
      );
    }

    try {
      if (returnData.orderId) {
        await api.post(`/orders/${returnData.orderId}/return`, returnData);
      }
    } catch (e) {
      console.warn('[SalesStore] addReturnRequest sync notice:', e.message);
    }
    return newReturn;
  },

  /**
   * Create an Exchange Replacement Order (Đơn Hàng Đổi Mới 1-1 Bù Trừ 0đ)
   */
  createExchangeReplacementOrder: (returnItem) => {
    const originalOrderId = returnItem.orderId;
    const originalOrder = get().orders.find(o => o.orderId === originalOrderId || String(o.id) === String(originalOrderId));
    
    const replacementOrderId = `ORD-EXC-${(originalOrderId || Date.now().toString().slice(-4)).replace('ORD-', '')}`;
    
    // Check if replacement order already exists
    const existing = get().orders.find(o => o.orderId === replacementOrderId);
    if (existing) return existing;

    const replacementOrder = {
      orderId: replacementOrderId,
      customerName: returnItem.customerName || originalOrder?.customerName || 'Khách Đổi Bảo Hành',
      phone: returnItem.phone || originalOrder?.phone || '',
      email: returnItem.email || originalOrder?.email || '',
      shippingAddress: returnItem.shippingAddress || returnItem.address || originalOrder?.shippingAddress || 'Địa chỉ nhận hàng đổi mới',
      totalAmount: 0, // Bù trừ 100% bảo hành
      date: new Date().toLocaleDateString('vi-VN'),
      status: 'CONFIRMED', // Sẵn sàng để kho đóng gói xuất kho
      type: 'EXCHANGE',
      items: originalOrder?.items || [{
        productId: returnItem.productId || 1,
        name: returnItem.productName || returnItem.product || 'Linh kiện đổi mới 1-1',
        price: 0,
        quantity: 1
      }],
      exchangeFromRmaId: returnItem.id,
      exchangeFromOrderId: originalOrderId,
      notes: `[ĐƠN ĐỔI MỚI 1-1] Xuất kho sản phẩm mới thay thế cho đơn #${originalOrderId} (Phiếu RMA: #${returnItem.id}). Giá trị: 0đ (Bù trừ 100%)`,
      createdAtTime: Date.now()
    };

    set(state => {
      const updatedOrders = [replacementOrder, ...state.orders.filter(o => o.orderId !== replacementOrderId)];
      try {
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(updatedOrders));
      } catch (e) {}
      return { orders: updatedOrders };
    });

    return replacementOrder;
  },

  /**
   * Update return request status across Shipper, QC, Warehouse, Accountant
   */
  updateReturnStatus: async (returnId, status, extraData = {}) => {
    const extraObj = typeof extraData === 'object' && extraData !== null ? extraData : { note: extraData };
    let capturedOrderId = null;

    set(state => {
      const returnRequests = state.returnRequests.map(r => {
        const match = 
          String(r.id) === String(returnId) ||
          String(r.orderId) === String(returnId) ||
          (r.rmaNumber && String(r.rmaNumber) === String(returnId)) ||
          String(r.id).includes(String(returnId)) ||
          String(returnId).includes(String(r.id));

        if (match) {
          capturedOrderId = r.orderId;
          const updatedReturn = { ...r, status, ...extraObj };

          // Nếu loại EXCHANGE và kho nhập hàng cũ (RESTOCKED / EXCHANGED) -> Tạo đơn đổi mới nếu chưa có
          if (r.type === 'EXCHANGE' && (status === 'RESTOCKED' || status === 'EXCHANGED') && !r.replacementOrderId) {
            const excOrder = get().createExchangeReplacementOrder(updatedReturn);
            updatedReturn.replacementOrderId = excOrder.orderId;
            updatedReturn.status = 'EXCHANGED';
          }

          return updatedReturn;
        }
        return r;
      });

      try {
        localStorage.setItem(STORAGE_KEYS.returnRequests, JSON.stringify(returnRequests));
      } catch (e) {}

      // Đồng bộ trạng thái đơn hàng tương ứng
      const effectiveOrderId = capturedOrderId || returnId;
      if (effectiveOrderId) {
        const orderStatusMap = {
          'RETURNING_TO_WAREHOUSE': 'RETURNING_TO_WAREHOUSE',
          'DELIVERED_TO_WAREHOUSE': 'DELIVERED_TO_WAREHOUSE',
          'QC_PASSED': 'QC_PASSED',
          'RESTOCKED': 'RESTOCKED',
          'EXCHANGED': 'EXCHANGED',
          'REFUNDED': 'REFUNDED',
          'REJECTED': 'DELIVERED'
        };
        const mappedOrderStatus = orderStatusMap[status];
        if (mappedOrderStatus) {
          get().updateOrderStatus(effectiveOrderId, mappedOrderStatus, extraObj.note || `Cập nhật quy trình RMA: ${status}`);
        }
      }

      return { returnRequests };
    });

    // KHÔNG được nuốt lỗi ở đây (trước đây chỉ console.warn rồi coi như xong):
    // hàm này cập nhật RMA/hoàn tiền/nhập kho — nếu API thật thất bại mà vẫn
    // resolve bình thường, mọi màn hình gọi hàm này (Kế Toán hoàn tiền, Kho
    // nhập lại hàng, QC thẩm định, Shipper thu hồi) đều tưởng đã thành công
    // trong khi backend chưa hề ghi nhận gì. Ném lỗi thật để nơi gọi biết và
    // báo đúng cho người dùng.
    const targetApiId = capturedOrderId || returnId;
    if (status === 'RETURNING_TO_WAREHOUSE') {
      await api.patch(`/orders/returns/${targetApiId}/pickup`, extraObj);
    } else if (status === 'DELIVERED_TO_WAREHOUSE') {
      await api.patch(`/orders/returns/${targetApiId}/deliver-warehouse`, extraObj);
    } else if (status === 'QC_PASSED' || status === 'REJECTED') {
      await api.patch(`/orders/returns/${targetApiId}/qc-inspect`, extraObj);
    } else if (['RESTOCKED', 'EXCHANGED', 'VENDOR_WARRANTY', 'INSPECTED_SCRAP'].includes(status)) {
      // Backend infers the real outcome (restock / exchange / send-to-
      // vendor / scrap) from `shelfLocation` in the body, not from this
      // status value itself — see confirmReturnWarehouse.
      await api.patch(`/orders/returns/${targetApiId}/restock`, extraObj);
    } else if (status === 'REFUNDED') {
      await api.patch(`/orders/returns/${targetApiId}/refund`, extraObj);
    } else {
      throw new Error(`Không có API thật cho trạng thái "${status}".`);
    }
  },

  /**
   * Add complaint — awaits the real POST /complaints and stores the
   * server-assigned id (a Prisma-generated UUID), not a client-invented one.
   * A client id here previously meant any status update made in the same
   * session (before the next full refetch) targeted an id the backend had
   * never heard of and 404'd.
   */
  addComplaint: async (data) => {
    const res = await api.post('/complaints', data);
    const newTicket = res?.data;
    if (!newTicket) throw new Error(res?.message || 'Không thể gửi khiếu nại.');

    set(state => {
      const complaints = [newTicket, ...state.complaints];
      try {
        localStorage.setItem(STORAGE_KEYS.complaints, JSON.stringify(complaints));
      } catch (e) {}
      return { complaints };
    });

    return newTicket;
  },

  /**
   * Update complaint status — awaits the real PUT /complaints/:id and only
   * applies the change locally on confirmed server success.
   */
  updateComplaintStatus: async (id, status, assignedTo = null, resolution = '') => {
    const res = await api.put(`/complaints/${id}`, { status, assignedTo, resolution });
    const updated = res?.data;
    if (!updated) throw new Error(res?.message || 'Không thể cập nhật khiếu nại.');

    set(state => ({
      complaints: state.complaints.map(c => (c.id === id ? updated : c))
    }));
    try {
      localStorage.setItem(STORAGE_KEYS.complaints, JSON.stringify(get().complaints));
    } catch (e) {}

    return updated;
  },

  /**
   * Delete complaint
   */
  deleteComplaint: async (complaintId) => {
    try {
      set({ error: null });
      await api.delete(`/complaints/${complaintId}`);
      
      set(state => {
        const complaints = state.complaints.filter(c => c.id !== complaintId);
        try {
          localStorage.setItem(STORAGE_KEYS.complaints, JSON.stringify(complaints));
        } catch (e) {}
        return { complaints };
      });
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete complaint';
      set({ error: errorMsg });
      console.error('Error deleting complaint:', err);
      throw err;
    }
  },

  /**
   * Add order locally (offline support)
   */
  addLocalOrder: (order) => {
    set(state => {
      const updated = [...state.orders, order];
      try {
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(updated));
      } catch (e) {}
      return { orders: updated };
    });
  },

  /**
   * Clear all sales data
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
   * Get order by ID
   */
  getOrderById: (orderId) => {
    return get().orders.find(o => o.orderId === orderId || o.id === orderId);
  },

  /**
   * Get orders by status
   */
  getOrdersByStatus: (status) => {
    return get().orders.filter(o => o.status === status);
  },

  /**
   * Get orders by customer phone
   */
  getOrdersByPhone: (phone) => {
    return get().orders.filter(o => o.phone === phone);
  },

  /**
   * Get total sales amount
   */
  getTotalSalesAmount: () => {
    return get().orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  },

  /**
   * Get average order value
   */
  getAverageOrderValue: () => {
    const orders = get().orders;
    if (orders.length === 0) return 0;
    return getTotalSalesAmount() / orders.length;
  },

  /**
   * Get return requests by status
   */
  getReturnsByStatus: (status) => {
    return get().returnRequests.filter(r => r.status === status);
  },

  /**
   * Get complaints by status
   */
  getComplaintsByStatus: (status) => {
    return get().complaints.filter(c => c.status === status);
  },

  /**
   * Get complaints by priority
   */
  getComplaintsByPriority: (priority) => {
    return get().complaints.filter(c => c.priority === priority);
  },
}));
