import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { useAuth } from '../context/AuthContext';
import { useInventoryStore } from '../stores';
import { api } from '../services/api';
import { useAutoRefresh } from './useAutoRefresh';
import { ShoppingBag, Truck, CreditCard, ShieldAlert, Users, Headphones } from 'lucide-react';

// Trung Tâm Nhiệm Vụ theo vai trò: mỗi dòng là MỘT việc mà chính vai trò đang đăng nhập phải
// làm ở bước hiện tại của quy trình (khớp các sơ đồ BPMN), kèm số lượng và nút dẫn thẳng tới
// đúng tab xử lý. Việc thuộc bước của vai trò khác (vd PO chờ CEO duyệt khi đang là Mua Hàng)
// không được tính ở đây. Dữ liệu lấy trực tiếp từ API để số liệu không phụ thuộc trang đang mở.

const QC_ROLES = ['QC', 'QA', 'QUALITY_CONTROL'];
const listOf = (res) => (Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []));

// Nguồn dữ liệu mỗi vai trò cần — chỉ gọi các API vai trò đó có quyền đọc.
const SOURCES_BY_ROLE = {
  WAREHOUSE: ['orders', 'receipts', 'returns', 'purchaseRequests'],
  WAREHOUSE_MANAGER: ['orders', 'receipts', 'returns', 'purchaseRequests', 'stockIntakes'],
  PURCHASING: ['purchaseRequests', 'purchaseOrders'],
  QC: ['purchaseOrders', 'returns'],
  ACCOUNTANT: ['purchaseOrders', 'payrolls', 'returns'],
  CEO: ['purchaseOrders', 'payrolls', 'leaves'],
  ADMIN: ['purchaseOrders', 'payrolls', 'leaves'],
  HR: ['leaves', 'payrolls'],
  CSKH: ['returns', 'complaints'],
  SALES_MANAGER: ['orders', 'returns'],
  SALES: ['orders'],
  ASSEMBLY: ['assemblyJobs'],
  DELIVERY: ['orders', 'returns']
};

const FETCHERS = {
  orders: () => api.get('/orders'),
  receipts: () => api.get('/warehouse/receipts'),
  returns: () => api.get('/orders/returns'),
  purchaseRequests: () => api.get('/warehouse/purchase-requests'),
  purchaseOrders: () => api.get('/purchasing/orders'),
  payrolls: () => api.get('/hr/payrolls'),
  leaves: () => api.get('/hr/leaves/all'),
  complaints: () => api.get('/complaints'),
  stockIntakes: () => api.get('/warehouse/stock-intakes?status=PENDING'),
  assemblyJobs: () => api.get('/assembly-jobs')
};

const normalizeRole = (role) => (QC_ROLES.includes(role) ? 'QC' : role);

const OPEN_PR_STATUSES = ['PENDING', 'APPROVED', 'RFQ_CREATED'];

