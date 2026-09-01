import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useFinanceStore, useUtilityStore, useSalesStore, useInventoryStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { notify } from '../../context/NotificationContext';
import { api } from '../../services/api';
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
import { 
  ShieldCheck, ShieldAlert, CheckCircle, XCircle, AlertTriangle, 
  Package, Search, Eye, Filter, RefreshCw, Truck, FileText, 
  Check, X, ChevronRight, Award, BarChart2, Calendar, User, Building, 
  AlertCircle, ArrowRight, Printer, CheckSquare, Layers, Clock, ThumbsUp, ThumbsDown,
  MoreHorizontal, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';

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

const DEFECT_LABELS = {
  PACKAGE_DAMAGED: 'Móp hộp outer / Rách seal niêm phong',
  ELECTRICAL_POWER_FAIL: 'Lỗi nguồn / Không lên điện / Lỗi mạch',
  SERIAL_WARRANTY_MISSING: 'Thiếu tem bảo hành / Sai mã Serial',
  SPEC_MISMATCH: 'Trầy xước / Sai thông số kỹ thuật',
  COUNTERFEIT_FAKE: 'Hàng không chính hãng / Lỗi phụ kiện',
  DOA_FACTORY_DEFECT: 'Lỗi phần cứng do Nhà Sản Xuất (DOA - Không POST / Lỗi chip)',
  USER_PHYSICAL_DAMAGE: 'Hư hỏng do người dùng (Cong socket CPU / Rơi vỡ / Vào nước)',
  NORMAL_RESTOCK: 'Hàng nguyên seal / Khách đổi ý (Đủ điều kiện nhập kho lại)',
  NONE: 'Đạt tiêu chuẩn hoàn hảo'
};

export default function QualityControl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isCEO, isAdmin } = useAuth() || {};
  const { can, canDo, canApprove } = usePermission();
  const isQCOfficer = canDo('qc_inspect_inbound') || canDo('qc_inspect_rma') || canApprove('quality-control') || isCEO || isAdmin;
  
  const purchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];
  const updatePurchaseOrderStatus = useFinanceStore(state => state.updatePurchaseOrderStatus);
  const sendSystemNotification = useUtilityStore(state => state.sendSystemNotification);
  const returnRequests = useSalesStore(state => state.returnRequests) || [];
  const updateReturnStatus = useSalesStore(state => state.updateReturnStatus);
  const updateOrderStatus = useSalesStore(state => state.updateOrderStatus);
  const erpOrders = useSalesStore(state => state.orders) || [];
  const inventory = useInventoryStore(state => state.inventory) || [];

  // Active Tab from URL (?tab=overview|inbound|returns|logs|reports)
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [rmaFilter, setRmaFilter] = useState('ALL');
  const [rmaSourceFilter, setRmaSourceFilter] = useState('ALL'); // ALL | FAILED_DELIVERY | CUSTOMER_RMA
  const [logFilter, setLogFilter] = useState('ALL');

  // Modal State for QA Inbound Inspection (PO)
  const [selectedPO, setSelectedPO] = useState(null);
  const [inspectionDecision, setInspectionDecision] = useState('ACCEPT_ALL');
  const [passedQty, setPassedQty] = useState(0);
  const [failedQty, setFailedQty] = useState(0);
  const [defectCategory, setDefectCategory] = useState('PACKAGE_DAMAGED');
  const [qcNotes, setQcNotes] = useState('');
  const [sampleRate, setSampleRate] = useState('100%');

  // Modal State for Customer RMA Technical Inspection
  const [selectedRMA, setSelectedRMA] = useState(null);
  const [detailRMA, setDetailRMA] = useState(null);
  const [actualSerial, setActualSerial] = useState('');
  const [warrantySealStatus, setWarrantySealStatus] = useState('INTACT'); // 'INTACT' | 'SCRATCHED_FIRMWARE_OK' | 'SHOP_LOST_VENDOR_OK' | 'LOST_UNIDENTIFIED'
  const [reissueSealNeeded, setReissueSealNeeded] = useState(false);
  const [rmaDecision, setRmaDecision] = useState('EXCHANGE_NEW');
  const [rmaDefectType, setRmaDefectType] = useState('DOA_FACTORY_DEFECT');
  const [rmaNotes, setRmaNotes] = useState('');
  const [rmaChecklist, setRmaChecklist] = useState({
    sealIntact: true,
    cosmeticPass: true,
    circuitNoBurn: true,
    testBenchConfirmed: true
  });
  const [qcProofPhoto, setQcProofPhoto] = useState('');

  // Modal State for Failed Delivery Return Inspection (Kiểm định tem & ngoại quan hàng hoàn về)
  const [selectedRestockOrder, setSelectedRestockOrder] = useState(null);
  const [restockCondition, setRestockCondition] = useState('PERFECT_SEAL'); // 'PERFECT_SEAL' | 'DENTED_BOX_OUTLET' | 'DAMAGED_CARRIER'
  const [restockChecklist, setRestockChecklist] = useState({
    sealIntact: true,
    boxUnopened: true,
    accessoriesComplete: true,
    noWaterDrop: true
  });
  const [restockNotes, setRestockNotes] = useState('');

  // In-App Toast Notification State
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (title, text, type = 'success') => {
    setToastMessage({ title, text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Selected Order for Status History Modal (...)
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState(null);

  // Selected Log for Details Modal
  const [viewingLog, setViewingLog] = useState(null);

  // Inspection Logs (Stored in localStorage for mock persistence)
  const [qaLogs, setQaLogs] = useState(() => {
    try {
      const raw = localStorage.getItem('erp_qa_inspection_logs');
      return raw ? JSON.parse(raw) : [
        {
          id: 'QA-2026-001',
          type: 'INBOUND_PO',
          poNumber: 'PO-2026-0005',
          supplierName: 'ASUS Vietnam',
          inspector: 'Nguyễn Văn QC',
          date: '15/06/2026',
          totalQty: 50,
          passedQty: 50,
          failedQty: 0,
          decision: 'ACCEPT_ALL',
          defectCategory: 'NONE',
          notes: 'Lô hàng VGA ASUS RTX 4070 nguyên tem niêm phong, kiểm tra 100% đạt chuẩn.',
          status: 'QA_PASSED'
        },
        {
          id: 'QA-2026-002',
          type: 'INBOUND_PO',
          poNumber: 'PO-2026-0006',
          supplierName: 'GIGABYTE Technology',
          inspector: 'Trần Văn QA',
          date: '16/06/2026',
          totalQty: 30,
          passedQty: 28,
          failedQty: 2,
          decision: 'ACCEPT_PARTIAL',
          defectCategory: 'PACKAGE_DAMAGED',
          notes: 'Phát hiện 2 bo mạch chủ bị móp góc hộp khi vận chuyển, đã lập biên bản hoàn trả NCC.',
          status: 'QA_PARTIAL'
        },
        {
          id: 'RMA-QA-101',
          type: 'CUSTOMER_RMA',
          rmaId: 'RET-001',
          orderId: 'ORD-101',
          customerName: 'Lê Hoàng Hùng',
          productName: 'Intel Core i5-13400F',
          serialNumber: 'SN-CPU-13400F-8821',
          inspector: 'Nguyễn Văn QC',
          date: '17/06/2026',
          decision: 'EXCHANGE_NEW',
          defectCategory: 'DOA_FACTORY_DEFECT',
          notes: 'Xác nhận CPU bị lỗi không POST BIOS trên test bench chuẩn. Đủ điều kiện đổi mới 1-1.',
          status: 'QC_PASSED'
        }
      ];
    } catch (e) {
      return [];
    }
  });

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
    let list = [];
    try {
      const res = await api.get('/purchasing/orders');
      if (res && res.success) {
        list = res.data || [];
      }
    } catch (e) {
      console.warn('API error, using fallback:', e);
    }
    
    let localOrders = [];
    try { localOrders = JSON.parse(localStorage.getItem('erp_pos') || '[]'); } catch (_) { localOrders = purchaseOrders; }

    let storedQaLogs = [];
    try { storedQaLogs = JSON.parse(localStorage.getItem('erp_qa_inspection_logs') || '[]'); } catch (_) { storedQaLogs = qaLogs; }

    // Only let cache/context entries introduce a BRAND NEW row when the real API
    // genuinely returned nothing — once it has data, it's authoritative on which
    // POs exist. Otherwise stale localStorage (possibly holding ad-hoc demo status
    // values that were never real backend statuses) would resurrect phantom PO rows
    // alongside the real ones.
    const allPool = [...list];
    if (list.length === 0) {
      [...localOrders, ...purchaseOrders].forEach(po => {
        const exists = allPool.find(c => String(c.poNumber) === String(po.poNumber) || String(c.id) === String(po.id));
        if (!exists) {
          allPool.push(po);
        }
      });
    }

    const finalCombined = allPool.map(po => {
      const targetPoNum = po.poNumber || po.id;
      const localMatch = localOrders.find(l => String(l.poNumber) === String(targetPoNum) || String(l.id) === String(po.id));
      // When the real API returned data, `po` here is guaranteed to be a real
      // backend order (see the `list.length === 0` gate above) — never let a
      // stale/unrecognized local-cache status overwrite its real status.
      let merged = localMatch
        ? { ...po, ...localMatch, status: list.length > 0 ? po.status : (localMatch.status || po.status) }
        : po;
      
      const log = storedQaLogs.find(l => String(l.poNumber) === String(targetPoNum) || String(l.poNumber) === String(po.id) || String(l.id) === String(po.id));
      if (log && log.status) {
        merged = {
          ...merged,
          status: log.status,
          supplierNote: log.notes || merged.supplierNote,
          passedQty: log.passedQty,
          failedQty: log.failedQty
        };
      }
      merged.poNumber = formatPurchaseReference(merged);
      return merged;
    });

    setOrders(finalCombined);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [purchaseOrders]);

  const saveQaLogs = (newLogs) => {
    const deduped = newLogs.filter((log, index, all) =>
      index === all.findIndex(item => (item.poNumber && item.poNumber === log.poNumber) || (item.id && item.id === log.id))
    );
    setQaLogs(deduped);
    localStorage.setItem('erp_qa_inspection_logs', JSON.stringify(deduped));
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0);
  };

  const PENDING_QA_STATUSES = ['CONFIRMED_BY_SUPPLIER', 'PO', 'APPROVED', 'PENDING_QA', 'SHIPPED', 'DELIVERED', 'RFQ_SENT', 'SENT'];
  const PASSED_QA_STATUSES = ['QA_PASSED', 'DONE', 'COMPLETED', 'RECEIVED'];
  const REJECTED_QA_STATUSES = ['QA_REJECTED', 'QA_PARTIAL'];

  const pendingQaPOs = orders.filter(po => PENDING_QA_STATUSES.includes(po.status));
  const passedQaPOs = orders.filter(po => PASSED_QA_STATUSES.includes(po.status));
  const partialQaPOs = orders.filter(po => po.status === 'QA_PARTIAL');
  const rejectedQaPOs = orders.filter(po => po.status === 'QA_REJECTED');

  const totalInspected = passedQaPOs.length + partialQaPOs.length + rejectedQaPOs.length;
  const passRate = totalInspected > 0 ? Math.round(((passedQaPOs.length + partialQaPOs.length * 0.8) / totalInspected) * 100) : 98;

  // 6 Balanced KPI Cards (2 Rows x 3 Columns)
  const stats = [
    { label: 'Chờ Nghiệm Thu (PO)', value: `${pendingQaPOs.length} lô hàng`, change: 'Từ nhà cung cấp giao tới', icon: <Clock size={20} />, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Đạt Chuẩn Nhập Kho 100%', value: `${passedQaPOs.length} lô hàng`, change: 'Cho phép nhập kho toàn bộ', icon: <CheckCircle size={20} />, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Nghiệm Thu Một Phần', value: `${partialQaPOs.length} lô hàng`, change: 'Nhận SP đạt & Trả SP lỗi', icon: <AlertTriangle size={20} />, color: '#ea580c', bg: '#fff7ed' },
    { label: 'Hoàn Trả NCC 100%', value: `${rejectedQaPOs.length} lô hàng`, change: 'Từ chối toàn bộ do lỗi nặng', icon: <XCircle size={20} />, color: '#ef4444', bg: '#fef2f2' },
    { label: 'Tỷ Lệ Đạt Chuẩn QA', value: `${passRate}%`, change: 'Mục tiêu kiểm định >= 95%', icon: <Award size={20} />, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Đổi Trả Khách (RMA)', value: `${returnRequests.length || 3} yêu cầu`, change: 'Thẩm định lỗi phần cứng', icon: <ShieldAlert size={20} />, color: '#8b5cf6', bg: '#f5f3ff' }
  ];

  // Defect Distribution Chart Data
  const defectChartData = {
    labels: ['Móp Hộp / Rách Seal', 'Lỗi Nguồn / Mạch Điện', 'Thiếu Tem / Sai Serial', 'Sai Thông Số', 'Lỗi Khác'],
    datasets: [
      {
        data: [4, 2, 3, 1, 1],
        backgroundColor: ['#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#64748b']
      }
    ]
  };

  // Weekly Inspection Pass vs Fail Chart
  const weeklyChartData = {
    labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4 (Hiện tại)'],
    datasets: [
      {
        label: 'Sản Phẩm Đạt Chuẩn (Passed)',
        data: [140, 185, 210, 195],
        backgroundColor: '#16a34a'
      },
      {
        label: 'Sản Phẩm Lỗi (Defective)',
        data: [4, 6, 3, 5],
        backgroundColor: '#ef4444'
      }
    ]
  };

  // Open Inspection Modal
  const handleOpenInspectionModal = (po) => {
    setSelectedPO(po);
    const total = po.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || po.quantity || 1;
    setPassedQty(total);
    setFailedQty(0);
    setInspectionDecision('ACCEPT_ALL');
    setDefectCategory('PACKAGE_DAMAGED');
    setQcNotes('');
    setSampleRate('100%');
  };

  // Decision & Qty sync
  const handleDecisionChange = (dec, total) => {
    setInspectionDecision(dec);
    if (dec === 'ACCEPT_ALL') {
      setPassedQty(total);
      setFailedQty(0);
    } else if (dec === 'REJECT_ALL') {
      setPassedQty(0);
      setFailedQty(total);
    } else if (dec === 'ACCEPT_PARTIAL') {
      const p = Math.max(0, total - 1);
      const f = total > 1 ? 1 : 0;
      setPassedQty(p);
      setFailedQty(f);
    }
  };

  const handlePassedQtyChange = (val, total) => {
    const p = Math.max(0, Math.min(total, parseInt(val, 10) || 0));
    const f = total - p;
    setPassedQty(p);
    setFailedQty(f);
    if (p === total) setInspectionDecision('ACCEPT_ALL');
    else if (p === 0) setInspectionDecision('REJECT_ALL');
    else setInspectionDecision('ACCEPT_PARTIAL');
  };

  const handleFailedQtyChange = (val, total) => {
    const f = Math.max(0, Math.min(total, parseInt(val, 10) || 0));
    const p = total - f;
    setPassedQty(p);
    setFailedQty(f);
    if (f === 0) setInspectionDecision('ACCEPT_ALL');
    else if (f === total) setInspectionDecision('REJECT_ALL');
    else setInspectionDecision('ACCEPT_PARTIAL');
  };

  // Submit QA Inspection
  const handleSubmitQaInspection = async (e) => {
    e.preventDefault();
    if (!selectedPO) return;

    const poId = selectedPO.id || selectedPO.poNumber;
    const totalQty = selectedPO.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || selectedPO.quantity || 1;

    const isFullPass = passedQty === totalQty && failedQty === 0;
    const isFullReject = passedQty === 0 && failedQty === totalQty;
    const targetStatus = isFullPass ? 'QA_PASSED' : isFullReject ? 'QA_REJECTED' : 'QA_PARTIAL';

    setSubmitting(true);

    const logEntry = {
      id: `QA-${Date.now().toString().slice(-4)}`,
      poNumber: selectedPO.poNumber || poId,
      supplierName: selectedPO.supplier?.name || selectedPO.supplierCode || selectedPO.supplierName || 'Nhà Cung Cấp',
      inspector: user?.fullname || 'Chuyên viên QA/QC',
      date: new Date().toLocaleDateString('vi-VN'),
      totalQty,
      passedQty,
      failedQty,
      decision: inspectionDecision,
      defectCategory: failedQty > 0 ? defectCategory : 'NONE',
      notes: qcNotes || (targetStatus === 'QA_PASSED' ? 'Lô hàng đạt tiêu chuẩn nhập kho.' : targetStatus === 'QA_PARTIAL' ? `Nghiệm thu nhập ${passedQty} sản phẩm đạt, hoàn trả ${failedQty} sản phẩm lỗi.` : 'Không đạt tiêu chuẩn, yêu cầu hoàn trả NCC.'),
      status: targetStatus
    };

    const nccNoticeText = targetStatus === 'QA_PASSED'
      ? `Lô hàng ${selectedPO.poNumber || poId} đạt 100% chất lượng (${passedQty}/${totalQty} SP). Đã cho nhập kho toàn bộ.`
      : targetStatus === 'QA_PARTIAL'
        ? `Lô hàng ${selectedPO.poNumber || poId} nghiệm thu NHẬP MỘT PHẦN: Đã nhận ${passedQty}/${totalQty} SP đạt chuẩn. Phát hiện ${failedQty}/${totalQty} SP lỗi (${DEFECT_LABELS[defectCategory] || defectCategory}). Đề nghị NCC nhận lại ${failedQty} SP lỗi!`
        : `Lô hàng ${selectedPO.poNumber || poId} KHÔNG ĐẠT CHẤT LƯỢNG (${failedQty}/${totalQty} SP lỗi: ${DEFECT_LABELS[defectCategory] || defectCategory}). Yêu cầu NCC nhận lại 100% lô hàng!`;

    const supplierNote = `[THÔNG BÁO HOÀN TRẢ NCC - QA/QC]: ${nccNoticeText}`;
    const updatedPO = { 
      ...selectedPO, 
      status: targetStatus, 
      supplierNote,
      passedQty,
      failedQty,
      decision: inspectionDecision,
      defectCategory: failedQty > 0 ? defectCategory : 'NONE'
    };

    setOrders(current => current.map(po =>
      (String(po.poNumber) === String(selectedPO.poNumber) || String(po.id) === String(poId)) ? updatedPO : po
    ));

    if (typeof updatePurchaseOrderStatus === 'function') {
      updatePurchaseOrderStatus(poId, targetStatus, { 
        supplierNote,
        passedQty,
        failedQty,
        decision: inspectionDecision,
        defectCategory: failedQty > 0 ? defectCategory : 'NONE'
      });
    }
    
    saveQaLogs([logEntry, ...qaLogs]);

    try {
      const curPos = JSON.parse(localStorage.getItem('erp_pos') || '[]');
      const matchIdx = curPos.findIndex(p => String(p.id) === String(poId) || String(p.poNumber) === String(selectedPO.poNumber) || String(p.poNumber) === String(poId));
      if (matchIdx >= 0) {
        curPos[matchIdx] = { ...curPos[matchIdx], ...updatedPO };
      } else {
        curPos.push(updatedPO);
      }
      localStorage.setItem('erp_pos', JSON.stringify(curPos));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    try {
      await api.patch(`/purchasing/orders/${poId}/status`, {
        status: targetStatus,
        supplierNote,
        passedQty,
        failedQty,
        sampleRate: parseInt(sampleRate, 10) || 100,
        defectCategory: failedQty > 0 ? defectCategory : 'NONE',
        qcNotes
      });
    } catch (err) {
      console.warn('API sync warn:', err);
    }

    if (typeof sendSystemNotification === 'function') {
      sendSystemNotification({
        title: `[BIÊN BẢN QA/QC] Đơn Hàng ${selectedPO.poNumber || poId}`,
        content: nccNoticeText,
        type: targetStatus === 'QA_PASSED' ? 'SUCCESS' : targetStatus === 'QA_PARTIAL' ? 'WARNING' : 'ERROR',
        recipient: selectedPO.supplier?.name || 'NCC'
      });
    }

    setSubmitting(false);
    setSelectedPO(null);
    showToast(
      'Biên Bản QA/QC Đã Phát Hành',
      `Kết luận: ${targetStatus === 'QA_PASSED' ? 'Cho nhập kho 100%' : targetStatus === 'QA_PARTIAL' ? `Nhập ${passedQty} SP đạt, Hoàn trả ${failedQty} SP lỗi` : 'Hoàn trả NCC 100%'}`,
      targetStatus === 'QA_PASSED' ? 'success' : targetStatus === 'QA_PARTIAL' ? 'warning' : 'error'
    );
  };

  // -------------------------------------------------------------
  // Customer RMA Helpers & Inspection Handlers
  // -------------------------------------------------------------
  const getRmaProductName = (rma) => {
    if (!rma) return 'Linh kiện đổi trả';
    if (rma.product && rma.product.trim()) return rma.product;
    if (rma.productName && rma.productName.trim()) return rma.productName;
    if (rma.items && Array.isArray(rma.items) && rma.items.length > 0) {
      const names = rma.items.map(i => i.name || i.productName).filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    const targetOrder = erpOrders.find(o => o.orderId === rma.orderId);
    if (targetOrder && targetOrder.items && targetOrder.items.length > 0) {
      const names = targetOrder.items.map(i => i.name).filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    return `Linh kiện đơn hàng #${rma.orderId || rma.id}`;
  };

  const getRmaSerial = (rma) => {
    if (!rma) return 'SN-UNKNOWN';
    if (rma.serial && rma.serial.trim()) return rma.serial;
    if (rma.serialNumber && rma.serialNumber.trim()) return rma.serialNumber;
    const numPart = (rma.id || '').replace(/\D/g, '').slice(-6) || '883921';
    return `SN-RMA-${numPart}`;
  };

  const handleOpenRmaInspection = (rma) => {
    setSelectedRMA(rma);
    const expectedSn = getRmaSerial(rma);
    setActualSerial(expectedSn);
    setWarrantySealStatus('INTACT');
    setReissueSealNeeded(false);
    setRmaDecision(rma.type === 'REFUND' ? 'RESTOCK_WAREHOUSE' : 'EXCHANGE_NEW');
    setRmaDefectType(rma.type === 'REFUND' ? 'NORMAL_RESTOCK' : 'DOA_FACTORY_DEFECT');
    setRmaNotes(rma.reason ? `Khách phản ánh: "${rma.reason}". QC đã kiểm tra ngoại quan & test chẩn đoán.` : '');
    setQcProofPhoto(rma.qcProofPhoto || '');
    setRmaChecklist({
      sealIntact: true,
      cosmeticPass: true,
      circuitNoBurn: true,
      testBenchConfirmed: true
    });
  };

  const handleSealStatusChange = (status) => {
    setWarrantySealStatus(status);
    if (status === 'INTACT') {
      setReissueSealNeeded(false);
      setRmaChecklist(prev => ({ ...prev, sealIntact: true }));
      setRmaDecision(selectedRMA?.type === 'REFUND' ? 'RESTOCK_WAREHOUSE' : 'EXCHANGE_NEW');
      setRmaDefectType(selectedRMA?.type === 'REFUND' ? 'NORMAL_RESTOCK' : 'DOA_FACTORY_DEFECT');
    } else if (status === 'SCRATCHED_FIRMWARE_OK') {
      // Tem mờ/xước nhưng đọc được Firmware/Laser -> Hợp lệ thứ cấp, cần in cấp lại tem mới
      setReissueSealNeeded(true);
      setRmaChecklist(prev => ({ ...prev, sealIntact: true }));
      setRmaDecision(selectedRMA?.type === 'REFUND' ? 'RESTOCK_WAREHOUSE' : 'EXCHANGE_NEW');
      setRmaDefectType(selectedRMA?.type === 'REFUND' ? 'NORMAL_RESTOCK' : 'DOA_FACTORY_DEFECT');
    } else if (status === 'SHOP_LOST_VENDOR_OK') {
      // Mất tem shop nhưng còn tem hãng -> Gửi hãng bảo hành hộ
      setReissueSealNeeded(false);
      setRmaChecklist(prev => ({ ...prev, sealIntact: false }));
      setRmaDecision('VENDOR_WARRANTY');
      setRmaDefectType('DOA_FACTORY_DEFECT');
    } else if (status === 'LOST_UNIDENTIFIED') {
      // Mất sạch tem không thể định danh -> Từ chối bảo hành đổi trả
      setReissueSealNeeded(false);
      setRmaChecklist(prev => ({ ...prev, sealIntact: false }));
      setRmaDecision('REJECT_RMA');
      setRmaDefectType('SERIAL_WARRANTY_MISSING');
    }
  };

  const handleSubmitRmaInspection = (e) => {
    e.preventDefault();
    if (!selectedRMA) return;

    setSubmitting(true);
    const inspectorName = user?.name || user?.fullname || 'Nguyễn Văn QC';
    const dateStr = new Date().toLocaleDateString('vi-VN');
    const rmaLogId = `RMA-QA-${Date.now().toString().slice(-4)}`;

    const resolvedProduct = getRmaProductName(selectedRMA);
    const resolvedSerial = actualSerial || getRmaSerial(selectedRMA);

    let statusKey = 'QC_PASSED';
    let resolutionText = '';

    if (rmaDecision === 'EXCHANGE_NEW') {
      statusKey = 'QC_PASSED';
      resolutionText = `Đã duyệt Đổi mới 1-1 (DOA lỗi NSX). QC: ${inspectorName}`;
      if (reissueSealNeeded) {
        resolutionText += ` [ĐÃ CẤP LẠI TEM BẢO HÀNH MỚI]`;
      }
    } else if (rmaDecision === 'VENDOR_WARRANTY') {
      statusKey = 'VENDOR_WARRANTY';
      resolutionText = `Chuyển gửi Hãng bảo hành (${resolvedProduct}). QC: ${inspectorName}`;
    } else if (rmaDecision === 'RESTOCK_WAREHOUSE') {
      statusKey = 'QC_PASSED';
      resolutionText = `Hàng đạt chuẩn, nhập lại kho bán lẻ & hoàn tiền. QC: ${inspectorName}`;
    } else if (rmaDecision === 'REJECT_RMA') {
      statusKey = 'REJECTED';
      resolutionText = `Từ chối đổi trả (${warrantySealStatus === 'LOST_UNIDENTIFIED' ? 'Không thể định danh nguồn gốc / Mất tem' : 'Vi phạm điều kiện bảo hành'}). QC: ${inspectorName}`;
    }

    // 1. Update in ERP context & Backend API
    if (typeof updateReturnStatus === 'function') {
      updateReturnStatus(selectedRMA.id, statusKey, {
        qcDecision: rmaDecision,
        qcDefectType: rmaDefectType,
        qcNotes: rmaNotes,
        qcProofPhoto: qcProofPhoto || null,
        qcInspectedAt: new Date().toISOString(),
        qcInspector: inspectorName,
        note: resolutionText
      });
    }

    // 2. Create QA Log for Customer RMA
    const newLog = {
      id: rmaLogId,
      type: 'CUSTOMER_RMA',
      rmaId: selectedRMA.id,
      poNumber: selectedRMA.orderId || selectedRMA.id,
      supplierName: 'Khách Hàng: ' + (selectedRMA.customerName || 'Khách lẻ'),
      customerName: selectedRMA.customerName || 'Khách lẻ',
      productName: resolvedProduct,
      serialNumber: resolvedSerial,
      warrantySealStatus,
      reissueSealNeeded,
      qcProofPhoto: qcProofPhoto || null,
      inspector: inspectorName,
      date: dateStr,
      totalQty: 1,
      passedQty: rmaDecision === 'REJECT_RMA' ? 0 : 1,
      failedQty: rmaDecision === 'EXCHANGE_NEW' || rmaDecision === 'VENDOR_WARRANTY' ? 1 : 0,
      decision: rmaDecision,
      defectCategory: rmaDefectType,
      checklist: rmaChecklist,
      notes: rmaNotes ? `${rmaNotes} | ${resolutionText}` : resolutionText,
      status: statusKey
    };

    saveQaLogs([newLog, ...qaLogs]);

    // 3. Send system notification
    if (typeof sendSystemNotification === 'function') {
      sendSystemNotification({
        title: `[THẨM ĐỊNH RMA] Phiếu ${selectedRMA.id}`,
        content: `QC ${inspectorName} đã hoàn tất thẩm định phiếu ${selectedRMA.id} (${resolutionText}).`,
        type: rmaDecision === 'REJECT_RMA' ? 'WARNING' : 'SUCCESS',
        recipient: 'CSKH, Kho Vận, Kế Toán'
      });
    }

    setSubmitting(false);
    setSelectedRMA(null);
    showToast(
      'Hồ Sơ Thẩm Định RMA Đã Lưu',
      `Quyết định: ${rmaDecision === 'EXCHANGE_NEW' ? 'Duyệt đổi mới 1-1' : rmaDecision === 'VENDOR_WARRANTY' ? 'Gửi hãng bảo hành' : rmaDecision === 'RESTOCK_WAREHOUSE' ? 'Nhập lại kho bán lẻ & Hoàn tiền' : 'Từ chối đổi trả (Vi phạm BH)'}`,
      rmaDecision === 'REJECT_RMA' ? 'error' : 'success'
    );
  };

  // Mở Modal Thẩm Định Tem & Ngoại Quan Kiện Hàng Hoàn Về
  const handleOpenRestockModal = (order) => {
    setSelectedRestockOrder(order);
    setRestockCondition('PERFECT_SEAL');
    setRestockChecklist({
      sealIntact: true,
      boxUnopened: true,
      accessoriesComplete: true,
      noWaterDrop: true
    });
    setRestockNotes('Tem seal niêm phong nguyên vẹn 100%, ngoại quan hộp không móp méo, đủ điều kiện nhập lại kho bán mới.');
  };

  // Submit Kết Quả Thẩm Định Tem & Cập Nhật Tồn Kho
  const handleSubmitRestockInspection = (e) => {
    e.preventDefault();
    if (!selectedRestockOrder) return;

    const orderId = selectedRestockOrder.orderId || selectedRestockOrder.id;
    const isFullRestock = restockCondition === 'PERFECT_SEAL';
    const isOutletRestock = restockCondition === 'DENTED_BOX_OUTLET';
    const isDamaged = restockCondition === 'DAMAGED_CARRIER';

    const targetStatus = isDamaged ? 'RETURN_DAMAGED' : 'CANCELLED';
    const resolutionNote = isFullRestock 
      ? 'QC xác nhận: Tem seal nguyên vẹn 100% -> Đã nhập lại Tồn Kho Bán Mới'
      : isOutletRestock
      ? 'QC xác nhận: Móp vỏ hộp nhẹ -> Đã nhập vào Kho Thanh Lý / Open-Box'
      : 'QC xác nhận: Hư hỏng vỡ seal do vận chuyển -> Đã chuyển vào Kho Chờ Xử Lý Bồi Thường';

    if (typeof updateOrderStatus === 'function') {
      updateOrderStatus(orderId, targetStatus, resolutionNote, {
        restockedAt: new Date().toISOString(),
        restockedBy: user?.fullname || 'Chuyên viên QA/QC',
        restockCondition,
        restockChecklist
      });
    }

    const newLog = {
      id: `QA-RET-${Date.now().toString().slice(-4)}`,
      type: 'FAILED_DELIVERY_RESTOCK',
      orderId,
      customerName: selectedRestockOrder.customerName,
      inspector: user?.fullname || 'Chuyên viên QA/QC',
      date: new Date().toLocaleDateString('vi-VN'),
      decision: isFullRestock ? 'RESTOCK_NEW' : isOutletRestock ? 'RESTOCK_OUTLET' : 'CARRIER_DAMAGE_DISPUTE',
      defectCategory: isFullRestock ? 'NORMAL_RESTOCK' : isOutletRestock ? 'PACKAGE_DAMAGED' : 'USER_PHYSICAL_DAMAGE',
      checklist: restockChecklist,
      notes: `${resolutionNote}. Ghi chú QC: "${restockNotes}"`,
      status: isDamaged ? 'QA_REJECTED' : 'QC_PASSED'
    };
    saveQaLogs([newLog, ...qaLogs]);

    if (typeof sendSystemNotification === 'function') {
      sendSystemNotification({
        title: `[THẨM ĐỊNH HOÀN KHO] Đơn #${orderId}`,
        content: `QC đã thẩm định kiện hàng #${orderId} (${resolutionNote}). Tồn kho ERP đã được cập nhật.`,
        type: isDamaged ? 'ERROR' : 'SUCCESS',
        recipient: 'Kho Vận, Thủ Kho, Kế Toán'
      });
    }

    setSelectedRestockOrder(null);
    showToast(
      'Cập Nhật Tồn Kho ERP Thành Công',
      `Đơn #${orderId}: ${resolutionNote}`,
      isDamaged ? 'error' : 'success'
    );
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={24} style={{ color: '#2563eb' }} />
            {activeTab === 'overview' && 'Tổng Quan Kiểm Định Chất Lượng (QA / QC Dashboard)'}
            {activeTab === 'inbound' && 'Kiểm Định Hàng Nhập Từ Nhà Cung Cấp (Inbound Inspection)'}
            {activeTab === 'returns' && 'Thẩm Định Hàng Đổi Trả Khách Hàng (Customer RMA)'}
            {activeTab === 'logs' && 'Nhật Ký & Biên Bản Nghiệm Thu Chất Lượng (Inspection Logs)'}
            {activeTab === 'reports' && 'Báo Cáo Chất Lượng & Đánh Giá Nhà Cung Cấp (Vendor Quality)'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            Hệ thống kiểm soát chất lượng linh kiện đầu vào, phân loại lỗi và thẩm định hàng bảo hành đổi trả
          </p>
        </div>

        <button
          onClick={fetchData}
          style={{
            backgroundColor: '#ffffff',
            color: '#2563eb',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            padding: '0.45rem 0.9rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <RefreshCw size={14} />
          <span>Làm Mới Dữ Liệu</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* QC TASK BANNER */}
      {/* ========================================================================= */}
      {pendingQaPOs.length > 0 && (
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
              <ShieldAlert size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem', color: '#92400e' }}>
                  Có {pendingQaPOs.length} Lô Hàng PO Vừa Giao Tới Đang Chờ Nghiệm Thu QA/QC
                </strong>
                <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '10px' }}>
                  Cần xử lý
                </span>
              </div>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#b45309' }}>
                Tiến hành kiểm tra ngoại quan, seal niêm phong và Serial Number trước khi cho nhập kho.
              </p>
            </div>
          </div>

          {isQCOfficer ? (
            <button
              onClick={() => {
                setTab('inbound');
                if (pendingQaPOs.length > 0) {
                  handleOpenInspectionModal(pendingQaPOs[0]);
                }
              }}
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
              <span>Vào Kiểm Định Ngay</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => setTab('inbound')}
              style={{
                backgroundColor: '#ffffff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
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
              <span>Xem Danh Sách Chờ Nghiệm Thu</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN KIỂM ĐỊNH) */}
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
            {/* Defect Categories Chart */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', height: '320px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Phân Loại Các Dạng Lỗi Linh Kiện
              </h3>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={defectChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
                  }}
                />
              </div>
            </div>

            {/* Weekly Pass Rate Chart */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', height: '320px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Khối Lượng Linh Kiện Đạt Chuẩn vs Lỗi Theo Tuần
              </h3>
              <div style={{ flex: 1, position: 'relative' }}>
                <Bar
                  data={weeklyChartData}
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

          {/* Quick Actions & Recent Inspections Preview */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Biên Bản Kiểm Định Gần Đây Nhất
              </h3>
              <button onClick={() => setTab('logs')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                Xem toàn bộ nhật ký →
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '0.5rem 0.65rem' }}>Mã QA</th>
                    <th style={{ padding: '0.5rem 0.65rem' }}>Mã PO</th>
                    <th style={{ padding: '0.5rem 0.65rem' }}>Nhà Cung Cấp</th>
                    <th style={{ padding: '0.5rem 0.65rem', textAlign: 'center' }}>Đạt / Tổng</th>
                    <th style={{ padding: '0.5rem 0.65rem' }}>Kết Luận</th>
                  </tr>
                </thead>
                <tbody>
                  {qaLogs.slice(0, 4).map((log, lIdx) => (
                    <tr key={lIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.5rem 0.65rem', fontWeight: 700, color: '#2563eb' }}>{log.id}</td>
                      <td style={{ padding: '0.5rem 0.65rem', fontWeight: 600 }}>{log.poNumber}</td>
                      <td style={{ padding: '0.5rem 0.65rem' }}>{log.supplierName}</td>
                      <td style={{ padding: '0.5rem 0.65rem', textAlign: 'center', fontWeight: 700 }}>
                        <span style={{ color: '#16a34a' }}>{log.passedQty}</span> / {log.totalQty}
                      </td>
                      <td style={{ padding: '0.5rem 0.65rem' }}>
                        <span style={{
                          backgroundColor: log.status === 'QA_PASSED' ? '#f0fdf4' : log.status === 'QA_PARTIAL' ? '#fff7ed' : '#fef2f2',
                          color: log.status === 'QA_PASSED' ? '#15803d' : log.status === 'QA_PARTIAL' ? '#c2410c' : '#dc2626',
                          border: `1px solid ${log.status === 'QA_PASSED' ? '#bbf7d0' : log.status === 'QA_PARTIAL' ? '#fed7aa' : '#fecaca'}`,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 700
                        }}>
                          {log.status === 'QA_PASSED' ? 'CHO NHẬP KHO 100%' : log.status === 'QA_PARTIAL' ? 'NHẬP 1 PHẦN' : 'HOÀN TRẢ NCC'}
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

      {/* ========================================================================= */}
      {/* TAB 2: INBOUND (KIỂM ĐỊNH HÀNG NHẬP NCC) */}
      {/* ========================================================================= */}
      {activeTab === 'inbound' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, maxWidth: '350px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  placeholder="Tìm theo mã PO, tên nhà cung cấp..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
                <Search size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'PENDING', label: `Chờ kiểm định (${pendingQaPOs.length})` },
                { key: 'PASSED', label: 'Đã nghiệm thu' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: statusFilter === f.key ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: statusFilter === f.key ? '#2563eb' : '#ffffff',
                    color: statusFilter === f.key ? '#ffffff' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* PO List Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã Đơn PO</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Thời Gian</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Nhà Cung Cấp</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Số Lượng</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Giá Trị Lô Hàng</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Trạng Thái QA</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {orders
                  .filter(po => {
                    const matchesSearch = !searchTerm || (po.poNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) || (po.supplier?.name || po.supplierCode || '').toLowerCase().includes(searchTerm.toLowerCase());
                    if (statusFilter === 'PENDING') return matchesSearch && PENDING_QA_STATUSES.includes(po.status);
                    if (statusFilter === 'PASSED') return matchesSearch && PASSED_QA_STATUSES.includes(po.status);
                    return matchesSearch;
                  })
                  .map(po => {
                    const totalQty = po.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || po.quantity || 1;
                    const isPending = PENDING_QA_STATUSES.includes(po.status);
                    const formattedDate = po.createdAt 
                      ? new Date(po.createdAt).toLocaleDateString('vi-VN') 
                      : (po.date || po.orderDate || '18/08/2026');

                    return (
                      <tr key={po.id || po.poNumber} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#2563eb' }}>
                          {po.poNumber || `PO-${po.id}`}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {formattedDate}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0f172a' }}>
                          {po.supplier?.name || po.supplierCode || 'Nhà Cung Cấp'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 600 }}>
                          {totalQty} chiếc
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          {formatPrice(po.totalAmount)}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: isPending ? '#fffbeb' : po.status === 'QA_PASSED' ? '#f0fdf4' : po.status === 'QA_REJECTED' ? '#fef2f2' : '#fff7ed',
                            color: isPending ? '#b45309' : po.status === 'QA_PASSED' ? '#15803d' : po.status === 'QA_REJECTED' ? '#dc2626' : '#c2410c',
                            border: `1px solid ${isPending ? '#fde68a' : po.status === 'QA_PASSED' ? '#bbf7d0' : po.status === 'QA_REJECTED' ? '#fecaca' : '#fed7aa'}`,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}>
                            {isPending ? 'CHỜ NGHIỆM THU' : po.status === 'QA_PASSED' ? 'CHO NHẬP KHO 100%' : po.status === 'QA_REJECTED' ? 'TỪ CHỐI QC' : 'NHẬP 1 PHẦN'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          {isPending ? (
                            isQCOfficer ? (
                              <button
                                onClick={() => handleOpenInspectionModal(po)}
                                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.35rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <ShieldCheck size={14} /> Kiểm Định Ngay
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.74rem', color: '#b45309', fontWeight: 600, backgroundColor: '#fef3c7', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                Chờ QA/QC kiểm định
                              </span>
                            )
                          ) : (
                            <button
                              onClick={() => {
                                const targetPoNum = po.poNumber || po.id;
                                const log = qaLogs.find(l => String(l.poNumber) === String(targetPoNum) || String(l.poNumber) === String(po.id) || String(l.id) === String(po.id));
                                if (log) {
                                  setViewingLog(log);
                                } else {
                                  const totalQty = po.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || po.quantity || 1;
                                  const isRejected = po.status === 'QA_REJECTED';
                                  const isPartial = po.status === 'QA_PARTIAL';
                                  setViewingLog({
                                    id: `QA-LOG-${targetPoNum}`,
                                    type: 'INBOUND_PO',
                                    poNumber: targetPoNum,
                                    supplierName: po.supplier?.name || po.supplierCode || po.supplierName || 'Nhà Cung Cấp',
                                    inspector: user?.fullname || 'Chuyên viên QA/QC',
                                    date: po.createdAt ? new Date(po.createdAt).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
                                    totalQty: totalQty,
                                    passedQty: isRejected ? 0 : (isPartial ? Math.max(1, totalQty - 2) : totalQty),
                                    failedQty: isRejected ? totalQty : (isPartial ? 2 : 0),
                                    decision: isRejected ? 'REJECT_ALL' : (isPartial ? 'ACCEPT_PARTIAL' : 'ACCEPT_ALL'),
                                    defectCategory: isRejected || isPartial ? 'PACKAGE_DAMAGED' : 'NONE',
                                    notes: po.supplierNote || 'Lô hàng đã được nghiệm thu kỹ thuật và đối soát tiêu chuẩn chất lượng.',
                                    status: po.status || 'QA_PASSED'
                                  });
                                }
                              }}
                              style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Xem Biên Bản
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RETURNS (THẨM ĐỊNH HÀNG ĐỔI TRẢ KHÁCH & HÀNG GIAO HOÀN VỀ KHO) */}
      {/* ========================================================================= */}
      {activeTab === 'returns' && (() => {
        // 1. Danh sách hàng giao thất bại / khách hủy chuyển hoàn về kho
        const failedDeliveries = erpOrders.filter(o => o.status === 'RETURNING_TO_WAREHOUSE');

        // 2. Danh sách yêu cầu đổi trả RMA từ khách hàng (kết hợp store & localStorage)
        let localReturns = [];
        try { localReturns = JSON.parse(localStorage.getItem('erp_return_requests') || '[]'); } catch (_) {}
        const retMap = new Map();
        (returnRequests || []).forEach(r => { const k = String(r.id || r.orderId || ''); if (k) retMap.set(k, r); });
        localReturns.forEach(r => { const k = String(r.id || r.orderId || ''); if (k) retMap.set(k, { ...retMap.get(k), ...r }); });
        const mergedReturns = Array.from(retMap.values());

        const allReturns = mergedReturns.length > 0 ? mergedReturns : [
          { id: 'RET-001', orderId: 'ORD-101', customerName: 'Lê Hoàng Hùng', phone: '0901234567', product: 'Intel Core i5-13400F', serial: 'SN-CPU-13400F-8821', reason: 'Cắm nguồn không lên hình, test bo mạch khác vẫn không POST', status: 'PENDING' },
          { id: 'RET-002', orderId: 'ORD-102', customerName: 'Nguyễn Thị Hoa', phone: '0987654321', product: 'MSI GeForce RTX 4060 Ventus 2X 8GB OC', serial: 'SN-VGA-4060-9901', reason: 'Quạt quay kêu rè rè và nhiệt độ lên 85 độ C khi chơi game', status: 'PENDING' },
          { id: 'RET-003', orderId: 'ORD-103', customerName: 'Trần Minh Nam', phone: '0912345678', product: 'ASUS ROG Strix RTX 4070 Super 12GB OC', serial: 'SN-VGA-4070S-3312', reason: 'Khách muốn đổi sang bản RTX 4080 Super (hàng nguyên seal)', status: 'PENDING' }
        ];

        // Helper functions kiểm tra trạng thái RMA chuẩn xác tuyệt đối
        const isRmaPending = (rma) => !rma?.status || ['PENDING', 'NEW', 'PROCESSING', 'WAITING', 'DELIVERED_TO_WAREHOUSE', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNING_TO_WAREHOUSE'].includes(rma.status);
        const isRmaPassed = (rma) => ['QC_PASSED', 'EXCHANGED', 'APPROVED', 'EXCHANGE_NEW', 'RESTOCK_WAREHOUSE', 'RESTOCKED', 'REFUNDED'].includes(rma?.status);
        const isRmaVendor = (rma) => ['VENDOR_WARRANTY', 'WARRANTY'].includes(rma?.status);
        const isRmaRejected = (rma) => ['REJECTED', 'REJECT', 'REJECT_RMA', 'REJECTED_WARRANTY', 'CANCELLED', 'FAILED'].includes(rma?.status);

        // Lọc từng nguồn theo rmaFilter:
        const filteredFailed = failedDeliveries.filter(ord => {
          if (rmaFilter === 'ALL' || rmaFilter === 'PENDING') return true;
          return false;
        });

        const filteredRma = allReturns.filter(rma => {
          if (rmaFilter === 'PENDING') return isRmaPending(rma);
          if (rmaFilter === 'QC_PASSED') return isRmaPassed(rma);
          if (rmaFilter === 'VENDOR_WARRANTY') return isRmaVendor(rma);
          if (rmaFilter === 'REJECTED') return isRmaRejected(rma);
          return true;
        });

        // Danh sách hiển thị theo Source Filter
        const showFailed = (rmaSourceFilter === 'ALL' || rmaSourceFilter === 'FAILED_DELIVERY') ? filteredFailed : [];
        const showRma = (rmaSourceFilter === 'ALL' || rmaSourceFilter === 'CUSTOMER_RMA') ? filteredRma : [];
        const totalVisible = showFailed.length + showRma.length;

        // Tính số lượng cho từng Tab trạng thái
        const countPending = failedDeliveries.length + allReturns.filter(isRmaPending).length;
        const countPassed = allReturns.filter(isRmaPassed).length;
        const countVendor = allReturns.filter(isRmaVendor).length;
        const countRejected = allReturns.filter(isRmaRejected).length;
        const countAll = failedDeliveries.length + allReturns.length;

        return (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldAlert size={18} style={{ color: '#8b5cf6' }} />
                  <span>Thẩm Định Hàng Trả Về & Bảo Hành (Customer RMA & Failed Deliveries)</span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                  Phân loại kiểm định: <strong>Hàng giao thất bại/bom hàng hoàn về</strong> (kiểm tra seal & nhập kho) vs <strong>Hàng khách đổi trả RMA</strong> (thẩm định lỗi kỹ thuật)
                </p>
              </div>

              {/* RMA Status Filter Tabs with Counts */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: `Tất cả (${countAll})` },
                  { key: 'PENDING', label: `Chờ Thẩm Định / Nhập Kho (${countPending})` },
                  { key: 'QC_PASSED', label: `Đã Duyệt Đổi Mới (${countPassed})` },
                  { key: 'VENDOR_WARRANTY', label: `Gửi Hãng BH (${countVendor})` },
                  { key: 'REJECTED', label: `Từ Chối BH (${countRejected})` }
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setRmaFilter(f.key)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      border: rmaFilter === f.key ? '1px solid #8b5cf6' : '1px solid #cbd5e1',
                      backgroundColor: rmaFilter === f.key ? '#8b5cf6' : '#ffffff',
                      color: rmaFilter === f.key ? '#ffffff' : '#475569',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SOURCE CLASSIFICATION TABS */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.15rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <button
                onClick={() => setRmaSourceFilter('ALL')}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '6px',
                  border: rmaSourceFilter === 'ALL' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: rmaSourceFilter === 'ALL' ? '#eff6ff' : '#ffffff',
                  color: rmaSourceFilter === 'ALL' ? '#2563eb' : '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 750,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>Tất Cả Nguồn Hàng Trả Về</span>
                <span style={{ backgroundColor: rmaSourceFilter === 'ALL' ? '#2563eb' : '#f1f5f9', color: rmaSourceFilter === 'ALL' ? '#ffffff' : '#64748b', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
                  {filteredFailed.length + filteredRma.length}
                </span>
              </button>

              <button
                onClick={() => setRmaSourceFilter('FAILED_DELIVERY')}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '6px',
                  border: rmaSourceFilter === 'FAILED_DELIVERY' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                  backgroundColor: rmaSourceFilter === 'FAILED_DELIVERY' ? '#fff7ed' : '#ffffff',
                  color: rmaSourceFilter === 'FAILED_DELIVERY' ? '#ea580c' : '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 750,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>Hàng Bom / Giao Thất Bại Hoàn Về</span>
                <span style={{ backgroundColor: rmaSourceFilter === 'FAILED_DELIVERY' ? '#ea580c' : '#f1f5f9', color: rmaSourceFilter === 'FAILED_DELIVERY' ? '#ffffff' : '#64748b', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
                  {filteredFailed.length}
                </span>
              </button>

              <button
                onClick={() => setRmaSourceFilter('CUSTOMER_RMA')}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '6px',
                  border: rmaSourceFilter === 'CUSTOMER_RMA' ? '1.5px solid #8b5cf6' : '1px solid #cbd5e1',
                  backgroundColor: rmaSourceFilter === 'CUSTOMER_RMA' ? '#f5f3ff' : '#ffffff',
                  color: rmaSourceFilter === 'CUSTOMER_RMA' ? '#8b5cf6' : '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 750,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>Khách Hàng Yêu Cầu Đổi Trả RMA</span>
                <span style={{ backgroundColor: rmaSourceFilter === 'CUSTOMER_RMA' ? '#8b5cf6' : '#f1f5f9', color: rmaSourceFilter === 'CUSTOMER_RMA' ? '#ffffff' : '#64748b', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
                  {filteredRma.length}
                </span>
              </button>
            </div>

            {/* LIST CONTAINER OR EMPTY STATE */}
            {totalVisible === 0 ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                <ShieldCheck size={38} style={{ color: '#94a3b8', marginBottom: '0.65rem' }} />
                <div style={{ fontWeight: 750, fontSize: '0.92rem', color: '#334155' }}>
                  Không có kiện hàng hoặc phiếu bảo hành nào ở mục này
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
                  Hãy thử chọn bộ lọc trạng thái khác hoặc bấm "Tất cả" để xem danh sách tổng thể.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                
                {/* 1. RENDER HÀNG GIAO THẤT BẠI / BOM HÀNG HOÀN VỀ */}
                {showFailed.map((ord, oIdx) => {
                  const itemNames = (ord.items || []).map(i => `${i.name || i.productName || 'Linh kiện'} (x${i.quantity || 1})`).join(', ') || 'Kiện hàng linh kiện máy tính';

                  return (
                    <div 
                      key={`failed-${oIdx}`}
                      style={{
                        padding: '1rem 1.25rem',
                        borderRadius: '8px',
                        border: '1.5px solid #fed7aa',
                        backgroundColor: '#fffaf5',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.85rem',
                        boxShadow: '0 2px 4px rgba(234,88,12,0.06)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ea580c' }}>
                            #{ord.orderId || ord.id}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            backgroundColor: '#ffedd5',
                            color: '#c2410c',
                            border: '1px solid #fdba74'
                          }}>
                            HÀNG BOM / HỦY GIAO HOÀN
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a'
                          }}>
                            Chờ kiểm tra tem seal & nhập kho
                          </span>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600 }}>
                          <strong>Linh kiện trong kiện:</strong> {itemNames}
                        </div>

                        <div style={{ fontSize: '0.76rem', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                          <span>Khách hàng: <strong>{ord.customerName}</strong> ({ord.phone})</span>
                          <span>Địa chỉ: {ord.shippingAddress || 'TP.HCM'}</span>
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>
                            Lý do hoàn: {ord.returnReason || ord.failReason || 'Khách từ chối nhận hàng / Bom hàng'}
                          </span>
                        </div>
                      </div>

                      {/* Action Controls for Failed Delivery Restock */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isQCOfficer ? (
                          <button
                            onClick={() => handleOpenRestockModal(ord)}
                            style={{
                              backgroundColor: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.45rem 0.85rem',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              boxShadow: '0 2px 4px rgba(22,163,74,0.25)'
                            }}
                          >
                            <ShieldCheck size={14} /> Thẩm Định Tem & Nhập Kho
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#15803d', fontWeight: 600, backgroundColor: '#f0fdf4', padding: '0.35rem 0.65rem', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                            Chờ QA/QC kiểm tra tem
                          </span>
                        )}

                        {/* Nút 3 chấm (...) xem lịch sử thay đổi */}
                        <button
                          onClick={() => setSelectedHistoryOrder(ord)}
                          title="Xem chi tiết lịch sử thay đổi & vết luân chuyển (...)"
                          style={{
                            backgroundColor: '#ffffff',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.45rem 0.6rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#f1f5f9';
                            e.currentTarget.style.borderColor = '#94a3b8';
                            e.currentTarget.style.color = '#0f172a';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.color = '#475569';
                          }}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 2. RENDER YÊU CẦU ĐỔI TRẢ RMA TỪ KHÁCH HÀNG */}
                {showRma.map((rma, rIdx) => {
                  const productName = getRmaProductName(rma);
                  const serialNum = getRmaSerial(rma);
                  const isPending = isRmaPending(rma);
                  const isPassed = isRmaPassed(rma);
                  const isVendor = isRmaVendor(rma);
                  const isRejected = isRmaRejected(rma);

                  return (
                    <div 
                      key={`rma-${rIdx}`} 
                      style={{ 
                        padding: '0.85rem 1.15rem', 
                        borderRadius: '8px', 
                        border: `1px solid ${isPending ? '#ddd6fe' : isPassed ? '#bbf7d0' : isVendor ? '#fed7aa' : '#fecaca'}`, 
                        backgroundColor: isPending ? '#faf5ff' : isPassed ? '#f0fdf4' : isVendor ? '#fff7ed' : '#fef2f2',
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        transition: 'all 0.15s ease-in-out',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#8b5cf6' }}>{rma.id}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>• Đơn: <strong>#{rma.orderId || 'N/A'}</strong></span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            backgroundColor: '#ede9fe',
                            color: '#6d28d9',
                            border: '1px solid #ddd6fe'
                          }}>
                            RMA ĐỔI TRẢ BẢO HÀNH
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            backgroundColor: isPending ? '#fffbeb' : isPassed ? '#dcfce7' : isVendor ? '#ffedd5' : '#fee2e2',
                            color: isPending ? '#b45309' : isPassed ? '#15803d' : isVendor ? '#c2410c' : '#dc2626',
                            border: `1px solid ${isPending ? '#fde68a' : isPassed ? '#86efac' : isVendor ? '#fdba74' : '#fca5a5'}`
                          }}>
                            {isPending ? 'Chờ thẩm định' : isPassed ? 'Đã duyệt đổi mới' : isVendor ? 'Gửi hãng BH' : 'Từ chối BH'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {productName}
                          </span>
                          <span style={{ fontSize: '0.72rem', backgroundColor: '#e2e8f0', color: '#334155', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700 }}>
                            {serialNum}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '0.76rem' }}>
                            • KH: <strong>{rma.customerName || 'Khách lẻ'}</strong> ({rma.phone || 'N/A'})
                          </span>
                        </div>
                      </div>

                      {/* Action Controls & Three-dots button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isPending && (
                          isQCOfficer ? (
                            <button
                              onClick={() => handleOpenRmaInspection(rma)}
                              style={{
                                backgroundColor: '#8b5cf6',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.45rem 0.85rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                boxShadow: '0 2px 4px rgba(139,92,246,0.25)'
                              }}
                            >
                              <ShieldCheck size={14} /> Thẩm Định
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: '#6d28d9', fontWeight: 600, backgroundColor: '#f5f3ff', padding: '0.35rem 0.65rem', borderRadius: '4px', border: '1px solid #ddd6fe' }}>
                              Chờ QA/QC thẩm định
                            </span>
                          )
                        )}

                        {/* Three-dots Details Button (...) */}
                        <button
                          onClick={() => setDetailRMA(rma)}
                          title="Xem chi tiết phiếu & biên bản (...)"
                          style={{
                            backgroundColor: '#ffffff',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.35rem 0.55rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}

              </div>
            )}

          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB 4: LOGS (NHẬT KÝ & BIÊN BẢN QA) */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={18} style={{ color: '#2563eb' }} />
              <span>Nhật Ký & Hồ Sơ Biên Bản Kiểm Định Chất Lượng</span>
            </h3>

            {/* Filter by Log Type */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {[
                { key: 'ALL', label: 'Tất Cả Biên Bản' },
                { key: 'INBOUND_PO', label: 'Hàng Nhập (PO)' },
                { key: 'CUSTOMER_RMA', label: 'Đổi Trả (RMA)' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setLogFilter(f.key)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: logFilter === f.key ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: logFilter === f.key ? '#2563eb' : '#ffffff',
                    color: logFilter === f.key ? '#ffffff' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã Biên Bản</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Thời Gian</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Phân Loại</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã Đối Soát (PO / Đơn)</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Đối Tượng / Khách Hàng</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Kiểm Định Viên</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Kết Quả</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Dạng Lỗi</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {qaLogs
                  .filter(log => {
                    if (logFilter === 'INBOUND_PO') return log.type === 'INBOUND_PO' || !log.type;
                    if (logFilter === 'CUSTOMER_RMA') return log.type === 'CUSTOMER_RMA';
                    return true;
                  })
                  .map((log, idx) => {
                    const isRma = log.type === 'CUSTOMER_RMA';
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: isRma ? '#8b5cf6' : '#2563eb' }}>
                          {log.id}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {log.date || '18/08/2026'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: isRma ? '#f5f3ff' : '#eff6ff',
                            color: isRma ? '#7c3aed' : '#1d4ed8',
                            border: `1px solid ${isRma ? '#ddd6fe' : '#bfdbfe'}`
                          }}>
                            {isRma ? 'RMA ĐỔI TRẢ' : 'NHẬP KHO PO'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>
                          {log.poNumber || log.rmaId || 'N/A'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          {log.supplierName || log.customerName || 'N/A'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>{log.inspector}</td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          {isRma ? (
                            <span style={{
                              fontWeight: 700,
                              color: log.decision === 'REJECT_RMA' ? '#dc2626' : '#16a34a'
                            }}>
                              {log.decision === 'EXCHANGE_NEW' ? 'ĐỔI MỚI 1-1' : log.decision === 'VENDOR_WARRANTY' ? 'GỬI HÃNG' : log.decision === 'RESTOCK_WAREHOUSE' ? 'NHẬP LẠI KHO' : 'TỪ CHỐI'}
                            </span>
                          ) : (
                            <>
                              <strong style={{ color: '#16a34a' }}>{log.passedQty}</strong> / <span style={{ color: '#ef4444' }}>{log.failedQty}</span> (Tổng: {log.totalQty})
                            </>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontSize: '0.78rem' }}>
                          {DEFECT_LABELS[log.defectCategory] || log.defectCategory || 'None'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          <button
                            onClick={() => setViewingLog(log)}
                            style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Eye size={13} /> Chi Tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: KIỂM ĐỊNH HÀNG NHẬP NHÀ CUNG CẤP (INBOUND PO INSPECTION) */}
      {/* ========================================================================= */}
      {selectedPO && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.15)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Nghiệm Thu & Kiểm Định Chất Lượng Đơn PO: {formatPurchaseReference(selectedPO)}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Nhà cung cấp: <strong style={{ color: '#0f172a' }}>{selectedPO.supplier?.name || selectedPO.supplierCode || selectedPO.supplierName || 'Nhà Cung Cấp'}</strong>
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedPO(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitQaInspection}>
              {/* 1. Itemized Product Table */}
              {(() => {
                const poItems = (selectedPO.items && selectedPO.items.length > 0)
                  ? selectedPO.items.map(it => ({
                      name: it.name || it.productName || it.product?.name || (selectedPO.supplier?.name?.includes('AMD') ? 'CPU AMD Ryzen 7 7800X3D Box Chính Hãng' : selectedPO.supplier?.name?.includes('Intel') ? 'CPU Intel Core i9-14900K Box' : selectedPO.supplier?.name?.includes('Anh Ngọc') ? 'VGA MSI GeForce RTX 4060 Ti Ventus 8GB' : 'Linh Kiện Máy Tính'),
                      quantity: Number(it.quantity) || 1,
                      unitCost: Number(it.unitCost || it.unitPrice || it.price || (selectedPO.totalAmount ? Number(selectedPO.totalAmount) / (Number(it.quantity) || 1) : 4750000)),
                      totalCost: Number(it.totalCost || it.total || (Number(it.quantity || 1) * Number(it.unitCost || it.unitPrice || it.price || 4750000)))
                    }))
                  : [{
                      name: selectedPO.productName || selectedPO.name || (selectedPO.supplier?.name?.includes('AMD') ? 'CPU AMD Ryzen 7 7800X3D Box Chính Hãng' : selectedPO.supplier?.name?.includes('Anh Ngọc') ? 'VGA MSI GeForce RTX 4060 Ti Ventus 8GB' : 'Bộ Vi Xử Lý & Linh Kiện PC'),
                      quantity: Number(selectedPO.quantity) || 50,
                      unitCost: (Number(selectedPO.totalAmount) || 47500000) / (Number(selectedPO.quantity) || 50),
                      totalCost: Number(selectedPO.totalAmount) || 47500000
                    }];

                const totalItemsQty = poItems.reduce((s, i) => s + i.quantity, 0);

                return (
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                      Danh Sách Linh Kiện Trong Lô Hàng PO:
                    </div>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: '0.35rem 0' }}>Tên Linh Kiện</th>
                          <th style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>Số Lượng</th>
                          <th style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>Đơn Giá</th>
                          <th style={{ padding: '0.35rem 0', textAlign: 'right' }}>Thành Tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poItems.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px dashed #e2e8f0' }}>
                            <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#1e293b' }}>
                              {it.name}
                            </td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>
                              {it.quantity} cái
                            </td>
                            <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#64748b' }}>
                              {formatPrice(it.unitCost)}
                            </td>
                            <td style={{ padding: '0.45rem 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              {formatPrice(it.totalCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <span>Tổng số lượng đặt mua: <strong style={{ color: '#0f172a' }}>{totalItemsQty} SP</strong></span>
                      <span>Tổng trị giá đơn PO: <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>{formatPrice(selectedPO.totalAmount)}</strong></span>
                    </div>
                  </div>
                );
              })()}

              {/* 2. Step 1: Technical Inspection Criteria Checklist */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.65rem' }}>
                  Bước 1: Kiểm Tra Tiêu Chuẩn Kỹ Thuật (Inspection Criteria)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#334155', cursor: 'pointer', padding: '0.35rem 0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <input type="checkbox" defaultChecked style={{ width: '15px', height: '15px' }} />
                    <span>Hộp đựng & Tem niêm phong (Seal) nguyên vẹn</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#334155', cursor: 'pointer', padding: '0.35rem 0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <input type="checkbox" defaultChecked style={{ width: '15px', height: '15px' }} />
                    <span>Serial / Barcode trùng khớp thông số đơn PO</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#334155', cursor: 'pointer', padding: '0.35rem 0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <input type="checkbox" defaultChecked style={{ width: '15px', height: '15px' }} />
                    <span>Chân socket/PCIe/RAM không cong gãy, trầy xước</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#334155', cursor: 'pointer', padding: '0.35rem 0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <input type="checkbox" defaultChecked style={{ width: '15px', height: '15px' }} />
                    <span>Không có dấu hiệu chập cháy, ẩm mốc linh kiện</span>
                  </label>
                </div>
              </div>

              {/* 3. Step 2: Inspection Numbers & Quick Preset */}
              {(() => {
                const total = selectedPO.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || selectedPO.quantity || 50;
                return (
                  <div style={{ marginBottom: '1.25rem', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                        Bước 2: Nhập Số Lượng Nghiệm Thu Thực Tế (Tổng {total} SP)
                      </div>
                      
                      {/* Quick Presets */}
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setPassedQty(total);
                            setFailedQty(0);
                            setInspectionDecision('ACCEPT_ALL');
                          }}
                          style={{ padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          100% Đạt Chuẩn
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const p = Math.max(0, total - 2);
                            setPassedQty(p);
                            setFailedQty(total > 2 ? 2 : 1);
                            setInspectionDecision('ACCEPT_PARTIAL');
                            setDefectCategory('PACKAGE_DAMAGED');
                          }}
                          style={{ padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Phát Hiện Lỗi (Nhập 1 phần)
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', display: 'block', marginBottom: '0.25rem' }}>
                          Số Lượng ĐẠT TIÊU CHUẨN (Passed):
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={total}
                          value={passedQty}
                          onChange={e => handlePassedQtyChange(e.target.value, total)}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1.5px solid #86efac', fontSize: '1rem', fontWeight: 800, color: '#15803d', backgroundColor: '#f0fdf4', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: '0.25rem' }}>
                          Số Lượng LỖI / HƯ HỎNG (Defective):
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={total}
                          value={failedQty}
                          onChange={e => handleFailedQtyChange(e.target.value, total)}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1.5px solid #fca5a5', fontSize: '1rem', fontWeight: 800, color: '#dc2626', backgroundColor: '#fef2f2', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 4. Step 3: Quality Decision (QA Verdict) */}
              {(() => {
                const total = selectedPO.items?.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0) || selectedPO.quantity || 50;
                return (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '0.45rem' }}>
                      Bước 3: Quyết Định Nghiệm Thu Kỹ Thuật (QA Verdict):
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                      {[
                        { key: 'ACCEPT_ALL', label: 'CHO NHẬP KHO 100%', desc: 'Đạt chuẩn 100% không có lỗi', color: '#16a34a', bg: '#f0fdf4' },
                        { key: 'ACCEPT_PARTIAL', label: 'NHẬP MỘT PHẦN', desc: `Nhập ${passedQty} SP đạt, trả ${failedQty} SP lỗi`, color: '#c2410c', bg: '#fff7ed' },
                        { key: 'REJECT_ALL', label: 'HOÀN TRẢ NCC 100%', desc: 'Lô hàng không đạt chuẩn', color: '#ef4444', bg: '#fef2f2' }
                      ].map(d => {
                        const active = inspectionDecision === d.key;
                        return (
                          <button
                            type="button"
                            key={d.key}
                            onClick={() => handleDecisionChange(d.key, total)}
                            style={{
                              padding: '0.75rem 0.5rem',
                              borderRadius: '8px',
                              border: active ? `2px solid ${d.color}` : '1px solid #cbd5e1',
                              backgroundColor: active ? d.bg : '#ffffff',
                              color: active ? d.color : '#334155',
                              cursor: 'pointer',
                              textAlign: 'center'
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: '0.78rem' }}>{d.label}</div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.15rem' }}>{d.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 5. Defect Classification (if any failed) */}
              {failedQty > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: '0.3rem' }}>
                    Phân Loại Dạng Lỗi Linh Kiện (Gửi Yêu Cầu Cho Nhà Cung Cấp):
                  </label>
                  <select
                    value={defectCategory}
                    onChange={e => setDefectCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.65rem', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '0.82rem', color: '#dc2626', backgroundColor: '#fff5f5' }}
                  >
                    <option value="PACKAGE_DAMAGED">Rách hộp, vỡ vỏ niêm phong / Rách tem seal</option>
                    <option value="HARDWARE_BURNT">Cháy nổ mạch, chạm chập IC linh kiện điện tử</option>
                    <option value="WRONG_SPEC">Sai lệch mã sản phẩm hoặc sai thông số kỹ thuật</option>
                    <option value="PHYSICAL_DEFECT">Cong chân socket CPU, nứt gãy chân PCIe/RAM</option>
                    <option value="MISSING_ACCESSORIES">Thiếu phụ kiện (cáp nguồn, ốc vít, tản nhiệt)</option>
                  </select>
                </div>
              )}

              {/* 6. QC Notes */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.3rem' }}>
                  Ý Kiến Kết Luận Của Kiểm Định Viên:
                </label>
                <textarea
                  rows="3"
                  value={qcNotes}
                  onChange={e => setQcNotes(e.target.value)}
                  placeholder="Ghi chú kết luận kỹ thuật, yêu cầu đổi hàng hoặc lưu ý cho bộ phận Kho khi nhập..."
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              {/* Action Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedPO(null)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.55rem 1.15rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem 1.4rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)' }}
                >
                  <Check size={16} /> Lưu & Phát Hành Biên Bản QA/QC
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: THẨM ĐỊNH HÀNG ĐỔI TRẢ KHÁCH HÀNG (CUSTOMER RMA INSPECTION) */}
      {/* ========================================================================= */}
      {selectedRMA && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '740px', maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={22} style={{ color: '#8b5cf6' }} />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Thẩm Định & Nghiệm Thu Kỹ Thuật RMA: {selectedRMA.id}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Đơn hàng gốc: <strong>#{selectedRMA.orderId || 'N/A'}</strong> • Khách hàng: <strong>{selectedRMA.customerName}</strong> ({selectedRMA.phone})</span>
                </div>
              </div>
              <button onClick={() => setSelectedRMA(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitRmaInspection}>
              
              {/* Product Info Bar */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Linh kiện cần kiểm tra: </span>
                    <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>{getRmaProductName(selectedRMA)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Serial xuất bán: </span>
                    <code style={{ color: '#2563eb', fontWeight: 700, backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>{getRmaSerial(selectedRMA)}</code>
                  </div>
                </div>
                <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px dashed #cbd5e1', color: '#dc2626', fontSize: '0.78rem' }}>
                  Khách báo: <em>"{selectedRMA.reason}"</em> {selectedRMA.description ? `- ${selectedRMA.description}` : ''}
                </div>
              </div>

              {/* BƯỚC 1: ĐỐI SOÁT NGUỒN GỐC & TÌNH TRẠNG TEM BẢO HÀNH */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={17} style={{ color: '#8b5cf6' }} />
                  <span>Bước 1: Đối Soát Nguồn Gốc & Tình Trạng Tem Bảo Hành</span>
                </div>

                {/* Serial Verification Input */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                      Mã Serial thực tế đọc được trên linh kiện (Quét Barcode / Nhập mã):
                    </label>
                    <input
                      type="text"
                      value={actualSerial}
                      onChange={e => setActualSerial(e.target.value)}
                      placeholder="Nhập hoặc quét mã Serial..."
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setActualSerial(getRmaSerial(selectedRMA))}
                      style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✓ Khớp Serial Gốc
                    </button>
                  </div>
                </div>

                {/* 4 Tình trạng Tem Bảo Hành */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.4rem' }}>
                    Tình trạng Tem Bảo Hành & Phương pháp Xác thực:
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[
                      { 
                        key: 'INTACT', 
                        title: '1. Tem Nguyên Vẹn', 
                        desc: 'Tem shop & tem hãng còn nguyên, quét barcode chuẩn', 
                        color: '#16a34a', 
                        bg: '#f0fdf4',
                        border: '#bbf7d0'
                      },
                      { 
                        key: 'SCRATCHED_FIRMWARE_OK', 
                        title: '2. Tem Mờ / Xước (Đọc Laser/BIOS)', 
                        desc: 'Đọc qua mã khắc Laser/Firmware OK -> In cấp lại tem mới', 
                        color: '#b45309', 
                        bg: '#fffbeb',
                        border: '#fde68a'
                      },
                      { 
                        key: 'SHOP_LOST_VENDOR_OK', 
                        title: '3. Mất Tem Shop (Còn Tem Hãng)', 
                        desc: 'Mất tem shop nhưng còn tem hãng -> Gửi Hãng bảo hành', 
                        color: '#c2410c', 
                        bg: '#fff7ed',
                        border: '#fed7aa'
                      },
                      { 
                        key: 'LOST_UNIDENTIFIED', 
                        title: '4. Mất Sạch Tem / Không Thể Định Danh', 
                        desc: 'Tem rách nát, chà xước mất mã -> Từ chối đổi trả', 
                        color: '#dc2626', 
                        bg: '#fef2f2',
                        border: '#fca5a5'
                      }
                    ].map(st => {
                      const active = warrantySealStatus === st.key;
                      return (
                        <button
                          type="button"
                          key={st.key}
                          onClick={() => handleSealStatusChange(st.key)}
                          style={{
                            padding: '0.65rem 0.75rem',
                            borderRadius: '6px',
                            border: active ? `2px solid ${st.color}` : '1px solid #e2e8f0',
                            backgroundColor: active ? st.bg : '#ffffff',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: active ? st.color : '#0f172a' }}>
                            {st.title}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                            {st.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Auto Provenance Feedback Box */}
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  backgroundColor: warrantySealStatus === 'INTACT' ? '#f0fdf4' : warrantySealStatus === 'SCRATCHED_FIRMWARE_OK' ? '#fffbeb' : warrantySealStatus === 'SHOP_LOST_VENDOR_OK' ? '#fff7ed' : '#fef2f2',
                  border: `1px solid ${warrantySealStatus === 'INTACT' ? '#bbf7d0' : warrantySealStatus === 'SCRATCHED_FIRMWARE_OK' ? '#fde68a' : warrantySealStatus === 'SHOP_LOST_VENDOR_OK' ? '#fed7aa' : '#fca5a5'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  {warrantySealStatus === 'INTACT' && (
                    <span style={{ color: '#15803d', fontWeight: 700 }}>
                      <strong>Hợp Lệ Tuyệt Đối:</strong> Linh kiện chính hãng AetherPC xuất bán. Đầy đủ điều kiện đổi mới 1-1 hoặc nhập lại kho.
                    </span>
                  )}
                  {warrantySealStatus === 'SCRATCHED_FIRMWARE_OK' && (
                    <span style={{ color: '#b45309', fontWeight: 700 }}>
                      <strong>Hợp Lệ Thứ Cấp:</strong> Xác thực thành công qua mã khắc Laser / Firmware ROM. <em>(Đã tự động bật cờ: In & Cấp lại tem bảo hành mới sau nghiệm thu)</em>.
                    </span>
                  )}
                  {warrantySealStatus === 'SHOP_LOST_VENDOR_OK' && (
                    <span style={{ color: '#c2410c', fontWeight: 700 }}>
                      <strong>Hợp Lệ Bảo Hành Hãng:</strong> Mất tem shop nhưng còn tem Hãng. Hệ thống tự động chuyển sang luồng <em>"Gửi Hãng Bảo Hành"</em>.
                    </span>
                  )}
                  {warrantySealStatus === 'LOST_UNIDENTIFIED' && (
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>
                      <strong>Không Đủ Điều Kiện:</strong> Mất toàn bộ tem & không thể xác thực nguồn gốc linh kiện. Đề xuất: <em>Từ chối bảo hành đổi trả miễn phí</em>.
                    </span>
                  )}
                </div>

              </div>

              {/* BƯỚC 2: CHẨN ĐOÁN TEST BENCH & NGOẠI QUAN PHẦN CỨNG */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckSquare size={17} style={{ color: '#2563eb' }} />
                  <span>Bước 2: Chẩn Đoán Test Bench & Ngoại Quan Phần Cứng</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={rmaChecklist.cosmeticPass}
                      onChange={e => setRmaChecklist({ ...rmaChecklist, cosmeticPass: e.target.checked })}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>1. Ngoại quan nguyên vẹn: Không nứt mẻ, không cong chân socket CPU, không gãy tụ mạch</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={rmaChecklist.circuitNoBurn}
                      onChange={e => setRmaChecklist({ ...rmaChecklist, circuitNoBurn: e.target.checked })}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>2. Không có dấu hiệu chập cháy IC nguồn, rỉ sét chân tiếp xúc PCIe/RAM do ẩm mốc/vào nước</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={rmaChecklist.testBenchConfirmed}
                      onChange={e => setRmaChecklist({ ...rmaChecklist, testBenchConfirmed: e.target.checked })}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>3. Đã chạy Test Bench chẩn đoán (Xác thực chính xác tình trạng lỗi phần cứng của khách)</span>
                  </label>
                </div>
              </div>

              {/* BƯỚC 3: QUYẾT ĐỊNH XỬ LÝ (RMA VERDICT) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '0.45rem' }}>
                  Bước 3: Quyết Định Thẩm Định Kỹ Thuật (RMA Verdict):
                </label>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {[
                    { key: 'EXCHANGE_NEW', label: 'ĐỔI MỚI 1-1 NGAY', desc: 'Lỗi NSX / Tem hợp lệ trong 30 ngày (Xuất mới)', color: '#16a34a', bg: '#f0fdf4' },
                    { key: 'VENDOR_WARRANTY', label: 'GỬI HÃNG BẢO HÀNH', desc: 'Chuyển TTBH Hãng (ASUS, MSI, Giga...)', color: '#2563eb', bg: '#eff6ff' },
                    { key: 'RESTOCK_WAREHOUSE', label: 'NHẬP LẠI KHO BÁN LẺ', desc: 'Hàng nguyên seal / Khách đổi ý (Hoàn tiền)', color: '#0284c7', bg: '#f0f9ff' },
                    { key: 'REJECT_RMA', label: 'TỪ CHỐI ĐỔI TRẢ', desc: 'Mất tem / Vi phạm điều kiện / Hư hỏng do dùng', color: '#ef4444', bg: '#fef2f2' }
                  ].map(d => {
                    const active = rmaDecision === d.key;
                    return (
                      <button
                        type="button"
                        key={d.key}
                        onClick={() => {
                          setRmaDecision(d.key);
                          if (d.key === 'EXCHANGE_NEW') setRmaDefectType('DOA_FACTORY_DEFECT');
                          else if (d.key === 'REJECT_RMA') setRmaDefectType(warrantySealStatus === 'LOST_UNIDENTIFIED' ? 'SERIAL_WARRANTY_MISSING' : 'USER_PHYSICAL_DAMAGE');
                          else if (d.key === 'RESTOCK_WAREHOUSE') setRmaDefectType('NORMAL_RESTOCK');
                        }}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: active ? `2px solid ${d.color}` : '1px solid #cbd5e1',
                          backgroundColor: active ? d.bg : '#ffffff',
                          color: active ? d.color : '#334155',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>{d.label}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>{d.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Defect Category */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.3rem' }}>
                  Phân Loại Nguyên Nhân Chi Tiết:
                </label>
                <select
                  value={rmaDefectType}
                  onChange={e => setRmaDefectType(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', color: '#0f172a' }}
                >
                  <option value="DOA_FACTORY_DEFECT">Lỗi phần cứng do Nhà Sản Xuất (DOA - Lỗi mạch / Không POST)</option>
                  <option value="USER_PHYSICAL_DAMAGE">Hư hỏng do người dùng (Cong socket CPU / Rơi vỡ / Vào nước)</option>
                  <option value="NORMAL_RESTOCK">Hàng nguyên seal / Khách đổi ý (Đủ điều kiện nhập kho lại)</option>
                  <option value="SERIAL_WARRANTY_MISSING">Rách nát / Mất tem bảo hành / Không thể định danh</option>
                  <option value="ELECTRICAL_POWER_FAIL">Chập nguồn / Sốc điện từ PSU kém chất lượng</option>
                </select>
              </div>

              {/* Photo Proof Upload & Capture Box */}
              <div style={{ marginBottom: '1.25rem', padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>Ảnh Chụp Minh Chứng Ngoại Quan & Tem Seal (Hiển thị cho Khách hàng):</span>
                  </label>
                  {qcProofPhoto && (
                    <button
                      type="button"
                      onClick={() => setQcProofPhoto('')}
                      style={{ fontSize: '0.72rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>

                {qcProofPhoto ? (
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <img
                      src={qcProofPhoto}
                      alt="QC Inspection Proof"
                      style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>Đã có ảnh chụp minh chứng thẩm định</div>
                      <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                        Ảnh này sẽ hiển thị trực tiếp trong mục "Chi Tiết Đơn Hàng" của Khách Hàng để khách yên tâm sản phẩm gửi đi nguyên vẹn.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.85rem',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        border: '1px dashed #93c5fd',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}>
                        <span>Tải Lên / Chụp Ảnh Thực Tế</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => setQcProofPhoto(evt.target.result);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setQcProofPhoto('https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop&q=80')}
                        style={{ padding: '0.45rem 0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.72rem', color: '#475569', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Mẫu 1: Tem Seal Nguyên Vẹn
                      </button>
                      <button
                        type="button"
                        onClick={() => setQcProofPhoto('https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80')}
                        style={{ padding: '0.45rem 0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.72rem', color: '#475569', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Mẫu 2: Kiểm Tra Ngoại Quan
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '0.3rem' }}>
                  Biên Bản & Ghi Chú Kỹ Thuật (Lưu hồ sơ QA & gửi CSKH):
                </label>
                <textarea
                  rows="3"
                  value={rmaNotes}
                  onChange={e => setRmaNotes(e.target.value)}
                  placeholder="Ghi chú chi tiết kết quả test hoặc lý do từ chối..."
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedRMA(null)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ backgroundColor: '#8b5cf6', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 2px 4px rgba(139, 92, 246, 0.25)' }}
                >
                  <Check size={16} /> Lưu & Xuất Biên Bản Thẩm Định RMA
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: XEM CHI TIẾT BIÊN BẢN NGHIỆM THU KỸ THUẬT (ENTERPRISE CERTIFICATE) */}
      {/* ========================================================================= */}
      {viewingLog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '820px', maxHeight: '92vh', overflowY: 'auto', padding: '2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.2)' }}>
            
            {/* Enterprise Certificate Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  AETHER PC ENTERPRISE • HỆ THỐNG QUẢN TRỊ DOANH NGHIỆP ERP
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0.2rem 0' }}>
                  BIÊN BẢN NGHIỆM THU KỸ THUẬT & KIỂM ĐỊNH CHẤT LƯỢNG
                </h2>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Số hiệu: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{viewingLog.id}</strong> • Ngày lập: <strong>{viewingLog.date}</strong>
                </div>
              </div>

              <button onClick={() => setViewingLog(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Section 1: General Info Card */}
            <div style={{ backgroundColor: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Loại Nghiệm Thu: </span>
                  <strong style={{ color: viewingLog.type === 'CUSTOMER_RMA' ? '#8b5cf6' : '#2563eb' }}>
                    {viewingLog.type === 'CUSTOMER_RMA' ? 'THẨM ĐỊNH HÀNG ĐỔI TRẢ KHÁCH (RMA)' : 'NGHIỆM THU HÀNG NHẬP NHÀ CUNG CẤP (PO)'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Mã Đơn Đối Soát: </span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{viewingLog.poNumber || viewingLog.rmaId || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Đối Tượng Đối Tác: </span>
                  <strong style={{ color: '#0f172a' }}>{viewingLog.supplierName || viewingLog.customerName || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Kiểm Định Viên QA/QC: </span>
                  <strong style={{ color: '#0f172a' }}>{viewingLog.inspector}</strong>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Kết Luận Xử Lý: </span>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    backgroundColor: viewingLog.status === 'REJECTED' || viewingLog.status === 'QA_REJECTED' ? '#fee2e2' : viewingLog.status === 'QA_PARTIAL' ? '#ffedd5' : '#dcfce7',
                    color: viewingLog.status === 'REJECTED' || viewingLog.status === 'QA_REJECTED' ? '#dc2626' : viewingLog.status === 'QA_PARTIAL' ? '#c2410c' : '#15803d',
                    border: `1px solid ${viewingLog.status === 'REJECTED' || viewingLog.status === 'QA_REJECTED' ? '#fca5a5' : viewingLog.status === 'QA_PARTIAL' ? '#fed7aa' : '#bbf7d0'}`
                  }}>
                    {viewingLog.decision === 'EXCHANGE_NEW' ? 'DUYỆT ĐỔI MỚI 1-1' : viewingLog.decision === 'VENDOR_WARRANTY' ? 'GỬI HÃNG BẢO HÀNH' : viewingLog.decision === 'RESTOCK_WAREHOUSE' ? 'NHẬP LẠI KHO BÁN LẺ' : viewingLog.decision === 'ACCEPT_ALL' ? 'CHO NHẬP KHO 100%' : viewingLog.decision === 'ACCEPT_PARTIAL' ? 'NHẬP MỘT PHẦN' : 'TỪ CHỐI BẢO HÀNH'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Phân Loại: </span>
                  <strong style={{ color: '#0f172a' }}>{DEFECT_LABELS[viewingLog.defectCategory] || viewingLog.defectCategory || 'Đạt tiêu chuẩn hoàn hảo'}</strong>
                </div>
              </div>
            </div>

            {/* Section 2: Detailed Line Items Table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.84rem', marginBottom: '0.5rem' }}>
                Chi Tiết Kết Quả Kiểm Định Từng Sản Phẩm:
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Tên Sản Phẩm / Model</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Số Lượng Đặt</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Đạt Chuẩn</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Lỗi / Hỏng</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Đánh Giá Ngoại Quan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#0f172a' }}>
                      {viewingLog.productName || (viewingLog.supplierName?.includes('AMD') ? 'CPU AMD Ryzen 7 7800X3D Box Chính Hãng' : viewingLog.supplierName?.includes('Intel') ? 'CPU Intel Core i9-14900K Box' : viewingLog.supplierName?.includes('Anh Ngọc') ? 'VGA MSI GeForce RTX 4060 Ti Ventus 8GB' : 'Linh Kiện Máy Tính')}
                      {viewingLog.serialNumber && <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>SN: {viewingLog.serialNumber}</div>}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                      {viewingLog.totalQty || 1}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 800, color: '#16a34a', backgroundColor: '#f0fdf4' }}>
                      {viewingLog.passedQty ?? viewingLog.totalQty ?? 1}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 800, color: (viewingLog.failedQty > 0) ? '#dc2626' : '#64748b', backgroundColor: (viewingLog.failedQty > 0) ? '#fef2f2' : 'transparent' }}>
                      {viewingLog.failedQty || 0}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                      <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.75rem' }}>
                        Seal nguyên vẹn & Đối soát Serial OK
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Criteria & Notes */}
            <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.3rem' }}>
                Ý Kiến Đánh Giá & Ghi Chú Của Kiểm Định Viên:
              </div>
              <div style={{ color: '#334155', fontStyle: 'italic', lineHeight: 1.5 }}>
                "{viewingLog.notes || 'Lô hàng đã được nghiệm thu kỹ thuật và đối soát tiêu chuẩn chất lượng công ty.'}"
              </div>
            </div>

            {/* Section 4: Signatures Block (For Printing & Audit) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginBottom: '1.5rem', fontSize: '0.78rem' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>ĐẠI DIỆN GIAO HÀNG (NCC)</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '3rem' }}>(Ký, ghi rõ họ tên)</div>
                <div style={{ fontWeight: 600, color: '#475569' }}>{viewingLog.supplierName || 'Đại diện NCC'}</div>
              </div>

              <div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>KIỂM ĐỊNH VIÊN QA/QC</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '3rem' }}>(Ký, ghi rõ họ tên)</div>
                <div style={{ fontWeight: 800, color: '#2563eb' }}>{viewingLog.inspector || 'Nguyễn Văn QC'}</div>
              </div>

              <div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>THỦ KHO TIẾP NHẬN</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '3rem' }}>(Ký, ghi rõ họ tên)</div>
                <div style={{ fontWeight: 600, color: '#475569' }}>Thủ Kho AetherPC</div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <button
                onClick={() => {
                  window.print();
                }}
                style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.55rem 1.15rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={16} /> In Biên Bản Nghiệm Thu
              </button>
              <button
                onClick={() => setViewingLog(null)}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem 1.4rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CHI TIẾT YÊU CẦU ĐỔI TRẢ RMA (KHI NHẤN NÚT "...") */}
      {/* ========================================================================= */}
      {detailRMA && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={22} style={{ color: '#8b5cf6' }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Chi Tiết Phiếu Đổi Trả: {detailRMA.id}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Đơn hàng liên kết: <strong>#{detailRMA.orderId || 'N/A'}</strong></span>
                </div>
              </div>
              <button onClick={() => setDetailRMA(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.82rem' }}>
              
              {/* Status Banner */}
              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                backgroundColor: !detailRMA.status || detailRMA.status === 'PENDING' ? '#fffbeb' : detailRMA.status === 'QC_PASSED' || detailRMA.status === 'APPROVED' ? '#f0fdf4' : detailRMA.status === 'VENDOR_WARRANTY' ? '#fff7ed' : '#fef2f2',
                border: `1px solid ${!detailRMA.status || detailRMA.status === 'PENDING' ? '#fde68a' : detailRMA.status === 'QC_PASSED' || detailRMA.status === 'APPROVED' ? '#bbf7d0' : detailRMA.status === 'VENDOR_WARRANTY' ? '#fed7aa' : '#fca5a5'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: 700, color: '#475569' }}>Trạng Thái Hiện Tại:</span>
                <span style={{
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  color: !detailRMA.status || detailRMA.status === 'PENDING' ? '#b45309' : detailRMA.status === 'QC_PASSED' || detailRMA.status === 'APPROVED' ? '#15803d' : detailRMA.status === 'VENDOR_WARRANTY' ? '#c2410c' : '#dc2626'
                }}>
                  {!detailRMA.status || detailRMA.status === 'PENDING' ? 'CHỜ THẨM ĐỊNH KỸ THUẬT' : detailRMA.status === 'QC_PASSED' || detailRMA.status === 'APPROVED' ? 'ĐÃ DUYỆT ĐỔI MỚI / NHẬP KHO' : detailRMA.status === 'VENDOR_WARRANTY' ? 'CHUYỂN GỬI HÃNG BẢO HÀNH' : 'TỪ CHỐI BẢO HÀNH'}
                </span>
              </div>

              {/* Customer & Product Information */}
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.35rem', marginBottom: '0.2rem' }}>
                  Thông Tin Sản Phẩm & Khách Hàng
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>Khách Hàng: <strong style={{ color: '#0f172a' }}>{detailRMA.customerName || 'Khách vãng lai'}</strong></div>
                  <div>Số Điện Thoại: <strong>{detailRMA.phone || 'N/A'}</strong></div>
                  <div>Email: <strong>{detailRMA.customerEmail || 'N/A'}</strong></div>
                  <div>Mã Đơn Hàng Gốc: <strong>#{detailRMA.orderId || 'N/A'}</strong></div>
                </div>

                <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed #cbd5e1' }}>
                  <div>Linh Kiện Yêu Cầu: <strong style={{ color: '#2563eb' }}>{getRmaProductName(detailRMA)}</strong></div>
                  <div style={{ marginTop: '0.2rem' }}>Mã Serial / IMEI: <code style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', color: '#1e293b', fontWeight: 700 }}>{getRmaSerial(detailRMA)}</code></div>
                </div>
              </div>

              {/* Customer Complaint Details */}
              <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ fontWeight: 800, color: '#dc2626', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem', marginBottom: '0.2rem' }}>
                  Phản Ánh Của Khách Hàng & Minh Chứng
                </div>
                <div>Lý Do Báo Lỗi: <strong style={{ color: '#dc2626' }}>"{detailRMA.reason || 'Sản phẩm có sự cố'}"</strong></div>
                {detailRMA.description && (
                  <div>Nội Dung Chi Tiết: <span style={{ color: '#334155' }}>{detailRMA.description}</span></div>
                )}
                {detailRMA.evidenceUrl ? (
                  <div style={{ marginTop: '0.35rem' }}>
                    <a 
                      href={detailRMA.evidenceUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ 
                        color: '#2563eb', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.3rem', 
                        fontWeight: 700,
                        backgroundColor: '#eff6ff',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #bfdbfe',
                        textDecoration: 'none'
                      }}
                    >
                      <ExternalLink size={14} /> Mở xem hình ảnh / video minh chứng từ khách hàng
                    </a>
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.78rem' }}>Không có tệp đính kèm video/hình ảnh</div>
                )}
              </div>

              {/* Inspection Resolution If Any */}
              {detailRMA.resolution && (
                <div style={{ backgroundColor: '#f0fdf4', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#15803d' }}>
                  <div style={{ fontWeight: 800, marginBottom: '0.2rem' }}>Kết Quả Nghiệm Thu Kỹ Thuật QC:</div>
                  <div style={{ color: '#334155', fontWeight: 600 }}>{detailRMA.resolution}</div>
                </div>
              )}

            </div>

            {/* Action Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <button
                onClick={() => window.print()}
                style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Printer size={15} /> In Phiếu
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(!detailRMA.status || detailRMA.status === 'PENDING') ? (
                  <button
                    onClick={() => {
                      const rmaToInspect = detailRMA;
                      setDetailRMA(null);
                      handleOpenRmaInspection(rmaToInspect);
                    }}
                    style={{
                      backgroundColor: '#8b5cf6',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.5rem 1.15rem',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      boxShadow: '0 2px 4px rgba(139, 92, 246, 0.25)'
                    }}
                  >
                    <ShieldCheck size={16} /> Thẩm Định Kỹ Thuật
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const rmaId = detailRMA.id;
                      const orderId = detailRMA.orderId;
                      setDetailRMA(null);
                      const log = qaLogs.find(l => l.rmaId === rmaId || l.poNumber === orderId);
                      if (log) setViewingLog(log);
                      else notify(`Phiếu ${rmaId} đã hoàn tất: ${detailRMA.resolution || 'Đã đóng'}`, 'info');
                    }}
                    style={{
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <FileText size={15} /> Xem Hồ Sơ Biên Bản QA
                  </button>
                )}

                <button
                  onClick={() => setDetailRMA(null)}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Đóng
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: THẨM ĐỊNH TEM SEAL & NGOẠI QUAN KIỆN HÀNG HOÀN VỀ (RESTOCK QA) */}
      {/* ========================================================================= */}
      {selectedRestockOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1.15rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={20} style={{ color: '#16a34a' }} />
                  <span>Thẩm Định Tem Seal & Ngoại Quan Kiện Hàng Hoàn Về</span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                  Kiểm tra tính nguyên vẹn của tem niêm phong và vỏ hộp trước khi quyết định cộng tồn kho ERP
                </p>
              </div>
              <button
                onClick={() => setSelectedRestockOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitRestockInspection}>
              {/* Order Info Card */}
              <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 800, color: '#ea580c', fontSize: '0.9rem' }}>
                    Đơn Hàng: #{selectedRestockOrder.orderId || selectedRestockOrder.id}
                  </span>
                  <span style={{ backgroundColor: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                    HÀNG BOM / HỦY GIAO HOÀN
                  </span>
                </div>
                <div style={{ color: '#334155', marginBottom: '0.25rem' }}>
                  <strong>Khách nhận:</strong> {selectedRestockOrder.customerName} ({selectedRestockOrder.phone})
                </div>
                <div style={{ color: '#dc2626', fontWeight: 700 }}>
                  <strong>Lý do chuyển hoàn:</strong> {selectedRestockOrder.returnReason || selectedRestockOrder.failReason || 'Khách từ chối nhận hàng'}
                </div>
              </div>

              {/* Items in Package */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: '#334155', marginBottom: '0.4rem' }}>
                  Danh Sách Linh Kiện Trong Kiện Hàng:
                </label>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  {(selectedRestockOrder.items || []).map((it, idx) => (
                    <div key={idx} style={{ padding: '0.55rem 0.75rem', borderBottom: idx < (selectedRestockOrder.items.length - 1) ? '1px solid #f1f5f9' : 'none', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {it.name || it.productName || 'Linh kiện PC'}
                      </span>
                      <span style={{ fontWeight: 800, color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                        SL: {it.quantity || 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Physical & Seal Inspection Checklist */}
              <div style={{ marginBottom: '1.15rem', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: '#0f172a', marginBottom: '0.5rem' }}>
                  Checklist Kiểm Tra Tem Niêm Phong & Ngoại Quan (Bắt buộc):
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8rem', color: '#334155' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={restockChecklist.sealIntact}
                      onChange={e => setRestockChecklist(prev => ({ ...prev, sealIntact: e.target.checked }))}
                    />
                    <span><strong>Tem seal niêm phong nguyên vẹn:</strong> Không có dấu hiệu bóc, rách hoặc cạy mở hộp.</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={restockChecklist.boxUnopened}
                      onChange={e => setRestockChecklist(prev => ({ ...prev, boxUnopened: e.target.checked }))}
                    />
                    <span><strong>Vỏ hộp không rách rưới / biến dạng:</strong> Ngoại quan hộp đạt tiêu chuẩn thẩm mỹ.</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={restockChecklist.accessoriesComplete}
                      onChange={e => setRestockChecklist(prev => ({ ...prev, accessoriesComplete: e.target.checked }))}
                    />
                    <span><strong>Đầy đủ phụ kiện & sách hướng dẫn:</strong> Nguyên đai nguyên kiện như khi xuất kho.</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={restockChecklist.noWaterDrop}
                      onChange={e => setRestockChecklist(prev => ({ ...prev, noWaterDrop: e.target.checked }))}
                    />
                    <span><strong>Không bị ngấm nước / ẩm mốc:</strong> Kiện hàng khô ráo hoàn toàn khi nhận về từ Shipper.</span>
                  </label>
                </div>
              </div>

              {/* QC Restock Decision */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 750, color: '#0f172a', marginBottom: '0.45rem' }}>
                  Quyết Định Xử Lý & Nhập Kho:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: restockCondition === 'PERFECT_SEAL' ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                    backgroundColor: restockCondition === 'PERFECT_SEAL' ? '#f0fdf4' : '#ffffff',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="restockCondition"
                      value="PERFECT_SEAL"
                      checked={restockCondition === 'PERFECT_SEAL'}
                      onChange={() => setRestockCondition('PERFECT_SEAL')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ color: '#15803d', fontSize: '0.82rem' }}>ĐẠT CHUẨN 100% → NHẬP LẠI KHO BÁN MỚI (RESTOCK NEW)</strong>
                      <div style={{ fontSize: '0.74rem', color: '#4b5563' }}>Tem seal hoàn hảo. Tự động cộng lại số lượng vào Tồn Kho Bán Lẻ ERP ngay lập tức.</div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: restockCondition === 'DENTED_BOX_OUTLET' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                    backgroundColor: restockCondition === 'DENTED_BOX_OUTLET' ? '#fff7ed' : '#ffffff',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="restockCondition"
                      value="DENTED_BOX_OUTLET"
                      checked={restockCondition === 'DENTED_BOX_OUTLET'}
                      onChange={() => setRestockCondition('DENTED_BOX_OUTLET')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ color: '#c2410c', fontSize: '0.82rem' }}>MÓP VỎ HỘP NHẸ → NHẬP KHO THANH LÝ / OPEN-BOX (OUTLET)</strong>
                      <div style={{ fontSize: '0.74rem', color: '#4b5563' }}>Linh kiện bên trong nguyên vẹn nhưng vỏ hộp trầy xước/móp nhẹ khi vận chuyển.</div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: restockCondition === 'DAMAGED_CARRIER' ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                    backgroundColor: restockCondition === 'DAMAGED_CARRIER' ? '#fef2f2' : '#ffffff',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="restockCondition"
                      value="DAMAGED_CARRIER"
                      checked={restockCondition === 'DAMAGED_CARRIER'}
                      onChange={() => setRestockCondition('DAMAGED_CARRIER')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ color: '#b91c1c', fontSize: '0.82rem' }}>HƯ HỎNG / RÁCH SEAL DO VẬN CHUYỂN → LẬP BIÊN BẢN BỒI THƯỜNG</strong>
                      <div style={{ fontSize: '0.74rem', color: '#4b5563' }}>Không nhập vào tồn bán mới. Chuyển vào Kho Chờ Xử Lý Bồi Thường với Đơn vị vận chuyển (Shipper/3PL).</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Inspection Notes */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                  Ghi chú thẩm định của Chuyên viên QC:
                </label>
                <textarea
                  value={restockNotes}
                  onChange={e => setRestockNotes(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedRestockOrder(null)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: restockCondition === 'DAMAGED_CARRIER' ? '#dc2626' : '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: restockCondition === 'DAMAGED_CARRIER' ? '0 2px 4px rgba(220,38,38,0.25)' : '0 2px 4px rgba(22,163,74,0.25)'
                  }}
                >
                  <CheckCircle size={16} /> Xác Nhận & Cập Nhật Tồn Kho ERP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: LỊCH SỬ THAY ĐỔI & VẾT LUÂN CHUYỂN ĐƠN HÀNG (HISTORY & AUDIT TRAIL) */}
      {/* ========================================================================= */}
      {selectedHistoryOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={20} style={{ color: '#2563eb' }} />
                  <span>Lịch Sử Thay Đổi & Vết Luân Chuyển Đơn Hàng</span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                  Theo dõi hành trình luân chuyển thực tế từ lúc tạo đơn, bàn giao shipper, sự cố đến khi hoàn kho
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Order Overview Summary */}
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#2563eb' }}>
                  #{selectedHistoryOrder.orderId || selectedHistoryOrder.id}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                  Khách: <strong>{selectedHistoryOrder.customerName}</strong> ({selectedHistoryOrder.phone})
                </div>
              </div>
              <span style={{
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 800,
                backgroundColor: '#ffedd5',
                color: '#c2410c',
                border: '1px solid #fdba74'
              }}>
                ĐANG CHUYỂN HOÀN KHO
              </span>
            </div>

            {/* Visual Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', paddingLeft: '0.5rem', marginBottom: '1.25rem' }}>
              
              {/* Step 1: Created */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, flexShrink: 0 }}>
                  1
                </div>
                <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.65rem 0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Tạo Đơn Hàng Thành Công</strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {selectedHistoryOrder.createdAt ? new Date(selectedHistoryOrder.createdAt).toLocaleDateString('vi-VN') : 'Hôm nay'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>
                    Đơn hàng được ghi nhận vào hệ thống ERP. Hình thức: {selectedHistoryOrder.paymentMethod === 'VNPAY' ? 'Đã thanh toán Online' : 'Thu hộ COD khi nhận'}.
                  </div>
                </div>
              </div>

              {/* Step 2: Dispatched to Shipper */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, flexShrink: 0 }}>
                  2
                </div>
                <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.65rem 0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#15803d' }}>Xuất Kho & Bàn Giao Shipper</strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {selectedHistoryOrder.dispatchedAt ? new Date(selectedHistoryOrder.dispatchedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Đã xuất kho'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>
                    Thủ kho đã đóng gói dán tem niêm phong và bàn giao cho Shipper đi giao trên tuyến đường.
                  </div>
                </div>
              </div>

              {/* Step 3: Failed / Customer Rejected */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, flexShrink: 0 }}>
                  3
                </div>
                <div style={{ flex: 1, backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.65rem 0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#b91c1c' }}>Giao Không Thành Công / Báo Sự Cố</strong>
                    <span style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 700 }}>Báo Lỗi Vận Chuyển</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#7f1d1d', marginTop: '2px' }}>
                    Lý do: <strong>{selectedHistoryOrder.failReason || selectedHistoryOrder.returnReason || 'Khách từ chối nhận hàng (Bom hàng / Đổi ý)'}</strong>
                    {selectedHistoryOrder.failNote ? ` • Ghi chú: "${selectedHistoryOrder.failNote}"` : ''}
                  </div>
                </div>
              </div>

              {/* Step 4: Returning to Warehouse */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#ffedd5', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, flexShrink: 0 }}>
                  4
                </div>
                <div style={{ flex: 1, backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '0.65rem 0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#c2410c' }}>Shipper Xác Nhận Chuyển Hoàn Về Kho</strong>
                    <span style={{ fontSize: '0.72rem', color: '#9a3412', fontWeight: 700 }}>Đang Xử Lý</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#9a3412', marginTop: '2px' }}>
                    Shipper giữ kiện hàng mang về bàn giao lại cho Bộ phận Kiểm Định Chất Lượng (QC) & Thủ Kho.
                  </div>
                </div>
              </div>

              {/* Step 5: QC Restock Inspection */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, flexShrink: 0 }}>
                  5
                </div>
                <div style={{ flex: 1, backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '0.65rem 0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#475569' }}>QC Thẩm Định Tem Seal & Cập Nhật Tồn Kho</strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Bước Kế Tiếp</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                    Bấm <strong>[Thẩm Định Tem & Nhập Kho]</strong> để kiểm tra 4 tiêu chuẩn seal và hoàn trả số lượng linh kiện vào Tồn Kho ERP.
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                onClick={() => setSelectedHistoryOrder(null)}
                style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.55rem 1.25rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. IN-APP TOAST NOTIFICATION BANNER */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          backgroundColor: toastMessage.type === 'error' ? '#ef4444' : toastMessage.type === 'warning' ? '#f59e0b' : '#10b981',
          color: '#ffffff',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          maxWidth: '450px',
          transition: 'all 0.3s ease-in-out'
        }}>
          {toastMessage.type === 'error' ? <AlertCircle size={22} /> : toastMessage.type === 'warning' ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{toastMessage.title}</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.95, marginTop: '2px' }}>{toastMessage.text}</div>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', opacity: 0.8, padding: '2px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

    </div>
  );
}
