import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useInventoryStore, useSalesStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { useNotification, notify } from '../../context/NotificationContext';
import ActorNotificationBar from '../../components/ActorNotificationBar';
import { 
  Search, ShoppingCart, Plus, Minus, Trash2, Printer, FileText,
  BarChart2, DollarSign, Users, Award, ClipboardList, TrendingUp, Truck, X, Check,
  Eye, MapPin, Phone, User, Package, Calendar, Tag, ChevronLeft, ChevronRight,
  CreditCard, ShieldCheck, CheckCircle2, ArrowRight, RefreshCw, AlertCircle, Lock
} from 'lucide-react';

const CATEGORY_MAP_VI = {
  CPU: 'Bộ Vi Xử Lý (CPU)',
  VGA: 'Card Màn Hình (VGA)',
  MAINBOARD: 'Bo Mạch Chủ (Mainboard)',
  RAM: 'Bộ Nhớ Trong (RAM)',
  STORAGE: 'Ổ Cứng (SSD/HDD)',
  CASE: 'Vỏ Máy Tính (Case)',
  PSU: 'Nguồn Máy Tính (PSU)',
  COOLER: 'Tản Nhiệt (Cooler)',
  MONITOR: 'Màn Hình (Monitor)',
  KEYBOARD: 'Bàn Phím (Keyboard)',
  MOUSE: 'Chuột (Mouse)'
};

const CAT_ALIASES = {
  CPU: ['CPU', 'BỘ VI XỬ LÝ', 'CHIP', 'PROCESSOR'],
  VGA: ['VGA', 'CARD MÀN HÌNH', 'GRAPHIC CARD', 'GPU'],
  MAINBOARD: ['MAINBOARD', 'BO MẠCH CHỦ', 'MAIN', 'MOTHERBOARD'],
  RAM: ['RAM', 'BỘ NHỚ TRONG', 'MEMORY'],
  STORAGE: ['STORAGE', 'Ổ CỨNG', 'SSD', 'HDD', 'THẺ NHỚ'],
  PSU: ['PSU', 'NGUỒN', 'POWER SUPPLY'],
  CASE: ['CASE', 'VỎ MÁY TÍNH', 'THÙNG MÁY'],
  COOLER: ['COOLER', 'TẢN NHIỆT', 'QUẠT', 'FAN'],
  MONITOR: ['MONITOR', 'MÀN HÌNH', 'DISPLAY'],
  KEYBOARD: ['KEYBOARD', 'BÀN PHÍM', 'PHÍM CƠ'],
  MOUSE: ['MOUSE', 'CHUỘT']
};

const getCategoryUpper = (item) => {
  const cat = item.category || item.categoryName || '';
  if (typeof cat === 'object' && cat !== null) {
    return String(cat.name || cat.code || '').trim().toUpperCase();
  }
  return String(cat).trim().toUpperCase();
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

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'Chưa rõ';
  const d = parseDateVal(dateStr);
  return d ? d.toLocaleDateString('vi-VN') : dateStr;
};

