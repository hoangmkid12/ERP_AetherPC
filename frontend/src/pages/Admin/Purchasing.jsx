import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { useInventoryStore, useSalesStore, useFinanceStore } from '../../stores';
import { notify, promptText } from '../../context/NotificationContext';
import { PO_STATUS, getStatusInfo, getStatusLabel } from '../../utils/statusLabels';
import { api } from '../../services/api';
import ActorNotificationBar from '../../components/ActorNotificationBar';
import { 
  Package, Search, Plus, DollarSign, Eye, 
  Trash2, Calendar, ShoppingBag, Check, X, Send, 
  AlertCircle, RefreshCw, User, ShoppingCart, ArrowRight, Truck, FileText, CreditCard, Bell,
  BarChart2, Award, Zap, TrendingDown, Star, Phone, Mail, MapPin, Building, CheckCircle2, Clock,
  ChevronLeft, ChevronRight
} from 'lucide-react';

const CAT_ALIASES = {
  CPU: ['CPU', 'VI XỬ LÝ', 'CHIP', 'BỘ VI XỬ LÝ'],
  VGA: ['VGA', 'CARD MÀN HÌNH', 'GPU', 'CARD ĐỒ HỌA'],
  MAINBOARD: ['MAINBOARD', 'BO MẠCH CHỦ', 'MAIN', 'MOTHERBOARD'],
  RAM: ['RAM', 'BỘ NHỚ TRONG', 'BỘ NHỚ RAM', 'MEMORY'],
  STORAGE: ['STORAGE', 'Ổ CỨNG', 'SSD', 'HDD'],
  PSU: ['PSU', 'NGUỒN MÁY TÍNH', 'NGUỒN', 'POWER SUPPLY'],
  CASE: ['CASE', 'VỎ MÁY TÍNH', 'VỎ CASE'],
  COOLER: ['COOLER', 'TẢN NHIỆT', 'QUẠT TẢN NHIỆT', 'FAN'],
  MONITOR: ['MONITOR', 'MÀN HÌNH'],
  KEYBOARD: ['KEYBOARD', 'BÀN PHÍM'],
  MOUSE: ['MOUSE', 'CHUỘT']
};

const getCategoryUpper = (p) => {
  if (!p) return '';
  let cat = '';
  if (typeof p.category === 'string') cat = p.category;
  else if (p.category && typeof p.category.name === 'string') cat = p.category.name;
  else if (p.category && typeof p.category.slug === 'string') cat = p.category.slug;
  else if (typeof p.categorySlug === 'string') cat = p.categorySlug;
  return cat.trim().toUpperCase();
};

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

const isDateInRange = (dateVal, startDate, endDate) => {
  if (!startDate && !endDate) return true;
  const d = parseDateVal(dateVal);
  if (!d) return true;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const itemYMD = `${yyyy}-${mm}-${dd}`;

  if (startDate && itemYMD < startDate) return false;
  if (endDate && itemYMD > endDate) return false;
  return true;
};

