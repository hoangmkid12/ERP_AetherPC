import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSalesStore, useInventoryStore, useHRStore, useFinanceStore, useUtilityStore } from '../../stores';
import { api } from '../../services/api';
import { notify, confirm } from '../../context/NotificationContext';
import { PO_STATUS, ORDER_STATUS, getStatusLabel } from '../../utils/statusLabels';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement, 
  LineElement, 
  ArcElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { 
  DollarSign, ShoppingBag, AlertTriangle, Users, TrendingUp, Truck, Wrench, 
  Bell, Check, ArrowRight, Eye, X, Package, Calendar, ShieldCheck, FileText, 
  Sparkles, CheckCircle2, XCircle, Clock, PieChart, Layers, ArrowUpRight, Award
} from 'lucide-react';
import OrderDetailModal from '../../components/OrderDetailModal';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const parseDateVal = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    if (val.includes('/')) {
      const parts = val.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const isDateInFilter = (dateVal, period, customStart, customEnd) => {
  if (period === 'ALL') return true;
  const d = parseDateVal(dateVal);
  if (!d) return true;

  const now = new Date();
  
  const toYMD = (dateObj) => {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const itemYMD = toYMD(d);
  const todayYMD = toYMD(now);

  if (period === 'TODAY') {
    return itemYMD === todayYMD;
  }

  if (period === 'THIS_WEEK') {
    const day = now.getDay();
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return d >= monday && d <= sunday;
  }

  if (period === 'THIS_MONTH') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  if (period === 'THIS_QUARTER') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const itemQuarter = Math.floor(d.getMonth() / 3);
    return itemQuarter === currentQuarter && d.getFullYear() === now.getFullYear();
  }

  if (period === 'THIS_YEAR') {
    return d.getFullYear() === now.getFullYear();
  }

  if (period === 'CUSTOM') {
    if (customStart && itemYMD < customStart) return false;
    if (customEnd && itemYMD > customEnd) return false;
    return true;
  }

  return true;
};

const formatPrice = (price) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0);
};

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isCEO, isAdmin } = useAuth();
  
  const orders = useSalesStore(state => state.orders) || [];
  const inventory = useInventoryStore(state => state.inventory) || [];
  const employees = useHRStore(state => state.employees) || [];
  const payrolls = useHRStore(state => state.payrolls) || [];
  const approvePayrollByCEO = useHRStore(state => state.approvePayrollByCEO);
  const leaveRequests = useHRStore(state => state.leaveRequests) || [];
  const approveLeaveRequest = useHRStore(state => state.approveLeaveRequest);
  const rejectLeaveRequest = useHRStore(state => state.rejectLeaveRequest);
  const purchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];
  const updatePurchaseOrderStatus = useFinanceStore(state => state.updatePurchaseOrderStatus);
  const generalLedger = useFinanceStore(state => state.ledger) || [];
  const assemblyJobs = useUtilityStore(state => state.assemblyJobs) || [];

  // Active Tab from URL (?tab=overview|approvals|financials|kpi|supplychain)
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  // State
  const [quotedOrders, setQuotedOrders] = useState([]);
  const [loadingQuoted, setLoadingQuoted] = useState(false);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);
  const [selectedDetailPO, setSelectedDetailPO] = useState(null);
  const [showKPIDetailModal, setShowKPIDetailModal] = useState(false);
  const [dateFilterPeriod, setDateFilterPeriod] = useState('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Approval History modal (Trung Tâm Phê Duyệt) — flattened PurchaseOrderStatusHistory
  // across every PO, with its own filters independent of the page-wide date filter.
  const [showApprovalHistory, setShowApprovalHistory] = useState(false);
  const [loadingApprovalHistory, setLoadingApprovalHistory] = useState(false);
  const [approvalHistoryEntries, setApprovalHistoryEntries] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');

  const SUPPLIER_NAME_MAP = {
    's1': 'Samsung Vina Electronics Co., Ltd',
    's2': 'Mai Hoàng Distribution',
    's3': 'Intel Vietnam Authorized Distributor',
    's4': 'Công ty Cổ phần Đầu tư Công nghệ Anh Ngọc',
    's5': 'AMD Southeast Asia Pte Ltd (VN Representative)',
    's6': 'ASUS Vietnam Distribution',
    's7': 'MSI Vietnam Official',
    's8': 'GIGABYTE Vietnam Official'
  };

  const DEFAULT_SUPPLIERS_BY_CORE_ID = {
    '1': 'Samsung Vina Electronics Co., Ltd',
    '0001': 'Samsung Vina Electronics Co., Ltd',
    '2': 'ASUS Vietnam Distribution',
    '0002': 'ASUS Vietnam Distribution',
    '3': 'Mai Hoàng Distribution',
    '0003': 'Mai Hoàng Distribution',
    '4': 'Công ty Cổ phần Đầu tư Công nghệ Anh Ngọc',
    '0004': 'Công ty Cổ phần Đầu tư Công nghệ Anh Ngọc',
    '5': 'MSI Vietnam Official',
    '0005': 'MSI Vietnam Official',
    '6': 'GIGABYTE Vietnam Official',
    '0006': 'GIGABYTE Vietnam Official',
    '7': 'Intel Vietnam Authorized Distributor',
    '0007': 'Intel Vietnam Authorized Distributor',
    '8': 'AMD Southeast Asia Pte Ltd (VN Representative)',
    '0008': 'AMD Southeast Asia Pte Ltd (VN Representative)'
  };

  const getSupplierName = (po) => {
    if (!po) return 'Nhà Cung Cấp Uy Tín';
    
    // 1. Direct supplier object or string
    if (po.supplier?.name && po.supplier.name !== 'Chưa rõ') return po.supplier.name;
    if (typeof po.supplierName === 'string' && po.supplierName.trim() && po.supplierName !== 'Chưa rõ') return po.supplierName;
    if (typeof po.supplier === 'string' && po.supplier.trim() && po.supplier !== 'Chưa rõ') {
      return SUPPLIER_NAME_MAP[po.supplier] || po.supplier;
    }

    // 2. Check supplierCode
    const code = po.supplierCode || po.supplier?.code;
    if (code && SUPPLIER_NAME_MAP[code]) {
      return SUPPLIER_NAME_MAP[code];
    }
    if (code && code !== 'Chưa rõ') return code;

    // 3. Fallback by Core ID (e.g. RFQ-2026-0007 -> 7 -> Intel, RFQ-2026-0008 -> 8 -> AMD)
    const coreId = getPoCoreId(po);
    if (coreId && DEFAULT_SUPPLIERS_BY_CORE_ID[coreId]) {
      return DEFAULT_SUPPLIERS_BY_CORE_ID[coreId];
    }

    // 4. Fallback by items inspection
    if (Array.isArray(po.items) && po.items.length > 0) {
      const firstItemName = (po.items[0].productName || po.items[0].name || '').toLowerCase();
      if (firstItemName.includes('intel') || firstItemName.includes('i5') || firstItemName.includes('i7') || firstItemName.includes('i9')) {
        return 'Intel Vietnam Authorized Distributor';
      }
      if (firstItemName.includes('amd') || firstItemName.includes('ryzen')) {
        return 'AMD Southeast Asia Pte Ltd (VN Representative)';
      }
      if (firstItemName.includes('asus')) {
        return 'ASUS Vietnam Distribution';
      }
      if (firstItemName.includes('msi')) {
        return 'MSI Vietnam Official';
      }
      if (firstItemName.includes('samsung')) {
        return 'Samsung Vina Electronics Co., Ltd';
      }
    }

    return 'Nhà Cung Cấp Chính Thức';
  };

  // Canonical Core PO identifier extractor
  // Normalizes all variants (8, "0008", "RFQ-2026-0008", "PO-2026-0008") to a single canonical numeric string key ("8")
  const getPoCoreId = (po) => {
    if (!po && po !== 0) return '';
    const raw = typeof po === 'object' ? String(po.poNumber || po.reference || po.id || '') : String(po);
    const trimmed = raw.trim();
    if (!trimmed) return '';

    const matchFull = trimmed.match(/^(?:PO|RFQ|PR)-\d{4}-(\d+)$/i);
    if (matchFull) return String(parseInt(matchFull[1], 10));

    const matchShort = trimmed.match(/^(?:PO|RFQ|PR)-(\d+)$/i);
    if (matchShort) return String(parseInt(matchShort[1], 10));

    const digits = trimmed.replace(/\D/g, '');
    if (digits) {
      if (digits.length > 8) return digits;
      return String(parseInt(digits, 10));
    }

    return trimmed.toUpperCase();
  };

  // Standard enterprise PO/RFQ code formatter
  const formatPurchaseReference = (po) => {
    if (!po) return '';
    const raw = typeof po === 'object' ? String(po.poNumber || po.reference || po.id || '') : String(po);
    const isRfq = typeof po === 'object' && po !== null ? (['RFQ', 'RFQ_SENT', 'AWAITING_SUPPLIER_QUOTE', 'QUOTED', 'QUOTED_PENDING_CEO', 'DRAFT_RFQ'].includes(po.status) || po.type === 'BACKORDER_RFQ' || po.type === 'RFQ') : false;
    const prefix = isRfq ? 'RFQ' : 'PO';

    const matchFull = raw.match(/^(?:PO|RFQ|PR)-(\d{4})-(\d+)$/i);
    if (matchFull) {
      return `${prefix}-${matchFull[1]}-${matchFull[2]}`;
    }

    const matchShort = raw.match(/^(?:PO|RFQ|PR)-(\d+)$/i);
    if (matchShort) {
      return `${prefix}-2026-${String(matchShort[1]).padStart(4, '0')}`;
    }

    // Real backend PO numbers look like "PO-260831-7048" (6-digit YYMMDD date, not the
    // 4-digit year matchFull/matchShort above expect) — swap only the prefix and keep the
    // rest intact. Falling through to the coreId digit-concat fallback below would splice
    // the date and random suffix into one blob (e.g. "RFQ-2026-2608317048"), producing a
    // reference that matches no real PO/RFQ and 404/500s any API call built from it.
    const matchLegacy = raw.match(/^(?:PO|RFQ|PR)-(.+)$/i);
    if (matchLegacy) {
      return `${prefix}-${matchLegacy[1]}`;
    }

    const coreId = getPoCoreId(po);
    if (coreId && !isNaN(Number(coreId))) {
      return `${prefix}-2026-${String(coreId).padStart(4, '0')}`;
    }

    return raw || '';
  };

  // Fetch quoted purchase orders from backend & localStorage
  const fetchQuotedOrders = async () => {
    setLoadingQuoted(true);
    try {
      let apiPOs = [];
      try {
        const res = await api.get('/purchasing/orders');
        if (res && res.success && Array.isArray(res.data)) {
          apiPOs = res.data;
        }
      } catch (err) {
        console.warn('Dashboard PO fetch API fallback:', err);
      }

      let localPOs = [];
      try { localPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]'); } catch (_) { localPOs = []; }

      // Full PurchaseOrder lifecycle (must match backend's validStatuses in
      // purchase.controller.js). A status missing from this table falls back to weight 0 —
      // the same as CANCELLED — so any real stage left out here would let a stale cached
      // copy at an *earlier* stage incorrectly win the merge below and show the wrong
      // status. CANCELLED is intentionally the highest weight: it's a terminal state that
      // can happen at any stage, and once set should always win over an older cached status.
      const STATUS_WEIGHT = {
        'DRAFT_RFQ': 5,
        'RFQ': 10,
        'RFQ_SENT': 20,
        'SENT': 20,
        'AWAITING_SUPPLIER_QUOTE': 20,
        'QUOTED': 30,
        'QUOTED_PENDING_CEO': 35,
        'PO': 40,
        'APPROVED': 40,
        'CONFIRMED': 40,
        'CONFIRMED_BY_SUPPLIER': 50,
        'PENDING_QA': 55,
        'QA_PASSED': 60,
        'QA_PARTIAL': 60,
        'QA_REJECTED': 60,
        'RECEIVED': 70,
        'DONE': 100,
        'COMPLETED': 100,
        'CANCELLED': 1000
      };

      const getHighestStatus = (s1, s2) => {
        const w1 = STATUS_WEIGHT[s1] || 0;
        const w2 = STATUS_WEIGHT[s2] || 0;
        return w1 >= w2 ? s1 : s2;
      };

      // Build a unified list. Priority for status is highest progress status.
      // Use a Map keyed by BOTH coreId AND raw id to prevent duplicates.
      // `allowNew` gates whether a source may introduce a BRAND NEW order — only
      // the real API response is, once it has actually returned data. Context/
      // localStorage are cache/offline layers that may hold stale demo entries
      // with ad-hoc status values that don't correspond to any real order; they
      // can still enrich an order the API confirmed exists, but must not conjure
      // phantom rows once the API is known to be authoritative.
      const mergedMap = new Map();
      const addToMap = (item, allowNew = true) => {
        const coreKey = getPoCoreId(item);
        const rawId = String(item.id || '');
        const existingKey = mergedMap.has(coreKey) ? coreKey : (rawId && mergedMap.has(rawId) ? rawId : null);
        if (existingKey) {
          const old = mergedMap.get(existingKey);
          const finalStatus = getHighestStatus(old.status, item.status);
          const merged = {
            ...old,
            ...item,
            status: finalStatus,
            supplier: item.supplier?.name ? item.supplier : (old.supplier?.name ? old.supplier : item.supplier || old.supplier),
            supplierCode: item.supplierCode || old.supplierCode,
            items: (item.items && item.items.length > 0) ? item.items : old.items,
            totalAmount: Number(item.totalAmount) > 0 ? item.totalAmount : old.totalAmount
          };
          mergedMap.delete(existingKey);
          mergedMap.set(coreKey || rawId, merged);
        } else if (allowNew) {
          mergedMap.set(coreKey || rawId, item);
        }
      };

      const apiHasData = apiPOs.length > 0;
      // 1. API orders (base)
      apiPOs.forEach(o => addToMap(o));
      // 2. Context orders (fill gaps, or populate fully if the API returned nothing)
      (purchaseOrders || []).forEach(co => addToMap(co, !apiHasData));
      // 3. localStorage orders (enrich existing orders only, never invent new ones once API succeeded)
      localPOs.forEach(lo => addToMap(lo, !apiHasData));

      const combined = Array.from(mergedMap.values());
      const quoted = combined
        .filter(po => 
          ['QUOTED', 'QUOTED_PENDING_CEO', 'AWAITING_CEO_APPROVAL'].includes(po.status) ||
          (po.status === 'RFQ_SENT' && Number(po.totalAmount) > 0)
        )
        .map(po => {
          const supplierName = getSupplierName(po);
          return {
            ...po,
            supplier: {
              ...(typeof po.supplier === 'object' && po.supplier !== null ? po.supplier : {}),
              name: supplierName
            },
            poNumber: formatPurchaseReference(po)
          };
        });

      setQuotedOrders(quoted);
    } catch (e) {
      console.warn('Dashboard PO fetch error:', e);
      let localPOs = [];
      try { localPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]'); } catch (_) { localPOs = []; }
      const quoted = localPOs
        .filter(po => ['QUOTED', 'QUOTED_PENDING_CEO', 'AWAITING_CEO_APPROVAL'].includes(po.status) || (po.status === 'RFQ_SENT' && Number(po.totalAmount) > 0))
        .map(po => {
          const supplierName = getSupplierName(po);
          return {
            ...po,
            supplier: {
              ...(typeof po.supplier === 'object' && po.supplier !== null ? po.supplier : {}),
              name: supplierName
            },
            poNumber: formatPurchaseReference(po)
          };
        });
      setQuotedOrders(quoted);
    }
    setLoadingQuoted(false);
  };

  useEffect(() => {
    fetchQuotedOrders();
    const handlePoUpdate = () => fetchQuotedOrders();
    window.addEventListener('erp-po-updated', handlePoUpdate);
    window.addEventListener('erp-notification-sent', handlePoUpdate);
    window.addEventListener('storage', handlePoUpdate);
    return () => {
      window.removeEventListener('erp-po-updated', handlePoUpdate);
      window.removeEventListener('erp-notification-sent', handlePoUpdate);
      window.removeEventListener('storage', handlePoUpdate);
    };
    // NOTE: intentionally NOT depending on purchaseOrders to prevent
    // stale context data from overriding localStorage after approval
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Status badge colors for the Approval History table (Dashboard.jsx has no getStatusBadge
  // of its own, unlike Purchasing.jsx).
  const HISTORY_STATUS_BADGE_MAP = {
    RFQ: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
    RFQ_SENT: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    SENT: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    QUOTED: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    PO: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    CONFIRMED_BY_SUPPLIER: { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
    QA_PASSED: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
    QA_PARTIAL: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
    QA_REJECTED: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    RECEIVED: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
    DONE: { bg: '#ecfdf5', color: '#047857', border: '#6ee7b7' },
    COMPLETED: { bg: '#ecfdf5', color: '#047857', border: '#6ee7b7' },
    CANCELLED: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
  };
  const getHistoryStatusBadge = (status) => HISTORY_STATUS_BADGE_MAP[status] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };

  // Fetch every PO (any status) directly from the backend and flatten each one's
  // statusHistory into one list for the Approval History modal, attaching poNumber/supplier
  // so each row is self-contained. Always fetches fresh from the API — this is an audit
  // view, not something that should reflect optimistic/local-only state.
  const fetchApprovalHistory = async () => {
    setLoadingApprovalHistory(true);
    try {
      const res = await api.get('/purchasing/orders');
      const allPOs = (res?.success && Array.isArray(res.data)) ? res.data : [];
      const flattened = allPOs.flatMap(po =>
        (po.statusHistory || []).map(h => ({
          ...h,
          poNumber: formatPurchaseReference(po),
          supplierName: getSupplierName(po)
        }))
      );
      flattened.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setApprovalHistoryEntries(flattened);
    } catch (e) {
      console.warn('Failed to load approval history:', e);
      setApprovalHistoryEntries([]);
    }
    setLoadingApprovalHistory(false);
  };

  const filteredApprovalHistory = approvalHistoryEntries.filter(h => {
    const matchStatus = historyStatusFilter === 'ALL' || h.status === historyStatusFilter;
    const q = historySearch.trim().toLowerCase();
    const matchSearch = !q ||
      (h.poNumber || '').toLowerCase().includes(q) ||
      (h.supplierName || '').toLowerCase().includes(q) ||
      (h.changedBy || '').toLowerCase().includes(q);
    const t = h.timestamp ? new Date(h.timestamp) : null;
    const matchFrom = !historyFromDate || !t || t >= new Date(historyFromDate);
    const matchTo = !historyToDate || !t || t <= new Date(new Date(historyToDate).getTime() + 24 * 60 * 60 * 1000 - 1);
    return matchStatus && matchSearch && matchFrom && matchTo;
  });

  const handleApproveQuotedPO = async (poId, poNumber) => {
    const targetCore = getPoCoreId(poNumber || poId);
    const displayNum = formatPurchaseReference({ id: poId, poNumber, status: 'PO' });

    if (!(await confirm(`Duyệt báo giá đơn hàng ${displayNum}? Đơn hàng sẽ trở thành PO chính thức và phát hành phiếu nhận kho.`))) return;
    
    // 1. Optimistically remove from state immediately
    setQuotedOrders(prev => prev.filter(q => 
      getPoCoreId(q) !== targetCore && String(q.id) !== String(poId)
    ));

    let apiSucceeded = false;
    let apiErrorMessage = '';
    try {
      try {
        const res = await api.patch(`/purchasing/orders/${poId}/status`, { status: 'PO' });
        apiSucceeded = !!(res && res.success);
      } catch (e) {
        apiErrorMessage = e.message || 'Lỗi kết nối máy chủ';
        console.warn('API patch fallback:', e);
      }

      // 2. Update ALL matching items in localStorage (match by coreId OR raw id)
      try {
        const localPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]');
        let matched = false;
        const updatedPOs = localPOs.map(p => {
          if (getPoCoreId(p) === targetCore || String(p.id) === String(poId)) {
            matched = true;
            return {
              ...p,
              status: 'PO',
              poNumber: displayNum,
              approvedAt: new Date().toISOString(),
              approvedBy: user?.fullname || 'Ban Giám Đốc (CEO)'
            };
          }
          return p;
        });
        if (!matched) {
          const targetObj = quotedOrders.find(q => getPoCoreId(q) === targetCore || String(q.id) === String(poId)) || {};
          updatedPOs.unshift({
            ...targetObj,
            id: poId,
            poNumber: displayNum,
            status: 'PO',
            approvedAt: new Date().toISOString(),
            approvedBy: user?.fullname || 'Ban Giám Đốc (CEO)'
          });
        }
        localStorage.setItem('erp_pos', JSON.stringify(updatedPOs));
      } catch (_) {}

      // 3. Update the shared store. Always key by the real numeric poId here — the store's
      // own updatePurchaseOrderStatus fires its own /purchasing/orders/:id/status PATCH
      // (see financeStore.js), and `poNumber` may be a *display-formatted* reference
      // (formatPurchaseReference) rather than the real backend identifier, which 404/500s
      // that request.
      if (typeof updatePurchaseOrderStatus === 'function') {
        updatePurchaseOrderStatus(poId, 'PO', { approvedAt: new Date().toISOString(), poNumber: displayNum, status: 'PO' });
      }

      // 4. Send notification to Purchasing, Warehouse, QC
      if (typeof sendSystemNotification === 'function') {
        sendSystemNotification({
          targetRoles: ['PURCHASING', 'WAREHOUSE', 'QC', 'ADMIN'],
          title: `[CEO ĐÃ DUYỆT PO] ${displayNum}`,
          message: `Ban Giám Đốc đã phê duyệt báo giá đơn ${displayNum}. Phòng Mua Hàng & Kho tiếp nhận xử lý.`,
          link: '/admin/purchasing?tab=orders'
        });
      }

      // 5. Broadcast system-wide event & show the REAL outcome. Claiming success when the
      // server rejected the update is exactly what made approved POs silently reappear as
      // "pending" after the next refresh — the local optimistic write looked fine, but the
      // server (the source of truth for the API-backed refetch) still had the old status.
      window.dispatchEvent(new Event('erp-po-updated'));
      if (apiSucceeded) {
        notify(`Đã duyệt báo giá thành công. Mã đơn PO chính thức: ${displayNum}. Đơn đã chuyển sang tab Đơn Mua Hàng (PO) và sẵn sàng nhận hàng.`, 'success');
      } else {
        notify(`Chưa duyệt được trên máy chủ. Mã đơn: ${displayNum}. Lỗi: ${apiErrorMessage}. Đơn có thể hiện lại trong danh sách chờ duyệt sau khi tải lại trang do máy chủ chưa ghi nhận thay đổi. Vui lòng thử lại hoặc liên hệ quản trị viên nếu lỗi lặp lại.`, 'error');
      }
    } catch (e) {
      notify('Lỗi duyệt PO: ' + e.message, 'error');
    }
  };

  // Filtered Datasets
  const filteredOrders = useMemo(() => {
    return orders.filter(o => isDateInFilter(o.date || o.createdAt, dateFilterPeriod, customStartDate, customEndDate));
  }, [orders, dateFilterPeriod, customStartDate, customEndDate]);

  const filteredQuotedOrders = useMemo(() => {
    return quotedOrders.filter(po => isDateInFilter(po.createdAt || po.date, dateFilterPeriod, customStartDate, customEndDate));
  }, [quotedOrders, dateFilterPeriod, customStartDate, customEndDate]);

  const filteredAssemblyJobs = useMemo(() => {
    return (assemblyJobs || []).filter(j => isDateInFilter(j.createdAt || j.date, dateFilterPeriod, customStartDate, customEndDate));
  }, [assemblyJobs, dateFilterPeriod, customStartDate, customEndDate]);

  // Key Calculations
  const totalRevenueVal = filteredOrders.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const estimatedCOGS = totalRevenueVal * 0.72; // ~72% COGS
  const grossProfit = totalRevenueVal - estimatedCOGS;
  const totalInventoryAsset = inventory.reduce((sum, item) => sum + (Number(item.stock || item.stockQuantity || 0) * Number(item.price || item.unitCost || 0)), 0);
  const totalPayrollCost = payrolls.reduce((sum, p) => sum + (p.netSalary || p.totalSalary || 0), 0) || 45800000;
  const netIncome = grossProfit - totalPayrollCost - 15000000; // Subtract salary & overhead

  const lowStockCount = inventory.filter(item => Number(item.stock || item.stockQuantity || 0) <= Number(item.threshold || 5)).length;
  const readyToShipCount = filteredOrders.filter(o => o.status === 'READY_TO_SHIP').length;
  const assemblingJobsCount = filteredAssemblyJobs.filter(j => j.status === 'ASSEMBLING').length;
  const completedJobsCount = filteredAssemblyJobs.filter(j => j.status === 'COMPLETED').length;

  // Pending Approvals Count for CEO
  const pendingQuotedPOsCount = filteredQuotedOrders.length;
  const pendingPayrollApprovalCount = (payrolls && payrolls.length > 0 && payrolls[0]?.status === 'SUBMITTED_TO_CEO') ? 1 : 0;
  const pendingLeaveApprovalCount = (leaveRequests || []).filter(l => l && (l.status === 'PENDING_CEO' || l.status === 'PENDING')).length;
  const totalPendingCeoApprovals = pendingQuotedPOsCount + pendingPayrollApprovalCount + pendingLeaveApprovalCount;

  // 6 Balanced Executive KPI Cards
  const stats = [
    { label: 'Tổng Doanh Thu', value: formatPrice(totalRevenueVal), change: 'Cả trực tuyến & tại quầy', icon: <DollarSign size={20} />, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Lợi Nhuận Gộp (Est)', value: formatPrice(grossProfit), change: 'Tỷ suất lợi nhuận ~28%', icon: <TrendingUp size={20} />, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Giá Trị Tồn Kho', value: formatPrice(totalInventoryAsset), change: `${inventory.length} mã linh kiện lưu kho`, icon: <Package size={20} />, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Quỹ Lương Nhân Sự', value: formatPrice(totalPayrollCost), change: `${employees.length || 15} nhân sự toàn công ty`, icon: <Users size={20} />, color: '#0ea5e9', bg: '#f0f9ff' },
    { label: 'Cảnh Báo Tồn Kho Thấp', value: `${lowStockCount} linh kiện`, change: 'Cần duyệt thêm RFQ/PO', icon: <AlertTriangle size={20} />, color: '#d97706', bg: '#fffbeb' },
    { label: 'Chờ CEO Phê Duyệt', value: `${totalPendingCeoApprovals} nhiệm vụ`, change: 'PO, Bảng lương, Nghỉ phép', icon: <Bell size={20} />, color: '#ef4444', bg: '#fef2f2' }
  ];

  // Sales Trend Chart Data
  const salesByDate = {};
  [...filteredOrders].reverse().forEach(order => {
    const d = order.date || '19/06';
    salesByDate[d] = (salesByDate[d] || 0) + (order.totalAmount || 0);
  });
  const rawLabels = Object.keys(salesByDate);
  const rawData = Object.values(salesByDate).map(val => val / 1000000);
  const salesLabels = rawLabels.length >= 3 ? rawLabels : ['15/06', '16/06', '17/06', '18/06', '19/06'];
  const salesValues = rawData.length >= 3 ? rawData : [18.49, 8.39, 24.49, 1.39, 3.25];

  const salesChartData = {
    labels: salesLabels,
    datasets: [
      {
        label: 'Doanh thu (Triệu VNĐ)',
        data: salesValues,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.15)',
        tension: 0.35,
        fill: true
      },
      {
        label: 'Lợi nhuận gộp (Triệu VNĐ)',
        data: salesValues.map(v => Number((v * 0.28).toFixed(2))),
        borderColor: '#16a34a',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.35
      }
    ]
  };

  // Category Distribution Data
  const categoryCounts = {};
  filteredOrders.forEach(order => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const cat = item.category || 'Linh Kiện Khác';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + (item.quantity || 1);
      });
    }
  });
  const catLabels = Object.keys(categoryCounts).length > 0 ? Object.keys(categoryCounts) : ['Card Màn Hình (VGA)', 'Bộ Vi Xử Lý (CPU)', 'Bo Mạch Chủ', 'RAM & SSD', 'Khác'];
  const catValues = Object.values(categoryCounts).length > 0 ? Object.values(categoryCounts) : [8, 5, 4, 6, 2];

  const categoryChartData = {
    labels: catLabels,
    datasets: [
      {
        data: catValues,
        backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b']
      }
    ]
  };

  // Cashflow In vs Out Data
  const cashflowData = {
    labels: ['Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7 (Hiện tại)'],
    datasets: [
      {
        label: 'Dòng Tiền Thu (Inflow)',
        data: [120, 145, 138, 185, 210],
        backgroundColor: '#16a34a'
      },
      {
        label: 'Dòng Tiền Chi (Outflow)',
        data: [95, 110, 105, 140, 160],
        backgroundColor: '#ef4444'
      }
    ]
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & DATE FILTER BAR */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {activeTab === 'overview' && 'Tổng Quan Điều Hành Ban Giám Đốc (Executive Dashboard)'}
            {activeTab === 'approvals' && 'Trung Tâm Phê Duyệt Cấp Cao (CEO Approvals Hub)'}
            {activeTab === 'financials' && 'Báo Cáo Tài Chính & Lãi Lỗ (P&L & Cashflow)'}
            {activeTab === 'kpi' && 'Đánh Giá Năng Suất & KPI Nhân Sự Toàn Công Ty'}
            {activeTab === 'supplychain' && 'Giám Sát Chuỗi Cung Ứng & Sức Khỏe Kho Hàng'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            Hệ thống báo cáo chỉ số điều hành doanh nghiệp, phê duyệt chiến lược và giám sát dòng tiền thời gian thực
          </p>
        </div>

        {/* Integrated Date Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', backgroundColor: '#ffffff', padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <Calendar size={15} style={{ color: '#2563eb' }} />
          {[
            { key: 'ALL', label: 'Tất cả' },
            { key: 'TODAY', label: 'Hôm nay' },
            { key: 'THIS_WEEK', label: 'Tuần này' },
            { key: 'THIS_MONTH', label: 'Tháng này' },
            { key: 'THIS_QUARTER', label: 'Quý này' },
            { key: 'THIS_YEAR', label: 'Năm nay' }
          ].map(p => {
            const active = dateFilterPeriod === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setDateFilterPeriod(p.key)}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: active ? 800 : 600,
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: active ? '#2563eb' : 'transparent',
                  color: active ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CEO TASK CENTER BANNER (NOTIFICATION & QUICK ACTION) */}
      {/* ========================================================================= */}
      {totalPendingCeoApprovals > 0 && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Bell size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem', color: '#92400e' }}>
                  Ban Giám Đốc Có {totalPendingCeoApprovals} Nhiệm Vụ Cần Phê Duyệt
                </strong>
                <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '10px' }}>
                  Cần xử lý
                </span>
              </div>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#b45309' }}>
                Gồm: {pendingQuotedPOsCount} báo giá mua hàng PO | {pendingPayrollApprovalCount} bảng lương nhân sự | {pendingLeaveApprovalCount} đơn nghỉ phép.
              </p>
            </div>
          </div>

          <button
            onClick={() => setTab('approvals')}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>Vào Trung Tâm Phê Duyệt</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE OVERVIEW (TỔNG QUAN ĐIỀU HÀNH) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* 6 Balanced KPI Cards in 2 Rows x 3 Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
            {stats.map((st, sIdx) => (
              <div
                key={sIdx}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  padding: '1.1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '102px',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {st.label}
                  </span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: st.bg, color: st.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {st.icon}
                  </div>
                </div>

                <div style={{ marginTop: '0.45rem' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={st.value}>
                    {st.value}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                    {st.change}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            
            {/* Sales Trend Chart */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', height: '340px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <TrendingUp size={16} style={{ color: '#2563eb' }} />
                  <span>Xu Hướng Doanh Thu & Lợi Nhuận Gộp</span>
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Đơn vị: Triệu VNĐ</span>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <Line
                  data={salesChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
                    scales: {
                      y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                      x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                    }
                  }}
                />
              </div>
            </div>

            {/* Category Breakdown Chart */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', height: '340px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <PieChart size={16} style={{ color: '#8b5cf6' }} />
                <span>Cơ Cấu Doanh Số Theo Linh Kiện</span>
              </h3>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={categoryChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
                  }}
                />
              </div>
            </div>

          </div>

          {/* Quick Approvals & Recent Orders Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.25rem' }}>
            
            {/* Pending POs Preview */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Báo Giá NCC Đang Chờ Duyệt
                </h3>
                <button onClick={() => setTab('approvals')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                  Xem tất cả →
                </button>
              </div>

              {filteredQuotedOrders.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                  Không có đơn báo giá nào chờ duyệt.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {filteredQuotedOrders.slice(0, 3).map(po => (
                    <div key={po.id} style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '0.82rem', color: '#2563eb' }}>{po.poNumber || `PO-${po.id}`}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#475569', display: 'block' }}>{getSupplierName(po)}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#16a34a', display: 'block' }}>{formatPrice(po.totalAmount)}</span>
                        <button
                          onClick={() => handleApproveQuotedPO(po.id, po.poNumber || po.id)}
                          style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.2rem' }}
                        >
                          Duyệt Ngay
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Orders in Fulfillment Flow */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Đơn Hàng Trong Luồng Giao Hàng & Lắp Ráp
                </h3>
                <button onClick={() => setTab('supplychain')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                  Xem chuỗi cung ứng →
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '0.5rem 0.65rem' }}>Mã Đơn</th>
                      <th style={{ padding: '0.5rem 0.65rem' }}>Khách Hàng</th>
                      <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Tổng Tiền</th>
                      <th style={{ padding: '0.5rem 0.65rem', textAlign: 'center' }}>Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.slice(0, 4).map(o => (
                      <tr key={o.orderId || o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem 0.65rem', fontWeight: 700, color: '#2563eb' }}>
                          #{o.orderId || o.id}
                        </td>
                        <td style={{ padding: '0.5rem 0.65rem', color: '#0f172a', fontWeight: 600 }}>
                          {o.customerName || o.customer || 'Khách lẻ'}
                        </td>
                        <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          {formatPrice(o.totalAmount)}
                        </td>
                        <td style={{ padding: '0.5rem 0.65rem', textAlign: 'center' }}>
                          <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 700 }}>
                            {getStatusLabel(ORDER_STATUS, o.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CEO APPROVALS HUB (TRUNG TÂM PHÊ DUYỆT CẤP CAO) */}
      {/* ========================================================================= */}
      {activeTab === 'approvals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Section 1: Quoted POs Approval */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingBag size={18} style={{ color: '#2563eb' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  1. Phê Duyệt Báo Giá Mua Hàng Nhà Cung Cấp ({filteredQuotedOrders.length})
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Duyệt báo giá để chính thức phát hành PO và phiếu nhận hàng cho Kho
                </span>
                <button
                  onClick={() => { setShowApprovalHistory(true); fetchApprovalHistory(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    backgroundColor: '#ffffff', color: '#334155', border: '1px solid #cbd5e1',
                    borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <Clock size={14} /> Xem Lịch Sử Duyệt
                </button>
              </div>
            </div>

            {filteredQuotedOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                Hiện không có đơn báo giá mua hàng nào đang chờ duyệt.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Mã Đơn PO</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Nhà Cung Cấp</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Số Lượng Linh Kiện</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Tổng Tiền Báo Giá</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác CEO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotedOrders.map(po => {
                      const totalQty = po.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || 1;
                      return (
                        <tr key={po.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#2563eb' }}>
                            {formatPurchaseReference(po)}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0f172a' }}>
                            {getSupplierName(po)}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 600 }}>
                            {totalQty} chiếc
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                            {formatPrice(po.totalAmount)}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                              <button
                                onClick={() => setSelectedDetailPO(po)}
                                style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Xem Báo Giá
                              </button>
                              <button
                                onClick={() => handleApproveQuotedPO(po.id, po.poNumber || po.id)}
                                style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <Check size={13} /> Duyệt PO
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Payroll Approval */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={18} style={{ color: '#16a34a' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  2. Phê Duyệt Bảng Lương & Thưởng Nhân Sự Toàn Công Ty
                </h3>
              </div>
              <button
                onClick={() => setShowKPIDetailModal(true)}
                style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Xem Chi Tiết Từng Nhân Viên
              </button>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#15803d', display: 'block' }}>
                  Bảng Lương Tháng Hiện Tại ({payrolls.length || 15} Nhân Viên)
                </strong>
                <span style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.2rem', display: 'block' }}>
                  Tổng quỹ lương: <strong style={{ color: '#0f172a' }}>{formatPrice(totalPayrollCost)}</strong> (Bao gồm hoa hồng bán hàng 1% & thưởng ráp máy)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {payrolls.length > 0 && payrolls[0]?.status === 'APPROVED_BY_CEO' ? (
                  <span style={{ backgroundColor: '#ffffff', color: '#16a34a', border: '1px solid #bbf7d0', padding: '0.4rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800 }}>
                    ✓ Đã Phê Duyệt (Kế Toán Đang Chi Trả)
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      if (await confirm('Xác nhận PHÊ DUYỆT bảng lương tháng này của doanh nghiệp? Lệnh chi sẽ chuyển sang Kế Toán.')) {
                        if (typeof approvePayrollByCEO === 'function') approvePayrollByCEO();
                      }
                    }}
                    style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Check size={16} /> Phê Duyệt Ngay Bảng Lương
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Leave Requests Approval */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} style={{ color: '#8b5cf6' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  3. Phê Duyệt Đơn Xin Nghỉ Phép Của Nhân Sự ({pendingLeaveApprovalCount})
                </h3>
              </div>
            </div>

            {leaveRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                Không có đơn xin nghỉ phép nào đang chờ duyệt.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {leaveRequests.map((lr, idx) => (
                  <div key={idx} style={{ padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block' }}>
                        {lr.employeeName || lr.name || lr.employee?.fullname || (idx === 0 ? 'Nguyễn Văn Tuấn (Bộ phận Kỹ thuật)' : 'Trần Thị Mai (Bộ phận Kinh doanh)')}
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.15rem', display: 'block' }}>
                        Lý do: <strong style={{ color: '#334155' }}>{lr.reason || 'Nghỉ phép cá nhân'}</strong> | Thời gian: <strong>{lr.startDate}</strong> - <strong>{lr.endDate}</strong> ({lr.days || 1} ngày)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => {
                          if (typeof approveLeaveRequest === 'function') approveLeaveRequest(lr.id);
                          notify('Đã duyệt đơn nghỉ phép!', 'success');
                        }}
                        style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Duyệt
                      </button>
                      <button
                        onClick={() => {
                          if (typeof rejectLeaveRequest === 'function') rejectLeaveRequest(lr.id);
                          notify('Đã từ chối đơn nghỉ phép.', 'info');
                        }}
                        style={{ backgroundColor: '#ffffff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Từ Chối
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FINANCIALS (BÁO CÁO TÀI CHÍNH & LÃI LỖ P&L) */}
      {/* ========================================================================= */}
      {activeTab === 'financials' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.25rem' }}>
          
          {/* Executive P&L Statement */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={16} style={{ color: '#2563eb' }} />
              <span>Báo Cáo Lãi / Lỗ Tóm Tắt (Executive P&L)</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>(+) Tổng Doanh Thu Bán Hàng:</span>
                <strong style={{ color: '#16a34a' }}>{formatPrice(totalRevenueVal)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#ef4444' }}>(-) Giá Vốn Hàng Bán (COGS):</span>
                <strong style={{ color: '#ef4444' }}>{formatPrice(estimatedCOGS)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', backgroundColor: '#f0fdf4', borderRadius: '4px' }}>
                <span style={{ fontWeight: 800, color: '#15803d' }}>(=) Lợi Nhuận Gộp (Gross Margin ~28%):</span>
                <strong style={{ color: '#15803d', fontSize: '0.9rem' }}>{formatPrice(grossProfit)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>(-) Chi Phí Lương & Thưởng Nhân Sự:</span>
                <span style={{ color: '#64748b' }}>{formatPrice(totalPayrollCost)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>(-) Chi Phí Mặt Bằng & Vận Hành Khác:</span>
                <span style={{ color: '#64748b' }}>{formatPrice(15000000)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', marginTop: '0.5rem' }}>
                <span style={{ fontWeight: 800, color: '#1d4ed8' }}>(=) Lợi Nhuận Thuần Trước Thuế (Net Income):</span>
                <strong style={{ color: '#1d4ed8', fontSize: '1.05rem' }}>{formatPrice(netIncome > 0 ? netIncome : 42500000)}</strong>
              </div>
            </div>
          </div>

          {/* Cashflow Bar Chart & Ledger */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={16} style={{ color: '#16a34a' }} />
              <span>Dòng Tiền Thu Vào vs Chi Ra Theo Tháng</span>
            </h3>

            <div style={{ height: '240px', position: 'relative' }}>
              <Bar
                data={cashflowData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } } },
                  scales: {
                    y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                    x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                  }
                }}
              />
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: HR KPI & PERFORMANCE (NĂNG SUẤT & KPI NHÂN SỰ) */}
      {/* ========================================================================= */}
      {activeTab === 'kpi' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          
          {/* Sales Leaderboard */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Award size={16} style={{ color: '#f59e0b' }} />
                <span>Bảng Xếp Hạng Doanh Số Bán Hàng (Sales Team)</span>
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { name: 'Trần Thị B', role: 'Sales Online', revenue: totalRevenueVal, orders: filteredOrders.length, commission: totalRevenueVal * 0.01 },
                { name: 'Lê Hoàng Hùng', role: 'Sales POS Showroom', revenue: 45200000, orders: 12, commission: 452000 },
                { name: 'Nguyễn Thị Hoa', role: 'Sales Tư Vấn', revenue: 32100000, orders: 8, commission: 321000 }
              ].map((s, idx) => (
                <div key={idx} style={{ padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: idx === 0 ? '#eff6ff' : '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: idx === 0 ? '#2563eb' : '#94a3b8', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{s.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>({s.role})</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#16a34a' }}>
                      Hoa hồng: {formatPrice(s.commission)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569' }}>
                    <span>Doanh số chốt: <strong>{formatPrice(s.revenue)}</strong></span>
                    <span>Đơn hoàn tất: <strong>{s.orders} đơn</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assembly & Technician Performance */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Wrench size={16} style={{ color: '#0ea5e9' }} />
                <span>Hiệu Suất Xưởng Kỹ Thuật Lắp Ráp PC</span>
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { name: 'Phạm Văn D', role: 'Kỹ thuật viên Trưởng', completed: completedJobsCount || 8, bonus: (completedJobsCount || 8) * 150000, qaRate: '100%' },
                { name: 'Trần Văn Hoàng', role: 'Kỹ thuật viên Ráp PC', completed: 5, bonus: 750000, qaRate: '100%' }
              ].map((tech, tIdx) => (
                <div key={tIdx} style={{ padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{tech.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '0.4rem' }}>({tech.role})</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#16a34a' }}>
                      Thưởng ráp máy: {formatPrice(tech.bonus)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569' }}>
                    <span>Số máy ráp hoàn chỉnh: <strong>{tech.completed} bộ PC</strong></span>
                    <span>Tỷ lệ Pass QA: <strong style={{ color: '#16a34a' }}>{tech.qaRate}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SUPPLY CHAIN & INVENTORY (CHUỖI CUNG ỨNG & KHO) */}
      {/* ========================================================================= */}
      {activeTab === 'supplychain' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          
          {/* Low stock alerts */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={16} style={{ color: '#d97706' }} />
                <span>Cảnh Báo Tồn Kho Dưới Ngưỡng An Toàn ({lowStockCount})</span>
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {inventory.filter(it => Number(it.stock || it.stockQuantity || 0) <= Number(it.threshold || 5)).map((item, idx) => (
                <div key={idx} style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #fde68a', backgroundColor: '#fffbeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: '#92400e', display: 'block' }}>{item.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: '#b45309' }}>Phân nhóm: {item.category} | Ngưỡng an toàn: {item.threshold || 5}</span>
                  </div>
                  <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                    Tồn: {item.stock || item.stockQuantity || 0} cái
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fulfillment Pipeline */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Truck size={16} style={{ color: '#2563eb' }} />
                <span>Tiến Độ Xuất Kho & Giao Hàng Cho Khách</span>
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2563eb' }}>{filteredOrders.filter(o => o.status === 'CONFIRMED').length}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Chờ Xuất Kho</div>
              </div>
              <div style={{ backgroundColor: '#f0fdf4', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16a34a' }}>{readyToShipCount}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Chờ Shipper Lấy</div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>{filteredOrders.filter(o => o.status === 'SHIPPED').length}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Đang Vận Chuyển</div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Đơn</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Khách</th>
                    <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Tổng Tiền</th>
                    <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.slice(0, 5).map(o => (
                    <tr key={o.orderId || o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: 700, color: '#2563eb' }}>#{o.orderId || o.id}</td>
                      <td style={{ padding: '0.4rem 0.5rem', color: '#0f172a' }}>{o.customerName || o.customer || 'Khách lẻ'}</td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{formatPrice(o.totalAmount)}</td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                        <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700 }}>
                          {getStatusLabel(ORDER_STATUS, o.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ================= MODAL XEM CHI TIẾT BÁO GIÁ NCC ================= */}
      {selectedDetailPO && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ShoppingBag size={22} style={{ color: '#2563eb' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Chi Tiết Báo Giá Mua Hàng: {formatPurchaseReference(selectedDetailPO)}
                </h3>
              </div>
              <button onClick={() => setSelectedDetailPO(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.83rem' }}>
              <div>Nhà Cung Cấp: <strong style={{ color: '#0f172a' }}>{getSupplierName(selectedDetailPO)}</strong></div>
              <div style={{ marginTop: '0.25rem' }}>Tổng Giá Trị Đơn Hàng: <strong style={{ color: '#16a34a', fontSize: '1rem' }}>{formatPrice(selectedDetailPO.totalAmount)}</strong></div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', marginBottom: '1.5rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Tên Linh Kiện</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Số Lượng</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Đơn Giá</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Thành Tiền</th>
                </tr>
              </thead>
              <tbody>
                {(selectedDetailPO.items && selectedDetailPO.items.length > 0 ? selectedDetailPO.items : [{
                  name: selectedDetailPO.productName || selectedDetailPO.name || 'Linh Kiện Máy Tính',
                  quantity: selectedDetailPO.quantity || 1,
                  unitPrice: selectedDetailPO.unitPrice || selectedDetailPO.unitCost || (selectedDetailPO.totalAmount ? Math.round(selectedDetailPO.totalAmount / (selectedDetailPO.quantity || 1)) : 0)
                }]).map((it, idx) => {
                  const itName = it.productName || it.name || it.product?.name || selectedDetailPO.productName || selectedDetailPO.name || 'Linh Kiện Máy Tính';
                  const itQty = parseInt(it.quantity) || 1;
                  const itUnitPrice = Number(it.unitPrice || it.unitCost || it.price || (selectedDetailPO.totalAmount ? Math.round(selectedDetailPO.totalAmount / itQty) : 0));
                  const itTotal = Number(it.totalCost || it.totalAmount || (itQty * itUnitPrice) || selectedDetailPO.totalAmount || 0);

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#0f172a' }}>{itName}</td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 600, color: '#334155' }}>{itQty}</td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#334155' }}>{formatPrice(itUnitPrice)}</td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{formatPrice(itTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Lịch Sử Duyệt (Approval History) — from PurchaseOrderStatusHistory, recorded
                server-side on every real status transition (purchase.controller.js) */}
            {Array.isArray(selectedDetailPO.statusHistory) && selectedDetailPO.statusHistory.length > 0 && (
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>Lịch Sử Duyệt</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {selectedDetailPO.statusHistory.map((h, idx) => (
                    <div key={h.id || idx} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.78rem' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#2563eb', marginTop: '0.4rem', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div>
                          <strong style={{ color: '#0f172a' }}>{getStatusLabel(PO_STATUS, h.status)}</strong>
                          <span style={{ color: '#94a3b8' }}> — {h.changedBy || 'Hệ thống'}{h.changedByRole ? ` (${h.changedByRole})` : ''}</span>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                          {h.timestamp ? new Date(h.timestamp).toLocaleString('vi-VN') : ''}
                        </div>
                        {h.note && <div style={{ color: '#64748b', fontStyle: 'italic', marginTop: '0.1rem' }}>"{h.note}"</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <button
                onClick={() => setSelectedDetailPO(null)}
                style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  handleApproveQuotedPO(selectedDetailPO.id, selectedDetailPO.poNumber || selectedDetailPO.id);
                  setSelectedDetailPO(null);
                }}
                style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Check size={16} /> Phê Duyệt PO Này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL LỊCH SỬ DUYỆT (TẤT CẢ ĐƠN) ================= */}
      {showApprovalHistory && (() => {
        const uniqueHistoryStatuses = [...new Set(approvalHistoryEntries.map(h => h.status).filter(Boolean))];
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
            <div style={{ width: '100%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Clock size={20} style={{ color: '#2563eb' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Lịch Sử Duyệt Toàn Bộ Đơn Mua Hàng
                    </h3>
                  </div>
                  <button onClick={() => setShowApprovalHistory(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                    <X size={18} />
                  </button>
                </div>

                {/* Bộ lọc */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    placeholder="Tìm theo mã đơn, NCC, người thực hiện..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    style={{ flex: '1 1 220px', padding: '0.5rem 0.75rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    {uniqueHistoryStatuses.map(s => <option key={s} value={s}>{getStatusLabel(PO_STATUS, s)}</option>)}
                  </select>
                  <input
                    type="date"
                    value={historyFromDate}
                    onChange={(e) => setHistoryFromDate(e.target.value)}
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <span style={{ alignSelf: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>đến</span>
                  <input
                    type="date"
                    value={historyToDate}
                    onChange={(e) => setHistoryToDate(e.target.value)}
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  {(historySearch || historyStatusFilter !== 'ALL' || historyFromDate || historyToDate) && (
                    <button
                      onClick={() => { setHistorySearch(''); setHistoryStatusFilter('ALL'); setHistoryFromDate(''); setHistoryToDate(''); }}
                      style={{ padding: '0.5rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Xóa Bộ Lọc
                    </button>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem' }}>
                {loadingApprovalHistory ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.85rem' }}>Đang tải lịch sử...</div>
                ) : filteredApprovalHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    {approvalHistoryEntries.length === 0 ? 'Chưa có lịch sử duyệt nào được ghi nhận.' : 'Không có kết quả phù hợp với bộ lọc.'}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>Thời Gian</th>
                        <th style={{ padding: '0.65rem 0.75rem' }}>Mã Đơn</th>
                        <th style={{ padding: '0.65rem 0.75rem' }}>Nhà Cung Cấp</th>
                        <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Trạng Thái</th>
                        <th style={{ padding: '0.65rem 0.75rem' }}>Người Thực Hiện</th>
                        <th style={{ padding: '0.65rem 0.75rem' }}>Ghi Chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApprovalHistory.map((h, idx) => (
                        <tr key={h.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', color: '#64748b' }}>
                            {h.timestamp ? new Date(h.timestamp).toLocaleString('vi-VN') : ''}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>
                            {h.poNumber}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#334155' }}>
                            {h.supplierName}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '1px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800,
                              backgroundColor: getHistoryStatusBadge(h.status).bg, color: getHistoryStatusBadge(h.status).color, border: `1px solid ${getHistoryStatusBadge(h.status).border}`
                            }}>
                              {getStatusLabel(PO_STATUS, h.status)}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#334155' }}>
                            {h.changedBy || 'Hệ thống'}
                            {h.changedByRole && <span style={{ color: '#94a3b8' }}> ({h.changedByRole})</span>}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontStyle: h.note ? 'italic' : 'normal' }}>
                            {h.note || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Hiển thị {filteredApprovalHistory.length} / {approvalHistoryEntries.length} lượt thay đổi
                </span>
                <button
                  onClick={() => setShowApprovalHistory(false)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= MODAL XEM CHI TIẾT BẢNG LƯƠNG NHÂN SỰ ================= */}
      {showKPIDetailModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <DollarSign size={22} style={{ color: '#16a34a' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Bảng Lương & Thưởng Hoa Hồng Nhân Sự Toàn Doanh Nghiệp
                </h3>
              </div>
              <button onClick={() => setShowKPIDetailModal(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '0.5rem' }}>Mã NV</th>
                    <th style={{ padding: '0.5rem' }}>Họ & Tên</th>
                    <th style={{ padding: '0.5rem' }}>Chức Vụ / Phòng Ban</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Lương Cơ Bản</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Thưởng KPI / Hoa Hồng</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Thực Nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {(payrolls.length > 0 ? payrolls : [
                    { empId: 1, name: 'Trần Thị B', role: 'Nhân Viên Bán Hàng', base: 8500000, bonus: 1850000, netSalary: 10350000 },
                    { empId: 2, name: 'Phạm Văn D', role: 'Kỹ Thuật Lắp Ráp', base: 9000000, bonus: 1200000, netSalary: 10200000 },
                    { empId: 3, name: 'Lê Văn C', role: 'Quản Lý Kho', base: 9500000, bonus: 500000, netSalary: 10000000 }
                  ]).map((p, pIdx) => (
                    <tr key={pIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 700, color: '#2563eb' }}>NV-{p.empId || pIdx + 1}</td>
                      <td style={{ padding: '0.5rem', fontWeight: 600, color: '#0f172a' }}>{p.employeeName || p.name}</td>
                      <td style={{ padding: '0.5rem', color: '#64748b' }}>{p.role || 'Nhân viên'}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatPrice(p.baseSalary || p.base || 8500000)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>+{formatPrice(p.bonus || p.commission || 1000000)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{formatPrice(p.netSalary || 9500000)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <button
                onClick={() => setShowKPIDetailModal(false)}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Order */}
      {selectedDetailOrder && (
        <OrderDetailModal
          order={selectedDetailOrder}
          onClose={() => setSelectedDetailOrder(null)}
        />
      )}

    </div>
  );
}
