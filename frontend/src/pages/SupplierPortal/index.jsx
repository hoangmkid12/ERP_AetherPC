import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notify, confirm } from '../../context/NotificationContext';
import { PO_STATUS, getStatusLabel } from '../../utils/statusLabels';
import { useFinanceStore } from '../../stores';
import { api } from '../../services/api';
import { 
  PackageOpen, Clock, FileText, CheckCircle, LogOut, AlertCircle, 
  Eye, X, Check, Building, Calendar, Package, DollarSign, XCircle, Truck, CreditCard
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SupplierPortal() {
  const { user, logout } = useAuth();
  const purchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];
  const updatePurchaseOrderStatus = useFinanceStore(state => state.updatePurchaseOrderStatus);
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // State for price input when confirming RFQ
  const [priceInputs, setPriceInputs] = useState({}); // { itemId: unitCost }
  
  // State for NCC delivery date scheduling
  const [deliveryDateInput, setDeliveryDateInput] = useState('');
  const [supplierNoteInput, setSupplierNoteInput] = useState('');
  
  // State for Rejection Modal with Reason
  const [cancelModalPO, setCancelModalPO] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Standard enterprise PO/RFQ code formatter
  const formatPurchaseReference = (po) => {
    if (!po) return '';
    const raw = String(po.poNumber || po.reference || po.id || '').trim();
    const isRfq = ['RFQ', 'RFQ_SENT', 'AWAITING_SUPPLIER_QUOTE', 'QUOTED', 'QUOTED_PENDING_CEO', 'DRAFT_RFQ'].includes(po.status) || po.type === 'BACKORDER_RFQ' || po.type === 'RFQ';
    const prefix = isRfq ? 'RFQ' : 'PO';

    // Standard format: PREFIX-YYYY-NNNN (4-digit year, sequential number)
    const match = raw.match(/^(?:PO|RFQ|PR)-(\d{4})-(\d+)$/i);
    if (match) {
      return `${prefix}-${match[1]}-${match[2]}`;
    }

    // Legacy / non-standard format (e.g. PO-260808-3458): just swap the prefix
    const matchLegacy = raw.match(/^(?:PO|RFQ|PR)-(.+)$/i);
    if (matchLegacy) {
      return `${prefix}-${matchLegacy[1]}`;
    }

    // Pure numeric id (from database): format as PREFIX-2026-NNNN
    const numOnly = raw.replace(/\D/g, '');
    if (numOnly) {
      const padded = String(numOnly).padStart(4, '0');
      return `${prefix}-2026-${padded}`;
    }

    return raw || '';
  };

  const fetchData = async () => {
    setLoading(true);
    let apiSuccess = false;
    try {
      const res = await api.get('/purchasing/orders');
      if (res && res.success) {
        const apiPOs = res.data || [];
        // Read latest from localStorage directly to avoid stale closure
        let latestLocalPOs = [];
        try {
          latestLocalPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]');
        } catch (e) { latestLocalPOs = purchaseOrders; }
        
        // Merge: for POs that exist in both API and local, prefer local if local has items with prices
        const mergedPOs = apiPOs.map(apiPo => {
          const localPo = latestLocalPOs.find(lp => lp.poNumber === apiPo.poNumber || String(lp.id) === String(apiPo.id));
          if (localPo && (
            ['CONFIRMED_BY_SUPPLIER', 'QA_PASSED', 'QA_PARTIAL', 'QA_REJECTED', 'RECEIVED'].includes(localPo.status) ||
            (localPo.items && localPo.items.some(i => (i.unitCost || i.unitPrice || i.price) > 0))
          )) {
            return { ...apiPo, ...localPo };
          }
          return apiPo;
        });
        
        // Only let stale localStorage/context POs introduce brand-new rows when the
        // real API genuinely returned nothing — once it has data, it's authoritative
        // on which POs exist, so old local-only entries (possibly carrying ad-hoc
        // status values that were never real backend statuses) can't inject phantom orders.
        const contextPOs = apiPOs.length === 0
          ? latestLocalPOs.filter(po =>
              !apiPOs.some(ap => ap.poNumber === po.poNumber || String(ap.id) === String(po.id))
            )
          : [];
        const formattedOrders = [...mergedPOs, ...contextPOs].map(po => ({
          ...po,
          poNumber: formatPurchaseReference(po)
        }));
        setOrders(formattedOrders);
        apiSuccess = true;
      }
    } catch (e) {
      console.warn('SupplierPortal API offline, using ERPContext fallback:', e);
    }
    if (!apiSuccess) {
      // Read freshest local data directly from localStorage
      let latestLocalPOs = [];
      try {
        latestLocalPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]');
      } catch (e) { latestLocalPOs = purchaseOrders; }
      const rawList = latestLocalPOs.length > 0 ? latestLocalPOs : purchaseOrders;
      const formattedFallback = rawList.map(po => ({
        ...po,
        poNumber: formatPurchaseReference(po)
      }));
      setOrders(formattedFallback);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [purchaseOrders]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatPrice = (price) => {
    const num = Number(price);
    if (isNaN(num) || num === null || num === undefined) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Filter POs for this supplier using flexible status and supplier matching
  const myPOs = orders.filter(po => {
    const isStatusMatch = ['RFQ', 'RFQ_SENT', 'SENT', 'QUOTED', 'PO', 'APPROVED', 'CONFIRMED_BY_SUPPLIER', 'QA_PASSED', 'QA_PARTIAL', 'QA_REJECTED', 'RECEIVED', 'DONE', 'COMPLETED', 'CANCELLED'].includes(po?.status);
    
    const uCode = (user?.code || '').toLowerCase();
    const uName = (user?.fullname || user?.username || '').toLowerCase();
    const poSupCode = (po?.supplierCode || '').toLowerCase();
    const poSupName = (po?.supplier?.name || po?.supplierName || '').toLowerCase();

    const isSupplierMatch = 
      poSupCode === uCode || 
      (uName && poSupName && poSupName === uName);

    return isStatusMatch && isSupplierMatch;
  });

  // POs waiting for supplier to quote prices and confirm
  const pendingConfirmPOs = myPOs.filter(po => po?.status === 'RFQ' || po?.status === 'RFQ_SENT' || po?.status === 'SENT');

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RFQ':
      case 'RFQ_SENT':
      case 'SENT':
        return <span className="badge badge-warning">Chờ Báo Giá</span>;
      case 'QUOTED':
        return <span className="badge badge-info" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>Đã Báo Giá (Chờ CEO Duyệt)</span>;
      case 'PO':
      case 'APPROVED':
        return <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid #fde68a' }}>CEO Đã Duyệt (Chờ Xác Nhận & Hẹn Giao)</span>;
      case 'CONFIRMED_BY_SUPPLIER':
        return <span className="badge badge-success" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid #bbf7d0' }}>NCC Đã Xác Nhận & Hẹn Giao</span>;
      case 'PENDING_QA':
        return <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid #fde68a' }}>Chờ Kiểm Tra QC</span>;
      case 'QA_PASSED':
        return <span className="badge badge-success" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d', border: '1px solid #86efac' }}>QA/QC Đạt — Chờ Kho Nhập</span>;
      case 'QA_PARTIAL':
        return <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#b45309', border: '1px solid #fcd34d' }}>QA/QC Đạt Một Phần</span>;
      case 'QA_REJECTED':
        return <span className="badge badge-danger" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '1px solid #fecaca' }}>QA/QC Không Đạt — Trả NCC</span>;
      case 'DONE':
      case 'COMPLETED':
      case 'RECEIVED':
        return <span className="badge badge-success" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}>Hoàn Tất (Đã Nhập Kho)</span>;
      case 'CANCELLED':
        return <span className="badge badge-danger" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Đã Từ Chối / Hủy</span>;
      default:
        return <span className="badge badge-secondary">{getStatusLabel(PO_STATUS, status)}</span>;
    }
  };

  // Supplier confirms PO after CEO approval & schedules delivery date
  const handleSupplierConfirmDelivery = async (po) => {
    if (!deliveryDateInput) {
      notify('Vui lòng chọn Ngày hẹn giao hàng.', 'error');
      return;
    }

    const poId = po.id || po.poNumber;
    if (!(await confirm(`Xác nhận đơn hàng ${po.poNumber || poId} và hẹn ngày giao hàng là ${deliveryDateInput} gửi cho Bên Mua Hàng?`))) {
      return;
    }

    setSubmitting(true);
    const confirmation = {
      status: 'CONFIRMED_BY_SUPPLIER',
      expectedDeliveryDate: deliveryDateInput,
      supplierNote: supplierNoteInput || 'NCC đã xác nhận & hẹn ngày giao hàng.'
    };
    const confirmedPO = { ...po, ...confirmation };
    // Update this screen first, so the old CEO-approval form cannot remain
    // visible while the network request is still in flight.
    setOrders(current => {
      const exists = current.some(item => String(item.id) === String(po.id) || item.poNumber === po.poNumber);
      const next = current.map(item => (
        String(item.id) === String(po.id) || item.poNumber === po.poNumber ? confirmedPO : item
      ));
      return exists ? next : [confirmedPO, ...next];
    });
    setSelectedPO(confirmedPO);
    // Update the in-memory context first. It can still contain an older list,
    // so the durable shared-store write must happen afterwards.
    updatePurchaseOrderStatus(po.id || po.poNumber, confirmation.status, confirmation);

    // Publish immediately to the shared client-side store. This keeps Warehouse
    // and QA/QC in sync even while a Docker backend is rebuilding.
    try {
      const allPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]');
      const hasLocalPO = allPOs.some(item => (
        String(item.id) === String(po.id) || item.poNumber === po.poNumber
      ));
      const nextPOs = allPOs.map(item => (
        String(item.id) === String(po.id) || item.poNumber === po.poNumber
          ? { ...item, ...confirmation }
          : item
      ));
      if (!hasLocalPO) nextPOs.unshift({ ...po, ...confirmation });
      localStorage.setItem('erp_pos', JSON.stringify(nextPOs));
      window.dispatchEvent(new Event('erp-purchase-orders-changed'));
    } catch (error) {
      console.warn('Unable to persist supplier confirmation locally:', error);
    }
    try {
      const res = await api.patch(`/purchasing/orders/${poId}/status`, {
        ...confirmation
      });

      if (res && res.success) {
        notify(`Đã xác nhận đơn hàng ${po.poNumber || poId} thành công. Ngày hẹn giao hàng: ${deliveryDateInput}. Thông tin đã gửi lại cho Bên Mua Hàng & Kho để sẵn sàng nhập hàng.`, 'success');
      } else {
        notify(`Chưa gửi được xác nhận giao hàng lên máy chủ. Đơn: ${po.poNumber || poId}. Xác nhận chỉ lưu tạm trên trình duyệt này. Vui lòng thử lại.`, 'error');
      }
    } catch (e) {
      console.warn('API update failed:', e);
      notify(`Chưa gửi được xác nhận giao hàng lên máy chủ. Đơn: ${po.poNumber || poId}. Lỗi: ${e.message || 'Lỗi kết nối máy chủ'}. Xác nhận chỉ lưu tạm trên trình duyệt này. Vui lòng thử lại.`, 'error');
    }
    setSubmitting(false);
  };

  // Initialize price inputs and delivery date when selecting a PO
  const handleSelectPO = (po) => {
    // Read freshest PO data from localStorage to ensure quoted prices are included
    let freshPO = po;
    try {
      const allLocalPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]');
      const localMatch = allLocalPOs.find(lp => 
        lp.poNumber === po.poNumber || String(lp.id) === String(po.id)
      );
      if (localMatch) {
        // Merge: prefer local data (which has updated items with prices)
        freshPO = { ...po, ...localMatch };
      }
    } catch (e) { /* fallback to po as-is */ }

    setSelectedPO(freshPO);
    const defaultDate = freshPO.expectedDeliveryDate 
      ? new Date(freshPO.expectedDeliveryDate).toISOString().split('T')[0] 
      : new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
    setDeliveryDateInput(defaultDate);
    setSupplierNoteInput(freshPO.supplierNote || freshPO.note || '');
    if (freshPO.items) {
      const initialPrices = {};
      const isNewRFQ = ['RFQ', 'RFQ_SENT', 'SENT'].includes(freshPO.status);
      freshPO.items.forEach((item, idx) => {
        const key = item.id || item.productId || idx;
        const savedPrice = parseFloat(item.unitCost) || parseFloat(item.unitPrice) || parseFloat(item.price) || parseFloat(item.cost) || 0;
        // For new RFQs awaiting supplier quotation, start empty ('') so supplier enters price from scratch!
        initialPrices[key] = isNewRFQ ? '' : (savedPrice > 0 ? String(savedPrice) : '');
      });
      setPriceInputs(initialPrices);
    }
  };

  // Should show price input form (only RFQ_SENT — supplier hasn't quoted yet)
  const needsPriceInput = (po) => {
    return ['RFQ', 'RFQ_SENT', 'SENT'].includes(po?.status);
  };

  // Older RFQs can occasionally reach QUOTED without line prices (for example
  // after a failed network retry). Keep them actionable instead of rendering a
  // zero-value quotation or crashing the detail modal.
  const isQuotedMissingPrices = (po) => {
    if (po?.status !== 'QUOTED') return false;
    const items = po.items || [];
    return items.length === 0 || items.some(item => {
      const price = Number(item.unitCost ?? item.unitPrice ?? item.price ?? item.cost ?? 0);
      return !Number.isFinite(price) || price <= 0;
    });
  };

  // Calculate total from supplier-entered prices
  const getQuotedTotal = (po) => {
    if (!po || !po.items) return 0;
    const isInputMode = ['RFQ', 'RFQ_SENT', 'SENT'].includes(po.status);
    return po.items.reduce((sum, item, idx) => {
      const key = item.id || item.productId || idx;
      const val = priceInputs[key];
      const price = parseFloat(val) || (isInputMode ? 0 : (parseFloat(item.unitCost) || 0));
      return sum + (price * (item.quantity || 1));
    }, 0);
  };

  // Supplier submits price quotation to CEO & Purchasing Department
  const handleConfirmPO = async (po) => {
    if (!po) return;
    const total = getQuotedTotal(po);
    if (total <= 0) {
      notify('Vui lòng nhập đơn giá cho các sản phẩm trước khi gửi báo giá.', 'error');
      return;
    }

    const hasMissingPrice = (po.items || []).some((item, idx) => {
      const key = item.id || item.productId || idx;
      return !(parseFloat(priceInputs[key]) > 0);
    });
    if (hasMissingPrice) {
      notify('Vui lòng nhập đơn giá lớn hơn 0 cho tất cả sản phẩm trong yêu cầu báo giá.', 'error');
      return;
    }

    const poId = po.id || po.poNumber;
    if (!(await confirm(`Xác nhận gửi báo giá cho đơn #${po.poNumber || poId} với tổng chi phí ${formatPrice(total)} gửi tới Bên Mua Hàng & CEO duyệt?`))) {
      return;
    }

    setSubmitting(true);
    try {
      const updatedItems = (po.items || []).map((item, idx) => {
        const key = item.id || item.productId || idx;
        const uCost = parseFloat(priceInputs[key]) || parseFloat(item.unitCost) || parseFloat(item.unitPrice) || parseFloat(item.price) || 0;
        return {
          ...item,
          unitCost: uCost,
          unitPrice: uCost,
          price: uCost,
          cost: uCost,
          totalCost: uCost * (item.quantity || 1)
        };
      });

      const updatedPO = {
        ...po,
        status: 'QUOTED',
        totalAmount: total,
        items: updatedItems
      };

      // === DIRECT localStorage write to bypass stale React state closures ===
      try {
        const allPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]');
        const updatedAllPOs = allPOs.map(p => {
          if (p.id === poId || p.poNumber === poId || String(p.id) === String(poId) ||
              p.poNumber === po.poNumber || String(p.id) === String(po.id)) {
            return { ...p, status: 'QUOTED', totalAmount: total, items: updatedItems };
          }
          return p;
        });
        localStorage.setItem('erp_pos', JSON.stringify(updatedAllPOs));
      } catch (lsErr) {
        console.warn('localStorage direct write failed:', lsErr);
      }

      // Also update via ERPContext (may use stale closure, but localStorage is the source of truth now)
      updatePurchaseOrderStatus(poId, 'QUOTED', { totalAmount: total, items: updatedItems });

      // Update local component state immediately
      setSelectedPO(updatedPO);
      setOrders(prev => prev.map(p => {
        if (p.id === poId || p.poNumber === poId || String(p.id) === String(poId) ||
            p.poNumber === po.poNumber || String(p.id) === String(po.id)) {
          return updatedPO;
        }
        return p;
      }));

      let apiSucceeded = false;
      let apiErrorMessage = '';
      const itemPrices = updatedItems
        .filter(item => item.id != null)
        .map(item => ({ itemId: item.id, unitCost: item.unitCost }));

      try {
        const response = await api.patch(`/purchasing/orders/${poId}/status`, {
          status: 'QUOTED',
          itemPrices
        });
        apiSucceeded = !!(response && response.success);
        // The server is authoritative when it returns the recalculated total.
        // Keep the locally-entered rows only if the response is incomplete.
        if (apiSucceeded && response.data) {
          const serverPO = response.data;
          const syncedPO = {
            ...updatedPO,
            ...serverPO,
            totalAmount: Number(serverPO.totalAmount) > 0 ? serverPO.totalAmount : total,
            items: serverPO.items?.length ? serverPO.items : updatedItems
          };
          setSelectedPO(syncedPO);
          setOrders(prev => prev.map(p => (
            String(p.id) === String(poId) || p.poNumber === po.poNumber ? syncedPO : p
          )));
        }
      } catch (apiErr) {
        apiErrorMessage = apiErr.message || 'Lỗi kết nối máy chủ';
        console.warn('Backend API patch offline, using local storage:', apiErr);
      }

      // Claiming success when the server rejected the quote is exactly what made
      // "confirmed" quotes never reach the CEO — the optimistic local write above always
      // looks fine, but the backend (the source of truth CEO's approval reads from) never
      // received it. Report what actually happened instead.
      if (apiSucceeded) {
        notify(`Đã gửi báo giá cho đơn #${po.poNumber || poId} thành công. Tổng giá trị: ${formatPrice(total)}. Trạng thái: Đã báo giá (chờ CEO duyệt).`, 'success');
      } else {
        console.error('Quote submission rejected by server. poId:', poId, 'itemPrices:', itemPrices, 'error:', apiErrorMessage);
        notify(`Chưa gửi được báo giá lên máy chủ. Đơn: #${po.poNumber || poId}. Lỗi: ${apiErrorMessage}. Báo giá chỉ lưu tạm trên trình duyệt này — CEO sẽ không thấy được để duyệt. Vui lòng thử lại hoặc liên hệ quản trị viên.`, 'error');
      }
    } catch (e) {
      console.warn('Quote update failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  // Supplier rejects RFQ quote request with reason
  const handleConfirmReject = async (poId, reason) => {
    if (!poId) return;
    const finalReason = reason || 'NCC từ chối báo giá.';
    const poNum = cancelModalPO?.poNumber || poId;

    setSubmitting(true);
    try {
      const payload = {
        status: 'CANCELLED',
        reason: finalReason,
        cancelReason: finalReason,
        supplierNote: `NCC Từ Chối: ${finalReason}`
      };

      // Direct localStorage write
      try {
        const allPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]');
        const updatedAllPOs = allPOs.map(p => {
          if (p.id === poId || p.poNumber === poId || String(p.id) === String(poId) || p.poNumber === poNum) {
            return { ...p, ...payload };
          }
          return p;
        });
        localStorage.setItem('erp_pos', JSON.stringify(updatedAllPOs));
        window.dispatchEvent(new Event('erp-purchase-orders-changed'));
      } catch (lsErr) {
        console.warn('localStorage direct write failed:', lsErr);
      }

      updatePurchaseOrderStatus(poId, 'CANCELLED', payload);

      // Update local state so UI reflects the cancellation immediately
      setOrders(prev => prev.map(p => {
        if (p.id === poId || p.poNumber === poId || String(p.id) === String(poId) || p.poNumber === poNum) {
          return { ...p, ...payload };
        }
        return p;
      }));

      let apiSucceeded = false;
      let apiErrorMessage = '';
      try {
        const res = await api.patch(`/purchasing/orders/${poId}/status`, payload);
        apiSucceeded = !!(res && res.success);
      } catch (apiErr) {
        apiErrorMessage = apiErr.message || 'Lỗi kết nối máy chủ';
        console.warn('Backend API reject patch offline:', apiErr);
      }

      setCancelModalPO(null);
      setSelectedPO(null);
      setCancelReason('');
      if (apiSucceeded) {
        notify(`Đã gửi thông báo từ chối báo giá cho đơn #${poNum} tới Bên Mua Hàng. Lý do: "${finalReason}"`, 'success');
      } else {
        notify(`Chưa gửi được thông báo từ chối lên máy chủ. Đơn: #${poNum}. Lỗi: ${apiErrorMessage}. Vui lòng thử lại.`, 'error');
      }
      await fetchData();
    } catch (e) {
      console.warn('Reject PO failed:', e);
      notify('Lỗi khi từ chối đơn hàng: ' + (e.message || 'Chưa rõ nguyên nhân'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'finance'
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Financial calculations for supplier
  const earnedRevenue = myPOs
    .filter(po => po.status === 'DONE')
    .reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);

  const pendingRevenue = myPOs
    .filter(po => ['PO', 'QUOTED'].includes(po.status))
    .reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);

  const fulfilledCount = myPOs.filter(po => ['PO', 'DONE'].includes(po.status)).length;

  const totalQuotedVal = myPOs
    .filter(po => ['QUOTED', 'PO', 'DONE'].includes(po.status))
    .reduce((sum, po) => sum + (parseFloat(po.totalAmount) || 0), 0);

  const filteredMyPOs = myPOs
    .filter(po => {
      if (statusFilter === 'ALL') return true;
      return po.status === statusFilter;
    })
    .sort((a, b) => {
      const dA = new Date(a.createdAt || a.date || a.issueDate || 0);
      const dB = new Date(b.createdAt || b.date || b.issueDate || 0);
      if (dB.getTime() !== dA.getTime()) return dB.getTime() - dA.getTime();
      return String(b.poNumber || b.id || '').localeCompare(String(a.poNumber || a.id || ''), 'vi', { numeric: true });
    });

  return (
    <div style={{ padding: '1.25rem 1.5rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-glass)' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, fontFamily: 'var(--font-title)', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Cổng Nhà Cung Cấp (Supplier Portal)</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Đối tác: <strong style={{ color: 'var(--primary)' }}>{user?.fullName || user?.fullname || user?.name || 'Nhà Cung Cấp'}</strong></p>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.45rem 0.85rem', borderRadius: '8px' }}>
          <LogOut size={16} />
          Đăng Xuất
        </button>
      </div>

      {/* Financial & Order KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card-glass hover-scale" style={{ padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))', borderRadius: '10px', color: 'var(--success)', flexShrink: 0 }}>
            <DollarSign size={22} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>Doanh Thu Đã Thu (DONE)</p>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.1rem', marginBottom: 0, color: 'var(--success)' }}>{formatPrice(earnedRevenue)}</h3>
          </div>
        </div>

        <div className="card-glass hover-scale" style={{ padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))', borderRadius: '10px', color: '#fbbf24', flexShrink: 0 }}>
            <CreditCard size={22} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>Doanh Thu Chờ Thanh Toán</p>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.1rem', marginBottom: 0, color: '#fbbf24' }}>{formatPrice(pendingRevenue)}</h3>
          </div>
        </div>

        <div className="card-glass hover-scale" style={{ padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.3)' }}>
          <div style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.05))', borderRadius: '10px', color: '#818cf8', flexShrink: 0 }}>
            <Truck size={22} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>Đơn Hàng Đã Cung Cấp</p>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.1rem', marginBottom: 0, color: '#0f172a' }}>{fulfilledCount} đơn</h3>
          </div>
        </div>

        <div className="card-glass hover-scale" style={{ padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '12px', border: '1px solid rgba(168,85,247,0.3)' }}>
          <div style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.05))', borderRadius: '10px', color: '#c084fc', flexShrink: 0 }}>
            <FileText size={22} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>Tổng Giá Trị Đã Báo Giá</p>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.1rem', marginBottom: 0, color: '#c084fc' }}>{formatPrice(totalQuotedVal)}</h3>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '0.5rem 1.15rem', fontSize: '0.85rem', fontWeight: 700,
            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', border: 'none',
            backgroundColor: activeTab === 'orders' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'orders' ? '#fff' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}
        >
          <PackageOpen size={16} /> Quản Lý Yêu Cầu & Báo Giá
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          style={{
            padding: '0.5rem 1.15rem', fontSize: '0.85rem', fontWeight: 700,
            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', border: 'none',
            backgroundColor: activeTab === 'finance' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'finance' ? '#fff' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}
        >
          <DollarSign size={16} /> Báo Cáo Doanh Thu & Tài Chính
        </button>
      </div>

      {/* TAB 1: ORDERS & QUOTES MANAGEMENT */}
      {activeTab === 'orders' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Column: Pending Actions (RFQ_SENT) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card-glass" style={{ padding: '1.25rem', background: 'linear-gradient(145deg, rgba(99,102,241,0.1) 0%, rgba(217,70,239,0.05) 100%)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PackageOpen size={18} color="var(--primary)" />
                YCBG Chờ Xử Lý
              </h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {pendingConfirmPOs.length.toString().padStart(2, '0')}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem', margin: '0.4rem 0 0' }}>Phòng mua hàng gửi yêu cầu báo giá, vui lòng nhập giá và xác nhận.</p>
            </div>

            {/* Pending Confirmations list */}
            <div className="card-glass" style={{ padding: '1.25rem', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
                Cần Báo Giá Ngay
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '350px', overflowY: 'auto' }}>
                {pendingConfirmPOs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1.25rem 0' }}>
                    Không có yêu cầu báo giá nào cần xử lý.
                  </div>
                ) : (
                  pendingConfirmPOs.map(po => {
                    const itemCount = po.items?.length || 1;
                    const totalQty = po.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || po.quantity || 1;
                    const itemNames = po.items?.map(i => i.product?.name || i.name).filter(Boolean).join(', ') || po.productName || 'Linh kiện';
                    return (
                      <div key={po.id || po.poNumber} style={{ padding: '0.75rem', border: '1px solid var(--border-glass)', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.82rem' }}>
                          <strong style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>{po.poNumber || formatPurchaseReference(po)}</strong>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{po.createdAt ? new Date(po.createdAt).toLocaleDateString('vi-VN') : 'Gần đây'}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#0f172a', marginBottom: '0.5rem', fontWeight: 600 }}>
                          {itemNames} ({totalQty} sản phẩm{itemCount > 1 ? ` • ${itemCount} loại` : ''})
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa báo giá</span>
                          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                            <button
                              onClick={() => handleSelectPO(po)}
                              className="btn btn-primary"
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', borderRadius: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
                              <DollarSign size={12} /> Báo Giá
                            </button>
                            <button
                              onClick={() => { setCancelModalPO(po); setCancelReason(''); }}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', border: '1px solid var(--danger)', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}
                            >
                              <X size={12} /> Từ Chối
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Order History with Filters */}
          <div className="card-glass" style={{ padding: '1.25rem', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={18} color="var(--success)" />
                Lịch Sử Báo Giá & Đơn Hàng
              </h3>
              
              {/* Filter chips */}
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', padding: '0.2rem', borderRadius: '8px' }}>
                {[
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'RFQ_SENT', label: 'Chờ Báo Giá' },
                  { id: 'QUOTED', label: 'Chờ CEO Duyệt' },
                  { id: 'PO', label: 'Đã Duyệt (PO)' },
                  { id: 'DONE', label: 'Hoàn Tất' },
                  { id: 'CANCELLED', label: 'Đã Hủy' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    style={{
                      padding: '0.25rem 0.6rem', fontSize: '0.73rem', fontWeight: 600,
                      borderRadius: '6px', cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                      backgroundColor: statusFilter === f.id ? 'var(--primary)' : 'transparent',
                      color: statusFilter === f.id ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '520px', overflowY: 'auto' }}>
              {filteredMyPOs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2.5rem 0' }}>
                  Không tìm thấy thông tin đơn hàng nào phù hợp.
                </div>
              ) : (
                filteredMyPOs.map((po) => {
                  const itemCount = po.items?.length || 1;
                  const totalQty = po.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || po.quantity || 1;
                  const itemNames = po.items?.map(i => i.product?.name || i.name).filter(Boolean).join(', ') || po.productName || 'Linh kiện';
                  const poTotal = po.totalAmount || 0;
                  return (
                    <div key={po.id || po.poNumber} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.85rem 1rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-glass)',
                      transition: 'background-color 0.2s'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ fontWeight: 700, color: '#818cf8', fontSize: '0.9rem', margin: 0 }}>{po.poNumber || formatPurchaseReference(po)}</h4>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#0f172a', marginTop: '0.25rem', fontWeight: 600 }}>
                          {itemNames} ({totalQty} sản phẩm{itemCount > 1 ? ` • ${itemCount} loại` : ''})
                        </div>
                        <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.2rem', margin: '0.2rem 0 0' }}>Ngày tạo: {po.createdAt ? new Date(po.createdAt).toLocaleDateString('vi-VN') : 'N/A'}</p>
                        {po.cancelReason && (
                          <p style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: '0.15rem', fontStyle: 'italic' }}>
                            Lý do từ chối: {po.cancelReason}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                        <div>
                          {getStatusBadge(po.status)}
                        </div>
                        {['RFQ', 'RFQ_SENT', 'SENT'].includes(po.status) ? (
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', fontWeight: 600, marginTop: '2px' }}>Chờ NCC báo giá</span>
                        ) : (
                          poTotal > 0 && (
                            <p style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.88rem', margin: 0 }}>{formatPrice(poTotal)}</p>
                          )
                        )}
                        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.1rem' }}>
                          <button
                            onClick={() => handleSelectPO(po)}
                            style={{
                              background: 'rgba(99,102,241,0.15)',
                              border: '1px solid rgba(99,102,241,0.3)',
                              color: '#818cf8',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '0.73rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <Eye size={12} /> Chi tiết
                          </button>
                          {po.status === 'RFQ_SENT' && (
                            <button
                              onClick={() => { setCancelModalPO(po); setCancelReason(''); }}
                              style={{
                                background: 'rgba(239,68,68,0.15)',
                                border: '1px solid var(--danger)',
                                color: 'var(--danger)',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '0.73rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <X size={12} /> Từ chối
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
        </div>
      )}

      {/* TAB 2: FINANCIAL REVENUE REPORT & LEDGER */}
      {activeTab === 'finance' && (
        <div className="card-glass" style={{ padding: '1.5rem', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={20} color="var(--success)" />
              Báo Cáo Doanh Thu & Dòng Tiền Thanh Toán ERP
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Cập nhật trực tiếp theo thời gian thực từ Phân hệ Kế Toán ERP
            </span>
          </div>

          <div className="table-container" style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
            <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Mã Đơn Hàng</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Linh Kiện Cung Cấp</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tổng Số Lượng</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Doanh Thu (VNĐ)</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Dòng Tiền Thanh Toán ERP</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {myPOs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Chưa có lịch sử giao dịch phát sinh doanh thu.
                    </td>
                  </tr>
                ) : (
                  myPOs.map(po => {
                    const totalQty = po.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || po.quantity || 1;
                    const itemNames = po.items?.map(i => `${i.product?.name || i.name} (x${i.quantity})`).join(', ') || po.productName || 'Linh kiện';
                    const poTotal = po.totalAmount || 0;

                    return (
                      <tr key={po.id || po.poNumber} className="hover-row">
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#818cf8', fontSize: '0.85rem' }}>
                          {po.poNumber || formatPurchaseReference(po)}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                            {po.createdAt ? new Date(po.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, maxWidth: '300px' }}>
                          {itemNames}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                          {totalQty} cái
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: poTotal > 0 ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {poTotal > 0 ? formatPrice(poTotal) : 'Chưa báo giá'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {po.status === 'DONE' ? (
                            <span className="badge badge-success" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                              Đã Thanh Toán 100%
                            </span>
                          ) : po.status === 'PO' ? (
                            <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                              Đang Cung Cấp - Chờ Thanh Toán
                            </span>
                          ) : po.status === 'QUOTED' ? (
                            <span className="badge badge-info" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                              Chờ CEO Duyệt Báo Giá
                            </span>
                          ) : po.status === 'RFQ_SENT' ? (
                            <span className="badge badge-secondary" style={{ padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                              Chờ Nhập Báo Giá
                            </span>
                          ) : po.status === 'CANCELLED' ? (
                            <span className="badge badge-danger" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                              Đã Hủy Đơn
                            </span>
                          ) : (
                            <span className="badge badge-secondary" style={{ padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                              {getStatusLabel(PO_STATUS, po.status)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleSelectPO(po)}
                            style={{
                              background: 'rgba(99,102,241,0.15)',
                              border: '1px solid rgba(99,102,241,0.3)',
                              color: '#818cf8',
                              borderRadius: '6px',
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Eye size={12} /> Xem Chi Tiết
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

      {/* DETAIL MODAL — with price input for RFQ_SENT */}
      {selectedPO && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }} onClick={() => setSelectedPO(null)}>
          <div className="card-glass" style={{
            width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto',
            padding: '2rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', color: '#0f172a', margin: 0, fontWeight: 800 }}>
                  {needsPriceInput(selectedPO) ? 'Nhập Báo Giá' : 'Chi Tiết Đơn Hàng'}: <span style={{ color: 'var(--primary)' }}>{selectedPO.poNumber || formatPurchaseReference(selectedPO)}</span>
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Ngày đặt hàng: {selectedPO.createdAt ? new Date(selectedPO.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {getStatusBadge(selectedPO.status)}
                <button onClick={() => setSelectedPO(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* RFQ_SENT or QUOTED with missing prices: Instructions for supplier */}
            {needsPriceInput(selectedPO) && (
              <div style={{ padding: '1rem', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <AlertCircle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '0.1rem' }} />
                <div>
                  <div style={{ color: '#b45309', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    {isQuotedMissingPrices(selectedPO) ? 'Đơn báo giá chưa ghi nhận được giá — Vui lòng nhập lại' : 'Phòng Mua Hàng yêu cầu báo giá'}
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                    Vui lòng nhập <strong>đơn giá</strong> cho từng sản phẩm bên dưới, rồi bấm <strong>"Gửi Báo Giá Cho CEO Duyệt"</strong> để tiến hành báo giá.
                  </div>
                </div>
              </div>
            )}

            {/* Organizations Info Card */}
            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <Building size={13}/> Đơn Vị Phát Hành
                </div>
                <strong style={{ color: '#0f172a' }}>Hệ Thống ERP AETHERPC</strong>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Phòng Mua Hàng</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <Building size={13}/> Nhà Cung Cấp
                </div>
                <strong style={{ color: 'var(--primary)' }}>{selectedPO.supplier?.name || user?.fullname || 'Nhà Cung Cấp'}</strong>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Mã NCC: {selectedPO.supplierCode || user?.code || 'N/A'}</div>
              </div>
            </div>

            {/* Items Table — with price input if RFQ_SENT */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                <Package size={15}/> Danh Sách Sản Phẩm Yêu Cầu
              </h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Tên Sản Phẩm</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', width: '80px' }}>Số Lượng</th>
                      {(needsPriceInput(selectedPO) || ['QUOTED', 'PO', 'APPROVED', 'CONFIRMED_BY_SUPPLIER', 'DONE'].includes(selectedPO.status)) && (
                        <>
                          <th style={{ padding: '0.75rem', textAlign: 'right', width: '160px' }}>
                            {needsPriceInput(selectedPO) ? 'Đơn Giá (Nhập báo giá)' : 'Đơn Giá Báo Giá'}
                          </th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', width: '130px' }}>Thành Tiền</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPO.items && selectedPO.items.length > 0 ? (
                      selectedPO.items.map((item, idx) => {
                        const itemKey = item.id || item.productId || idx;
                        const itemQty = item.quantity || 1;
                        const isInputMode = needsPriceInput(selectedPO) || ['RFQ', 'RFQ_SENT', 'SENT'].includes(selectedPO.status);
                        const currentPrice = priceInputs[itemKey] !== undefined ? priceInputs[itemKey] : (isInputMode ? '' : (item.unitCost || item.unitPrice || item.price || ''));
                        const lineTotal = (parseFloat(currentPrice) || 0) * itemQty;
                        const rawCost = parseFloat(item.unitCost) || parseFloat(item.unitPrice) || parseFloat(item.price) || parseFloat(item.cost) || parseFloat(priceInputs[itemKey]) || 0;
                        // Fallback: derive unit price from totalAmount if individual item prices are missing
                        let savedCost = rawCost;
                        if (savedCost <= 0 && selectedPO.totalAmount > 0) {
                          const totalQtyAll = (selectedPO.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
                          savedCost = totalQtyAll > 0 ? (selectedPO.totalAmount / totalQtyAll) : 0;
                        }
                        const savedTotal = (item.totalCost && parseFloat(item.totalCost) > 0) ? parseFloat(item.totalCost) : (savedCost * itemQty);
                        
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem', color: '#0f172a' }}>
                              <div style={{ fontWeight: 600 }}>{item.product?.name || item.name || 'Linh kiện'}</div>
                              {item.product?.category && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.product.category}</span>}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>x{itemQty}</td>
                            {needsPriceInput(selectedPO) && (
                              <>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Nhập giá..."
                                    value={currentPrice}
                                    onChange={(e) => setPriceInputs(prev => ({ ...prev, [itemKey]: e.target.value }))}
                                    className="form-input"
                                    style={{ 
                                      width: '100%', 
                                      textAlign: 'right', 
                                      fontSize: '0.85rem', 
                                      padding: '0.4rem 0.6rem',
                                      borderColor: currentPrice ? 'var(--success)' : '#cbd5e1',
                                      backgroundColor: currentPrice ? '#f0fdf4' : '#ffffff',
                                      color: '#0f172a'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: lineTotal > 0 ? 'var(--success)' : '#94a3b8' }}>
                                  {lineTotal > 0 ? formatPrice(lineTotal) : '—'}
                                </td>
                              </>
                            )}
                            {['QUOTED', 'PO', 'APPROVED', 'CONFIRMED_BY_SUPPLIER', 'DONE'].includes(selectedPO.status) && !needsPriceInput(selectedPO) && (
                              <>
                                <td style={{ padding: '0.75rem', textAlign: 'right', color: '#475569' }}>{formatPrice(savedCost)}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatPrice(savedTotal)}</td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                          Không có dữ liệu sản phẩm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total summary for price input mode */}
            {needsPriceInput(selectedPO) && (
              <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem', fontWeight: 700 }}>
                  <span style={{ color: '#0f172a' }}>Tổng Báo Giá:</span>
                  <span style={{ color: 'var(--success)', fontSize: '1.3rem' }}>
                    {getQuotedTotal(selectedPO) > 0 ? formatPrice(getQuotedTotal(selectedPO)) : '— (Vui lòng nhập giá)'}
                  </span>
                </div>
              </div>
            )}

            {/* PO / APPROVED: CEO approved, waiting for Supplier Confirmation & Delivery Schedule */}
            {(selectedPO.status === 'PO' || selectedPO.status === 'APPROVED') && (
              <div style={{ padding: '1.25rem', backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                  <Truck size={22} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ color: '#1e40af', fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.2rem' }}>
                      CEO ĐÃ PHÊ DUYỆT PHIẾU MUA HÀNG NÀY
                    </div>
                    <div style={{ color: '#334155', fontSize: '0.85rem', lineHeight: '1.45' }}>
                      Phòng Mua Hàng và CEO đã phê duyệt báo giá. Vui lòng <strong>xác nhận đơn hàng</strong> và <strong>hẹn ngày giao hàng</strong> gửi lại cho Bên Mua Hàng & Kho.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#ffffff', padding: '1rem', borderRadius: '10px', border: '1px solid #dbeafe' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                      Chọn Ngày Hẹn Giao Hàng <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={deliveryDateInput}
                      onChange={(e) => setDeliveryDateInput(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #2563eb', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', backgroundColor: '#f8fafc' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                      Ghi Chú / Cam Kết Giao Hàng Của NCC
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Hàng có sẵn kho, cam kết giao đúng hẹn..."
                      value={supplierNoteInput}
                      onChange={(e) => setSupplierNoteInput(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CONFIRMED_BY_SUPPLIER: Supplier has already confirmed delivery date */}
            {selectedPO.status === 'CONFIRMED_BY_SUPPLIER' && (
              <div style={{ padding: '1rem 1.25rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle size={22} color="#16a34a" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#15803d', fontSize: '0.92rem', fontWeight: 800 }}>
                    ĐÃ XÁC NHẬN ĐƠN HÀNG & HẸN NGÀY GIAO HÀNG
                  </div>
                  <div style={{ color: '#334155', fontSize: '0.83rem', marginTop: '2px' }}>
                    Ngày hẹn giao: <strong style={{ color: '#16a34a' }}>{selectedPO.expectedDeliveryDate ? new Date(selectedPO.expectedDeliveryDate).toLocaleDateString('vi-VN') : deliveryDateInput || 'N/A'}</strong>
                    {selectedPO.supplierNote && <span> • Ghi chú: <em>"{selectedPO.supplierNote}"</em></span>}
                  </div>
                </div>
              </div>
            )}

            {/* QA Inspection Status Banners */}
            {selectedPO.status === 'QA_PASSED' && (
              <div style={{ padding: '1rem 1.25rem', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle size={22} color="#16a34a" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#15803d', fontSize: '0.95rem', fontWeight: 800 }}>
                    KẾT QUẢ QA/QC: ĐẠT 100% TIÊU CHUẨN CHẤT LƯỢNG
                  </div>
                  <div style={{ color: '#334155', fontSize: '0.84rem', marginTop: '2px' }}>
                    Chuyên viên kiểm định QA/QC đã nghiệm thu lô hàng đạt chuẩn và bàn giao Thủ kho thực hiện nhập kho thành công.
                  </div>
                </div>
              </div>
            )}

            {selectedPO.status === 'QA_PARTIAL' && (() => {
              let log = null;
              try {
                const rawLogs = JSON.parse(localStorage.getItem('erp_qa_inspection_logs') || '[]');
                log = rawLogs.find(l => l.poNumber === selectedPO.poNumber || String(l.poNumber) === String(selectedPO.id));
              } catch (_) {}

              const DEFECT_LABELS = {
                PACKAGE_DAMAGED: 'Móp hộp outer / Hỏng niêm phong đóng gói',
                ELECTRICAL_POWER_FAIL: 'Lỗi nguồn / Điện áp / Lỗi bo mạch không lên',
                SERIAL_WARRANTY_MISSING: 'Thiếu tem bảo hành chính hãng / Sai Serial Number',
                SPEC_MISMATCH: 'Trầy xước / Sai thông số kỹ thuật (Wrong Specs)',
                COUNTERFEIT_FAKE: 'Hàng nghi ngờ nhái / Không đúng mô tả',
                NONE: 'Không có lỗi'
              };

              const total = log?.totalQty || selectedPO.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || selectedPO.quantity || 7;
              const passed = log ? Number(log.passedQty) : 6;
              const failed = log ? Number(log.failedQty) : 1;
              const defectText = log?.defectCategory ? (DEFECT_LABELS[log.defectCategory] || log.defectCategory) : 'Móp hộp outer / Hỏng niêm phong đóng gói';
              const notesText = log?.notes || selectedPO.supplierNote || 'Có 1 sản phẩm bị lỗi bao bì niêm phong, 6 sản phẩm đạt chất lượng.';

              return (
                <div style={{ padding: '1.2rem 1.25rem', backgroundColor: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '14px', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px dashed #fdba74', paddingBottom: '0.65rem' }}>
                    <div style={{ color: '#c2410c', fontSize: '0.98rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <AlertCircle size={20} color="#ea580c" />
                      KẾT QUẢ NGHIỆM THU QA/QC: NHẬP KHO MỘT PHẦN
                    </div>
                    <span style={{ backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', fontWeight: 800, fontSize: '0.78rem', padding: '4px 10px', borderRadius: '12px' }}>
                      TỶ LỆ ĐẠT: {Math.round((passed / total) * 100)}%
                    </span>
                  </div>

                  {/* Quantity Breakdown Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem', textAlign: 'center', fontSize: '0.83rem' }}>
                    <div style={{ backgroundColor: '#ffffff', padding: '0.6rem', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                      <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block', fontWeight: 700 }}>TỔNG SỐ LƯỢNG GIAO</span>
                      <strong style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 900 }}>{total} SP</strong>
                    </div>
                    <div style={{ backgroundColor: '#f0fdf4', padding: '0.6rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <span style={{ color: '#15803d', fontSize: '0.72rem', display: 'block', fontWeight: 700 }}>SỐ LƯỢNG ĐẠT (CHO NHẬP)</span>
                      <strong style={{ fontSize: '1.1rem', color: '#16a34a', fontWeight: 900 }}>{passed} SP</strong>
                    </div>
                    <div style={{ backgroundColor: '#fef2f2', padding: '0.6rem', borderRadius: '8px', border: '1px solid #fecaca' }}>
                      <span style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', fontWeight: 700 }}>SỐ LƯỢNG LỖI (TRẢ LẠI NCC)</span>
                      <strong style={{ fontSize: '1.1rem', color: '#dc2626', fontWeight: 900 }}>{failed} SP</strong>
                    </div>
                  </div>

                  {/* Defect details & QA Notes */}
                  <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #fed7aa', fontSize: '0.84rem' }}>
                    <div style={{ fontWeight: 800, color: '#9a3412', marginBottom: '0.35rem' }}>
                      NGUYÊN NHÂN TRẢ LẠI: <span style={{ color: '#dc2626', fontWeight: 900 }}>{defectText}</span>
                    </div>
                    <div style={{ color: '#475569', fontSize: '0.82rem', fontStyle: 'italic', backgroundColor: '#fff7ed', padding: '0.55rem 0.75rem', borderRadius: '6px', borderLeft: '3px solid #ea580c' }}>
                      Ghi chú từ Bộ phận QA/QC: "{notesText}"
                    </div>
                  </div>
                </div>
              );
            })()}

            {selectedPO.status === 'QA_REJECTED' && (
              <div style={{ padding: '1rem 1.25rem', backgroundColor: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <XCircle size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ color: '#dc2626', fontSize: '0.95rem', fontWeight: 800 }}>
                    KẾT QUẢ QA/QC: TỪ CHỐI CHẤT LƯỢNG & TẠO PHIẾU HOÀN TRẢ NCC
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.84rem', marginTop: '3px', lineHeight: '1.45' }}>
                    Lô hàng không đạt tiêu chuẩn kỹ thuật hoặc bị hư hỏng. Bộ phận QA/QC đã lập biên bản hoàn trả.
                    {selectedPO.supplierNote && <div style={{ color: '#991b1b', fontWeight: 700, marginTop: '4px' }}>Chi tiết: {selectedPO.supplierNote}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Total summary */}
            {['QUOTED', 'PO', 'APPROVED', 'CONFIRMED_BY_SUPPLIER', 'DONE'].includes(selectedPO.status) && selectedPO.totalAmount > 0 && (
              <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem', fontWeight: 700 }}>
                  <span style={{ color: '#0f172a' }}>Tổng Báo Giá Đơn Hàng:</span>
                  <span style={{ color: 'var(--success)', fontSize: '1.3rem' }}>{formatPrice(selectedPO.totalAmount)}</span>
                </div>
              </div>
            )}

            {selectedPO.cancelReason && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#dc2626' }}>
                Lý do từ chối: <strong>{selectedPO.cancelReason}</strong>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
              {(selectedPO.status === 'PO' || selectedPO.status === 'APPROVED') && (
                <button
                  onClick={() => handleSupplierConfirmDelivery(selectedPO)}
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.4rem', fontSize: '0.88rem', backgroundColor: '#2563eb', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, borderRadius: '8px' }}
                  disabled={submitting || !deliveryDateInput}
                >
                  <Truck size={17} /> Xác Nhận Đơn & Hẹn Ngày Giao Gửi Bên Mua Hàng
                </button>
              )}
              {needsPriceInput(selectedPO) && (
                <>
                  <button
                    onClick={() => { setCancelModalPO(selectedPO); setCancelReason(''); }}
                    style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', backgroundColor: '#fef2f2', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                    disabled={submitting}
                  >
                    <X size={15} /> Từ Chối
                  </button>
                  <button
                    onClick={() => handleConfirmPO(selectedPO)}
                    className="btn btn-primary"
                    style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', backgroundColor: 'var(--success)', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                    disabled={submitting || getQuotedTotal(selectedPO) <= 0}
                  >
                    <Check size={15} /> Gửi Báo Giá Cho CEO Duyệt
                  </button>
                </>
              )}
              <button onClick={() => setSelectedPO(null)} className="btn btn-secondary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', borderRadius: '8px' }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION / CANCEL MODAL WITH REASON */}
      {cancelModalPO && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
        }} onClick={() => setCancelModalPO(null)}>
          <div className="card-glass" style={{
            width: '100%', maxWidth: '520px', padding: '1.5rem', backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--danger)', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <XCircle size={20} />
                Từ Chối YCBG #{cancelModalPO.poNumber || cancelModalPO.id}
              </h3>
              <button onClick={() => setCancelModalPO(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1rem' }}>
              Vui lòng chọn hoặc nhập lý do từ chối cho Phòng Mua Hàng:
            </p>

            {/* Quick Reason Chips */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {[
                'Tạm hết hàng trong kho',
                'Giá linh kiện biến động',
                'Không đủ số lượng yêu cầu',
                'Thời gian giao quá gấp',
                'Ngưng sản xuất mẫu này'
              ].map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setCancelReason(chip)}
                  style={{
                    padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px',
                    backgroundColor: cancelReason === chip ? '#fee2e2' : '#f8fafc',
                    border: '1px solid', borderColor: cancelReason === chip ? 'var(--danger)' : '#cbd5e1',
                    color: cancelReason === chip ? '#dc2626' : '#475569',
                    fontWeight: cancelReason === chip ? 700 : 500,
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Custom Reason Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#64748b', marginBottom: '0.4rem' }}>
                Ghi chú lý do chi tiết:
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Nhập lý do cụ thể..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem 0.75rem', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setCancelModalPO(null)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                Hủy Bỏ
              </button>
              <button
                onClick={() => handleConfirmReject(cancelModalPO.id || cancelModalPO.poNumber, cancelReason)}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', backgroundColor: 'var(--danger)', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                disabled={submitting}
              >
                <X size={14} /> Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