export default function SalesPOS() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const inventory = useInventoryStore(state => state.inventory) || [];
  const orders = useSalesStore(state => state.orders) || [];
  const processCheckout = useSalesStore(state => state.processCheckout);
  const updateOrderStatus = useSalesStore(state => state.updateOrderStatus);
  const customers = [];
  const { user, isCEO, isAdmin, isSales, isSalesManager } = useAuth();
  const { can, canDo, canApprove, canCreate, canEdit, canDelete } = usePermission();
  const canApproveSales = canDo('sales_approve_discount') || canApprove('sales') || isSalesManager || isCEO || isAdmin;
  const canPosCheckout = canDo('sales_pos_checkout') || isAdmin;
  const canCancelOrder = canDo('sales_cancel_order') || isSalesManager || isCEO || isAdmin;
  const canManagePromotions = canDo('sales_manage_promotions') || isSalesManager || isCEO || isAdmin;
  const { addNotification } = useNotification();

  // Active Tab from URL params (?tab=overview|pos|orders|customers|promotions|reports)
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  // Products catalog from Context
  const effectiveCatalog = useMemo(() => {
    return Array.isArray(inventory) ? inventory : [];
  }, [inventory]);

  // POS State
  const [posSearch, setPosSearch] = useState('');
  const [posCategoryFilter, setPosCategoryFilter] = useState('ALL');
  const [posCart, setPosCart] = useState([]);
  const [posCustomerName, setPosCustomerName] = useState('');
  const [posCustomerPhone, setPosCustomerPhone] = useState('');
  const [posPaymentMethod, setPosPaymentMethod] = useState('CASH');
  const [posDiscountPercent, setPosDiscountPercent] = useState(0);
  const [posNote, setPosNote] = useState('');
  const [posPage, setPosPage] = useState(1);
  const POS_ITEMS_PER_PAGE = 12;

  // Invoice Print Modal
  const [printedReceipt, setPrintedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Orders Management State
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderStartDate, setOrderStartDate] = useState('');
  const [orderEndDate, setOrderEndDate] = useState('');
  const [selectedDetailOrder, setSelectedDetailOrder] = useState(null);

  // Customers CRM State
  const [customerSearch, setCustomerSearch] = useState('');

  // Promotions State
  const [promotionsList, setPromotionsList] = useState([
    { code: 'SUMMER2026', title: 'Khuyến mãi Hè Rực Rỡ', discount: 10, type: 'PERCENT', minSpend: 5000000, expiry: '30/08/2026', status: 'ACTIVE' },
    { code: 'VIPGAMING', title: 'Tri Ân Khách Hàng VIP PC Gaming', discount: 500000, type: 'FIXED', minSpend: 15000000, expiry: '31/12/2026', status: 'ACTIVE' },
    { code: 'BUILDPC', title: 'Ưu đãi giảm giá khi Build trọn bộ PC', discount: 8, type: 'PERCENT', minSpend: 10000000, expiry: '15/09/2026', status: 'ACTIVE' },
    { code: 'FREESHIP', title: 'Miễn phí vận chuyển hỏa tốc nội thành', discount: 100000, type: 'FIXED', minSpend: 2000000, expiry: '31/10/2026', status: 'ACTIVE' }
  ]);

  // POS Add to Cart
  const handleAddToCart = (product) => {
    const stockQty = Number(product.stock !== undefined ? product.stock : (product.stockQuantity !== undefined ? product.stockQuantity : 0));
    if (stockQty <= 0) {
      notify(`Sản phẩm "${product.name}" hiện đã hết hàng trong kho!`, 'error');
      return;
    }

    setPosCart(prev => {
      const existing = prev.find(item => String(item.product.id || item.product.productId) === String(product.id || product.productId));
      if (existing) {
        if (existing.quantity >= stockQty) {
          notify(`Tồn kho chỉ còn ${stockQty} sản phẩm, không thể thêm vượt quá!`, 'error');
          return prev;
        }
        return prev.map(item => String(item.product.id || item.product.productId) === String(product.id || product.productId) ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1, unitPrice: product.price || 0 }];
    });
  };

  const handleUpdateCartQty = (prodId, delta) => {
    setPosCart(prev => prev.map(item => {
      if (String(item.product.id || item.product.productId) === String(prodId)) {
        const newQty = item.quantity + delta;
        const stockQty = Number(item.product.stock !== undefined ? item.product.stock : (item.product.stockQuantity !== undefined ? item.product.stockQuantity : 999));
        if (newQty <= 0) return null;
        if (newQty > stockQty) {
          notify(`Tồn kho chỉ còn ${stockQty} chiếc!`, 'error');
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const handleRemoveFromCart = (prodId) => {
    setPosCart(prev => prev.filter(item => String(item.product.id || item.product.productId) !== String(prodId)));
  };

  const calculateSubtotal = () => {
    return posCart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  };

  const calculateTotal = () => {
    const sub = calculateSubtotal();
    const discountAmount = (sub * posDiscountPercent) / 100;
    return Math.max(0, sub - discountAmount);
  };

  // Checkout POS Order
  const handleCheckoutPOS = async () => {
    if (posCart.length === 0) {
      notify('Giỏ hàng POS đang trống!', 'error');
      return;
    }

    const subTotal = calculateSubtotal();
    const finalTotal = calculateTotal();

    const itemsForERP = posCart.map(item => ({
      productId: String(item.product.productId || item.product.id),
      productName: item.product.name,
      quantity: item.quantity,
      price: item.unitPrice,
      total: item.unitPrice * item.quantity,
      category: item.product.category || getCategoryUpper(item.product)
    }));

    // Call ERP Context Checkout
    let orderId = `POS-${Date.now().toString().slice(-6)}`;
    if (typeof processCheckout === 'function') {
      const resId = await processCheckout(
        posCustomerName || 'Khách Mua Tại Quầy', 
        posCustomerPhone || '0901234567', 
        itemsForERP, 
        'POS',
        finalTotal,
        'Bán tại cửa hàng (POS)',
        posPaymentMethod || 'CASH',
        ''
      );
      if (resId) orderId = resId;
    }

    const receiptData = {
      orderId,
      customerName: posCustomerName || 'Khách Mua Tại Quầy',
      customerPhone: posCustomerPhone || '0901234567',
      items: [...posCart],
      subTotal,
      discountPercent: posDiscountPercent,
      discountAmount: (subTotal * posDiscountPercent) / 100,
      total: finalTotal,
      paymentMethod: posPaymentMethod === 'CASH' ? 'Tiền mặt' : posPaymentMethod === 'BANK' ? 'Chuyển khoản QR' : 'Thẻ POS',
      cashier: user?.fullname || user?.username || 'Nhân viên bán hàng',
      note: posNote,
      time: new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN')
    };

    setPrintedReceipt(receiptData);
    setShowReceiptModal(true);
    setPosCart([]);
    setPosCustomerName('');
    setPosCustomerPhone('');
    setPosDiscountPercent(0);
    setPosNote('');

    if (typeof addNotification === 'function') {
      addNotification(`Đã tạo thành công đơn bán lẻ ${orderId} giá trị ${formatCurrency(finalTotal)}!`, 'success');
    }
  };

  // Filtered Products for POS
  const filteredPosProducts = useMemo(() => {
    return effectiveCatalog.filter(p => {
      const matchSearch = !posSearch.trim() || 
        (p.name && p.name.toLowerCase().includes(posSearch.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(posSearch.toLowerCase()));

      const itemCatUpper = getCategoryUpper(p);
      const matchCat = posCategoryFilter === 'ALL' || (() => {
        const aliases = CAT_ALIASES[posCategoryFilter] || [posCategoryFilter];
        return aliases.some(a => itemCatUpper === a || itemCatUpper.includes(a));
      })();

      return matchSearch && matchCat;
    });
  }, [effectiveCatalog, posSearch, posCategoryFilter]);

  const totalPosPages = Math.ceil(filteredPosProducts.length / POS_ITEMS_PER_PAGE) || 1;
  const paginatedPosProducts = useMemo(() => {
    const start = (posPage - 1) * POS_ITEMS_PER_PAGE;
    return filteredPosProducts.slice(start, start + POS_ITEMS_PER_PAGE);
  }, [filteredPosProducts, posPage]);

  // Order status badge helper
  const getStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'PENDING':
        return { bg: '#fff7ed', color: '#ea580c', border: '#ffedd5', text: 'Chờ Xác Nhận' };
      case 'WAITING_PAYMENT':
        return { bg: '#fef3c7', color: '#d97706', border: '#fde68a', text: 'Chờ Thanh Toán' };
      case 'CONFIRMED':
        return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', text: 'Đã Xác Nhận (Chờ Xuất Kho)' };
      case 'PROCESSING':
        return { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd', text: 'Đang Chuẩn Bị Hàng' };
      case 'READY_TO_SHIP':
        return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', text: 'Kho Đã Đóng Gói (Chờ Giao)' };
      case 'SHIPPED':
        return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', text: 'Đang Vận Chuyển' };
      case 'DELIVERED':
      case 'DONE':
      case 'COMPLETED':
        return { bg: '#ecfdf5', color: '#047857', border: '#6ee7b7', text: 'Đã Giao Hoàn Tất' };
      case 'CANCELLED':
        return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', text: 'Đã Hủy Đơn' };
      default:
        return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', text: status || 'Chưa rõ' };
    }
  };

  // Filtered Orders for Tab 'orders'
  const filteredOrdersList = useMemo(() => {
    return orders
      .filter(o => {
        const cust = (o.customerName || o.customer || '').toLowerCase();
        const phone = (o.phone || o.customerPhone || '');
        const id = (o.orderId || o.id || '').toLowerCase();
        const term = orderSearch.toLowerCase().trim();
        const matchSearch = !term || cust.includes(term) || phone.includes(term) || id.includes(term);

        const matchStatus = orderStatusFilter === 'ALL' || o.status === orderStatusFilter;
        const matchDate = isDateInRange(o.date || o.createdAt, orderStartDate, orderEndDate);
        return matchSearch && matchStatus && matchDate;
      })
      .sort((a, b) => {
        const dA = new Date(a.createdAt || a.date || 0);
        const dB = new Date(b.createdAt || b.date || 0);
        return dB.getTime() - dA.getTime();
      });
  }, [orders, orderSearch, orderStatusFilter, orderStartDate, orderEndDate]);

  // KPI Metrics Calculation
  const activeOrders = orders.filter(o => o.status !== 'CANCELLED');
  const totalRevenue = activeOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount || o.total) || 0), 0);
  const pendingConfirmationCount = orders.filter(o => ['PENDING', 'WAITING_PAYMENT'].includes(o.status)).length;
  const pendingDeliveryCount = orders.filter(o => ['CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED'].includes(o.status)).length;
  const completedCount = orders.filter(o => ['DELIVERED', 'DONE', 'COMPLETED'].includes(o.status)).length;
  const averageOrderValue = activeOrders.length > 0 ? Math.round(totalRevenue / activeOrders.length) : 0;

  // Customers calculation for Tab 'customers'
  const derivedCustomers = useMemo(() => {
    const custMap = {};
    orders.forEach(o => {
      const phoneKey = o.phone || o.customerPhone || o.customerName || 'Khách vãng lai';
      if (!custMap[phoneKey]) {
        custMap[phoneKey] = {
          name: o.customerName || o.customer || 'Khách vãng lai',
          phone: o.phone || o.customerPhone || 'Chưa cập nhật',
          email: o.email || `${(o.customerName || 'user').toLowerCase().replace(/\s+/g, '')}@gmail.com`,
          address: o.address || o.shippingAddress || 'TP. Hồ Chí Minh',
          orderCount: 0,
          totalSpent: 0,
          lastOrderDate: o.date || o.createdAt
        };
      }
      custMap[phoneKey].orderCount += 1;
      if (o.status !== 'CANCELLED') {
        custMap[phoneKey].totalSpent += (parseFloat(o.totalAmount || o.total) || 0);
      }
    });

    return Object.values(custMap).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    return derivedCustomers.filter(c => 
      !customerSearch.trim() ||
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [derivedCustomers, customerSearch]);

  // Order Status Change Action
  const handleUpdateOrderStatus = (orderId, newStatus) => {
    if (typeof updateOrderStatus === 'function') {
      updateOrderStatus(orderId, newStatus);
      if (selectedDetailOrder && (selectedDetailOrder.orderId === orderId || selectedDetailOrder.id === orderId)) {
        setSelectedDetailOrder(prev => ({ ...prev, status: newStatus }));
      }
      notify(`Đơn hàng #${orderId} đã được cập nhật sang trạng thái: ${getStatusBadge(newStatus).text}`, 'success');
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & SALES TASK CENTER BANNER */}
      {/* ========================================================================= */}
      
      {/* Dynamic Title for Active Tab */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          {activeTab === 'overview' && 'Tổng Quan Phân Hệ Bán Hàng & Doanh Thu'}
          {activeTab === 'pos' && 'Điểm Bán Hàng Trực Tiếp Tại Quầy (Sales POS)'}
          {activeTab === 'orders' && 'Quản Lý Đơn Hàng Bán Lẻ & Online'}
          {activeTab === 'customers' && 'Danh Bạ & Hồ Sơ Khách Hàng (Sales CRM)'}
          {activeTab === 'promotions' && 'Chương Trình Khuyến Mãi & Bảng Giá Ưu Đãi'}
          {activeTab === 'reports' && 'Báo Cáo Doanh Thu & Hiệu Suất Kinh Doanh'}
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
          Quản lý toàn diện quy trình bán lẻ, tư vấn báo giá, xuất hóa đơn POS và theo dõi đơn hàng
        </p>
      </div>

      {/* Sales Task Center Banner (Identical styling to Purchasing and Warehouse) */}
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
                Trung Tâm Nhiệm Vụ Bán Hàng (Sales Task Center)
              </h3>
              {pendingConfirmationCount > 0 && (
                <span style={{
                  backgroundColor: '#fef3c7',
                  color: '#b45309',
                  border: '1px solid #fde68a',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {pendingConfirmationCount} Đơn Chờ Xác Nhận
                </span>
              )}
            </div>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Trực ban: {pendingConfirmationCount} đơn mới | {pendingDeliveryCount} đơn đang xử lý / vận chuyển | {completedCount} đơn hoàn tất.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {canPosCheckout && (
            <button
              onClick={() => setTab('pos')}
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
              <span>Tạo Đơn Bán Lẻ (POS)</span>
            </button>
          )}

          <button
            onClick={() => {
              setOrderStatusFilter('PENDING');
              setTab('orders');
            }}
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
            <ClipboardList size={15} />
            <span>Xử Lý Đơn Mới ({pendingConfirmationCount})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN BÁN HÀNG) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* 6 Odoo KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatCurrency(totalRevenue)}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>Tổng Doanh Thu</div>
            </div>

            <div style={{ backgroundColor: '#fffbeb', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #fde68a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>{pendingConfirmationCount}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', marginTop: '0.25rem' }}>Đơn Chờ Xác Nhận</div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>{pendingDeliveryCount}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', marginTop: '0.25rem' }}>Đơn Đang Giao / Đóng Gói</div>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d' }}>{completedCount}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', marginTop: '0.25rem' }}>Đơn Giao Hoàn Tất</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatCurrency(averageOrderValue)}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>Giá Trị Đơn Trung Bình</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '85px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6' }}>{derivedCustomers.length}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>Khách Hàng Đã Mua</div>
            </div>
          </div>

          {/* Quick Actions & Recent Orders Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            
            {/* Recent Orders Box */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Đơn Hàng Gần Đây Cần Xử Lý
                </h3>
                <button
                  onClick={() => setTab('orders')}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Xem tất cả →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {orders.slice(0, 5).map((o, idx) => {
                  const badge = getStatusBadge(o.status);
                  return (
                    <div key={idx} style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: '#2563eb' }}>#{o.orderId || o.id}</strong>
                          <span style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 600 }}>— {o.customerName || o.customer || 'Khách vãng lai'}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{formatDate(o.date || o.createdAt)} | {o.phone || 'SĐT chưa có'}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#16a34a' }}>{formatCurrency(o.totalAmount || o.total)}</div>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                          {badge.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick POS Launch Box */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem' }}>
                  Quầy Bán Hàng Nhanh (POS Checkout)
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4, margin: '0 0 1rem' }}>
                  Tạo đơn hàng tức thời cho khách mua linh kiện tại cửa hàng, tra cứu tồn kho thực tế, áp dụng chiết khấu và in phiếu thu.
                </p>
                <div style={{ backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', padding: '0.85rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e40af', fontWeight: 700, fontSize: '0.82rem' }}>
                    <ShieldCheck size={16} />
                    <span>Hệ Thống Đồng Bộ Kho Tự Động</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#3b82f6', margin: '0.25rem 0 0' }}>
                    Mỗi đơn hàng POS sau khi thanh toán sẽ lập tức trừ tồn kho thực tế trong phân hệ Quản Lý Kho.
                  </p>
                </div>
              </div>

              {canPosCheckout && (
                <button
                  onClick={() => setTab('pos')}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <ShoppingCart size={18} />
                  <span>Mở Màn Hình POS Bán Lẻ Ngay</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: POS (ĐIỂM BÁN HÀNG TẠI QUẦY) */}
      {/* ========================================================================= */}
      {activeTab === 'pos' && !canPosCheckout && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '3.5rem 2rem', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <Lock size={28} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem' }}>
            Chức Năng Bán Hàng POS Chưa Được Phân Quyền
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
            Tài khoản của bạn ({user?.fullname || user?.role}) hiện chưa được cấp quyền thao tác bán lẻ tại quầy POS. Quản trị viên (Admin) cần kích hoạt quyền <strong>"Bán lẻ tại quầy POS & in phiếu thu"</strong> trong Ma Trận Phân Quyền để sử dụng tính năng này.
          </p>
          <button
            onClick={() => setTab('overview')}
            style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem 1.35rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Quay Về Tổng Quan Bán Hàng
          </button>
        </div>
      )}

      {activeTab === 'pos' && canPosCheckout && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
          
          {/* Left Column: Products Catalog */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            
            {/* Filter toolbar */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Tìm linh kiện theo tên, SKU..."
                value={posSearch}
                onChange={(e) => { setPosSearch(e.target.value); setPosPage(1); }}
                style={{ width: '100%', height: '38px', padding: '0 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
              />

              <select
                value={posCategoryFilter}
                onChange={(e) => { setPosCategoryFilter(e.target.value); setPosPage(1); }}
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
            </div>

            {/* Products Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
              {paginatedPosProducts.map(prod => {
                const stockQty = Number(prod.stock !== undefined ? prod.stock : (prod.stockQuantity !== undefined ? prod.stockQuantity : 0));
                const isOutOfStock = stockQty <= 0;

                return (
                  <div
                    key={prod.productId || prod.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      backgroundColor: isOutOfStock ? '#f8fafc' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: isOutOfStock ? 0.6 : 1,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#2563eb', backgroundColor: '#eff6ff', padding: '1px 5px', borderRadius: '3px' }}>
                        {prod.category || getCategoryUpper(prod)}
                      </span>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', margin: '0.35rem 0', lineHeight: 1.3, height: '2.4em', overflow: 'hidden' }}>
                        {prod.name}
                      </h4>
                      {prod.sku && <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>SKU: {prod.sku}</span>}
                    </div>

                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#16a34a' }}>
                          {formatCurrency(prod.price)}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isOutOfStock ? '#ef4444' : '#64748b' }}>
                          Tồn: {stockQty}
                        </span>
                      </div>

                      <button
                        disabled={isOutOfStock}
                        onClick={() => handleAddToCart(prod)}
                        style={{
                          width: '100%',
                          backgroundColor: isOutOfStock ? '#cbd5e1' : '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.4rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isOutOfStock ? 'Hết hàng' : '+ Thêm giỏ'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPosPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Hiển thị {(posPage - 1) * POS_ITEMS_PER_PAGE + 1} - {Math.min(posPage * POS_ITEMS_PER_PAGE, filteredPosProducts.length)} / {filteredPosProducts.length} linh kiện
                </span>
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                  <button
                    disabled={posPage <= 1}
                    onClick={() => setPosPage(p => Math.max(p - 1, 1))}
                    style={{ padding: '0.25rem 0.5rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: posPage <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Trang {posPage}/{totalPosPages}</span>
                  <button
                    disabled={posPage >= totalPosPages}
                    onClick={() => setPosPage(p => Math.min(p + 1, totalPosPages))}
                    style={{ padding: '0.25rem 0.5rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: posPage >= totalPosPages ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: POS Cart & Checkout */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingCart size={18} style={{ color: '#2563eb' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Hóa Đơn Bán Lẻ ({posCart.length} món)
                </h3>
              </div>
              {posCart.length > 0 && (
                <button
                  onClick={() => setPosCart([])}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Xóa giỏ
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {posCart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                  Giỏ hàng chưa có linh kiện nào. Hãy bấm "+ Thêm giỏ" từ danh sách bên trái.
                </div>
              ) : (
                posCart.map(item => (
                  <div key={item.product.productId || item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                    <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{item.product.name}</div>
                      <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>{formatCurrency(item.unitPrice)}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        onClick={() => handleUpdateCartQty(item.product.productId || item.product.id, -1)}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateCartQty(item.product.productId || item.product.id, 1)}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => handleRemoveFromCart(item.product.productId || item.product.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.2rem' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer Inputs */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Tên Khách Hàng:</label>
                <input
                  type="text"
                  placeholder="Khách vãng lai / Tên khách..."
                  value={posCustomerName}
                  onChange={(e) => setPosCustomerName(e.target.value)}
                  style={{ width: '100%', height: '34px', padding: '0 0.65rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Số Điện Thoại:</label>
                <input
                  type="text"
                  placeholder="Số điện thoại liên hệ..."
                  value={posCustomerPhone}
                  onChange={(e) => setPosCustomerPhone(e.target.value)}
                  style={{ width: '100%', height: '34px', padding: '0 0.65rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Phương thức:</label>
                  <select
                    value={posPaymentMethod}
                    onChange={(e) => setPosPaymentMethod(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 0.5rem', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: '#ffffff' }}
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK">Chuyển khoản QR</option>
                    <option value="CARD">Thẻ POS</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Chiết khấu (%):</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={posDiscountPercent}
                    onChange={(e) => {
                      const num = Math.max(0, parseInt(e.target.value, 10) || 0);
                      if (num > 10 && !canApproveSales) {
                        notify('⚠️ Quyền hạn: Mức chiết khấu vượt quá 10% yêu cầu Quản Lý Bán Hàng (sales_manager) hoặc Ban Giám Đốc (CEO) phê duyệt!', 'error');
                        setPosDiscountPercent(10);
                        return;
                      }
                      setPosDiscountPercent(Math.min(num, 50));
                    }}
                    style={{ width: '100%', height: '34px', padding: '0 0.5rem', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Calculations & Checkout Button */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
                <span>Tạm tính:</span>
                <span>{formatCurrency(calculateSubtotal())}</span>
              </div>
              {posDiscountPercent > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#ef4444', marginBottom: '0.25rem' }}>
                  <span>Chiết khấu ({posDiscountPercent}%):</span>
                  <span>- {formatCurrency((calculateSubtotal() * posDiscountPercent) / 100)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0 1rem' }}>
                <span>Tổng Thanh Toán:</span>
                <span style={{ color: '#16a34a' }}>{formatCurrency(calculateTotal())}</span>
              </div>

              <button
                disabled={posCart.length === 0}
                onClick={handleCheckoutPOS}
                style={{
                  width: '100%',
                  backgroundColor: posCart.length === 0 ? '#cbd5e1' : '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  cursor: posCart.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <Printer size={18} />
                <span>Thanh Toán & In Hóa Đơn</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ORDERS (QUẢN LÝ ĐƠN HÀNG BÁN LẺ & ONLINE) */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div>
          {/* Orders Filter Toolbar */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            marginBottom: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 2fr) minmax(180px, 1.3fr) minmax(140px, 1fr) minmax(140px, 1fr)',
            gap: '0.75rem',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="Tìm theo mã đơn, khách hàng, số điện thoại..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              style={{ width: '100%', height: '38px', padding: '0 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
            />

            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              style={{ width: '100%', height: '38px', padding: '0 0.65rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', boxSizing: 'border-box', backgroundColor: '#ffffff', cursor: 'pointer' }}
            >
              <option value="ALL">Tất cả trạng thái ({orders.length})</option>
              <option value="PENDING">Chờ xác nhận</option>
              <option value="CONFIRMED">Đã xác nhận (Chờ xuất kho)</option>
              <option value="READY_TO_SHIP">Đã đóng gói (Chờ giao)</option>
              <option value="SHIPPED">Đang vận chuyển</option>
              <option value="DELIVERED">Đã giao hoàn tất</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>

            <input
              type="date"
              value={orderStartDate}
              onChange={(e) => setOrderStartDate(e.target.value)}
              title="Từ ngày"
              style={{ width: '100%', height: '38px', padding: '0 0.5rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#ffffff' }}
            />

            <input
              type="date"
              value={orderEndDate}
              onChange={(e) => setOrderEndDate(e.target.value)}
              title="Đến ngày"
              style={{ width: '100%', height: '38px', padding: '0 0.5rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#ffffff' }}
            />
          </div>

          {/* Orders Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>Mã Đơn</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Khách Hàng</th>
                  <th style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>Kênh Bán</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Ngày Đặt</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Tổng Tiền</th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Trạng Thái</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrdersList.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      Không tìm thấy đơn hàng bán lẻ nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredOrdersList.map(o => {
                    const badge = getStatusBadge(o.status);
                    const isPosOrder = (o.orderId || o.id || '').toString().startsWith('POS');

                    return (
                      <tr key={o.orderId || o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>
                          #{o.orderId || o.id}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>
                          <div style={{ fontWeight: 700 }}>{o.customerName || o.customer || 'Khách vãng lai'}</div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{o.phone || o.customerPhone || 'SĐT chưa có'}</span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>
                          <span style={{
                            backgroundColor: isPosOrder ? '#eff6ff' : '#f0fdf4',
                            color: isPosOrder ? '#2563eb' : '#15803d',
                            border: `1px solid ${isPosOrder ? '#bfdbfe' : '#bbf7d0'}`,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {isPosOrder ? 'Tại Quầy (POS)' : 'Online Web'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap' }}>
                          {formatDate(o.date || o.createdAt)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>
                          {formatCurrency(o.totalAmount || o.total)}
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
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => setSelectedDetailOrder(o)}
                              style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Chi Tiết
                            </button>
                            {o.status === 'PENDING' && (
                              <button
                                onClick={() => handleUpdateOrderStatus(o.orderId || o.id, 'CONFIRMED')}
                                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Xác Nhận
                              </button>
                            )}
                          </div>
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
      {/* TAB 4: CUSTOMERS (DANH BẠ KHÁCH HÀNG CRM) */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Hồ Sơ & Danh Bạ Khách Hàng (Sales CRM)
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                Quản lý lịch sử giao dịch, tổng chi tiêu tích lũy và chăm sóc khách hàng thân thiết ({filteredCustomers.length} khách hàng)
              </p>
            </div>
            <div style={{ width: '300px' }}>
              <input
                type="text"
                placeholder="Tìm theo tên, SĐT, email khách..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                style={{ width: '100%', height: '38px', padding: '0 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {filteredCustomers.map((cust, idx) => {
              const isVIP = cust.totalSpent >= 20000000;
              const isLoyal = cust.totalSpent >= 5000000 && !isVIP;

              return (
                <div key={idx} style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontWeight: 800, fontSize: '0.9rem' }}>
                          {cust.name ? cust.name[0]?.toUpperCase() : 'K'}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{cust.name}</h4>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Đơn gần nhất: {formatDate(cust.lastOrderDate)}</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: isVIP ? '#fef3c7' : isLoyal ? '#eff6ff' : '#f1f5f9',
                        color: isVIP ? '#b45309' : isLoyal ? '#2563eb' : '#64748b',
                        border: `1px solid ${isVIP ? '#fde68a' : isLoyal ? '#bfdbfe' : '#e2e8f0'}`
                      }}>
                        {isVIP ? 'Hạng Vàng (VIP)' : isLoyal ? 'Thành Viên Bạc' : 'Khách Thường'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Phone size={13} style={{ color: '#64748b' }} /> {cust.phone}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <MapPin size={13} style={{ color: '#64748b' }} /> {cust.address}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Giao dịch</span>
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{cust.orderCount} Đơn Hàng</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Tổng Tích Lũy</span>
                        <strong style={{ fontSize: '0.85rem', color: '#16a34a' }}>{formatCurrency(cust.totalSpent)}</strong>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setPosCustomerName(cust.name);
                        setPosCustomerPhone(cust.phone);
                        setTab('pos');
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        padding: '0.45rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Plus size={14} />
                      <span>Tạo Đơn POS Cho Khách Này</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PROMOTIONS (BẢNG GIÁ & KHUYẾN MÃI) */}
      {/* ========================================================================= */}
      {activeTab === 'promotions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Chương Trình Khuyến Mãi & Voucher Chiết Khấu
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                Danh sách mã giảm giá, voucher quà tặng dành cho nhân viên kinh doanh áp dụng tại quầy
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {promotionsList.map((promo, idx) => (
              <div key={idx} style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2563eb', backgroundColor: '#eff6ff', border: '1px dashed #bfdbfe', padding: '3px 8px', borderRadius: '4px' }}>
                    {promo.code}
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#16a34a', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 6px', borderRadius: '10px' }}>
                    Đang Áp Dụng
                  </span>
                </div>

                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem' }}>{promo.title}</h4>
                <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
                  <div>Mức giảm: <strong style={{ color: '#ef4444' }}>{promo.type === 'PERCENT' ? `${promo.discount}%` : formatCurrency(promo.discount)}</strong></div>
                  <div>Đơn tối thiểu: <strong>{formatCurrency(promo.minSpend)}</strong></div>
                  <div>Hạn áp dụng: <strong>{promo.expiry}</strong></div>
                </div>

                <button
                  onClick={() => {
                    setPosDiscountPercent(promo.type === 'PERCENT' ? promo.discount : 5);
                    setTab('pos');
                    notify(`Đã áp dụng mã "${promo.code}" vào Quầy POS!`, 'success');
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.45rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Áp Dụng Mã Này Vào POS
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: REPORTS (BÁO CÁO DOANH THU BÁN HÀNG) */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (() => {
        // Calculate Category Revenue breakdown
        const catRevMap = {};
        orders.forEach(o => {
          if (o.status !== 'CANCELLED') {
            (o.items || []).forEach(item => {
              const prod = effectiveCatalog.find(p => String(p.productId || p.id) === String(item.productId || item.id)) || {};
              const cat = prod.category || item.category || 'Khác';
              const rev = (parseFloat(item.quantity) || 1) * (parseFloat(item.price || item.unitPrice) || parseFloat(prod.price) || 0);
              catRevMap[cat] = (catRevMap[cat] || 0) + rev;
            });
          }
        });

        const catRevEntries = Object.entries(catRevMap)
          .map(([name, rev]) => ({ name, rev }))
          .sort((a, b) => b.rev - a.rev);

        // Top 5 Best Selling Items
        const itemSalesMap = {};
        orders.forEach(o => {
          if (o.status !== 'CANCELLED') {
            (o.items || []).forEach(item => {
              const prod = effectiveCatalog.find(p => String(p.productId || p.id) === String(item.productId || item.id || item.name))
                || effectiveCatalog.find(p => String(p.sku) === String(item.productId || item.sku))
                || effectiveCatalog.find(p => p.name === item.productName || p.name === item.name);

              const displayName = prod?.name || item.productName || item.name || `Linh kiện #${item.productId || item.id}`;
              const key = String(prod?.productId || prod?.id || item.productId || displayName);

              if (!itemSalesMap[key]) {
                itemSalesMap[key] = {
                  name: displayName,
                  category: prod?.category || item.category || '',
                  sku: prod?.sku || item.sku || '',
                  totalQty: 0,
                  totalRevenue: 0
                };
              }
              const qty = parseInt(item.quantity, 10) || 1;
              const price = parseFloat(item.price || item.unitPrice) || parseFloat(prod?.price) || 0;
              itemSalesMap[key].totalQty += qty;
              itemSalesMap[key].totalRevenue += (qty * price);
            });
          }
        });

        const topSellingItems = Object.values(itemSalesMap)
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .slice(0, 5);

        return (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
              
              {/* Category Sales Share */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Cơ Cấu Doanh Thu Theo Phân Nhóm Linh Kiện
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Tỷ trọng danh mục</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '360px', overflowY: 'auto' }}>
                  {catRevEntries.map((cat, idx) => {
                    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];
                    const color = colors[idx % colors.length];
                    const pct = totalRevenue > 0 ? Math.round((cat.rev / totalRevenue) * 100) : 0;
                    return (
                      <div key={idx} style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{cat.name}</span>
                          <span style={{ color: color, fontWeight: 700 }}>{formatCurrency(cat.rev)} ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(pct, 3)}%`, height: '100%', backgroundColor: color, borderRadius: '3px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sales Channels Breakdown */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem' }}>
                  Hiệu Suất Kênh Bán & Trạng Thái Giao
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>{orders.length}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>Tổng Số Đơn Bán</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>
                      {orders.length > 0 ? `${Math.round((completedCount / orders.length) * 100)}%` : '100%'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>Tỷ Lệ Giao Thành Công</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>{pendingConfirmationCount}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>Đơn Mới Cần Duyệt</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6' }}>{derivedCustomers.length}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>Tổng Khách Hàng CRM</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Top Best Selling Items Table */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem' }}>
                Top 5 Linh Kiện Bán Chạy Nhất
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Tên Linh Kiện</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Số Lượng Đã Bán</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Tổng Doanh Số</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSellingItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>#{idx + 1}. {item.name}</span>
                            {item.category && (
                              <span style={{ fontSize: '0.68rem', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px' }}>
                                {item.category}
                              </span>
                            )}
                          </div>
                          {item.sku && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>SKU: {item.sku}</span>}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>
                          {item.totalQty} chiếc
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          {formatCurrency(item.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= MODAL CHI TIẾT ĐƠN HÀNG (BALANCED & ALIGNED) ================= */}
      {selectedDetailOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Chi Tiết Đơn Hàng Bán Lẻ</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0 0' }}>
                  #{selectedDetailOrder.orderId || selectedDetailOrder.id}
                </h3>
              </div>
              <button onClick={() => setSelectedDetailOrder(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.83rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Khách Hàng:</span>
                <strong style={{ color: '#0f172a' }}>{selectedDetailOrder.customerName || selectedDetailOrder.customer || 'Khách vãng lai'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Trạng Thái Đơn:</span>
                <strong style={{ color: getStatusBadge(selectedDetailOrder.status).color }}>{getStatusBadge(selectedDetailOrder.status).text}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Số Điện Thoại:</span>
                <strong style={{ color: '#0f172a' }}>{selectedDetailOrder.phone || selectedDetailOrder.customerPhone || 'Chưa cập nhật'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Ngày Đặt Hàng:</span>
                <strong style={{ color: '#0f172a' }}>{formatDate(selectedDetailOrder.date || selectedDetailOrder.createdAt)}</strong>
              </div>
            </div>

            {/* Items Table with Vertical Align Top & Clean Row Alignment */}
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
                  {(selectedDetailOrder.items || []).map((item, idx) => {
                    const prod = effectiveCatalog.find(p => String(p.productId || p.id) === String(item.productId || item.id || item.product?.id))
                      || effectiveCatalog.find(p => String(p.sku) === String(item.productId || item.sku || item.product?.sku))
                      || effectiveCatalog.find(p => p.name === item.productName || p.name === item.name);

                    const itemName = item.productName || item.name || item.product?.name || prod?.name || `Linh kiện #${item.productId || item.id || idx + 1}`;
                    const itemSku = item.sku || prod?.sku || '';
                    const itemCategory = item.category || prod?.category || '';
                    const unitPrice = parseFloat(item.price || item.unitPrice || prod?.price) || 0;
                    const qty = parseInt(item.quantity, 10) || 1;

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
                          {qty}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap', color: '#475569', verticalAlign: 'top', lineHeight: '1.4', fontSize: '0.85rem' }}>
                          {formatCurrency(unitPrice)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap', verticalAlign: 'top', lineHeight: '1.4', fontSize: '0.85rem' }}>
                          {formatCurrency(qty * unitPrice)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Amount Aligned to Right */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: '1.25rem', paddingRight: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569' }}>Tổng Tiền Đơn Hàng:</span>
                <strong style={{ fontSize: '1.35rem', color: '#16a34a', fontWeight: 800 }}>
                  {formatCurrency(selectedDetailOrder.totalAmount || selectedDetailOrder.total)}
                </strong>
              </div>
            </div>

            {/* Action Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', gap: '0.65rem' }}>
              <button
                onClick={() => setSelectedDetailOrder(null)}
                style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>

              {selectedDetailOrder.status === 'PENDING' && (
                <button
                  onClick={() => handleUpdateOrderStatus(selectedDetailOrder.orderId || selectedDetailOrder.id, 'CONFIRMED')}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Xác Nhận Đơn Hàng
                </button>
              )}

              {selectedDetailOrder.status === 'CONFIRMED' && (
                <div style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 600, backgroundColor: '#f0fdf4', padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                  📦 Đơn hàng đã chuyển sang Bộ phận Kho để Đóng gói & Bàn giao Shipper
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL IN HÓA ĐƠN POS ================= */}
      {showReceiptModal && printedReceipt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>HỆ THỐNG KLTN ERP</h3>
              <p style={{ margin: '0.2rem 0', fontSize: '0.78rem', color: '#64748b' }}>Cửa Hàng Linh Kiện Máy Tính Cao Cấp</p>
              <h4 style={{ margin: '0.5rem 0 0', fontSize: '1rem', fontWeight: 800, color: '#2563eb' }}>PHIẾU THANH TOÁN BÁN LẺ</h4>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>Mã: #{printedReceipt.orderId}</span>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
              <div>Khách hàng: <strong>{printedReceipt.customerName}</strong></div>
              <div>Số điện thoại: <strong>{printedReceipt.customerPhone}</strong></div>
              <div>Thời gian: <strong>{printedReceipt.time}</strong></div>
              <div>Thu ngân: <strong>{printedReceipt.cashier}</strong></div>
              <div>Phương thức: <strong>{printedReceipt.paymentMethod}</strong></div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '0.5rem 0', marginBottom: '1rem' }}>
              {printedReceipt.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0' }}>
                  <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.product.name}</div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                  </div>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(item.quantity * item.unitPrice)}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Tạm tính:</span>
                <span>{formatCurrency(printedReceipt.subTotal)}</span>
              </div>
              {printedReceipt.discountPercent > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                  <span>Chiết khấu ({printedReceipt.discountPercent}%):</span>
                  <span>- {formatCurrency(printedReceipt.discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 900, color: '#16a34a', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
                <span>TỔNG CỘNG:</span>
                <span>{formatCurrency(printedReceipt.total)}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Cảm ơn quý khách và hẹn gặp lại!<br />
              Đổi trả miễn phí trong vòng 7 ngày nếu có lỗi từ NSX.
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => { window.print(); setShowReceiptModal(false); }}
                style={{ flex: 1, backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Printer size={16} />
                <span>In Hóa Đơn</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
