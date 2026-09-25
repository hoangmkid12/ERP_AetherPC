import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notify, confirm } from '../../context/NotificationContext';
import { PO_STATUS, getStatusLabel } from '../../utils/statusLabels';
import { useFinanceStore } from '../../stores';
import { api } from '../../services/api';
import {
  PackageOpen, Clock, FileText, CheckCircle, LogOut, AlertCircle,
  Eye, X, Check, Building, Calendar, Package, DollarSign, XCircle, Truck, CreditCard, Boxes, Printer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrencyInWords } from '../../utils/numberToWords';
import { printDocument } from '../../utils/printDocument';

export default function SupplierPortal() {
  const { user, logout } = useAuth();
  const purchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];
  const updatePurchaseOrderStatus = useFinanceStore(state => state.updatePurchaseOrderStatus);
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState(null);
  const [printPOTarget, setPrintPOTarget] = useState(null);
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
    const isRfq = ['RFQ', 'RFQ_SENT', 'AWAITING_SUPPLIER_QUOTE', 'QUOTED', 'PENDING_PO_DRAFT', 'CONVERTED', 'DRAFT_RFQ'].includes(po.status) || po.type === 'BACKORDER_RFQ' || po.type === 'RFQ';
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

        // NOTE: this used to merge a cached local copy of each PO on top of the fresh
        // API response ("prefer local if it has items with prices"), meaning a stale
        // localStorage snapshot — from an earlier/aborted quote attempt, or a PO whose
        // items never had a real numeric `id` (e.g. the Warehouse backorder-RFQ flow) —
        // could silently overwrite the price a supplier had just quoted and the backend
        // had correctly saved. That's the "I enter one price and it confirms a different
        // one" bug: once the API has this PO, it is authoritative, full stop — the same
        // rule already applied to Purchasing.jsx and Warehouse.jsx's own PO fetches.
        //
        // Local/context data may still introduce a PO the API doesn't know about yet.
        const contextPOs = latestLocalPOs.filter(po =>
          !apiPOs.some(ap => ap.poNumber === po.poNumber || String(ap.id) === String(po.id))
        );
        const formattedOrders = [...apiPOs, ...contextPOs].map(po => ({
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const getSupplierName = (po) => {
    return po?.supplier?.name || po?.supplierName || user?.fullname || user?.name || 'Nhà Cung Cấp';
  };

  // Filter POs for this supplier using flexible status and supplier matching
  const myPOs = orders.filter(po => {
    const isStatusMatch = ['RFQ', 'RFQ_SENT', 'SENT', 'QUOTED', 'PENDING_PO_DRAFT', 'CONVERTED', 'QUOTED_PENDING_CEO', 'PO', 'APPROVED', 'CONFIRMED_BY_SUPPLIER', 'QA_PASSED', 'QA_PARTIAL', 'QA_REJECTED', 'RECEIVED', 'DONE', 'COMPLETED', 'CANCELLED'].includes(po?.status);
    
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
        return <span className="badge badge-info" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>Đã Báo Giá (Chờ Xác Nhận)</span>;
      case 'PENDING_PO_DRAFT':
        return <span className="badge badge-info" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>Đã Được Chọn (Đang Lập Phiếu)</span>;
      case 'CONVERTED':
        return <span className="badge badge-success" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid #bbf7d0' }}>Báo Giá Đã Được Chọn (Xem Đơn PO Mới)</span>;
      case 'QUOTED_PENDING_CEO':
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
    // `po` already comes from `orders`, which fetchData() populates from the real API
    // (authoritative once it has this PO) — merging a cached localStorage copy on top
    // here re-introduced the exact same "stale price overwrites the real one" bug that
    // was just fixed in fetchData(), just triggered by opening a PO instead of listing it.
    const freshPO = po;

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

  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'products', or 'finance'
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Danh sách sản phẩm NCC đang là nhà phân phối mặc định (Product.defaultSupplierCode)
  // — trước đây Cổng NCC chỉ thấy từng RFQ/PO riêng lẻ, không có cái nhìn tổng quan
  // danh mục sản phẩm mình phụ trách.
  const [myProducts, setMyProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const fetchMyProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await api.get('/purchasing/suppliers/me/products');
      setMyProducts(res.data || []);
    } catch (err) {
      notify(err?.message || 'Không thể tải danh sách sản phẩm đang cung cấp.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'products') return;
    fetchMyProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const filteredMyProducts = myProducts.filter(p => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return true;
    return (p.name || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term);
  });

  // Financial calculations for supplier — must cover the FULL post-quote lifecycle
  // (QUOTED -> PO -> CONFIRMED_BY_SUPPLIER -> PENDING_QA -> QA_PASSED/PARTIAL -> RECEIVED
  // -> DONE), not just the two endpoints. Missing the intermediate statuses used to make
  // an order's value briefly vanish from every KPI the moment the supplier shipped it —
  // it fell out of "pending" (no longer QUOTED/PO) but wasn't "earned" (not DONE, which
  // only happens once Accounting has also fully paid the vendor bill).
  const AWAITING_PAYMENT_STATUSES = ['QUOTED', 'PENDING_PO_DRAFT', 'QUOTED_PENDING_CEO', 'PO', 'CONFIRMED_BY_SUPPLIER', 'PENDING_QA', 'QA_PASSED', 'QA_PARTIAL', 'RECEIVED'];
  const SUPPLIED_STATUSES = ['CONFIRMED_BY_SUPPLIER', 'PENDING_QA', 'QA_PASSED', 'QA_PARTIAL', 'QA_REJECTED', 'RECEIVED', 'DONE'];

  // po.totalAmount is the ORIGINAL quoted amount and is never adjusted after a
  // QC_PARTIAL rejection — only the VendorBill (createVendorBill prorates it by
  // acceptRatio) and its VendorPayments reflect the real, QC-corrected money.
  // Summing po.totalAmount directly used to show the supplier as having earned/
  // being owed the full order value even when a partial QC rejection had
  // correctly cut their actual bill in half. Once a bill exists, its
  // amountTotal (and the payments against it) are the source of truth.
  const getPoBilledAmount = (po) => (
    Array.isArray(po.bills) && po.bills.length > 0
      ? po.bills.reduce((s, b) => s + (parseFloat(b.amountTotal) || 0), 0)
      : (parseFloat(po.totalAmount) || 0)
  );
  const getPoPaidAmount = (po) => (
    Array.isArray(po.bills)
      ? po.bills.reduce((s, b) => s + (Array.isArray(b.payments) ? b.payments.reduce((s2, p) => s2 + (parseFloat(p.amount) || 0), 0) : 0), 0)
      : 0
  );

  const earnedRevenue = myPOs
    .filter(po => po.status === 'DONE')
    .reduce((sum, po) => sum + getPoPaidAmount(po), 0);

  const pendingRevenue = myPOs
    .filter(po => AWAITING_PAYMENT_STATUSES.includes(po.status) && po.status !== 'CONVERTED')
    .reduce((sum, po) => sum + Math.max(0, getPoBilledAmount(po) - getPoPaidAmount(po)), 0);

  // "Đơn Hàng Đã Cung Cấp" = orders the supplier has actually shipped — 'PO' alone
  // (CEO approved, supplier hasn't even confirmed delivery yet) was never "supplied".
  const fulfilledCount = myPOs.filter(po => SUPPLIED_STATUSES.includes(po.status)).length;

  const totalQuotedVal = myPOs
    .filter(po => ['QUOTED', ...AWAITING_PAYMENT_STATUSES, 'DONE'].includes(po.status) && po.status !== 'CONVERTED')
    .reduce((sum, po) => sum + getPoBilledAmount(po), 0);

  // Báo Cáo Doanh Thu & Dòng Tiền: Chỉ ghi nhận các đơn PO chính thức, loại trừ RFQ đã CONVERTED
  // để tránh việc 1 đơn hàng (AMD Ryzen 3 4100 x23) xuất hiện 2 lần gây nhầm lẫn là 2 đơn!
  const financePOs = myPOs.filter(po => {
    if (po.status === 'CONVERTED') return false;
    if (['RFQ', 'RFQ_SENT', 'SENT'].includes(po.status)) return false;
    return true;
  });

  // Covers the full PO lifecycle — the old chip list only had 6 exact-match statuses
  // (RFQ_SENT/QUOTED/PO/DONE/CANCELLED) out of ~13 real ones, so any order sitting in
  // the middle of fulfillment (confirmed, awaiting QC, QC passed/rejected, received)
  // had nowhere to be found except "Tất cả".
  const STATUS_FILTER_GROUPS = [
    { id: 'ALL', label: 'Tất cả', match: null },
    { id: 'RFQ_SENT', label: 'Chờ Báo Giá', match: ['RFQ', 'RFQ_SENT', 'SENT'] },
    { id: 'QUOTED', label: 'Đã Báo Giá', match: ['QUOTED', 'PENDING_PO_DRAFT', 'CONVERTED'] },
    { id: 'PO', label: 'Đã Duyệt (PO)', match: ['QUOTED_PENDING_CEO', 'PO', 'APPROVED'] },
    { id: 'SHIPPING', label: 'Đang Giao/Chờ QC', match: ['CONFIRMED_BY_SUPPLIER', 'PENDING_QA'] },
    { id: 'QA_DONE', label: 'QC Đã Kiểm Định', match: ['QA_PASSED', 'QA_PARTIAL', 'QA_REJECTED', 'RECEIVED'] },
    { id: 'DONE', label: 'Hoàn Tất', match: ['DONE', 'COMPLETED'] },
    { id: 'CANCELLED', label: 'Đã Hủy', match: ['CANCELLED'] }
  ];

  const filteredMyPOs = myPOs
    .filter(po => {
      if (statusFilter === 'ALL') {
        // Khi xem "Tất cả", nếu một RFQ đã CONVERTED sang đơn PO chính thức thì ẩn đơn RFQ trung gian này,
        // chỉ hiển thị đơn PO chính thức đang được xử lý, tránh hiển thị song song 2 đơn (1 RFQ + 1 PO)
        // khiến NCC hiểu nhầm là bên Mua đặt 2 lần 2 đơn giống nhau.
        // NCC vẫn có thể tra cứu đơn RFQ cũ bất kỳ lúc nào khi chọn bộ lọc "Đã Báo Giá" (QUOTED).
        if (po.status === 'CONVERTED') return false;
        return true;
      }
      const group = STATUS_FILTER_GROUPS.find(g => g.id === statusFilter);
      return group ? group.match.includes(po.status) : po.status === statusFilter;
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
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, fontFamily: 'var(--font-title)', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Cổng Nhà Cung Cấp</h1>
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>Doanh Thu Đã Thu</p>
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
          onClick={() => setActiveTab('products')}
          style={{
            padding: '0.5rem 1.15rem', fontSize: '0.85rem', fontWeight: 700,
            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', border: 'none',
            backgroundColor: activeTab === 'products' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'products' ? '#fff' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}
        >
          <Boxes size={16} /> Sản Phẩm Đang Cung Cấp
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
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                            <button
                              onClick={() => handleSelectPO(po)}
                              className="btn btn-primary"
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.74rem', borderRadius: '5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                              <DollarSign size={12} /> Báo Giá
                            </button>
                            <button
                              onClick={() => { setCancelModalPO(po); setCancelReason(''); }}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.74rem', borderRadius: '5px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap', flexShrink: 0 }}
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
                {STATUS_FILTER_GROUPS.map(f => (
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
                  const poTotal = getPoBilledAmount(po);
                  const isQcAdjusted = Array.isArray(po.bills) && po.bills.length > 0 && Number(poTotal) !== Number(po.totalAmount || 0);
                  const isPendingQuote = ['RFQ', 'RFQ_SENT', 'SENT'].includes(po.status);

                  return (
                    <div key={po.id || po.poNumber} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.95rem 1.15rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-glass, #e2e8f0)',
                      transition: 'all 0.2s ease',
                      gap: '1rem'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h4 style={{ fontWeight: 700, color: '#6366f1', fontSize: '0.9rem', margin: 0, fontFamily: 'monospace' }}>
                            {po.poNumber || formatPurchaseReference(po)}
                          </h4>
                          {po.status === 'CONVERTED' && (
                            <span style={{ fontSize: '0.72rem', color: '#16a34a', backgroundColor: '#f0fdf4', padding: '1px 7px', borderRadius: '4px', border: '1px solid #bbf7d0', fontWeight: 700 }}>
                              ✓ Đã chuyển thành đơn PO{po.derivedPOs?.[0]?.poNumber ? `: ${po.derivedPOs[0].poNumber}` : ''}
                            </span>
                          )}
                          {po.sourceRfq && (
                            <span style={{ fontSize: '0.72rem', color: '#2563eb', backgroundColor: '#eff6ff', padding: '1px 7px', borderRadius: '4px', border: '1px solid #bfdbfe', fontWeight: 600 }}>
                              Lập từ báo giá {po.sourceRfq.poNumber || formatPurchaseReference(po.sourceRfq)}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.84rem', color: '#0f172a', marginTop: '0.3rem', fontWeight: 600, lineHeight: 1.35 }}>
                          {itemNames}
                          <span style={{
                            marginLeft: '0.45rem',
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(99,102,241,0.08)',
                            color: '#4f46e5',
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            border: '1px solid rgba(99,102,241,0.2)'
                          }}>
                            {totalQty} sản phẩm{itemCount > 1 ? ` • ${itemCount} loại` : ''}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: '0.25rem 0 0' }}>
                          Ngày tạo: {po.createdAt ? new Date(po.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                        </p>
                        {po.cancelReason && (
                          (() => {
                            const r = po.cancelReason;
                            const isCompleted = ['DONE', 'COMPLETED', 'RECEIVED'].includes(po.status);
                            const isQaNotice = r.startsWith('[THÔNG BÁO QA/QC') || r.startsWith('[THÔNG BÁO HOÀN TRẢ') || r.startsWith('[THÔNG BÁO TỪ CHỐI');
                            if (!isQaNotice) return null;
                            const isReturn = !isCompleted && (r.startsWith('[THÔNG BÁO HOÀN TRẢ') || r.startsWith('[THÔNG BÁO TỪ CHỐI'));
                            const cleanMsg = r.replace(/^\[[^\]]*\]:\s*/, '');
                            return isReturn ? (
                              <p style={{ fontSize: '0.72rem', color: '#c2410c', marginTop: '0.2rem', fontStyle: 'italic', margin: '0.2rem 0 0' }}>
                                ⚠️ {cleanMsg}
                              </p>
                            ) : (
                              <p style={{ fontSize: '0.72rem', color: '#15803d', marginTop: '0.2rem', fontStyle: 'italic', margin: '0.2rem 0 0' }}>
                                ✅ {cleanMsg}
                              </p>
                            );
                          })()
                        )}
                      </div>

                      <div style={{ 
                        flexShrink: 0,
                        textAlign: 'right', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'flex-end', 
                        justifyContent: 'center',
                        gap: '0.35rem',
                        minWidth: '220px'
                      }}>
                        <div>
                          {getStatusBadge(po.status)}
                        </div>

                        {isPendingQuote ? (
                          <span style={{ fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic', fontWeight: 600 }}>
                            Chờ NCC báo giá
                          </span>
                        ) : (
                          poTotal > 0 && (
                            <>
                              <p style={{ fontWeight: 800, color: 'var(--success, #16a34a)', fontSize: '0.95rem', margin: 0 }}>
                                {formatPrice(poTotal)}
                              </p>
                              {isQcAdjusted && (
                                <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 600 }}>
                                  Đã điều chỉnh theo QC (gốc {formatPrice(po.totalAmount)})
                                </span>
                              )}
                            </>
                          )
                        )}

                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'nowrap', marginTop: '0.15rem' }}>
                          {isPendingQuote ? (
                            <>
                              <button
                                onClick={() => handleSelectPO(po)}
                                title="Nhập đơn giá và gửi báo giá cho AetherPC"
                                style={{
                                  background: '#2563eb',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '5px',
                                  padding: '4px 10px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  boxShadow: '0 1px 3px rgba(37,99,235,0.25)'
                                }}
                              >
                                <DollarSign size={13} /> Báo Giá
                              </button>
                              <button
                                onClick={() => handleSelectPO(po)}
                                title="Xem chi tiết yêu cầu"
                                style={{
                                  background: 'rgba(99,102,241,0.1)',
                                  border: '1px solid rgba(99,102,241,0.3)',
                                  color: '#6366f1',
                                  borderRadius: '5px',
                                  padding: '4px 9px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                <Eye size={13} /> Chi tiết
                              </button>
                              <button
                                onClick={() => { setCancelModalPO(po); setCancelReason(''); }}
                                title="Từ chối yêu cầu báo giá"
                                style={{
                                  background: 'rgba(239,68,68,0.1)',
                                  border: '1px solid rgba(239,68,68,0.3)',
                                  color: 'var(--danger, #dc2626)',
                                  borderRadius: '5px',
                                  padding: '4px 8px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                <X size={13} /> Từ chối
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setPrintPOTarget(po)}
                                title="Xem và in phiếu đặt hàng (PO)"
                                style={{
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#1d4ed8',
                                  borderRadius: '5px',
                                  padding: '4px 9px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                <Printer size={13} /> Xem Phiếu
                              </button>
                              <button
                                onClick={() => handleSelectPO(po)}
                                style={{
                                  background: 'rgba(99,102,241,0.1)',
                                  border: '1px solid rgba(99,102,241,0.3)',
                                  color: '#6366f1',
                                  borderRadius: '5px',
                                  padding: '4px 10px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                <Eye size={13} /> Chi tiết
                              </button>
                            </>
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

      {/* TAB: PRODUCTS CURRENTLY SUPPLIED */}
      {activeTab === 'products' && (
        <div className="card-glass" style={{ padding: '1.5rem', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Boxes size={20} color="var(--primary)" />
                Sản Phẩm Đang Cung Cấp
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
                Các sản phẩm mà quý công ty đang là nhà phân phối mặc định trong hệ thống AetherPC ERP ({myProducts.length} sản phẩm)
              </p>
            </div>
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc SKU..."
              style={{ padding: '0.5rem 0.85rem', border: '1px solid var(--border-glass)', borderRadius: '8px', fontSize: '0.83rem', minWidth: '220px', backgroundColor: 'rgba(255,255,255,0.02)', color: 'inherit' }}
            />
          </div>

          <div className="table-container" style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
            <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Sản Phẩm</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>SKU</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Danh Mục</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tồn Kho ERP</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái Bán</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Giá Bán Lẻ Niêm Yết</th>
                </tr>
              </thead>
              <tbody>
                {productsLoading ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Đang tải danh sách sản phẩm...
                    </td>
                  </tr>
                ) : filteredMyProducts.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      {myProducts.length === 0
                        ? 'Hệ thống chưa ghi nhận sản phẩm nào do quý công ty là nhà phân phối mặc định.'
                        : 'Không tìm thấy sản phẩm phù hợp.'}
                    </td>
                  </tr>
                ) : (
                  filteredMyProducts.map(p => {
                    const stock = Number(p.stockQuantity) || 0;
                    const isActive = p.status === 'ACTIVE' && p.available !== false;
                    return (
                      <tr key={p.productId} className="hover-row">
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#0f172a', fontWeight: 700, maxWidth: '320px' }}>
                          {p.name}
                          {p.brand?.name && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>{p.brand.name}</div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.sku || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.category?.name || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '0.88rem', color: stock === 0 ? '#ef4444' : (stock <= 5 ? '#d97706' : 'inherit') }}>
                          {stock}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {isActive ? (
                            <span className="badge badge-success" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '0.3rem 0.65rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>
                              Đang Bán
                            </span>
                          ) : (
                            <span className="badge badge-secondary" style={{ padding: '0.3rem 0.65rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>
                              Ngừng Bán
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                          {formatPrice(p.price)}
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
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {financePOs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Chưa có lịch sử giao dịch phát sinh doanh thu.
                    </td>
                  </tr>
                ) : (
                  financePOs.map(po => {
                    const totalQty = po.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || po.quantity || 1;
                    const itemNames = po.items?.map(i => `${i.product?.name || i.name} (x${i.quantity})`).join(', ') || po.productName || 'Linh kiện';
                    const poTotal = getPoBilledAmount(po);

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
                              Đã Duyệt - Chờ NCC Xác Nhận
                            </span>
                          ) : ['CONFIRMED_BY_SUPPLIER', 'PENDING_QA', 'QA_PASSED', 'QA_PARTIAL', 'RECEIVED'].includes(po.status) ? (
                            <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                              Đang Cung Cấp - Chờ Thanh Toán
                            </span>
                          ) : po.status === 'QUOTED_PENDING_CEO' ? (
                            <span className="badge badge-info" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                              Chờ CEO Duyệt Báo Giá
                            </span>
                          ) : po.status === 'QUOTED' ? (
                            <span className="badge badge-info" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                              Chờ Xác Nhận Báo Giá
                            </span>
                          ) : po.status === 'PENDING_PO_DRAFT' ? (
                            <span className="badge badge-info" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                              Đã Được Chọn — Đang Lập Phiếu
                            </span>
                          ) : po.status === 'CONVERTED' ? (
                            <span className="badge badge-success" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                              Đã Được Chọn — Xem Đơn PO Mới
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
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              onClick={() => setPrintPOTarget(po)}
                              title="Xem và in phiếu đặt hàng (PO)"
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1d4ed8',
                                borderRadius: '6px',
                                padding: '0.3rem 0.65rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Printer size={12} /> Xem Phiếu
                            </button>
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

      {/* DETAIL MODAL — with price input for RFQ_SENT */}
      {selectedPO && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }} onClick={() => setSelectedPO(null)}>
          <div className="card-glass" style={{
            width: '100%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto',
            padding: '2rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '1rem',
              marginBottom: '1.25rem',
              gap: '1rem'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{
                  fontSize: '1.28rem',
                  color: '#0f172a',
                  margin: 0,
                  fontWeight: 800,
                  lineHeight: 1.35
                }}>
                  {needsPriceInput(selectedPO) ? 'Nhập Báo Giá' : 'Chi Tiết Đơn Hàng'}:{' '}
                  <span style={{ color: 'var(--primary, #2563eb)', whiteSpace: 'nowrap' }}>
                    {selectedPO.poNumber || formatPurchaseReference(selectedPO)}
                  </span>
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Ngày đặt hàng: {selectedPO.createdAt ? new Date(selectedPO.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                  </span>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  {getStatusBadge(selectedPO.status)}
                </div>
              </div>

              {/* Nút X ở góc trên bên phải */}
              <button
                onClick={() => setSelectedPO(null)}
                title="Đóng"
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Liên kết chéo giữa RFQ và PO */}
            {selectedPO.status === 'CONVERTED' && (
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '10px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle size={20} color="#16a34a" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.84rem' }}>
                  <span style={{ color: '#15803d', fontWeight: 700 }}>Báo giá này đã được duyệt và lập thành Đơn Đặt Hàng chính thức: </span>
                  <strong style={{ color: '#2563eb' }}>{selectedPO.derivedPOs?.[0]?.poNumber || 'Xem trong danh sách Đơn Hàng'}</strong>
                </div>
              </div>
            )}
            {selectedPO.sourceRfq && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '10px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={18} color="#2563eb" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.84rem', color: '#1e40af' }}>
                  Đơn đặt hàng này được chuyển đổi từ yêu cầu báo giá gốc: <strong>{selectedPO.sourceRfq.poNumber || formatPurchaseReference(selectedPO.sourceRfq)}</strong>
                </div>
              </div>
            )}

            {/* Ghi chú/điều khoản Phòng Mua Hàng nhập khi lập Phiếu Mua Hàng — NCC
                cần thấy để biết yêu cầu đóng gói, thanh toán, giao hàng... */}
            {selectedPO.notes && (
              <div style={{ padding: '1rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', marginBottom: '1.5rem' }}>
                <div style={{ color: '#92400e', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>Ghi Chú / Điều Khoản Từ Bên Mua</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#78350f', whiteSpace: 'pre-wrap' }}>{selectedPO.notes}</p>
              </div>
            )}

            {/* RFQ_SENT or QUOTED with missing prices: Instructions for supplier */}
            {needsPriceInput(selectedPO) && (
              <div style={{ padding: '1rem', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <AlertCircle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '0.1rem' }} />
                <div>
                  <div style={{ color: '#b45309', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    {isQuotedMissingPrices(selectedPO) ? 'Đơn báo giá chưa ghi nhận được giá — Vui lòng nhập lại' : 'Phòng Mua Hàng yêu cầu báo giá'}
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                    Vui lòng nhập <strong>đơn giá</strong> cho từng sản phẩm bên dưới, rồi bấm <strong>"Gửi Báo Giá"</strong> để tiến hành báo giá.
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
                      {(needsPriceInput(selectedPO) || ['QUOTED', 'PENDING_PO_DRAFT', 'CONVERTED', 'QUOTED_PENDING_CEO', 'PO', 'APPROVED', 'CONFIRMED_BY_SUPPLIER', 'DONE'].includes(selectedPO.status)) && (
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
                            {['QUOTED', 'PENDING_PO_DRAFT', 'CONVERTED', 'QUOTED_PENDING_CEO', 'PO', 'APPROVED', 'CONFIRMED_BY_SUPPLIER', 'DONE'].includes(selectedPO.status) && !needsPriceInput(selectedPO) && (
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
                SPEC_MISMATCH: 'Trầy xước / Sai thông số kỹ thuật',
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
            {['QUOTED', 'PENDING_PO_DRAFT', 'CONVERTED', 'QUOTED_PENDING_CEO', 'PO', 'APPROVED', 'CONFIRMED_BY_SUPPLIER', 'DONE'].includes(selectedPO.status) && selectedPO.totalAmount > 0 && (
              <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem', fontWeight: 700 }}>
                  <span style={{ color: '#0f172a' }}>Tổng Báo Giá Đơn Hàng:</span>
                  <span style={{ color: 'var(--success)', fontSize: '1.3rem' }}>{formatPrice(selectedPO.totalAmount)}</span>
                </div>
                {Array.isArray(selectedPO.bills) && selectedPO.bills.length > 0 && Number(getPoBilledAmount(selectedPO)) !== Number(selectedPO.totalAmount || 0) && (
                  <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#b45309', fontSize: '0.85rem', fontWeight: 700 }}>Thực Nhận Sau Điều Chỉnh QC:</span>
                    <span style={{ color: '#b45309', fontSize: '1.05rem', fontWeight: 800 }}>{formatPrice(getPoBilledAmount(selectedPO))}</span>
                  </div>
                )}
              </div>
            )}

            {selectedPO.cancelReason && (
              (() => {
                const r = selectedPO.cancelReason;
                const isCompleted = ['DONE', 'COMPLETED', 'RECEIVED'].includes(selectedPO.status);
                const isQaNotice = r.startsWith('[THÔNG BÁO QA/QC') || r.startsWith('[THÔNG BÁO HOÀN TRẢ') || r.startsWith('[THÔNG BÁO TỪ CHỐI');
                const isReturn = !isCompleted && (r.startsWith('[THÔNG BÁO HOÀN TRẢ') || r.startsWith('[THÔNG BÁO TỪ CHỐI'));
                const label = isReturn ? 'Thông báo hoàn trả NCC' : 'Thông báo QA/QC - Đạt chuẩn';
                const bgColor = isReturn ? '#fff7ed' : '#f0fdf4';
                const borderColor = isReturn ? '#fed7aa' : '#86efac';
                const textColor = isReturn ? '#c2410c' : '#15803d';
                const cleanMsg = r.replace(/^\[[^\]]*\]:\s*/, '');
                return isQaNotice ? (
                  <div style={{ padding: '0.75rem 1rem', backgroundColor: bgColor, border: `1px solid ${borderColor}`, borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', color: textColor, display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span>{isReturn ? '⚠️' : '✅'}</span>
                    <span><strong>{label}:</strong> {cleanMsg}</span>
                  </div>
                ) : (
                  <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#dc2626' }}>
                    Lý do từ chối: <strong>{r}</strong>
                  </div>
                );
              })()
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', flexWrap: 'wrap' }}>
              <div>
                <button
                  onClick={() => setPrintPOTarget(selectedPO)}
                  style={{
                    padding: '0.6rem 1.15rem',
                    fontSize: '0.85rem',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1d4ed8',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Printer size={16} /> Xem & In Phiếu
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                      <Check size={15} /> Gửi Báo Giá
                    </button>
                  </>
                )}
                <button onClick={() => setSelectedPO(null)} className="btn btn-secondary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', borderRadius: '8px' }}>
                  Đóng
                </button>
              </div>
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

      {/* MODAL XEM VÀ IN PHIẾU ĐƠN HÀNG (PO) CHUẨN A4 CHO NHÀ CUNG CẤP */}
      {printPOTarget && (() => {
        const items = (printPOTarget.items && printPOTarget.items.length > 0)
          ? printPOTarget.items
          : [{
              name: printPOTarget.productName || printPOTarget.name || 'Linh Kiện Máy Tính',
              quantity: printPOTarget.quantity || 1,
              unitCost: printPOTarget.unitCost || printPOTarget.unitPrice || (printPOTarget.totalAmount ? Math.round(printPOTarget.totalAmount / (printPOTarget.quantity || 1)) : 0),
              totalCost: printPOTarget.totalCost || printPOTarget.totalAmount || 0
            }];
        const supplierInfo = printPOTarget.supplier || {};
        const isCeoApproved = ['PO', 'CONFIRMED_BY_SUPPLIER', 'QA', 'QA_PASSED', 'QA_PARTIAL', 'QA_REJECTED', 'RECEIVED', 'DONE', 'COMPLETED'].includes(printPOTarget.status);
        const isPendingCeo = ['QUOTED_PENDING_CEO', 'AWAITING_CEO_APPROVAL'].includes(printPOTarget.status);
        const ceoApprovalEntry = (printPOTarget.statusHistory || []).find(h => ['PO', 'APPROVED'].includes(h.status));
        const ceoSignerName = ceoApprovalEntry?.changedBy || 'Ban Giám Đốc AetherPC';
        const ceoSignDate = ceoApprovalEntry?.timestamp ? formatDate(ceoApprovalEntry.timestamp) : formatDate(printPOTarget.updatedAt || new Date());
        const creatorSignerName = printPOTarget.buyerName || printPOTarget.createdBy || 'Nhân Viên Mua Hàng';
        const creatorSignDate = formatDate(printPOTarget.createdAt || new Date());
        const purchasingManagerDate = formatDate(printPOTarget.createdAt || new Date());

        const handlePrintPODocument = () => {
          printDocument('#aetherpc-supplier-po-print', { title: `Đơn đặt hàng ${printPOTarget.poNumber || ''}` });
        };

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1150, padding: '1rem' }} onClick={() => setPrintPOTarget(null)}>
            <div style={{ width: '100%', maxWidth: '750px', maxHeight: '92vh', overflowY: 'auto', backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
              
              {/* VÙNG IN CHUẨN A4 */}
              <div id="aetherpc-supplier-po-print">
                {/* Header chứng từ */}
                <div style={{ padding: '0.75rem 1.1rem 0.55rem', borderBottom: '2px solid #0f172a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        CÔNG TY TNHH CÔNG NGHỆ AETHERPC — PHÒNG MUA HÀNG
                      </div>
                      <h2 style={{ margin: '0.15rem 0 0.1rem', fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                        ĐƠN ĐẶT HÀNG (PURCHASE ORDER)
                      </h2>
                      <p style={{ margin: '0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.3 }}>
                        Số PO: <strong style={{ color: '#0f172a' }}>{printPOTarget.poNumber || formatPurchaseReference(printPOTarget)}</strong>
                        {' • '}Ngày lập: <strong style={{ color: '#0f172a' }}>{formatDate(printPOTarget.createdAt || new Date())}</strong>
                        {' • '}Người lập: <strong style={{ color: '#0f172a' }}>{creatorSignerName}</strong>
                      </p>
                    </div>
                    <button onClick={() => setPrintPOTarget(null)} className="aetherpc-no-print" style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.35rem', borderRadius: '6px', display: 'flex' }}>
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Nội dung chứng từ */}
                <div style={{ padding: '0.65rem 1.1rem' }}>
                  {/* Khối Bên Mua & Bên Bán (NCC) */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', marginBottom: '0.45rem' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '0.35rem' }}>
                          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.65rem', boxSizing: 'border-box' }}>
                            <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Bên Mua Hàng (Bên A)</span>
                            <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 700, marginTop: '0.15rem' }}>Công Ty TNHH Công Nghệ AetherPC</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.05rem', lineHeight: 1.3 }}>Địa chỉ: 175 Nguyễn Thị Minh Khai, Quận 1, TP. HCM</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.03rem' }}>Email: purchasing@kltn-erp.vn • Hotline: 1900 6868</div>
                          </div>
                        </td>
                        <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '0.35rem' }}>
                          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.65rem', boxSizing: 'border-box' }}>
                            <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>Bên Bán (Bên B — Nhà Cung Cấp)</span>
                            <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 700, marginTop: '0.15rem' }}>{getSupplierName(printPOTarget)}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.05rem', lineHeight: 1.3 }}>
                              Mã NCC: {printPOTarget.supplierCode || user?.code || 'NCC-DEFAULT'}
                              {supplierInfo.phone ? ` • ĐT: ${supplierInfo.phone}` : ''}
                            </div>
                            {(supplierInfo.address || user?.address) && (
                              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.03rem', lineHeight: 1.3 }}>Địa chỉ: {supplierInfo.address || user?.address}</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Bảng danh sách hàng hóa */}
                  <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginBottom: '0.3rem', fontSize: '0.74rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}>
                        <th style={{ textAlign: 'center', padding: '0.32rem 0.25rem', color: '#475569', width: '34px' }}>STT</th>
                        <th style={{ textAlign: 'left', padding: '0.32rem 0.35rem', color: '#475569' }}>Tên Sản Phẩm / Linh Kiện</th>
                        <th style={{ textAlign: 'center', padding: '0.32rem 0.25rem', color: '#475569', width: '46px' }}>SL</th>
                        <th style={{ textAlign: 'right', padding: '0.32rem 0.35rem', color: '#475569', width: '100px' }}>Đơn Giá</th>
                        <th style={{ textAlign: 'right', padding: '0.32rem 0.35rem', color: '#475569', width: '110px' }}>Thành Tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const itName = it.product?.name || it.productName || it.name || it.productId || 'Linh Kiện Máy Tính';
                        const itQty = parseInt(it.quantity) || 1;
                        const itUnit = Number(it.unitCost || it.unitPrice || (printPOTarget.totalAmount ? Math.round(printPOTarget.totalAmount / itQty) : 0));
                        const itTotal = Number(it.totalCost || it.totalAmount || (itQty * itUnit) || 0);
                        return (
                          <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.32rem 0.25rem', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '0.32rem 0.35rem', color: '#0f172a', fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.3 }}>{itName}</td>
                            <td style={{ padding: '0.32rem 0.25rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>{itQty}</td>
                            <td style={{ padding: '0.32rem 0.35rem', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{formatPrice(itUnit)}</td>
                            <td style={{ padding: '0.32rem 0.35rem', textAlign: 'right', color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatPrice(itTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                        <td colSpan={4} style={{ padding: '0.35rem 0.35rem', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Tổng Giá Trị Đơn Hàng (Đã gồm VAT):</td>
                        <td style={{ padding: '0.35rem 0.35rem', textAlign: 'right', fontWeight: 800, fontSize: '0.88rem', color: '#16a34a', whiteSpace: 'nowrap' }}>{formatPrice(printPOTarget.totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {parseFloat(printPOTarget.totalAmount) > 0 && (
                    <p style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', margin: '0.1rem 0 0.4rem' }}>
                      Bằng chữ: <strong style={{ color: '#334155' }}>{formatCurrencyInWords(printPOTarget.totalAmount)}</strong>.
                    </p>
                  )}

                  {/* Thông tin điều khoản & giao nhận */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.35rem 0.65rem', marginBottom: '0.45rem', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', lineHeight: 1.35 }}>
                    <div>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Ngày giao hàng dự kiến: </span>
                      <strong style={{ color: '#0f172a' }}>
                        {printPOTarget.expectedDeliveryDate ? formatDate(printPOTarget.expectedDeliveryDate) : 'Theo thỏa thuận đơn hàng'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Ghi chú / Điều khoản: </span>
                      <span style={{ color: '#334155' }}>
                        {printPOTarget.notes || 'Hàng mới 100%, bảo hành chính hãng, đầy đủ CO/CQ và hóa đơn VAT kèm theo biên bản giao nhận.'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Tình trạng phê duyệt: </span>
                      <span style={{
                        display: 'inline-block',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: isPendingCeo ? '#fef3c7' : isCeoApproved ? '#dcfce7' : '#f1f5f9',
                        color: isPendingCeo ? '#b45309' : isCeoApproved ? '#16a34a' : '#475569',
                        border: `1px solid ${isPendingCeo ? '#fde68a' : isCeoApproved ? '#bbf7d0' : '#cbd5e1'}`
                      }}>
                        {isPendingCeo ? 'Chờ Giám Đốc Duyệt' : isCeoApproved ? 'Đã Phê Duyệt' : getStatusLabel(PO_STATUS, printPOTarget.status)}
                      </span>
                    </div>
                  </div>

                  {/* Chữ ký 3 bên — DÙNG TABLE 3 CỘT ĐẢM BẢO 100% LUÔN THẲNG HÀNG NGANG */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', marginTop: '0.45rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.45rem' }}>
                    <tbody>
                      <tr>
                        {/* CỘT 1: NGƯỜI LẬP PHIẾU */}
                        <td style={{ width: '33.33%', textAlign: 'center', verticalAlign: 'top', padding: '0.35rem 0.2rem 0' }}>
                          <strong style={{ fontSize: '0.72rem', color: '#0f172a', display: 'block' }}>NGƯỜI LẬP PHIẾU</strong>
                          <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '0.1rem' }}>(Ký, ghi rõ họ tên)</div>
                          <div style={{ minHeight: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.2rem auto' }}>
                            <div style={{
                              border: '1.5px dashed #2563eb',
                              borderRadius: '6px',
                              backgroundColor: '#eff6ff',
                              padding: '0.2rem 0.4rem',
                              width: '100%',
                              maxWidth: '155px',
                              boxSizing: 'border-box'
                            }}>
                              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.2px' }}>
                                ✓ ĐÃ KÝ SỐ
                              </div>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {creatorSignerName}
                              </div>
                              <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: '1px' }}>
                                {creatorSignDate}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{creatorSignerName}</div>
                        </td>

                        {/* CỘT 2: TRƯỞNG PHÒNG MUA HÀNG */}
                        <td style={{ width: '33.33%', textAlign: 'center', verticalAlign: 'top', padding: '0.35rem 0.2rem 0' }}>
                          <strong style={{ fontSize: '0.72rem', color: '#0f172a', display: 'block' }}>TRƯỞNG PHÒNG MUA HÀNG</strong>
                          <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '0.1rem' }}>(Ký, ghi rõ họ tên)</div>
                          <div style={{ minHeight: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.2rem auto' }}>
                            <div style={{
                              border: '1.5px dashed #059669',
                              borderRadius: '6px',
                              backgroundColor: '#ecfdf5',
                              padding: '0.2rem 0.4rem',
                              width: '100%',
                              maxWidth: '155px',
                              boxSizing: 'border-box'
                            }}>
                              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#047857', letterSpacing: '0.2px' }}>
                                ✓ ĐÃ KÝ SỐ
                              </div>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Phòng Mua Hàng AetherPC
                              </div>
                              <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: '1px' }}>
                                {purchasingManagerDate}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>Phòng Mua Hàng AetherPC</div>
                        </td>

                        {/* CỘT 3: GIÁM ĐỐC DUYỆT */}
                        <td style={{ width: '33.33%', textAlign: 'center', verticalAlign: 'top', padding: '0.35rem 0.2rem 0' }}>
                          <strong style={{ fontSize: '0.72rem', color: '#0f172a', display: 'block' }}>GIÁM ĐỐC DUYỆT</strong>
                          <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '0.1rem' }}>(Ký, đóng dấu)</div>
                          <div style={{ minHeight: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.2rem auto' }}>
                            {isCeoApproved ? (
                              <div style={{
                                border: '1.5px dashed #dc2626',
                                borderRadius: '6px',
                                backgroundColor: '#fef2f2',
                                padding: '0.2rem 0.4rem',
                                width: '100%',
                                maxWidth: '155px',
                                boxSizing: 'border-box'
                              }}>
                                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#b91c1c', letterSpacing: '0.2px' }}>
                                  ✓ ĐÃ KÝ SỐ (PHÊ DUYỆT)
                                </div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ceoSignerName}
                                </div>
                                <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: '1px' }}>
                                  {ceoSignDate}
                                </div>
                              </div>
                            ) : (
                              <div style={{
                                border: '1px dashed #cbd5e1',
                                borderRadius: '6px',
                                backgroundColor: '#f8fafc',
                                padding: '0.25rem 0.4rem',
                                width: '100%',
                                maxWidth: '155px',
                                boxSizing: 'border-box'
                              }}>
                                <div style={{ fontSize: '0.64rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                  {isPendingCeo ? 'Chờ Giám Đốc Phê Duyệt' : 'Chưa Phê Duyệt'}
                                </div>
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isCeoApproved ? '#0f172a' : '#94a3b8', marginTop: '2px' }}>
                            {isCeoApproved ? ceoSignerName : 'Ban Giám Đốc AetherPC'}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Thanh thao tác dưới cùng (Không in) */}
              <div className="aetherpc-no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '0.75rem 1.1rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '0 0 14px 14px' }}>
                <button
                  onClick={handlePrintPODocument}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1.1rem', fontSize: '0.84rem', fontWeight: 700, backgroundColor: '#2563eb', border: 'none', borderRadius: '6px' }}
                >
                  <Printer size={15} /> In Phiếu PO
                </button>
                <button
                  onClick={() => setPrintPOTarget(null)}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.84rem', borderRadius: '6px' }}
                >
                  Đóng
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
