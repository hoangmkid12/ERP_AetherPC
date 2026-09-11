import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSalesStore } from '../../../stores';
import { useAuth } from '../../../context/AuthContext';
import { useNotification, notify } from '../../../context/NotificationContext';
import { api } from '../../../services/api';
import { detectDeliveryRegion } from '../../../utils/deliveryRegions';

import OverviewTab from './OverviewTab';
import PendingTab from './PendingTab';
import ActiveTab from './ActiveTab';
import ReturnsTab from './ReturnsTab';
import HistoryTab from './HistoryTab';
import PODModal from './components/PODModal';
import FailModal from './components/FailModal';
import ReturnProofModal from './components/ReturnProofModal';
import OrderDetailSheet from './components/OrderDetailSheet';
import { getDeliveryIncidentStatus } from './deliveryHelpers';

// Refetch orders/returns while the tab is visible, paused otherwise.
const POLL_INTERVAL_MS = 35000;

export default function Delivery() {
  const contextOrders = useSalesStore(state => state.orders) || [];
  const returnRequests = useSalesStore(state => state.returnRequests) || [];
  const getReturnRequests = useSalesStore(state => state.getReturnRequests);
  const updateOrderStatus = useSalesStore(state => state.updateOrderStatus);
  const claimOrderForDelivery = useSalesStore(state => state.claimOrderForDelivery);
  const updateReturnStatus = useSalesStore(state => state.updateReturnStatus);
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const [apiOrders, setApiOrders] = useState([]);
  const [apiReturns, setApiReturns] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchApiData = useCallback(async (isPull = false) => {
    try {
      if (isPull) setIsRefreshing(true); else setLoadingOrders(true);
      const [resOrders, resReturns] = await Promise.allSettled([
        api.get('/orders'),
        api.get('/orders/returns')
      ]);
      if (resOrders.status === 'fulfilled' && resOrders.value?.data) {
        setApiOrders(resOrders.value.data);
      }
      if (resReturns.status === 'fulfilled' && resReturns.value?.data) {
        setApiReturns(resReturns.value.data);
      }
      if (typeof getReturnRequests === 'function') {
        getReturnRequests();
      }
    } catch (err) {
      console.warn('[Delivery] Error loading data from API, using fallback store:', err.message);
    } finally {
      if (isPull) setIsRefreshing(false); else setLoadingOrders(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bootstrap fetch
  useEffect(() => {
    fetchApiData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lightweight polling — paused while the tab/document is hidden.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchApiData(true);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchApiData]);

  // ---- Basic pull-to-refresh (plain touch events, no library) ----
  const touchStartY = useRef(0);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const onTouchStart = (e) => {
    const container = e.currentTarget;
    if (container.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    } else {
      touchStartY.current = 0;
      setIsPulling(false);
    }
  };
  const onTouchMove = (e) => {
    if (!isPulling || !touchStartY.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullDistance(Math.min(delta, 80));
  };
  const onTouchEnd = async () => {
    if (isPulling && pullDistance > 50) {
      await fetchApiData(true);
    }
    setPullDistance(0);
    setIsPulling(false);
    touchStartY.current = 0;
  };
  const pullHandlers = { onTouchStart, onTouchMove, onTouchEnd };

  // Merge orders from Context, LocalStorage and Backend API
  const orders = useMemo(() => {
    let localList = [];
    try {
      localList = JSON.parse(localStorage.getItem('erp_orders') || '[]');
    } catch (_) { }

    const map = new Map();
    (apiOrders || []).forEach(o => {
      const key = String(o.orderId || o.id || '');
      if (key) map.set(key, o);
    });
    localList.forEach(o => {
      const key = String(o.orderId || o.id || '');
      if (key) map.set(key, { ...map.get(key), ...o });
    });
    (contextOrders || []).forEach(o => {
      const key = String(o.orderId || o.id || '');
      if (key) map.set(key, { ...map.get(key), ...o });
    });

    return Array.from(map.values());
  }, [contextOrders, apiOrders]);

  // Merge return requests from Store, LocalStorage and Backend API
  const allReturnRequests = useMemo(() => {
    let localList = [];
    try {
      localList = JSON.parse(localStorage.getItem('erp_return_requests') || '[]');
    } catch (_) { }

    const map = new Map();
    (apiReturns || []).forEach(r => {
      const key = String(r.id || r.orderId || '');
      if (key) map.set(key, r);
    });
    localList.forEach(r => {
      const key = String(r.id || r.orderId || '');
      if (key) map.set(key, { ...map.get(key), ...r });
    });
    (returnRequests || []).forEach(r => {
      const key = String(r.id || r.orderId || '');
      if (key) map.set(key, { ...map.get(key), ...r });
    });

    return Array.from(map.values());
  }, [returnRequests, apiReturns]);

  // Active Tab from URL (?tab=overview|pending|active|returns|history) —
  // default is 'active' (a shipper's home screen should show actionable
  // "currently delivering" work first); 'overview' is reachable via the
  // bottom tab bar.
  const activeTab = searchParams.get('tab') || 'active';
  const setTab = (tKey) => {
    setSearchParams({ tab: tKey });
    setSearch('');
  };

  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [incidentFilter, setIncidentFilter] = useState('ALL');
  const [dateFilterPeriod, setDateFilterPeriod] = useState('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('NEWEST');
  const [selectedOrder, setSelectedOrder] = useState(null);

  // RMA Pickup Tab Filters State
  const [rmaSearch, setRmaSearch] = useState('');
  const [rmaDateFilter, setRmaDateFilter] = useState('ALL');
  const [rmaCustomStartDate, setRmaCustomStartDate] = useState('');
  const [rmaCustomEndDate, setRmaCustomEndDate] = useState('');
  const [rmaStatusFilter, setRmaStatusFilter] = useState('ALL');

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return { formatted: 'Hôm nay', isNew: false, fullDate: 'Hôm nay' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { formatted: 'Hôm nay', isNew: false, fullDate: 'Hôm nay' };

    const diffMs = Math.max(0, Date.now() - d.getTime());
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);

    let formatted = '';
    if (diffMin < 2) formatted = 'Vừa giao xong';
    else if (diffMin < 60) formatted = `${diffMin} phút trước`;
    else if (diffHours < 24) formatted = `${diffHours} giờ trước`;
    else formatted = `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;

    const isNew = diffMin <= 180;
    return {
      formatted,
      isNew,
      diffMin,
      fullDate: `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${d.toLocaleDateString('vi-VN')}`
    };
  };

  // Delivery Failure Modal State
  const [failModal, setFailModal] = useState(null);
  // Proof of Delivery Modal State
  const [deliverModal, setDeliverModal] = useState(null);
  // Return-to-Warehouse Photo Proof Modal State
  const [returnModal, setReturnModal] = useState(null);

  const isManagerOrAdmin = ['CEO', 'ADMIN', 'WAREHOUSE_MANAGER', 'SALES_MANAGER'].includes(user?.role);
  const userIdStr = String(user?.id || user?.username || '');

  const fmt = (num) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);

  const uName = String(user?.fullname || user?.name || '').toLowerCase();
  const uUser = String(user?.username || '').toLowerCase();
  const uPhone = String(user?.phone || '').replace(/\D/g, '');
  const shipperRegion = user?.deliveryRegion || 'HCM_KV1';

  const isShipperMatched = (o) => {
    if (isManagerOrAdmin) return true;
    const shipperStr = String(o.assignedShipper || o.assignedShipperName || '').toLowerCase();
    const assignedIdStr = String(o.assignedShipperId || o.assignedShipperUsername || '').toLowerCase();

    const isDirectlyAssigned = (assignedIdStr && (
        assignedIdStr === userIdStr.toLowerCase() ||
        assignedIdStr === uUser ||
        (user?.id && assignedIdStr === String(user.id).toLowerCase())
      )) ||
      (uName && shipperStr && shipperStr.includes(uName)) ||
      (uUser && shipperStr && shipperStr.includes(uUser)) ||
      (uPhone && shipperStr && shipperStr.includes(uPhone));

    if (isDirectlyAssigned) return true;

    if (o.assignedShipperId || o.assignedShipper || o.assignedShipperUsername) return false;

    if (shipperRegion === 'ALL') return true;
    const orderRegion = o.deliveryRegion || detectDeliveryRegion(o.shippingAddress || o.address || '');
    return orderRegion === shipperRegion;
  };

  const getOrderTimeClassification = (ord) => {
    const dateVal = ord.deliveredAt || ord.shippedAt || ord.updatedAt || ord.createdAt || ord.packedAt || ord.date;
    if (!dateVal) return { isToday: false, isNew: false, isBacklog: true, label: 'Đơn Cũ' };
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return { isToday: false, isNew: false, isBacklog: true, label: 'Đơn Cũ' };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

    const isToday = d >= startOfToday && d <= endOfToday;
    const isNew = isToday && diffHours <= 3;
    const isBacklog = d < startOfToday;

    return {
      isToday,
      isNew,
      isBacklog,
      dateObj: d,
      formatted: d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const myDeliveryOrders = orders.filter(o =>
    o && ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE', 'CANCELLED', 'CONFIRMED'].includes(o.status)
  );

  const readyCount = myDeliveryOrders.filter(o => o.status === 'READY_TO_SHIP').length;
  const activeOrdersList = myDeliveryOrders.filter(o =>
    ['SHIPPED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE', 'CANCELLED'].includes(o.status) && isShipperMatched(o)
  );
  const activeCount = activeOrdersList.length;
  const doneCount = myDeliveryOrders.filter(o => o.status === 'DELIVERED' && isShipperMatched(o)).length;
  const failedCount = myDeliveryOrders.filter(o => {
    if (!isShipperMatched(o)) return false;
    const st = getDeliveryIncidentStatus(o);
    return st.isAwaiting || st.isRescheduled || st.isRejected || st.isReturning;
  }).length;

  const todayCount = activeOrdersList.filter(o => getOrderTimeClassification(o).isToday).length;
  const newCount = activeOrdersList.filter(o => getOrderTimeClassification(o).isNew).length;
  const backlogCount = activeOrdersList.filter(o => getOrderTimeClassification(o).isBacklog).length;

  const countShipping = myDeliveryOrders.filter(o => isShipperMatched(o) && getDeliveryIncidentStatus(o).isShipping).length;
  const countAwaiting = myDeliveryOrders.filter(o => isShipperMatched(o) && getDeliveryIncidentStatus(o).isAwaiting).length;
  const countRescheduled = myDeliveryOrders.filter(o => isShipperMatched(o) && getDeliveryIncidentStatus(o).isRescheduled).length;
  const countRejected = myDeliveryOrders.filter(o => isShipperMatched(o) && getDeliveryIncidentStatus(o).isRejected).length;
  const countReturning = myDeliveryOrders.filter(o => isShipperMatched(o) && getDeliveryIncidentStatus(o).isReturning).length;

  const totalCodCollected = myDeliveryOrders
    .filter(o => o.status === 'DELIVERED' && isShipperMatched(o))
    .reduce((sum, o) => sum + (o.paymentMethod === 'COD' || !o.paymentMethod ? (parseFloat(o.totalAmount || o.total || 0)) : 0), 0);

  const pendingReturns = allReturnRequests.filter(r => {
    const isRmaStatus = ['PENDING', 'RETURN_APPROVED', 'RETURNING_TO_WAREHOUSE', 'RETURN_REQUESTED', 'DELIVERED_TO_WAREHOUSE', 'PROCESSING'].includes(r.status);
    if (!isRmaStatus) return false;

    if (isManagerOrAdmin) return true;

    const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(r.orderId));
    if (matchedOrder) {
      return isShipperMatched(matchedOrder);
    }

    if (r.pickupShipperId) {
      const pId = String(r.pickupShipperId).toLowerCase();
      return pId === userIdStr.toLowerCase() || pId === uUser || (user?.id && pId === String(user.id).toLowerCase());
    }

    return false;
  });

  // Tab Filtering Orders with Region, Payment, Incident, Time Search & Sorting
  const filteredOrders = useMemo(() => {
    const list = myDeliveryOrders.filter(o => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        o.orderId?.toLowerCase().includes(q) ||
        o.id?.toString().toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.phone?.includes(q) ||
        o.shippingAddress?.toLowerCase().includes(q);

      if (!matchSearch) return false;

      const addr = (o.shippingAddress || '').toLowerCase();
      const isHCM = addr.includes('hồ chí minh') || addr.includes('hcm') || addr.includes('tp.hcm') || addr.includes('sài gòn') || addr.includes('quận') || addr.includes('thủ đức') || addr.includes('bình thạnh') || addr.includes('tân bình') || addr.includes('gò vấp');
      if (regionFilter === 'HCM' && !isHCM) return false;
      if (regionFilter === 'PROVINCE' && isHCM) return false;

      const isPaid = o.paymentStatus === 'PAID' || o.paymentMethod === 'ONLINE_GATEWAY' || o.paymentMethod === 'BANK_TRANSFER' || (parseFloat(o.totalAmount || o.total || 0) === 0);
      if (paymentFilter === 'COD' && isPaid) return false;
      if (paymentFilter === 'PREPAID' && !isPaid) return false;

      const incidentState = getDeliveryIncidentStatus(o);

      const ordTime = getOrderTimeClassification(o);
      if (incidentFilter === 'TODAY' && !ordTime.isToday) return false;
      if (incidentFilter === 'NEW' && !ordTime.isNew) return false;
      if (incidentFilter === 'BACKLOG' && !ordTime.isBacklog) return false;
      if (incidentFilter === 'SHIPPING' && !incidentState.isShipping) return false;
      if (incidentFilter === 'DELIVERED' && !incidentState.isDelivered) return false;
      if (incidentFilter === 'AWAITING_CALLBACK' && !incidentState.isAwaiting) return false;
      if (incidentFilter === 'RESCHEDULED' && !incidentState.isRescheduled) return false;
      if (incidentFilter === 'REJECTED' && !incidentState.isRejected) return false;
      if (incidentFilter === 'RETURNING' && !incidentState.isReturning) return false;

      const getOrderDateTime = (ord) => {
        const dateVal = ord.deliveredAt || ord.shippedAt || ord.updatedAt || ord.createdAt || ord.packedAt || ord.date;
        if (!dateVal) return null;
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? null : d;
      };

      const ordDate = getOrderDateTime(o);
      if (dateFilterPeriod !== 'ALL' && ordDate) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (dateFilterPeriod === 'TODAY') {
          if (ordDate < startOfToday || ordDate > endOfToday) return false;
        } else if (dateFilterPeriod === 'YESTERDAY') {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          const endOfYesterday = new Date(endOfToday);
          endOfYesterday.setDate(endOfYesterday.getDate() - 1);
          if (ordDate < startOfYesterday || ordDate > endOfYesterday) return false;
        } else if (dateFilterPeriod === 'LAST_7_DAYS') {
          const past7 = new Date(startOfToday);
          past7.setDate(past7.getDate() - 7);
          if (ordDate < past7 || ordDate > endOfToday) return false;
        } else if (dateFilterPeriod === 'LAST_30_DAYS') {
          const past30 = new Date(startOfToday);
          past30.setDate(past30.getDate() - 30);
          if (ordDate < past30 || ordDate > endOfToday) return false;
        } else if (dateFilterPeriod === 'CUSTOM') {
          if (customStartDate) {
            const fromD = new Date(customStartDate);
            if (!isNaN(fromD.getTime()) && ordDate < fromD) return false;
          }
          if (customEndDate) {
            const toD = new Date(customEndDate);
            toD.setHours(23, 59, 59, 999);
            if (!isNaN(toD.getTime()) && ordDate > toD) return false;
          }
        }
      }

      const matchesShipper = isShipperMatched(o);
      if (!matchesShipper) return false;

      if (activeTab === 'pending') return o.status === 'READY_TO_SHIP';

      if (activeTab === 'active') {
        if (incidentFilter === 'DELIVERED') return o.status === 'DELIVERED';
        return ['SHIPPED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE', 'CANCELLED'].includes(o.status);
      }

      if (activeTab === 'history') {
        return ['DELIVERED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE', 'CANCELLED'].includes(o.status);
      }

      return true;
    });

    return list.sort((a, b) => {
      const timeA = new Date(a.deliveredAt || a.updatedAt || a.createdAt || a.packedAt || 0).getTime();
      const timeB = new Date(b.deliveredAt || b.updatedAt || b.createdAt || b.packedAt || 0).getTime();
      const codA = parseFloat(a.totalAmount || a.total || 0);
      const codB = parseFloat(b.totalAmount || b.total || 0);

      if (sortOrder === 'NEWEST') return timeB - timeA;
      if (sortOrder === 'OLDEST') return timeA - timeB;
      if (sortOrder === 'COD_DESC') return codB - codA;
      if (sortOrder === 'COD_ASC') return codA - codB;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDeliveryOrders, search, regionFilter, paymentFilter, incidentFilter, dateFilterPeriod, customStartDate, customEndDate, sortOrder, activeTab, userIdStr, isManagerOrAdmin, user]);

  const handleClaimOrder = async (orderId) => {
    const sId = user?.id || user?.username || 'SHIPPER';
    const sName = user?.fullname || user?.name || user?.username || 'Shipper';
    setApiOrders(prev => prev.map(o => (String(o.orderId || o.id) === String(orderId) ? { ...o, status: 'SHIPPED', assignedShipperId: sId, assignedShipperName: sName } : o)));
    try {
      if (typeof claimOrderForDelivery === 'function') {
        const result = await claimOrderForDelivery(orderId, user);
        if (result?.success) {
          addNotification(`Đã nhận đơn hàng #${orderId}! Đơn đã chuyển sang tab "Đang Giao & Minh Chứng".`, 'success', '/admin/delivery?tab=active');
        } else {
          addNotification(result?.message || `Không thể nhận đơn hàng #${orderId}.`, 'error');
        }
      } else {
        await updateOrderStatus(orderId, 'SHIPPED');
        addNotification(`Đã nhận đơn hàng #${orderId}!`, 'success', '/admin/delivery?tab=active');
      }
    } catch (err) {
      addNotification(`Lỗi nhận đơn #${orderId}: ${err.message}`, 'error');
    } finally {
      fetchApiData(true);
    }
  };

  const handleConfirmDelivered = async (payload) => {
    if (!deliverModal) return;
    const ordId = deliverModal.orderId || deliverModal.id;
    const payLabel = payload.actualPaymentMethod === 'BANK_TRANSFER' ? `Chuyển khoản VietQR (${payload.bankRefCode})` : (payload.actualPaymentMethod === 'CASH' ? 'Tiền mặt' : 'Đã thanh toán trước');

    // Optimistically update apiOrders state for instant UI responsiveness
    setApiOrders(prev => prev.map(o => {
      if (String(o.orderId || o.id) === String(ordId)) {
        return {
          ...o,
          status: 'DELIVERED',
          paymentStatus: 'PAID',
          deliveredAt: payload.deliveredAt || new Date().toISOString(),
          ...payload
        };
      }
      return o;
    }));
    setDeliverModal(null);

    try {
      await updateOrderStatus(ordId, 'DELIVERED', payload);
      addNotification(`Đơn hàng #${ordId} giao thành công! Hình thức thanh toán: [${payLabel}], Người nhận: [${payload.receiverNameActual}].`, 'success', '/admin/delivery?tab=history');
    } catch (err) {
      addNotification(`Lỗi cập nhật trạng thái đơn #${ordId}: ${err.message}`, 'error');
    } finally {
      fetchApiData(true);
    }
  };

  const handleFailDelivery = async (payload) => {
    if (!failModal) return;
    const ordId = failModal.orderId || failModal.id;

    setApiOrders(prev => prev.map(o => {
      if (String(o.orderId || o.id) === String(ordId)) {
        return {
          ...o,
          status: 'SHIPPING_FAILED',
          ...payload
        };
      }
      return o;
    }));
    setFailModal(null);

    try {
      await updateOrderStatus(ordId, 'SHIPPING_FAILED', payload);
      if (payload.isAwaitingCallback) {
        addNotification(`Đã đưa đơn #${ordId} vào danh sách "Chờ khách gọi lại (24h)". Sau 24h hệ thống sẽ tự động hoàn kho.`, 'warning', '/admin/delivery?tab=active');
      } else {
        addNotification(`Đã cập nhật trạng thái đơn #${ordId}: Giao Thất Bại / Hẹn Lại.`, 'warning', '/admin/delivery?tab=history');
      }
    } catch (err) {
      addNotification(`Lỗi cập nhật trạng thái đơn #${ordId}: ${err.message}`, 'error');
    } finally {
      fetchApiData(true);
    }
  };

  const handleResumeDelivery = async (orderId) => {
    const extra = {
      isAwaitingCallback: false,
      failReason: '',
      failNote: '',
      resumedAt: new Date().toISOString()
    };
    setApiOrders(prev => prev.map(o => (String(o.orderId || o.id) === String(orderId) ? { ...o, status: 'SHIPPED', ...extra } : o)));
    try {
      await updateOrderStatus(orderId, 'SHIPPED', extra);
      setIncidentFilter('ALL');
      addNotification(`Đơn #${orderId} đã được kích hoạt lại! Bạn có thể tiếp tục đi giao và chụp ảnh POD.`, 'success', '/admin/delivery?tab=active');
    } catch (err) {
      addNotification(`Lỗi kích hoạt lại đơn #${orderId}: ${err.message}`, 'error');
    } finally {
      fetchApiData(true);
    }
  };

  const handleEscalateToCSKH = (orderId) => {
    addNotification(`Đã gửi thông báo khẩn đến bộ phận CSKH để liên hệ hỗ trợ cứu đơn hàng #${orderId}!`, 'info', '/admin/delivery?tab=active');
  };

  // Opens the photo-proof modal instead of returning the order immediately —
  // triggered by OrderCard's "Hoàn Kho" button, which now passes the full
  // order object (not just its id) so the modal has customer/order context.
  const handleForceReturnToWarehouse = (ord) => {
    setReturnModal(ord);
  };

  const handleConfirmReturn = async (payload) => {
    if (!returnModal) return;
    const orderId = returnModal.orderId || returnModal.id;
    const extra = {
      isAwaitingCallback: false,
      failReason: returnModal.failReason || 'Khách từ chối nhận - Chuyển hoàn về kho',
      failNote: returnModal.failNote || '',
      returnReason: 'Khách từ chối nhận - Chuyển hoàn về kho',
      ...payload
    };
    setApiOrders(prev => prev.map(o => (String(o.orderId || o.id) === String(orderId) ? { ...o, status: 'RETURNING_TO_WAREHOUSE', ...extra } : o)));
    setReturnModal(null);
    try {
      await updateOrderStatus(orderId, 'RETURNING_TO_WAREHOUSE', extra);
      setIncidentFilter('ALL');
      addNotification(`Đơn hàng #${orderId} đã được chuyển sang trạng thái "Đang Chuyển Hoàn Về Kho". Vui lòng bàn giao kiện hàng cho Thủ kho.`, 'warning', '/admin/delivery?tab=active');
    } catch (err) {
      addNotification(`Lỗi hoàn kho đơn #${orderId}: ${err.message}`, 'error');
    } finally {
      fetchApiData(true);
    }
  };

  const handleRedeliver = async (orderId) => {
    setApiOrders(prev => prev.map(o => (String(o.orderId || o.id) === String(orderId) ? { ...o, status: 'SHIPPED' } : o)));
    try {
      await updateOrderStatus(orderId, 'SHIPPED');
      addNotification(`Đã chuyển đơn #${orderId} lại trạng thái đang giao`, 'info');
    } catch (err) {
      addNotification(`Lỗi chuyển đơn #${orderId}: ${err.message}`, 'error');
    } finally {
      fetchApiData(true);
    }
  };

  const handleReturnPickedUp = async (ret) => {
    if (!isManagerOrAdmin) {
      const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(ret.orderId));
      if (matchedOrder && !isShipperMatched(matchedOrder)) {
        notify(`Chỉ Shipper đã trực tiếp giao đơn #${ret.orderId} (${matchedOrder.assignedShipperName || matchedOrder.assignedShipper}) mới có quyền thu hồi đơn này!`, 'error');
        return;
      }
    }
    try {
      await updateReturnStatus(ret.id, 'RETURNING_TO_WAREHOUSE', { note: `Shipper ${user?.fullname || user?.username} đã lấy hàng tại nhà khách` });
      setApiReturns(prev => prev.map(item => item.id === ret.id ? { ...item, status: 'RETURNING_TO_WAREHOUSE' } : item));
      addNotification('Đã xác nhận thu hồi kiện hàng từ khách! Đang vận chuyển về kho.', 'success');
    } catch (err) {
      addNotification(`Không thể xác nhận thu hồi: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    }
  };

  const handleReturnDeliveredToWarehouse = async (ret) => {
    if (!isManagerOrAdmin) {
      const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(ret.orderId));
      if (matchedOrder && !isShipperMatched(matchedOrder)) {
        notify(`Chỉ Shipper đã trực tiếp giao đơn #${ret.orderId} mới có quyền bàn giao kiện hàng về kho!`, 'error');
        return;
      }
    }
    try {
      await updateReturnStatus(ret.id, 'DELIVERED_TO_WAREHOUSE', { note: `Shipper ${user?.fullname || user?.username} đã bàn giao kiện hàng về kho cho QC` });
      setApiReturns(prev => prev.map(item => item.id === ret.id ? { ...item, status: 'DELIVERED_TO_WAREHOUSE' } : item));
      addNotification('Đã bàn giao kiện hàng về kho thành công! Chờ QC kiểm định.', 'success');
    } catch (err) {
      addNotification(`Không thể bàn giao: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    }
  };

  const actions = {
    onClaim: handleClaimOrder,
    onDeliver: setDeliverModal,
    onFail: setFailModal,
    onResume: handleResumeDelivery,
    onForceReturn: handleForceReturnToWarehouse,
    onEscalate: handleEscalateToCSKH,
    onRedeliver: handleRedeliver
  };

  const filterState = {
    search, setSearch,
    regionFilter, setRegionFilter,
    paymentFilter, setPaymentFilter,
    incidentFilter, setIncidentFilter,
    dateFilterPeriod, setDateFilterPeriod,
    customStartDate, setCustomStartDate,
    customEndDate, setCustomEndDate,
    sortOrder, setSortOrder
  };

  const commonTabProps = {
    fmt,
    getOrderTimeClassification,
    onOpenDetail: setSelectedOrder,
    actions,
    pullHandlers,
    isRefreshing,
    pullDistance
  };

  return (
    <div>
      {activeTab === 'overview' && (
        <OverviewTab
          fmt={fmt}
          orders={orders}
          pendingReturns={pendingReturns}
          readyCount={readyCount}
          activeCount={activeCount}
          doneCount={doneCount}
          failedCount={failedCount}
          countAwaiting={countAwaiting}
          totalCodCollected={totalCodCollected}
          onClaim={handleClaimOrder}
          onGoToReturns={() => setTab('returns')}
        />
      )}

      {activeTab === 'pending' && (
        <PendingTab
          {...commonTabProps}
          orders={filteredOrders}
          search={search}
          setSearch={setSearch}
          onGoToActive={() => setTab('active')}
        />
      )}

      {activeTab === 'active' && (
        <ActiveTab
          {...commonTabProps}
          orders={filteredOrders}
          filterState={filterState}
          activeOrdersList={activeOrdersList}
          todayCount={todayCount}
          newCount={newCount}
          backlogCount={backlogCount}
          countShipping={countShipping}
          countAwaiting={countAwaiting}
          countRescheduled={countRescheduled}
          countRejected={countRejected}
          countReturning={countReturning}
          doneCount={doneCount}
          onGoToPending={() => setTab('pending')}
        />
      )}

      {activeTab === 'returns' && (
        <ReturnsTab
          fmt={fmt}
          orders={orders}
          pendingReturns={pendingReturns}
          rmaSearch={rmaSearch}
          setRmaSearch={setRmaSearch}
          rmaDateFilter={rmaDateFilter}
          setRmaDateFilter={setRmaDateFilter}
          rmaCustomStartDate={rmaCustomStartDate}
          setRmaCustomStartDate={setRmaCustomStartDate}
          rmaCustomEndDate={rmaCustomEndDate}
          setRmaCustomEndDate={setRmaCustomEndDate}
          rmaStatusFilter={rmaStatusFilter}
          setRmaStatusFilter={setRmaStatusFilter}
          onPickup={handleReturnPickedUp}
          onDeliverWarehouse={handleReturnDeliveredToWarehouse}
          pullHandlers={pullHandlers}
          isRefreshing={isRefreshing}
          pullDistance={pullDistance}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          {...commonTabProps}
          orders={filteredOrders}
          filterState={filterState}
          totalCodCollected={totalCodCollected}
        />
      )}

      {deliverModal && (
        <PODModal
          order={deliverModal}
          user={user}
          fmt={fmt}
          onClose={() => setDeliverModal(null)}
          onConfirm={handleConfirmDelivered}
        />
      )}

      {failModal && (
        <FailModal
          order={failModal}
          onClose={() => setFailModal(null)}
          onConfirm={handleFailDelivery}
        />
      )}

      {returnModal && (
        <ReturnProofModal
          order={returnModal}
          onClose={() => setReturnModal(null)}
          onConfirm={handleConfirmReturn}
        />
      )}

      {selectedOrder && (
        <OrderDetailSheet
          order={selectedOrder}
          fmt={fmt}
          onClose={() => setSelectedOrder(null)}
          actions={{
            onDeliver: setDeliverModal,
            onFail: setFailModal
          }}
        />
      )}
    </div>
  );
}
