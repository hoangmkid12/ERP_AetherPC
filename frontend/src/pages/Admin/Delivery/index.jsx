import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSalesStore } from '../../../stores';
import { useAuth } from '../../../context/AuthContext';
import { useNotification, notify } from '../../../context/NotificationContext';
import { api } from '../../../services/api';
import { detectDeliveryRegion, REGION_COORDS } from '../../../utils/deliveryRegions';
import { fetchRoadRoute, sampleRoutePoints } from '../../../utils/routingService';

import OverviewTab from './OverviewTab';
import PendingTab from './PendingTab';
import ActiveTab from './ActiveTab';
import ReturnsTab from './ReturnsTab';
import HistoryTab from './HistoryTab';
import PODModal from './components/PODModal';
import FailModal from './components/FailModal';
import QuickFailSheet from './components/QuickFailSheet';
import ReturnProofModal from './components/ReturnProofModal';
import OrderDetailSheet from './components/OrderDetailSheet';
import DeliveryNavigationModal from './components/DeliveryNavigationModal';
import RejectAssignmentSheet from './components/RejectAssignmentSheet';
import NextOrderPromptModal from './components/NextOrderPromptModal';
import { getDeliveryIncidentStatus, getDefaultDateFilter, matchesDateFilter, getOrderDateTime, getDateFilterLabel, isOrderRedelivery } from './deliveryHelpers';

// Refetch orders/returns while the tab is visible, paused otherwise.
const POLL_INTERVAL_MS = 35000;

