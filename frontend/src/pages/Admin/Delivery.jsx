import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSalesStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { useNotification, notify } from '../../context/NotificationContext';
import { api } from '../../services/api';
import { DELIVERY_REGIONS, detectDeliveryRegion } from '../../utils/deliveryRegions';
import ActorNotificationBar from '../../components/ActorNotificationBar';
import {
  Truck, Package, MapPin, Phone, User, CheckCircle, Clock,
  XCircle, Navigation, Search, BarChart2, AlertCircle, RefreshCw, Eye, X,
  Camera, Image, FileText, Calendar, Upload, DollarSign, Check, ChevronRight,
  TrendingUp, AlertTriangle, ShieldCheck, Award
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
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

const STATUS_MAP = {
  READY_TO_SHIP: { label: 'Chờ lấy hàng', color: '#f59e0b', bg: '#fffbeb' },
  SHIPPED: { label: 'Đang giao hàng', color: '#3b82f6', bg: '#eff6ff' },
  DELIVERED: { label: 'Đã giao thành công', color: '#16a34a', bg: '#f0fdf4' },
  SHIPPING_FAILED: { label: 'Giao thất bại / Hẹn lại', color: '#ef4444', bg: '#fef2f2' },
  CANCELLED: { label: 'Đã huỷ', color: '#64748b', bg: '#f8fafc' },
};

const FAIL_PRESETS = [
  'Khách không nghe máy (Gọi 3 lần)',
  'Khách hẹn lại ngày khác',
  'Địa chỉ sai / Không tìm thấy nhà',
  'Khách từ chối nhận hàng / Đổi ý',
  'Khách chưa chuẩn bị đủ tiền mặt',
  'Hàng bị hư hỏng / móp méo khi vận chuyển'
];

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

  // Camera Live Capture State
  const videoRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Fetch real-time orders & return requests from backend API
  useEffect(() => {
    let isMounted = true;
    const fetchApiData = async () => {
      try {
        setLoadingOrders(true);
        const [resOrders, resReturns] = await Promise.allSettled([
          api.get('/orders'),
          api.get('/orders/returns')
        ]);
        if (isMounted && resOrders.status === 'fulfilled' && resOrders.value?.data) {
          setApiOrders(resOrders.value.data);
        }
        if (isMounted && resReturns.status === 'fulfilled' && resReturns.value?.data) {
          setApiReturns(resReturns.value.data);
        }
      } catch (err) {
        console.warn('[Delivery] Error loading data from API, using fallback store:', err.message);
      } finally {
        if (isMounted) setLoadingOrders(false);
      }
    };
    fetchApiData();
    if (typeof getReturnRequests === 'function') {
      getReturnRequests();
    }
    return () => { isMounted = false; };
  }, []);

  // Merge orders from Context, LocalStorage and Backend API
  const orders = useMemo(() => {
    let localList = [];
    try {
      localList = JSON.parse(localStorage.getItem('erp_orders') || '[]');
    } catch (_) { }

    const map = new Map();
    // 1. Add context orders
    (contextOrders || []).forEach(o => {
      const key = String(o.orderId || o.id || '');
      if (key) map.set(key, o);
    });
    // 2. Add local storage orders
    localList.forEach(o => {
      const key = String(o.orderId || o.id || '');
      if (key) map.set(key, { ...map.get(key), ...o });
    });
    // 3. Add API backend orders
    (apiOrders || []).forEach(o => {
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
    // 1. Store returns
    (returnRequests || []).forEach(r => {
      const key = String(r.id || r.orderId || '');
      if (key) map.set(key, r);
    });
    // 2. Local storage returns
    localList.forEach(r => {
      const key = String(r.id || r.orderId || '');
      if (key) map.set(key, { ...map.get(key), ...r });
    });
    // 3. API backend returns
    (apiReturns || []).forEach(r => {
      const key = String(r.id || r.orderId || '');
      if (key) map.set(key, { ...map.get(key), ...r });
    });

    return Array.from(map.values());
  }, [returnRequests, apiReturns]);

  // Active Tab from URL (?tab=overview|pending|active|returns|history)
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab = (tKey) => {
    setSearchParams({ tab: tKey });
    setSearch('');
  };

  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL'); // ALL | HCM | PROVINCE
  const [paymentFilter, setPaymentFilter] = useState('ALL'); // ALL | COD | PREPAID
  const [incidentFilter, setIncidentFilter] = useState('ALL'); // ALL | SHIPPING | DELIVERED | AWAITING_CALLBACK | RESCHEDULED | REJECTED | RETURNING
  const [dateFilterPeriod, setDateFilterPeriod] = useState('ALL'); // ALL | TODAY | YESTERDAY | LAST_7_DAYS | LAST_30_DAYS | CUSTOM
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('NEWEST'); // NEWEST | OLDEST | COD_DESC | COD_ASC
  const [selectedOrder, setSelectedOrder] = useState(null);

  // RMA Pickup Tab Filters State
  const [rmaSearch, setRmaSearch] = useState('');
  const [rmaDateFilter, setRmaDateFilter] = useState('ALL'); // ALL | TODAY | YESTERDAY | LAST_7_DAYS | LAST_30_DAYS | CUSTOM
  const [rmaCustomStartDate, setRmaCustomStartDate] = useState('');
  const [rmaCustomEndDate, setRmaCustomEndDate] = useState('');
  const [rmaStatusFilter, setRmaStatusFilter] = useState('ALL'); // ALL | PENDING_PICKUP | RETURNING | DELIVERED_WAREHOUSE

  // Time & New Order Helper
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

    const isNew = diffMin <= 180; // Trong vòng 3 giờ được gắn nhãn ĐƠN MỚI
    return {
      formatted,
      isNew,
      diffMin,
      fullDate: `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${d.toLocaleDateString('vi-VN')}`
    };
  };

  // Delivery Failure Modal State
  const [failModal, setFailModal] = useState(null);
  const [failReason, setFailReason] = useState('');
  const [failNote, setFailNote] = useState('');

  // Proof of Delivery Modal State (POD)
  const [deliverModal, setDeliverModal] = useState(null);
  const [proofPhoto, setProofPhoto] = useState('');
  const [receiverNote, setReceiverNote] = useState('');
  const [actualPaymentMethod, setActualPaymentMethod] = useState('CASH'); // CASH | BANK_TRANSFER | PREPAID
  const [bankRefCode, setBankRefCode] = useState('');
  const [paymentProofPhoto, setPaymentProofPhoto] = useState('');
  const [receivedByType, setReceivedByType] = useState('DIRECT_CUSTOMER'); // DIRECT_CUSTOMER | REPRESENTATIVE
  const [receiverNameActual, setReceiverNameActual] = useState('');
  const [showVietQR, setShowVietQR] = useState(false);

  // Camera Management Functions
  const startCamera = async () => {
    try {
      setCameraError('');
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setCameraError('Không thể mở Camera thực tế (Trình duyệt chưa cấp quyền máy ảnh hoặc không có webcam).');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Real-time Clock State for Camera Timestamp
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Định dạng ngày giờ thực tế
      const now = new Date();
      const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const ordIdStr = deliverModal ? (deliverModal.orderId || deliverModal.id) : '';
      const shipperNameStr = user?.fullname || user?.name || 'Shipper';

      // 1. Vẽ khung thông tin nền tối tại GÓC DƯỚI BÊN TRÁI ảnh
      const stampText = `⏱ ${timeStr} | ${dateStr} | Đơn: #${ordIdStr} | NV: ${shipperNameStr}`;
      ctx.font = 'bold 13px sans-serif';
      const textWidth = ctx.measureText(stampText).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(10, canvas.height - 38, textWidth + 20, 28, 4) : ctx.fillRect(10, canvas.height - 38, textWidth + 20, 28);
      ctx.fill();

      // Viền xanh lá xác nhận hợp lệ
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Chữ trắng sắc nét
      ctx.fillStyle = '#ffffff';
      ctx.fillText(stampText, 18, canvas.height - 19);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setProofPhoto(dataUrl);
      stopCamera();
    }
  };

  // Tự động kích hoạt máy ảnh & khởi tạo trạng thái khi mở modal POD
  useEffect(() => {
    if (deliverModal) {
      const isPrepaid = deliverModal.paymentStatus === 'PAID' || deliverModal.paymentMethod === 'ONLINE_GATEWAY' || deliverModal.paymentMethod === 'BANK_TRANSFER' || (parseFloat(deliverModal.totalAmount || deliverModal.total || 0) === 0);
      setProofPhoto(deliverModal.proofPhoto || '');
      setReceiverNote(deliverModal.receiverNote || 'Khách đã đồng kiểm tem niêm phong và ký nhận đầy đủ.');
      setActualPaymentMethod(isPrepaid ? 'PREPAID' : (deliverModal.actualPaymentMethod || 'CASH'));
      setBankRefCode(deliverModal.bankRefCode || '');
      setPaymentProofPhoto(deliverModal.paymentProofPhoto || '');
      setReceivedByType(deliverModal.receivedByType || 'DIRECT_CUSTOMER');
      setReceiverNameActual(deliverModal.receiverNameActual || deliverModal.customerName || '');
      setShowVietQR(false);
      startCamera();
    } else {
      stopCamera();
    }
    return () => { stopCamera(); };
  }, [deliverModal]);

  const isManagerOrAdmin = ['CEO', 'ADMIN', 'WAREHOUSE_MANAGER', 'SALES_MANAGER'].includes(user?.role);
  const userIdStr = String(user?.id || user?.username || '');

  const fmt = (num) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);

  // Quản lý trạng thái Bật / Tắt nhận đơn của Shipper
  const getInitialShipperStatus = () => {
    try {
      const statuses = JSON.parse(localStorage.getItem('erp_shipper_statuses') || '{}');
      const uKey = user?.id || user?.username || 'shipper';
      if (statuses[uKey] !== undefined) return statuses[uKey];
      if (user?.fullname && statuses[user.fullname] !== undefined) return statuses[user.fullname];
    } catch (e) {}
    return { isOnline: true, reason: '' };
  };

  const [shipperStatus, setShipperStatus] = useState(getInitialShipperStatus);

  const toggleShipperStatus = (online, reason = '') => {
    const newStatus = { isOnline: online, reason: reason, updatedAt: new Date().toISOString() };
    setShipperStatus(newStatus);
    try {
      const statuses = JSON.parse(localStorage.getItem('erp_shipper_statuses') || '{}');
      const uKey = user?.id || user?.username || 'shipper';
      statuses[uKey] = newStatus;
      if (user?.fullname) statuses[user.fullname] = newStatus;
      if (user?.username) statuses[user.username] = newStatus;
      localStorage.setItem('erp_shipper_statuses', JSON.stringify(statuses));
    } catch (e) {}

    addNotification(
      online ? '🟢 Bạn đã BẬT trạng thái: Sẵn Sàng Nhận Đơn!' : '⛔ Bạn đã TẠM DỪNG nhận đơn hàng mới.',
      online ? 'success' : 'warning',
      '/admin/delivery'
    );
  };

  // KPI Calculations
  const myDeliveryOrders = orders.filter(o =>
    o && ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'SHIPPING_FAILED', 'CONFIRMED'].includes(o.status)
  );

  const uName = String(user?.fullname || user?.name || '').toLowerCase();
  const uUser = String(user?.username || '').toLowerCase();
  const uPhone = String(user?.phone || '').replace(/\D/g, '');

  const shipperRegion = user?.deliveryRegion || 'HCM_KV1';
  const shipperRegionObj = DELIVERY_REGIONS.find(r => r.code === shipperRegion) || DELIVERY_REGIONS[0];

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

    // If order was explicitly assigned to another person/shipper, hide it
    if (o.assignedShipperId || o.assignedShipper || o.assignedShipperUsername) return false;

    // For unassigned orders (READY_TO_SHIP), filter by shipper's assigned region
    if (shipperRegion === 'ALL') return true;
    const orderRegion = o.deliveryRegion || detectDeliveryRegion(o.shippingAddress || o.address || '');
    return orderRegion === shipperRegion;
  };

  // Helper phân loại đơn theo thời gian: Hôm Nay, Mới Nhận, Đơn Tồn
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
    const isNew = isToday && diffHours <= 3; // Trong vòng 3 tiếng hôm nay
    const isBacklog = d < startOfToday; // Đơn từ các ngày trước đó

    return {
      isToday,
      isNew,
      isBacklog,
      dateObj: d,
      formatted: d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const readyCount = myDeliveryOrders.filter(o => o.status === 'READY_TO_SHIP').length;
  const activeOrdersList = myDeliveryOrders.filter(o => ['SHIPPED', 'DELIVERED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE'].includes(o.status) && isShipperMatched(o));
  const activeCount = myDeliveryOrders.filter(o => ['SHIPPED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE'].includes(o.status) && isShipperMatched(o)).length;
  const doneCount = myDeliveryOrders.filter(o => o.status === 'DELIVERED' && isShipperMatched(o)).length;
  const failedCount = myDeliveryOrders.filter(o => (o.status === 'SHIPPING_FAILED' || o.status === 'RETURNING_TO_WAREHOUSE') && isShipperMatched(o)).length;

  // Time Specific Counts
  const todayCount = activeOrdersList.filter(o => getOrderTimeClassification(o).isToday).length;
  const newCount = activeOrdersList.filter(o => getOrderTimeClassification(o).isNew).length;
  const backlogCount = activeOrdersList.filter(o => getOrderTimeClassification(o).isBacklog).length;

  // Incident Specific Counts
  const countShipping = myDeliveryOrders.filter(o => o.status === 'SHIPPED' && !o.isAwaitingCallback && isShipperMatched(o)).length;
  const countAwaiting = myDeliveryOrders.filter(o => o.isAwaitingCallback && isShipperMatched(o)).length;
  const countRescheduled = myDeliveryOrders.filter(o => (o.failReason || '').includes('Khách hẹn') && isShipperMatched(o)).length;
  const countRejected = myDeliveryOrders.filter(o => ((o.failReason || '').includes('từ chối') || (o.failReason || '').includes('Bom hàng') || o.status === 'CANCELLED') && isShipperMatched(o)).length;
  const countReturning = myDeliveryOrders.filter(o => o.status === 'RETURNING_TO_WAREHOUSE' && isShipperMatched(o)).length;

  const totalCodCollected = myDeliveryOrders
    .filter(o => o.status === 'DELIVERED' && isShipperMatched(o))
    .reduce((sum, o) => sum + (o.paymentMethod === 'COD' || !o.paymentMethod ? (parseFloat(o.totalAmount || o.total || 0)) : 0), 0);

  const pendingReturns = allReturnRequests.filter(r => {
    const isRmaStatus = ['PENDING', 'RETURN_APPROVED', 'RETURNING_TO_WAREHOUSE', 'RETURN_REQUESTED', 'DELIVERED_TO_WAREHOUSE', 'PROCESSING'].includes(r.status);
    if (!isRmaStatus) return false;

    // Quản lý & Admin xem được tất cả
    if (isManagerOrAdmin) return true;

    // Tìm đơn hàng gốc
    const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(r.orderId));
    if (matchedOrder) {
      // Chỉ nhân viên đã giao / được phân công đơn hàng gốc này mới thấy & thu hồi
      return isShipperMatched(matchedOrder);
    }

    // Nếu đơn hàng lưu trực tiếp pickupShipperId
    if (r.pickupShipperId) {
      const pId = String(r.pickupShipperId).toLowerCase();
      return pId === userIdStr.toLowerCase() || pId === uUser || (user?.id && pId === String(user.id).toLowerCase());
    }

    return false;
  });

  const stats = [
    { label: 'Chờ Nhận Tại Kho', value: `${readyCount} đơn`, title: 'Chờ Nhận Tại Kho', val: readyCount, color: '#d97706', bg: '#fffbeb', change: 'Đơn sẵn sàng lấy', sub: 'Đơn sẵn sàng lấy', icon: <Package size={18} /> },
    { label: 'Đang Giao Trên Đường', value: `${activeCount} đơn`, title: 'Đang Giao Trên Đường', val: activeCount, color: '#2563eb', bg: '#eff6ff', change: 'Đang giữ đi giao', sub: 'Đang giữ đi giao', icon: <Truck size={18} /> },
    { label: 'Chờ Khách Gọi Lại 24h', value
      
      : `${countAwaiting} đơn`, title: 'Chờ Khách Gọi Lại 24h', val: countAwaiting, color: '#d97706', bg: '#fef3c7', change: 'Tạm giữ liên lạc', sub: 'Tạm giữ liên lạc', icon: <Clock size={18} /> },
    { label: 'Giao Thành Công (POD)', value: `${doneCount} đơn`, title: 'Giao Thành Công (POD)', val: doneCount, color: '#16a34a', bg: '#f0fdf4', change: 'Đã giao hoàn tất', sub: 'Đã giao hoàn tất', icon: <CheckCircle size={18} /> },
    { label: 'Sự Cố / Chuyển Hoàn', value: `${failedCount} đơn`, title: 'Sự Cố / Chuyển Hoàn', val: failedCount, color: '#ef4444', bg: '#fef2f2', change: 'Hẹn lại & hoàn kho', sub: 'Hẹn lại & hoàn kho', icon: <AlertTriangle size={18} /> },
    { label: 'Tổng Tiền Thu Hộ COD', value: fmt(totalCodCollected), title: 'Tổng Tiền Thu Hộ COD', val: fmt(totalCodCollected), color: '#059669', bg: '#ecfdf5', change: 'Cần nộp kế toán', sub: 'Cần nộp kế toán', icon: <Award size={18} /> }
  ];

  // Chart Data: Tỷ lệ hoàn thành giao hàng
  const deliveryRatioData = {
    labels: ['Giao thành công', 'Đang giao hàng', 'Chờ lấy hàng', 'Sự cố / Hoàn kho'],
    datasets: [
      {
        data: [
          Math.max(doneCount, 1),
          Math.max(activeCount, 0),
          Math.max(readyCount, 0),
          Math.max(failedCount, 0)
        ],
        backgroundColor: ['#16a34a', '#2563eb', '#f59e0b', '#ef4444'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  // Chart Data: Thu hộ COD theo ngày
  const dailyCodData = {
    labels: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'],
    datasets: [
      {
        label: 'Tiền thu hộ COD (Triệu VNĐ)',
        data: [12.5, 18.2, 15.0, 24.8, 21.0, 32.5, Math.max(Math.round(totalCodCollected / 1000000), 16)],
        backgroundColor: '#2563eb',
        borderRadius: 6
      }
    ]
  };

  // Chart Data Preparation (Delivery Performance)
  const chartData = {
    labels: ['Chờ Nhận', 'Đang Giao', 'Chờ Gọi 24h', 'Thành Công', 'Sự Cố'],
    datasets: [
      {
        label: 'Số Lượng Đơn',
        data: [readyCount, activeCount, countAwaiting, doneCount, failedCount],
        backgroundColor: ['#f59e0b', '#2563eb', '#d97706', '#16a34a', '#ef4444'],
        borderRadius: 4
      }
    ]
  };

  // Tab Filtering Orders with Region, Payment, Incident, Time Search & Sorting
  const filteredOrders = useMemo(() => {
    const uName = String(user?.fullname || user?.name || '').toLowerCase();
    const uUser = String(user?.username || '').toLowerCase();
    const uPhone = String(user?.phone || '').replace(/\D/g, '');

    const list = myDeliveryOrders.filter(o => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        o.orderId?.toLowerCase().includes(q) ||
        o.id?.toString().toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.phone?.includes(q) ||
        o.shippingAddress?.toLowerCase().includes(q);

      if (!matchSearch) return false;

      // Region Filter (HCM vs Tỉnh khác)
      const addr = (o.shippingAddress || '').toLowerCase();
      const isHCM = addr.includes('hồ chí minh') || addr.includes('hcm') || addr.includes('tp.hcm') || addr.includes('sài gòn') || addr.includes('quận') || addr.includes('thủ đức') || addr.includes('bình thạnh') || addr.includes('tân bình') || addr.includes('gò vấp');
      if (regionFilter === 'HCM' && !isHCM) return false;
      if (regionFilter === 'PROVINCE' && isHCM) return false;

      // Payment Filter (COD vs PREPAID)
      const isPaid = o.paymentStatus === 'PAID' || o.paymentMethod === 'ONLINE_GATEWAY' || o.paymentMethod === 'BANK_TRANSFER' || (parseFloat(o.totalAmount || o.total || 0) === 0);
      if (paymentFilter === 'COD' && isPaid) return false;
      if (paymentFilter === 'PREPAID' && !isPaid) return false;

      // Incident Status Filter (Sự cố / Tiến độ)
      const isDelivered = o.status === 'DELIVERED';
      const isAwaiting = Boolean(o.isAwaitingCallback);
      const isRescheduled = (o.failReason || '').includes('Khách hẹn');
      const isRejected = (o.failReason || '').includes('từ chối') || (o.failReason || '').includes('Bom hàng') || o.status === 'CANCELLED';
      const isReturning = o.status === 'RETURNING_TO_WAREHOUSE';
      const isNormalShipping = o.status === 'SHIPPED' && !isAwaiting && !isRescheduled && !isRejected && !isReturning;

      // Incident Status & Time Filter
      const ordTime = getOrderTimeClassification(o);
      if (incidentFilter === 'TODAY' && !ordTime.isToday) return false;
      if (incidentFilter === 'NEW' && !ordTime.isNew) return false;
      if (incidentFilter === 'BACKLOG' && !ordTime.isBacklog) return false;
      if (incidentFilter === 'SHIPPING' && !isNormalShipping) return false;
      if (incidentFilter === 'DELIVERED' && !isDelivered) return false;
      if (incidentFilter === 'AWAITING_CALLBACK' && !isAwaiting) return false;
      if (incidentFilter === 'RESCHEDULED' && !isRescheduled) return false;
      if (incidentFilter === 'REJECTED' && !isRejected) return false;
      if (incidentFilter === 'RETURNING' && !isReturning) return false;

      // Date / Time Filter
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

      // TAB 1: ĐƠN CHỜ NHẬN GIAO TẠI KHO (Hàng mới đóng gói READY_TO_SHIP trong khu vực của shipper)
      if (activeTab === 'pending') return o.status === 'READY_TO_SHIP';

      // TAB 2: ĐANG GIAO & MINH CHỨNG (Tất cả đơn Shipper đang phụ trách đi giao hoặc đã giao thành công)
      if (activeTab === 'active') {
        return ['SHIPPED', 'DELIVERED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE'].includes(o.status);
      }

      // TAB 5: LỊCH SỬ & BẢNG KÊ COD (Đã giao thành công hoặc thất bại chuyển hoàn)
      if (activeTab === 'history') {
        return ['DELIVERED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE'].includes(o.status);
      }

      return true;
    });

    // Sorting Logic
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
  }, [myDeliveryOrders, search, regionFilter, paymentFilter, incidentFilter, dateFilterPeriod, customStartDate, customEndDate, sortOrder, activeTab, userIdStr, isManagerOrAdmin, user]);

  const handleClaimOrder = async (orderId) => {
    if (typeof claimOrderForDelivery === 'function') {
      const result = await claimOrderForDelivery(orderId, user);
      if (result?.success) {
        addNotification(`🚚 Đã nhận đơn hàng #${orderId}! Đơn đã chuyển sang tab "Đang Giao & Minh Chứng".`, 'success', '/admin/delivery?tab=active');
      } else {
        addNotification(result?.message || `Không thể nhận đơn hàng #${orderId}.`, 'error');
      }
    } else {
      updateOrderStatus(orderId, 'SHIPPED');
      addNotification(`🚚 Đã nhận đơn hàng #${orderId}!`, 'success', '/admin/delivery?tab=active');
    }
  };

  const handleConfirmDelivered = () => {
    if (!deliverModal) return;
    const ordId = deliverModal.orderId || deliverModal.id;
    const isPrepaid = deliverModal.paymentStatus === 'PAID' || deliverModal.paymentMethod === 'ONLINE_GATEWAY' || deliverModal.paymentMethod === 'BANK_TRANSFER' || (parseFloat(deliverModal.totalAmount || deliverModal.total || 0) === 0);
    const payMethodFinal = isPrepaid ? 'PREPAID' : actualPaymentMethod;
    const receiverNameFinal = receivedByType === 'DIRECT_CUSTOMER' ? (deliverModal.customerName || 'Khách hàng') : (receiverNameActual || 'Người nhận thay');
    const bankRefFinal = payMethodFinal === 'BANK_TRANSFER' ? (bankRefCode || `VQR-${Date.now().toString().slice(-6)}`) : null;

    updateOrderStatus(ordId, 'DELIVERED', {
      proofPhoto,
      receiverNote: receiverNote || 'Khách đã ký nhận nguyên vẹn',
      actualPaymentMethod: payMethodFinal,
      bankRefCode: bankRefFinal,
      paymentProofPhoto: payMethodFinal === 'BANK_TRANSFER' ? paymentProofPhoto : null,
      receivedByType,
      receiverNameActual: receiverNameFinal,
      deliveredAt: new Date().toISOString()
    });
    setDeliverModal(null);
    setReceiverNote('');
    setBankRefCode('');
    setPaymentProofPhoto('');
    setReceiverNameActual('');
    const payLabel = payMethodFinal === 'BANK_TRANSFER' ? `Chuyển khoản VietQR (${bankRefFinal})` : (payMethodFinal === 'CASH' ? 'Tiền mặt' : 'Đã thanh toán trước');
    addNotification(`✅ Đơn hàng #${ordId} giao thành công! Hình thức thanh toán: [${payLabel}], Người nhận: [${receiverNameFinal}].`, 'success', '/admin/delivery?tab=history');
  };

  const handleFailDelivery = () => {
    if (!failModal || !failReason) {
      addNotification('Vui lòng chọn lý do giao hàng thất bại!', 'error');
      return;
    }
    const ordId = failModal.orderId || failModal.id;
    const isNoContact = failReason.includes('Không liên lạc được');
    const now = new Date();
    const deadline24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    updateOrderStatus(ordId, 'SHIPPING_FAILED', {
      failReason,
      failNote,
      failedAt: now.toISOString(),
      callbackDeadline: isNoContact ? deadline24h : null,
      isAwaitingCallback: isNoContact,
      deliveryAttempts: ((failModal.deliveryAttempts || 0) + 1)
    });
    setFailModal(null);
    setFailReason('');
    setFailNote('');

    if (isNoContact) {
      addNotification(`⏳ Đã đưa đơn #${ordId} vào danh sách "Chờ khách gọi lại (24h)". Sau 24h hệ thống sẽ tự động hoàn kho.`, 'warning', '/admin/delivery?tab=active');
    } else {
      addNotification(`⚠️ Đã cập nhật trạng thái đơn #${ordId}: Giao Thất Bại / Hẹn Lại.`, 'warning', '/admin/delivery?tab=history');
    }
  };

  // Khách gọi lại hoặc Shipper tiếp tục đi giao theo hẹn -> Kích hoạt lại đơn SHIPPED
  const handleResumeDelivery = (orderId) => {
    updateOrderStatus(orderId, 'SHIPPED', {
      isAwaitingCallback: false,
      failReason: '',
      failNote: '',
      resumedAt: new Date().toISOString()
    });
    setIncidentFilter('ALL');
    addNotification(`🚚 Đơn #${orderId} đã được kích hoạt lại! Bạn có thể tiếp tục đi giao và chụp ảnh POD.`, 'success', '/admin/delivery?tab=active');
  };

  // Báo CSKH liên hệ khách cứu đơn hàng
  const handleEscalateToCSKH = (orderId) => {
    addNotification(`📞 Đã gửi thông báo khẩn đến bộ phận CSKH để liên hệ hỗ trợ cứu đơn hàng #${orderId}!`, 'info', '/admin/delivery?tab=active');
  };

  // Quá 24h không liên lạc được hoặc Khách hủy -> Chuyển hoàn về kho
  const handleForceReturnToWarehouse = (orderId) => {
    updateOrderStatus(orderId, 'RETURNING_TO_WAREHOUSE', {
      isAwaitingCallback: false,
      failReason: '',
      failNote: '',
      returnReason: 'Khách từ chối nhận - Chuyển hoàn về kho',
      returnedAt: new Date().toISOString()
    });
    setIncidentFilter('ALL');
    addNotification(`↩️ Đơn hàng #${orderId} đã được chuyển sang trạng thái "Đang Chuyển Hoàn Về Kho". Vui lòng bàn giao kiện hàng cho Thủ kho.`, 'warning', '/admin/delivery?tab=active');
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* Dynamic Task Center Notification Banner */}
      <ActorNotificationBar />

      {/* ========================================================================= */}
      {/* 1. TOP HEADER */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={24} style={{ color: '#2563eb' }} />
            {activeTab === 'overview' && 'Tổng Quan Giao Vận & Điều Phối (Delivery Dashboard)'}
            {activeTab === 'pending' && 'Đơn Hàng Sẵn Sàng Giao (Chờ Nhận Đơn Tại Kho)'}
            {activeTab === 'active' && 'Đang Giao & Xác Nhận Minh Chứng (Proof of Delivery - POD)'}
            {activeTab === 'returns' && 'Thu Hồi Hàng Đổi Trả Tại Nhà Khách (RMA Pickup)'}
            {activeTab === 'history' && 'Lịch Sử Giao Hàng & Bảng Kê Thu Hộ (COD Ledger)'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            Điều phối shipper, xác nhận giao hàng bằng ảnh minh chứng POD và đối soát tiền mặt COD
          </p>
        </div>

        {/* Shipper Controls: Status Toggle & Region Badge */}
        {!isManagerOrAdmin && (() => {
          const myActiveDeliveringOrders = orders.filter(o => ['SHIPPED', 'OUT_FOR_DELIVERY', 'ASSIGNED'].includes(o.status) && isShipperMatched(o));
          const myActiveCount = myActiveDeliveringOrders.length;
          const isOverloadThreshold = myActiveCount >= 5;

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Switch Bật/Tắt Nhận Đơn */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.5rem 0.85rem',
                backgroundColor: isOverloadThreshold ? '#fef2f2' : (shipperStatus.isOnline ? '#f0fdf4' : '#f8fafc'),
                border: `1.5px solid ${isOverloadThreshold ? '#fca5a5' : (shipperStatus.isOnline ? '#86efac' : '#cbd5e1')}`,
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{
                  width: '11px',
                  height: '11px',
                  borderRadius: '50%',
                  backgroundColor: isOverloadThreshold ? '#ef4444' : (shipperStatus.isOnline ? '#22c55e' : '#94a3b8'),
                  boxShadow: (shipperStatus.isOnline && !isOverloadThreshold) ? '0 0 8px #22c55e' : 'none'
                }} />
                
                <div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    Trạng Thái Nhận Đơn
                  </span>
                  <strong style={{ fontSize: '0.8rem', color: isOverloadThreshold ? '#dc2626' : (shipperStatus.isOnline ? '#15803d' : '#64748b') }}>
                    {isOverloadThreshold ? `🔴 Tải Nặng (${myActiveCount} đơn)` : (shipperStatus.isOnline ? '🟢 SẴN SÀNG NHẬN ĐƠN' : '⛔ TẠM DỪNG NHẬN ĐƠN')}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => toggleShipperStatus(!shipperStatus.isOnline)}
                  style={{
                    marginLeft: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    backgroundColor: shipperStatus.isOnline ? '#fee2e2' : '#22c55e',
                    color: shipperStatus.isOnline ? '#dc2626' : '#ffffff',
                    transition: 'all 0.15s ease',
                    boxShadow: shipperStatus.isOnline ? 'none' : '0 2px 4px rgba(34,197,94,0.25)'
                  }}
                  title={shipperStatus.isOnline ? 'Bấm để Tạm Dừng nhận đơn mới' : 'Bấm để BẬT Sẵn Sàng nhận đơn'}
                >
                  {shipperStatus.isOnline ? 'Tạm Dừng' : 'Bật Nhận Đơn'}
                </button>
              </div>

              {/* Shipper Region Badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.5rem 0.85rem',
                backgroundColor: '#eff6ff',
                border: '1.5px solid #bfdbfe',
                borderRadius: '8px'
              }}>
                <MapPin size={18} style={{ color: '#2563eb' }} />
                <div>
                  <span style={{ fontSize: '0.68rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    Khu Vực Phụ Trách
                  </span>
                  <strong style={{ fontSize: '0.8rem', color: '#1e3a8a' }}>
                    {shipperRegionObj.shortName}
                  </strong>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN GIAO VẬN) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* 6 Balanced KPI Cards (2 Rows x 3 Columns) */}
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
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', height: '320px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Tỷ Lệ Hoàn Thành Giao Hàng
              </h3>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={deliveryRatioData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
                  }}
                />
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', height: '320px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Thu Hộ Tiền Mặt (COD) Trong Tuần
              </h3>
              <div style={{ flex: 1, position: 'relative' }}>
                <Bar
                  data={dailyCodData}
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
          </div>

          {/* Quick Tasks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
                Đơn Hàng Gần Vị Trí Cần Nhận Giao
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {orders.filter(o => o.status === 'READY_TO_SHIP').slice(0, 3).map((o, oIdx) => (
                  <div key={o.id || oIdx} style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>#{o.orderId || o.id} — {o.customerName}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>📍 {o.shippingAddress || 'Quận 1, TP. Hồ Chí Minh'}</span>
                    </div>
                    <button
                      onClick={() => handleClaimOrder(o.orderId || o.id)}
                      style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Nhận Giao
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
                Yêu Cầu Thu Hồi RMA Cần Lấy
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pendingReturns.slice(0, 3).map((r, rIdx) => (
                  <div key={r.id || rIdx} style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>#RMA-{r.id} — {r.customerName}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>📞 {r.phone}</span>
                    </div>
                    <button
                      onClick={() => setTab('returns')}
                      style={{ backgroundColor: '#8b5cf6', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Xem Địa Chỉ
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PENDING (ĐƠN CHỜ LẤY TẠI KHO) */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Danh Sách Đơn Hàng Đã Đóng Gói — Sẵn Sàng Giao ({filteredOrders.length})
            </h3>
            <div style={{ position: 'relative', width: '280px' }}>
              <input
                type="text"
                placeholder="Tìm mã đơn, khách hàng, địa chỉ..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã Đơn</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Khách Hàng & SĐT</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Địa Chỉ Giao Hàng</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Tiền Thu COD</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                      <Package size={36} style={{ color: '#94a3b8', margin: '0 auto 0.5rem' }} />
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                        Hiện không có đơn hàng nào chờ nhận tại kho
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0.75rem' }}>
                        Các đơn hàng đã được phân công đang nằm trong tab <strong>"Đang Giao & Minh Chứng"</strong> để bạn đi giao và chụp ảnh POD.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab('active')}
                        style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        Chuyển Sang Tab Đang Giao & Minh Chứng →
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord, oIdx) => (
                    <tr key={ord.id || oIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#2563eb' }}>
                        <div>#{ord.orderId || ord.id}</div>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          marginTop: '0.2rem',
                          backgroundColor: '#fffbeb',
                          color: '#d97706',
                          border: '1px solid #fde68a'
                        }}>
                          Sẵn Sàng Tại Kho
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <strong style={{ color: '#0f172a', display: 'block' }}>{ord.customerName}</strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{ord.phone}</span>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>📍 {ord.shippingAddress || 'Quận 1, TP. Hồ Chí Minh'}</td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {fmt(ord.totalAmount || ord.total)}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleClaimOrder(ord.orderId || ord.id)}
                          style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.45rem 0.95rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
                        >
                          <Truck size={14} /> Nhận Chuyến & Xuất Kho
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ACTIVE (ĐANG GIAO & MINH CHỨNG POD) NÂNG CẤP BỘ LỌC & THỜI GIAN */}
      {/* ========================================================================= */}
      {activeTab === 'active' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>

          {/* Top Bar: Title, Total Count & Today Summary Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Đơn Hàng Bạn Đang Phụ Trách Giao Trên Đường</span>
                <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #bfdbfe' }}>
                  {filteredOrders.length} Đơn
                </span>
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
                Kiểm tra thông tin khách hàng, lộ trình di chuyển và thực hiện chụp ảnh minh chứng POD khi giao hàng
              </p>
            </div>

            {/* Quick Shift Summary Badge */}
            <div style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              fontSize: '0.75rem',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              <span>Hôm nay: <strong style={{ color: '#2563eb' }}>{todayCount} đơn</strong> (Mới nhận: <strong style={{ color: '#ea580c' }}>{newCount}</strong>)</span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span>Đơn tồn / hẹn lại: <strong style={{ color: '#d97706' }}>{backlogCount} đơn</strong></span>
            </div>
          </div>

          {/* QUICK STATUS & TIME PILL TABS (CLEAN TEXT, NO EMOJIS) */}
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {[
              { id: 'ALL', label: 'Tất Cả Đơn', count: activeOrdersList.length, color: '#2563eb' },
              { id: 'TODAY', label: 'Đơn Hôm Nay', count: todayCount, color: '#2563eb' },
              { id: 'NEW', label: 'Đơn Mới Nhận', count: newCount, color: '#ea580c' },
              { id: 'BACKLOG', label: 'Đơn Tồn / Giao Lại', count: backlogCount, color: '#d97706' },
              { id: 'SHIPPING', label: 'Đang Đi Giao', count: countShipping, color: '#2563eb' },
              { id: 'DELIVERED', label: 'Đã Giao Xong', count: doneCount, color: '#16a34a' },
              { id: 'AWAITING_CALLBACK', label: 'Chờ Gọi Lại 24h', count: countAwaiting, color: '#d97706' },
              { id: 'RESCHEDULED', label: 'Khách Hẹn Lại', count: countRescheduled, color: '#7c3aed' },
              { id: 'REJECTED', label: 'Khách Từ Chối / Hủy', count: countRejected, color: '#dc2626' },
              { id: 'RETURNING', label: 'Đang Chuyển Hoàn Kho', count: countReturning, color: '#475569' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setIncidentFilter(tab.id)}
                style={{
                  padding: '0.38rem 0.8rem',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 750,
                  cursor: 'pointer',
                  border: incidentFilter === tab.id ? `1.5px solid ${tab.color}` : '1px solid #cbd5e1',
                  backgroundColor: incidentFilter === tab.id ? `${tab.color}15` : '#ffffff',
                  color: incidentFilter === tab.id ? tab.color : '#475569',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  backgroundColor: incidentFilter === tab.id ? tab.color : '#f1f5f9',
                  color: incidentFilter === tab.id ? '#ffffff' : '#475569'
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ADVANCED FILTER BAR */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '0.75rem',
            padding: '0.9rem',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '1.25rem'
          }}>
            {/* 1. Search Box */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Tìm mã đơn, tên khách, SĐT, địa chỉ..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>

            {/* 2. Incident Filter */}
            <div>
              <select
                value={incidentFilter}
                onChange={e => setIncidentFilter(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1.5px solid #2563eb', fontSize: '0.8rem', backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 700, boxSizing: 'border-box' }}
              >
                <option value="ALL">Tất Cả Tiến Độ & Thời Gian</option>
                <option value="TODAY">Đơn Hôm Nay</option>
                <option value="NEW">Đơn Mới Nhận</option>
                <option value="BACKLOG">Đơn Tồn / Giao Lại</option>
                <option value="SHIPPING">Đang Đi Giao</option>
                <option value="DELIVERED">Đã Giao Thành Công (POD)</option>
                <option value="AWAITING_CALLBACK">Chờ Khách Gọi Lại 24h</option>
                <option value="RESCHEDULED">Khách Hẹn Giao Ngày Khác</option>
                <option value="REJECTED">Khách Từ Chối Nhận / Hủy</option>
                <option value="RETURNING">Đang Chuyển Hoàn Về Kho</option>
              </select>
            </div>

            {/* 3. Date / Time Range Filter */}
            <div>
              <select
                value={dateFilterPeriod}
                onChange={e => setDateFilterPeriod(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 600, boxSizing: 'border-box' }}
              >
                <option value="ALL">Tất Cả Thời Gian</option>
                <option value="TODAY">Hôm Nay</option>
                <option value="YESTERDAY">Hôm Qua</option>
                <option value="LAST_7_DAYS">7 Ngày Qua</option>
                <option value="LAST_30_DAYS">30 Ngày Qua</option>
                <option value="CUSTOM">Tùy Chọn Ngày Giờ...</option>
              </select>
            </div>

            {/* 4. Region Filter */}
            <div>
              <select
                value={regionFilter}
                onChange={e => setRegionFilter(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 600, boxSizing: 'border-box' }}
              >
                <option value="ALL">Tất Cả Khu Vực</option>
                <option value="HCM">Nội Thành TP.HCM</option>
                <option value="PROVINCE">Ngoại Tỉnh (3PL Giao)</option>
              </select>
            </div>

            {/* 5. Payment Filter */}
            <div>
              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 600, boxSizing: 'border-box' }}
              >
                <option value="ALL">Tất Cả Hình Thức</option>
                <option value="COD">Thu Tiền Mặt COD</option>
                <option value="PREPAID">Đã Trả Online (0đ COD)</option>
              </select>
            </div>

            {/* 6. Sort Filter */}
            <div>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 600, boxSizing: 'border-box' }}
              >
                <option value="NEWEST">Mới Nhất Trước</option>
                <option value="OLDEST">Cũ Nhất Trước</option>
                <option value="COD_DESC">Tiền COD Cao Nhất</option>
                <option value="COD_ASC">Tiền COD Thấp Nhất</option>
              </select>
            </div>

            {/* 7. Reset Button */}
            {(search || regionFilter !== 'ALL' || paymentFilter !== 'ALL' || incidentFilter !== 'ALL' || dateFilterPeriod !== 'ALL' || sortOrder !== 'NEWEST') && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setRegionFilter('ALL');
                    setPaymentFilter('ALL');
                    setIncidentFilter('ALL');
                    setDateFilterPeriod('ALL');
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setSortOrder('NEWEST');
                  }}
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, backgroundColor: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}
                >
                  ✕ Xóa Lọc
                </button>
              </div>
            )}
          </div>

          {/* CUSTOM DATE RANGE PICKER (IF SELECTED) */}
          {dateFilterPeriod === 'CUSTOM' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              padding: '0.75rem 1rem',
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              marginBottom: '1.25rem'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={15} /> Lọc theo khoảng ngày giao:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>Từ ngày:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #94a3b8', fontSize: '0.78rem', backgroundColor: '#ffffff' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>Đến ngày:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #94a3b8', fontSize: '0.78rem', backgroundColor: '#ffffff' }}
                />
              </div>
            </div>
          )}

          {/* EMPTY STATE */}
          {filteredOrders.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
              <Truck size={42} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>
                Không tìm thấy đơn hàng nào phù hợp với bộ lọc
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.35rem 0 1rem' }}>
                Hãy thử thay đổi điều kiện tìm kiếm hoặc sang tab <strong>"Đơn Chờ Nhận Giao"</strong> để nhận thêm đơn mới.
              </p>
              <button
                type="button"
                onClick={() => setTab('pending')}
                style={{ padding: '0.5rem 1.1rem', fontSize: '0.8rem', fontWeight: 700, backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                ← Sang Tab Đơn Chờ Nhận Giao
              </button>
            </div>
          ) : (
            /* ORDERS GRID */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
              {filteredOrders.map((ord, oIdx) => {
                const isDelivered = ord.status === 'DELIVERED';
                const timeInfo = getOrderTimeClassification(ord);
                const codAmount = parseFloat(ord.totalAmount || ord.total || 0);
                const isPrepaid = ord.paymentStatus === 'PAID' || ord.paymentMethod === 'ONLINE_GATEWAY' || ord.paymentMethod === 'BANK_TRANSFER' || codAmount === 0;
                const addrStr = (ord.shippingAddress || '').toLowerCase();
                const isHCM = addrStr.includes('hồ chí minh') || addrStr.includes('hcm') || addrStr.includes('tp.hcm') || addrStr.includes('quận');

                // Explicit Status Flags
                const isFailedOrder = ord.status === 'SHIPPING_FAILED';
                const isAwaiting = isFailedOrder && Boolean(ord.isAwaitingCallback);
                const isRescheduled = isFailedOrder && (ord.failReason || '').includes('Khách hẹn');
                const isRejected = isFailedOrder && !isAwaiting && !isRescheduled;
                const isReturning = ord.status === 'RETURNING_TO_WAREHOUSE';
                const isNormalShipped = ord.status === 'SHIPPED';

                return (
                  <div key={ord.id || oIdx} style={{
                    border: isDelivered ? '1.5px solid #86efac' : isRescheduled ? '1.5px solid #d8b4fe' : isAwaiting ? '1.5px solid #fde68a' : timeInfo.isNew ? '1.5px solid #fdba74' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '1.2rem',
                    backgroundColor: isDelivered ? '#fcfdfa' : '#ffffff',
                    boxShadow: isDelivered ? '0 2px 8px rgba(22,163,74,0.06)' : timeInfo.isNew ? '0 4px 12px rgba(249,115,22,0.12)' : '0 2px 4px rgba(0,0,0,0.02)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      {/* Top Row: Order ID & Status Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isDelivered ? '#15803d' : '#2563eb' }}>
                          #{ord.orderId || ord.id}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {/* Time-based badges (clean text, no emojis) */}
                          {timeInfo.isNew && !isDelivered && (
                            <span style={{
                              backgroundColor: '#fff7ed',
                              color: '#ea580c',
                              border: '1px solid #fed7aa',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 800
                            }}>
                              MỚI BÀN GIAO
                            </span>
                          )}

                          {timeInfo.isToday && !timeInfo.isNew && !isDelivered && (
                            <span style={{
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 800
                            }}>
                              HÔM NAY
                            </span>
                          )}

                          {timeInfo.isBacklog && !isDelivered && !isRescheduled && !isAwaiting && (
                            <span style={{
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 800
                            }}>
                              ĐƠN TỒN
                            </span>
                          )}

                          {/* Status badges (clean text, no emojis) */}
                          {isDelivered ? (
                            <span style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                              ĐÃ GIAO XONG (POD)
                            </span>
                          ) : isAwaiting ? (
                            <span style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                              CHỜ GỌI LẠI (24H)
                            </span>
                          ) : isRescheduled ? (
                            <span style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                              KHÁCH HẸN LẠI
                            </span>
                          ) : isRejected ? (
                            <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                              KHÁCH TỪ CHỐI
                            </span>
                          ) : isReturning ? (
                            <span style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                              ĐANG HOÀN KHO
                            </span>
                          ) : (
                            <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                              ĐANG GIAO
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Time Tag */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.75rem',
                        color: isDelivered ? '#166534' : isAwaiting ? '#b45309' : isRescheduled ? '#7c3aed' : '#475569',
                        backgroundColor: isDelivered ? '#f0fdf4' : isAwaiting ? '#fffbeb' : isRescheduled ? '#faf5ff' : '#f8fafc',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '4px',
                        marginBottom: '0.75rem',
                        border: `1px solid ${isDelivered ? '#bbf7d0' : isAwaiting ? '#fde68a' : isRescheduled ? '#e9d5ff' : '#e2e8f0'}`
                      }}>
                        <Clock size={13} style={{ color: isDelivered ? '#16a34a' : isAwaiting ? '#d97706' : isRescheduled ? '#9333ea' : '#64748b' }} />
                        <span>
                          {isDelivered
                            ? <><strong>Đã giao xong:</strong> {timeInfo.formatted}</>
                            : isAwaiting
                              ? 'Đang chờ khách liên lạc lại (Tối đa 24 giờ)'
                              : isRescheduled
                                ? `Khách hẹn lại: ${ord.failNote || 'Chuyến tiếp theo'}`
                                : <><strong>Bàn giao:</strong> {timeInfo.formatted}</>}
                        </span>
                      </div>

                      {/* Incident / POD Notice Box */}
                      {isDelivered ? (
                        <div style={{ padding: '0.6rem 0.75rem', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.74rem', color: '#166534', marginBottom: '0.75rem' }}>
                          <strong>Minh Chứng POD:</strong> {ord.receiverNote || 'Khách đã kiểm tra tem niêm phong và ký nhận.'}
                          {ord.proofPhoto && (
                            <span style={{ display: 'inline-block', marginLeft: '0.4rem', color: '#2563eb', fontWeight: 700 }}>
                              [Đã có ảnh chụp POD]
                            </span>
                          )}
                        </div>
                      ) : isAwaiting ? (
                        <div style={{ padding: '0.6rem 0.75rem', backgroundColor: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '0.74rem', color: '#92400e', marginBottom: '0.75rem' }}>
                          <strong>Chính sách 24H:</strong> Không gọi được cho khách. Đang tạm giữ chờ phản hồi. Nếu khách gọi lại, bấm <strong>[Khách Đã Gọi Lại]</strong> để tiếp tục giao.
                        </div>
                      ) : isRescheduled ? (
                        <div style={{ padding: '0.6rem 0.75rem', backgroundColor: '#faf5ff', borderRadius: '6px', border: '1px solid #e9d5ff', fontSize: '0.74rem', color: '#6b21a8', marginBottom: '0.75rem' }}>
                          <strong>Khách Hẹn Lại:</strong> {ord.failReason}. {ord.failNote ? `Ghi chú: "${ord.failNote}"` : ''}
                        </div>
                      ) : isRejected ? (
                        <div style={{ padding: '0.6rem 0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '0.74rem', color: '#991b1b', marginBottom: '0.75rem' }}>
                          <strong>Khách Từ Chối Nhận Hàng:</strong> {ord.failReason || 'Khách đổi ý không mua'}. {ord.failNote ? `Ghi chú: "${ord.failNote}"` : ''}
                        </div>
                      ) : isReturning ? (
                        <div style={{ padding: '0.6rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.74rem', color: '#334155', marginBottom: '0.75rem' }}>
                          <strong>↩️ Chuyển Hoàn Kho:</strong> Đơn hàng đang được Shipper giữ để bàn giao lại cho Thủ kho kiểm tra.
                        </div>
                      ) : null}

                      {/* Customer Details */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem', color: '#475569', marginBottom: '0.9rem' }}>
                        <div>
                          <strong>Khách nhận:</strong> <span style={{ color: '#0f172a', fontWeight: 700 }}>{ord.customerName}</span>
                        </div>
                        <div>
                          <strong>Số điện thoại:</strong>{' '}
                          <a
                            href={`tel:${ord.phone}`}
                            style={{ color: '#2563eb', fontWeight: 800, textDecoration: 'none', backgroundColor: '#eff6ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #bfdbfe' }}
                          >
                            📞 {ord.phone}
                          </a>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.25rem' }}>
                          <span style={{ minWidth: '55px' }}><strong>Địa chỉ:</strong></span>
                          <span>
                            📍 {ord.shippingAddress || 'TP. Hồ Chí Minh'}
                            <span style={{
                              display: 'inline-block',
                              marginLeft: '0.4rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              backgroundColor: isHCM ? '#f0fdf4' : '#f5f3ff',
                              color: isHCM ? '#15803d' : '#7c3aed',
                              border: `1px solid ${isHCM ? '#bbf7d0' : '#ddd6fe'}`
                            }}>
                              {isHCM ? 'Nội thành HCM' : 'Tỉnh / 3PL'}
                            </span>
                          </span>
                        </div>

                        {/* COD Amount Box */}
                        <div style={{
                          marginTop: '0.35rem',
                          padding: '0.6rem 0.8rem',
                          backgroundColor: isDelivered ? '#f0fdf4' : isPrepaid ? '#eff6ff' : '#f0fdf4',
                          borderRadius: '6px',
                          border: `1px solid ${isDelivered ? '#bbf7d0' : isPrepaid ? '#bfdbfe' : '#bbf7d0'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: isDelivered ? '#15803d' : isPrepaid ? '#1e40af' : '#15803d', fontWeight: 700 }}>
                              {isDelivered ? 'TIỀN COD ĐÃ THU HOÀN TẤT' : isPrepaid ? 'ĐÃ THANH TOÁN ONLINE' : 'TIỀN MẶT THU HỘ (COD)'}
                            </div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: isDelivered ? '#16a34a' : isPrepaid ? '#2563eb' : '#16a34a' }}>
                              {isPrepaid ? '0 đ' : fmt(codAmount)}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: isDelivered ? '#dcfce7' : isPrepaid ? '#dbeafe' : '#dcfce7', color: isDelivered ? '#15803d' : isPrepaid ? '#1e40af' : '#15803d' }}>
                            {isDelivered ? 'ĐÃ THU XONG' : isPrepaid ? 'KHÔNG THU' : 'CẦN THU'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {isDelivered ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(ord)}
                            style={{ flex: 1, backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                          >
                            <Eye size={14} /> Xem Chi Tiết & Ảnh POD
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              updateOrderStatus(ord.orderId || ord.id, 'SHIPPED');
                              addNotification(`Đã chuyển đơn #${ord.orderId || ord.id} lại trạng thái đang giao`, 'info');
                            }}
                            title="Nếu giao nhầm hoặc cần chụp lại POD"
                            style={{ backgroundColor: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.55rem 0.65rem', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            🔄 Giao Lại
                          </button>
                        </>
                      ) : isAwaiting ? (
                        <>
                          <button
                            onClick={() => handleResumeDelivery(ord.orderId || ord.id)}
                            style={{ flex: 1.2, backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', boxShadow: '0 2px 4px rgba(22,163,74,0.2)' }}
                          >
                            📞 Khách Đã Gọi Lại → Giao Tiếp
                          </button>
                          <button
                            onClick={() => handleForceReturnToWarehouse(ord.orderId || ord.id)}
                            style={{ flex: 0.8, backgroundColor: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ↩️ Hoàn Về Kho
                          </button>
                        </>
                      ) : isRescheduled ? (
                        <>
                          <button
                            onClick={() => handleResumeDelivery(ord.orderId || ord.id)}
                            style={{ flex: 1.2, backgroundColor: '#7c3aed', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', boxShadow: '0 2px 4px rgba(124,58,237,0.25)' }}
                          >
                            🚚 Giao Tiếp Theo Hẹn
                          </button>
                          <button
                            onClick={() => handleForceReturnToWarehouse(ord.orderId || ord.id)}
                            style={{ flex: 0.8, backgroundColor: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ↩️ Hoàn Về Kho
                          </button>
                        </>
                      ) : isRejected ? (
                        <>
                          <button
                            onClick={() => handleForceReturnToWarehouse(ord.orderId || ord.id)}
                            style={{ flex: 1.2, backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', boxShadow: '0 2px 4px rgba(220,38,38,0.25)' }}
                          >
                            ↩️ Xác Nhận Hoàn Kho
                          </button>
                          <button
                            onClick={() => handleEscalateToCSKH(ord.orderId || ord.id)}
                            style={{ flex: 0.9, backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.55rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            📞 Báo CSKH
                          </button>
                          <button
                            onClick={() => handleResumeDelivery(ord.orderId || ord.id)}
                            title="Nếu khách đổi ý muốn nhận lại"
                            style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.55rem 0.65rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            🔄 Giao Lại
                          </button>
                        </>
                      ) : isReturning ? (
                        <button
                          onClick={() => handleResumeDelivery(ord.orderId || ord.id)}
                          style={{ flex: 1, backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.55rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          🔄 Khách Đổi Ý → Tiếp Tục Giao
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setDeliverModal(ord)}
                            style={{ flex: 1, backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', boxShadow: '0 2px 4px rgba(22,163,74,0.2)' }}
                          >
                            <Camera size={15} /> Giao Thành Công (POD)
                          </button>
                          <button
                            onClick={() => setFailModal(ord)}
                            style={{ backgroundColor: '#ffffff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.55rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Báo Lỗi
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TAB 4: RETURNS (THU HỒI ĐỔI TRẢ RMA) */}
      {/* ========================================================================= */}
      {activeTab === 'returns' && (() => {
        const getReturnDateTime = (ret) => {
          const dateVal = ret.createdAt || ret.date || ret.pickedUpAt || ret.deliveredWarehouseAt;
          if (!dateVal) return null;
          if (typeof dateVal === 'string' && dateVal.includes('/')) {
            const parts = dateVal.split('/');
            if (parts.length === 3) {
              return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            }
          }
          const d = new Date(dateVal);
          return isNaN(d.getTime()) ? null : d;
        };

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const endOfYesterday = new Date(endOfToday);
        endOfYesterday.setDate(endOfYesterday.getDate() - 1);
        const past7Days = new Date(startOfToday);
        past7Days.setDate(past7Days.getDate() - 7);
        const past30Days = new Date(startOfToday);
        past30Days.setDate(past30Days.getDate() - 30);

        const rmaTodayCount = pendingReturns.filter(r => {
          const d = getReturnDateTime(r);
          return d ? (d >= startOfToday && d <= endOfToday) : true;
        }).length;

        const rmaYesterdayCount = pendingReturns.filter(r => {
          const d = getReturnDateTime(r);
          return d ? (d >= startOfYesterday && d <= endOfYesterday) : false;
        }).length;

        const rma7DaysCount = pendingReturns.filter(r => {
          const d = getReturnDateTime(r);
          return d ? (d >= past7Days && d <= endOfToday) : true;
        }).length;

        const filteredReturns = pendingReturns.filter(ret => {
          // 1. Search Filter
          if (rmaSearch.trim()) {
            const q = rmaSearch.trim().toLowerCase();
            const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(ret.orderId));
            const match = 
              String(ret.id || '').toLowerCase().includes(q) ||
              String(ret.orderId || '').toLowerCase().includes(q) ||
              String(ret.customerName || matchedOrder?.customerName || '').toLowerCase().includes(q) ||
              String(ret.phone || matchedOrder?.phone || '').includes(q) ||
              String(ret.address || ret.shippingAddress || matchedOrder?.shippingAddress || '').toLowerCase().includes(q);
            if (!match) return false;
          }

          // 2. Status Filter
          const isReturning = ret.status === 'RETURNING_TO_WAREHOUSE';
          const isDeliveredToWarehouse = ret.status === 'DELIVERED_TO_WAREHOUSE';
          const isPickupPending = ['PENDING', 'RETURN_APPROVED', 'RETURN_REQUESTED', 'PROCESSING'].includes(ret.status);

          if (rmaStatusFilter === 'PENDING_PICKUP' && !isPickupPending) return false;
          if (rmaStatusFilter === 'RETURNING' && !isReturning) return false;
          if (rmaStatusFilter === 'DELIVERED_WAREHOUSE' && !isDeliveredToWarehouse) return false;

          // 3. Date Filter
          if (rmaDateFilter !== 'ALL') {
            const retDate = getReturnDateTime(ret);
            if (retDate) {
              if (rmaDateFilter === 'TODAY') {
                if (retDate < startOfToday || retDate > endOfToday) return false;
              } else if (rmaDateFilter === 'YESTERDAY') {
                if (retDate < startOfYesterday || retDate > endOfYesterday) return false;
              } else if (rmaDateFilter === 'LAST_7_DAYS') {
                if (retDate < past7Days || retDate > endOfToday) return false;
              } else if (rmaDateFilter === 'LAST_30_DAYS') {
                if (retDate < past30Days || retDate > endOfToday) return false;
              } else if (rmaDateFilter === 'CUSTOM') {
                if (rmaCustomStartDate) {
                  const s = new Date(rmaCustomStartDate + 'T00:00:00');
                  if (retDate < s) return false;
                }
                if (rmaCustomEndDate) {
                  const e = new Date(rmaCustomEndDate + 'T23:59:59');
                  if (retDate > e) return false;
                }
              }
            }
          }

          return true;
        });

        return (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            {/* Header Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Nhiệm Vụ Thu Hồi Hàng Đổi Trả / Hoàn Tiền (RMA Pickup)</span>
                  <span style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #ddd6fe' }}>
                    {filteredReturns.length} / {pendingReturns.length} Nhiệm vụ
                  </span>
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
                  Shipper đến tận địa chỉ khách hàng nhận lại kiện hàng lỗi và bàn giao về kho cho Kỹ thuật viên QC thẩm định
                </p>
              </div>
            </div>

            {/* Date Quick Filter Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.85rem' }}>
              {[
                { key: 'ALL', label: 'Tất Cả Ngày', count: pendingReturns.length },
                { key: 'TODAY', label: 'Hôm Nay', count: rmaTodayCount },
                { key: 'YESTERDAY', label: 'Hôm Qua', count: rmaYesterdayCount },
                { key: 'LAST_7_DAYS', label: '7 Ngày Qua', count: rma7DaysCount },
                { key: 'LAST_30_DAYS', label: '30 Ngày Qua' },
                { key: 'CUSTOM', label: 'Tùy Chọn Ngày' }
              ].map(dBtn => {
                const isActive = rmaDateFilter === dBtn.key;
                return (
                  <button
                    key={dBtn.key}
                    type="button"
                    onClick={() => setRmaDateFilter(dBtn.key)}
                    style={{
                      border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      borderRadius: '6px',
                      backgroundColor: isActive ? '#2563eb' : '#ffffff',
                      color: isActive ? '#ffffff' : '#334155',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 800 : 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{dBtn.label}</span>
                    {dBtn.count !== undefined && (
                      <span style={{
                        padding: '1px 5px',
                        borderRadius: '10px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        backgroundColor: isActive ? '#ffffff' : '#f1f5f9',
                        color: isActive ? '#2563eb' : '#475569'
                      }}>
                        {dBtn.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search and Secondary Filter Controls */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', backgroundColor: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ flex: '1 1 240px', position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Tìm theo mã RMA, mã đơn, tên khách, SĐT, địa chỉ..."
                  value={rmaSearch}
                  onChange={e => setRmaSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ minWidth: '160px' }}>
                <select
                  value={rmaStatusFilter}
                  onChange={e => setRmaStatusFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontWeight: 600,
                    color: '#334155'
                  }}
                >
                  <option value="ALL">Tất Cả Tiến Độ</option>
                  <option value="PENDING_PICKUP">Chờ Thu Hồi Tại Nhà</option>
                  <option value="RETURNING">Đang Chuyển Về Kho</option>
                  <option value="DELIVERED_WAREHOUSE">Đã Về Kho Cho QC</option>
                </select>
              </div>

              {rmaDateFilter === 'CUSTOM' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={rmaCustomStartDate}
                    onChange={e => setRmaCustomStartDate(e.target.value)}
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>đến</span>
                  <input
                    type="date"
                    value={rmaCustomEndDate}
                    onChange={e => setRmaCustomEndDate(e.target.value)}
                    style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              {(rmaSearch || rmaStatusFilter !== 'ALL' || rmaDateFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setRmaSearch('');
                    setRmaStatusFilter('ALL');
                    setRmaDateFilter('ALL');
                    setRmaCustomStartDate('');
                    setRmaCustomEndDate('');
                  }}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Xóa Bộ Lọc
                </button>
              )}
            </div>

            {/* RMA Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Mã Phiếu & Đơn</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Khách Hàng & SĐT</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Địa Chỉ Thu Hồi</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Lý Do & Loại</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Tiến Độ RMA</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác Shipper</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                        <Package size={36} style={{ color: '#cbd5e1', margin: '0 auto 0.5rem' }} />
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>
                          Không tìm thấy đơn hàng nào khớp với bộ lọc ngày & điều kiện tìm kiếm
                        </div>
                        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0' }}>
                          Vui lòng chọn mốc thời gian khác hoặc bấm <strong>"Tất Cả Ngày"</strong> để xem đầy đủ.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredReturns.map((ret, rIdx) => {
                      const isReturning = ret.status === 'RETURNING_TO_WAREHOUSE';
                      const isDeliveredToWarehouse = ret.status === 'DELIVERED_TO_WAREHOUSE';
                      const isPickupPending = ['PENDING', 'RETURN_APPROVED', 'RETURN_REQUESTED', 'PROCESSING'].includes(ret.status);
                      const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(ret.orderId));
                      const pickupAddr = ret.address || ret.shippingAddress || matchedOrder?.shippingAddress || 'TP. Hồ Chí Minh';

                      return (
                        <tr key={ret.id || rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#7c3aed' }}>
                            <div>#RMA-{ret.id}</div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Đơn: #{ret.orderId}</span>
                            {matchedOrder && (
                              <div style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: 700, marginTop: '3px', backgroundColor: '#f0fdf4', padding: '1px 6px', borderRadius: '4px', border: '1px solid #bbf7d0', display: 'inline-block' }}>
                                🚚 Shipper đã giao: {matchedOrder.assignedShipperName || matchedOrder.assignedShipper || 'Bạn'}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <strong style={{ color: '#0f172a', display: 'block' }}>{ret.customerName || matchedOrder?.customerName}</strong>
                            <span style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 700 }}>{ret.phone || matchedOrder?.phone}</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                            <div>{pickupAddr}</div>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              backgroundColor: ret.type === 'REFUND' ? '#ecfdf5' : '#eff6ff',
                              color: ret.type === 'REFUND' ? '#15803d' : '#1d4ed8',
                              border: `1px solid ${ret.type === 'REFUND' ? '#a7f3d0' : '#bfdbfe'}`,
                              marginBottom: '0.2rem'
                            }}>
                              {ret.type === 'REFUND' ? 'Hoàn tiền 100%' : 'Đổi mới'}
                            </span>
                            <div style={{ color: '#334155', fontSize: '0.75rem' }}>{ret.reason || 'Lỗi sản phẩm'}</div>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            {isPickupPending && (
                              <span style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                                CHỜ THU HỒI
                              </span>
                            )}
                            {isReturning && (
                              <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                                ĐANG CHUYỂN VỀ KHO
                              </span>
                            )}
                            {isDeliveredToWarehouse && (
                              <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                                ĐÃ VỀ KHO (CHỜ QC)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                            {isPickupPending && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!isManagerOrAdmin && matchedOrder && !isShipperMatched(matchedOrder)) {
                                    notify(`⚠️ Chỉ Shipper đã trực tiếp giao đơn #${ret.orderId} (${matchedOrder.assignedShipperName || matchedOrder.assignedShipper}) mới có quyền thu hồi đơn này!`, 'error');
                                    return;
                                  }
                                  await updateReturnStatus(ret.id, 'RETURNING_TO_WAREHOUSE', { note: `Shipper ${user?.fullname || user?.username} đã lấy hàng tại nhà khách` });
                                  setApiReturns(prev => prev.map(item => item.id === ret.id ? { ...item, status: 'RETURNING_TO_WAREHOUSE' } : item));
                                  addNotification('Đã xác nhận thu hồi kiện hàng từ khách! Đang vận chuyển về kho.', 'success');
                                }}
                                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                              >
                                Xác Nhận Đã Thu Hồi
                              </button>
                            )}
                            {isReturning && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!isManagerOrAdmin && matchedOrder && !isShipperMatched(matchedOrder)) {
                                    notify(`⚠️ Chỉ Shipper đã trực tiếp giao đơn #${ret.orderId} mới có quyền bàn giao kiện hàng về kho!`, 'error');
                                    return;
                                  }
                                  await updateReturnStatus(ret.id, 'DELIVERED_TO_WAREHOUSE', { note: `Shipper ${user?.fullname || user?.username} đã bàn giao kiện hàng về kho cho QC` });
                                  setApiReturns(prev => prev.map(item => item.id === ret.id ? { ...item, status: 'DELIVERED_TO_WAREHOUSE' } : item));
                                  addNotification('Đã bàn giao kiện hàng về kho thành công! Chờ QC kiểm định.', 'success');
                                }}
                                style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                              >
                                Bàn Giao Về Kho Cho QC
                              </button>
                            )}
                            {isDeliveredToWarehouse && (
                              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                                Hoàn tất bàn giao
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB 5: HISTORY (LỊCH SỬ & ĐỐI SOÁT COD) */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Lịch Sử Giao Hàng & Bảng Kê Đối Soát COD
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
                Tổng tiền mặt COD đã thu hộ cần nộp lại cho Kế toán: <strong style={{ color: '#16a34a' }}>{fmt(totalCodCollected)}</strong>
              </p>
            </div>
            <button
              onClick={() => addNotification('📤 Đã xuất bảng kê nộp tiền COD cho Phòng Kế Toán!', 'info', '/admin/accountant')}
              style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
            >
              Nộp Tiền & Đối Soát COD
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã Đơn</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Khách Hàng</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Tiền COD</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Trạng Thái Giao</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Ghi Chú Minh Chứng POD</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((ord, oIdx) => (
                  <tr key={ord.id || oIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#2563eb' }}>#{ord.orderId || ord.id}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0f172a' }}>{ord.customerName}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(ord.totalAmount || ord.total)}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: `${STATUS_MAP[ord.status]?.color || '#64748b'}15`, color: STATUS_MAP[ord.status]?.color || '#64748b' }}>
                        {STATUS_MAP[ord.status]?.label || ord.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.75rem' }}>
                      {ord.receiverNote || ord.failReason || 'Đã giao thành công'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: MINH CHỨNG GIAO HÀNG POD NÂNG CẤP CHUẨN ERP ================= */}
      {deliverModal && (() => {
        const codAmount = parseFloat(deliverModal.totalAmount || deliverModal.total || 0);
        const isPrepaid = deliverModal.paymentStatus === 'PAID' || deliverModal.paymentMethod === 'ONLINE_GATEWAY' || deliverModal.paymentMethod === 'BANK_TRANSFER' || codAmount === 0;
        const cleanOrdCode = String(deliverModal.orderId || deliverModal.id || '').replace(/[^a-zA-Z0-9]/g, '');
        const qrUrl = `https://img.vietqr.io/image/970415-1133668899-compact2.jpg?amount=${Math.round(codAmount)}&addInfo=DH%20${cleanOrdCode}&accountName=AETHERPC%20ERP%20CORP`;

        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '600px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>

              {/* Modal Header */}
              <div style={{ padding: '1.1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Biên Bản Giao Hàng & Ký Nhận (POD) #{deliverModal.orderId || deliverModal.id}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Khách nhận: <strong style={{ color: '#2563eb' }}>{deliverModal.customerName}</strong> ({deliverModal.phone})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDeliverModal(null)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.35rem 0.65rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', color: '#475569' }}
                >
                  Đóng
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '1.25rem 1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.82rem' }}>

                {/* 1. Payment Method & Collection Box */}
                {isPrepaid ? (
                  /* KHÁCH ĐÃ CHUYỂN KHOẢN / THANH TOÁN ONLINE TRƯỚC: ẨN TOÀN BỘ CÁC TRƯỜNG THU TIỀN */
                  <div style={{
                    padding: '0.85rem 1.1rem',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e40af' }}>
                          Đơn Hàng Đã Thanh Toán 100% Online / Chuyển Khoản Trước
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#3b82f6', marginTop: '0.1rem' }}>
                          Tiền COD thu hộ: <strong>0 đ</strong>. Shipper chỉ cần kiểm tra người nhận và chụp ảnh ký nhận POD.
                        </div>
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      border: '1px solid #93c5fd',
                      whiteSpace: 'nowrap'
                    }}>
                      ✓ ĐÃ TRẢ 0Đ
                    </span>
                  </div>
                ) : (
                  /* ĐƠN COD: KHÁCH THANH TOÁN KHI NHẬN HÀNG */
                  <div style={{
                    padding: '0.9rem 1.1rem',
                    borderRadius: '8px',
                    backgroundColor: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#15803d' }}>
                          Thu Tiền Đơn Hàng Khi Giao (COD): {fmt(codAmount)}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#166534', marginTop: '0.15rem' }}>
                          Chọn hình thức khách thanh toán thực tế tại chỗ: Tiền mặt hoặc Quét mã VietQR.
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        backgroundColor: '#dcfce7',
                        color: '#15803d'
                      }}>
                        CẦN THU
                      </span>
                    </div>

                    {/* COD Payment Method Selector (Tiền mặt vs VietQR) */}
                    <div style={{ marginTop: '0.25rem', paddingTop: '0.6rem', borderTop: '1px dashed #86efac' }}>
                      <label style={{ display: 'block', fontWeight: 800, color: '#166534', marginBottom: '0.4rem' }}>
                        Hình thức khách thanh toán thực tế khi nhận hàng:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setActualPaymentMethod('CASH');
                            setShowVietQR(false);
                          }}
                          style={{
                            padding: '0.55rem 0.75rem',
                            borderRadius: '6px',
                            border: actualPaymentMethod === 'CASH' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                            backgroundColor: actualPaymentMethod === 'CASH' ? '#dcfce7' : '#ffffff',
                            color: actualPaymentMethod === 'CASH' ? '#15803d' : '#475569',
                            fontWeight: 750,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem'
                          }}
                        >
                          💵 Tiền Mặt (Shipper giữ)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActualPaymentMethod('BANK_TRANSFER');
                            setShowVietQR(true);
                          }}
                          style={{
                            padding: '0.55rem 0.75rem',
                            borderRadius: '6px',
                            border: actualPaymentMethod === 'BANK_TRANSFER' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            backgroundColor: actualPaymentMethod === 'BANK_TRANSFER' ? '#eff6ff' : '#ffffff',
                            color: actualPaymentMethod === 'BANK_TRANSFER' ? '#1d4ed8' : '#475569',
                            fontWeight: 750,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem'
                          }}
                        >
                          📱 Quét QR / Chuyển Khoản Tại Chỗ
                        </button>
                      </div>
                    </div>

                    {/* Nếu chọn Tiền Mặt: Hiển thị ghi nhận xác nhận đã thu đủ tiền mặt */}
                    {actualPaymentMethod === 'CASH' && (
                      <div style={{ padding: '0.45rem 0.75rem', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.76rem', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>✓ Shipper xác nhận đã thu đủ <strong>{fmt(codAmount)}</strong> tiền mặt từ khách.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Dynamic VietQR Display Box (Chỉ hiện khi đơn COD và khách chọn Chuyển khoản tại chỗ) */}
                {actualPaymentMethod === 'BANK_TRANSFER' && !isPrepaid && (
                  <div style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    border: '1.5px solid #93c5fd',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        📱 Mã VietQR Thanh Toán Động (Napas247)
                      </span>
                      <span style={{ fontSize: '0.72rem', backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        Khớp tự động
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ backgroundColor: '#ffffff', padding: '0.4rem', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                        <img
                          src={qrUrl}
                          alt="VietQR Payment"
                          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }}
                        />
                        <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                          Quét bằng App Ngân Hàng
                        </span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#1e293b', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <div><strong>Ngân hàng:</strong> VietinBank (TMCP Công Thương)</div>
                        <div><strong>Số tài khoản:</strong> <span style={{ color: '#2563eb', fontWeight: 800, letterSpacing: '0.5px' }}>1133668899</span></div>
                        <div><strong>Chủ tài khoản:</strong> CONG TY TNHH AETHERPC ERP</div>
                        <div><strong>Số tiền:</strong> <strong style={{ color: '#dc2626' }}>{fmt(codAmount)}</strong></div>
                        <div><strong>Nội dung CK:</strong> <code style={{ backgroundColor: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#2563eb' }}>DH {cleanOrdCode}</code></div>
                      </div>
                    </div>

                    {/* Bank Reference Code Input */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.2rem' }}>
                          Mã Giao Dịch / Mã Chuẩn Chi Ngân Hàng:
                        </label>
                        <input
                          type="text"
                          placeholder="Ví dụ: MB992812, VCB-00381..."
                          value={bankRefCode}
                          onChange={e => setBankRefCode(e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '0.8rem', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.2rem' }}>
                          Biên Lai Chuyển Khoản (Nếu có):
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setPaymentProofPhoto(reader.result);
                              reader.readAsDataURL(file);
                            }
                          }}
                          style={{ width: '100%', fontSize: '0.74rem', color: '#475569' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Recipient Verification (Khách chính chủ vs Nhận thay) */}
                <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontWeight: 800, color: '#1e293b', marginBottom: '0.4rem' }}>
                    Người Nhận Hàng Thực Tế:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: receivedByType === 'REPRESENTATIVE' ? '0.6rem' : '0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>
                      <input
                        type="radio"
                        name="receivedByType"
                        checked={receivedByType === 'DIRECT_CUSTOMER'}
                        onChange={() => setReceivedByType('DIRECT_CUSTOMER')}
                      />
                      <span>Khách chính chủ nhận</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>
                      <input
                        type="radio"
                        name="receivedByType"
                        checked={receivedByType === 'REPRESENTATIVE'}
                        onChange={() => setReceivedByType('REPRESENTATIVE')}
                      />
                      <span>Nhận thay (Người thân / Bảo vệ / Lễ tân)</span>
                    </label>
                  </div>

                  {receivedByType === 'REPRESENTATIVE' && (
                    <div style={{ marginTop: '0.4rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>
                        Họ tên & Quan hệ của người nhận thay:
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Anh Nam (Bảo vệ tòa nhà), Chị Lan (Vợ)..."
                        value={receiverNameActual}
                        onChange={e => setReceiverNameActual(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1.5px solid #2563eb', fontSize: '0.8rem', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </div>

                {/* 3. Photo POD - Live Camera Capture */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Camera size={16} style={{ color: '#2563eb' }} />
                      <span>Chụp Ảnh Minh Chứng Trực Tiếp Từ Máy Shipper (POD) *</span>
                    </label>
                    <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>
                      {proofPhoto ? '✓ Đã chụp ảnh' : '🔴 Camera đang bật'}
                    </span>
                  </div>

                  {/* Camera Viewfinder or Captured Photo Preview */}
                  <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '2px solid #cbd5e1', backgroundColor: '#0f172a', minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                    {/* ĐÃ CHỤP XONG: HIỂN THỊ ẢNH KÈM WATERMARK */}
                    {proofPhoto ? (
                      <div style={{ width: '100%', position: 'relative' }}>
                        <img
                          src={proofPhoto}
                          alt="POD Captured"
                          style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block' }}
                        />
                        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                          <span style={{ backgroundColor: 'rgba(22,163,74,0.9)', color: '#ffffff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, backdropFilter: 'blur(4px)' }}>
                            ✓ ẢNH HỢP LỆ (POD)
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* ĐANG BẬT CAMERA TRỰC TIẾP */
                      <div style={{ width: '100%', height: '220px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: isCameraActive ? 'block' : 'none' }}
                        />

                        {/* Camera grid & Real-time Timestamp overlay */}
                        {isCameraActive && (
                          <>
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', border: '1px dashed rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ width: '70%', height: '70%', border: '2px dashed rgba(37,99,235,0.6)', borderRadius: '8px' }} />
                            </div>

                            {/* Live Clock Stamp at Bottom-Left */}
                            <div style={{
                              position: 'absolute',
                              bottom: '10px',
                              left: '10px',
                              backgroundColor: 'rgba(15, 23, 42, 0.85)',
                              backdropFilter: 'blur(4px)',
                              color: '#ffffff',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              border: '1px solid rgba(34, 197, 94, 0.6)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                              pointerEvents: 'none'
                            }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
                              <span>{currentTime.toLocaleTimeString('vi-VN')} - {currentTime.toLocaleDateString('vi-VN')}</span>
                            </div>
                          </>
                        )}

                        {/* Camera Error / Loading state */}
                        {!isCameraActive && (
                          <div style={{ textAlign: 'center', padding: '1rem', color: '#cbd5e1' }}>
                            <Camera size={32} style={{ color: '#94a3b8', margin: '0 auto 0.5rem' }} />
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                              {cameraError || 'Đang kết nối Camera thiết bị...'}
                            </div>
                            <button
                              type="button"
                              onClick={startCamera}
                              style={{ marginTop: '0.6rem', padding: '0.4rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Thử Mở Lại Camera
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Camera Action Buttons */}
                  <div style={{ marginTop: '0.65rem' }}>
                    {proofPhoto ? (
                      <button
                        type="button"
                        onClick={() => {
                          setProofPhoto('');
                          startCamera();
                        }}
                        style={{ width: '100%', padding: '0.55rem', fontSize: '0.82rem', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                      >
                        <RefreshCw size={15} /> 📸 Chụp Lại Ảnh Khác
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={capturePhoto}
                        disabled={!isCameraActive}
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          backgroundColor: isCameraActive ? '#dc2626' : '#94a3b8',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: isCameraActive ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          boxShadow: isCameraActive ? '0 4px 10px rgba(220,38,38,0.3)' : 'none'
                        }}
                      >
                        <Camera size={18} /> Bấm Chụp Ảnh Minh Chứng (Capture POD)
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Receiver Note Input */}
                <div>
                  <label style={{ display: 'block', fontWeight: 800, color: '#1e293b', marginBottom: '0.3rem' }}>
                    Ghi Chú Ký Nhận / Nhận Xét Của Khách:
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Khách đã đồng kiểm tem niêm phong, ký nhận nguyên vẹn lúc 14h30..."
                    value={receiverNote}
                    onChange={e => setReceiverNote(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.82rem' }}
                  />
                </div>

                {/* System Auto Actions Info */}
                <div style={{ padding: '0.75rem 0.9rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>⚡ Quy trình ERP tự động kích hoạt sau khi bấm Hoàn Tất:</div>
                  <div>✓ Kích hoạt thời hạn <strong>Bảo Hành Điện Tử (Serial Warranty)</strong> bắt đầu từ ngày hôm nay.</div>
                  <div>✓ Ghi nhận dòng tiền: {isPrepaid ? 'Đã thu 100% Online trước (0đ COD)' : (actualPaymentMethod === 'BANK_TRANSFER' ? 'Sổ cái Ngân hàng (khớp mã GD)' : 'Bảng kê tiền mặt Shipper giữ')}.</div>
                  <div>✓ Bắn thông báo xác nhận giao hàng thành công đến <strong>CSKH & Khách hàng</strong>.</div>
                </div>

              </div>

              {/* Modal Footer */}
              <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setDeliverModal(null)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.55rem 1.15rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelivered}
                  style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem 1.4rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 4px rgba(22,163,74,0.25)' }}
                >
                  {isPrepaid
                    ? '✓ Xác Nhận Bàn Giao Hàng Thành Công'
                    : (actualPaymentMethod === 'BANK_TRANSFER' ? '✓ Xác Nhận Đã Nhận CK & Giao Hàng' : '✓ Xác Nhận Thu Tiền Mặt & Giao Hàng')}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ================= MODAL: XỬ LÝ SỰ CỐ & BÁO GIAO THẤT BẠI CHUẨN LOGISTICS ================= */}
      {failModal && (() => {
        const attemptCount = (failModal.deliveryAttempts || 0) + 1;
        const isMaxAttempt = attemptCount >= 3;

        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '520px', padding: '1.75rem', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={20} />
                    <span>Báo Sự Cố Giao Hàng #{failModal.orderId || failModal.id}</span>
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Khách hàng: <strong style={{ color: '#0f172a' }}>{failModal.customerName}</strong> ({failModal.phone})
                  </span>
                </div>
                <button
                  onClick={() => setFailModal(null)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.35rem 0.65rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, color: '#475569' }}
                >
                  Đóng
                </button>
              </div>

              {/* Delivery Attempt Badge */}
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: isMaxAttempt ? '#fef2f2' : '#fffbeb',
                border: `1.5px solid ${isMaxAttempt ? '#fca5a5' : '#fde68a'}`,
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: isMaxAttempt ? '#991b1b' : '#b45309' }}>
                    Giao Thất Bại Lần {attemptCount} / 3
                  </div>
                  <div style={{ fontSize: '0.75rem', color: isMaxAttempt ? '#b91c1c' : '#92400e', marginTop: '0.15rem' }}>
                    {isMaxAttempt
                      ? '⚠️ Đơn hàng đã giao thất bại 3 lần. Quy định hệ thống sẽ tự động CHUYỂN HOÀN VỀ KHO.'
                      : 'Quy chuẩn logistics cho phép giao tối đa 3 lần trước khi hoàn kho.'}
                  </div>
                </div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  backgroundColor: isMaxAttempt ? '#fee2e2' : '#fef3c7',
                  color: isMaxAttempt ? '#991b1b' : '#92400e'
                }}>
                  {attemptCount}/3 LẦN
                </span>
              </div>

              {/* Form Body */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.82rem' }}>

                {/* 1. Reason Select */}
                <div>
                  <label style={{ display: 'block', fontWeight: 800, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Lý Do Không Giao Được *
                  </label>
                  <select
                    value={failReason}
                    onChange={e => setFailReason(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Chọn lý do cụ thể --</option>
                    <option value="Khách hẹn giao lại ngày khác (Bận việc / Đi vắng)">📅 Khách hẹn giao lại ngày khác (Bận việc / Đi vắng)</option>
                    <option value="Không liên lạc được (Gọi 3 cuộc không nghe máy / Thuê bao)">📞 Không liên lạc được (Đã gọi 3 cuộc không nghe / Thuê bao)</option>
                    <option value="Khách từ chối nhận hàng (Bom hàng / Không còn nhu cầu)">🚫 Khách từ chối nhận hàng (Bom hàng / Đổi ý không mua)</option>
                    <option value="Sai địa chỉ nhận hàng / Không tìm thấy số nhà">📍 Sai địa chỉ nhận hàng / Không tìm thấy số nhà</option>
                    <option value="Kiện hàng bị móp méo / Hư hỏng do vận chuyển">📦 Kiện hàng bị móp méo / Hư hỏng do vận chuyển</option>
                  </select>
                </div>

                {/* 2. Resolution Action */}
                <div>
                  <label style={{ display: 'block', fontWeight: 800, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Hướng Xử Lý Tiếp Theo:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}>
                      <input type="radio" name="resAction" defaultChecked />
                      <div>
                        <strong>📅 Hẹn giao lại vào chuyến tiếp theo (Ngày mai)</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Đơn hàng giữ lại trên hệ thống và nhắc nhở Shipper đi giao lại.</div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}>
                      <input type="radio" name="resAction" />
                      <div>
                        <strong style={{ color: '#dc2626' }}>↩️ Chuyển Hoàn Về Kho (Khách hủy / Trả hàng)</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Bàn giao kiện hàng về kho để Thủ kho kiểm tra niêm phong & nhập lại kho.</div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer' }}>
                      <input type="radio" name="resAction" />
                      <div>
                        <strong style={{ color: '#2563eb' }}>📞 Chuyển CSKH gọi điện hỗ trợ xử lý</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Gửi cảnh báo cho bộ phận CSKH liên hệ với khách để cứu đơn hàng.</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 3. Detailed Note */}
                <div>
                  <label style={{ display: 'block', fontWeight: 800, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Ghi Chú Chi Tiết Của Shipper:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ví dụ: Khách bảo đi công tác, hẹn giao lại vào sáng thứ Bảy sau 9h..."
                    value={failNote}
                    onChange={e => setFailNote(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.82rem' }}
                  />
                </div>

                {/* Auto ERP Action Notice */}
                <div style={{ padding: '0.75rem 0.9rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.74rem', color: '#475569' }}>
                  <strong style={{ color: '#0f172a' }}>⚡ Hệ thống tự động:</strong> Ghi nhận nhật ký sự cố, đếm số lần giao thất bại ({attemptCount}/3) và cập nhật thông báo cho CSKH và Quản lý giao vận.
                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setFailModal(null)}
                    style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.55rem 1.15rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleFailDelivery}
                    style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem 1.35rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 4px rgba(220,38,38,0.25)' }}
                  >
                    Xác Nhận Báo Lỗi & Lưu Lịch
                  </button>
                </div>

              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
