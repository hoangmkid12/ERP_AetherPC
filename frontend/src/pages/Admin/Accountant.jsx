import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFinanceStore, useHRStore, useSalesStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { notify, confirm } from '../../context/NotificationContext';
import { PO_STATUS, VENDOR_BILL_STATUS, getStatusInfo } from '../../utils/statusLabels';
import { 
  DollarSign, ArrowUpRight, ArrowDownLeft, FileText, CheckCircle, ShoppingBag, 
  Search, PlusCircle, Download, X, Eye, Printer, Calendar, CreditCard, Users, 
  Building2, ArrowRightLeft, ShieldCheck, Check, RefreshCw, FileCheck, PieChart, TrendingUp, Filter, AlertTriangle, Send
} from 'lucide-react';
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

export default function Accountant() {
  const { user, isCEO } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = new Date();
  
  // Active Tab from URL (?tab=overview|ledger|po_payments|payroll_disbursement|reports)
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab = (tKey) => {
    setSearchParams({ tab: tKey });
    setSearch('');
  };

  const orders = useSalesStore(state => state.orders) || [];
  const getOrders = useSalesStore(state => state.getOrders);
  const ledger = useFinanceStore(state => state.ledger) || [];
  const getLedger = useFinanceStore(state => state.getLedger);
  const purchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];
  const addLedgerEntry = useFinanceStore(state => state.addLedgerEntry);
  const disbursePayroll = useFinanceStore(state => state.disbursePayroll);
  const disburseAllPayrolls = useFinanceStore(state => state.disburseAllPayrolls);
  const employees = useHRStore(state => state.employees) || [];
  const getEmployees = useHRStore(state => state.getEmployees);
  const payrolls = useHRStore(state => state.payrolls) || [];
  const getPayrolls = useHRStore(state => state.getPayrolls);
  const returnRequests = useSalesStore(state => state.returnRequests) || [];
  const updateReturnStatus = useSalesStore(state => state.updateReturnStatus);
  const getReturnRequests = useSalesStore(state => state.getReturnRequests);

  const [allPOs, setAllPOs] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  
  // Manual Entry Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    type: 'EXPENSE',
    amount: '',
    category: 'Vận hành văn phòng',
    description: ''
  });

  // Refund Modals State
  const [refundModalItem, setRefundModalItem] = useState(null);
  const [refundTxnCode, setRefundTxnCode] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [refundProofPhoto, setRefundProofPhoto] = useState('');
  const [sourceAccount, setSourceAccount] = useState('VCB_9988776655');
  const [qrModalItem, setQrModalItem] = useState(null);
  const [viewingRefundVoucher, setViewingRefundVoucher] = useState(null);
  const [viewingRefundProof, setViewingRefundProof] = useState(null);

  // Selected details
  const [viewingTxDetail, setViewingTxDetail] = useState(null);
  const [viewingPODetail, setViewingPODetail] = useState(null);

  const fetchBackendPOs = async () => {
    try {
      const res = await api.get('/purchasing/orders');
      if (res && res.success) {
        setAllPOs(res.data || []);
      }
    } catch (e) {
      console.warn('Accountant PO fetch error:', e);
    }
  };

  const fetchLedgerData = async () => {
    if (typeof getLedger !== 'function') return;
    setLoadingLedger(true);
    try {
      await getLedger();
    } catch (e) {
      console.warn('Accountant ledger fetch error:', e);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    fetchBackendPOs();
    fetchLedgerData();
    if (typeof getOrders === 'function') getOrders().catch(() => {});
    if (typeof getReturnRequests === 'function') getReturnRequests().catch(() => {});
    if (typeof getPayrolls === 'function') getPayrolls().catch(() => {});
    if (typeof getEmployees === 'function') getEmployees().catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedgerData();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchBackendPOs();
  }, [purchaseOrders]);

  const formatLedgerDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return dateStr;
    }
  };

  const fmt = (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0);

  // A PO can only be billed once the warehouse has actually received the goods —
  // matches the backend gate in createVendorBill (purchase.controller.js).
  const isPoBillable = (po) => ['RECEIVED', 'DONE', 'COMPLETED'].includes(po?.status);
  const getPoBill = (po) => (Array.isArray(po?.bills) && po.bills.length > 0 ? po.bills[0] : null);
  const isPoAwaitingAccounting = (po) => {
    if (!isPoBillable(po)) return false;
    const bill = getPoBill(po);
    return !bill || bill.status !== 'PAID';
  };

  // Financial Metric Calculations
  // Doanh thu = tổng Order.totalAmount thật, KHÔNG lấy từ bút toán INCOME trên sổ
  // cái — hiện chưa có luồng backend nào tự ghi INCOME cho đơn hàng bán ra, nên
  // dùng ledger làm nguồn doanh thu sẽ luôn ra gần 0 trừ khi Kế Toán tự tay nhập
  // "Thêm Phiếu Thu". Đơn đã HỦY/giao thất bại không tính là doanh thu.
  const totalRevenue = (orders || [])
    .filter(o => o && !['CANCELLED', 'FAILED_DELIVERY'].includes(o.status))
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  const effectivePOs = allPOs.length > 0 ? allPOs : purchaseOrders;
  const unpaidPOs = effectivePOs.filter(po => po && isPoAwaitingAccounting(po));
  const unpaidPOAmount = unpaidPOs.reduce((sum, po) => {
    const bill = getPoBill(po);
    return sum + (Number((bill ? bill.amountDue : po.totalAmount) || 0) || 0);
  }, 0);

  const totalPayrollFund = payrolls.length > 0
    ? payrolls.reduce((sum, p) => sum + (Number(p.netSalary || 0) || 0), 0)
    : employees.reduce((s, e) => s + (Number(e.salary || e.baseSalary || 8500000) || 8500000), 0);

  // Giá vốn hàng bán (COGS) = tổng các bút toán COGS thật do backend tự ghi mỗi
  // khi một đơn hàng thực sự xuất kho (referenceId `COGS-{orderId}`), tính theo
  // giá bình quân gia quyền (Product.averageCost) tại thời điểm bán — xem
  // orderApprovalService.js / order.controller.js. KHÔNG dùng tổng tiền mua NCC
  // (VendorBill.amountTotal) như trước — đó là chi phí NHẬP hàng trong kỳ, không
  // phải chi phí của phần hàng đã thực sự BÁN ra trong kỳ (mua 1000 SP, bán 10 SP
  // vẫn chỉ tính giá vốn cho 10 SP đã bán). Đơn bị hủy/giao thất bại sẽ tự động bị
  // xóa bút toán COGS tương ứng (xem updateOrderStatus), khớp với việc doanh thu
  // của đơn đó cũng bị loại khỏi totalRevenue.
  const cogsAmount = (ledger || [])
    .filter(tx => tx && tx.type === 'EXPENSE' && typeof tx.referenceId === 'string' && tx.referenceId.startsWith('COGS-'))
    .reduce((sum, tx) => sum + (Number(tx.amount || 0) || 0), 0);

  // Chi phí vận hành = các bút toán chi thủ công thật (Thêm Phiếu Thu/Chi) — nhận
  // diện qua việc không có referenceId (mọi bút toán hệ thống tự ghi — thanh toán
  // NCC, chi lương, hoàn tiền — đều luôn có referenceId). Trước đây là số hardcode
  // "5.000.000 ₫" cố định, không phản ánh chi phí thật.
  const operatingExpense = (ledger || [])
    .filter(tx => tx && tx.type === 'EXPENSE' && !tx.referenceId)
    .reduce((sum, tx) => sum + (Number(tx.amount || 0) || 0), 0);

  // Tiền hoàn cho khách (REFUND) cũng là một khoản chi thật, phải trừ vào lợi nhuận.
  const refundAmount = (ledger || [])
    .filter(tx => tx && tx.type === 'REFUND')
    .reduce((sum, tx) => sum + (Number(tx.amount || 0) || 0), 0);

  // Tổng chi phí = đúng bằng tổng 4 dòng chi trong P&L bên dưới — không tính lại
  // riêng từ ledger nữa để tránh 2 nơi ra 2 con số khác nhau cho cùng 1 khái niệm.
  const totalExpense = cogsAmount + totalPayrollFund + operatingExpense + refundAmount;

  const netProfit = totalRevenue - totalExpense;
  // Không có module vốn chủ sở hữu/số dư đầu kỳ thật trong hệ thống — không bịa
  // "vốn góp ban đầu". Số dư lũy kế chỉ phản ánh đúng lợi nhuận ròng tích lũy.
  const cashBalance = netProfit;

  const stats = [
    { label: 'Tổng Doanh Thu Bán Hàng', value: fmt(totalRevenue), change: 'Bao gồm POS & Website Online', icon: <ArrowUpRight size={20} />, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Tổng Chi Phí Hoạt Động', value: fmt(totalExpense), change: 'Giá vốn, lương & mua linh kiện', icon: <ArrowDownLeft size={20} />, color: '#ef4444', bg: '#fef2f2' },
    { label: 'Lợi Nhuận Ròng', value: fmt(netProfit), change: netProfit >= 0 ? 'Tỷ suất lợi nhuận dương' : 'Cần tối ưu chi phí', icon: <DollarSign size={20} />, color: netProfit >= 0 ? '#16a34a' : '#ef4444', bg: netProfit >= 0 ? '#f0fdf4' : '#fef2f2' },
    { label: 'Lợi Nhuận Ròng Lũy Kế', value: fmt(cashBalance), change: 'Chưa gồm vốn góp ban đầu (không có module vốn chủ sở hữu)', icon: <CreditCard size={20} />, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Đơn PO Chờ Thanh Toán NCC', value: `${unpaidPOs.length} đơn (${fmt(unpaidPOAmount)})`, change: 'Cần giải ngân cho Nhà Cung Cấp', icon: <ShoppingBag size={20} />, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Quỹ Lương Chờ Chi Trả', value: fmt(totalPayrollFund), change: 'Dự toán kỳ lương tháng hiện tại', icon: <Users size={20} />, color: '#8b5cf6', bg: '#f5f3ff' }
  ];

  // Chart 1: Income vs Expense Doughnut
  const cashFlowChartData = {
    labels: ['Doanh Thu Bán Hàng', 'Giá Vốn Hàng Bán', 'Chi Lương Nhân Sự', 'Chi Phí Vận Hành Khác'],
    datasets: [
      {
        data: [
          Math.max(1, totalRevenue),
          Math.max(1, cogsAmount),
          Math.max(1, totalPayrollFund),
          Math.max(1, operatingExpense)
        ],
        backgroundColor: ['#16a34a', '#f59e0b', '#8b5cf6', '#ef4444']
      }
    ]
  };

  // Chart 2: Monthly Revenue & Expense Bar — real monthly buckets from actual Order
  // dates (revenue) and Ledger EXPENSE/REFUND dates (expense) for the last 8 calendar
  // months. A month with no real activity shows 0, never an invented figure.
  const monthlyFinanceBuckets = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: `T${d.getMonth() + 1}${i === 0 ? ' (Hiện tại)' : ''}`, revenue: 0, expense: 0 });
    }
    const bucketIndex = {};
    buckets.forEach((b, idx) => { bucketIndex[b.key] = idx; });

    (orders || []).forEach(o => {
      if (!o || ['CANCELLED', 'FAILED_DELIVERY'].includes(o.status)) return;
      const raw = o.date || o.createdAt;
      const d = raw ? new Date(raw) : null;
      if (!d || isNaN(d.getTime())) return;
      const idx = bucketIndex[`${d.getFullYear()}-${d.getMonth()}`];
      if (idx !== undefined) buckets[idx].revenue += (Number(o.totalAmount) || 0);
    });

    (ledger || []).forEach(tx => {
      if (!tx || (tx.type !== 'EXPENSE' && tx.type !== 'REFUND')) return;
      const d = tx.date ? new Date(tx.date) : null;
      if (!d || isNaN(d.getTime())) return;
      const idx = bucketIndex[`${d.getFullYear()}-${d.getMonth()}`];
      if (idx !== undefined) buckets[idx].expense += (Number(tx.amount) || 0);
    });

    return buckets;
  }, [orders, ledger]);

  const monthlyFinanceData = {
    labels: monthlyFinanceBuckets.map(b => b.label),
    datasets: [
      {
        label: 'Doanh Thu (Triệu VNĐ)',
        data: monthlyFinanceBuckets.map(b => Number((b.revenue / 1000000).toFixed(1))),
        backgroundColor: '#16a34a'
      },
      {
        label: 'Chi Phí (Triệu VNĐ)',
        data: monthlyFinanceBuckets.map(b => Number((b.expense / 1000000).toFixed(1))),
        backgroundColor: '#ef4444'
      }
    ]
  };

  // Filtered Ledger Entries
  const filteredLedger = useMemo(() => {
    return (ledger || []).filter(tx => {
      if (!tx) return false;
      const q = search.toLowerCase();
      const matchSearch = !search || 
        tx.description?.toLowerCase().includes(q) || 
        tx.referenceId?.toLowerCase().includes(q) || 
        tx.type?.toLowerCase().includes(q);
      
      let matchType = true;
      if (typeFilter === 'INCOME') {
        matchType = tx.type === 'INCOME';
      } else if (typeFilter === 'EXPENSE') {
        matchType = tx.type === 'EXPENSE' || tx.type === 'REFUND';
      } else if (typeFilter === 'EXPENSE_PAYROLL') {
        matchType = tx.type === 'EXPENSE' && (tx.referenceId?.startsWith('PAYROLL-') || tx.description?.toLowerCase().includes('lương'));
      } else if (typeFilter === 'REFUND') {
        matchType = tx.type === 'REFUND' || tx.referenceId?.startsWith('REFUND-') || tx.description?.toLowerCase().includes('hoàn tiền');
      }
      return matchSearch && matchType;
    });
  }, [ledger, search, typeFilter]);

  const [submittingManualEntry, setSubmittingManualEntry] = useState(false);
  const handleAddManualEntry = async () => {
    if (!manualForm.amount || !manualForm.description) {
      notify('Vui lòng nhập số tiền và nội dung thu/chi!', 'error');
      return;
    }
    const amt = parseInt(manualForm.amount, 10);
    if (isNaN(amt) || amt <= 0) {
      notify('Số tiền không hợp lệ!', 'error');
      return;
    }
    if (typeof addLedgerEntry !== 'function') return;
    setSubmittingManualEntry(true);
    try {
      await addLedgerEntry({
        type: manualForm.type,
        amount: amt,
        description: manualForm.description,
        category: manualForm.category,
        date: new Date().toLocaleDateString('vi-VN')
      });
      setManualForm({ type: 'EXPENSE', amount: '', category: 'Vận hành văn phòng', description: '' });
      setShowManualModal(false);
      notify('Đã thêm bút toán vào Sổ Cái thành công.', 'success');
    } catch (err) {
      notify(`Không thể ghi bút toán: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setSubmittingManualEntry(false);
    }
  };

  const [payingPOId, setPayingPOId] = useState(null);
  const [disbursingPayrollId, setDisbursingPayrollId] = useState(null);

  const handleCreateBill = async (po) => {
    if (!(await confirm(`Xác nhận lập hóa đơn công nợ cho Đơn Mua Hàng ${po.poNumber || po.id}?\nSố tiền sẽ được đối chiếu theo tỷ lệ nghiệm thu QC (nếu có) trước khi chốt.`))) return;
    setPayingPOId(po.id);
    try {
      const res = await api.post(`/purchasing/orders/${po.id}/bills`, {});
      if (res?.success) {
        const adj = res.qcAdjustment;
        notify(
          adj
            ? `Đã lập hóa đơn ${res.data.billNumber} — điều chỉnh theo QC còn ${fmt(res.data.amountTotal)} (thay vì ${fmt(adj.originalAmount)}).`
            : `Đã lập hóa đơn ${res.data.billNumber} cho ${fmt(res.data.amountTotal)}.`,
          'success'
        );
        await fetchBackendPOs();
      } else {
        notify(res?.message || 'Không thể lập hóa đơn — máy chủ từ chối yêu cầu.', 'error');
      }
    } catch (err) {
      notify(`Lập hóa đơn thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setPayingPOId(null);
    }
  };

  const handleRegisterPayment = async (po) => {
    const bill = getPoBill(po);
    if (!bill) return;
    if (!(await confirm(`Xác nhận chi trả ${fmt(bill.amountDue)} cho hóa đơn ${bill.billNumber} (NCC: ${po.supplier?.name || po.supplierCode})?`))) return;
    setPayingPOId(po.id);
    try {
      const res = await api.post(`/purchasing/bills/${bill.id}/payments`, { paymentMethod: 'Bank Transfer' });
      if (res?.success) {
        notify(`Đã giải ngân thành công cho hóa đơn ${bill.billNumber}. Bút toán đã được ghi nhận vào Sổ Cái.`, 'success');
        await fetchBackendPOs();
        await fetchLedgerData();
      } else {
        notify(res?.message || 'Không thể ghi nhận thanh toán — máy chủ từ chối yêu cầu.', 'error');
      }
    } catch (err) {
      notify(`Thanh toán thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setPayingPOId(null);
    }
  };

  const allReturnRequests = useMemo(() => {
    let localReturns = [];
    try { localReturns = JSON.parse(localStorage.getItem('erp_return_requests') || '[]'); } catch (_) {}
    const retMap = new Map();
    (returnRequests || []).forEach(r => { const k = String(r.id || r.orderId || ''); if (k) retMap.set(k, r); });
    localReturns.forEach(r => { const k = String(r.id || r.orderId || ''); if (k) retMap.set(k, { ...retMap.get(k), ...r }); });
    return Array.from(retMap.values());
  }, [returnRequests]);

  const refundReturnRequests = useMemo(() => {
    return allReturnRequests.filter(r => {
      // 1. Loại trừ đơn Đổi hàng (EXCHANGE / Đổi mới 1-1 / Không hoàn tiền)
      const isExchange = r.type === 'EXCHANGE' || 
        r.resolution === 'EXCHANGE_NEW' || 
        r.action === 'EXCHANGE' || 
        Boolean(r.replacementOrderId) || 
        r.isExchange === true;
      if (isExchange) return false;

      // 2. Bắt buộc phải có số tiền hoàn lớn hơn 0
      const refundAmount = parseFloat(r.refundAmount || r.totalAmount || 0);
      if (isNaN(refundAmount) || refundAmount <= 0) return false;

      // 3. Loại trừ đơn bị Từ chối hoặc Đã chuyển đổi mới
      if (['REJECTED', 'REJECT_RMA', 'EXCHANGED'].includes(r.status)) return false;

      // 4. Chỉ nhận đơn có hình thức REFUND hoặc hoàn tiền hợp lệ
      return r.type === 'REFUND' || !r.type || r.isRefund;
    });
  }, [allReturnRequests]);

  const [refundSearch, setRefundSearch] = useState('');
  const [refundStatusFilter, setRefundStatusFilter] = useState('ALL');

  const pendingRefunds = refundReturnRequests.filter(r => r.status !== 'REFUNDED');
  const pendingRefundTotal = pendingRefunds.reduce((sum, r) => sum + (parseFloat(r.refundAmount || r.totalAmount || 0)), 0);
  const completedRefunds = refundReturnRequests.filter(r => r.status === 'REFUNDED');
  const completedRefundTotal = completedRefunds.reduce((sum, r) => sum + (parseFloat(r.refundAmount || r.totalAmount || 0)), 0);

  const filteredRefunds = useMemo(() => {
    return refundReturnRequests.filter(r => {
      if (refundStatusFilter === 'PENDING' && r.status === 'REFUNDED') return false;
      if (refundStatusFilter === 'REFUNDED' && r.status !== 'REFUNDED') return false;

      if (!refundSearch.trim()) return true;
      const q = refundSearch.trim().toLowerCase();
      return (
        String(r.id || '').toLowerCase().includes(q) ||
        String(r.orderId || '').toLowerCase().includes(q) ||
        String(r.customerName || '').toLowerCase().includes(q) ||
        String(r.phone || '').toLowerCase().includes(q) ||
        String(r.bankAccountNo || '').toLowerCase().includes(q) ||
        String(r.bankName || '').toLowerCase().includes(q)
      );
    });
  }, [refundReturnRequests, refundStatusFilter, refundSearch]);

  const handleConfirmRefund = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!refundModalItem) return;

    try {
      const finalAmount = parseFloat(refundModalItem.refundAmount || refundModalItem.totalAmount || 0);
      const effectiveProofPhoto = refundProofPhoto || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80';
      const txnCode = refundTxnCode ? refundTxnCode.trim() : `FT${Date.now().toString().slice(-8)}`;
      const operatorName = user?.fullname || user?.username || 'Trần Kế Toán (Kế Toán)';

      const extraRefundData = {
        refundMethod: 'BANK_TRANSFER',
        refundAmount: finalAmount,
        refundTxnCode: txnCode,
        refundProofPhoto: effectiveProofPhoto,
        sourceAccount: sourceAccount,
        refundedAt: new Date().toISOString(),
        refundedByName: operatorName,
        note: refundNote.trim() || `Kế toán đã giải ngân chuyển khoản ${fmt(finalAmount)} thành công qua Napas247`
      };

      // KHÔNG được nuốt lỗi ở đây — hoàn tiền là hành động tài chính, nếu
      // updateReturnStatus (PATCH /orders/returns/:id/refund thật) thất bại,
      // phải dừng lại và báo lỗi thật, chứ không được tiếp tục hiện "thành
      // công" như thể tiền đã hoàn và sổ cái đã ghi trong khi thực tế thì
      // chưa — lỗi này trước đây bị try/catch nội bộ nuốt mất.
      if (typeof updateReturnStatus !== 'function') {
        throw new Error('Chức năng cập nhật trạng thái hoàn tiền không khả dụng.');
      }
      await updateReturnStatus(refundModalItem.orderId || refundModalItem.id, 'REFUNDED', extraRefundData);

      // Sync local list
      let localList = [];
      try {
        localList = JSON.parse(localStorage.getItem('erp_return_requests') || '[]');
      } catch (_) {
        localList = [];
      }
      
      const targetId = String(refundModalItem.id || '');
      const targetOrder = String(refundModalItem.orderId || '');
      let found = false;

      const updatedList = localList.map(r => {
        if ((targetId && String(r.id) === targetId) || (targetOrder && String(r.orderId) === targetOrder)) {
          found = true;
          return { ...r, status: 'REFUNDED', ...extraRefundData };
        }
        return r;
      });

      if (!found) {
        updatedList.push({ ...refundModalItem, status: 'REFUNDED', ...extraRefundData });
      }
      localStorage.setItem('erp_return_requests', JSON.stringify(updatedList));

      // Không tự thêm bút toán ở đây nữa — updateReturnStatus(..., 'REFUNDED', ...)
      // ở trên đã gọi PATCH /orders/returns/:id/refund, và processRefund
      // (order.controller.js) đã tự ghi 1 LedgerEntry REFUND thật ở backend rồi.
      // Gọi thêm addLedgerEntry ở đây sẽ ghi trùng 2 lần cho cùng 1 lần hoàn tiền.

      notify(`Đã hoàn tiền và ghi sổ cái thành công. Số tiền: ${fmt(finalAmount)}. Người nhận: ${refundModalItem.customerName}. Mã GD: ${txnCode}. Bút toán chi phí đã được ghi nhận tự động vào Sổ Cái Kế Toán.`, 'success');
      await fetchLedgerData();
      setRefundModalItem(null);
      setRefundTxnCode('');
      setRefundNote('');
      setRefundProofPhoto('');
    } catch (err) {
      console.error('Lỗi khi xác nhận hoàn tiền:', err);
      notify('Có lỗi xảy ra: ' + (err.message || 'Vui lòng thử lại!'), 'error');
    }
  };

  const [disbursingAll, setDisbursingAll] = useState(false);
  const handleDisburseAll = async () => {
    if (!(await confirm(`Xác nhận GIẢI NGÂN LƯƠNG TOÀN DOANH NGHIỆP (${fmt(totalPayrollFund)})? Tiền sẽ được trừ vào quỹ và ghi sổ cái.`, { danger: true }))) return;
    if (typeof disburseAllPayrolls !== 'function') return;
    setDisbursingAll(true);
    try {
      await disburseAllPayrolls();
    } catch (err) {
      notify(`Giải ngân thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setDisbursingAll(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={24} style={{ color: '#16a34a' }} />
            {activeTab === 'overview' && 'Tổng Quan Tài Chính & Dòng Tiền Doanh Nghiệp'}
            {activeTab === 'refunds' && 'Chi Hoàn Tiền Đổi Trả Khách Hàng'}
            {activeTab === 'ledger' && 'Sổ Cái Kế Toán & Lịch Sử Dòng Tiền'}
            {activeTab === 'po_payments' && 'Thanh Toán Đơn Mua Hàng Nhà Cung Cấp'}
            {activeTab === 'payroll_disbursement' && 'Chi Trả & Giải Ngân Bảng Lương'}
            {activeTab === 'reports' && 'Báo Cáo Tài Chính P&L & Thuế GTGT'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            Quản trị dòng tiền thu chi, thanh toán NCC, chi lương và báo cáo lãi lỗ P&L
          </p>
        </div>

        {activeTab === 'ledger' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={fetchLedgerData}
              disabled={loadingLedger}
              title="Tải lại toàn bộ dữ liệu sổ cái từ máy chủ"
              style={{
                backgroundColor: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: loadingLedger ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <RefreshCw size={14} style={{ animation: loadingLedger ? 'spin 1s linear infinite' : 'none' }} />
              <span>{loadingLedger ? 'Đang tải...' : 'Làm Mới'}</span>
            </button>
            <button
              onClick={() => setShowManualModal(true)}
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
              <PlusCircle size={16} />
              <span>Thêm Phiếu Thu / Chi</span>
            </button>
          </div>
        )}

        {activeTab === 'reports' && (
          <button
            onClick={() => window.print()}
            style={{
              backgroundColor: '#ffffff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
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
            <Printer size={15} />
            <span>In Báo Cáo Tài Chính</span>
          </button>
        )}
      </div>

      {/* Tab Navigation Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', overflowX: 'auto' }}>
        {[
          { key: 'overview', label: 'Tổng Quan Tài Chính' },
          { key: 'refunds', label: 'Chi Hoàn Tiền RMA', badge: pendingRefunds.length },
          { key: 'ledger', label: 'Sổ Cái Kế Toán' },
          { key: 'po_payments', label: 'Thanh Toán PO NCC', badge: unpaidPOs.length },
          { key: 'payroll_disbursement', label: 'Chi Trả Lương' },
          { key: 'reports', label: 'Báo Cáo P&L & VAT' }
        ].map(tabItem => {
          const isActive = activeTab === tabItem.key;
          return (
            <button
              key={tabItem.key}
              type="button"
              onClick={() => setTab(tabItem.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                backgroundColor: isActive ? '#2563eb' : '#ffffff',
                color: isActive ? '#ffffff' : '#334155',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tabItem.label}</span>
              {tabItem.badge > 0 && (
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  backgroundColor: isActive ? '#ffffff' : (tabItem.key === 'refunds' ? '#dc2626' : '#d97706'),
                  color: isActive ? '#2563eb' : '#ffffff'
                }}>
                  {tabItem.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB: REFUNDS (CHI HOÀN TIỀN ĐỔI TRẢ KHÁCH HÀNG) */}
      {/* ========================================================================= */}
      {activeTab === 'refunds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '1.1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Hồ Sơ Chờ Giải Ngân Hoàn Tiền
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
                {pendingRefunds.length} hồ sơ <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>({fmt(pendingRefundTotal)})</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.2rem' }}>
                Hàng đã về kho & QC kiểm định, chờ Kế toán chuyển khoản
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '1.1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Đã Hoàn Tiền & Ghi Sổ Cái
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
                {completedRefunds.length} hồ sơ <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>({fmt(completedRefundTotal)})</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.2rem' }}>
                Đã giải ngân đầy đủ cho khách và hoàn tất hạch toán
              </div>
            </div>
          </div>

          {/* Table of Refund Requests */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Danh Sách Yêu Cầu Hoàn Tiền Khách Hàng (Napas247 VietQR)
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                  Kế toán đối soát thông tin tài khoản ngân hàng khách cung cấp và quét mã VietQR để chuyển tiền tức thì
                </p>
              </div>

              {/* Search & Filter Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {[
                    { key: 'ALL', label: `Tất Cả (${refundReturnRequests.length})` },
                    { key: 'PENDING', label: `Chờ Giải Ngân (${pendingRefunds.length})` },
                    { key: 'REFUNDED', label: `Đã Hoàn Tiền (${completedRefunds.length})` }
                  ].map(tab => {
                    const isSel = refundStatusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setRefundStatusFilter(tab.key)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: isSel ? '#ffffff' : 'transparent',
                          color: isSel ? '#2563eb' : '#64748b',
                          boxShadow: isSel ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ position: 'relative', width: '220px' }}>
                  <input
                    type="text"
                    value={refundSearch}
                    onChange={e => setRefundSearch(e.target.value)}
                    placeholder="Tìm mã RMA, Đơn, SĐT..."
                    style={{
                      width: '100%',
                      padding: '0.38rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.78rem',
                      outline: 'none'
                    }}
                  />
                  {refundSearch && (
                    <button
                      type="button"
                      onClick={() => setRefundSearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        background: 'transparent',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Mã Phiếu & Đơn</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Khách Hàng & SĐT</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Tài Khoản Nhận Tiền</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Số Tiền Hoàn</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Trạng Thái</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác Kế Toán</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRefunds.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                        Không có yêu cầu hoàn tiền nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredRefunds.map((ret, rIdx) => {
                      const isRefunded = ret.status === 'REFUNDED';
                      const refundAmount = parseFloat(ret.refundAmount || ret.totalAmount || 0);

                      return (
                        <tr key={ret.id || rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#7c3aed' }}>
                            <div>#RMA-{ret.id}</div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Đơn: #{ret.orderId}</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <strong style={{ color: '#0f172a', display: 'block' }}>{ret.customerName}</strong>
                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{ret.phone || 'N/A'}</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{ret.bankName || 'MB Bank'}</div>
                            <div style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 800, fontFamily: 'monospace' }}>{ret.bankAccountNo || 'Chưa cung cấp STK'}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>{ret.bankAccountName || ret.customerName}</div>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: '0.95rem' }}>
                            {fmt(refundAmount)}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            {isRefunded ? (
                              <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                                ĐÃ HOÀN TIỀN
                              </span>
                            ) : (
                              <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                                CHỜ GIẢI NGÂN
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setViewingRefundVoucher(ret)}
                                style={{
                                  backgroundColor: '#f5f3ff',
                                  color: '#7c3aed',
                                  border: '1px solid #ddd6fe',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Phiếu Đề Nghị Chi
                              </button>
                              <button
                                type="button"
                                onClick={() => setQrModalItem(ret)}
                                style={{
                                  backgroundColor: '#eff6ff',
                                  color: '#2563eb',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                VietQR 24/7
                              </button>
                              {!isRefunded ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRefundModalItem(ret);
                                    setRefundTxnCode(`FT${Date.now().toString().slice(-8)}`);
                                    setRefundNote('');
                                    setRefundProofPhoto('');
                                  }}
                                  style={{
                                    backgroundColor: '#16a34a',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.35rem 0.75rem',
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Xác Nhận Đã Chuyển
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setViewingRefundProof(ret)}
                                  style={{
                                    backgroundColor: '#ecfdf5',
                                    color: '#15803d',
                                    border: '1px solid #86efac',
                                    borderRadius: '6px',
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Xem Minh Chứng (UNC)
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN TÀI CHÍNH) */}
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
                Cơ Cấu Dòng Tiền Thu & Chi
              </h3>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={cashFlowChartData}
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
                Biến Động Doanh Thu & Chi Phí Theo Tháng
              </h3>
              <div style={{ flex: 1, position: 'relative' }}>
                <Bar
                  data={monthlyFinanceData}
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

          {/* Quick Hub: Unpaid POs, Pending Payroll & P&L Card */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
                Đơn Mua Hàng Cần Thanh Toán
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {unpaidPOs.slice(0, 2).map((po, pIdx) => (
                  <div key={po.id || pIdx} style={{ padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>{po.poNumber || `PO-${po.id}`}</strong>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>{fmt((getPoBill(po)?.amountDue) ?? po.totalAmount)}</span>
                    </div>
                    <button
                      onClick={() => setTab('po_payments')}
                      style={{ backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.55rem', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Chi Trả
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
                Bảng Lương Chờ Chi Trả
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>Quỹ Lương:</span>
                  <strong style={{ color: '#2563eb' }}>{fmt(totalPayrollFund)}</strong>
                </div>
                <button
                  onClick={() => setTab('payroll_disbursement')}
                  style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Giải Ngân Bảng Lương
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
                Báo Cáo Tài Chính P&L
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                  <span>Lợi Nhuận Thuần:</span>
                  <strong style={{ color: '#1d4ed8' }}>{fmt(netProfit)}</strong>
                </div>
                <button
                  onClick={() => setTab('reports')}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Xem Báo Cáo P&L & VAT →
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LEDGER (SỔ CÁI DÒNG TIỀN) */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <input
                type="text"
                placeholder="Tìm giao dịch, mã đơn, nội dung thu chi..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>Phân Loại:</span>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', color: '#0f172a' }}
              >
                <option value="ALL">Tất cả bút toán</option>
                <option value="INCOME">Thu tiền (+) (Bán hàng, Khác)</option>
                <option value="EXPENSE">Chi tiền (-) (Mua hàng, Vận hành)</option>
                <option value="EXPENSE_PAYROLL">Chi lương nhân viên (-)</option>
                <option value="REFUND">Chi hoàn tiền khách hàng (-)</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem', width: '160px', whiteSpace: 'nowrap' }}>Mã Bút Toán</th>
                  <th style={{ padding: '0.75rem 1rem', width: '150px', whiteSpace: 'nowrap' }}>Thời Gian</th>
                  <th style={{ padding: '0.75rem 1rem', width: '130px', whiteSpace: 'nowrap', textAlign: 'center' }}>Loại Giao Dịch</th>
                  <th style={{ padding: '0.75rem 1rem', minWidth: '320px' }}>Nội Dung Thu / Chi</th>
                  <th style={{ padding: '0.75rem 1rem', width: '160px', textAlign: 'right', whiteSpace: 'nowrap' }}>Số Tiền</th>
                  <th style={{ padding: '0.75rem 1rem', width: '110px', textAlign: 'center', whiteSpace: 'nowrap' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {loadingLedger ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      <RefreshCw size={24} style={{ display: 'block', margin: '0 auto 0.5rem', animation: 'spin 1s linear infinite' }} />
                      Đang tải danh sách bút toán sổ cái...
                    </td>
                  </tr>
                ) : filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      <FileText size={32} style={{ color: '#94a3b8', display: 'block', margin: '0 auto 0.5rem' }} />
                      Không tìm thấy bút toán nào trong sổ cái kế toán
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((tx, tIdx) => {
                    const isIncome = tx.type === 'INCOME';
                    const isRefund = tx.type === 'REFUND';
                    const amt = parseFloat(tx.amount || 0);
                    const displayCode = tx.referenceId 
                      ? (tx.referenceId.startsWith('#') ? tx.referenceId : `#${tx.referenceId}`)
                      : (tx.id?.length > 12 ? `#BT-${tx.id.slice(0, 8).toUpperCase()}` : `#${tx.id || `TX-${tIdx + 100}`}`);

                    return (
                      <tr
                        key={tx.id || tIdx}
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', fontSize: '0.82rem', backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: '4px', border: '1px solid #dbeafe', display: 'inline-block' }}>
                            {displayCode}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#475569', whiteSpace: 'nowrap', verticalAlign: 'middle', fontSize: '0.8rem' }}>
                          {formatLedgerDate(tx.date || tx.createdAt)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            display: 'inline-block',
                            backgroundColor: isIncome ? '#f0fdf4' : isRefund ? '#fff7ed' : '#fef2f2',
                            color: isIncome ? '#16a34a' : isRefund ? '#ea580c' : '#dc2626',
                            border: `1px solid ${isIncome ? '#bbf7d0' : isRefund ? '#fed7aa' : '#fecaca'}`
                          }}>
                            {isIncome ? '▲ Thu Tiền' : isRefund ? '▼ Hoàn Tiền' : '▼ Chi Tiền'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#0f172a', fontWeight: 500, verticalAlign: 'middle', lineHeight: '1.45' }}>
                          {tx.description || 'Giao dịch thu chi'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: isIncome ? '#16a34a' : isRefund ? '#ea580c' : '#dc2626', fontSize: '0.9rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                          {isIncome ? `+${fmt(amt)}` : `-${fmt(amt)}`}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                          <button
                            onClick={() => setViewingTxDetail(tx)}
                            style={{
                              backgroundColor: '#ffffff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                          >
                            <FileText size={13} />
                            <span>Chứng Từ</span>
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
      {/* TAB 3: PO PAYMENTS (THANH TOÁN ĐƠN MUA HÀNG) */}
      {/* ========================================================================= */}
      {activeTab === 'po_payments' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShoppingBag size={18} style={{ color: '#f59e0b' }} />
            <span>Danh Sách Đơn Mua Hàng Cần Thanh Toán Cho Nhà Cung Cấp</span>
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '1.25rem' }}>
            Lập hóa đơn công nợ và ghi nhận thanh toán cho các đơn PO đã nhập kho — mọi thao tác đều gọi API thật, ghi trực tiếp vào cơ sở dữ liệu (VendorBill/VendorPayment), không phải dữ liệu giả lập.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã PO</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Nhà Cung Cấp</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Tình Trạng Kho</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Số Tiền Hóa Đơn</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Thanh Toán</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác Kế Toán</th>
                </tr>
              </thead>
              <tbody>
                {effectivePOs.filter(isPoBillable).map((po, pIdx) => {
                  const bill = getPoBill(po);
                  const poStatusInfo = getStatusInfo(PO_STATUS, po.status);
                  const billStatusInfo = bill ? getStatusInfo(VENDOR_BILL_STATUS, bill.status) : null;
                  const isBusy = payingPOId === po.id;
                  const displayAmount = bill ? bill.amountTotal : po.totalAmount;

                  return (
                    <tr key={po.id || pIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#2563eb' }}>{po.poNumber || `PO-${po.id}`}</td>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{po.supplier?.name || po.supplierCode || 'Chưa rõ NCC'}</td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: poStatusInfo.bg, color: poStatusInfo.color, border: `1px solid ${poStatusInfo.border}` }}>
                          {poStatusInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {fmt(displayAmount)}
                        {bill && Number(bill.amountTotal) !== Number(po.totalAmount) && (
                          <div style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 600 }}>Đã điều chỉnh theo QC (gốc {fmt(po.totalAmount)})</div>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        {billStatusInfo ? (
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: billStatusInfo.bg, color: billStatusInfo.color, border: `1px solid ${billStatusInfo.border}` }}>
                            {billStatusInfo.label}{bill.amountDue > 0 ? ` — Còn nợ ${fmt(bill.amountDue)}` : ''}
                          </span>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: '#f1f5f9', color: '#64748b' }}>
                            Chưa Lập Hóa Đơn
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        {!bill ? (
                          <button
                            onClick={() => handleCreateBill(po)}
                            disabled={isBusy}
                            style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? 0.6 : 1 }}
                          >
                            {isBusy ? 'Đang xử lý...' : 'Lập Hóa Đơn'}
                          </button>
                        ) : bill.status !== 'PAID' ? (
                          <button
                            onClick={() => handleRegisterPayment(po)}
                            disabled={isBusy}
                            style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 800, cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? 0.6 : 1 }}
                          >
                            {isBusy ? 'Đang xử lý...' : 'Chi Trả Ngay'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Hoàn tất</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {effectivePOs.filter(isPoBillable).length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      Chưa có đơn mua hàng nào đã nhập kho cần lập hóa đơn/thanh toán.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PAYROLL DISBURSEMENT (CHI TRẢ BẢNG LƯƠNG) */}
      {/* ========================================================================= */}
      {activeTab === 'payroll_disbursement' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Bảng Lương Tháng Đã Phê Duyệt — Sẵn Sàng Chi Trả
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
                Tổng quỹ chi trả: <strong style={{ color: '#2563eb' }}>{fmt(totalPayrollFund)}</strong> (CEO đã phê duyệt)
              </p>
            </div>

            <button
              onClick={handleDisburseAll}
              disabled={disbursingAll}
              style={{ backgroundColor: disbursingAll ? '#9ca3af' : '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: disbursingAll ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Send size={15} /> {disbursingAll ? 'Đang xử lý...' : 'Chi Lương Toàn Doanh Nghiệp'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Nhân Viên</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Chức Danh</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Lương Cứng</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Thưởng / Phạt</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Thực Nhận</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Trạng Thái</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p, pIdx) => {
                  const isPaid = p.status === 'PAID';
                  const isReady = p.status === 'APPROVED_BY_CEO' || p.status === 'SUBMITTED_TO_ACCOUNTING';
                  const isBusy = disbursingPayrollId === p.id;
                  const netAdjust = (parseFloat(p.bonuses) || 0) - (parseFloat(p.deductions) || 0);
                  return (
                    <tr key={p.id || pIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{p.empName}</td>
                      <td style={{ padding: '0.65rem 0.85rem', color: '#64748b' }}>{p.employee?.role}</td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#475569' }}>{fmt(p.salary)}</td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: netAdjust >= 0 ? '#16a34a' : '#dc2626' }}>{netAdjust >= 0 ? '+' : ''}{fmt(netAdjust)}</td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{fmt(p.netAmount)}</td>
                      <td style={{ padding: '0.65rem 0.85rem', fontSize: '0.72rem', color: isPaid ? '#16a34a' : isReady ? '#2563eb' : '#b45309' }}>
                        {isPaid ? 'Đã Chi Trả' : isReady ? 'Sẵn Sàng Chi Trả' : p.status}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        {isPaid ? (
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Hoàn tất</span>
                        ) : (
                          <button
                            disabled={!isReady || isBusy}
                            onClick={async () => {
                              setDisbursingPayrollId(p.id);
                              try {
                                await disbursePayroll(p.id);
                              } catch (err) {
                                notify(`Chi lương thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
                              } finally {
                                setDisbursingPayrollId(null);
                              }
                            }}
                            title={!isReady ? 'Cần CEO duyệt trước khi chi trả' : undefined}
                            style={{ backgroundColor: (!isReady || isBusy) ? '#9ca3af' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, cursor: (!isReady || isBusy) ? 'default' : 'pointer' }}
                          >
                            {isBusy ? 'Đang xử lý...' : 'Chi Lương'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {payrolls.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      Chưa có bảng lương nào — HR cần lập bảng lương kỳ hiện tại trước.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: REPORTS (BÁO CÁO P&L & VAT) */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* P&L Statement Card */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={18} style={{ color: '#2563eb' }} />
              <span>Báo Cáo Kết Quả Hoạt Động Kinh Doanh</span>
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '1.25rem' }}>
              Kỳ tính toán: Tháng {today.getMonth() + 1}/{today.getFullYear()}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                <strong style={{ color: '#16a34a', flex: '1 1 260px', minWidth: 0 }}>1. DOANH THU THUẦN TỪ BÁN HÀNG & DỊCH VỤ:</strong>
                <strong style={{ color: '#16a34a', fontSize: '1rem', whiteSpace: 'nowrap' }}>{fmt(totalRevenue)}</strong>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <strong style={{ color: '#dc2626', flex: '1 1 260px', minWidth: 0 }}>2. GIÁ VỐN HÀNG BÁN:</strong>
                <strong style={{ color: '#dc2626', fontSize: '1rem', whiteSpace: 'nowrap' }}>- {fmt(cogsAmount)}</strong>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <strong style={{ color: '#dc2626', flex: '1 1 260px', minWidth: 0 }}>3. CHI PHÍ LƯƠNG NHÂN VIÊN & HOA HỒNG:</strong>
                <strong style={{ color: '#dc2626', fontSize: '1rem', whiteSpace: 'nowrap' }}>- {fmt(totalPayrollFund)}</strong>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <strong style={{ color: '#dc2626', flex: '1 1 260px', minWidth: 0 }}>4. CHI PHÍ VẬN HÀNH (Phiếu Chi Thủ Công):</strong>
                <strong style={{ color: '#dc2626', fontSize: '1rem', whiteSpace: 'nowrap' }}>- {fmt(operatingExpense)}</strong>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <strong style={{ color: '#dc2626', flex: '1 1 260px', minWidth: 0 }}>5. CHI HOÀN TIỀN KHÁCH HÀNG:</strong>
                <strong style={{ color: '#dc2626', fontSize: '1rem', whiteSpace: 'nowrap' }}>- {fmt(refundAmount)}</strong>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '2px solid #3b82f6', marginTop: '0.5rem' }}>
                <strong style={{ color: '#1d4ed8', fontSize: '1.05rem', flex: '1 1 260px', minWidth: 0 }}>6. LỢI NHUẬN RÒNG TRƯỚC THUẾ:</strong>
                <strong style={{ color: '#1d4ed8', fontSize: '1.15rem', whiteSpace: 'nowrap' }}>{fmt(netProfit)}</strong>
              </div>
            </div>
          </div>

          {/* VAT Tax Ledger */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              Bảng Kê Thuế Giá Trị Gia Tăng (VAT 10%)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
              <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Thuế VAT Đầu Ra (Bán Hàng 10%):</strong>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', marginTop: '0.35rem' }}>
                  {fmt(Math.round(totalRevenue * 0.1))}
                </div>
              </div>
              <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Thuế VAT Đầu Vào Được Khấu Trừ:</strong>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626', marginTop: '0.35rem' }}>
                  {fmt(Math.round(totalExpense * 0.1))}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ================= MODAL: THÊM BÚT TOÁN THỦ CÔNG ================= */}
      {showManualModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '480px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Thêm Phiếu Thu / Chi Thủ Công</h3>
              <button onClick={() => setShowManualModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Loại phiếu *</label>
                <select
                  value={manualForm.type}
                  onChange={e => setManualForm(p => ({ ...p, type: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                >
                  <option value="EXPENSE">Phiếu Chi (-)</option>
                  <option value="INCOME">Phiếu Thu (+)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Số tiền (VNĐ) *</label>
                <input
                  type="number"
                  placeholder="Ví dụ: 1500000"
                  value={manualForm.amount}
                  onChange={e => setManualForm(p => ({ ...p, amount: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Hạng mục</label>
                <select
                  value={manualForm.category}
                  onChange={e => setManualForm(p => ({ ...p, category: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                >
                  <option value="Vận hành văn phòng">Vận hành văn phòng</option>
                  <option value="Điện nước Internet">Điện nước Internet</option>
                  <option value="Tiếp khách kinh doanh">Tiếp khách kinh doanh</option>
                  <option value="Mua dụng cụ kỹ thuật">Mua dụng cụ kỹ thuật</option>
                  <option value="Khác">Hạng mục khác</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Nội dung diễn giải *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Thanh toán tiền điện tháng 8"
                  value={manualForm.description}
                  onChange={e => setManualForm(p => ({ ...p, description: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddManualEntry}
                  disabled={submittingManualEntry}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: submittingManualEntry ? 'default' : 'pointer', opacity: submittingManualEntry ? 0.7 : 1 }}
                >
                  {submittingManualEntry ? 'Đang lưu...' : 'Ghi Sổ Cái'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: XEM CHỨNG TỪ SỔ CÁI ================= */}
      {viewingTxDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '560px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  CÔNG TY TNHH CÔNG NGHỆ AETHERPC • PHÒNG TÀI CHÍNH KẾ TOÁN
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0 0' }}>
                  CHỨNG TỪ KẾ TOÁN
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 700, marginTop: '2px' }}>
                  Số bút toán: <span style={{ fontFamily: 'monospace' }}>#{viewingTxDetail.referenceId || (viewingTxDetail.id?.length > 12 ? `BT-${viewingTxDetail.id.slice(0, 8).toUpperCase()}` : viewingTxDetail.id || 'TX-101')}</span>
                </div>
              </div>
              <button
                onClick={() => setViewingTxDetail(null)}
                style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', color: '#64748b' }}
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              
              {/* Highlight Amount Banner */}
              {(() => {
                const isIncome = viewingTxDetail.type === 'INCOME';
                const isRefund = viewingTxDetail.type === 'REFUND';
                const amt = parseFloat(viewingTxDetail.amount || 0);
                const bannerBg = isIncome ? '#f0fdf4' : isRefund ? '#fff7ed' : '#fef2f2';
                const bannerBorder = isIncome ? '#86efac' : isRefund ? '#fed7aa' : '#fca5a5';
                const textColor = isIncome ? '#16a34a' : isRefund ? '#ea580c' : '#dc2626';
                const badgeLabel = isIncome ? '▲ Thu Tiền (INCOME)' : isRefund ? '▼ Hoàn Tiền (REFUND)' : '▼ Chi Tiền (EXPENSE)';

                return (
                  <div style={{
                    padding: '0.9rem 1.1rem',
                    backgroundColor: bannerBg,
                    border: `1px solid ${bannerBorder}`,
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: isIncome ? '#15803d' : isRefund ? '#c2410c' : '#991b1b', textTransform: 'uppercase' }}>
                        {isIncome ? 'Số Tiền Thực Thu (+)' : isRefund ? 'Số Tiền Hoàn Trả (-)' : 'Số Tiền Thực Chi (-)'}
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: textColor, marginTop: '0.15rem' }}>
                        {isIncome ? `+${fmt(amt)}` : `-${fmt(amt)}`}
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      backgroundColor: '#ffffff',
                      border: `1px solid ${bannerBorder}`,
                      color: textColor
                    }}>
                      {badgeLabel}
                    </span>
                  </div>
                );
              })()}

              {/* Information Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem 1rem',
                backgroundColor: '#f8fafc',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Mã tham chiếu nghiệp vụ:</span>
                  <code style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.85rem' }}>{viewingTxDetail.referenceId || 'N/A'}</code>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Thời gian hạch toán:</span>
                  <strong style={{ color: '#0f172a' }}>{formatLedgerDate(viewingTxDetail.date || viewingTxDetail.createdAt)}</strong>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Diễn giải nội dung thu / chi:</span>
                  <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '0.25rem', lineHeight: '1.45', backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    {viewingTxDetail.description || 'Giao dịch thu chi kế toán'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Người lập biểu:</span>
                  <strong style={{ color: '#0f172a' }}>Kế Toán Viên (AetherPC Accounting)</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Trạng thái ghi sổ:</span>
                  <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle size={14} /> Đã Hạch Toán Sổ Cái
                  </span>
                </div>
                {viewingTxDetail.id && viewingTxDetail.id.length > 12 && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                    Mã định danh hệ thống (UUID): <span style={{ fontFamily: 'monospace' }}>{viewingTxDetail.id}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Printer size={15} />
                  <span>In Chứng Từ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingTxDetail(null)}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.45rem 1.25rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Đóng
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: XEM & IN PHIẾU ĐỀ NGHỊ CHI HOÀN TIỀN ================= */}
      {viewingRefundVoucher && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '600px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  CÔNG TY TNHH CÔNG NGHỆ AETHERPC • PHÒNG KẾ TOÁN
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0 0' }}>
                  PHIẾU ĐỀ NGHỊ CHI HOÀN TIỀN
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700, marginTop: '2px' }}>
                  Số phiếu: #PC-RMA-{viewingRefundVoucher.id} (Đơn: #{viewingRefundVoucher.orderId})
                </div>
              </div>
              <button onClick={() => setViewingRefundVoucher(null)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div><span style={{ color: '#64748b' }}>Họ tên người nhận:</span> <strong style={{ color: '#0f172a' }}>{viewingRefundVoucher.customerName}</strong></div>
                <div><span style={{ color: '#64748b' }}>Số điện thoại:</span> <strong style={{ color: '#0f172a' }}>{viewingRefundVoucher.phone || 'N/A'}</strong></div>
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b' }}>Địa chỉ:</span> <strong style={{ color: '#0f172a' }}>{viewingRefundVoucher.address || viewingRefundVoucher.shippingAddress || 'TP. Hồ Chí Minh'}</strong></div>
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b' }}>Lý do chi hoàn:</span> <strong style={{ color: '#0f172a' }}>{viewingRefundVoucher.reason || 'Khách hàng đổi trả sản phẩm lỗi / bảo hành'}</strong></div>
              </div>

              {/* Bank Transfer Details */}
              <div style={{ padding: '0.85rem', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.76rem', color: '#15803d', fontWeight: 800, textTransform: 'uppercase' }}>
                  Thông Tin Thụ Hưởng Giải Ngân Chuyển Khoản (Napas247)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 700 }}>{viewingRefundVoucher.bankName || 'MB Bank'}</div>
                    <div style={{ fontSize: '0.95rem', color: '#2563eb', fontWeight: 800, fontFamily: 'monospace' }}>{viewingRefundVoucher.bankAccountNo || 'Chưa có STK'}</div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase' }}>{viewingRefundVoucher.bankAccountName || viewingRefundVoucher.customerName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Số tiền hoàn 100%:</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>
                      {fmt(parseFloat(viewingRefundVoucher.refundAmount || viewingRefundVoucher.totalAmount || 0))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Department Verification Checkmarks */}
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#334155' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Xác Nhận Trách Nhiệm Các Bộ Phận:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div><strong>Shipper:</strong> Đã tiếp nhận và bàn giao kiện hàng nguyên vẹn về kho.</div>
                  <div><strong>Kỹ thuật QC:</strong> Đã kiểm định linh kiện đạt tiêu chuẩn chính sách đổi trả / bảo hành.</div>
                  <div><strong>Thủ kho:</strong> Đã hoàn tất xếp hàng vào kệ kho lưu trữ và lập phiếu đề nghị chi.</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Printer size={15} /> In Phiếu Chi
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingRefundVoucher;
                      setViewingRefundVoucher(null);
                      setQrModalItem(target);
                    }}
                    style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Quét VietQR 24/7
                  </button>

                  {viewingRefundVoucher.status !== 'REFUNDED' && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingRefundVoucher;
                        setViewingRefundVoucher(null);
                        setRefundModalItem(target);
                        setRefundTxnCode(`FT${Date.now().toString().slice(-8)}`);
                        setRefundNote('');
                      }}
                      style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Xác Nhận Đã Chuyển
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: VIETQR NAPAS247 HOÀN TIỀN ================= */}
      {qrModalItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '440px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Mã VietQR 24/7 Hoàn Tiền</h3>
              <button onClick={() => setQrModalItem(null)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {(() => {
              const bName = (qrModalItem.bankName || 'MB').toLowerCase();
              let bankSlug = 'mb';
              if (bName.includes('vietcom')) bankSlug = 'vcb';
              else if (bName.includes('techcom')) bankSlug = 'tcb';
              else if (bName.includes('vietin')) bankSlug = 'icb';
              else if (bName.includes('bidv')) bankSlug = 'bidv';
              else if (bName.includes('acb')) bankSlug = 'acb';
              else if (bName.includes('vp')) bankSlug = 'vpb';
              else if (bName.includes('tp')) bankSlug = 'tpb';
              else if (bName.includes('sacom')) bankSlug = 'stb';
              else if (bName.includes('agri')) bankSlug = 'vba';

              const amt = parseFloat(qrModalItem.refundAmount || qrModalItem.totalAmount || 0);
              const accNo = qrModalItem.bankAccountNo || '0000';
              const accName = qrModalItem.bankAccountName || qrModalItem.customerName;
              const qrUrl = `https://img.vietqr.io/image/${bankSlug}-${accNo}-compact2.png?amount=${amt}&addInfo=HOANTIEN DON ${qrModalItem.orderId}&accountName=${encodeURIComponent(accName)}`;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                    <img src={qrUrl} alt="VietQR Hoàn Tiền" style={{ width: '260px', height: 'auto', display: 'block', borderRadius: '4px' }} />
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', textAlign: 'left', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div><strong>Chủ TK:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 800, color: '#0f172a' }}>{accName}</span></div>
                    <div><strong>Ngân hàng:</strong> {qrModalItem.bankName || 'MB Bank'}</div>
                    <div><strong>Số TK:</strong> <code style={{ color: '#2563eb', fontWeight: 800 }}>{accNo}</code></div>
                    <div><strong>Số tiền hoàn:</strong> <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>{fmt(amt)}</strong></div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setQrModalItem(null)}
                      style={{ flex: 1, backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetItem = qrModalItem;
                        setQrModalItem(null);
                        setRefundModalItem(targetItem);
                        setRefundTxnCode(`FT${Date.now().toString().slice(-8)}`);
                        setRefundNote('');
                      }}
                      style={{ flex: 1, backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Xác Nhận Đã Chuyển
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================= MODAL: XÁC NHẬN GIẢI NGÂN HOÀN TIỀN & GHI SỔ CÁI ================= */}
      {refundModalItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '500px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Xác Nhận Đã Hoàn Tiền Khách Hàng</h3>
              <button onClick={() => setRefundModalItem(null)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleConfirmRefund} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700 }}>ĐƠN HÀNG: #{refundModalItem.orderId} (RMA: #{refundModalItem.id})</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                  {fmt(parseFloat(refundModalItem.refundAmount || refundModalItem.totalAmount || 0))}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>
                  Khách: <strong>{refundModalItem.customerName}</strong> ({refundModalItem.phone})
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  Tài khoản: <strong>{refundModalItem.bankAccountNo}</strong> - {refundModalItem.bankName} ({refundModalItem.bankAccountName || refundModalItem.customerName})
                </div>
              </div>

              {/* Source Account */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                  Tài Khoản Nguồn Trích Tiền Chi Trả (AetherPC) *
                </label>
                <select
                  value={sourceAccount}
                  onChange={e => setSourceAccount(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 600, color: '#334155' }}
                >
                  <option value="VCB_9988776655">Vietcombank - 9988776655 (CTY TNHH CÔNG NGHỆ AETHERPC)</option>
                  <option value="MB_8888999922">MB Bank - 8888999922 (CTY TNHH CÔNG NGHỆ AETHERPC)</option>
                  <option value="TCB_1903998822">Techcombank - 1903998822 (CTY TNHH CÔNG NGHỆ AETHERPC)</option>
                </select>
              </div>

              {/* Transaction Code */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                  Mã Giao Dịch Ngân Hàng (FT / Mã Ủy Nhiệm Chi) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: FT26082400912..."
                  value={refundTxnCode}
                  onChange={e => setRefundTxnCode(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: 700, color: '#2563eb' }}
                />
              </div>

              {/* Proof Photo Upload */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={{ fontWeight: 700, color: '#0f172a' }}>
                    Ảnh Biên Lai / Minh Chứng Chuyển Khoản
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRefundProofPhoto('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80');
                    }}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    Dùng Biên Lai Mẫu
                  </button>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (re) => setRefundProofPhoto(re.target?.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ fontSize: '0.75rem' }}
                />
                {refundProofPhoto && (
                  <div style={{ marginTop: '0.4rem', position: 'relative', display: 'inline-block' }}>
                    <img
                      src={refundProofPhoto}
                      alt="Proof"
                      style={{ width: '110px', height: '70px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                    <button
                      type="button"
                      onClick={() => setRefundProofPhoto('')}
                      style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                  Ghi chú hạch toán
                </label>
                <input
                  type="text"
                  placeholder="VD: Đã chuyển khoản hoàn tiền 100% qua Napas247"
                  value={refundNote}
                  onChange={e => setRefundNote(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setRefundModalItem(null)}
                  style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRefund}
                  style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Xác Nhận & Ghi Sổ Cái
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: XEM MINH CHỨNG GIẢI NGÂN HOÀN TIỀN ================= */}
      {viewingRefundProof && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '520px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Minh Chứng Chuyển Tiền Hoàn Đơn Hàng
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                  Đã xác thực giải ngân qua Napas247 & Ghi sổ cái
                </div>
              </div>
              <button onClick={() => setViewingRefundProof(null)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              {/* Photo Proof */}
              <div style={{ textAlign: 'center', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <img
                  src={viewingRefundProof.refundProofPhoto || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80'}
                  alt="Biên Lai Chuyển Tiền"
                  style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.35rem' }}>
                  Ảnh chụp Ủy nhiệm chi / Biên lai chuyển khoản ngân hàng
                </div>
              </div>

              {/* Transaction Metadata */}
              <div style={{ backgroundColor: '#f0fdf4', padding: '0.85rem', borderRadius: '8px', border: '1px solid #86efac', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#166534' }}>Mã giao dịch FT:</span>
                  <strong style={{ color: '#15803d', fontFamily: 'monospace' }}>{viewingRefundProof.refundTxnCode || 'FT26082400912'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#166534' }}>Số tiền đã hoàn:</span>
                  <strong style={{ color: '#15803d', fontSize: '1rem' }}>{fmt(parseFloat(viewingRefundProof.refundAmount || viewingRefundProof.totalAmount || 0))}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#166534' }}>Tài khoản nhận:</span>
                  <strong style={{ color: '#0f172a' }}>{viewingRefundProof.bankAccountNo} - {viewingRefundProof.bankName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#166534' }}>Tên người thụ hưởng:</span>
                  <strong style={{ color: '#0f172a', textTransform: 'uppercase' }}>{viewingRefundProof.bankAccountName || viewingRefundProof.customerName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#166534' }}>Thời gian giải ngân:</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{viewingRefundProof.refundedAt ? new Date(viewingRefundProof.refundedAt).toLocaleString('vi-VN') : '24/08/2026 01:25'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#166534' }}>Kế toán viên thực hiện:</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{viewingRefundProof.refundedByName || 'Kế Toán Viên (AetherPC)'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setViewingRefundProof(null)}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.45rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Đóng
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