export default function Purchasing() {
  const location = useLocation();
  const rawTab = new URLSearchParams(location.search).get('tab') || 'overview';
  const activeTab = rawTab === 'catalog' ? 'products' : rawTab;
  
  const { user, isPurchasing, isCEO, isAccountant, isWarehouse, isWarehouseManager, isAdmin } = useAuth();
  const { can, canDo, canApprove, canCreate } = usePermission();
  const isCeoApprover = canDo('purchasing_approve_po') || canApprove('purchasing') || isCEO || isAdmin;
  const erpInventory = useInventoryStore(state => state.inventory) || [];
  const erpProducts = useInventoryStore(state => state.products) || [];
  const erpOrders = useSalesStore(state => state.orders) || [];
  const erpPurchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];
  const erpContext = useMemo(() => ({
    inventory: erpInventory,
    products: erpProducts,
    orders: erpOrders,
    purchaseOrders: erpPurchaseOrders
  }), [erpInventory, erpProducts, erpOrders, erpPurchaseOrders]);
  
  // Data State
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Loading & Action State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Filters for RFQ / Orders
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [poStartDate, setPoStartDate] = useState('');
  const [poEndDate, setPoEndDate] = useState('');
  
  // Supplier tab search
  const [supplierSearch, setSupplierSearch] = useState('');

  // Product tab filters
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('ALL');
  const [productSupplierFilter, setProductSupplierFilter] = useState('ALL');
  const [productStockStatusFilter, setProductStockStatusFilter] = useState('ALL');
  const [productPage, setProductPage] = useState(1);
  const ITEMS_PER_PAGE = 25;
  
  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null); // for viewing details
  const [viewMode, setViewMode] = useState('PO'); // 'PO', 'RECEIPT', 'BILL'
  const [selectedGroupKey, setSelectedGroupKey] = useState(null); // key of the rfq-group to compare

  // Build groups of RFQs that share the same set of product IDs (same batch from multi-supplier RFQ)
  const rfqGroups = (() => {
    const comparableOrders = orders.filter(po => ['RFQ', 'RFQ_SENT', 'QUOTED'].includes(po.status));
    const groups = {};
    for (const po of comparableOrders) {
      const productIds = (po.items || [])
        .map(it => String(it.productId || it.product?.id || ''))
        .filter(Boolean)
        .sort()
        .join(',');
      if (!productIds) continue;
      if (!groups[productIds]) groups[productIds] = [];
      groups[productIds].push(po);
    }
    return Object.entries(groups)
      .filter(([, list]) => list.length >= 2)
      .map(([key, list]) => ({ key, list }));
  })();

  // Create PO Form State
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedSuppliersList, setSelectedSuppliersList] = useState(['', '']);
  const [isMultiSupplierRFQ, setIsMultiSupplierRFQ] = useState(false);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [poItems, setPoItems] = useState([]);
  
  // Add item form state
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState('');
  const searchComboboxRef = useRef(null);
  const lastHandledRfqKeyRef = useRef(null);

  // Synchronize effective products list from ERPContext (1580 DB items)
  const effectiveCatalog = useMemo(() => {
    const fromCtx = erpContext.inventory || erpContext.products;
    if (Array.isArray(fromCtx) && fromCtx.length > 0) {
      return fromCtx.filter(p => p.status !== 'DISCONTINUED');
    }
    return products.filter(p => p.status !== 'DISCONTINUED');
  }, [erpContext.inventory, erpContext.products, products]);

  // Backorders Detection from Sales Orders (AWAITING_STOCK)
  const backorderSalesOrders = useMemo(() => {
    return (erpContext.orders || []).filter(o => o && o.status === 'AWAITING_STOCK');
  }, [erpContext.orders]);

  const backorderRequiredItems = useMemo(() => {
    const map = {};
    backorderSalesOrders.forEach(o => {
      (o.items || []).forEach(it => {
        const pId = String(it.productId || it.id || '');
        if (!pId) return;
        if (!map[pId]) {
          map[pId] = {
            productId: pId,
            name: it.name || it.productName || 'Linh kiện',
            neededQty: 0,
            ordersCount: 0,
            orderIds: []
          };
        }
        map[pId].neededQty += (Number(it.quantity) || 1);
        map[pId].ordersCount += 1;
        map[pId].orderIds.push(o.orderId || o.id);
      });
    });
    return Object.values(map);
  }, [backorderSalesOrders]);

  const handleCreateRfqForBackorder = (backorderItem) => {
    const product = effectiveCatalog.find(p => String(p.id) === String(backorderItem.productId));
    const supp = product?.supplier || 'Intel Vietnam';
    const suppObj = suppliers.find(s => s.name === supp || s.code === supp);
    
    setSelectedSupplier(suppObj ? suppObj.code : (suppliers[0]?.code || 's1'));
    setSelectedSuppliersList([suppObj ? suppObj.code : (suppliers[0]?.code || 's1'), '']);
    setIsMultiSupplierRFQ(false);
    setExpectedDeliveryDate(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
    
    const estCost = product?.price ? Math.round(Number(product.price) * 0.8) : 1500000;
    setPoItems([{
      productId: String(backorderItem.productId),
      productName: backorderItem.name,
      quantity: Math.max(Number(backorderItem.neededQty) * 2, 5),
      unitCost: estCost
    }]);

    setShowCreateModal(true);
  };

  const handleOpenCreateModal = () => {
    setSelectedSupplier('');
    setSelectedSuppliersList(['', '']);
    setIsMultiSupplierRFQ(false);
    setExpectedDeliveryDate('');
    setPoItems([]);
    try { window.history.replaceState({}, document.title); } catch (_) {}
    setShowCreateModal(true);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchComboboxRef.current && !searchComboboxRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProductsForModal = effectiveCatalog.filter(p => {
    if (!productSearchQuery.trim()) return true;
    const q = productSearchQuery.toLowerCase();
    return (p.name && p.name.toLowerCase().includes(q)) || 
           (p.sku && p.sku.toLowerCase().includes(q)) || 
           (p.category && String(p.category).toLowerCase().includes(q));
  });

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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, suppliersRes, productsRes] = await Promise.all([
        api.get('/purchasing/orders'),
        api.get('/purchasing/suppliers'),
        api.get('/purchasing/products')
      ]);

      let apiOrders = (ordersRes?.success && Array.isArray(ordersRes.data)) ? ordersRes.data : [];
      let localOrders = [];
      try { localOrders = JSON.parse(localStorage.getItem('erp_pos') || '[]'); } catch (_) { localOrders = []; }

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

      // Structured Merge via Dual Key Matching: API -> Context -> LocalStorage Overrides.
      // `allowNew` gates whether a source is trusted to introduce a BRAND NEW order —
      // only the real API response is, once it has actually returned data. Context/
      // localStorage are cache/offline layers that may contain stale demo entries with
      // ad-hoc status values (e.g. leftover "PENDING"/"PAID" that were never real
      // PurchaseOrder.status values) that don't correspond to any order the backend
      // actually has; letting them create phantom rows was the bug here. They can still
      // ENRICH an order the API already confirmed exists (existingKey match below), and
      // still populate the whole list when the API genuinely returned nothing.
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

      const apiHasData = apiOrders.length > 0;
      apiOrders.forEach(o => addToMap(o));
      (erpContext.purchaseOrders || []).forEach(co => addToMap(co, !apiHasData));
      localOrders.forEach(lo => addToMap(lo, !apiHasData));

      const mergedOrders = Array.from(mergedMap.values());
      const formattedOrders = mergedOrders.map(o => ({
        ...o,
        poNumber: formatPurchaseReference(o)
      }));
      setOrders(formattedOrders);

      let finalSuppliers = [];
      if (suppliersRes?.success && Array.isArray(suppliersRes.data) && suppliersRes.data.length > 0) {
        finalSuppliers = suppliersRes.data;
      } else {
        finalSuppliers = [
          { code: 's1', name: 'Samsung Vina Electronics', phone: '028 3821 1111', email: 'b2b.vn@samsung.com', address: 'Quận 1, TP.HCM', rating: 4.9 },
          { code: 's2', name: 'Mai Hoàng Distribution', phone: '024 3537 7109', email: 'sales@maihoang.com.vn', address: 'Đống Đa, Hà Nội', rating: 4.8 },
          { code: 's3', name: 'Intel Vietnam', phone: '028 3825 2000', email: 'support.vietnam@intel.com', address: 'Quận 9, TP.HCM', rating: 5.0 },
          { code: 's4', name: 'ASUS Vietnam Distribution', phone: '028 3930 4667', email: 'sales@asus.vn', address: 'Quận 3, TP.HCM', rating: 4.7 },
          { code: 's5', name: 'MSI Vietnam Official', phone: '028 7300 0911', email: 'vninfo@msi.com', address: 'Quận 10, TP.HCM', rating: 4.8 }
        ];
      }
      setSuppliers(finalSuppliers);

      let finalProducts = [];
      if (productsRes?.success && Array.isArray(productsRes.data) && productsRes.data.length > 0) {
        finalProducts = productsRes.data;
      } else {
        finalProducts = erpContext.inventory || erpContext.products || [];
      }
      setProducts(finalProducts);
    } catch (err) {
      console.warn('API error:', err.message);
      let fallbackOrders = [];
      try { fallbackOrders = JSON.parse(localStorage.getItem('erp_pos') || '[]'); } catch (_) {}
      if (!fallbackOrders || fallbackOrders.length === 0) {
        fallbackOrders = erpContext.purchaseOrders || [];
      }
      const formattedFallback = fallbackOrders.map(o => ({
        ...o,
        poNumber: formatPurchaseReference(o)
      }));
      setOrders(formattedFallback);
      if (formattedFallback.length === 0) {
        setError('Lỗi kết nối tới server.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handlePoUpdate = () => fetchData();
    window.addEventListener('erp-po-updated', handlePoUpdate);
    window.addEventListener('erp-notification-sent', handlePoUpdate);
    window.addEventListener('storage', handlePoUpdate);
    return () => {
      window.removeEventListener('erp-po-updated', handlePoUpdate);
      window.removeEventListener('erp-notification-sent', handlePoUpdate);
      window.removeEventListener('storage', handlePoUpdate);
    };
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Chưa rõ';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('vi-VN');
  };

  const handleOpenRFQForProduct = (prod, customQty) => {
    setShowCreateModal(true);
    if (prod) {
      const prodId = String(prod.productId || prod.id || '');
      setProductSearchQuery(prod.name || '');
      setSelectedProduct(prodId || '');

      const parsedCustomQty = Number(customQty || prod.requestedQty || prod.quantity || prod.alertQty);
      const currentStock = Number(prod.stock !== undefined ? prod.stock : (prod.stockQuantity !== undefined ? prod.stockQuantity : 0));
      const recQty = (parsedCustomQty && !isNaN(parsedCustomQty) && parsedCustomQty > 0)
        ? parsedCustomQty
        : Math.max((prod.threshold || 5) * 2 - currentStock, 5);
      
      setQuantity(recQty);
      setUnitCost('');
      
      setPoItems([{
        productId: prodId,
        name: prod.name,
        productName: prod.name,
        quantity: recQty,
        unitCost: 0,
        totalCost: 0
      }]);

      if (prod.supplier && suppliers.length > 0) {
        const matchedSup = suppliers.find(s => s.name?.toLowerCase().includes(prod.supplier.toLowerCase()));
        if (matchedSup) setSelectedSupplier(matchedSup.code);
      }
    }
  };

  useEffect(() => {
    if (selectedProduct) {
      setUnitCost('');
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (location.state?.openCreateRFQ) {
      handleOpenCreateModal();
      try { window.history.replaceState({}, document.title); } catch (_) {}
    } else if (location.state?.createRFQ && location.state?.product) {
      const rfqKey = location.state.timestamp || `${location.state.product.productId || location.state.product.id}_${location.key}`;
      if (lastHandledRfqKeyRef.current !== rfqKey) {
        lastHandledRfqKeyRef.current = rfqKey;
        const targetQty = location.state.quantity || location.state.product?.requestedQty;
        handleOpenRFQForProduct(location.state.product, targetQty);
        try { window.history.replaceState({}, document.title); } catch (_) {}
      }
    } else if (location.state?.filterLowStock) {
      setProductStockStatusFilter('LOW_STOCK');
      try { window.history.replaceState({}, document.title); } catch (_) {}
    }
  }, [location.state, location.key]);

  useEffect(() => {
    const handlePrefillRFQEvent = (e) => {
      const prod = e.detail?.product || e.detail?.itemData || e.detail;
      const targetQty = e.detail?.quantity || e.detail?.requestedQty || prod?.requestedQty || prod?.quantity;
      if (prod) {
        handleOpenRFQForProduct(prod, targetQty);
        try { window.history.replaceState({}, document.title); } catch (_) {}
      }
    };

    window.addEventListener('open-rfq-prefill-modal', handlePrefillRFQEvent);
    return () => {
      window.removeEventListener('open-rfq-prefill-modal', handlePrefillRFQEvent);
    };
  }, []);

  const handleAddItem = () => {
    if (!selectedProduct) return;
    const prod = effectiveCatalog.find(p => String(p.productId || p.id) === String(selectedProduct));
    if (!prod) return;
    if (poItems.some(item => String(item.productId) === String(selectedProduct))) {
      notify('Sản phẩm này đã được thêm vào danh sách.', 'error');
      return;
    }
    const qty = parseInt(quantity, 10) || 1;
    const cost = 0;
    
    setPoItems([...poItems, {
      productId: String(prod.productId || prod.id || ''),
      name: prod.name,
      productName: prod.name,
      sku: prod.sku,
      quantity: qty,
      unitCost: cost,
      totalCost: cost * qty
    }]);

    setSelectedProduct('');
    setProductSearchQuery('');
    setShowSuggestions(false);
    setQuantity(1);
    setUnitCost('');
  };

  const handleRemoveItem = (index) => {
    const updated = [...poItems];
    updated.splice(index, 1);
    setPoItems(updated);
  };

  const handleCreatePO = async (e) => {
    e.preventDefault();
    if (isMultiSupplierRFQ) {
      const validSuppliers = selectedSuppliersList.filter(Boolean);
      if (validSuppliers.length < 2) {
        notify('Vui lòng chọn ít nhất 2 Nhà Cung Cấp để gửi Yêu Cầu Báo Giá đồng thời.', 'error');
        return;
      }
    } else {
      if (!selectedSupplier) {
        notify('Vui lòng chọn Nhà Cung Cấp.', 'error');
        return;
      }
    }

    if (poItems.length === 0) {
      notify('Vui lòng thêm ít nhất một sản phẩm vào đơn.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (isMultiSupplierRFQ) {
        const validSuppliers = selectedSuppliersList.filter(Boolean);
        const createdPOs = [];
        for (const supCode of validSuppliers) {
          const supplierObj = suppliers.find(s => s.code === supCode);
          const payload = {
            supplierCode: supCode,
            supplier: supplierObj ? { code: supplierObj.code, name: supplierObj.name } : { code: supCode, name: supCode },
            expectedDeliveryDate: expectedDeliveryDate || null,
            items: poItems.map(item => ({
              productId: String(item.productId),
              productName: item.productName || item.name,
              quantity: parseInt(item.quantity, 10),
              unitCost: parseFloat(item.unitCost || 0)
            })),
            isMultiRfqGroup: true
          };

          try {
            const res = await api.post('/purchasing/orders', payload);
            if (res?.data) createdPOs.push(res.data);
          } catch (apiErr) {
            console.warn('API error, falling back to local PO creation', apiErr);
            const fallbackPO = {
              id: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              poNumber: `RFQ-${new Date().getFullYear()}-${String(orders.length + createdPOs.length + 1).padStart(4, '0')}`,
              supplierCode: supCode,
              supplier: supplierObj || { code: supCode, name: supCode },
              createdBy: user?.fullname || user?.username || 'purchasing@kltn-erp.vn',
              expectedDeliveryDate,
              totalAmount: 0,
              status: 'RFQ',
              items: payload.items,
              createdAt: new Date().toISOString()
            };
            createdPOs.push(fallbackPO);
          }
        }

        if (createdPOs.length > 0) {
          const updated = [...createdPOs, ...orders];
          setOrders(updated);
          try { localStorage.setItem('erp_pos', JSON.stringify(updated)); } catch (_) {}
          setShowCreateModal(false);
          notify(`Đã khởi tạo thành công ${createdPOs.length} Yêu Cầu Báo Giá (RFQ) gửi tới các Nhà Cung Cấp!`, 'success');
        }
      } else {
        const supplierObj = suppliers.find(s => s.code === selectedSupplier);
        const payload = {
          supplierCode: selectedSupplier,
          supplier: supplierObj ? { code: supplierObj.code, name: supplierObj.name } : { code: selectedSupplier, name: selectedSupplier },
          expectedDeliveryDate: expectedDeliveryDate || null,
          items: poItems.map(item => ({
            productId: String(item.productId),
            productName: item.productName || item.name,
            quantity: parseInt(item.quantity, 10),
            unitCost: parseFloat(item.unitCost || 0)
          }))
        };

        try {
          const res = await api.post('/purchasing/orders', payload);
          if (res?.success) {
            await fetchData();
            setShowCreateModal(false);
            notify('Tạo Yêu Cầu Báo Giá (RFQ) thành công!', 'success');
          }
        } catch (apiErr) {
          console.warn('Fallback local creation:', apiErr);
          const fallbackPO = {
            id: `PO-${Date.now()}`,
            poNumber: `RFQ-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, '0')}`,
            supplierCode: selectedSupplier,
            supplier: supplierObj || { code: selectedSupplier, name: selectedSupplier },
            createdBy: user?.fullname || user?.username || 'purchasing@kltn-erp.vn',
            expectedDeliveryDate,
            totalAmount: 0,
            status: 'RFQ',
            items: payload.items,
            createdAt: new Date().toISOString()
          };
          const updated = [fallbackPO, ...orders];
          setOrders(updated);
          try { localStorage.setItem('erp_pos', JSON.stringify(updated)); } catch (_) {}
          setShowCreateModal(false);
          notify('Tạo Yêu Cầu Báo Giá (RFQ) thành công!', 'success');
        }
      }
    } catch (err) {
      notify('Lỗi tạo đơn: ' + err.message, 'error');
    }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (poId, newStatus) => {
    setSubmitting(true);
    let apiSucceeded = false;
    let apiErrorMessage = '';
    try {
      try {
        const res = await api.patch(`/purchasing/orders/${poId}/status`, { status: newStatus });
        apiSucceeded = !!(res && res.success);
      } catch (err) {
        apiErrorMessage = err.message || 'Lỗi kết nối máy chủ';
        console.warn('API status patch fallback:', err);
      }

      // Update in localStorage
      try {
        const localPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]');
        let matched = false;
        const updatedPOs = localPOs.map(p => {
          if (String(p.id) === String(poId) || p.poNumber === poId || String(p.poNumber) === String(poId)) {
            matched = true;
            return {
              ...p,
              status: newStatus,
              approvedAt: new Date().toISOString()
            };
          }
          return p;
        });
        if (!matched) {
          const targetObj = orders.find(o => String(o.id) === String(poId) || o.poNumber === poId) || {};
          updatedPOs.unshift({
            ...targetObj,
            id: poId,
            status: newStatus,
            approvedAt: new Date().toISOString()
          });
        }
        localStorage.setItem('erp_pos', JSON.stringify(updatedPOs));
      } catch (_) {}

      window.dispatchEvent(new Event('erp-po-updated'));
      if (apiSucceeded) {
        notify(`Đơn hàng đã được chuyển trạng thái sang: ${getStatusText(newStatus)}`, 'success');
      } else {
        notify(`Máy chủ chưa ghi nhận được thay đổi trạng thái này (${apiErrorMessage}). Đơn hàng có thể hiện lại trạng thái cũ sau khi tải lại trang — vui lòng thử lại.`, 'error');
      }
      await fetchData();
      setSelectedPO(null);
    } catch (err) {
      notify('Lỗi: ' + err.message, 'error');
    }
    setSubmitting(false);
  };

  const getStatusBadge = (status) => {
    const info = getStatusInfo(PO_STATUS, status);
    return { bg: info.bg, color: info.color, border: info.border, text: info.label };
  };

  const getStatusText = (status) => {
    return getStatusLabel(PO_STATUS, status);
  };

  // Filtered orders list based on active tab & filters
  const filteredOrders = orders
    .filter(po => {
      const isRfqStage = ['RFQ', 'RFQ_SENT', 'QUOTED', 'QUOTED_PENDING_CEO', 'DRAFT_RFQ'].includes(po.status);
      if (activeTab === 'rfq' && !isRfqStage) return false;
      if (activeTab === 'orders' && isRfqStage) return false;

      const matchesSearch = (po.poNumber || po.id || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) || 
        (po.supplier?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (po.supplierCode || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
      const matchesSup = supplierFilter === 'ALL' || (po.supplier?.name === supplierFilter) || (po.supplierCode === supplierFilter);
      const matchesDate = isDateInRange(po.createdAt || po.date || po.issueDate, poStartDate, poEndDate);
      return matchesSearch && matchesStatus && matchesSup && matchesDate;
    })
    .sort((a, b) => {
      const dA = new Date(a.createdAt || a.date || a.issueDate || 0);
      const dB = new Date(b.createdAt || b.date || b.issueDate || 0);
      if (dB.getTime() !== dA.getTime()) return dB.getTime() - dA.getTime();
      return String(b.poNumber || b.id || '').localeCompare(String(a.poNumber || a.id || ''), 'vi', { numeric: true });
    });

  // Dynamic suppliers available for current selected category in products tab
  const categoryMatchedCatalog = effectiveCatalog.filter(item => {
    if (productCategoryFilter === 'ALL') return true;
    const itemCatUpper = getCategoryUpper(item);
    const aliases = CAT_ALIASES[productCategoryFilter] || [productCategoryFilter];
    return aliases.some(a => itemCatUpper === a || itemCatUpper.includes(a));
  });
  const availableProductSuppliers = [...new Set(categoryMatchedCatalog.map(i => i.supplier).filter(Boolean))].sort();

  // Filtered products for Tab 'products'
  const filteredProductsList = effectiveCatalog.filter(p => {
    const matchSearch = !productSearch.trim() || 
      (p.name && p.name.toLowerCase().includes(productSearch.toLowerCase())) || 
      (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
      (p.supplier && p.supplier.toLowerCase().includes(productSearch.toLowerCase()));

    const itemCatUpper = getCategoryUpper(p);
    const matchCat = productCategoryFilter === 'ALL' || (() => {
      const aliases = CAT_ALIASES[productCategoryFilter] || [productCategoryFilter];
      return aliases.some(a => itemCatUpper === a || itemCatUpper.includes(a));
    })();

    const matchSup = productSupplierFilter === 'ALL' || p.supplier === productSupplierFilter;

    const stockQty = Number(p.stock !== undefined ? p.stock : (p.stockQuantity !== undefined ? p.stockQuantity : 0));
    const threshold = Number(p.threshold || 5);
    let matchStock = true;
    if (productStockStatusFilter === 'IN_STOCK') matchStock = stockQty > 0;
    if (productStockStatusFilter === 'LOW_STOCK') matchStock = stockQty > 0 && stockQty <= threshold;
    if (productStockStatusFilter === 'OUT_OF_STOCK') matchStock = stockQty === 0;

    return matchSearch && matchCat && matchSup && matchStock;
  });

  const totalProductPages = Math.ceil(filteredProductsList.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = filteredProductsList.slice((productPage - 1) * ITEMS_PER_PAGE, productPage * ITEMS_PER_PAGE);

  // Reset page to 1 when filters change
  useEffect(() => {
    setProductPage(1);
  }, [productSearch, productCategoryFilter, productSupplierFilter, productStockStatusFilter]);

  // KPI Calculations
  const rfqDraftCount = orders.filter(po => po.status === 'RFQ').length;
  const rfqSentCount = orders.filter(po => po.status === 'RFQ_SENT').length;
  const rfqQuotedCount = orders.filter(po => po.status === 'QUOTED').length;
  const poConfirmedCount = orders.filter(po => ['PO', 'SENT', 'RECEIVED', 'DONE'].includes(po.status)).length;
  const pendingReceiptCount = orders.filter(po => po.status === 'PO' || po.status === 'SENT').length;
  const totalSpent = orders
    .filter(po => ['PO', 'SENT', 'RECEIVED', 'DONE'].includes(po.status))
    .reduce((sum, po) => sum + parseFloat(po.totalAmount || 0), 0);

  const availableSupplierOptions = [...new Set(orders.map(o => o.supplier?.name || o.supplierCode).filter(Boolean))].sort();

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN MUA HÀNG) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Tổng Quan Phân Hệ Mua Hàng
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Theo dõi hiệu quả mua sắm, các chỉ số giao hàng và đơn hàng cần xử lý theo chuẩn Odoo
            </p>
          </div>

          {/* 1. Top Mission Task Center Banner */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginBottom: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb'
              }}>
                <ShoppingCart size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Trung Tâm Nhiệm Vụ Mua Hàng
                  </h3>
                  {rfqQuotedCount > 0 && (
                    <span style={{
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {rfqQuotedCount} Báo Giá Cần Duyệt
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Chuỗi cung ứng: {rfqDraftCount + rfqSentCount} RFQ đang chào giá | {poConfirmedCount} Đơn PO đã xác nhận | {pendingReceiptCount} đơn chờ nhập kho.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setSelectedGroupKey(rfqGroups[0]?.key || null); setShowCompareModal(true); }}
                style={{
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.83rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <BarChart2 size={15} />
                <span>So Sánh Báo Giá</span>
              </button>

              <button
                onClick={handleOpenCreateModal}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1.1rem',
                  fontSize: '0.83rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Plus size={16} />
                <span>Tạo Yêu Cầu Báo Giá (RFQ)</span>
              </button>
            </div>
          </div>

          {/* 2. Actor Notification Bar placed below task center */}
          <div style={{ marginBottom: '1.25rem' }}>
            <ActorNotificationBar />
          </div>

          {/* 2.1 Backorders Demand Banner (If there are AWAITING_STOCK customer orders) */}
          {backorderSalesOrders.length > 0 && (
            <div style={{
              backgroundColor: '#fff7ed',
              borderRadius: '8px',
              border: '1.5px solid #fdba74',
              padding: '1.25rem',
              marginBottom: '1.25rem',
              boxShadow: '0 4px 12px rgba(234, 88, 12, 0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#c2410c', margin: 0 }}>
                    Nhu Cầu Nhập Hàng Gấp Cho Đơn Khách Đang Chờ ({backorderSalesOrders.length} Đơn Hàng)
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#9a3412', margin: '0.15rem 0 0 0' }}>
                    Các đơn hàng bán lẻ của khách đang tạm giữ chỗ do thiếu tồn kho. Nhấn tạo RFQ để đề xuất mua bổ sung từ nhà cung cấp.
                  </p>
                </div>

                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ea580c' }}>
                  Tổng {backorderRequiredItems.length} mặt hàng cần mua
                </div>
              </div>

              {/* Items Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {backorderRequiredItems.map((item, idx) => (
                  <div key={idx} style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '6px',
                    border: '1px solid #fed7aa',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{item.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                        Khách đang nợ: <strong style={{ color: '#dc2626' }}>{item.neededQty} SP</strong> (trong {item.ordersCount} đơn: {item.orderIds.slice(0, 2).map(id => `#${id}`).join(', ')}{item.orderIds.length > 2 ? '...' : ''})
                      </div>
                    </div>

                    <button
                      onClick={() => handleCreateRfqForBackorder(item)}
                      style={{
                        backgroundColor: '#ea580c',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '5px',
                        padding: '0.45rem 0.85rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Tạo RFQ
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Odoo KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{rfqDraftCount}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginTop: '0.2rem' }}>Mới (Bản Nháp)</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb' }}>{rfqSentCount}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', marginTop: '0.2rem' }}>RFQ Đã Gửi</div>
            </div>

            <div style={{ backgroundColor: '#fffbeb', padding: '1rem', borderRadius: '8px', border: '1px solid #fde68a', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706' }}>{rfqQuotedCount}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b45309', marginTop: '0.2rem' }}>Chờ Duyệt Báo Giá</div>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a' }}>{poConfirmedCount}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d', marginTop: '0.2rem' }}>Đơn Mua Hàng (PO)</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: pendingReceiptCount > 0 ? '#ef4444' : '#10b981' }}>
                {pendingReceiptCount}
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginTop: '0.2rem' }}>Chờ Nhập Kho</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a' }}>100%</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginTop: '0.2rem' }}>Giao Hàng Đúng Hạn</div>
            </div>
          </div>

          {/* Quick Action Navigation Panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Yêu Cầu Báo Giá (RFQ)
                </h3>
                <button
                  onClick={() => navigate('/admin/purchasing?tab=rfq')}
                  style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Xem Tất Cả ({rfqDraftCount + rfqSentCount + rfqQuotedCount}) →
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                Khởi tạo yêu cầu báo giá linh kiện gửi tới các nhà phân phối. So sánh giá tự động để chọn đối tác tối ưu.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleOpenCreateModal}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Tạo RFQ Mới
                </button>
                <button
                  onClick={() => { setSelectedGroupKey(rfqGroups[0]?.key || null); setShowCompareModal(true); }}
                  style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  So Sánh Giá NCC
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Đơn Mua Hàng Chính Thức (PO)
                </h3>
                <button
                  onClick={() => navigate('/admin/purchasing?tab=orders')}
                  style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Xem Tất Cả ({poConfirmedCount}) →
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                Tổng giá trị mua sắm: <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>{formatCurrency(totalSpent)}</strong>. Quản lý tiến độ giao hàng và xác nhận nhập kho.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => navigate('/admin/purchasing?tab=orders')}
                  style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Theo Dõi Giao Hàng
                </button>
                <button
                  onClick={() => navigate('/admin/purchasing?tab=suppliers')}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Danh Bạ NCC ({suppliers.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2 & TAB 3: RFQ (YÊU CẦU BÁO GIÁ) & ORDERS (ĐƠN MUA HÀNG) */}
      {/* ========================================================================= */}
      {(activeTab === 'rfq' || activeTab === 'orders') && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {activeTab === 'rfq' ? 'Yêu Cầu Báo Giá (RFQ)' : 'Đơn Mua Hàng (PO)'}
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {activeTab === 'rfq' 
                  ? 'Quản lý yêu cầu chào giá gửi tới nhà cung cấp và tổng hợp đối chiếu báo giá'
                  : 'Quản lý các đơn đặt hàng chính thức đã chốt giá và theo dõi tiến độ nhập kho'}
              </p>
            </div>
          </div>

          {/* Filter Toolbar (Grid 5 cột đồng nhất với Warehouse.jsx) */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            marginBottom: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1.8fr) minmax(140px, 1fr) minmax(160px, 1.2fr) minmax(140px, 1fr) minmax(140px, 1fr)',
            gap: '0.75rem',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="Tìm theo mã đơn, nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.85rem',
                fontSize: '0.83rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.65rem',
                fontSize: '0.83rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Tất cả trạng thái ({filteredOrders.length})</option>
              {activeTab === 'rfq' ? (
                <>
                  <option value="RFQ">Bản nháp (RFQ)</option>
                  <option value="RFQ_SENT">Đã gửi NCC</option>
                  <option value="QUOTED">Chờ CEO duyệt</option>
                </>
              ) : (
                <>
                  <option value="PO">Đơn mua hàng (PO)</option>
                  <option value="APPROVED">Đã phê duyệt (PO)</option>
                  <option value="SENT">Đã gửi PO</option>
                  <option value="RECEIVED">Đã nhận hàng</option>
                  <option value="DONE">Hoàn tất</option>
                  <option value="CANCELLED">Đã hủy</option>
                </>
              )}
            </select>

            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.65rem',
                fontSize: '0.83rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Tất cả nhà cung cấp ({availableSupplierOptions.length})</option>
              {availableSupplierOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <input
              type="date"
              value={poStartDate}
              onChange={(e) => setPoStartDate(e.target.value)}
              title="Từ ngày"
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.5rem',
                fontSize: '0.8rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff'
              }}
            />

            <input
              type="date"
              value={poEndDate}
              onChange={(e) => setPoEndDate(e.target.value)}
              title="Đến ngày"
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.5rem',
                fontSize: '0.8rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff'
              }}
            />
          </div>

          {/* Orders Data Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>Tham Chiếu</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Nhà Cung Cấp</th>
                  <th style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>Bên Mua</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Hạn Đặt Hàng</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Tổng Tiền</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Trạng Thái</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      Không tìm thấy đơn hàng nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(po => {
                    const badge = getStatusBadge(po.status);
                    const isRfqPending = ['RFQ', 'RFQ_SENT'].includes(po.status);

                    return (
                      <tr key={po.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>
                          {formatPurchaseReference(po)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                          {getSupplierName(po)}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#475569' }}>
                              {(po.createdBy || 'P')[0]?.toUpperCase()}
                            </div>
                            <span>{po.createdBy || 'Phòng Mua Hàng'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDate(po.expectedDeliveryDate || po.createdAt)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: isRfqPending ? '#d97706' : '#16a34a', whiteSpace: 'nowrap' }}>
                          {isRfqPending ? (
                            <span style={{ fontStyle: 'italic', fontSize: '0.78rem' }}>Chờ NCC báo giá</span>
                          ) : (
                            formatCurrency(po.totalAmount)
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.65rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: badge.color,
                            backgroundColor: badge.bg,
                            border: `1px solid ${badge.border}`,
                            borderRadius: '12px'
                          }}>
                            {badge.text}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => { setSelectedPO(po); setViewMode('PO'); }}
                            style={{
                              backgroundColor: '#ffffff',
                              color: '#2563eb',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Chi Tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SUPPLIERS (NHÀ CUNG CẤP) */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Danh Bạ Nhà Cung Cấp (Vendors)
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                Quản lý hồ sơ đối tác, danh mục phân phối chính và lịch sử giao dịch mua hàng ({suppliers.length} đối tác)
              </p>
            </div>
            <div style={{ width: '320px' }}>
              <input
                type="text"
                placeholder="Tìm theo tên, email, số điện thoại NCC..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                style={{ width: '100%', height: '38px', padding: '0 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {suppliers
              .filter(s => !supplierSearch.trim() || s.name?.toLowerCase().includes(supplierSearch.toLowerCase()) || s.email?.toLowerCase().includes(supplierSearch.toLowerCase()))
              .map((sup, idx) => {
                const supOrders = orders.filter(o => o.supplierCode === sup.code || o.supplier?.name === sup.name);
                const totalSupSpend = supOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);

                // Auto-detect distributed categories from catalog
                const distributedProds = effectiveCatalog.filter(p => p.supplier && sup.name && p.supplier.toLowerCase().includes(sup.name.toLowerCase()));
                const distributedCats = [...new Set(distributedProds.map(p => p.category || getCategoryUpper(p)).filter(Boolean))];

                return (
                  <div key={sup.code || idx} style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontWeight: 800, fontSize: '0.95rem' }}>
                            {sup.name ? sup.name[0] : 'S'}
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{sup.name}</h4>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Mã: {sup.code || `SUP-${idx+1}`}</span>
                          </div>
                        </div>
                        <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Star size={12} fill="#b45309" /> {sup.rating || '4.8'}
                        </span>
                      </div>

                      {/* Main Distributed Categories Badges */}
                      <div style={{ marginBottom: '0.85rem' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Phân phối chính:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {distributedCats.length > 0 ? (
                            distributedCats.slice(0, 4).map((cat, cIdx) => (
                              <span key={cIdx} style={{ backgroundColor: '#f1f5f9', color: '#334155', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                                {cat}
                              </span>
                            ))
                          ) : (
                            <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px' }}>
                              Linh kiện máy tính chính hãng
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Phone size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span>{sup.phone || '028 3800 xxxx'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Mail size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sup.email || 'contact@supplier.vn'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <MapPin size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sup.address || 'TP. Hồ Chí Minh, Việt Nam'}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Giao Dịch</span>
                          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{supOrders.length} Đơn Hàng</strong>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Tổng Mua Sắm</span>
                          <strong style={{ fontSize: '0.85rem', color: totalSupSpend > 0 ? '#16a34a' : '#64748b' }}>
                            {totalSupSpend > 0 ? formatCurrency(totalSupSpend) : '0 đ'}
                          </strong>
                        </div>
                      </div>

                      {/* Quick Actions for this Supplier */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button
                          onClick={() => {
                            setSelectedSupplier(sup.code);
                            setShowCreateModal(true);
                          }}
                          style={{
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.45rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <Plus size={13} />
                          <span>Tạo RFQ</span>
                        </button>

                        <button
                          onClick={() => {
                            setSupplierFilter(sup.name || sup.code);
                            navigate('/admin/purchasing?tab=orders');
                          }}
                          style={{
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '0.45rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <span>Xem Đơn ({supOrders.length})</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: COMPARE (SO SÁNH BÁO GIÁ ĐA NCC) */}
      {/* ========================================================================= */}
      {activeTab === 'compare' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Ma Trận So Sánh Báo Giá Nhà Cung Cấp
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                Đối soát giá chào, thời gian giao hàng và chất lượng để lựa chọn đơn vị trúng thầu tối ưu
              </p>
            </div>
            <button
              onClick={() => setShowCompareModal(true)}
              style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.1rem', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Mở Bảng So Sánh Toàn Màn Hình
            </button>
          </div>

          {rfqGroups.length === 0 ? (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <BarChart2 size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>Chưa có nhóm Yêu Cầu Báo Giá đa NCC nào</h3>
              <p style={{ fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
                Khi bạn tạo Yêu Cầu Báo Giá và tích chọn <strong>"Gửi đồng thời cho nhiều NCC"</strong>, hệ thống sẽ tự động tổng hợp vào ma trận so sánh này.
              </p>
              <button
                onClick={handleOpenCreateModal}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}
              >
                + Tạo YCBG Đa NCC Ngay
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {rfqGroups.map((group, gIdx) => (
                <div key={group.key || gIdx} style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Lô Báo Giá #{gIdx + 1} — {group.list.length} Nhà Cung Cấp
                      </h3>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Sản phẩm: {group.list[0]?.items?.map(i => i.productName || i.name).join(', ')}
                      </span>
                    </div>
                    <button
                      onClick={() => { setSelectedGroupKey(group.key); setShowCompareModal(true); }}
                      style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.4rem 0.9rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Xem Bảng Chi Tiết & Chốt Duyệt PO →
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    {group.list.map((po, pIdx) => {
                      const badge = getStatusBadge(po.status);
                      return (
                        <div key={po.id || pIdx} style={{ backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{po.supplier?.name || po.supplierCode}</strong>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '8px', backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                              {badge.text}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem' }}>
                            Mã: <strong>{formatPurchaseReference(po)}</strong>
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: po.totalAmount > 0 ? '#16a34a' : '#d97706' }}>
                            {po.totalAmount > 0 ? formatCurrency(po.totalAmount) : 'Chưa báo giá'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: PRODUCTS (SẢN PHẨM & BẢNG GIÁ) */}
      {/* ========================================================================= */}
      {activeTab === 'products' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Danh Mục Linh Kiện & Bảng Giá Mua Hàng
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                Tham chiếu giá nhập gần nhất, tồn kho hiện tại và khởi tạo nhanh Yêu Cầu Báo Giá ({filteredProductsList.length} sản phẩm)
              </p>
            </div>
          </div>

          {/* Filter Toolbar (Grid 4 cột đồng nhất với Warehouse.jsx) */}
          <div style={{ 
            backgroundColor: '#ffffff', 
            padding: '0.85rem 1rem', 
            borderRadius: '8px', 
            border: '1px solid #cbd5e1', 
            marginBottom: '1.25rem', 
            display: 'grid', 
            gridTemplateColumns: 'minmax(200px, 2fr) minmax(140px, 1.2fr) minmax(160px, 1.3fr) minmax(140px, 1fr)', 
            gap: '0.75rem', 
            alignItems: 'center' 
          }}>
            <input
              type="text"
              placeholder="Tìm theo tên linh kiện, mã SKU..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{ width: '100%', height: '38px', padding: '0 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
            />

            <select
              value={productCategoryFilter}
              onChange={(e) => {
                setProductCategoryFilter(e.target.value);
                setProductSupplierFilter('ALL');
              }}
              style={{ width: '100%', height: '38px', padding: '0 0.65rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', boxSizing: 'border-box', backgroundColor: '#ffffff', cursor: 'pointer' }}
            >
              <option value="ALL">Tất cả phân nhóm</option>
              <option value="CPU">CPU</option>
              <option value="VGA">VGA</option>
              <option value="MAINBOARD">Mainboard</option>
              <option value="RAM">RAM</option>
              <option value="STORAGE">Storage</option>
              <option value="PSU">PSU</option>
              <option value="CASE">Case</option>
              <option value="COOLER">Cooler</option>
              <option value="MONITOR">Monitor</option>
              <option value="KEYBOARD">Keyboard</option>
              <option value="MOUSE">Mouse</option>
            </select>

            <select
              value={productSupplierFilter}
              onChange={(e) => setProductSupplierFilter(e.target.value)}
              style={{ width: '100%', height: '38px', padding: '0 0.65rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', boxSizing: 'border-box', backgroundColor: '#ffffff', cursor: 'pointer' }}
            >
              <option value="ALL">Tất cả nhà cung cấp ({availableProductSuppliers.length})</option>
              {availableProductSuppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={productStockStatusFilter}
              onChange={(e) => setProductStockStatusFilter(e.target.value)}
              style={{ width: '100%', height: '38px', padding: '0 0.65rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', boxSizing: 'border-box', backgroundColor: '#ffffff', cursor: 'pointer' }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="IN_STOCK">Còn hàng</option>
              <option value="LOW_STOCK">Cảnh báo tồn</option>
              <option value="OUT_OF_STOCK">Hết hàng</option>
            </select>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Tên Linh Kiện</th>
                  <th style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>Phân Nhóm</th>
                  <th style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>Nhà Cung Cấp</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Tồn Hiện Tại</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Trạng Thái Tồn</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Giá Tham Chiếu</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      Không tìm thấy linh kiện nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map(p => {
                    const stockQty = Number(p.stock !== undefined ? p.stock : (p.stockQuantity !== undefined ? p.stockQuantity : 0));
                    const threshold = Number(p.threshold || 5);
                    const isOutOfStock = stockQty === 0;
                    const isLowStock = stockQty > 0 && stockQty <= threshold;

                    return (
                      <tr key={p.productId || p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                          <div>{p.name}</div>
                          {p.sku && <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>SKU: {p.sku}</span>}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {p.category || getCategoryUpper(p)}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {p.supplier || p.brand?.name || p.brand || 'Chính hãng'}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap', color: isOutOfStock ? '#ef4444' : isLowStock ? '#d97706' : '#16a34a' }}>
                          {stockQty}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {isOutOfStock ? (
                            <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                              Hết Hàng
                            </span>
                          ) : isLowStock ? (
                            <span style={{ backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                              Cảnh Báo Tồn
                            </span>
                          ) : (
                            <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                              Còn Hàng
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>
                          {formatCurrency(p.price)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleOpenRFQForProduct(p)}
                            style={{
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: '4px',
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            + Tạo RFQ
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalProductPages > 1 && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Hiển thị {(productPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(productPage * ITEMS_PER_PAGE, filteredProductsList.length)} trên tổng số {filteredProductsList.length} linh kiện
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button
                    disabled={productPage <= 1}
                    onClick={() => setProductPage(p => Math.max(p - 1, 1))}
                    style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: productPage <= 1 ? 'not-allowed' : 'pointer', opacity: productPage <= 1 ? 0.5 : 1 }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                    Trang {productPage} / {totalProductPages}
                  </span>
                  <button
                    disabled={productPage >= totalProductPages}
                    onClick={() => setProductPage(p => Math.min(p + 1, totalProductPages))}
                    style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: productPage >= totalProductPages ? 'not-allowed' : 'pointer', opacity: productPage >= totalProductPages ? 0.5 : 1 }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: REPORTS (BÁO CÁO & PHÂN TÍCH MUA HÀNG CHUYÊN SÂU) */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (() => {
        // 1. Calculate spending breakdown by Category
        const catSpendMap = {};
        orders.forEach(po => {
          (po.items || []).forEach(item => {
            const prod = effectiveCatalog.find(p => String(p.productId || p.id) === String(item.productId || item.id || item.name))
              || effectiveCatalog.find(p => String(p.sku) === String(item.productId || item.sku));
            const cat = prod?.category || getCategoryUpper(prod) || item.category || 'Khác';
            const cost = (parseFloat(item.quantity) || 1) * (parseFloat(item.unitCost) || parseFloat(prod?.price) || 0);
            catSpendMap[cat] = (catSpendMap[cat] || 0) + cost;
          });
        });
        const catEntries = Object.entries(catSpendMap)
          .map(([name, spend]) => ({ name, spend }))
          .sort((a, b) => b.spend - a.spend);

        // 2. Calculate top spending suppliers
        const supSpendList = suppliers.map(s => {
          const sOrders = orders.filter(o => o.supplierCode === s.code || o.supplier?.name === s.name);
          const spend = sOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);
          return { ...s, orderCount: sOrders.length, totalSpend: spend };
        }).sort((a, b) => b.totalSpend - a.totalSpend);

        const totalCalculatedSpend = supSpendList.reduce((sum, s) => sum + s.totalSpend, 0) || totalSpent || 1;

        // 3. Top 5 most purchased items (resolve real name from catalog)
        const itemStatsMap = {};
        orders.forEach(po => {
          (po.items || []).forEach(item => {
            const prod = effectiveCatalog.find(p => String(p.productId || p.id) === String(item.productId || item.id || item.name))
              || effectiveCatalog.find(p => String(p.sku) === String(item.productId || item.sku))
              || effectiveCatalog.find(p => p.name === item.productName || p.name === item.name);

            const displayName = prod?.name || (item.productName && !/^\d{6,}$/.test(String(item.productName)) ? item.productName : null) || (item.name && !/^\d{6,}$/.test(String(item.name)) ? item.name : null) || `Linh kiện ${item.productId || item.id}`;

            const key = String(prod?.productId || prod?.id || item.productId || displayName);
            if (!itemStatsMap[key]) {
              itemStatsMap[key] = { 
                name: displayName, 
                category: prod?.category || item.category || '', 
                sku: prod?.sku || item.sku || '',
                totalQty: 0, 
                totalAmount: 0 
              };
            }
            const qty = parseInt(item.quantity, 10) || 1;
            const cost = parseFloat(item.unitCost) || parseFloat(prod?.price) || 0;
            itemStatsMap[key].totalQty += qty;
            itemStatsMap[key].totalAmount += (qty * cost);
          });
        });
        const topPurchasedItems = Object.values(itemStatsMap)
          .filter(i => i.totalAmount > 0 || i.totalQty > 0)
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .slice(0, 5);

        return (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Báo Cáo Phân Tích Mua Hàng & Chuỗi Cung Ứng
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                Phân tích định lượng chi phí mua sắm theo đối tác cung ứng, phân bổ danh mục và hiệu suất thực hiện
              </p>
            </div>

            {/* KPI Cards Overview for Reports */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block' }}>Tổng Chi Phí Đã Mua</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
                  {formatCurrency(totalCalculatedSpend)}
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block' }}>Tổng Số Đơn Đã Lập</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', marginTop: '0.25rem' }}>
                  {orders.length} Đơn Hàng
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block' }}>Tỷ Lệ Giao Đúng Hạn</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                  100% Đạt Chuẩn
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block' }}>Thời Gian Báo Giá TB</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706', marginTop: '0.25rem' }}>
                  1.5 - 2.0 Ngày
                </div>
              </div>
            </div>

            {/* Main Analytics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
              
              {/* Box 1: Top Suppliers Spending */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Top Nhà Cung Cấp Chi Phí Lớn Nhất
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Xếp theo tổng giá trị</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '0.35rem' }}>
                  {supSpendList.slice(0, 8).map((s, idx) => {
                    const pct = totalCalculatedSpend > 0 ? Math.round((s.totalSpend / totalCalculatedSpend) * 100) : 0;
                    return (
                      <div key={idx} style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            #{idx + 1}. {s.name}
                          </span>
                          <span style={{ color: s.totalSpend > 0 ? '#16a34a' : '#64748b', fontWeight: 700 }}>
                            {formatCurrency(s.totalSpend)} ({pct}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(pct, s.totalSpend > 0 ? 3 : 0)}%`, height: '100%', backgroundColor: idx === 0 ? '#2563eb' : idx === 1 ? '#3b82f6' : '#60a5fa', borderRadius: '3px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Box 2: Category Cost Distribution */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Cơ Cấu Chi Phí Theo Phân Nhóm Linh Kiện
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Phân bổ chi phí</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '0.35rem' }}>
                  {catEntries.length > 0 ? (
                    catEntries.map((cat, idx) => {
                      const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];
                      const catColor = colors[idx % colors.length];
                      const pct = totalCalculatedSpend > 0 ? Math.round((cat.spend / totalCalculatedSpend) * 100) : 0;
                      return (
                        <div key={idx} style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{cat.name}</span>
                            <span style={{ color: catColor, fontWeight: 700 }}>{formatCurrency(cat.spend)} ({pct}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(pct, cat.spend > 0 ? 3 : 0)}%`, height: '100%', backgroundColor: catColor, borderRadius: '3px' }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.83rem' }}>
                      Chưa có phát sinh chi phí linh kiện nào.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Box 3: Top Purchased Products Table */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem' }}>
                Top Linh Kiện Nhập Hàng Nhiều Nhất
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Tên Linh Kiện</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Số Lượng Đã Nhập</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Tổng Giá Trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPurchasedItems.length > 0 ? (
                      topPurchasedItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>#{idx + 1}. {item.name}</span>
                              {item.category && (
                                <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                  {item.category}
                                </span>
                              )}
                            </div>
                            {item.sku && <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>SKU: {item.sku}</span>}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>
                            {item.totalQty} chiếc
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                            {formatCurrency(item.totalAmount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          Chưa có lịch sử nhập linh kiện.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= MODAL TẠO YCBG (RFQ) ================= */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.6rem', background: '#eff6ff', borderRadius: '8px', color: '#2563eb' }}>
                  <ShoppingCart size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Tạo Yêu Cầu Báo Giá (RFQ)</h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0' }}>Khởi tạo phiếu yêu cầu chào giá gửi tới các nhà cung cấp</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreatePO}>
              {/* Multi-Supplier Toggle */}
              <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <BarChart2 size={18} style={{ color: '#2563eb' }} />
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#1e40af', display: 'block' }}>Gửi Yêu Cầu Báo Giá Đồng Thời Cho Nhiều NCC</strong>
                    <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>Tự động tạo các đơn RFQ phân tách cho từng đối tác để so sánh giá tối ưu</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={isMultiSupplierRFQ} 
                  onChange={(e) => setIsMultiSupplierRFQ(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {/* Supplier Selection */}
              {isMultiSupplierRFQ ? (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                    Chọn các Nhà Cung Cấp nhận báo giá:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedSuppliersList.map((sup, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                          value={sup}
                          onChange={(e) => {
                            const updated = [...selectedSuppliersList];
                            updated[idx] = e.target.value;
                            setSelectedSuppliersList(updated);
                          }}
                          style={{ flex: 1, height: '38px', padding: '0 0.65rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', backgroundColor: '#ffffff' }}
                        >
                          <option value="">-- Chọn Nhà Cung Cấp #{idx + 1} --</option>
                          {suppliers.map(s => (
                            <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                          ))}
                        </select>
                        {selectedSuppliersList.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = selectedSuppliersList.filter((_, i) => i !== idx);
                              setSelectedSuppliersList(updated);
                            }}
                            style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '6px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedSuppliersList([...selectedSuppliersList, ''])}
                      style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px dashed #bfdbfe', borderRadius: '6px', padding: '0.4rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.2rem' }}
                    >
                      + Thêm Nhà Cung Cấp Khác
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                      Nhà Cung Cấp:
                    </label>
                    <select
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                      style={{ width: '100%', height: '38px', padding: '0 0.65rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', backgroundColor: '#ffffff' }}
                    >
                      <option value="">-- Chọn Nhà Cung Cấp --</option>
                      {suppliers.map(s => (
                        <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                      Hạn Báo Giá / Giao Hàng Dự Kiến:
                    </label>
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      style={{ width: '100%', height: '38px', padding: '0 0.65rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              {/* Add Items Sub-Form */}
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.75rem' }}>
                  Thêm Linh Kiện Vào Đơn
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 100px 90px', gap: '0.65rem', alignItems: 'flex-end' }}>
                  <div style={{ position: 'relative' }} ref={searchComboboxRef}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Chọn sản phẩm:</label>
                    <input
                      type="text"
                      placeholder="Gõ tên hoặc SKU sản phẩm..."
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      style={{ width: '100%', height: '36px', padding: '0 0.65rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                    {showSuggestions && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '180px', overflowY: 'auto', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                        {filteredProductsForModal.slice(0, 20).map(p => (
                          <div
                            key={p.productId || p.id}
                            onClick={() => {
                              setSelectedProduct(String(p.productId || p.id));
                              setProductSearchQuery(p.name);
                              setShowSuggestions(false);
                            }}
                            style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                          >
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Phân nhóm: {p.category} | SKU: {p.sku || p.productId}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Số lượng:</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      style={{ width: '100%', height: '36px', padding: '0 0.5rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    style={{ height: '36px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    + Thêm
                  </button>
                </div>
              </div>

              {/* Items List Table */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', marginBottom: '1.25rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '0.6rem 0.85rem' }}>Sản Phẩm</th>
                      <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>Số Lượng</th>
                      <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                          Chưa có sản phẩm nào được chọn.
                        </td>
                      </tr>
                    ) : (
                      poItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{item.productName || item.name}</td>
                          <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>{item.quantity}</td>
                          <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '4px', padding: '0.2rem 0.4rem', cursor: 'pointer' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.55rem 1.2rem', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting || poItems.length === 0}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem 1.4rem', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {submitting ? 'Đang Khởi Tạo...' : (isMultiSupplierRFQ ? 'Tạo Tất Cả RFQ' : 'Tạo Yêu Cầu Báo Giá')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL XEM CHI TIẾT PO ================= */}
      {selectedPO && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Chi Tiết Đơn Hàng</span>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0.1rem 0 0' }}>
                  {formatPurchaseReference(selectedPO)}
                </h3>
              </div>
              <button onClick={() => setSelectedPO(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.83rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Nhà Cung Cấp:</span>
                <strong style={{ color: '#0f172a' }}>{getSupplierName(selectedPO)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Trạng Thái:</span>
                <strong style={{ color: getStatusBadge(selectedPO.status).color }}>{getStatusText(selectedPO.status)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Ngày Lập:</span>
                <strong style={{ color: '#0f172a' }}>{formatDate(selectedPO.createdAt)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Hạn Giao Hàng:</span>
                <strong style={{ color: '#0f172a' }}>{formatDate(selectedPO.expectedDeliveryDate)}</strong>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', marginBottom: '1.25rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Linh Kiện</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap', width: '110px' }}>Số Lượng</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap', width: '140px' }}>Đơn Giá</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap', width: '150px' }}>Thành Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPO.items || []).map((item, idx) => {
                    const prod = effectiveCatalog.find(p => String(p.productId || p.id) === String(item.productId || item.id || item.product?.id))
                      || effectiveCatalog.find(p => String(p.sku) === String(item.productId || item.sku || item.product?.sku))
                      || effectiveCatalog.find(p => p.name === item.productName || p.name === item.name);

                    const itemName = item.productName || item.name || item.product?.name || prod?.name || `Linh kiện #${item.productId || item.id || idx + 1}`;
                    const itemSku = item.sku || prod?.sku || '';
                    const itemCategory = item.category || prod?.category || '';

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem', color: '#0f172a', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 700, lineHeight: '1.4', fontSize: '0.85rem' }}>{itemName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
                            {itemCategory && (
                              <span style={{ fontSize: '0.68rem', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                {itemCategory}
                              </span>
                            )}
                            {itemSku && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>SKU: {itemSku}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap', color: '#0f172a', verticalAlign: 'top', lineHeight: '1.4', fontSize: '0.85rem' }}>
                          {item.quantity}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap', color: '#475569', verticalAlign: 'top', lineHeight: '1.4', fontSize: '0.85rem' }}>
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap', verticalAlign: 'top', lineHeight: '1.4', fontSize: '0.85rem' }}>
                          {formatCurrency((item.quantity || 0) * (item.unitCost || 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Amount Block (Aligned to the Right) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: '1.25rem', paddingRight: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569' }}>Tổng Tiền Đơn Hàng:</span>
                <strong style={{ fontSize: '1.35rem', color: '#16a34a', fontWeight: 800 }}>
                  {formatCurrency(selectedPO.totalAmount)}
                </strong>
              </div>
            </div>

            {/* QC/QA Inspection Report — read from the receipts the backend now returns
                nested with their QcInspection records (see purchase.controller.js). */}
            {(() => {
              const allInspections = (selectedPO.receipts || [])
                .flatMap(r => r.qcInspections || [])
                .sort((a, b) => (b.id || 0) - (a.id || 0));
              const dbInspection = allInspections[0] || null;
              if (!dbInspection) return null;

              const inspectorName = dbInspection.inspector?.fullName
                ? `${dbInspection.inspector.fullName}${dbInspection.inspector.employeeCode ? ` (${dbInspection.inspector.employeeCode})` : ''}`
                : null;
              const inspectedAt = dbInspection.inspectedAt
                ? new Date(dbInspection.inspectedAt).toLocaleString('vi-VN')
                : null;

              const qcStatusMap = {
                PASSED: { text: 'Đạt Chuẩn 100%', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
                CONDITIONAL: { text: 'Nhập Một Phần', bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' },
                FAILED: { text: 'Từ Chối Lô Hàng', bg: '#fee2e2', color: '#dc2626', border: '#fecaca' }
              };
              const badge = qcStatusMap[dbInspection.status];

              return (
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#0f172a', fontWeight: 800 }}>Biên Bản Kiểm Định QA/QC</h4>
                    {badge && (
                      <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                        {badge.text}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Người Kiểm Định:</span>
                      <strong style={{ color: '#0f172a' }}>{inspectorName || 'Chưa rõ'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Ngày Kiểm Định:</span>
                      <strong style={{ color: '#0f172a' }}>{inspectedAt || 'Chưa rõ'}</strong>
                    </div>
                    {dbInspection.sampleRate != null && (
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Tỷ Lệ Lấy Mẫu:</span>
                        <strong style={{ color: '#0f172a' }}>{dbInspection.sampleRate}%</strong>
                      </div>
                    )}
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Số Lượng Đạt / Lỗi:</span>
                      <strong>
                        <span style={{ color: '#16a34a' }}>{dbInspection.passedQuantity}</span>
                        <span style={{ color: '#94a3b8' }}> / </span>
                        <span style={{ color: '#dc2626' }}>{dbInspection.defectiveQuantity}</span>
                      </strong>
                    </div>
                  </div>
                  {dbInspection.notes && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #e2e8f0', fontSize: '0.82rem', color: '#475569' }}>
                      <strong style={{ color: '#334155' }}>Ghi chú: </strong>{dbInspection.notes}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Lịch Sử Duyệt (Approval History Timeline) — from PurchaseOrderStatusHistory,
                recorded server-side on every real status transition (purchase.controller.js) */}
            {Array.isArray(selectedPO.statusHistory) && selectedPO.statusHistory.length > 0 && (
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1rem', marginBottom: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', color: '#0f172a', fontWeight: 800 }}>Lịch Sử Duyệt</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {selectedPO.statusHistory.map((h, idx) => {
                    const badge = getStatusBadge(h.status);
                    return (
                      <div key={h.id || idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: badge.color, marginTop: '0.45rem', flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{
                              padding: '1px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800,
                              color: badge.color, backgroundColor: badge.bg, border: `1px solid ${badge.border}`
                            }}>
                              {badge.text}
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                              {h.timestamp ? new Date(h.timestamp).toLocaleString('vi-VN') : ''}
                            </span>
                          </div>
                          <div style={{ color: '#334155', marginTop: '0.25rem' }}>
                            <strong>{h.changedBy || 'Hệ thống'}</strong>
                            {h.changedByRole && <span style={{ color: '#94a3b8' }}> ({h.changedByRole})</span>}
                          </div>
                          {h.note && (
                            <div style={{ color: '#64748b', marginTop: '0.15rem', fontStyle: 'italic' }}>"{h.note}"</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', gap: '0.65rem' }}>
              <button
                onClick={() => setSelectedPO(null)}
                style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>

              {selectedPO.status === 'RFQ' && (
                <button
                  onClick={() => handleUpdateStatus(selectedPO.id, 'RFQ_SENT')}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Gửi YCBG Cho NCC
                </button>
              )}

              {selectedPO.status === 'QUOTED' && (
                <>
                  {isCeoApprover ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={async () => {
                          const reason = await promptText('Nhập lý do từ chối / yêu cầu đàm phán lại:', 'Giá chào thầu cao hơn ngân sách dự kiến');
                          if (reason !== null) {
                            try {
                              const updatedPOs = orders.map(o => o.id === selectedPO.id ? { ...o, status: 'RFQ', cancelReason: reason } : o);
                              setOrders(updatedPOs);
                              localStorage.setItem('erp_pos', JSON.stringify(updatedPOs));
                              notify('Đã từ chối báo giá và chuyển lại cho Nhân Viên Mua Hàng đàm phán!', 'success');
                              setSelectedPO(null);
                            } catch (e) {
                              notify('Lỗi: ' + e.message, 'error');
                            }
                          }
                        }}
                        style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Từ Chối & Yêu Cầu Đàm Phán Lại
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(selectedPO.id, 'PO')}
                        style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        CEO Phê Duyệt → Phát Hành PO
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 700, backgroundColor: '#fef3c7', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #fde68a' }}>
                        ⏳ Báo giá đang chờ CEO / Ban Giám Đốc Phê Duyệt
                      </span>
                    </div>
                  )}
                </>
              )}

              {selectedPO.status === 'PO' && (
                <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, backgroundColor: '#dcfce7', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                  ✓ Đã phát hành PO chính thức (Chờ NCC giao & QA/Kho nghiệm thu)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL SO SÁNH BÁO GIÁ TOÀN DIỆN ================= */}
      {showCompareModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '950px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  So Sánh & Đánh Giá Báo Giá Nhà Cung Cấp
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0' }}>
                  Đối soát báo giá giữa các đơn vị để tối ưu chi phí mua hàng
                </p>
              </div>
              <button onClick={() => setShowCompareModal(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {rfqGroups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                <BarChart2 size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                <p style={{ fontSize: '0.9rem' }}>Hiện chưa có nhóm Yêu Cầu Báo Giá đồng thời nào để so sánh.</p>
              </div>
            ) : (
              <div>
                {(selectedGroupKey ? rfqGroups.filter(g => g.key === selectedGroupKey) : rfqGroups).map((group, idx) => (
                  <div key={idx} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>Nhóm Sản Phẩm Cần Nhập:</strong>
                      <span style={{ fontSize: '0.82rem', color: '#2563eb', marginLeft: '0.5rem' }}>
                        {group.list[0]?.items?.map(i => `${i.productName || i.name} (x${i.quantity})`).join(', ')}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(group.list.length, 3)}, 1fr)`, gap: '1rem' }}>
                      {group.list.map((po, pIdx) => {
                        const isCheapest = group.list.every(other => (parseFloat(other.totalAmount) || Infinity) >= (parseFloat(po.totalAmount) || Infinity));
                        const isQuoted = po.status === 'QUOTED';

                        return (
                          <div key={pIdx} style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: isCheapest && po.totalAmount > 0 ? '2px solid #10b981' : '1px solid #cbd5e1',
                            padding: '1rem',
                            position: 'relative'
                          }}>
                            {isCheapest && po.totalAmount > 0 && (
                              <span style={{ position: 'absolute', top: '-10px', right: '10px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>
                                GIÁ RẺ NHẤT
                              </span>
                            )}

                            <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                              {getSupplierName(po)}
                            </h4>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
                              Mã: {formatPurchaseReference(po)}
                            </div>

                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: po.totalAmount > 0 ? '#16a34a' : '#d97706', marginBottom: '0.75rem' }}>
                              {po.totalAmount > 0 ? formatCurrency(po.totalAmount) : 'Chờ NCC báo giá'}
                            </div>

                            {isQuoted && (isCEO || isAdmin) && (
                              <button
                                onClick={async () => {
                                  await handleUpdateStatus(po.id, 'PO');
                                  setShowCompareModal(false);
                                }}
                                style={{
                                  width: '100%',
                                  backgroundColor: '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '0.45rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Chốt Duyệt Đơn Này (Tạo PO)
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
