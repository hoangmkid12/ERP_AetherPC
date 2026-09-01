import React, { useState, useEffect } from 'react';
import { useSalesStore, useUtilityStore, useInventoryStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { useNotification, notify, confirm } from '../../context/NotificationContext';
import { COMPLAINT_STATUS, getStatusInfo, getStatusLabel } from '../../utils/statusLabels';
import { Search, Package, Clock, ShieldCheck, CheckCircle2, ChevronRight, HelpCircle, RefreshCw, X, AlertCircle, Sparkles, Eye, Upload, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import ReturnRequestModal from '../../components/ReturnRequestModal';

export default function MyOrders() {
  const orders = useSalesStore(state => state.orders) || [];
  const returnRequests = useSalesStore(state => state.returnRequests) || [];
  const addReturnRequest = useSalesStore(state => state.addReturnRequest);
  const updateOrderStatus = useSalesStore(state => state.updateOrderStatus);
  const updateOrderDetails = useSalesStore(state => state.updateOrderDetails);
  const updateReturnStatus = useSalesStore(state => state.updateReturnStatus);
  const addComplaint = useSalesStore(state => state.addComplaint);
  const complaints = useSalesStore(state => state.complaints) || [];
  const assemblyJobs = useUtilityStore(state => state.assemblyJobs) || [];
  const products = useInventoryStore(state => state.products) || [];
  const { user } = useAuth() || {};
  const { addNotification } = useNotification() || {};
  const [phoneQuery, setPhoneQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  
  // Edit Order Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ customerName: '', phone: '', shippingAddress: '', notes: '' });
  const [editTargetOrder, setEditTargetOrder] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(null);

  // Return Modal State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnTargetOrder, setReturnTargetOrder] = useState(null);
  const [returnSuccess, setReturnSuccess] = useState(false);

  // Cancel Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelForm, setCancelForm] = useState({ reason: '', evidenceUrl: '' });
  const [cancelTargetOrder, setCancelTargetOrder] = useState(null);
  // Complaint / Ticket Modal State
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintForm, setComplaintForm] = useState({ orderId: '', title: '', description: '', priority: 'HIGH' });
  const [complaintSuccess, setComplaintSuccess] = useState(false);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [viewTicketDetail, setViewTicketDetail] = useState(null);
  // Proof of Delivery (POD) Image Lightbox Modal State
  const [viewProofImage, setViewProofImage] = useState(null);
  // Refund Support Contact Modal State
  const [viewRefundContactModal, setViewRefundContactModal] = useState(null);

  const handleCustomerConfirmRefundReceived = async (returnItem) => {
    if (!returnItem) return;
    if (await confirm('Xác nhận bạn đã nhận được đủ 100% số tiền hoàn vào tài khoản ngân hàng?')) {
      const confirmedData = {
        customerConfirmedRefund: true,
        customerConfirmedAt: new Date().toISOString()
      };

      if (typeof updateReturnStatus === 'function') {
        try {
          await updateReturnStatus(returnItem.orderId || returnItem.id, 'REFUNDED', confirmedData);
        } catch (err) {
          notify(`Không thể ghi nhận xác nhận: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
          return;
        }
      }

      // Sync local storage
      try {
        const localList = JSON.parse(localStorage.getItem('erp_return_requests') || '[]');
        const updatedList = localList.map(r => {
          if (String(r.id) === String(returnItem.id) || String(r.orderId) === String(returnItem.orderId)) {
            return { ...r, ...confirmedData };
          }
          return r;
        });
        localStorage.setItem('erp_return_requests', JSON.stringify(updatedList));
      } catch (_) {}

      notify('Cảm ơn bạn đã xác nhận đã nhận đủ tiền hoàn 100%.', 'success');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('complaint') === 'true' || params.get('support') === 'true') {
      setShowComplaintModal(true);
    }
  }, []);

  useEffect(() => {
    if (user) {
      if (user.phone) setPhoneQuery(user.phone);
      else if (user.email) setPhoneQuery(user.email);
      setSearched(true);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    const loadSavedAddresses = async () => {
      try {
        const list = (await api.get('/customers/addresses')).data || [];
        if (active) setSavedAddresses([...list].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || Number(b.id) - Number(a.id)));
      } catch (error) {
        console.warn('Unable to load saved addresses:', error);
      }
    };
    if (user) loadSavedAddresses();
    return () => { active = false; };
  }, [user]);

  const applySavedAddressToOrder = (address) => {
    setSelectedSavedAddressId(address.id);
    setEditForm(current => ({
      ...current,
      customerName: address.recipientName || current.customerName,
      phone: address.recipientPhone || current.phone,
      shippingAddress: [address.addressLine, address.ward, address.district, address.city].filter(Boolean).join(', ')
    }));
  };
  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (!phoneQuery.trim()) return;
    setSearched(true);
  };

  const cleanPhone = (p) => p ? String(p).replace(/\D/g, '') : '';

  const userPhoneDigits = user?.phone ? cleanPhone(user.phone) : '';
  const userEmailClean = user?.email ? user.email.trim().toLowerCase() : '';
  const userNameClean = user?.name ? user.name.trim().toLowerCase() : '';

  const matchedOrders = (orders || []).filter(order => {
    const orderPhoneDigits = cleanPhone(order.phone || order.customerPhone || '');
    const orderEmailClean = (order.email || order.customerEmail || '').trim().toLowerCase();
    const orderNameClean = (order.customerName || order.name || '').trim().toLowerCase();
    const orderUserId = order.userId || order.customerId;

    // Strict account check: Does this order belong to the logged-in user?
    const isUserOrder = Boolean(
      (userPhoneDigits && orderPhoneDigits && orderPhoneDigits === userPhoneDigits) ||
      (userEmailClean && orderEmailClean && orderEmailClean === userEmailClean) ||
      (user?.id && orderUserId && String(orderUserId) === String(user.id)) ||
      (userNameClean && orderNameClean && orderNameClean === userNameClean)
    );

    if (user) {
      const queryClean = phoneQuery.trim().toLowerCase();
      const queryDigits = cleanPhone(phoneQuery);

      // If user typed a search query specifically, match that query across all orders
      if (queryClean && queryClean !== userEmailClean && queryDigits !== userPhoneDigits) {
        return (
          (queryDigits && orderPhoneDigits.includes(queryDigits)) ||
          (queryClean && orderEmailClean.includes(queryClean)) ||
          (queryClean && order.orderId?.toLowerCase().includes(queryClean)) ||
          (queryClean && orderNameClean.includes(queryClean))
        );
      }

      // If matches user account, return
      if (isUserOrder) return true;

      // Fallback: If logged in user has no orders, allow displaying demo/search orders
      if (queryDigits && orderPhoneDigits.includes(queryDigits)) return true;
      if (queryClean && (orderEmailClean.includes(queryClean) || order.orderId?.toLowerCase().includes(queryClean))) return true;
      return false;
    }

    // Guest search mode (Not logged in or public lookup):
    if (!phoneQuery.trim()) {
      // If not searched yet, show recent orders as preview
      return true;
    }
    const queryClean = phoneQuery.trim().toLowerCase();
    const queryDigits = cleanPhone(phoneQuery);

    return (
      (queryDigits && orderPhoneDigits.includes(queryDigits)) ||
      (queryClean && orderEmailClean.includes(queryClean)) ||
      (queryClean && order.orderId?.toLowerCase().includes(queryClean)) ||
      (queryClean && orderNameClean.includes(queryClean))
    );
  });

  const userComplaints = (complaints || []).filter(c => {
    // 1. Match by order ID in matched orders list
    if (c.orderId && matchedOrders.some(mo => mo.orderId === c.orderId)) {
      return true;
    }

    // 2. Match by logged-in user details
    if (user) {
      const uPhone = userPhoneDigits;
      const uEmail = userEmailClean;
      const uName = userNameClean;

      const cPhone = cleanPhone(c.phone);
      const cEmail = (c.email || '').trim().toLowerCase();
      const cName = (c.customerName || '').trim().toLowerCase();

      if (uPhone && cPhone && uPhone === cPhone) return true;
      if (uEmail && cEmail && uEmail === cEmail) return true;
      if (uName && cName && (cName.includes(uName) || uName.includes(cName))) return true;
    }

    // 3. Match by guest search query
    if (searched && phoneQuery.trim()) {
      const queryClean = phoneQuery.trim().toLowerCase();
      const queryDigits = cleanPhone(phoneQuery);
      const cPhone = cleanPhone(c.phone);
      const cEmail = (c.email || '').trim().toLowerCase();
      const cName = (c.customerName || '').trim().toLowerCase();
      const cId = (c.id || '').toLowerCase();

      if (queryDigits && cPhone && cPhone.includes(queryDigits)) return true;
      if (queryClean && cEmail && cEmail.includes(queryClean)) return true;
      if (queryClean && cName && cName.includes(queryClean)) return true;
      if (queryClean && cId && cId.includes(queryClean)) return true;
    }

    return false;
  });

  useEffect(() => {
    if (matchedOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(matchedOrders[0].orderId);
    }
  }, [matchedOrders, selectedOrderId]);

  const selectedOrder = orders.find(o => o.orderId === selectedOrderId) || matchedOrders[0];

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0);
  };

  const getOrderStatusLabel = (order) => {
    const status = typeof order === 'string' ? order : order?.status;
    const isExcOrder = typeof order === 'object' && (order?.type === 'EXCHANGE' || String(order?.orderId).startsWith('ORD-EXC-'));

    // Check if order has an associated ReturnRequest
    const rma = typeof order === 'object' && returnRequests?.find(r => 
      String(r.orderId) === String(order?.orderId) || 
      String(r.id) === String(order?.orderId) ||
      (order?.originalOrderId && String(r.orderId) === String(order?.originalOrderId)) ||
      (isExcOrder && String(order?.orderId).replace('ORD-EXC-', 'ORD-') === String(r.orderId)) ||
      (isExcOrder && String(order?.orderId).includes(String(r.orderId).replace('ORD-', '')))
    );

    if (isExcOrder) {
      if (['DELIVERED', 'COMPLETED'].includes(status)) {
        return { text: 'Nhận đổi mới xong', color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' };
      }
      if (['SHIPPED', 'OUT_FOR_DELIVERY'].includes(status)) {
        return { text: 'Đang giao đổi', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
      }
      return { text: 'Đổi mới (0đ)', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
    }

    if (rma) {
      const isExchange = rma.type === 'EXCHANGE';
      if (rma.status === 'REFUNDED') {
        return { text: 'Đã hoàn tiền 100%', color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' };
      }
      if (rma.status === 'EXCHANGED') {
        return { text: 'Đã xuất đơn đổi mới', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
      }
      if (rma.status === 'RESTOCKED' || rma.status === 'QC_PASSED') {
        return { text: isExchange ? 'Kho đã nhận hàng cũ' : 'Đang lập lệnh hoàn tiền', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' };
      }
      if (rma.status === 'RETURNING_TO_WAREHOUSE' || rma.status === 'DELIVERED_TO_WAREHOUSE') {
        return { text: isExchange ? 'Đang thu hồi đổi' : 'Đang thu hồi trả hàng', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' };
      }
      return { text: isExchange ? 'Yêu cầu đổi hàng' : 'Yêu cầu hoàn tiền', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    }

    switch (status) {
      case 'PENDING':
        return { text: 'Chờ xác nhận', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' };
      case 'WAITING_PAYMENT':
        return { text: 'Chờ thanh toán', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' };
      case 'AWAITING_STOCK':
        return { text: 'Chờ hàng về', color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' };
      case 'CONFIRMED':
      case 'PROCESSING':
      case 'PACKED':
        return { text: 'Chờ lấy hàng', color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)' };
      case 'READY_TO_SHIP':
        return { text: 'Chờ giao hàng', color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)' };
      case 'SHIPPED':
        return { text: 'Đang giao hàng', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)' };
      case 'SHIPPING_FAILED':
      case 'FAILED_DELIVERY':
        return { text: 'Giao thất bại', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' };
      case 'DELIVERED':
        return { text: 'Đã giao', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' };
      case 'COMPLETED':
        return { text: 'Hoàn tất', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' };
      case 'RETURN_REQUESTED':
      case 'RETURN_APPROVED':
      case 'RETURNING_TO_WAREHOUSE':
      case 'RETURNING':
      case 'RETURNED':
      case 'REFUNDED':
        return { text: 'Trả hàng / Hoàn tiền', color: '#ec4899', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.3)' };
      case 'CANCELLED':
        return { text: 'Đã hủy', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' };
      default:
        return { text: 'Đang xử lý', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' };
    }
  };

  const handleComplaintSubmit = async () => {
    if (!complaintForm.title.trim() || !complaintForm.description.trim()) {
      addNotification('Vui lòng nhập đầy đủ tiêu đề và nội dung khiếu nại.', 'error');
      return;
    }
    if (typeof addComplaint !== 'function') return;
    setSubmittingComplaint(true);
    try {
      await addComplaint({
        customerName: user?.fullname || selectedOrder?.customerName || 'Khách Hàng',
        phone: user?.phone || selectedOrder?.phone || '0901234567',
        email: user?.email || selectedOrder?.email || 'khachhang@email.com',
        orderId: complaintForm.orderId || selectedOrder?.orderId || '',
        title: complaintForm.title,
        description: complaintForm.description,
        priority: complaintForm.priority || 'HIGH',
        evidenceUrl: complaintForm.evidenceUrl || ''
      });

      setShowComplaintModal(false);
      setComplaintForm({ orderId: '', title: '', description: '', priority: 'HIGH', evidenceUrl: '' });
      setComplaintSuccess(true);
      setTimeout(() => setComplaintSuccess(false), 6000);
    } catch (err) {
      addNotification(`Gửi khiếu nại thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const getStatusProgress = (status, returnItem = null, order = null) => {
    const isExcReplacementOrder = Boolean(order && (order.type === 'EXCHANGE' || String(order.orderId).startsWith('ORD-EXC-')));

    // Case 1: ĐƠN HÀNG XUẤT ĐỔI MỚI 1-1 (Đơn hàng giao kiện mới cho khách)
    if (isExcReplacementOrder) {
      const excSteps = ['Duyệt đổi mới 1-1', 'Kho đóng gói hàng mới', 'Shipper tiếp nhận', 'Đang giao đổi tận nơi', 'Nhận hàng mới'];
      let activeIdx = 1;
      if (['CONFIRMED', 'PROCESSING', 'PACKED'].includes(status)) {
        activeIdx = 1;
      } else if (status === 'READY_TO_SHIP') {
        activeIdx = 2;
      } else if (['SHIPPED', 'OUT_FOR_DELIVERY'].includes(status)) {
        activeIdx = 3;
      } else if (['DELIVERED', 'COMPLETED'].includes(status)) {
        activeIdx = 4;
      }

      const isCompleted = ['DELIVERED', 'COMPLETED'].includes(status);
      const stepColor = '#7c3aed';

      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', width: '100%', padding: '0.5rem 0' }}>
            {excSteps.map((stepName, idx) => {
              const isDone = idx < activeIdx || (idx === activeIdx && isCompleted);
              const isActive = idx === activeIdx && !isDone;
              const isLineActive = idx <= activeIdx;

              return (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <div style={{
                      flex: 1,
                      height: '2.5px',
                      backgroundColor: isLineActive ? stepColor : '#e2e8f0',
                      margin: '0 0.25rem',
                      marginBottom: '1.25rem',
                      transition: 'all 0.3s ease'
                    }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: isDone ? stepColor : isActive ? '#f5f3ff' : '#f8fafc',
                      border: isActive ? `2px solid ${stepColor}` : isDone ? `2px solid ${stepColor}` : '1.5px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isDone ? '#ffffff' : isActive ? stepColor : '#64748b',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      boxShadow: isActive ? '0 0 10px rgba(124, 58, 237, 0.35)' : 'none',
                      transition: 'all 0.3s ease'
                    }}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      color: isDone || isActive ? '#0f172a' : '#64748b',
                      marginTop: '0.4rem',
                      textAlign: 'center',
                      fontWeight: isActive || isDone ? 750 : 500,
                      whiteSpace: 'nowrap'
                    }}>
                      {stepName}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div style={{ marginTop: '0.65rem', padding: '0.6rem 0.85rem', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem' }}>
            <span style={{ color: '#6d28d9', fontWeight: 600 }}>
              <strong>Đơn hàng Đổi mới 1-1 (0đ)</strong> — Sản phẩm mới đang được chuẩn bị để giao tận tay bạn.
            </span>
            {order?.originalOrderId && (
              <span style={{ color: '#64748b' }}>
                Đơn gốc liên kết: <strong>#{order.originalOrderId}</strong>
              </span>
            )}
          </div>
        </div>
      );
    }

    // Case 2: ĐƠN HÀNG GỐC CÓ YÊU CẦU ĐỔI TRẢ / HOÀN TIỀN (RMA Flow)
    const isReturnFlow = Boolean(
      returnItem ||
      ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNING_TO_WAREHOUSE', 'DELIVERED_TO_WAREHOUSE', 'QC_PASSED', 'RESTOCKED', 'EXCHANGED', 'REFUNDED'].includes(status)
    );

    if (isReturnFlow) {
      const isExchange = returnItem?.type === 'EXCHANGE' || status === 'EXCHANGED';
      const rmaStatus = returnItem?.status || status;

      const rmaSteps = isExchange
        ? ['1. Gửi yêu cầu đổi', '2. Shipper thu hồi', '3. QC Thẩm định', '4. Nhập hàng cũ', '5. Đơn Đổi Mới (#ORD-EXC)']
        : ['1. Gửi yêu cầu trả', '2. Shipper thu hồi', '3. QC Thẩm định', '4. Thủ kho xếp kệ', '5. Hoàn tiền 100%'];

      let activeIdx = 0;
      if (['PENDING', 'RETURN_REQUESTED', 'RETURN_APPROVED'].includes(rmaStatus)) {
        activeIdx = 0;
      } else if (rmaStatus === 'RETURNING_TO_WAREHOUSE') {
        activeIdx = 1;
      } else if (rmaStatus === 'DELIVERED_TO_WAREHOUSE') {
        activeIdx = 2;
      } else if (rmaStatus === 'QC_PASSED') {
        activeIdx = 3;
      } else if (['RESTOCKED', 'EXCHANGED', 'REFUNDED', 'EXCHANGE_NEW'].includes(rmaStatus)) {
        activeIdx = 4;
      }

      const isCompletedAll = (isExchange && (rmaStatus === 'EXCHANGED' || rmaStatus === 'RESTOCKED' || rmaStatus === 'EXCHANGE_NEW')) || (!isExchange && rmaStatus === 'REFUNDED');
      const stepColor = isExchange ? '#2563eb' : '#16a34a';

      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', width: '100%', padding: '0.5rem 0' }}>
            {rmaSteps.map((stepName, idx) => {
              const isDone = idx < activeIdx || (idx === activeIdx && isCompletedAll);
              const isActive = idx === activeIdx && !isDone;
              const isLineActive = idx <= activeIdx;

              return (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <div style={{
                      flex: 1,
                      height: '2.5px',
                      backgroundColor: isLineActive ? stepColor : '#e2e8f0',
                      margin: '0 0.25rem',
                      marginBottom: '1.25rem',
                      transition: 'all 0.3s ease'
                    }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: isDone ? stepColor : isActive ? (isExchange ? '#eff6ff' : '#f0fdf4') : '#f8fafc',
                      border: isActive ? `2px solid ${stepColor}` : isDone ? `2px solid ${stepColor}` : '1.5px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isDone ? '#ffffff' : isActive ? stepColor : '#64748b',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      boxShadow: isActive ? `0 0 10px ${isExchange ? 'rgba(37,99,235,0.35)' : 'rgba(22,163,74,0.35)'}` : 'none',
                      transition: 'all 0.3s ease'
                    }}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      color: isDone || isActive ? '#0f172a' : '#64748b',
                      marginTop: '0.4rem',
                      textAlign: 'center',
                      fontWeight: isActive || isDone ? 750 : 500,
                      whiteSpace: 'nowrap'
                    }}>
                      {stepName}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div style={{ marginTop: '0.65rem', padding: '0.6rem 0.85rem', backgroundColor: isExchange ? '#eff6ff' : '#f0fdf4', border: `1px solid ${isExchange ? '#bfdbfe' : '#bbf7d0'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem' }}>
            <span style={{ color: isExchange ? '#1e40af' : '#15803d', fontWeight: 600 }}>
              {isExchange ? 'Tiến độ Đổi Mới 1-1 Sản Phẩm Lỗi NSX' : 'Tiến độ Trả Hàng & Hoàn Tiền 100% về STK'}
            </span>
            <span style={{ color: '#64748b' }}>
              Trạng thái: <strong>{rmaStatus === 'REFUNDED' ? 'Đã hoàn tất chuyển tiền 100%' : (rmaStatus === 'EXCHANGED' || rmaStatus === 'RESTOCKED') ? 'Đã xuất Đơn Đổi Mới' : rmaStatus === 'DELIVERED_TO_WAREHOUSE' ? 'Đang thẩm định QC tại kho' : rmaStatus === 'RETURNING_TO_WAREHOUSE' ? 'Shipper đang thu hồi' : 'Chờ xử lý'}</strong>
            </span>
          </div>
        </div>
      );
    }

    // Case 3: Trạng thái Đang Chờ Hàng Về Kho (AWAITING_STOCK)
    if (status === 'AWAITING_STOCK') {
      const awaitingSteps = ['Chờ xác nhận', 'Chờ hàng về kho', 'Chờ lấy hàng', 'Chờ giao hàng', 'Đang giao hàng', 'Đã giao'];
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', width: '100%', padding: '0.5rem 0' }}>
          {awaitingSteps.map((stepName, idx) => {
            const isCompleted = idx < 1;
            const isActive = idx === 1;
            return (
              <React.Fragment key={stepName}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1, flex: idx < awaitingSteps.length - 1 ? 1 : 'none' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    backgroundColor: isCompleted ? 'var(--success)' : isActive ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.05)',
                    border: isCompleted ? '2px solid var(--success)' : isActive ? '2px solid #f97316' : '2px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isCompleted ? '#fff' : isActive ? '#f97316' : 'var(--text-muted)',
                    fontSize: '0.7rem', fontWeight: 'bold', flexShrink: 0
                  }}>
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: isActive ? '#f97316' : isCompleted ? 'var(--success)' : 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: isActive ? 700 : 400 }}>{stepName}</span>
                </div>
                {idx < awaitingSteps.length - 1 && (
                  <div style={{ flex: 1, height: '2px', backgroundColor: isCompleted ? 'var(--success)' : 'rgba(255,255,255,0.08)', margin: '0 4px', marginBottom: '22px', minWidth: '20px' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      );
    }

    // Case 4: Trạng thái Đã Hủy Đơn (CANCELLED)
    if (status === 'CANCELLED') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>✓</div>
            <span>Đặt hàng</span>
          </div>
          <div style={{ width: '80px', height: '2px', backgroundColor: '#ef4444' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.2)', border: '1.5px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold' }}>✕</div>
            <strong style={{ fontSize: '0.85rem' }}>Đã hủy đơn</strong>
          </div>
        </div>
      );
    }

    // Case 5: Quy trình Giao Hàng Tiêu Chuẩn 5 bước
    const steps = ['Chờ xác nhận', 'Chờ lấy hàng', 'Chờ giao hàng', 'Đang giao hàng', 'Đã giao'];
    
    let activeIdx = 0;
    if (status === 'PENDING') {
      activeIdx = 0;
    } else if (['CONFIRMED', 'PROCESSING', 'PACKED'].includes(status)) {
      activeIdx = 1;
    } else if (status === 'READY_TO_SHIP') {
      activeIdx = 2;
    } else if (['SHIPPED', 'SHIPPING_FAILED'].includes(status)) {
      activeIdx = 3;
    } else if (['DELIVERED', 'COMPLETED'].includes(status)) {
      activeIdx = 4;
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', width: '100%', padding: '0.5rem 0' }}>
        {steps.map((stepName, idx) => {
          const isDone = idx < activeIdx || (idx === activeIdx && (status === 'DELIVERED' || status === 'COMPLETED'));
          const isActive = idx === activeIdx && !isDone;
          const isLineActive = idx <= activeIdx;
          return (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <div style={{ 
                  flex: 1, 
                  height: '2.5px', 
                  backgroundColor: isLineActive ? '#2563eb' : '#e2e8f0',
                  margin: '0 0.25rem',
                  marginBottom: '1.25rem',
                  transition: 'all 0.3s ease'
                }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                <div style={{ 
                  width: '30px', 
                  height: '30px', 
                  borderRadius: '50%', 
                  backgroundColor: isDone ? '#2563eb' : isActive ? '#eff6ff' : '#f8fafc',
                  border: isActive ? '2px solid #2563eb' : isDone ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: isDone ? '#ffffff' : isActive ? '#2563eb' : '#64748b',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  boxShadow: isActive ? '0 0 10px rgba(37,99,235,0.3)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <span style={{ 
                  fontSize: '0.7rem', 
                  color: isDone || isActive ? '#0f172a' : '#64748b', 
                  marginTop: '0.4rem', 
                  textAlign: 'center',
                  fontWeight: isActive || isDone ? 750 : 500,
                  whiteSpace: 'nowrap'
                }}>
                  {stepName}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container" style={{ padding: '3rem 1.5rem 5rem 1.5rem', minHeight: '80vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontFamily: 'var(--font-title)',
          color: '#0f172a',
          fontWeight: 800,
          marginBottom: '0.5rem'
        }}>
          Tra Cứu Tiến Độ Đơn Hàng
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Nhập số điện thoại mua hàng để theo dõi chi tiết hóa đơn và trạng thái vận chuyển của đơn hàng.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          {userComplaints.length > 0 ? (
            <>
              <button
                onClick={() => {
                  const el = document.getElementById('complaintHistorySection');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn hover-scale"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '10px', backgroundColor: '#2563eb', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.88rem', padding: '0.6rem 1.35rem', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', cursor: 'pointer' }}
              >
                <HelpCircle size={18} /> Theo Dõi Lịch Sử Khiếu Nại ({userComplaints.length})
              </button>

              <button
                onClick={() => {
                  setComplaintForm({ orderId: selectedOrder?.orderId || '', title: '', description: '', priority: 'HIGH', evidenceUrl: '' });
                  setShowComplaintModal(true);
                }}
                className="btn hover-scale"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '10px', backgroundColor: '#ef4444', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.88rem', padding: '0.6rem 1.35rem', boxShadow: '0 4px 14px rgba(239,68,68,0.3)', cursor: 'pointer' }}
              >
                <AlertCircle size={18} /> Gửi Ticket Khiếu Nại Mới
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setComplaintForm({ orderId: selectedOrder?.orderId || '', title: '', description: '', priority: 'HIGH', evidenceUrl: '' });
                setShowComplaintModal(true);
              }}
              className="btn hover-scale"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '10px', backgroundColor: '#ef4444', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.88rem', padding: '0.6rem 1.35rem', boxShadow: '0 4px 14px rgba(239,68,68,0.3)', cursor: 'pointer' }}
            >
              <AlertCircle size={18} /> Gửi Ticket Khiếu Nại & Hỗ Trợ
            </button>
          )}
        </div>
      </div>

      {complaintSuccess && (
        <div style={{ maxWidth: '600px', margin: '0 auto 1.5rem', padding: '1rem 1.25rem', backgroundColor: '#ecfdf5', border: '1.5px solid #10b981', borderRadius: '12px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700, boxShadow: '0 4px 12px rgba(16,185,129,0.15)' }}>
          <CheckCircle2 size={22} style={{ color: '#10b981', flexShrink: 0 }} />
          <span>Đã gửi Ticket Khiếu nại & Hỗ trợ thành công. Bộ phận CSKH AetherPC sẽ tiếp nhận và liên hệ bạn trong thời gian sớm nhất.</span>
        </div>
      )}

      {/* Search Input Bar with Quick Lookup Chips */}
      <div className="card-glass" style={{ maxWidth: '680px', margin: '0 auto 2.5rem auto', padding: '1.25rem 1.5rem', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Nhập số điện thoại, email hoặc mã đơn (#ORD-...)..."
              value={phoneQuery}
              onChange={(e) => setPhoneQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', backgroundColor: '#2563eb', fontWeight: 700 }}>
            Tra Cứu
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.85rem', fontSize: '0.75rem', color: '#64748b' }}>
          <span style={{ fontWeight: 600 }}>Gợi ý tra cứu nhanh:</span>
          {[
            { label: 'Tất cả đơn', val: '' },
            { label: '0901234567 (Hùng)', val: '0901234567' },
            { label: '0987654321 (Hoa)', val: '0987654321' },
            { label: '1231231231 (Hiếu)', val: '1231231231' },
            { label: '123123 (sang)', val: '123123' }
          ].map(chip => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                setPhoneQuery(chip.val);
                setSearched(true);
              }}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                backgroundColor: phoneQuery === chip.val ? '#eff6ff' : '#f8fafc',
                color: phoneQuery === chip.val ? '#2563eb' : '#475569',
                padding: '2px 8px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {searched && matchedOrders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', margin: '0 auto 2.5rem', maxWidth: '680px' }}>
          <Package size={36} style={{ color: '#94a3b8', marginBottom: '0.6rem' }} />
          <div style={{ fontWeight: 700, color: '#334155', fontSize: '0.95rem' }}>
            Không tìm thấy đơn hàng nào khớp với từ khóa "{phoneQuery}"
          </div>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.35rem' }}>
            Vui lòng kiểm tra lại số điện thoại hoặc bấm vào <strong>"Tất cả đơn"</strong> ở trên để xem danh sách.
          </p>
        </div>
      )}

      {matchedOrders.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* Left Column: Orders List */}
          <div className="card-glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={16} />
              Đơn Hàng Đã Tìm Thấy ({matchedOrders.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {matchedOrders.map(order => (
                <div
                  key={order.orderId}
                  onClick={() => setSelectedOrderId(order.orderId)}
                  style={{
                    padding: '1rem',
                    border: selectedOrderId === order.orderId ? '1.5px solid var(--primary)' : '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: selectedOrderId === order.orderId ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>{order.orderId}</strong>
                    {(() => {
                      const badge = getOrderStatusLabel(order);
                      return (
                        <span 
                          style={{ 
                            fontSize: '0.65rem', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            color: badge.color, 
                            backgroundColor: badge.bg, 
                            border: `1px solid ${badge.border}` 
                          }}
                        >
                          {badge.text}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ngày: {order.date}</span>
                    <strong style={{ color: 'var(--success)' }}>{formatPrice(order.totalAmount)}</strong>
                  </div>
                </div>
              ))}
            </div>

          {/* Return success banner */}
          {returnSuccess && (
            <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.875rem' }}>
              <CheckCircle2 size={16}/> Yêu cầu đổi trả đã được gửi! CSKH sẽ liên hệ bạn trong 24h.
            </div>
          )}
        </div>

          {/* Right Column: Detail Order Status */}
          {selectedOrder && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Order Info */}
              <div className="card-glass" style={{ padding: '1.25rem 1.5rem' }}>
                {(() => {
                  let orderItems = selectedOrder.items;
                  if (typeof orderItems === 'string') {
                    try { orderItems = JSON.parse(orderItems); } catch(e) { orderItems = []; }
                  }
                  if (!Array.isArray(orderItems) || orderItems.length === 0) {
                    orderItems = selectedOrder.products || [
                      { productId: 1, name: 'Intel Core i5-13400F', price: 4890000, quantity: 1, category: 'CPU' },
                      { productId: 3, name: 'ASUS ROG STRIX B760-F Gaming WiFi', price: 5490000, quantity: 1, category: 'MAINBOARD' },
                      { productId: 8, name: 'MSI GeForce RTX 4060 Ventus 2X 8GB OC', price: 8390000, quantity: 1, category: 'VGA' }
                    ];
                  }
                  const hasItems = orderItems.length > 0;
                  return (
                    <>
                      <div style={{
                        display: 'flex',
                        justify: 'space-between',
                        borderBottom: hasItems ? '1px solid #e2e8f0' : 'none',
                        paddingBottom: hasItems ? '1rem' : 0,
                        marginBottom: hasItems ? '1rem' : 0,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem'
                      }}>
                        <div style={{ flex: 1, minWidth: '250px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.25rem', color: '#0f172a', margin: 0 }}>Chi Tiết Đơn Hàng: {selectedOrder.orderId}</h3>
                            
                            {/* Exchange order badge */}
                            {(selectedOrder.type === 'EXCHANGE' || String(selectedOrder.orderId).startsWith('ORD-EXC-')) && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                Đơn Hàng Đổi Mới 1-1
                              </span>
                            )}

                            {/* Demo Helper Button */}
                            {['PENDING'].includes(selectedOrder.status) && (
                              <button 
                                onClick={() => {
                                  // Directly simulate 5h+ age and trigger auto-approval flow
                                  const stored = localStorage.getItem('erp_orders');
                                  if (stored) {
                                    const parsed = JSON.parse(stored);
                                    const updated = parsed.map(o => {
                                      if (o.orderId === selectedOrder.orderId) {
                                        return { ...o, createdAtTime: Date.now() - 5.1 * 60 * 60 * 1000 };
                                      }
                                      return o;
                                    });
                                    localStorage.setItem('erp_orders', JSON.stringify(updated));
                                    // Reload page so ERPContext scheduler picks up new createdAtTime
                                    setTimeout(() => window.location.reload(), 100);
                                  }
                                }}
                                className="btn" 
                                style={{ 
                                  padding: '0.25rem 0.625rem', 
                                  fontSize: '0.75rem', 
                                  background: 'rgba(59,130,246,0.1)', 
                                  color: '#3b82f6', 
                                  border: '1px solid rgba(59,130,246,0.25)', 
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center', 
                                  gap: '0.25rem' 
                                }}
                              >
                                <Sparkles size={12}/> Tua nhanh 5h
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
                              Khách hàng: <strong style={{ color: '#0f172a' }}>{selectedOrder.customerName}</strong> | Ngày mua: {selectedOrder.date}
                            </p>
                            {(selectedOrder.originalOrderId || (String(selectedOrder.orderId).startsWith('ORD-EXC-') && orders.some(o => o.orderId === String(selectedOrder.orderId).replace('ORD-EXC-', 'ORD-')))) && (() => {
                              const origId = selectedOrder.originalOrderId || String(selectedOrder.orderId).replace('ORD-EXC-', 'ORD-');
                              return (
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderId(origId)}
                                  style={{
                                    border: '1px solid #bfdbfe',
                                    backgroundColor: '#eff6ff',
                                    color: '#2563eb',
                                    borderRadius: '6px',
                                    fontSize: '0.74rem',
                                    padding: '2px 8px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}
                                >
                                  Xem đơn gốc #{origId}
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Hình thức: {selectedOrder.type}</span>
                          <h4 style={{ color: (selectedOrder.type === 'EXCHANGE' || String(selectedOrder.orderId).startsWith('ORD-EXC-')) ? '#7c3aed' : '#16a34a', fontWeight: 'bold', fontSize: '1.25rem', marginTop: '0.25rem', marginBottom: 0 }}>
                            {formatPrice(selectedOrder.totalAmount)}
                          </h4>
                          {(selectedOrder.type === 'EXCHANGE' || String(selectedOrder.orderId).startsWith('ORD-EXC-')) && (
                            <span style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 600, display: 'block' }}>
                              (Bù trừ bảo hành 100%)
                            </span>
                          )}
                        </div>
                      </div>

                      {hasItems && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {orderItems.map((item, idx) => {
                            const productInfo = products?.find(p => p.id === item.productId || p.productId === item.productId);
                            const displayImage = item.image || item.primaryImage || productInfo?.image || productInfo?.primaryImage || productInfo?.imageUrls?.[0];
                            
                            return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.875rem', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: 1 }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {displayImage ? (
                                    <img src={displayImage} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <Package size={24} color="#94a3b8" />
                                  )}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <span className="badge badge-info" style={{ fontSize: '0.65rem', marginBottom: '0.2rem', display: 'inline-block', fontWeight: 700 }}>{item.category || 'LINH KIỆN'}</span>
                                  <Link to={`/product/${item.productId}`} style={{ textDecoration: 'none', color: '#0f172a', minWidth: 0 }}>
                                    <strong style={{ cursor: 'pointer', transition: 'color 0.2s', display: 'block', wordBreak: 'break-word', color: '#1e293b' }}
                                      onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
                                      onMouseLeave={e => e.currentTarget.style.color = '#1e293b'}
                                    >
                                      {item.name}
                                    </strong>
                                  </Link>
                                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>Bảo hành 36 tháng</span>
                                </div>
                              </div>
                              <span style={{ color: '#2563eb', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 800 }}>x{item.quantity || 1} - {formatPrice(item.price)}</span>
                            </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Chi tiết thanh toán & Giao hàng */}
                      <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                        {/* Thông tin giao hàng */}
                        <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0f172a' }}>Thông tin nhận hàng</h4>
                          <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div><strong style={{ color: '#334155' }}>Người nhận:</strong> {selectedOrder.customerName}</div>
                            <div><strong style={{ color: '#334155' }}>Điện thoại:</strong> {selectedOrder.phone}</div>
                            <div><strong style={{ color: '#334155' }}>Địa chỉ giao hàng:</strong> {selectedOrder.shippingAddress || 'Nhận tại cửa hàng (POS)'}</div>
                            {selectedOrder.lastNote && (
                              <div style={{ marginTop: '0.5rem', color: '#d97706', backgroundColor: '#fef3c7', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                                <strong>Ghi chú:</strong> {selectedOrder.lastNote}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tổng hợp thanh toán */}
                        <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0f172a' }}>Chi tiết thanh toán</h4>
                          <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Tạm tính ({orderItems.length} sản phẩm):</span>
                              <span>{formatPrice(selectedOrder.totalAmount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Phí vận chuyển:</span>
                              <span style={{ color: '#16a34a' }}>Miễn phí (0 ₫)</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '0.6rem', marginTop: '0.3rem' }}>
                              <strong style={{ color: '#0f172a' }}>Tổng cộng:</strong>
                              <strong style={{ color: '#ef4444', fontSize: '1.1rem' }}>{formatPrice(selectedOrder.totalAmount)}</strong>
                            </div>
                            <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
                              (Đã bao gồm VAT) - Thanh toán qua <strong>{selectedOrder.type === 'POS' ? 'Tiền mặt/Quẹt thẻ' : 'COD / Chuyển khoản'}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Minh Chứng Bàn Giao Hàng Thành Công (Proof of Delivery - POD) */}
                      {(selectedOrder.proofPhoto || selectedOrder.status === 'DELIVERED' || selectedOrder.status === 'COMPLETED') && (
                        (() => {
                          const hasRMAOrRefund = Boolean(
                            (returnRequests || []).some(r => String(r.orderId) === String(selectedOrder.orderId) || String(r.id) === String(selectedOrder.orderId)) ||
                            ['RETURN_REQUESTED', 'RETURNING_TO_WAREHOUSE', 'DELIVERED_TO_WAREHOUSE', 'QC_PASSED', 'RESTOCKED', 'EXCHANGED', 'REFUNDED'].includes(selectedOrder.status)
                          );

                          if (hasRMAOrRefund) {
                            return (
                              <div style={{
                                marginTop: '0.85rem',
                                padding: '0.55rem 0.9rem',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.78rem',
                                color: '#475569',
                                flexWrap: 'wrap',
                                gap: '0.4rem'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                  <ShieldCheck size={16} color="#16a34a" />
                                  <span>Kiện hàng ban đầu đã giao bởi: <strong>{selectedOrder.assignedShipper || 'Shipper Nội Bộ'}</strong></span>
                                  {selectedOrder.deliveredAt && <span style={{ color: '#64748b' }}>({new Date(selectedOrder.deliveredAt).toLocaleDateString('vi-VN')})</span>}
                                </div>
                                {selectedOrder.proofPhoto && (
                                  <button
                                    type="button"
                                    onClick={() => setViewProofImage(selectedOrder.proofPhoto)}
                                    style={{
                                      background: '#eff6ff',
                                      border: '1px solid #bfdbfe',
                                      color: '#2563eb',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem'
                                    }}
                                  >
                                    <Eye size={12} /> Xem ảnh POD
                                  </button>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div style={{
                              marginTop: '1.25rem',
                              padding: '1.25rem 1.35rem',
                              backgroundColor: '#f0fdf4',
                              borderRadius: '12px',
                              border: '1.5px solid #86efac',
                              boxShadow: '0 4px 12px rgba(16,185,129,0.08)'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.95rem', color: '#15803d' }}>
                                  <ShieldCheck size={22} color="#16a34a" />
                                  <span>Minh Chứng Bàn Giao Hàng (Proof of Delivery - POD)</span>
                                </div>
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  padding: '0.25rem 0.65rem',
                                  borderRadius: '6px',
                                  border: '1px solid #bbf7d0',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}>
                                  ✓ Đã xác thực giao nhận
                                </span>
                              </div>

                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: selectedOrder.proofPhoto ? '180px 1fr' : '1fr',
                                gap: '1.25rem',
                                alignItems: 'center'
                              }}>
                                {selectedOrder.proofPhoto && (
                                  <div
                                    style={{
                                      position: 'relative',
                                      width: '180px',
                                      height: '130px',
                                      borderRadius: '8px',
                                      overflow: 'hidden',
                                      border: '1.5px solid #cbd5e1',
                                      cursor: 'pointer',
                                      backgroundColor: '#0f172a',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                                    }}
                                    onClick={() => setViewProofImage(selectedOrder.proofPhoto)}
                                    title="Nhấn để xem ảnh phóng to"
                                  >
                                    <img
                                      src={selectedOrder.proofPhoto}
                                      alt="Minh chứng giao hàng POD"
                                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.25s ease' }}
                                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
                                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    />
                                    <div style={{
                                      position: 'absolute',
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      backgroundColor: 'rgba(15,23,42,0.8)',
                                      color: '#ffffff',
                                      fontSize: '0.7rem',
                                      padding: '4px 6px',
                                      textAlign: 'center',
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '0.25rem'
                                    }}>
                                      <Eye size={13} /> Phóng to ảnh
                                    </div>
                                  </div>
                                )}

                                <div style={{ fontSize: '0.84rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                  <div>
                                    <strong style={{ color: '#0f172a' }}>Nhân viên giao hàng:</strong>{' '}
                                    <span style={{ color: '#2563eb', fontWeight: 600 }}>{selectedOrder.assignedShipper || 'Shipper Nội Bộ AetherPC'}</span>
                                  </div>

                                  <div>
                                    <strong style={{ color: '#0f172a' }}>Người nhận thực tế:</strong>{' '}
                                    <span style={{ color: '#0f172a', fontWeight: 600 }}>
                                      {selectedOrder.receivedByType === 'REPRESENTATIVE'
                                        ? `${selectedOrder.receiverNameActual || 'Người nhận thay'} (Nhận thay khách hàng)`
                                        : `${selectedOrder.customerName || 'Khách hàng'} (Chính chủ nhận)`}
                                    </span>
                                  </div>

                                  <div>
                                    <strong style={{ color: '#0f172a' }}>Hình thức thanh toán:</strong>{' '}
                                    <span style={{ color: selectedOrder.actualPaymentMethod === 'BANK_TRANSFER' ? '#2563eb' : '#15803d', fontWeight: 600 }}>
                                      {selectedOrder.actualPaymentMethod === 'BANK_TRANSFER'
                                        ? `Chuyển khoản VietQR ${selectedOrder.bankRefCode ? `(Mã GD: ${selectedOrder.bankRefCode})` : ''}`
                                        : (selectedOrder.actualPaymentMethod === 'CASH' ? 'Tiền mặt khi nhận hàng (COD)' : 'Đã thanh toán Online trước')}
                                    </span>
                                  </div>

                                  {selectedOrder.deliveredAt && (
                                    <div>
                                      <strong style={{ color: '#0f172a' }}>Thời gian bàn giao:</strong>{' '}
                                      <span style={{ color: '#0f172a' }}>{new Date(selectedOrder.deliveredAt).toLocaleString('vi-VN')}</span>
                                    </div>
                                  )}
                                  <div>
                                    <strong style={{ color: '#0f172a' }}>Ghi chú bàn giao:</strong>{' '}
                                    <span style={{ color: '#059669', fontWeight: 600 }}>
                                      {selectedOrder.receiverNote || 'Khách hàng đã kiểm tra ngoại quan tem niêm phong và ký nhận đầy đủ.'}
                                    </span>
                                  </div>

                                  {selectedOrder.paymentProofPhoto && (
                                    <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                      <span style={{ fontWeight: 700, color: '#2563eb' }}>Biên lai chuyển khoản:</span>
                                      <button
                                        type="button"
                                        onClick={() => setViewProofImage(selectedOrder.paymentProofPhoto)}
                                        style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                      >
                                        Xem Biên Lai
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      )}

                      {/* Hành động sửa/hủy đơn - bottom right */}
                      {selectedOrder.status === 'PENDING' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                          <button 
                            onClick={() => {
                              setCancelTargetOrder(selectedOrder);
                              setShowCancelModal(true);
                            }}
                            className="btn" 
                            style={{ 
                              padding: '0.5rem 1rem', 
                              fontSize: '0.85rem', 
                              background: 'rgba(239,68,68,0.1)', 
                              color: '#ef4444', 
                              border: '1px solid rgba(239,68,68,0.25)', 
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center', 
                              gap: '0.35rem',
                              fontWeight: 600,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                          >
                            <X size={16}/> Hủy đơn
                          </button>
                          
                          <button 
                            onClick={() => {
                              setEditTargetOrder(selectedOrder);
                              setEditForm({
                                customerName: selectedOrder.customerName || '',
                                phone: selectedOrder.phone || '',
                                shippingAddress: selectedOrder.shippingAddress || '',
                                notes: selectedOrder.lastNote || ''
                              });
                              setShowEditModal(true);
                            }}
                            className="btn" 
                            style={{ 
                              padding: '0.5rem 1rem', 
                              fontSize: '0.85rem', 
                              background: 'rgba(234,179,8,0.1)', 
                              color: '#eab308', 
                              border: '1px solid rgba(234,179,8,0.25)', 
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center', 
                              gap: '0.35rem',
                              fontWeight: 600,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(234,179,8,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(234,179,8,0.1)'}
                          >
                            Sửa thông tin
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Return Request Section */}
              {(() => {
                const isExcOrder = selectedOrder.type === 'EXCHANGE' || String(selectedOrder.orderId).startsWith('ORD-EXC-');
                const existingReturn = returnRequests?.find(r => 
                  String(r.orderId) === String(selectedOrder.orderId) || 
                  String(r.id) === String(selectedOrder.orderId) ||
                  (selectedOrder.originalOrderId && String(r.orderId) === String(selectedOrder.originalOrderId)) ||
                  (isExcOrder && String(selectedOrder.orderId).replace('ORD-EXC-', 'ORD-') === String(r.orderId)) ||
                  (isExcOrder && String(selectedOrder.orderId).includes(String(r.orderId).replace('ORD-', '')))
                );

                const canShowReturnBlock = Boolean(existingReturn || isExcOrder || ['DELIVERED', 'SHIPPED', 'COMPLETED', 'RETURN_REQUESTED', 'RETURNING_TO_WAREHOUSE', 'DELIVERED_TO_WAREHOUSE', 'QC_PASSED', 'RESTOCKED', 'EXCHANGED', 'REFUNDED'].includes(selectedOrder.status));
                if (!canShowReturnBlock) return null;

                // If this is an EXCHANGE replacement order, show notice card
                if (isExcOrder) {
                  const origId = selectedOrder.originalOrderId || String(selectedOrder.orderId).replace('ORD-EXC-', 'ORD-');
                  return (
                    <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f5f3ff', border: '1.5px solid #c4b5fd', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.92rem', color: '#5b21b6' }}>
                          <RefreshCw size={17} style={{ color: '#7c3aed' }} /> Đơn Hàng Đổi Mới 1-1 (Bảo Hành 0đ)
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: '20px', backgroundColor: '#ffffff', border: '1px solid #c4b5fd', color: '#7c3aed' }}>
                          Bù Trừ Miễn Phí 100%
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#4c1d95', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>
                        Đây là kiện hàng sản phẩm mới được xuất kho đổi mới 1-1 sau khi kiện hàng cũ thuộc Đơn gốc <strong>#{origId}</strong> đã được thu hồi và thẩm định thành công.
                      </p>
                      {origId && orders.some(o => o.orderId === origId) && (
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(origId)}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: '8px',
                            backgroundColor: '#7c3aed',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          Xem Tiến Độ Thu Hồi Tại Đơn Gốc #{origId}
                        </button>
                      )}
                    </div>
                  );
                }

                // No return request yet — show button
                if (!existingReturn) {
                  return (
                    <div style={{ padding: '1rem 1.5rem', backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <AlertCircle size={15} style={{ color: '#ef4444' }}/> Yêu Cầu Đổi Trả / Hoàn Tiền
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                          Trong vòng 7 ngày kể từ ngày giao hàng. CSKH xử lý trong 1-3 ngày làm việc.
                        </p>
                      </div>
                      <button onClick={() => { setReturnTargetOrder(selectedOrder); setShowReturnModal(true); }}
                        className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer' }}>
                        <RefreshCw size={14}/> Gửi Yêu Cầu Đổi Trả
                      </button>
                    </div>
                  );
                }

                // Return request exists — show detailed status card
                const isExchangeType = existingReturn.type === 'EXCHANGE';
                const statusConfig = {
                  PENDING:                  { label: 'Chờ CSKH duyệt', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
                  RETURN_REQUESTED:         { label: 'Chờ Shipper đến thu hồi hàng', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
                  RETURN_APPROVED:          { label: 'CSKH đã duyệt - Chờ Shipper đến lấy hàng', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
                  RETURNING_TO_WAREHOUSE:   { label: 'Shipper đang vận chuyển về kho', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
                  DELIVERED_TO_WAREHOUSE:   { label: 'Đã về kho - Kỹ thuật QC đang thẩm định', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
                  QC_PASSED:                { label: 'QC thẩm định Đạt chuẩn - Chờ kho nhập kệ', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
                  QC_REJECTED:              { label: 'QC từ chối - Không đủ điều kiện đổi trả', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
                  COMPLETED:                { label: 'Đã hoàn tất', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
                  RESTOCKED:                {
                    label: isExchangeType ? 'Kho đã nhập hàng cũ - Đang xuất kho đơn đổi mới' : 'Kho đã nhập hàng - Chờ Kế toán hoàn tiền', 
                    color: '#0284c7', 
                    bg: '#f0f9ff', 
                    border: '#bae6fd' 
                  },
                  EXCHANGED:                { label: 'Kho đã xuất kho đơn hàng đổi mới', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
                  EXCHANGE_NEW:             { label: 'Kho đã xuất kho đơn hàng đổi mới', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
                  REFUNDED:                 { label: 'Kế toán đã hoàn tất chuyển tiền hoàn 100%', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
                  REJECTED:                 { label: 'Từ chối đổi trả', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' }
                };
                const sc = statusConfig[existingReturn?.status] || statusConfig.PENDING;
                const typeLabel = isExchangeType ? 'Đổi sản phẩm mới (1-1)' : 'Hoàn tiền 100%';
                const replacementId = existingReturn.replacementOrderId || `ORD-EXC-${selectedOrder.orderId.replace('ORD-', '')}`;
                const hasReplacementOrder = isExchangeType && orders.some(o => o.orderId === replacementId);

                // =========================================================================
                // TRƯỜNG HỢP: ĐÃ HOÀN TIỀN 100% -> HIỂN THỊ CARD GỌN GÀNG, KHÔNG LẶP LẠI
                // =========================================================================
                if (!isExchangeType && (existingReturn.status === 'REFUNDED' || existingReturn.refundTxnCode)) {
                  const refundTime = existingReturn.refundedAt ? new Date(existingReturn.refundedAt).getTime() : (new Date(selectedOrder.date).getTime() || Date.now());
                  const deadline48h = refundTime + 48 * 60 * 60 * 1000;
                  const diffMs = deadline48h - Date.now();
                  const isOver48h = diffMs <= 0;
                  const hoursRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
                  const minutesRemaining = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));

                  return (
                    <div style={{ padding: '1.15rem 1.35rem', backgroundColor: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', borderBottom: '1px solid #bbf7d0', paddingBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, fontSize: '0.9rem', color: '#15803d' }}>
                          <CheckCircle size={18} color="#16a34a" />
                          <span>Kế Toán Đã Hoàn Tiền 100% (Phiếu #RMA-{existingReturn.id})</span>
                        </div>
                        <span style={{ fontSize: '0.76rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: '12px', backgroundColor: '#dcfce7', border: '1px solid #86efac', color: '#15803d' }}>
                          Napas247: {formatPrice(parseFloat(existingReturn.refundAmount || selectedOrder.totalAmount || 0))}
                        </span>
                      </div>

                      {/* Thông tin chuyển khoản súc tích */}
                      <div style={{ display: 'grid', gridTemplateColumns: (existingReturn.refundProofPhoto || existingReturn.evidenceUrl) ? '1fr 95px' : '1fr', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <div><span style={{ color: '#64748b' }}>Tài khoản nhận:</span> <strong style={{ color: '#0f172a' }}>{existingReturn.bankAccountNo} - {existingReturn.bankName}</strong> ({existingReturn.bankAccountName || existingReturn.customerName})</div>
                          <div><span style={{ color: '#64748b' }}>Mã GD ngân hàng:</span> <strong style={{ color: '#15803d', fontFamily: 'monospace' }}>{existingReturn.refundTxnCode || 'FT26082400912'}</strong> <span style={{ color: '#64748b', fontSize: '0.74rem' }}>• {existingReturn.refundedAt ? new Date(existingReturn.refundedAt).toLocaleString('vi-VN') : '24/08/2026'}</span></div>
                          {existingReturn.note && <div><span style={{ color: '#64748b' }}>Ghi chú:</span> <em>{existingReturn.note}</em></div>}
                        </div>

                        {(existingReturn.refundProofPhoto || existingReturn.evidenceUrl) && (
                          <div style={{ textAlign: 'center' }}>
                            <img
                              src={existingReturn.refundProofPhoto || existingReturn.evidenceUrl}
                              alt="Biên lai hoàn tiền"
                              onClick={() => window.open(existingReturn.refundProofPhoto || existingReturn.evidenceUrl, '_blank')}
                              style={{ width: '90px', height: '65px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #86efac', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}
                            />
                            <span style={{ display: 'block', fontSize: '0.68rem', color: '#16a34a', fontWeight: 700, marginTop: '2px', cursor: 'pointer' }} onClick={() => window.open(existingReturn.refundProofPhoto || existingReturn.evidenceUrl, '_blank')}>
                              Xem biên lai
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Xác nhận của khách hàng */}
                      {existingReturn.customerConfirmedRefund ? (
                        <div style={{ padding: '0.55rem 0.85rem', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.78rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#15803d', fontWeight: 700 }}>
                            <CheckCircle2 size={16} />
                            <span>Quý khách đã xác nhận nhận đủ tiền ({existingReturn.customerConfirmedAt ? new Date(existingReturn.customerConfirmedAt).toLocaleString('vi-VN') : 'Vừa xong'})</span>
                          </div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803d', backgroundColor: '#ffffff', padding: '1px 6px', borderRadius: '4px' }}>ĐÃ ĐÓNG HỒ SƠ</span>
                        </div>
                      ) : isOver48h ? (
                        <div style={{ padding: '0.55rem 0.85rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.78rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1d4ed8', fontWeight: 700 }}>
                            <ShieldCheck size={16} />
                            <span>Hồ sơ đã tự động hoàn tất sau 48h giải ngân</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewRefundContactModal(existingReturn)}
                            style={{ backgroundColor: '#ffffff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Hỗ trợ kế toán
                          </button>
                        </div>
                      ) : (
                        <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#ffffff', border: '1px dashed #86efac', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem', fontSize: '0.76rem' }}>
                            <span style={{ color: '#0f172a', fontWeight: 700 }}>Bạn đã kiểm tra số dư và nhận được tiền hoàn chưa?</span>
                            <span style={{ color: '#d97706', backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={12} /> Tự động đóng sau: {hoursRemaining}h {minutesRemaining}p
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleCustomerConfirmRefundReceived(existingReturn)}
                              style={{
                                flex: '1 1 160px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.45rem 0.75rem',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <CheckCircle2 size={15} />
                              <span>Tôi Đã Nhận Đủ Tiền</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setViewRefundContactModal(existingReturn)}
                              style={{
                                flex: '1 1 160px',
                                backgroundColor: '#fff1f2',
                                color: '#e11d48',
                                border: '1px solid #fecdd3',
                                borderRadius: '6px',
                                padding: '0.45rem 0.75rem',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <AlertCircle size={15} />
                              <span>Chưa Nhận Được Tiền (Hỗ Trợ)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div style={{ padding: '1.15rem 1.35rem', backgroundColor: sc.bg, border: '1px solid ' + sc.border, borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                        <RefreshCw size={15} style={{ color: sc.color }}/> {isExchangeType ? 'Tiến Độ Đổi Mới Sản Phẩm' : 'Tiến Độ Trả Hàng & Hoàn Tiền'}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: '20px', backgroundColor: '#ffffff', border: '1px solid ' + sc.border, color: sc.color }}>
                        {sc.label}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem 1rem', fontSize: '0.8rem', color: '#334155' }}>
                      <div><span style={{ color: '#64748b', fontWeight: 600 }}>Mã yêu cầu:</span> <strong style={{ color: '#0f172a' }}>#RMA-{existingReturn.id}</strong></div>
                      <div><span style={{ color: '#64748b', fontWeight: 600 }}>Hình thức:</span> <strong style={{ color: sc.color, fontWeight: 800 }}>{typeLabel}</strong></div>
                      <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b', fontWeight: 600 }}>Lý do:</span> <strong style={{ color: '#0f172a' }}>{existingReturn.reason}</strong></div>

                      {/* QC Inspection Proof Photo */}
                      {existingReturn.qcProofPhoto && (
                        <div style={{ gridColumn: '1 / -1', marginTop: '0.35rem', padding: '0.65rem 0.85rem', backgroundColor: '#ffffff', border: '1px solid #ddd6fe', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, color: '#6d28d9', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                            Ảnh Thẩm Định Kỹ Thuật QC:
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <img
                              src={existingReturn.qcProofPhoto}
                              alt="QC Proof Photo"
                              onClick={() => window.open(existingReturn.qcProofPhoto, '_blank')}
                              style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1.5px solid #c4b5fd', cursor: 'pointer' }}
                            />
                            <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                              <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{existingReturn.qcInspector ? `Kỹ thuật: ${existingReturn.qcInspector}` : 'QA/QC AetherPC'}</p>
                              <p style={{ margin: '2px 0 0', color: '#64748b' }}>Đã đối soát tem seal niêm phong, sản phẩm đạt chuẩn thu hồi.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Đơn Hàng Đổi Mới (Dành cho EXCHANGE) */}
                      {Boolean(isExchangeType && (existingReturn.replacementOrderId || existingReturn.status === 'EXCHANGED' || existingReturn.status === 'RESTOCKED' || existingReturn.status === 'EXCHANGE_NEW' || hasReplacementOrder)) && (
                        <div style={{ gridColumn: '1 / -1', marginTop: '0.4rem', padding: '0.75rem 0.95rem', backgroundColor: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', borderBottom: '1px solid #bfdbfe', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <CheckCircle size={16} color="#2563eb" />
                              <strong style={{ color: '#1e40af', fontSize: '0.82rem' }}>Đơn Hàng Đổi Mới 1-1 (0đ Bù Trừ)</strong>
                            </div>
                            <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800 }}>
                              Mã: #{replacementId}
                            </span>
                          </div>
                          {hasReplacementOrder && (
                            <button
                              type="button"
                              onClick={() => setSelectedOrderId(replacementId)}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              Xem Chi Tiết Đơn Đổi Mới #{replacementId}
                            </button>
                          )}
                        </div>
                      )}

                      {!isExchangeType && existingReturn.bankAccountNo && (
                        <div style={{ gridColumn: '1 / -1', padding: '0.45rem 0.65rem', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                          <span style={{ color: '#64748b' }}>Tài khoản nhận hoàn:</span> <strong style={{ color: '#2563eb' }}>{existingReturn.bankAccountNo}</strong> - {existingReturn.bankName} ({existingReturn.bankAccountName || existingReturn.customerName})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Order Status Progress Bar */}
              <div className="card-glass" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                  <Clock size={18} color="#2563eb" />
                  {Boolean(selectedOrder.type === 'EXCHANGE' || String(selectedOrder.orderId).startsWith('ORD-EXC-')) ? 'Tiến Độ Giao Hàng Đổi Mới 1-1' : 'Tiến Độ Đơn Hàng'}
                </h3>
                {(() => {
                  const isExcOrder = selectedOrder.type === 'EXCHANGE' || String(selectedOrder.orderId).startsWith('ORD-EXC-');
                  const currentReturn = returnRequests.find(r => 
                    String(r.orderId) === String(selectedOrder.orderId) || 
                    String(r.id) === String(selectedOrder.orderId) ||
                    (selectedOrder.originalOrderId && String(r.orderId) === String(selectedOrder.originalOrderId)) ||
                    (isExcOrder && String(selectedOrder.orderId).replace('ORD-EXC-', 'ORD-') === String(r.orderId)) ||
                    (isExcOrder && String(selectedOrder.orderId).includes(String(r.orderId).replace('ORD-', '')))
                  );
                  return getStatusProgress(selectedOrder.status, currentReturn, selectedOrder);
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lịch Sử Khiếu Nại & Ticket Hỗ Trợ Khách Hàng */}
      <div id="complaintHistorySection" className="card-glass" style={{ padding: '1.75rem', marginTop: '2.5rem', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <HelpCircle size={22} color="#ef4444" />
            Lịch Sử Khiếu Nại & Yêu Cầu Hỗ Trợ ({userComplaints.length})
          </h3>
          {userComplaints.length > 0 && (
            <button
              onClick={() => {
                setComplaintForm({ orderId: selectedOrder?.orderId || '', title: '', description: '', priority: 'HIGH', evidenceUrl: '' });
                setShowComplaintModal(true);
              }}
              className="btn btn-primary"
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem', borderRadius: '8px', backgroundColor: '#ef4444', border: 'none', fontWeight: 700 }}
            >
              Gửi Ticket Mới
            </button>
          )}
        </div>

        {userComplaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.92rem', color: '#475569', fontWeight: 500 }}>
              Bạn chưa có phiếu khiếu nại hoặc ticket hỗ trợ nào trên hệ thống.
            </p>
            <button
              onClick={() => {
                setComplaintForm({ orderId: selectedOrder?.orderId || '', title: '', description: '', priority: 'HIGH', evidenceUrl: '' });
                setShowComplaintModal(true);
              }}
              className="btn btn-primary"
              style={{ borderRadius: '10px', fontSize: '0.82rem', padding: '0.5rem 1.25rem', backgroundColor: '#ef4444', border: 'none', fontWeight: 700 }}
            >
              <AlertCircle size={16} style={{ marginRight: '0.4rem' }} /> Gửi Ticket Khiếu Nại Ngay
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {userComplaints.map(tkt => (
              <div key={tkt.id} style={{ padding: '1.1rem 1.25rem', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.6rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <strong style={{ color: '#2563eb', fontSize: '0.88rem' }}>{tkt.id}</strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: getStatusInfo(COMPLAINT_STATUS, tkt.status).bg, color: getStatusInfo(COMPLAINT_STATUS, tkt.status).color }}>
                      {tkt.status === 'RESOLVED' ? '✓ ' : ''}
                      {getStatusLabel(COMPLAINT_STATUS, tkt.status)}
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 0.3rem 0', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                    {tkt.subject || tkt.title}
                  </h4>
                  {tkt.orderId && <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.4rem' }}>Đơn hàng liên quan: <strong style={{ color: '#0f172a' }}>{tkt.orderId}</strong></div>}

                  <p style={{ fontSize: '0.82rem', color: '#334155', margin: '0 0 0.6rem 0', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {tkt.description}
                  </p>
                </div>

                <div>
                  {tkt.resolution ? (
                    <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      CSKH Phản hồi ({tkt.assignedTo || 'Bộ phận CSKH'}): {tkt.resolution}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#92400e', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                      Đang chờ CSKH xử lý phản hồi...
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{tkt.date}</span>
                    <button
                      onClick={() => setViewTicketDetail(tkt)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', borderRadius: '6px', fontWeight: 700, backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                    >
                      <Eye size={13} /> Xem chi tiết
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Yêu cầu đổi trả */}
      <ReturnRequestModal 
        show={showReturnModal} 
        onClose={(success) => {
          setShowReturnModal(false);
          if (success === true) {
            setReturnSuccess(true);
            setTimeout(() => setReturnSuccess(false), 5000);
          }
        }} 
        order={returnTargetOrder} 
      />

      {/* Modal: Gửi Ticket Khiếu Nại & Hỗ Trợ */}
      {showComplaintModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 9999999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4.5rem 1rem 1.5rem 1rem', overflowY: 'auto' }}>
          <div className="card-glass" style={{ width: '100%', maxWidth: '540px', padding: '1.75rem 2rem', backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', color: '#0f172a', maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Gửi Ticket Khiếu Nại & Hỗ Trợ</h3>
              </div>
              <button onClick={() => setShowComplaintModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18}/>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: '#334155' }}>Mã Đơn Hàng Liên Quan (Nếu có)</label>
                <select
                  value={complaintForm.orderId}
                  onChange={e => setComplaintForm(p => ({ ...p, orderId: e.target.value }))}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Chọn đơn hàng liên quan (Không bắt buộc) --</option>
                  {matchedOrders.map(o => (
                    <option key={o.orderId} value={o.orderId}>{o.orderId} - {formatPrice(o.totalAmount)} ({o.date})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: '#334155' }}>Vấn đề khiếu nại / Tiêu đề *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  {['Giao hàng chậm trễ', 'Sản phẩm không đúng mô tả', 'Lỗi linh kiện / Hỏng hóc', 'Lỗi thanh toán / Chưa nhận quà', 'Thái độ nhân viên chưa tốt'].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setComplaintForm(p => ({ ...p, title: chip }))}
                      style={{
                        padding: '0.25rem 0.65rem', fontSize: '0.72rem', borderRadius: '20px', cursor: 'pointer',
                        border: complaintForm.title === chip ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                        backgroundColor: complaintForm.title === chip ? '#fef2f2' : '#f8fafc',
                        color: complaintForm.title === chip ? '#ef4444' : '#475569', fontWeight: 700
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={complaintForm.title}
                  onChange={e => setComplaintForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Hoặc nhập tiêu đề khiếu nại..."
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: '#334155' }}>Chi tiết nội dung sự cố *</label>
                <textarea
                  value={complaintForm.description}
                  onChange={e => setComplaintForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Mô tả chi tiết sự cố bạn gặp phải để bộ phận CSKH xử lý nhanh nhất..."
                  className="form-input"
                  rows={4}
                  style={{ width: '100%', borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', resize: 'vertical' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: '#334155' }}>Mức độ ưu tiên</label>
                <select
                  value={complaintForm.priority}
                  onChange={e => setComplaintForm(p => ({ ...p, priority: e.target.value }))}
                  className="form-input"
                  style={{ width: '100%', borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
                >
                  <option value="HIGH">Khẩn cấp (Cần hỗ trợ ngay trong 30 phút)</option>
                  <option value="MEDIUM">Trung bình (Xử lý trong ngày)</option>
                  <option value="LOW">Thấp (Tư vấn bình thường)</option>
                </select>
              </div>

              {/* Ảnh minh chứng sự cố (nếu có) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: '#334155' }}>Ảnh / Minh chứng đính kèm (Không bắt buộc)</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="file" accept="image/*" id="complaintEvidenceInput" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setComplaintForm(p => ({ ...p, evidenceUrl: reader.result }));
                      reader.readAsDataURL(file);
                    }
                  }} />
                  <button type="button" onClick={() => document.getElementById('complaintEvidenceInput')?.click()}
                    className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                    Chọn ảnh từ máy
                  </button>
                  <input type="text" value={complaintForm.evidenceUrl || ''} onChange={e => setComplaintForm(p => ({ ...p, evidenceUrl: e.target.value }))}
                    placeholder="Hoặc dán URL ảnh minh chứng..." className="form-input" style={{ flex: 1, fontSize: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>

                {/* Evidence Image Preview */}
                {complaintForm.evidenceUrl && (
                  <div style={{ marginTop: '0.5rem', position: 'relative', display: 'inline-block' }}>
                    <img src={complaintForm.evidenceUrl} alt="Minh chứng" style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '10px', border: '2px solid #ef4444' }} />
                    <button type="button" onClick={() => setComplaintForm(p => ({ ...p, evidenceUrl: '' }))}
                      style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>✕</button>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                Sau khi gửi ticket, Bộ phận CSKH AetherPC sẽ nhận được thông tin ngay lập tức trên hệ thống và xử lý hỗ trợ cho bạn.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowComplaintModal(false)} className="btn btn-secondary" style={{ borderRadius: '10px' }}>Hủy</button>
                <button type="button" onClick={handleComplaintSubmit} disabled={submittingComplaint} className="btn btn-primary" style={{ borderRadius: '10px', backgroundColor: submittingComplaint ? '#9ca3af' : '#ef4444', border: 'none', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem' }}>
                  <AlertCircle size={16}/> {submittingComplaint ? 'Đang gửi...' : 'Gửi Khiếu Nại'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xem Chi Tiết Ticket Dành Cho Khách Hàng */}
      {viewTicketDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 9999999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4.5rem 1rem 1.5rem 1rem', overflowY: 'auto' }}>
          <div className="card-glass" style={{ width: '100%', maxWidth: '560px', padding: '1.75rem 2rem', backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', color: '#0f172a', maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <strong style={{ fontSize: '1.1rem', color: '#2563eb' }}>{viewTicketDetail.id}</strong>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: getStatusInfo(COMPLAINT_STATUS, viewTicketDetail.status).bg, color: getStatusInfo(COMPLAINT_STATUS, viewTicketDetail.status).color }}>
                  {viewTicketDetail.status === 'RESOLVED' ? '✓ ' : ''}
                  {getStatusLabel(COMPLAINT_STATUS, viewTicketDetail.status)}
                </span>
              </div>
              <button onClick={() => setViewTicketDetail(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18}/>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', fontSize: '0.85rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Vấn đề khiếu nại</div>
                <h4 style={{ margin: '0.2rem 0 0', fontSize: '1.05rem', color: '#0f172a', fontWeight: 800 }}>{viewTicketDetail.subject || viewTicketDetail.title}</h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div><span style={{ color: '#64748b', fontWeight: 600 }}>Mã đơn liên quan:</span> <strong style={{ color: '#2563eb' }}>{viewTicketDetail.orderId || 'Không có'}</strong></div>
                <div><span style={{ color: '#64748b', fontWeight: 600 }}>Ngày gửi:</span> <strong style={{ color: '#0f172a' }}>{viewTicketDetail.date}</strong></div>
                <div><span style={{ color: '#64748b', fontWeight: 600 }}>Người gửi:</span> <strong style={{ color: '#0f172a' }}>{viewTicketDetail.customerName}</strong></div>
                <div><span style={{ color: '#64748b', fontWeight: 600 }}>NV Phụ trách:</span> <strong style={{ color: '#7c3aed' }}>{viewTicketDetail.assignedTo || 'Bộ phận CSKH'}</strong></div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginBottom: '0.3rem' }}>Nội dung bạn gửi:</div>
                <div style={{ padding: '0.85rem', backgroundColor: '#f1f5f9', borderRadius: '10px', color: '#1e293b', borderLeft: '4px solid #ef4444', lineHeight: 1.5 }}>
                  {viewTicketDetail.description}
                </div>
              </div>

              {viewTicketDetail.evidenceUrl && (
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginBottom: '0.3rem' }}>Ảnh / Minh chứng đính kèm:</div>
                  <img src={viewTicketDetail.evidenceUrl} alt="Minh chứng sự cố"
                    style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                    onClick={() => window.open(viewTicketDetail.evidenceUrl, '_blank')}
                  />
                </div>
              )}

              {viewTicketDetail.resolution ? (
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 800, marginBottom: '0.3rem' }}>Kết quả / Hướng giải quyết từ CSKH:</div>
                  <div style={{ padding: '0.85rem', backgroundColor: '#f0fdf4', borderRadius: '10px', color: '#166534', borderLeft: '4px solid #16a34a', fontWeight: 600, lineHeight: 1.5 }}>
                    {viewTicketDetail.resolution}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '0.75rem 0.85rem', backgroundColor: '#fef3c7', borderRadius: '10px', color: '#92400e', fontSize: '0.8rem', fontWeight: 600, borderLeft: '4px solid #f59e0b' }}>
                  Yêu cầu của bạn đã được chuyển tới bộ phận Chăm sóc khách hàng và sẽ được xử lý sớm nhất.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '0.85rem', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setViewTicketDetail(null)} className="btn btn-secondary" style={{ borderRadius: '10px', padding: '0.5rem 1.25rem' }}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sửa Thông Tin Đơn Hàng PENDING */}
      {showEditModal && editTargetOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 2rem)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
            
            {/* Modal Header - Fixed */}
            <div style={{ padding: '1.5rem 1.5rem 1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Cập nhật thông tin nhận hàng</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20}/>
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Tên người nhận</label>
                <input type="text" value={editForm.customerName} onChange={e => setEditForm({...editForm, customerName: e.target.value})} className="form-control" style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Số điện thoại</label>
                <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="form-control" style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Địa chỉ giao hàng</label>
                <textarea value={editForm.shippingAddress} onChange={e => setEditForm({...editForm, shippingAddress: e.target.value})} className="form-control" rows="2" style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              {savedAddresses.length > 0 && (
                <div style={{ border: '1px solid #dbeafe', background: '#f8fbff', borderRadius: '10px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '0.5rem' }}>{'Địa chỉ đã lưu'}</div>
                  <div style={{ maxHeight: '112px', overflowY: 'auto', display: 'grid', gap: '0.45rem', paddingRight: '0.2rem' }}>
                    {savedAddresses.map(address => <button key={address.id} type="button" onClick={() => applySavedAddressToOrder(address)} style={{ textAlign: 'left', padding: '0.55rem', borderRadius: '7px', cursor: 'pointer', border: selectedSavedAddressId === address.id ? '1px solid #2563eb' : '1px solid #dbeafe', background: selectedSavedAddressId === address.id ? '#eff6ff' : '#fff' }}><strong>{address.recipientName}</strong><span style={{ marginLeft: '.5rem', color: '#475569' }}>| {address.recipientPhone}</span>{address.isDefault && <span style={{ marginLeft: '.5rem', fontSize: '0.68rem', color: '#2563eb' }}>{'• Mặc định'}</span>}<div style={{ marginTop: '.2rem', fontSize: '0.75rem', color: '#475569' }}>{[address.addressLine, address.ward, address.district, address.city].filter(Boolean).join(', ')}</div></button>)}
                  </div>
                </div>
              )}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Ghi chú thêm (Tùy chọn)</label>
                <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="form-control" rows="2" style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
            </div>

            {/* Modal Footer - Fixed */}
            <div style={{ padding: '1rem 1.5rem 1.5rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontWeight: 600 }}>Hủy</button>
              <button onClick={() => {
                if (updateOrderDetails) {
                  updateOrderDetails(editTargetOrder.orderId, editForm);
                }
                setShowEditModal(false);
                addNotification(`Đơn hàng #${editTargetOrder.orderId} cập nhật thông tin thành công!`, 'success', '/my-orders');
              }} className="btn btn-primary" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontWeight: 600, backgroundColor: '#2563eb', color: 'white', border: 'none' }}>Lưu Thay Đổi</button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Hủy Đơn Hàng */}
      {showCancelModal && cancelTargetOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 2rem)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.5rem 1.5rem 1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Xác nhận hủy đơn hàng</h3>
              <button onClick={() => setShowCancelModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20}/>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px dashed #fca5a5' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#991b1b', lineHeight: 1.5 }}>
                  Bạn đang yêu cầu hủy đơn hàng <strong>{cancelTargetOrder.orderId}</strong>. Hành động này không thể hoàn tác.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Lý do hủy đơn <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea 
                  value={cancelForm.reason} 
                  onChange={e => setCancelForm({...cancelForm, reason: e.target.value})} 
                  placeholder="Vui lòng cho chúng tôi biết lý do bạn muốn hủy đơn hàng này..."
                  className="form-control" 
                  rows="3" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }} 
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Minh chứng (Ảnh/Video dưới 100MB, Tùy chọn)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#475569', transition: 'background-color 0.2s' }}>
                    <Upload size={16} /> Chọn File
                    <input 
                      type="file" 
                      accept="image/*,video/*" 
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 100 * 1024 * 1024) {
                            addNotification('File quá lớn, vui lòng chọn file dưới 100MB.', 'error');
                            e.target.value = '';
                            return;
                          }
                          // Use object URL for fast local preview without browser freeze
                          const objectUrl = URL.createObjectURL(file);
                          setCancelForm({...cancelForm, evidenceUrl: objectUrl});
                        }
                      }} 
                    />
                  </label>
                  {cancelForm.evidenceUrl && (
                    <span style={{ fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle size={16} /> Đã chọn file
                    </span>
                  )}
                </div>
                {cancelForm.evidenceUrl && (
                   <div style={{ marginTop: '0.75rem', position: 'relative', display: 'inline-block' }}>
                     {cancelForm.evidenceUrl.startsWith('blob:') ? (
                       <img src={cancelForm.evidenceUrl} alt="Preview" style={{ height: '80px', borderRadius: '8px', border: '1px solid #e2e8f0', objectFit: 'cover' }} />
                     ) : null}
                     <button onClick={() => setCancelForm({...cancelForm, evidenceUrl: ''})} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#fff', borderRadius: '50%', padding: '2px', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
                       <X size={12} />
                     </button>
                   </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem 1.5rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowCancelModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontWeight: 600 }}>Quay lại</button>
              <button 
                onClick={() => {
                  if (!cancelForm.reason.trim()) {
                    addNotification('Vui lòng nhập lý do hủy đơn hàng.', 'error');
                    return;
                  }
                  updateOrderStatus(cancelTargetOrder.orderId, 'CANCELLED', `Hủy bởi Khách hàng: ${cancelForm.reason}`, { evidenceUrl: cancelForm.evidenceUrl });
                  setShowCancelModal(false);
                  setCancelForm({ reason: '', evidenceUrl: '' });
                  addNotification(`Đơn hàng #${cancelTargetOrder.orderId} đã hủy thành công!`, 'success', '/my-orders');
                }} 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', fontWeight: 600, backgroundColor: '#ef4444', color: 'white', border: 'none' }}
              >
                Xác nhận Hủy Đơn
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Proof of Delivery (POD) Full Image Lightbox Modal */}
      {viewProofImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15,23,42,0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem'
          }}
          onClick={() => setViewProofImage(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #cbd5e1'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} color="#16a34a" />
                <span>Minh Chứng Bàn Giao Hàng Thực Tế (POD) - Đơn #{selectedOrder?.orderId}</span>
              </div>
              <button
                onClick={() => setViewProofImage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', overflow: 'hidden' }}>
              <img
                src={viewProofImage}
                alt="Minh chứng giao hàng POD full size"
                style={{ maxWidth: '100%', maxHeight: '62vh', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>
            <div style={{ padding: '0.85rem 1.25rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.82rem', color: '#475569' }}>
              <div>
                Người nhận: <strong>{selectedOrder?.customerName}</strong> ({selectedOrder?.phone}) | Nhân viên: <strong>{selectedOrder?.assignedShipper || 'Shipper Nội Bộ'}</strong>
              </div>
              <button
                onClick={() => setViewProofImage(null)}
                className="btn btn-primary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '6px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Hỗ Trợ Khẩn Cấp - Chưa Nhận Được Tiền Hoàn & Liên Hệ Kế Toán */}
      {viewRefundContactModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setViewRefundContactModal(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #cbd5e1'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff1f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={22} color="#e11d48" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#9f1239' }}>
                    Hỗ Trợ Đối Soát Tiền Hoàn
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: '#be123c' }}>Phòng Kế Toán - Tài Chính Doanh Nghiệp AetherPC</span>
                </div>
              </div>
              <button onClick={() => setViewRefundContactModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', fontSize: '0.82rem' }}>
              {/* Alert notice */}
              <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '0.85rem 1rem', color: '#9a3412', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: '0.2rem' }}>Bạn chưa nhận được tiền trong tài khoản?</strong>
                Lệnh chuyển khoản Napas247 thường nhận được ngay trong 1-5 phút. Tuy nhiên một số ngân hàng có thể bảo trì hoặc chậm tin nhắn SMS/App. Xin hãy kiểm tra lịch sử biến động số dư trên App Mobile Banking.
              </div>

              {/* Contact Channels */}
              <div style={{ backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                  Kênh Liên Hệ Trực Tiếp Phòng Kế Toán
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>Hotline Kế Toán Thanh Toán (24/7)</div>
                      <div style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 700 }}>0918.888.777 (hoặc 0909.123.456)</div>
                    </div>
                    <a
                      href="tel:0918888777"
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontWeight: 800,
                        fontSize: '0.75rem'
                      }}
                    >
                      Gọi Ngay
                    </a>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>Email Tiếp Nhận Khiếu Nại</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>ketoan@aetherpc.com.vn</div>
                    </div>
                    <a
                      href="mailto:ketoan@aetherpc.com.vn?subject=Khiếu nại hoàn tiền đơn hàng"
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: '0.75rem'
                      }}
                    >
                      Gửi Email
                    </a>
                  </div>
                </div>
              </div>

              {/* Đối Soát Giao Dịch */}
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.85rem 1rem', fontSize: '0.78rem' }}>
                <strong style={{ color: '#166534', display: 'block', marginBottom: '0.4rem' }}>Thông Tin Đối Soát Napas247:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', color: '#334155' }}>
                  <div>Mã GD Kế toán: <strong style={{ color: '#15803d', fontFamily: 'monospace' }}>{viewRefundContactModal.refundTxnCode || 'FT26082400912'}</strong></div>
                  <div>Số tiền: <strong style={{ color: '#15803d' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(parseFloat(viewRefundContactModal.refundAmount || selectedOrder?.totalAmount || 0))}</strong></div>
                  <div>Ngân hàng nhận: <strong>{viewRefundContactModal.bankName}</strong></div>
                  <div>Số tài khoản: <strong style={{ color: '#2563eb' }}>{viewRefundContactModal.bankAccountNo}</strong></div>
                  <div style={{ gridColumn: '1 / -1' }}>Chủ tài khoản: <strong>{viewRefundContactModal.bankAccountName || viewRefundContactModal.customerName}</strong></div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setViewRefundContactModal(null)}
                style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const ordId = selectedOrder?.orderId || viewRefundContactModal?.orderId;
                  setViewRefundContactModal(null);
                  setComplaintForm({
                    orderId: ordId || '',
                    title: `[KHIẾU NẠI HOÀN TIỀN] Chưa nhận được tiền đơn #${ordId}`,
                    description: `Tôi đã kiểm tra tài khoản ${viewRefundContactModal?.bankAccountNo} (${viewRefundContactModal?.bankName}) nhưng chưa nhận được số tiền hoàn. Mã FT đối soát: ${viewRefundContactModal?.refundTxnCode || 'N/A'}. Kính nhờ Kế toán kiểm tra tra soát lại với ngân hàng giúp tôi.`,
                    priority: 'URGENT',
                    evidenceUrl: ''
                  });
                  setShowComplaintModal(true);
                }}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Gửi Ticket Khiếu Nại Cho Kế Toán
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