function buildWarehouseTasks(d, inventory, isManager) {
  const orders = d.orders || [];
  const receipts = d.receipts || [];
  const returns = d.returns || [];
  const prs = d.purchaseRequests || [];
  const tasks = [];

  if (isManager) {
    tasks.push({
      key: 'pr-approve', count: prs.filter(p => p.status === 'PENDING').length,
      label: 'phiếu đề xuất mua hàng chờ Quản Lý Kho duyệt',
      path: '/admin/warehouse?tab=rfq', action: 'Duyệt Phiếu', urgent: true
    });
    tasks.push({
      key: 'intake-approve', count: (d.stockIntakes || []).filter(s => s.status === 'PENDING').length,
      label: 'phiếu nhập kho trực tiếp của Thủ Kho chờ duyệt',
      path: '/admin/warehouse?tab=intake', action: 'Duyệt Nhập', urgent: true
    });
  }
  tasks.push({
    key: 'grn', count: receipts.filter(r => r.status === 'READY' && ['QA_PASSED', 'QA_PARTIAL'].includes(r.po?.status)).length,
    label: 'phiếu nhập đã qua QC, chờ nhập kho (GRN)',
    path: '/admin/warehouse?tab=grn', action: 'Nhập Kho', urgent: true
  });
  tasks.push({
    // Loại đơn còn lệnh lắp ráp chưa xong (assemblyPending) — đó là việc của Lắp Ráp.
    key: 'pack', count: orders.filter(o => ['CONFIRMED', 'PROCESSING', 'AWAITING_SHIP'].includes(o.status) && !o.assemblyPending).length,
    label: 'đơn bán chờ soát serial, đóng gói & xác nhận xuất kho',
    path: '/admin/warehouse?tab=delivery', action: 'Xuất Kho'
  });
  tasks.push({
    key: 'dispatch', count: orders.filter(o => ['PACKED', 'READY_TO_SHIP'].includes(o.status) && !o.assemblyPending && !o.assignedShipperId && !o.assignedShipper).length,
    label: 'đơn đã đóng gói, chưa phân công shipper',
    path: '/admin/warehouse?tab=delivery', action: 'Phân Công'
  });
  const stockOf = (productId) => {
    const inv = inventory.find(i => String(i.id) === String(productId));
    return inv ? Number(inv.stock || 0) : 0;
  };
  // Cùng điều kiện với bộ lọc "Đủ hàng" (isOrderFulfillable) của tab Đơn Chờ Hàng.
  const backorders = orders.filter(o => o.status === 'AWAITING_STOCK');
  tasks.push({
    key: 'backorder', count: backorders.filter(o => (o.items || []).length > 0
      && (o.items || []).every(it => stockOf(it.productId || it.id) >= (Number(it.quantity) || 1))).length,
    label: `đơn chờ hàng nay đã đủ tồn kho, cần giải phóng (trong tổng ${backorders.length} đơn chờ hàng)`,
    path: '/admin/warehouse?tab=backorders', action: 'Giải Phóng'
  });
  tasks.push({
    key: 'rma', count: returns.filter(r => ['QC_PASSED', 'VENDOR_WARRANTY'].includes(r.status)).length,
    label: 'hàng đổi trả đã qua QC, chờ Kho xếp kệ / xử lý',
    path: '/admin/warehouse?tab=returns', action: 'Xử Lý'
  });
  // Linh kiện dưới ngưỡng mà CHƯA có phiếu đề xuất đang mở — Thủ Kho lập phiếu, Quản Lý
  // Kho duyệt, rồi mới tới Mua Hàng (không gửi thẳng cho Mua Hàng).
  // Cùng điều kiện với thẻ "Bổ sung hàng — N Cần mua" trên trang Kho (restockNeededItems).
  const coveredProducts = new Set(prs.filter(p => OPEN_PR_STATUSES.includes(p.status)).map(p => String(p.productId)));
  const restockNeeded = inventory.filter(i => i.status !== 'DISCONTINUED' && Number(i.stock || 0) <= Number(i.threshold || 5));
  const uncovered = restockNeeded.filter(i => !coveredProducts.has(String(i.id))).length;
  tasks.push({
    key: 'low-stock', count: uncovered,
    label: `linh kiện dưới ngưỡng tồn chưa lập phiếu đề xuất (tổng ${restockNeeded.length} cần mua, ${restockNeeded.length - uncovered} đã có phiếu)`,
    path: '/admin/warehouse?tab=rfq', action: 'Lập Phiếu'
  });
  return tasks;
}