export default function Delivery() {
  const contextOrders = useSalesStore(state => state.orders) || [];
  const returnRequests = useSalesStore(state => state.returnRequests) || [];
  const getReturnRequests = useSalesStore(state => state.getReturnRequests);
  const updateOrderStatus = useSalesStore(state => state.updateOrderStatus);
  const claimOrderForDelivery = useSalesStore(state => state.claimOrderForDelivery);
  const rejectAssignment = useSalesStore(state => state.rejectAssignment);
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
  // Mặc định lọc đơn hàng là ngày realtime (Hôm nay)
  const [orderDateFilter, setOrderDateFilter] = useState(getDefaultDateFilter);
  const [sortOrder, setSortOrder] = useState('NEWEST');
  const [selectedOrder, setSelectedOrder] = useState(null);

  // RMA Pickup Tab Filters State (Mặc định lọc trả hàng là ngày realtime Hôm nay)
  const [rmaSearch, setRmaSearch] = useState('');
  const [rmaDateFilter, setRmaDateFilter] = useState(getDefaultDateFilter);
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
  // Quick 1-tap fail reason sheet (from the consolidated "Bắt Đầu Giao" screen)
  const [quickFailOrder, setQuickFailOrder] = useState(null);
  // Proof of Delivery Modal State
  const [deliverModal, setDeliverModal] = useState(null);
  // Return-to-Warehouse Photo Proof Modal State
  const [returnModal, setReturnModal] = useState(null);
  // Reject-pending-assignment reason sheet (tab "Chờ Nhận")
  const [rejectAssignmentOrder, setRejectAssignmentOrder] = useState(null);

  const isManagerOrAdmin = ['CEO', 'ADMIN', 'WAREHOUSE_MANAGER', 'SALES_MANAGER'].includes(user?.role);
  const userIdStr = String(user?.id || user?.username || '');

  const fmt = (num) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);

  const uName = String(user?.fullname || user?.name || '').toLowerCase();
  const uUser = String(user?.username || '').toLowerCase();
  const uPhone = String(user?.phone || '').replace(/\D/g, '');
  const shipperRegion = user?.deliveryRegion || 'HCM_KV1';

  // Đơn TÔI vừa bấm "Từ Chối" không được rơi lại vào pool tự nhận theo khu vực
  // của chính mình — assignedShipperId bị gỡ về null sau khi từ chối, và
  // nhánh dự phòng theo khu vực bên dưới sẽ khớp lại NGAY chính shipper vừa
  // từ chối (vì Kho vốn đã gán đúng khu vực của họ), khiến nút Từ Chối trông
  // như vô tác dụng. Không có cột DB nào lưu "đã từng bị ai từ chối" (schema
  // không có), nên ghi nhận tạm theo thiết bị — giống cách file này đã dùng
  // localStorage cho các state theo-shipper khác (VD aether_active_gps_order_id).
  // Nếu Kho chủ động gán lại đúng shipper này, isDirectlyAssigned ở trên sẽ
  // luôn thắng trước khi chạm tới danh sách loại trừ này.
  const REJECTED_ASSIGNMENTS_KEY = `aether_rejected_assignments_${userIdStr}`;
  const getRejectedAssignmentIds = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(REJECTED_ASSIGNMENTS_KEY) || '[]'));
    } catch (_) { return new Set(); }
  };

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

    const orderIdStr = String(o.orderId || o.id || '');
    if (orderIdStr && getRejectedAssignmentIds().has(orderIdStr)) return false;

    if (shipperRegion === 'ALL') return true;
    const orderRegion = o.deliveryRegion || detectDeliveryRegion(o.shippingAddress || o.address || '');
    return orderRegion === shipperRegion;
  };

  const getOrderTimeClassification = (ord) => {
    const isRedeliv = isOrderRedelivery(ord);
    const dateVal = (isRedeliv && ord.resumedAt)
      ? ord.resumedAt
      : (ord.deliveredAt || ord.shippedAt || ord.updatedAt || ord.createdAt || ord.packedAt || ord.date);
    if (!dateVal) return { isToday: false, isNew: false, isBacklog: true, isRedelivery: false, label: 'Đơn Cũ' };
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return { isToday: false, isNew: false, isBacklog: true, isRedelivery: false, label: 'Đơn Cũ' };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

    const isToday = d >= startOfToday && d <= endOfToday;
    const isNew = isToday && diffHours <= 3 && !isRedeliv;
    const isBacklog = !isToday && d < startOfToday;

    return {
      isToday,
      isNew,
      isBacklog,
      isRedelivery: isRedeliv,
      dateObj: d,
      formatted: d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const myDeliveryOrders = orders.filter(o =>
    o && ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE', 'CANCELLED', 'CONFIRMED'].includes(o.status)
  );

  const readyCount = myDeliveryOrders.filter(o => o.status === 'READY_TO_SHIP' && isShipperMatched(o)).length;
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
    const isRmaStatus = ['PENDING', 'RETURN_APPROVED', 'RETURNING_TO_WAREHOUSE', 'RETURN_REQUESTED', 'DELIVERED_TO_WAREHOUSE', 'PROCESSING', 'REJECTED', 'RETURNING_TO_CUSTOMER', 'RETURNED_TO_CUSTOMER'].includes(r.status);
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

      const ordDate = getOrderDateTime(o);
      // Khi chọn xem "Đơn Tồn" (BACKLOG), không ép lọc theo ngày hiện tại để người dùng xem được danh sách đơn cũ
      if (incidentFilter !== 'BACKLOG') {
        if (!matchesDateFilter(ordDate, orderDateFilter)) return false;
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
  }, [myDeliveryOrders, search, regionFilter, paymentFilter, incidentFilter, orderDateFilter, sortOrder, activeTab, userIdStr, isManagerOrAdmin, user]);

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

  const handleConfirmDelivered = async (ord, payload) => {
    if (!ord) return;
    const ordId = ord.orderId || ord.id;
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
    // Tự động tắt phát GPS cho đơn này khi đã giao xong
    if (gpsOrderId === String(ordId)) stopGps();

    try {
      await updateOrderStatus(ordId, 'DELIVERED', payload);
      addNotification(`Đơn hàng #${ordId} giao thành công! Hình thức thanh toán: [${payLabel}], Người nhận: [${payload.receiverNameActual}].`, 'success', '/admin/delivery?tab=history');
    } catch (err) {
      addNotification(`Lỗi cập nhật trạng thái đơn #${ordId}: ${err.message}`, 'error');
    } finally {
      fetchApiData(true);
    }
  };

  const handleFailDelivery = async (ord, payload) => {
    if (!ord) return;
    const ordId = ord.orderId || ord.id;

    if (gpsOrderId === String(ordId)) stopGps();

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
    setQuickFailOrder(null);

    try {
      await updateOrderStatus(ordId, 'SHIPPING_FAILED', payload);
      if (payload.isAwaitingCallback) {
        // Hệ thống KHÔNG có job nào tự động hoàn kho sau 24h — đơn sẽ treo mãi
        // ở "Chờ Gọi Lại" nếu Shipper không tự bấm "Khách Đã Gọi Lại" hoặc
        // "Hoàn Kho" thủ công. Trước đây thông báo hứa hẹn sai là hệ thống tự
        // làm việc này, khiến Shipper chủ quan bỏ quên đơn.
        addNotification(`Đã đưa đơn #${ordId} vào danh sách "Chờ khách gọi lại (24h)". Lưu ý: bạn cần tự xử lý (gọi lại hoặc bấm Hoàn Kho) — hệ thống KHÔNG tự động hoàn kho.`, 'warning', '/admin/delivery?tab=active');
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
    const matched = (orders || []).find(o => String(o.orderId || o.id) === String(orderId));
    const nowIso = new Date().toISOString();
    const existingNotes = matched?.notes || '';
    const updatedNotes = existingNotes.includes('[GIAO_LAI]') ? existingNotes : `${existingNotes ? existingNotes + ' ' : ''}[GIAO_LAI]`;

    const extra = {
      isAwaitingCallback: false,
      failReason: '',
      failNote: '',
      resumedAt: nowIso,
      shippedAt: nowIso,
      notes: updatedNotes,
      isRedelivery: true
    };
    setApiOrders(prev => prev.map(o => (String(o.orderId || o.id) === String(orderId) ? { ...o, status: 'SHIPPED', ...extra } : o)));
    try {
      await updateOrderStatus(orderId, 'SHIPPED', extra);
      setIncidentFilter('ALL');
      addNotification(`Đơn #${orderId} đã được chuyển vào ca giao hôm nay! Đơn đã sẵn sàng để tối ưu lộ trình và đi giao.`, 'success', '/admin/delivery?tab=active');
    } catch (err) {
      addNotification(`Lỗi kích hoạt lại đơn #${orderId}: ${err.message}`, 'error');
    } finally {
      fetchApiData(true);
    }
  };

  // Trước đây nút "Báo CSKH" chỉ hiện toast cục bộ trên máy Shipper, không hề
  // gọi API hay báo thật cho CSKH nào — tạo hẳn 1 phiên chat CSKH thật (cùng
  // API/hạ tầng websocket mà 1 khách vãng lai dùng để chat vào), hiện ngay
  // trong danh sách phiên của nhân viên CSKH đang trực để họ chủ động liên hệ.
  const handleEscalateToCSKH = async (orderId) => {
    const shipperName = user?.fullname || user?.name || user?.username || 'Shipper';
    const sessionId = `SHIPPER-ESCALATE-${orderId}-${Date.now()}`;
    try {
      await api.post('/chat/cskh/send', {
        sessionId,
        customerName: `⚠️ Shipper ${shipperName} báo sự cố đơn #${orderId}`,
        text: `Đơn hàng #${orderId} đang gặp sự cố giao hàng (khách từ chối nhận / không liên lạc được), cần CSKH hỗ trợ liên hệ khách gấp.`
      });
      addNotification(`Đã gửi yêu cầu hỗ trợ tới CSKH cho đơn #${orderId} — CSKH sẽ liên hệ qua khung chat hỗ trợ.`, 'success', '/admin/delivery?tab=active');
    } catch (err) {
      addNotification(`Không gửi được yêu cầu hỗ trợ CSKH: ${err.message}`, 'error');
    }
  };

  const handleOpenRejectAssignment = (ord) => {
    setRejectAssignmentOrder(ord);
  };

  const handleConfirmRejectAssignment = async (reason) => {
    if (!rejectAssignmentOrder) return;
    const ordId = rejectAssignmentOrder.orderId || rejectAssignmentOrder.id;
    setRejectAssignmentOrder(null);
    setApiOrders(prev => prev.map(o => (String(o.orderId || o.id) === String(ordId) ? { ...o, assignedShipperId: null, assignedShipperName: null } : o)));
    try {
      const ids = JSON.parse(localStorage.getItem(REJECTED_ASSIGNMENTS_KEY) || '[]');
      if (!ids.includes(String(ordId))) {
        ids.push(String(ordId));
        localStorage.setItem(REJECTED_ASSIGNMENTS_KEY, JSON.stringify(ids));
      }
    } catch (_) {}
    try {
      const result = await rejectAssignment(ordId, user, reason);
      if (result?.success) {
        addNotification(`Đã từ chối đơn #${ordId}. Kho sẽ phân công lại cho shipper khác.`, 'info');
      } else {
        addNotification(result?.message || `Không thể từ chối đơn #${ordId}.`, 'error');
      }
    } catch (err) {
      addNotification(`Lỗi từ chối đơn #${ordId}: ${err.message}`, 'error');
    } finally {
      fetchApiData(true);
    }
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
    const matched = (orders || []).find(o => String(o.orderId || o.id) === String(orderId));
    const nowIso = new Date().toISOString();
    const existingNotes = matched?.notes || '';
    const updatedNotes = existingNotes.includes('[GIAO_LAI]') ? existingNotes : `${existingNotes ? existingNotes + ' ' : ''}[GIAO_LAI]`;

    const extra = {
      resumedAt: nowIso,
      shippedAt: nowIso,
      notes: updatedNotes,
      isRedelivery: true
    };
    setApiOrders(prev => prev.map(o => (String(o.orderId || o.id) === String(orderId) ? { ...o, status: 'SHIPPED', ...extra } : o)));
    try {
      await updateOrderStatus(orderId, 'SHIPPED', extra);
      addNotification(`Đã chuyển đơn #${orderId} vào ca giao hôm nay để tối ưu lộ trình`, 'info');
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

  const handleRedeliverPickup = async (ret) => {
    if (!isManagerOrAdmin) {
      const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(ret.orderId));
      if (matchedOrder && !isShipperMatched(matchedOrder)) {
        notify(`Chỉ Shipper phụ trách đơn #${ret.orderId} mới có quyền nhận hàng trả lại cho khách!`, 'error');
        return;
      }
    }
    try {
      await updateReturnStatus(ret.id, 'RETURNING_TO_CUSTOMER', {
        note: `Shipper ${user?.fullname || user?.username} đã nhận kiện hàng bị QC từ chối từ kho, đang vận chuyển trả khách.`
      });
      setApiReturns(prev => prev.map(item => item.id === ret.id ? { ...item, status: 'RETURNING_TO_CUSTOMER' } : item));
      addNotification('Đã nhận hàng từ kho! Đang trên đường giao trả cho khách hàng.', 'success');
    } catch (err) {
      addNotification(`Không thể nhận hàng trả: ${err.message || 'lỗi kết nối'}.`, 'error');
    }
  };

  const handleRedeliverComplete = async (ret) => {
    if (!isManagerOrAdmin) {
      const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(ret.orderId));
      if (matchedOrder && !isShipperMatched(matchedOrder)) {
        notify(`Chỉ Shipper phụ trách đơn #${ret.orderId} mới có quyền xác nhận hoàn trả!`, 'error');
        return;
      }
    }
    try {
      await updateReturnStatus(ret.id, 'RETURNED_TO_CUSTOMER', {
        note: `Shipper ${user?.fullname || user?.username} đã giao trả kiện hàng bị từ chối tận tay khách hàng thành công.`
      });
      setApiReturns(prev => prev.map(item => item.id === ret.id ? { ...item, status: 'RETURNED_TO_CUSTOMER' } : item));
      addNotification('Đã xác nhận hoàn trả kiện hàng cho khách thành công!', 'success');
    } catch (err) {
      addNotification(`Không thể cập nhật hoàn trả: ${err.message || 'lỗi kết nối'}.`, 'error');
    }
  };

  // ─── Live GPS Tracking (Shipper phát vị trí cho Khách hàng theo dõi) ───
  const [gpsOrderId, setGpsOrderId] = useState(() => {
    try {
      return localStorage.getItem('aether_active_gps_order_id') || null;
    } catch (_) {
      return null;
    }
  });
  const [simulatingOrderId, setSimulatingOrderId] = useState(null);
  const [navigationModalOrder, setNavigationModalOrder] = useState(null);
  const [optimizedRouteQueue, setOptimizedRouteQueue] = useState(null); // null | [{orderId, ...}]
  const [currentRouteOrigin, setCurrentRouteOrigin] = useState(null); // null | { originMode: 'gps'|'manual'|'warehouse', originCoord: {lat, lng, name, address} }
  const [nextRouteOrderPrompt, setNextRouteOrderPrompt] = useState(null); // null | {deliveredOrder, nextOrder, remainingCount}
  // Màn hình "Bắt Đầu Giao" giờ hiện cùng lúc với thanh tab dưới cùng (không
  // còn là modal fixed che hết nữa) nên khi Shipper bấm sang tab khác (Tổng
  // Quan/Chờ Nhận/...) — đổi activeTab qua URL, xử lý ở DeliveryAppShell,
  // không có quyền truy cập state này — phải tự đóng màn hình lại để thật
  // sự chuyển tab, tránh tình trạng bấm tab không có tác dụng gì.
  const prevActiveTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevActiveTabRef.current !== activeTab) {
      prevActiveTabRef.current = activeTab;
      setNavigationModalOrder(null);
    }
  }, [activeTab]);

  // Khi Shipper bấm "Bắt đầu ca giao" từ RouteOptimizerPanel,
  // mở ngay DeliveryNavigationModal cho đơn đầu tiên và lưu hàng đợi các đơn còn lại kèm thông tin điểm xuất phát.
  const handleStartOptimized = (optimizedRoute, originInfo = null) => {
    if (!optimizedRoute || optimizedRoute.length === 0) return;
    setOptimizedRouteQueue(optimizedRoute);
    if (originInfo) {
      setCurrentRouteOrigin(originInfo);
    }
    // Tìm object đơn hàng đầu tiên trong orders thực tế (có đủ fields để render modal)
    const firstStop = optimizedRoute[0];
    const firstOrder = orders.find(o => (o.orderId || o.id) === firstStop.orderId);
    if (firstOrder) {
      setNavigationModalOrder(firstOrder);
    }
  };
  const gpsSocketRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastSentAtRef = useRef(0);
  const simulationTimerRef = useRef(null);

  const GPS_SEND_INTERVAL_MS = 8000;
  // 2 kho thật trong hệ thống (xem prisma/seed.js) — Hà Nội phục vụ khu vực
  // miền Bắc, còn lại xuất từ Kho Tổng TP.HCM.
  const getOriginForRegion = (region) => (region === 'HN_NORTH' ? { lat: 21.0139, lng: 105.8228 } : { lat: 10.7756, lng: 106.6919 });

  const openWsConnection = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return new WebSocket(`${wsProtocol}//${window.location.host}/ws/tracking`);
  };

  const closeGpsSocket = useCallback(() => {
    const ws = gpsSocketRef.current;
    if (ws) {
      try { ws.send(JSON.stringify({ type: 'SHIPPER_LEAVE_DELIVERY' })); } catch (_) { /* socket already closing */ }
      ws.close();
      gpsSocketRef.current = null;
    }
  }, []);

  const stopGps = useCallback(() => {
    try {
      localStorage.removeItem('aether_active_gps_order_id');
      localStorage.removeItem('aether_active_gps_start_time');
    } catch (_) {}
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    closeGpsSocket();
    setGpsOrderId(null);
  }, [closeGpsSocket]);

  const sendLocation = (orderId, coords) => {
    const payload = {
      orderId,
      lat: coords.lat,
      lng: coords.lng,
      speed: coords.speed ?? null,
      heading: coords.heading ?? null,
      originType: currentRouteOrigin?.originMode || 'warehouse',
      originCoord: currentRouteOrigin?.originCoord || null
    };
    const ws = gpsSocketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SHIPPER_UPDATE_LOCATION', payload }));
    } else {
      // Fallback HTTP khi WebSocket rớt mạng giữa chừng — không được để mất
      // tín hiệu chỉ vì 1 lần mất kết nối tạm thời trên đường đi giao.
      api.post(`/orders/${orderId}/location`, payload).catch(() => {});
    }
  };

  const startGps = (orderId, initialCoords = null, isSilent = false, originType = 'warehouse') => {
    if (!navigator.geolocation) {
      if (!isSilent) addNotification('Trình duyệt này không hỗ trợ định vị GPS.', 'error');
      return;
    }
    try {
      localStorage.setItem('aether_active_gps_order_id', String(orderId));
      localStorage.setItem('aether_active_gps_start_time', String(Date.now()));
    } catch (_) {}

    const ws = openWsConnection();
    gpsSocketRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'SHIPPER_JOIN_DELIVERY',
        payload: {
          orderId,
          originType: originType || currentRouteOrigin?.originMode || 'warehouse',
          originCoord: initialCoords || currentRouteOrigin?.originCoord || null
        }
      }));
    };
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'ERROR') {
          if (!isSilent) addNotification(data.message || 'Lỗi phát vị trí GPS.', 'error');
          if (data.message && (data.message.includes('không phải Shipper') || data.message.includes('Không tìm thấy'))) {
            stopGps();
          }
        } else if (data.type === 'SHIPPER_JOIN_ACK') {
          if (initialCoords && typeof initialCoords.lat === 'number') {
            sendLocation(orderId, initialCoords);
          }
        }
      } catch (_) { /* ignore malformed frame */ }
    };

    // Gửi ngay lập tức toạ độ ban đầu nếu có (không đợi chu kỳ 8s)
    if (initialCoords && typeof initialCoords.lat === 'number') {
      sendLocation(orderId, initialCoords);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed, heading: pos.coords.heading };
          lastSentAtRef.current = Date.now();
          sendLocation(orderId, coords);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }

    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentAtRef.current < GPS_SEND_INTERVAL_MS) return;
        lastSentAtRef.current = now;
        sendLocation(orderId, { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed, heading: pos.coords.heading });
      },
      (err) => {
        if (!isSilent) addNotification(`Không thể lấy vị trí GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    setGpsOrderId(String(orderId));
  };

  const handleToggleGPS = (ord) => {
    const orderId = String(ord.orderId || ord.id);
    if (gpsOrderId === orderId) {
      stopGps();
      addNotification(`Đã dừng phát vị trí GPS cho đơn #${orderId}.`, 'info');
      return;
    }
    if (gpsOrderId) stopGps();
    if (simulatingOrderId) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
      setSimulatingOrderId(null);
    }
    startGps(orderId);
    addNotification(`Đã bật định vị GPS cho đơn #${orderId}. Khách hàng có thể theo dõi trực tiếp.`, 'success');
  };

  // Demo Giả Lập — Di chuyển uốn lượn mượt mà theo đúng các tuyến phố thực tế (OSRM Road Routing)
  // phục vụ thuyết trình/bảo vệ KLTN trong phòng kín không có GPS thật.
  const handleSimulate = async (ord) => {
    const orderId = String(ord.orderId || ord.id);
    if (simulatingOrderId === orderId) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
      setSimulatingOrderId(null);
      closeGpsSocket();
      addNotification(`Đã dừng giả lập đơn #${orderId}.`, 'info');
      return;
    }
    if (gpsOrderId) stopGps();
    if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);

    const region = ord.deliveryRegion || detectDeliveryRegion(ord.shippingAddress || ord.address || '');
    const from = getOriginForRegion(region);
    const to = REGION_COORDS[region] || REGION_COORDS.ALL;

    setSimulatingOrderId(orderId);
    addNotification(`Đang tính toán tuyến đường phố thực tế cho đơn #${orderId}...`, 'info');

    // Tải tuyến đường thực tế qua các góc phố
    const route = await fetchRoadRoute(from, to);
    let roadPoints = [];
    if (route && route.coordinates && route.coordinates.length > 0) {
      roadPoints = sampleRoutePoints(route.coordinates, 35);
    } else {
      // Fallback nếu không có mạng
      roadPoints = Array.from({ length: 30 }, (_, i) => {
        const t = i / 29;
        return [from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t];
      });
    }

    const ws = openWsConnection();
    gpsSocketRef.current = ws;

    const startRun = () => {
      ws.send(JSON.stringify({ type: 'SHIPPER_JOIN_DELIVERY', payload: { orderId } }));

      // Phát ngay điểm xuất phát tại Kho
      const [startLat, startLng] = roadPoints[0];
      ws.send(JSON.stringify({
        type: 'SHIPPER_UPDATE_LOCATION',
        payload: { orderId, lat: startLat, lng: startLng, speed: 25.0, heading: 45 }
      }));

      let idx = 0;
      addNotification(`Bắt đầu giả lập lộ trình đường bộ (${route?.distanceKm || '5.3'} km)...`, 'success');

      simulationTimerRef.current = setInterval(() => {
        idx += 1;
        if (idx < roadPoints.length) {
          const [lat, lng] = roadPoints[idx];
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'SHIPPER_UPDATE_LOCATION',
              payload: { orderId, lat, lng, speed: 28.5, heading: 90 }
            }));
          }
        } else {
          clearInterval(simulationTimerRef.current);
          simulationTimerRef.current = null;
          setSimulatingOrderId(null);
          ws.close();
          if (gpsSocketRef.current === ws) gpsSocketRef.current = null;
          addNotification(`Giả lập giao hàng đơn #${orderId} đã đến đích an toàn!`, 'success');
        }
      }, 1200);
    };

    if (ws.readyState === WebSocket.OPEN) {
      startRun();
    } else {
      ws.onopen = startRun;
    }
  };

  // Tự động khôi phục phiên phát sóng GPS đang chạy dở khi Shipper F5 hoặc vào lại trang
  useEffect(() => {
    try {
      const savedOrderId = localStorage.getItem('aether_active_gps_order_id');
      if (savedOrderId && !watchIdRef.current) {
        startGps(savedOrderId, null, true);
      }
    } catch (_) {}

    return () => {
      if (watchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      closeGpsSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenNavigation = (ord) => {
    setNavigationModalOrder(ord);
  };

  const handleStartDeliveryWithGps = async (ord, initialCoords = null) => {
    const orderId = String(ord?.orderId || ord?.id || '');
    if (!orderId) return;
    if (gpsOrderId && gpsOrderId !== orderId) stopGps();
    const effectiveOriginCoord = initialCoords || currentRouteOrigin?.originCoord;
    const effectiveOriginMode = currentRouteOrigin?.originMode || (effectiveOriginCoord ? 'manual' : 'warehouse');
    const nowIso = new Date().toISOString();
    const payload = {
      status: 'SHIPPED',
      note: 'Shipper đã xuất phát giao hàng — Bật live GPS thời gian thực',
      shippedAt: nowIso
    };
    if (effectiveOriginCoord && typeof effectiveOriginCoord.lat === 'number') {
      payload.lat = effectiveOriginCoord.lat;
      payload.lng = effectiveOriginCoord.lng;
    }

    try {
      await updateOrderStatus(orderId, 'SHIPPED', payload);
      setApiOrders(prev => prev.map(o => String(o.orderId || o.id) === orderId ? {
        ...o,
        status: 'SHIPPED',
        shippedAt: o.shippedAt || nowIso,
        lastLat: payload.lat ?? o.lastLat,
        lastLng: payload.lng ?? o.lastLng,
        locationUpdatedAt: nowIso
      } : o));
    } catch (err) {
      console.warn('Lỗi cập nhật trạng thái đơn:', err.message);
    }

    // Nếu có tọa độ tức thời, bắn ngay lập tức tới endpoint REST fallback
    if (effectiveOriginCoord && typeof effectiveOriginCoord.lat === 'number') {
      api.post(`/orders/${orderId}/location`, {
        lat: effectiveOriginCoord.lat,
        lng: effectiveOriginCoord.lng,
        speed: effectiveOriginCoord.speed ?? null,
        heading: effectiveOriginCoord.heading ?? null,
        originType: effectiveOriginMode,
        originCoord: effectiveOriginCoord
      }).catch(() => {});
    }

    startGps(orderId, effectiveOriginCoord, false, effectiveOriginMode);
    addNotification(`Đã xác nhận bắt đầu giao đơn #${orderId}! GPS thực tế đang được phát sóng trực tiếp tới khách hàng.`, 'success');
  };

  const actions = {
    onClaim: handleClaimOrder,
    onRejectAssignment: handleOpenRejectAssignment,
    onDeliver: setDeliverModal,
    onFail: setFailModal,
    onResume: handleResumeDelivery,
    onForceReturn: handleForceReturnToWarehouse,
    onEscalate: handleEscalateToCSKH,
    onRedeliver: handleRedeliver,
    onToggleGPS: handleToggleGPS,
    onSimulate: handleSimulate,
    onOpenNavigation: handleOpenNavigation,
    onStartDeliveryWithGps: handleStartDeliveryWithGps
  };

  const filterState = {
    search, setSearch,
    regionFilter, setRegionFilter,
    paymentFilter, setPaymentFilter,
    incidentFilter, setIncidentFilter,
    orderDateFilter, setOrderDateFilter,
    dateFilterPeriod: orderDateFilter.period,
    setDateFilterPeriod: (p) => setOrderDateFilter(prev => ({ ...prev, period: p })),
    customStartDate: orderDateFilter.customStartDate,
    setCustomStartDate: (d) => setOrderDateFilter(prev => ({ ...prev, customStartDate: d })),
    customEndDate: orderDateFilter.customEndDate,
    setCustomEndDate: (d) => setOrderDateFilter(prev => ({ ...prev, customEndDate: d })),
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
      {/* Màn hình "Bắt Đầu Giao" gộp giờ render NGAY TRONG dòng chảy nội
          dung bình thường (thay cho modal toàn màn hình fixed trước đây)
          nên thay hẳn phần tab đang xem thay vì chồng lên nó — nhờ vậy
          thanh tab dưới cùng (Tổng Quan/Chờ Nhận/...) ở DeliveryAppShell
          luôn hiển thị (nó là sibling cố định bên ngoài `.delivery-content`,
          không còn bị modal che nữa) và toàn màn hình cuộn bằng đúng cơ chế
          cuộn trang vẫn dùng cho các tab khác. */}
      {navigationModalOrder ? (
        <DeliveryNavigationModal
          order={navigationModalOrder}
          user={user}
          warehouse={
            currentRouteOrigin?.originCoord?.lat && currentRouteOrigin?.originCoord?.lng
              ? currentRouteOrigin.originCoord
              : getOriginForRegion(navigationModalOrder.deliveryRegion || detectDeliveryRegion(navigationModalOrder.shippingAddress || navigationModalOrder.address || ''))
          }
          originType={currentRouteOrigin?.originMode || 'warehouse'}
          originCoord={currentRouteOrigin?.originCoord}
          destination={{
            ...(REGION_COORDS[navigationModalOrder.deliveryRegion || detectDeliveryRegion(navigationModalOrder.shippingAddress || navigationModalOrder.address || '')] || REGION_COORDS.ALL),
            label: navigationModalOrder.shippingAddress || navigationModalOrder.address || 'Địa chỉ nhận hàng'
          }}
          isGpsActive={gpsOrderId === String(navigationModalOrder.orderId || navigationModalOrder.id)}
          onStartDeliveryWithGps={handleStartDeliveryWithGps}
          onStopGps={stopGps}
          onConfirmDelivered={(payload) => {
            handleConfirmDelivered(navigationModalOrder, payload);

            // Nếu đang đi theo lộ trình tối ưu và còn đơn tiếp theo trong hàng đợi
            if (optimizedRouteQueue && optimizedRouteQueue.length > 1) {
              const currentId = String(navigationModalOrder.orderId || navigationModalOrder.id);
              const remainingQueue = optimizedRouteQueue.filter(item => String(item.orderId) !== currentId);
              setOptimizedRouteQueue(remainingQueue);

              const nextStop = remainingQueue[0];
              const nextOrder = orders.find(o => String(o.orderId || o.id) === String(nextStop?.orderId));

              if (nextOrder) {
                setNextRouteOrderPrompt({
                  deliveredOrder: navigationModalOrder,
                  nextOrder: nextOrder,
                  remainingCount: remainingQueue.length
                });
                setNavigationModalOrder(null);
                return;
              }
            }

            setOptimizedRouteQueue(null);
            setNavigationModalOrder(null);
          }}
          onReject={(ord) => {
            setNavigationModalOrder(null);
            setQuickFailOrder(ord);
          }}
          onClose={() => setNavigationModalOrder(null)}
          fmt={fmt}
        />
      ) : (
        <>
      {activeTab === 'overview' && (
        <OverviewTab
          fmt={fmt}
          orders={orders}
          myDeliveryOrders={myDeliveryOrders}
          pendingReturns={pendingReturns}
          isShipperMatched={isShipperMatched}
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
          gpsOrderId={gpsOrderId}
          simulatingOrderId={simulatingOrderId}
          onStartOptimized={handleStartOptimized}
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
          rmaStatusFilter={rmaStatusFilter}
          setRmaStatusFilter={setRmaStatusFilter}
          onPickup={handleReturnPickedUp}
          onDeliverWarehouse={handleReturnDeliveredToWarehouse}
          onRedeliverPickup={handleRedeliverPickup}
          onRedeliverComplete={handleRedeliverComplete}
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
        </>
      )}

      {deliverModal && (
        <PODModal
          order={deliverModal}
          user={user}
          fmt={fmt}
          onClose={() => setDeliverModal(null)}
          onConfirm={(payload) => { handleConfirmDelivered(deliverModal, payload); setDeliverModal(null); }}
        />
      )}

      {failModal && (
        <FailModal
          order={failModal}
          onClose={() => setFailModal(null)}
          onConfirm={(payload) => handleFailDelivery(failModal, payload)}
        />
      )}

      {quickFailOrder && (
        <QuickFailSheet
          order={quickFailOrder}
          onConfirm={(payload) => handleFailDelivery(quickFailOrder, payload)}
          onOpenFullFail={(ord) => { setQuickFailOrder(null); setFailModal(ord); }}
          onClose={() => setQuickFailOrder(null)}
        />
      )}

      {returnModal && (
        <ReturnProofModal
          order={returnModal}
          onClose={() => setReturnModal(null)}
          onConfirm={handleConfirmReturn}
        />
      )}

      {rejectAssignmentOrder && (
        <RejectAssignmentSheet
          order={rejectAssignmentOrder}
          onClose={() => setRejectAssignmentOrder(null)}
          onConfirm={handleConfirmRejectAssignment}
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

      {/* Modal chuyển tiếp mượt mà sang đơn tiếp theo theo lộ trình */}
      {nextRouteOrderPrompt && (
        <NextOrderPromptModal
          deliveredOrder={nextRouteOrderPrompt.deliveredOrder}
          nextOrder={nextRouteOrderPrompt.nextOrder}
          remainingCount={nextRouteOrderPrompt.remainingCount}
          onContinue={() => {
            setNavigationModalOrder(nextRouteOrderPrompt.nextOrder);
            setNextRouteOrderPrompt(null);
          }}
          onBackToList={() => {
            setNextRouteOrderPrompt(null);
            setOptimizedRouteQueue(null);
          }}
        />
      )}

    </div>
  );
}