export function buildTasks(role, d, inventory, userId = null) {
  const pos = d.purchaseOrders || [];
  const payrolls = d.payrolls || [];
  const returns = d.returns || [];
  const leaves = d.leaves || [];

  switch (role) {
    case 'WAREHOUSE':
    case 'WAREHOUSE_MANAGER':
      return {
        title: role === 'WAREHOUSE_MANAGER' ? 'Trung Tâm Nhiệm Vụ Quản Lý Kho' : 'Trung Tâm Nhiệm Vụ Thủ Kho',
        icon: Truck,
        tasks: buildWarehouseTasks(d, inventory, role === 'WAREHOUSE_MANAGER')
      };
    case 'PURCHASING':
      return {
        title: 'Trung Tâm Nhiệm Vụ Mua Hàng', icon: ShoppingBag,
        tasks: [
          { key: 'pr', count: (d.purchaseRequests || []).filter(p => p.status === 'APPROVED').length,
            label: 'phiếu đề xuất đã được Quản Lý Kho duyệt, chờ lập RFQ',
            path: '/admin/purchasing?tab=requests', action: 'Lập RFQ', urgent: true },
          { key: 'rfq-send', count: pos.filter(p => p.status === 'RFQ').length,
            label: 'RFQ nháp chưa gửi nhà cung cấp',
            path: '/admin/purchasing?tab=rfq', action: 'Gửi NCC' },
          { key: 'quoted', count: pos.filter(p => p.status === 'QUOTED').length,
            label: 'báo giá NCC đã phản hồi, chờ so sánh & chọn',
            path: '/admin/purchasing?tab=compare', action: 'So Sánh' },
          { key: 'po-draft', count: pos.filter(p => p.status === 'PENDING_PO_DRAFT').length,
            label: 'báo giá đã chọn, chờ lập phiếu mua hàng trình CEO',
            path: '/admin/purchasing?tab=rfq', action: 'Lập Phiếu' }
        ]
      };
    case 'QC':
      return {
        title: 'Trung Tâm Nhiệm Vụ Kiểm Định Chất Lượng (QA/QC)', icon: ShieldAlert,
        tasks: [
          { key: 'inbound', count: pos.filter(p => p.status === 'CONFIRMED_BY_SUPPLIER').length,
            label: 'lô hàng NCC đã xác nhận giao, chờ kiểm định nhập',
            path: '/admin/quality-control?tab=inbound', action: 'Kiểm Định', urgent: true },
          { key: 'returns', count: returns.filter(r => r.status === 'DELIVERED_TO_WAREHOUSE').length,
            label: 'hàng đổi trả đã về kho, chờ QC thẩm định',
            path: '/admin/quality-control?tab=returns', action: 'Thẩm Định' }
        ]
      };
    case 'ACCOUNTANT': {
      const isBillable = (po) => ['RECEIVED', 'DONE', 'COMPLETED'].includes(po.status);
      const bill = (po) => (Array.isArray(po.bills) && po.bills.length > 0 ? po.bills[0] : null);
      const isRefundType = (r) => !(r.type === 'EXCHANGE' || r.resolution === 'EXCHANGE_NEW' || r.replacementOrderId);
      return {
        title: 'Trung Tâm Nhiệm Vụ Kế Toán', icon: CreditCard,
        tasks: [
          { key: 'po-pay', count: pos.filter(po => isBillable(po) && (!bill(po) || bill(po).status !== 'PAID')).length,
            label: 'đơn mua đã nhập kho, chờ lập hóa đơn / thanh toán NCC',
            path: '/admin/accounting?tab=po_payments', action: 'Thanh Toán', urgent: true },
          { key: 'payroll', count: payrolls.filter(p => p.status === 'APPROVED_BY_CEO').length,
            label: 'phiếu lương CEO đã duyệt, chờ giải ngân',
            path: '/admin/accounting?tab=payroll_disbursement', action: 'Giải Ngân' },
          { key: 'refund', count: returns.filter(r => isRefundType(r) && ['QC_PASSED', 'RESTOCKED'].includes(r.status)).length,
            label: 'yêu cầu trả hàng đã qua QC, chờ hoàn tiền khách',
            path: '/admin/accounting?tab=refunds', action: 'Hoàn Tiền' }
        ]
      };
    }
    case 'CEO':
    case 'ADMIN':
      return {
        title: 'Trung Tâm Phê Duyệt Ban Giám Đốc', icon: ShieldAlert,
        tasks: [
          { key: 'po', count: pos.filter(p => p.status === 'QUOTED_PENDING_CEO').length,
            label: 'phiếu mua hàng chờ Ban Giám Đốc duyệt phát hành PO',
            path: '/admin/dashboard?tab=approvals', action: 'Duyệt PO', urgent: true },
          { key: 'payroll', count: payrolls.some(p => ['SUBMITTED_TO_ACCOUNTING', 'SUBMITTED_TO_CEO'].includes(p.status)) ? 1 : 0,
            label: 'bảng lương kỳ mới chờ Ban Giám Đốc duyệt',
            path: '/admin/dashboard?tab=approvals', action: 'Duyệt Lương' },
          { key: 'leave', count: leaves.filter(l => l.status === 'PENDING').length,
            label: 'đơn nghỉ phép chờ duyệt',
            path: '/admin/dashboard?tab=approvals', action: 'Xem Đơn' }
        ]
      };
    case 'HR':
      return {
        title: 'Trung Tâm Nhiệm Vụ Nhân Sự', icon: Users,
        tasks: [
          { key: 'leave', count: leaves.filter(l => l.status === 'PENDING').length,
            label: 'đơn nghỉ phép của nhân viên chờ duyệt',
            path: '/admin/hr?tab=leaves', action: 'Duyệt Đơn', urgent: true }
        ],
        info: payrolls.some(p => ['SUBMITTED_TO_ACCOUNTING', 'SUBMITTED_TO_CEO'].includes(p.status))
          ? 'Bảng lương kỳ gần nhất đã trình, đang chờ Ban Giám Đốc duyệt.'
          : null
      };
    case 'CSKH':
      return {
        title: 'Trung Tâm Nhiệm Vụ Chăm Sóc Khách Hàng', icon: Headphones,
        tasks: [
          { key: 'returns', count: returns.filter(r => r.status === 'PENDING').length,
            label: 'yêu cầu đổi trả mới chờ tiếp nhận & xét duyệt',
            path: '/admin/cskh?tab=returns', action: 'Xét Duyệt', urgent: true },
          { key: 'complaints', count: (d.complaints || []).filter(c => ['OPEN', 'IN_PROGRESS'].includes(c.status)).length,
            label: 'khiếu nại chưa giải quyết',
            path: '/admin/cskh?tab=complaints', action: 'Xử Lý' }
        ]
      };
    case 'SALES':
    case 'SALES_MANAGER': {
      const tasks = [
        { key: 'confirm', count: (d.orders || []).filter(o => o.status === 'PENDING').length,
          label: 'đơn hàng mới chờ xác nhận',
          path: '/admin/sales?tab=orders', action: 'Xác Nhận', urgent: true },
        { key: 'transfer', count: (d.orders || []).filter(o => o.status === 'WAITING_PAYMENT').length,
          label: 'đơn chuyển khoản chờ đối soát thanh toán',
          path: '/admin/sales?tab=orders', action: 'Đối Soát' }
      ];
      if (role === 'SALES_MANAGER') {
        tasks.push({ key: 'returns', count: returns.filter(r => r.status === 'PENDING').length,
          label: 'yêu cầu đổi trả chờ xét duyệt',
          path: '/admin/cskh?tab=returns', action: 'Xét Duyệt' });
      }
      return { title: 'Trung Tâm Nhiệm Vụ Bán Hàng', icon: ShoppingBag, tasks };
    }
    case 'ASSEMBLY':
      return {
        title: 'Trung Tâm Nhiệm Vụ Lắp Ráp', icon: Truck,
        tasks: [
          { key: 'jobs', count: (d.assemblyJobs || []).filter(j => ['PENDING', 'ASSEMBLING'].includes(j.status)).length,
            label: 'lệnh lắp ráp đang chờ hoặc đang thực hiện',
            path: '/admin/assembly?tab=jobs', action: 'Lắp Ráp', urgent: true }
        ]
      };
    case 'DELIVERY': {
      const mine = (o) => userId != null && String(o.assignedShipperId) === String(userId);
      const orders = d.orders || [];
      return {
        title: 'Trung Tâm Nhiệm Vụ Giao Hàng', icon: Truck,
        tasks: [
          { key: 'pickup', count: orders.filter(o => o.status === 'READY_TO_SHIP' && mine(o)).length,
            label: 'đơn đã đóng gói được phân công cho bạn, chờ nhận tại kho',
            path: '/admin/delivery?tab=pending', action: 'Nhận Đơn', urgent: true },
          { key: 'shipping', count: orders.filter(o => o.status === 'SHIPPED' && mine(o)).length,
            label: 'đơn bạn đang giao, cần chụp minh chứng khi giao xong',
            path: '/admin/delivery?tab=active', action: 'Giao Hàng' },
          { key: 'rma', count: (d.returns || []).filter(r => r.status === 'RETURN_APPROVED').length,
            label: 'yêu cầu đổi trả đã duyệt, chờ bạn đến thu hồi hàng',
            path: '/admin/delivery?tab=returns', action: 'Thu Hồi' }
        ]
      };
    }
    default:
      return null;
  }
}


// Dữ liệu dùng chung cho Sidebar (số trên menu) và ActorNotificationBar (Trung Tâm Nhiệm Vụ): tải một lần,
// hai nơi luôn hiển thị cùng một con số.
const useRoleTaskData = create((set, get) => ({
  role: null, data: {}, loading: false, inflight: null, lastAt: 0,
  load: async (role, { force = false } = {}) => {
    const st = get();
    if (st.role !== role) set({ role, data: {}, lastAt: 0 });
    if (st.inflight && st.role === role) return st.inflight;
    if (!force && st.role === role && Date.now() - st.lastAt < 5000) return;
    const sources = SOURCES_BY_ROLE[role] || [];
    if (!sources.length) return;
    const run = (async () => {
      set({ loading: true });
      const results = await Promise.allSettled(sources.map(s => FETCHERS[s]()));
      const next = {};
      // Nguồn nào lỗi (mạng, 403...) thì bỏ qua — việc tương ứng hiển thị 0 thay vì làm hỏng cả thanh.
      results.forEach((r, i) => { if (r.status === 'fulfilled') next[sources[i]] = listOf(r.value); });
      if (get().role === role) set({ data: next, lastAt: Date.now() });
      set({ loading: false, inflight: null });
    })();
    set({ inflight: run });
    return run;
  },
}));

const EMPTY_DATA = Object.freeze({}); // tham chiếu cố định: selector trả object mới mỗi lần sẽ gây vẽ lại vô hạn

/** Việc cần làm của vai trò đang đăng nhập (nguồn duy nhất cho số trên menu và Trung Tâm Nhiệm Vụ). */
export function useRoleTasks() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role || '');
  const inventory = useInventoryStore(state => state.inventory) || [];
  const data = useRoleTaskData(state => (state.role === role ? state.data : EMPTY_DATA));
  const loading = useRoleTaskData(state => state.loading);
  const loadStore = useRoleTaskData(state => state.load);
  const hasSources = (SOURCES_BY_ROLE[role] || []).length > 0;
  const reload = useCallback((silent = false) => loadStore(role, { force: !silent }), [role, loadStore]);

  useEffect(() => { if (hasSources) loadStore(role); }, [role, hasSources, loadStore]);
  useAutoRefresh(() => loadStore(role, { force: true }), { enabled: hasSources });
  useEffect(() => {
    const onChange = () => loadStore(role, { force: true });
    window.addEventListener('erp-po-updated', onChange);
    window.addEventListener('erp-notification-sent', onChange);
    return () => {
      window.removeEventListener('erp-po-updated', onChange);
      window.removeEventListener('erp-notification-sent', onChange);
    };
  }, [role, loadStore]);

  const config = buildTasks(role, data, inventory, user?.id);
  return { role, config, data, loading, reload };
}

// Tab tương ứng của một việc (các việc "so sánh báo giá" nằm trong tab RFQ trên menu)
const TAB_ALIASES = { '/admin/purchasing?tab=compare': '/admin/purchasing?tab=rfq' };

/** Số việc của vai trò hiện tại thuộc từng mục menu, khoá theo đường dẫn '/admin/<phân hệ>?tab=<tab>'. */
export function useMenuBadges() {
  const { config } = useRoleTasks();
  const map = {};
  (config?.tasks || []).forEach(t => {
    const key = TAB_ALIASES[t.path] || t.path;
    map[key] = (map[key] || 0) + (Number(t.count) || 0);
  });
  return { badges: map, tasks: config?.tasks || [] };
}
