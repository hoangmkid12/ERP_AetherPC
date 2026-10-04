import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { 
  Settings, Shield, Users, Database, Plus, X, Eye, EyeOff, Search, 
  CheckCircle, XCircle, AlertCircle, Key, Lock, Edit, Trash2, 
  RefreshCw, Download, Upload, Server, ShieldCheck, FileText, Check, 
  AlertTriangle, HardDrive, Cpu, Layers, Activity, ArrowRight, UserCheck, UserX,
  Building, CreditCard, QrCode, BookOpen, Sparkles
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
import { useHRStore, useSalesStore, useInventoryStore, useFinanceStore } from '../../stores';
import { DELIVERY_REGIONS } from '../../utils/deliveryRegions';
import { notify, confirm } from '../../context/NotificationContext';
import { AUDIT_LOG_STATUS, getStatusLabel, ORDER_STATUS } from '../../utils/statusLabels';
import {
  ERP_SYSTEM_MODULES,
  ERP_ROLES,
  getRoleRelevantModules,
  OPERATIONAL_PERMISSIONS,
  DEFAULT_OPERATIONAL_MATRIX,
  getOperationalRbac,
  saveOperationalRbac
} from '../../utils/rbacEngine';

// Danh sách các ngân hàng phổ biến tại Việt Nam hỗ trợ VietQR NAPAS 247
export const VIETNAMESE_BANKS = [
  { code: 'MB', name: 'MBBank (Ngân hàng TMCP Quân Đội)' },
  { code: 'VCB', name: 'Vietcombank (Ngân hàng TMCP Ngoại Thương VN)' },
  { code: 'TCB', name: 'Techcombank (Ngân hàng TMCP Kỹ Thương VN)' },
  { code: 'ACB', name: 'ACB (Ngân hàng TMCP Á Châu)' },
  { code: 'CTG', name: 'VietinBank (Ngân hàng TMCP Công Thương VN)' },
  { code: 'BIDV', name: 'BIDV (Ngân hàng TMCP Đầu Tư & Phát Triển VN)' },
  { code: 'VPB', name: 'VPBank (Ngân hàng TMCP Việt Nam Thịnh Vượng)' },
  { code: 'TPB', name: 'TPBank (Ngân hàng TMCP Tiên Phong)' },
  { code: 'STB', name: 'Sacombank (Ngân hàng TMCP Sài Gòn Thương Tín)' },
  { code: 'HDB', name: 'HDBank (Ngân hàng TMCP Phát Triển TP.HCM)' }
];

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

const ROLES = [
  'CEO', 'SALES_MANAGER', 'SALES', 'WAREHOUSE_MANAGER', 'WAREHOUSE', 'PURCHASING', 'QC', 
  'ASSEMBLY', 'HR', 'ACCOUNTANT', 'CSKH', 'DELIVERY', 'ADMIN'
];

const DEPARTMENTS = [
  'Ban Giám Đốc', 'Kinh Doanh', 'Kho Vận', 'Mua Hàng', 'Kiểm Định QA/QC',
  'Kỹ Thuật Lắp Ráp', 'Nhân Sự', 'Kế Toán', 'Chăm Sóc KH', 'Giao Vận', 'IT'
];

const ROLE_COLORS = {
  ADMIN: '#ef4444',
  CEO: '#f59e0b',
  SALES_MANAGER: '#1d4ed8',
  SALES: '#2563eb',
  WAREHOUSE_MANAGER: '#059669',
  WAREHOUSE: '#10b981',
  PURCHASING: '#f97316',
  QC: '#8b5cf6',
  QA: '#8b5cf6',
  ASSEMBLY: '#0ea5e9',
  HR: '#ec4899',
  ACCOUNTANT: '#14b8a6',
  CSKH: '#06b6d4',
  DELIVERY: '#64748b'
};

// Bộ style dùng chung cho trang này — trước đây mỗi phần tử tự viết inline
// style riêng dù lặp lại gần như y hệt hàng chục lần (card/input/label/badge),
// kèm vài chỗ lệch nhỏ không lý do (VD 2 nút cùng vai trò nhưng padding khác
// nhau). Gom các khối lặp lại thật sự vào đây, lấy đúng giá trị đang chiếm đa
// số trong chính file này — không đổi phong cách, chỉ chuẩn hoá.
const cardStyle = { backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem' };
const inputStyle = { width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' };
const sectionTitleStyle = { fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' };
const primaryBtnStyle = { backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' };
const secondaryBtnStyle = { backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' };

const BADGE_VARIANTS = {
  success: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  warning: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  danger: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  info: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  neutral: { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
};
const badgeStyle = (variant = 'neutral') => {
  const v = BADGE_VARIANTS[variant] || BADGE_VARIANTS.neutral;
  return { backgroundColor: v.bg, color: v.color, border: `1px solid ${v.border}`, padding: '3px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800 };
};

export default function SystemAdmin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const employees = useHRStore(state => state.employees) || [];
  const addEmployee = useHRStore(state => state.addEmployee);
  const updateEmployee = useHRStore(state => state.updateEmployee);
  const deleteEmployee = useHRStore(state => state.deleteEmployee);
  const orders = useSalesStore(state => state.orders) || [];
  const inventory = useInventoryStore(state => state.inventory) || [];
  const purchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];

  // Active Tab from URL (?tab=overview|users|rbac|audit|settings)
  const activeTab = searchParams.get('tab') || 'overview';
  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);

  // Tài khoản khách hàng (real Customer accounts, /api/v1/customer-accounts) —
  // hiển thị trong cùng tab "Tài Khoản & Người Dùng" bên cạnh nhân viên, cho
  // phép Admin giám sát/khóa nhanh mà không cần sang tab Bán Hàng. Tạo mới/sửa
  // chi tiết vẫn ở tab Khách Hàng (CRM) trong Bán Hàng để tránh trùng lặp modal.
  const [custSearch, setCustSearch] = useState('');
  const [custList, setCustList] = useState([]);
  const [custLoading, setCustLoading] = useState(false);
  const [custPage, setCustPage] = useState(1);
  const [custTotalPages, setCustTotalPages] = useState(1);
  const [custTotal, setCustTotal] = useState(0);
  const [custActionBusyId, setCustActionBusyId] = useState(null);
  const CUST_PAGE_SIZE = 8;

  const loadSysCustomers = async () => {
    setCustLoading(true);
    try {
      const params = new URLSearchParams({ page: String(custPage), limit: String(CUST_PAGE_SIZE) });
      if (custSearch.trim()) params.set('search', custSearch.trim());
      const res = await api.get(`/customer-accounts?${params.toString()}`);
      setCustList(res.data || []);
      setCustTotalPages(res.pagination?.totalPages || 1);
      setCustTotal(res.pagination?.total || 0);
    } catch (err) {
      notify(err?.message || 'Không thể tải danh sách khách hàng.', 'error');
    } finally {
      setCustLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'users') return;
    const timer = setTimeout(() => { loadSysCustomers(); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, custPage, custSearch]);

  // Customer Detail & Management Modal State
  const [selectedCust, setSelectedCust] = useState(null);
  const [custModalLoading, setCustModalLoading] = useState(false);
  const [custDetail, setCustDetail] = useState(null);
  const [isEditingCust, setIsEditingCust] = useState(false);
  const [custEditForm, setCustEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    tier: 'BRONZE'
  });
  const [savingCust, setSavingCust] = useState(false);

  const handleOpenCustDetail = async (cust) => {
    setSelectedCust(cust);
    setCustModalLoading(true);
    setIsEditingCust(false);
    try {
      const res = await api.get(`/customer-accounts/${cust.customerId}`);
      const data = res.data || cust;
      setCustDetail(data);
      setCustEditForm({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        city: data.city || '',
        tier: data.tier || 'BRONZE'
      });
    } catch (err) {
      notify(err?.message || 'Không thể tải chi tiết khách hàng.', 'error');
      setCustDetail(cust);
      setCustEditForm({
        name: cust.name || '',
        email: cust.email || '',
        phone: cust.phone || '',
        address: cust.address || '',
        city: cust.city || '',
        tier: cust.tier || 'BRONZE'
      });
    } finally {
      setCustModalLoading(false);
    }
  };

  const handleCloseCustDetail = () => {
    setSelectedCust(null);
    setCustDetail(null);
    setIsEditingCust(false);
  };

  const handleSaveCustEdit = async () => {
    if (!custEditForm.name.trim()) {
      notify('Vui lòng nhập họ và tên khách hàng.', 'error');
      return;
    }
    if (!custEditForm.email.trim()) {
      notify('Vui lòng nhập email khách hàng.', 'error');
      return;
    }
    setSavingCust(true);
    try {
      const res = await api.put(`/customer-accounts/${selectedCust.customerId}`, custEditForm);
      notify('Cập nhật thông tin khách hàng thành công!', 'success');
      setIsEditingCust(false);
      setCustDetail(prev => ({ ...prev, ...res.data }));
      setCustList(prev => prev.map(c => c.customerId === selectedCust.customerId ? { ...c, ...res.data } : c));
    } catch (err) {
      notify(err?.message || 'Cập nhật thông tin thất bại.', 'error');
    } finally {
      setSavingCust(false);
    }
  };

  const handleToggleCustStatus = async (cust) => {
    const currentStatus = (custDetail && custDetail.customerId === cust.customerId) ? custDetail.status : cust.status;
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const label = nextStatus === 'INACTIVE' ? 'vô hiệu hóa' : 'kích hoạt lại';
    if (!(await confirm(`Xác nhận ${label} tài khoản khách hàng "${cust.name}"?`, { danger: nextStatus === 'INACTIVE' }))) return;
    setCustActionBusyId(cust.customerId);
    try {
      await api.patch(`/customer-accounts/${cust.customerId}/status`, { status: nextStatus });
      notify(`Đã ${label} tài khoản "${cust.name}".`, 'success');
      if (custDetail && custDetail.customerId === cust.customerId) {
        setCustDetail(prev => ({ ...prev, status: nextStatus }));
      }
      loadSysCustomers();
    } catch (err) {
      notify(err?.message || 'Không thể cập nhật trạng thái.', 'error');
    } finally {
      setCustActionBusyId(null);
    }
  };

  const handleResetCustPassword = async (cust) => {
    if (!(await confirm(`Đặt lại mật khẩu của "${cust.name}" về mặc định (123456)?`))) return;
    setCustActionBusyId(cust.customerId);
    try {
      const res = await api.patch(`/customer-accounts/${cust.customerId}/reset-password`);
      notify(res.message || 'Đã đặt lại mật khẩu về 123456.', 'success');
    } catch (err) {
      notify(err?.message || 'Không thể đặt lại mật khẩu.', 'error');
    } finally {
      setCustActionBusyId(null);
    }
  };

  const handleDeleteCustomer = async (cust) => {
    const custId = cust.customerId;
    const custName = cust.name;
    const orderCount = cust.orderCount ?? custDetail?.orderCount ?? 0;

    if (orderCount > 0) {
      const wantDisable = await confirm(
        `Khách hàng "${custName}" đã có ${orderCount} đơn hàng trong hệ thống — không thể xóa vĩnh viễn vì ràng buộc chứng từ. Bạn có muốn VÔ HIỆU HÓA tài khoản thay vì xóa không?`,
        { danger: true }
      );
      if (wantDisable) {
        handleToggleCustStatus(cust);
      }
      return;
    }

    if (!(await confirm(`Xác nhận XÓA VĨNH VIỄN tài khoản khách hàng "${custName}"? Hành động này không thể hoàn tác!`, { danger: true }))) return;

    setCustActionBusyId(custId);
    try {
      const res = await api.delete(`/customer-accounts/${custId}`);
      notify(res.message || `Đã xóa tài khoản "${custName}".`, 'success');
      handleCloseCustDetail();
      loadSysCustomers();
    } catch (err) {
      notify(err?.message || 'Không thể xóa tài khoản.', 'error');
    } finally {
      setCustActionBusyId(null);
    }
  };

  // =========================================================================
  // Quản lý Tài khoản Ngân hàng Doanh nghiệp (/api/v1/system/bank-accounts)
  // =========================================================================
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankCode: 'MB',
    bankName: 'MBBank (Ngân hàng TMCP Quân Đội)',
    accountNumber: '',
    accountHolder: 'CÔNG TY TNHH AETHERPC',
    branch: 'Hội Sở Chính',
    purpose: 'Tài khoản nhận thanh toán đơn hàng & VietQR',
    isDefaultQr: false,
    status: 'ACTIVE'
  });

  const loadBankAccounts = async () => {
    setBankLoading(true);
    try {
      const res = await api.get('/system/bank-accounts');
      setBankAccounts(res.data || []);
    } catch (err) {
      notify(err?.message || 'Không thể tải danh sách tài khoản ngân hàng.', 'error');
    } finally {
      setBankLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bank-accounts') {
      loadBankAccounts();
    }
  }, [activeTab]);

  const handleOpenBankModal = (account = null) => {
    if (account) {
      setEditingBank(account);
      setBankForm({
        bankCode: account.bankCode || 'MB',
        bankName: account.bankName || 'MBBank (Ngân hàng TMCP Quân Đội)',
        accountNumber: account.accountNumber || '',
        accountHolder: account.accountHolder || 'CÔNG TY TNHH AETHERPC',
        branch: account.branch || '',
        purpose: account.purpose || '',
        isDefaultQr: Boolean(account.isDefaultQr),
        status: account.status || 'ACTIVE'
      });
    } else {
      setEditingBank(null);
      setBankForm({
        bankCode: 'MB',
        bankName: 'MBBank (Ngân hàng TMCP Quân Đội)',
        accountNumber: '',
        accountHolder: 'CÔNG TY TNHH AETHERPC',
        branch: 'Hội Sở Chính',
        purpose: 'Tài khoản nhận thanh toán đơn hàng & VietQR',
        isDefaultQr: bankAccounts.length === 0,
        status: 'ACTIVE'
      });
    }
    setShowBankModal(true);
  };

  const handleSaveBankAccount = async (e) => {
    if (e) e.preventDefault();
    if (!bankForm.accountNumber.trim()) {
      notify('Vui lòng nhập số tài khoản ngân hàng.', 'warning');
      return;
    }
    if (!bankForm.accountHolder.trim()) {
      notify('Vui lòng nhập tên chủ tài khoản.', 'warning');
      return;
    }

    setBankSubmitting(true);
    try {
      if (editingBank) {
        await api.put(`/system/bank-accounts/${editingBank.id}`, bankForm);
        notify('Cập nhật tài khoản ngân hàng thành công!', 'success');
      } else {
        await api.post('/system/bank-accounts', bankForm);
        notify('Thêm tài khoản ngân hàng doanh nghiệp thành công!', 'success');
      }
      setShowBankModal(false);
      loadBankAccounts();
    } catch (err) {
      notify(err?.message || 'Lỗi khi lưu tài khoản ngân hàng.', 'error');
    } finally {
      setBankSubmitting(false);
    }
  };

  const handleSetDefaultQr = async (acc) => {
    try {
      await api.patch(`/system/bank-accounts/${acc.id}/default-qr`);
      notify(`Đã kích hoạt VietQR mặc định cho tài khoản ${acc.bankCode} - ${acc.accountNumber}`, 'success');
      loadBankAccounts();
    } catch (err) {
      notify(err?.message || 'Không thể cập nhật VietQR mặc định.', 'error');
    }
  };

  const handleToggleBankStatus = async (acc) => {
    const nextStatus = acc.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/system/bank-accounts/${acc.id}`, { status: nextStatus });
      notify(`Đã ${nextStatus === 'ACTIVE' ? 'kích hoạt' : 'tạm ngưng'} tài khoản ${acc.accountNumber}`, 'success');
      loadBankAccounts();
    } catch (err) {
      notify(err?.message || 'Lỗi khi cập nhật trạng thái tài khoản.', 'error');
    }
  };

  const handleDeleteBankAccount = async (acc) => {
    if (acc.isDefaultQr) {
      notify('Không thể xóa tài khoản đang là VietQR mặc định của hệ thống!', 'warning');
      return;
    }
    const ok = await confirm({
      title: 'Xác nhận xóa tài khoản ngân hàng',
      message: `Bạn có chắc chắn muốn xóa tài khoản ${acc.bankCode} (${acc.accountNumber})? Hành động này sẽ được ghi vào nhật ký kiểm toán.`,
      confirmLabel: 'Xác nhận xóa',
      cancelLabel: 'Hủy'
    });
    if (!ok) return;

    try {
      await api.delete(`/system/bank-accounts/${acc.id}`);
      notify('Đã xóa tài khoản ngân hàng thành công!', 'success');
      loadBankAccounts();
    } catch (err) {
      notify(err?.message || 'Không thể xóa tài khoản (có thể đã có bút toán sổ cái liên kết).', 'error');
    }
  };

  // =========================================================================
  // KNOWLEDGE BASE (CƠ SỞ TRI THỨC & QUY TRÌNH SOP) STATE & HANDLERS
  // =========================================================================
  const [knowledgeDocs, setKnowledgeDocs] = useState([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeCategory, setKnowledgeCategory] = useState('ALL');
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [viewingKnowledgeDoc, setViewingKnowledgeDoc] = useState(null);
  const [editingKnowledgeDoc, setEditingKnowledgeDoc] = useState(null);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [knowledgeSubmitting, setKnowledgeSubmitting] = useState(false);
  const [seedingKnowledge, setSeedingKnowledge] = useState(false);

  const [knowledgeForm, setKnowledgeForm] = useState({
    title: '',
    slug: '',
    category: 'POLICY',
    summary: '',
    content: '',
    tags: '',
    allowedRoles: ['CEO', 'ADMIN'],
    isActive: true
  });

  const loadKnowledgeDocs = async () => {
    setKnowledgeLoading(true);
    try {
      const res = await api.get('/knowledge');
      setKnowledgeDocs(res.data || []);
    } catch (err) {
      notify(err?.message || 'Không thể tải danh sách tài liệu tri thức.', 'error');
    } finally {
      setKnowledgeLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'knowledge') {
      loadKnowledgeDocs();
    }
  }, [activeTab]);

  const handleOpenKnowledgeModal = (doc = null) => {
    if (doc) {
      setEditingKnowledgeDoc(doc);
      setKnowledgeForm({
        title: doc.title || '',
        slug: doc.slug || '',
        category: doc.category || 'POLICY',
        summary: doc.summary || '',
        content: doc.content || '',
        tags: Array.isArray(doc.tags) ? doc.tags.join(', ') : (doc.tags || ''),
        allowedRoles: Array.isArray(doc.allowedRoles) ? doc.allowedRoles : ['CEO', 'ADMIN'],
        isActive: doc.isActive !== false
      });
    } else {
      setEditingKnowledgeDoc(null);
      setKnowledgeForm({
        title: '',
        slug: '',
        category: 'POLICY',
        summary: '',
        content: '',
        tags: '',
        allowedRoles: ['CEO', 'ADMIN', 'SALES', 'QC'],
        isActive: true
      });
    }
    setShowKnowledgeModal(true);
  };

  const handleSaveKnowledge = async (e) => {
    if (e) e.preventDefault();
    if (!knowledgeForm.title.trim()) {
      notify('Vui lòng nhập tiêu đề tài liệu SOP.', 'warning');
      return;
    }
    if (!knowledgeForm.content.trim()) {
      notify('Vui lòng nhập nội dung chi tiết tài liệu.', 'warning');
      return;
    }

    const payload = {
      ...knowledgeForm,
      slug: knowledgeForm.slug.trim() || undefined,
      tags: typeof knowledgeForm.tags === 'string' 
        ? knowledgeForm.tags.split(',').map(t => t.trim()).filter(Boolean)
        : knowledgeForm.tags
    };

    setKnowledgeSubmitting(true);
    try {
      if (editingKnowledgeDoc) {
        await api.put(`/knowledge/${editingKnowledgeDoc.id}`, payload);
        notify('Cập nhật tài liệu SOP thành công!', 'success');
      } else {
        await api.post('/knowledge', payload);
        notify('Tạo tài liệu SOP mới thành công!', 'success');
      }
      setShowKnowledgeModal(false);
      loadKnowledgeDocs();
    } catch (err) {
      notify(err?.message || 'Không thể lưu tài liệu.', 'error');
    } finally {
      setKnowledgeSubmitting(false);
    }
  };

  const handleDeleteKnowledge = async (doc) => {
    const ok = await confirm({
      title: 'Xác nhận xóa tài liệu SOP',
      message: `Bạn có chắc chắn muốn xóa tài liệu "${doc.title}"? AI Copilot sẽ không còn truy xuất nội dung này nữa.`,
      confirmLabel: 'Xác nhận xóa',
      cancelLabel: 'Hủy'
    });
    if (!ok) return;

    try {
      await api.delete(`/knowledge/${doc.id}`);
      notify('Đã xóa tài liệu SOP thành công!', 'success');
      loadKnowledgeDocs();
    } catch (err) {
      notify(err?.message || 'Không thể xóa tài liệu.', 'error');
    }
  };

  const handleSeedKnowledge = async () => {
    setSeedingKnowledge(true);
    try {
      const res = await api.post('/knowledge/seed');
      notify(res?.message || 'Đã nạp 6 tài liệu quy trình chuẩn SOP thành công!', 'success');
      loadKnowledgeDocs();
    } catch (err) {
      notify(err?.message || 'Lỗi khi khởi tạo tài liệu mẫu.', 'error');
    } finally {
      setSeedingKnowledge(false);
    }
  };

  // =========================================================================
  // AI TRAINING HUB (TRUNG TÂM HUẤN LUYỆN & ĐÀO TẠO AI) STATE & HANDLERS
  // =========================================================================
  const [aiAuditLogs, setAiAuditLogs] = useState([]);
  const [aiPendingFeedback, setAiPendingFeedback] = useState([]);
  const [aiDynamicSkills, setAiDynamicSkills] = useState([]);
  const [aiStats, setAiStats] = useState(null);
  const [aiTrainingLoading, setAiTrainingLoading] = useState(false);
  const [aiTrainingSubTab, setAiTrainingSubTab] = useState('feedbacks'); // 'feedbacks' | 'audit_logs' | 'sql_skills'
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [trainingMode, setTrainingMode] = useState('SQL'); // 'SQL' | 'KNOWLEDGE'
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [testingSql, setTestingSql] = useState(false);
  const [fixingSql, setFixingSql] = useState(false);
  const [testSqlResult, setTestSqlResult] = useState(null);

  const [trainingForm, setTrainingForm] = useState({
    feedbackId: null,
    question: '',
    // Dành cho SQL Skill
    sql: '',
    description: '',
    // Dành cho Knowledge SOP
    title: '',
    category: 'WARRANTY_RMA',
    content: ''
  });

  const loadAiTrainingData = async () => {
    setAiTrainingLoading(true);
    try {
      const [logsRes, feedbackRes, skillsRes, statsRes] = await Promise.all([
        api.get('/ai/audit-logs').catch(() => ({ data: [] })),
        api.get('/ai/feedback/pending').catch(() => ({ data: [] })),
        api.get('/ai/dynamic-skills').catch(() => ({ data: [] })),
        api.get('/ai/stats').catch(() => ({ data: null }))
      ]);
      setAiAuditLogs(logsRes?.data || []);
      setAiPendingFeedback(feedbackRes?.data || []);
      setAiDynamicSkills(skillsRes?.data || []);
      setAiStats(statsRes?.data || null);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu AI Training Hub:', err.message);
    } finally {
      setAiTrainingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai-training') {
      loadAiTrainingData();
    }
  }, [activeTab]);

  const getSmartInitialSql = (q) => {
    const lower = (q || '').toLowerCase();
    if (/(doanh thu|doanh số|tiền thu|thu được)/.test(lower)) {
      if (/(năm nay|cả năm|năm 2026)/.test(lower)) {
        return `SELECT SUM(total_amount) AS doanh_thu_nam_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
      }
      if (/(tháng trước)/.test(lower)) {
        return `SELECT SUM(total_amount) AS doanh_thu_thang_truoc FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 month' AND created_at < date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
      }
      if (/(tháng này|trong tháng)/.test(lower)) {
        return `SELECT SUM(total_amount) AS doanh_thu_thang_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
      }
      if (/(quý này|quý)/.test(lower)) {
        return `SELECT SUM(total_amount) AS doanh_thu_quy_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('quarter', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
      }
      if (/(hôm qua)/.test(lower)) {
        return `SELECT SUM(total_amount) AS doanh_thu_hom_qua FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 day' AND created_at < date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
      }
      if (/(hôm nay|trong ngày)/.test(lower)) {
        return `SELECT SUM(total_amount) AS doanh_thu_hom_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
      }
      if (/(từng tháng|mỗi tháng)/.test(lower)) {
        return `SELECT to_char(created_at, 'YYYY-MM') AS thang, COUNT(*) AS so_don, SUM(total_amount) AS doanh_thu FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY thang ORDER BY thang ASC;`;
      }
      return `SELECT SUM(total_amount) AS doanh_thu_nam_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    // "đơn cod" / "cod chưa nộp tiền" / "chưa thu tiền cod"
    if (/(cod|thu hộ)/.test(lower) && /(chưa|nộp|tiền|thu)/.test(lower)) {
      return `SELECT order_id, total_amount, payment_status, status, shipping_address FROM orders WHERE payment_method = 'COD' AND payment_status != 'PAID' ORDER BY created_at DESC LIMIT 15;`;
    }
    // "đơn chưa thanh toán" / "nợ tiền"
    if (/(chưa thanh toán|chưa trả tiền|nợ)/.test(lower)) {
      return `SELECT order_id, total_amount, payment_status, status, created_at FROM orders WHERE payment_status = 'UNPAID' ORDER BY total_amount DESC LIMIT 15;`;
    }
    // "đơn tồn" / "đơn hàng tồn đọng" / "đơn chờ xuất kho"
    if (/đơn/.test(lower) && /(tồn|chưa giao|chờ xuất|đọng)/.test(lower)) {
      return `SELECT order_id, total_amount, status, created_at FROM orders WHERE status NOT IN ('COMPLETED', 'DELIVERED', 'CANCELLED') ORDER BY created_at DESC LIMIT 15;`;
    }
    if (/(hết hàng|tồn.*=.*0|tồn.*bằng 0)/.test(lower)) {
      return `SELECT product_id, name, price, stock_quantity, status FROM products WHERE stock_quantity = 0 AND status = 'ACTIVE' LIMIT 15;`;
    }
    if (/(tồn kho|sản phẩm|linh kiện)/.test(lower)) {
      return `SELECT product_id, name, sku, stock_quantity, price FROM products WHERE stock_quantity > 0 ORDER BY stock_quantity DESC LIMIT 15;`;
    }
    if (/(đang giao|đang ship)/.test(lower)) {
      return `SELECT order_id, total_amount, shipping_address, status, created_at FROM orders WHERE status = 'SHIPPED' ORDER BY created_at DESC LIMIT 15;`;
    }
    if (/(chờ giao|chờ ship)/.test(lower)) {
      return `SELECT order_id, total_amount, shipping_address, status, created_at FROM orders WHERE status = 'READY_TO_SHIP' ORDER BY created_at ASC LIMIT 15;`;
    }
    return `SELECT order_id, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10;`;
  };

  const handleOpenTrainingModal = async (item, isFeedback = false) => {
    const questionText = isFeedback ? (item.correction?.trim() || item.prompt) : item.userPrompt;
    const initialSql = getSmartInitialSql(questionText) || getSmartInitialSql(item.prompt);
    
    // Khởi tạo form với template ban đầu chuẩn xác tức thì
    setTrainingForm({
      feedbackId: isFeedback ? item.id : null,
      question: questionText || '',
      sql: initialSql,
      description: isFeedback && item.correction ? `Huấn luyện từ phản hồi góp ý: "${item.correction}" (câu hỏi gốc: "${item.prompt}")` : `Kỹ năng huấn luyện từ câu hỏi: ${questionText?.slice(0, 100)}`,
      title: questionText ? `Quy trình & Hướng dẫn: ${questionText.slice(0, 50)}` : '',
      category: 'WARRANTY_RMA',
      content: item.correction || item.aiResponse || ''
    });
    setTrainingMode('SQL');
    setTestSqlResult(null);
    setShowTrainingModal(true);

    // Tự động gọi backend để phân tích sâu hơn hoặc bổ sung Few-Shot động
    try {
      const suggestRes = await api.post('/ai/suggest-sql', { question: questionText });
      if (suggestRes?.sql) {
        setTrainingForm(prev => ({ ...prev, sql: suggestRes.sql }));
      }
    } catch (e) {
      // Đã có initialSql thông minh, giữ nguyên không bị gián đoạn
    }
  };

  const handleTestSql = async () => {
    if (!trainingForm.sql.trim()) {
      notify('Vui lòng nhập câu lệnh SQL cần kiểm thử.', 'warning');
      return;
    }
    setTestingSql(true);
    setTestSqlResult(null);
    try {
      // Thực thi trực tiếp câu lệnh SQL trên Database qua API /ai/test-sql
      const res = await api.post('/ai/test-sql', { 
        sql: trainingForm.sql,
        question: trainingForm.question 
      });
      if (res?.success) {
        let displayContent = JSON.stringify(res.data.rows, null, 2);
        // Nếu là kết quả tổng hợp số tiền / doanh thu thì định dạng thêm VND
        if (res.data.rows?.length === 1 && typeof res.data.rows[0] === 'object') {
          const firstRow = res.data.rows[0];
          const entries = Object.entries(firstRow);
          if (entries.length === 1 && !isNaN(Number(entries[0][1]))) {
            const val = Number(entries[0][1]);
            displayContent = `💰 [KẾT QUẢ TÍNH TOÁN]: ${val.toLocaleString('vi-VN')} VNĐ (${entries[0][0]})\n\n` + displayContent;
          }
        }
        setTestSqlResult({
          success: true,
          preview: `✅ Truy vấn thành công (${res.data.rowCount} bản ghi trả về):\n` + displayContent
        });
        notify(`Kiểm thử SQL thành công (${res.data.rowCount} bản ghi)`, 'success');
      }
    } catch (err) {
      setTestSqlResult({
        success: false,
        error: err?.message || 'Lỗi khi thực thi câu lệnh SQL trên cơ sở dữ liệu.'
      });
      notify('Câu lệnh SQL bị lỗi.', 'error');
    } finally {
      setTestingSql(false);
    }
  };

  const handleAutoFixSql = async () => {
    if (!testSqlResult?.error && !trainingForm.sql) return;
    setFixingSql(true);
    try {
      const res = await api.post('/ai/fix-sql', {
        sql: trainingForm.sql,
        error: testSqlResult?.error || '',
        question: trainingForm.question
      });
      if (res?.success && res.fixedSql) {
        setTrainingForm(prev => ({ ...prev, sql: res.fixedSql }));
        notify('AI đã tự động sửa câu lệnh SQL! Đang kiểm thử lại...', 'success');
        
        // Tự động kiểm thử lại với câu SQL mới vừa sửa
        setTimeout(async () => {
          setTestingSql(true);
          try {
            const testRes = await api.post('/ai/test-sql', { 
              sql: res.fixedSql, 
              question: trainingForm.question 
            });
            if (testRes?.success) {
              let displayContent = JSON.stringify(testRes.data.rows, null, 2);
              if (testRes.data.rows?.length === 1 && typeof testRes.data.rows[0] === 'object') {
                const firstRow = testRes.data.rows[0];
                const entries = Object.entries(firstRow);
                if (entries.length === 1 && !isNaN(Number(entries[0][1]))) {
                  const val = Number(entries[0][1]);
                  displayContent = `💰 [KẾT QUẢ TÍNH TOÁN]: ${val.toLocaleString('vi-VN')} VNĐ (${entries[0][0]})\n\n` + displayContent;
                }
              }
              setTestSqlResult({
                success: true,
                preview: `✅ AI đã sửa và kiểm thử thành công (${testRes.data.rowCount} bản ghi):\n` + displayContent
              });
              notify('Kiểm thử SQL thành công!', 'success');
            }
          } catch (e2) {
            setTestSqlResult({ success: false, error: e2?.message || 'Lỗi khi kiểm thử lại.' });
          } finally {
            setTestingSql(false);
          }
        }, 300);
      }
    } catch (err) {
      notify('Không thể tự động sửa SQL: ' + (err?.message || 'Lỗi không xác định'), 'error');
    } finally {
      setFixingSql(false);
    }
  };

  const handleSaveTrainingSkill = async () => {
    if (!trainingForm.question.trim()) {
      notify('Vui lòng nhập câu hỏi mẫu.', 'warning');
      return;
    }

    try {
      if (trainingMode === 'SQL') {
        if (!trainingForm.sql.trim()) {
          notify('Vui lòng nhập câu lệnh SQL mẫu.', 'warning');
          return;
        }
        await api.post('/ai/dynamic-skills', {
          question: trainingForm.question,
          sql: trainingForm.sql,
          description: trainingForm.description,
          feedbackId: trainingForm.feedbackId
        });
        notify('Đã huấn luyện kỹ năng SQL cho AI Copilot thành công!', 'success');
      } else {
        // Nạp vào Knowledge Base SOP
        if (!trainingForm.title.trim() || !trainingForm.content.trim()) {
          notify('Vui lòng nhập tiêu đề và nội dung quy chế.', 'warning');
          return;
        }
        if (trainingForm.feedbackId) {
          await api.post(`/ai/feedback/${trainingForm.feedbackId}/review`, {
            action: 'APPROVE',
            title: trainingForm.title,
            category: trainingForm.category,
            content: trainingForm.content
          });
        } else {
          await api.post('/knowledge', {
            title: trainingForm.title,
            category: trainingForm.category,
            summary: `Được huấn luyện từ câu hỏi: ${trainingForm.question.slice(0, 200)}`,
            content: trainingForm.content,
            allowedRoles: ['ALL'],
            status: 'PUBLISHED'
          });
        }
        notify('Đã nạp văn bản mới vào Kho Tri Thức SOP của AI!', 'success');
      }

      setShowTrainingModal(false);
      loadAiTrainingData();
    } catch (err) {
      notify(err?.message || 'Lưu huấn luyện thất bại.', 'error');
    }
  };

  const handleDeleteDynamicSkill = async (skillId) => {
    try {
      await api.delete(`/ai/dynamic-skills/${skillId}`);
      notify('Đã xóa kỹ năng huấn luyện.', 'success');
      loadAiTrainingData();
    } catch (err) {
      notify(err?.message || 'Không thể xóa kỹ năng.', 'error');
    }
  };

  // RBAC Selected Role & Matrix State
  const [selectedRbacRole, setSelectedRbacRole] = useState('SALES_MANAGER');
  const [savedRbacMatrix, setSavedRbacMatrix] = useState(() => getOperationalRbac());
  const [rbacMatrix, setRbacMatrix] = useState(() => getOperationalRbac());
  const [showOnlyRelevant, setShowOnlyRelevant] = useState(true);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  // 3 khung nhìn của trang RBAC: Tổng Quan (ma trận so sánh mọi vai trò),
  // Chỉnh Sửa (biên tập chi tiết theo từng vai trò — cùng logic cũ), và
  // Lịch Sử (audit log thật đã ghi mỗi lần Lưu Phân Quyền, lọc theo module).
  const [rbacView, setRbacView] = useState('overview');
  const [rbacSearchQuery, setRbacSearchQuery] = useState('');

  // rbacMatrix/savedRbacMatrix above may have been captured before
  // loadRbacFromServer() (stores/index.js) finished its first real fetch — once
  // it resolves it dispatches 'erp-rbac-changed', so re-sync from the now-fresh
  // cache instead of staying on whatever DEFAULT_OPERATIONAL_MATRIX snapshot
  // this component happened to mount with.
  useEffect(() => {
    const handleRbacLoaded = () => {
      const fresh = getOperationalRbac();
      setSavedRbacMatrix(fresh);
      setRbacMatrix(fresh);
    };
    window.addEventListener('erp-rbac-changed', handleRbacLoaded);
    return () => window.removeEventListener('erp-rbac-changed', handleRbacLoaded);
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(rbacMatrix) !== JSON.stringify(savedRbacMatrix);
  }, [rbacMatrix, savedRbacMatrix]);

  const handleToggleOperation = (roleCode, opId, enabled) => {
    if (roleCode === 'ADMIN') return;
    setRbacMatrix(prev => {
      const rolePerms = prev[roleCode] || {};
      return {
        ...prev,
        [roleCode]: {
          ...rolePerms,
          [opId]: enabled
        }
      };
    });
  };

  const handleToggleModule = (roleCode, moduleId, enabled) => {
    if (roleCode === 'ADMIN') return;
    const moduleOps = OPERATIONAL_PERMISSIONS.filter(op => op.moduleId === moduleId);
    setRbacMatrix(prev => {
      const rolePerms = { ...(prev[roleCode] || {}) };
      if (enabled) {
        // If enabling module, turn on either default ops for this role in this module or all ops in this module
        const defaultRoleOps = DEFAULT_OPERATIONAL_MATRIX[roleCode] || {};
        const hasAnyDefaultInMod = moduleOps.some(op => defaultRoleOps[op.id]);
        moduleOps.forEach(op => {
          rolePerms[op.id] = hasAnyDefaultInMod ? Boolean(defaultRoleOps[op.id]) : true;
        });
        if (moduleOps.every(op => !rolePerms[op.id])) {
          moduleOps.forEach(op => { rolePerms[op.id] = true; });
        }
      } else {
        // Disable all operations in this module
        moduleOps.forEach(op => {
          rolePerms[op.id] = false;
        });
      }
      return {
        ...prev,
        [roleCode]: rolePerms
      };
    });
  };

  const handleSetAllForModuleOps = (roleCode, moduleId, enableAll) => {
    if (roleCode === 'ADMIN') return;
    const moduleOps = OPERATIONAL_PERMISSIONS.filter(op => op.moduleId === moduleId);
    setRbacMatrix(prev => {
      const rolePerms = { ...(prev[roleCode] || {}) };
      moduleOps.forEach(op => {
        rolePerms[op.id] = enableAll;
      });
      return {
        ...prev,
        [roleCode]: rolePerms
      };
    });
  };

  const handleBatchSetRoleOperations = (roleCode, actionType) => {
    if (roleCode === 'ADMIN') return;
    setRbacMatrix(prev => {
      const rolePerms = { ...(prev[roleCode] || {}) };
      if (actionType === 'ENABLE_ALL') {
        OPERATIONAL_PERMISSIONS.forEach(op => { rolePerms[op.id] = true; });
      } else if (actionType === 'CLEAR_ALL') {
        OPERATIONAL_PERMISSIONS.forEach(op => { rolePerms[op.id] = false; });
      } else if (actionType === 'RESET_DEFAULT') {
        const defaultRolePerms = DEFAULT_OPERATIONAL_MATRIX[roleCode] || {};
        return {
          ...prev,
          [roleCode]: { ...defaultRolePerms }
        };
      }
      return { ...prev, [roleCode]: rolePerms };
    });
  };

  const handleOpenSaveConfirm = () => {
    setShowSaveConfirmModal(true);
  };

  const handleConfirmSaveRbacMatrix = async () => {
    try {
      await saveOperationalRbac(rbacMatrix);
      setSavedRbacMatrix(rbacMatrix);
      setShowSaveConfirmModal(false);
      notify('Đã lưu và áp dụng cấu hình phân quyền nghiệp vụ mới thành công!', 'success');
    } catch (err) {
      notify(`Lưu cấu hình phân quyền thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    }
  };

  const handleDiscardChanges = async () => {
    if (await confirm('Hủy bỏ toàn bộ các thay đổi chưa lưu và khôi phục về cấu hình đã lưu gần nhất?', { danger: true })) {
      setRbacMatrix(savedRbacMatrix);
    }
  };

  const handleResetDefaultRbac = async () => {
    if (await confirm('Khôi phục phân quyền nghiệp vụ của toàn bộ hệ thống về mặc định tiêu chuẩn? Bạn cần bấm "Lưu Phân Quyền" và xác nhận để áp dụng.', { danger: true })) {
      setRbacMatrix(DEFAULT_OPERATIONAL_MATRIX);
    }
  };

  // System Configuration State
  // Trước đây các giá trị này được hardcode sẵn như thể đã cấu hình thật
  // ("AetherPC Technology ERP JSC", MST giả...) trong khi nút "Lưu" không hề
  // lưu gì cả — giờ để trống, nạp thật từ GET /system/settings khi mount.
  const [companyConfig, setCompanyConfig] = useState({
    companyName: '',
    taxCode: '',
    hotline: '',
    address: '',
    salesCommissionFlat: 1250000,
    assemblyBonus: 750000,
    defaultVat: 10,
    lowStockThreshold: 5
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [restoringData, setRestoringData] = useState(false);

  // Trước đây thẻ "Trạng Thái Hạ Tầng" hardcode cứng "Đang chạy (Healthy)" /
  // "Kết nối hoàn hảo" — không hề gọi gì để biết thật. GET /system/settings đã
  // phải chạm tới backend + Postgres (qua Prisma) để trả kết quả, nên dùng
  // ngay chính lần gọi đó làm tín hiệu "backend & DB còn sống" thay vì thêm 1
  // request ping riêng — thành công = 'ok', lỗi (mất kết nối/500...) = 'down'.
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'ok' | 'down'

  const loadCompanySettings = async () => {
    setServerStatus('checking');
    try {
      const res = await api.get('/system/settings');
      if (res?.success && res.data) {
        const d = res.data;
        setCompanyConfig({
          companyName: d.companyName || '',
          taxCode: d.taxCode || '',
          hotline: d.hotline || '',
          address: d.address || '',
          salesCommissionFlat: Number(d.salesCommissionFlat) || 0,
          assemblyBonus: Number(d.assemblyBonus) || 0,
          defaultVat: Number(d.defaultVat) || 0,
          lowStockThreshold: Number(d.lowStockThreshold) || 5
        });
      }
      setServerStatus(res?.success ? 'ok' : 'down');
    } catch (err) {
      console.warn('Không tải được cấu hình doanh nghiệp:', err.message);
      setServerStatus('down');
    }
  };

  useEffect(() => { loadCompanySettings(); }, []);

  // Nhật ký kiểm toán — trước đây là 7 dòng hardcode cứng (ngày cố định
  // 18/08/2026, IP giả), không hề phản ánh hành động thật nào. Giờ nạp thật từ
  // GET /system/audit-logs (bảng AuditLog, ghi bởi logAudit() ở các điểm nhạy
  // cảm thật: đăng nhập thất bại, đổi mật khẩu, tạo/sửa nhân viên, duyệt PO,
  // duyệt/giải ngân lương, đổi RBAC, backup/restore).
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Trước đây chỉ fetch khi activeTab === 'audit' — nghĩa là 2 thẻ KPI ở tab
  // Tổng Quan dựa vào auditLogs (cảnh báo an ninh, số thao tác) luôn hiện sai
  // (0/rỗng) cho tới khi người dùng từng ghé tab Audit ít nhất 1 lần. Nạp 1 lần
  // khi mount để Tổng Quan đúng ngay từ đầu.
  useEffect(() => {
    setLoadingAuditLogs(true);
    (async () => {
      try {
        const res = await api.get('/system/audit-logs?limit=200');
        if (res?.success) {
          setAuditLogs((res.data || []).map(l => ({
            id: l.id,
            user: l.actorName || 'Hệ thống',
            action: l.action,
            module: l.module,
            note: l.note || '',
            timestamp: new Date(l.createdAt).toLocaleString('vi-VN'),
            ip: l.ipAddress || '—',
            status: l.status
          })));
        }
      } catch (err) {
        console.warn('Không tải được nhật ký kiểm toán:', err.message);
      } finally {
        setLoadingAuditLogs(false);
      }
    })();
  }, []);

  const [form, setForm] = useState({
    fullname: '',
    username: '',
    role: 'SALES',
    department: 'Kinh Doanh',
    deliveryRegion: 'HCM_KV1',
    phone: '',
    salary: '8500000',
    password: ''
  });

  const fmt = n => new Intl.NumberFormat('vi-VN').format(n || 0);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const q = search.toLowerCase();
      const matchesSearch = !search || 
        e.fullname?.toLowerCase().includes(q) || 
        e.username?.toLowerCase().includes(q) || 
        e.role?.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'ALL' || e.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [employees, search, roleFilter]);

  // KPI Stats — "Cảnh Báo An Ninh" và "Thao Tác Ghi Nhận" trước đây là 2 thẻ
  // riêng cùng đọc auditLogs, gộp lại thành 1 thẻ Nhật Ký Kiểm Toán cho đỡ rối
  // mắt (đủ thông tin: tổng số + số thất bại trong cùng 1 chỗ). Thẻ CSDL trước
  // đây ghi cứng "Online 99.9%" — giờ phản ánh đúng serverStatus (xem
  // loadCompanySettings ở trên).
  const failedSecurityCount = auditLogs.filter(l => l.status === 'FAILED').length;
  const dbStatusLabel = serverStatus === 'ok' ? 'Trực tuyến' : serverStatus === 'down' ? 'Mất kết nối' : 'Đang kiểm tra...';
  const dbStatusVariant = serverStatus === 'ok' ? 'success' : serverStatus === 'down' ? 'danger' : 'warning';
  const dbStatusColor = BADGE_VARIANTS[dbStatusVariant].color;
  const stats = [
    { label: 'Tài Khoản Nhân Sự', value: `${employees.length} tài khoản`, change: 'Đang hoạt động trên hệ thống', icon: <Users size={20} />, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Vai Trò Định Danh', value: `${ROLES.length} Roles`, change: 'Phân quyền độc lập theo Actor', icon: <Shield size={20} />, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Nhật Ký Kiểm Toán', value: `${auditLogs.length} sự kiện`, change: `${failedSecurityCount} cảnh báo thất bại (đăng nhập sai...)`, icon: <Activity size={20} />, color: failedSecurityCount > 0 ? '#ef4444' : '#16a34a', bg: failedSecurityCount > 0 ? '#fef2f2' : '#f0fdf4' },
    { label: 'Cơ Sở Dữ Liệu PostgreSQL', value: dbStatusLabel, change: 'Docker Container kltn_postgres', icon: <Database size={20} />, color: dbStatusColor, bg: '#f0f9ff' },
    { label: 'Dữ Liệu Vận Hành', value: `${orders.length + inventory.length + purchaseOrders.length} bản ghi`, change: 'Đơn hàng, linh kiện kho & PO', icon: <HardDrive size={20} />, color: '#d97706', bg: '#fffbeb' }
  ];

  // Department distribution chart data — trước đây có fallback số bịa
  // [4,3,2,2,1] khi chưa có nhân viên, hiện dùng empty-state thật thay vì số giả.
  const deptCounts = {};
  employees.forEach(emp => {
    const dept = emp.department || 'Kinh Doanh';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });
  const deptChartData = {
    labels: Object.keys(deptCounts),
    datasets: [
      {
        data: Object.values(deptCounts),
        backgroundColor: ['#3b82f6', '#10b981', '#0ea5e9', '#ec4899', '#f59e0b', '#8b5cf6', '#64748b']
      }
    ]
  };

  // Trước đây là số bịa theo từng mốc giờ cố định ([12,28,45,32,20,38,15]),
  // không hề tính từ đâu cả. auditLogs đã có module thật cho mỗi sự kiện —
  // đếm theo phân hệ vừa là dữ liệu thật, vừa không ngộ nhận độ chính xác theo
  // giờ mà hệ thống không thực sự đo được.
  const moduleActivityCounts = {};
  auditLogs.forEach(l => {
    const key = l.module || 'Khác';
    moduleActivityCounts[key] = (moduleActivityCounts[key] || 0) + 1;
  });
  const moduleActivityData = {
    labels: Object.keys(moduleActivityCounts),
    datasets: [
      {
        label: 'Số Lượng Thao Tác',
        data: Object.values(moduleActivityCounts),
        backgroundColor: '#2563eb'
      }
    ]
  };

  const handleAddEmployee = () => {
    if (!form.fullname || !form.username || !form.salary) {
      notify('Vui lòng điền đầy đủ họ tên, username và lương cơ bản.', 'error');
      return;
    }
    if (parseInt(form.salary) < 1000000) {
      notify('Lương cơ bản phải từ 1.000.000 VNĐ trở lên.', 'error');
      return;
    }
    const regionToSave = form.role === 'DELIVERY' ? form.deliveryRegion : null;
    const phoneToSave = form.role === 'DELIVERY' ? form.phone : '';
    if (typeof addEmployee === 'function') {
      addEmployee(form.fullname, form.username, form.role, form.salary, form.department, regionToSave, phoneToSave);
    }
    setForm({ fullname: '', username: '', role: 'SALES', department: 'Kinh Doanh', deliveryRegion: 'HCM_KV1', phone: '', salary: '8500000', password: '' });
    setShowAdd(false);
    notify(`Tài khoản nhân viên "${form.fullname}" (${form.username}) đã được tạo thành công. Mật khẩu mặc định: 123456`, 'success');
  };

  const handleResetPassword = async (emp) => {
    if (!(await confirm(`Xác nhận ĐẶT LẠI MẬT KHẨU cho tài khoản "${emp.username}" về mật khẩu mặc định "123456"?`, { danger: true }))) return;
    try {
      const res = await api.patch(`/hr/employees/${emp.id}/reset-password`);
      if (!res?.success) throw new Error(res?.message || 'Không thể đặt lại mật khẩu.');
      notify(`Mật khẩu của tài khoản "${emp.username}" đã được đặt lại thành công về: 123456`, 'success');
    } catch (err) {
      notify(`Đặt lại mật khẩu thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    }
  };

  const handleSaveCompanySettings = async () => {
    setSavingSettings(true);
    try {
      const res = await api.put('/system/settings', companyConfig);
      if (!res?.success) throw new Error(res?.message || 'Không thể lưu cấu hình.');
      notify('Đã lưu cấu hình thông tin doanh nghiệp thành công.', 'success');
    } catch (err) {
      notify(`Lưu cấu hình thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Trước đây hàm này chỉ xuất employees/orders/inventory/purchaseOrders đang
  // có trong state frontend — thiếu tuyệt đại đa số bảng thật (GRN, QC, trả
  // hàng, sổ cái, chấm công...). Giờ gọi thẳng pg_dump thật ở backend (GET
  // /system/backup), cùng cơ chế với backup-db.ps1 ở gốc dự án.
  const handleBackupData = async () => {
    try {
      const res = await fetch('/api/v1/system/backup', { credentials: 'include' });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || `Lỗi máy chủ (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `AetherPC_ERP_Backup_${new Date().toISOString().slice(0, 10)}.dump`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
      notify('Đã tải xuống bản sao lưu đầy đủ (pg_dump) toàn bộ cơ sở dữ liệu.', 'success');
    } catch (err) {
      notify(`Sao lưu thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    }
  };

  const restoreFileInputRef = React.useRef(null);

  // Trước đây nút "Khôi Phục Dữ Liệu" chỉ hiện toast hướng dẫn, không có input
  // file, không có logic khôi phục nào cả. Giờ gọi pg_restore thật (POST
  // /system/restore) — thao tác PHÁ HUỶ dữ liệu hiện tại nên bắt xác nhận rõ.
  const handleRestoreFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!(await confirm(
      `Khôi phục từ file "${file.name}" sẽ XOÁ TOÀN BỘ dữ liệu hiện tại trong hệ thống và thay bằng dữ liệu trong file backup này. Hành động không thể hoàn tác. Tiếp tục?`,
      { danger: true }
    ))) return;

    setRestoringData(true);
    try {
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await api.post('/system/restore', { fileBase64, confirm: true });
      if (!res?.success) throw new Error(res?.message || 'Khôi phục thất bại.');
      notify('Đã khôi phục dữ liệu thành công. Tải lại trang để thấy dữ liệu mới.', 'success');
    } catch (err) {
      notify(`Khôi phục thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
    } finally {
      setRestoringData(false);
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
            <Settings size={24} style={{ color: '#2563eb' }} />
            {activeTab === 'overview' && 'Tổng Quan Quản Trị Hệ Thống'}
            {activeTab === 'users' && 'Quản Lý Tài Khoản & Người Dùng'}
            {activeTab === 'bank-accounts' && 'Tài Khoản Ngân Hàng Doanh Nghiệp (VietQR)'}
            {activeTab === 'rbac' && 'Ma Trận Phân Quyền Vai Trò'}
            {activeTab === 'knowledge' && 'Cơ Sở Tri Thức & Quy Trình SOP Doanh Nghiệp'}
            {activeTab === 'ai-training' && 'Trung Tâm Huấn Luyện & Đào Tạo AI (AI Training Hub)'}
            {activeTab === 'audit' && 'Nhật Ký Kiểm Toán & Giám Sát'}
            {activeTab === 'settings' && 'Cấu Hình & Sao Lưu Dữ Liệu'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            {activeTab === 'knowledge' 
              ? 'Quản lý tài liệu chính sách, quy định chuẩn vận hành (SOP) tích hợp bộ não AetherCopilot AI'
              : activeTab === 'ai-training'
              ? 'Kiểm duyệt câu hỏi thực tế của người dùng, phân loại tri thức SOP và huấn luyện câu lệnh SQL động cho AI'
              : 'Quản trị người dùng, tài khoản doanh nghiệp, phân quyền chi tiết cho từng vai trò và sao lưu dữ liệu an toàn'}
          </p>
        </div>

        {activeTab === 'users' && (
          <button
            onClick={() => setShowAdd(true)}
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
            <Plus size={16} />
            <span>Thêm Nhân Viên Mới</span>
          </button>
        )}

        {activeTab === 'bank-accounts' && (
          <button
            onClick={() => handleOpenBankModal()}
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
            <Plus size={16} />
            <span>Thêm Tài Khoản Ngân Hàng</span>
          </button>
        )}

        {activeTab === 'knowledge' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleSeedKnowledge}
              disabled={seedingKnowledge}
              style={{
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: seedingKnowledge ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <RefreshCw size={14} className={seedingKnowledge ? 'animate-spin' : ''} />
              <span>{seedingKnowledge ? 'Đang tạo mẫu...' : 'Khởi Tạo 6 Quy Trình Mẫu'}</span>
            </button>
            <button
              onClick={() => handleOpenKnowledgeModal()}
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
              <Plus size={16} />
              <span>Thêm Tài Liệu SOP</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (TỔNG QUAN QUẢN TRỊ) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* 5 thẻ KPI, mỗi thẻ 1 con số khác biệt thật sự (đã gộp 2 thẻ cùng
              đọc audit log trước đây thành 1). Số lẻ (5) không chia hết cho các
              mốc cột thường gặp — auto-fill từng để thẻ cuối rớt xuống hàng
              riêng, nằm lẻ bên trái với khoảng trống lớn bên phải. Cố định lưới
              6 cột, 3 thẻ đầu chiếm 2 cột/thẻ (hàng 1 đầy), 2 thẻ sau chiếm 3
              cột/thẻ (hàng 2 đầy) — luôn cân đối bất kể độ rộng màn hình. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            {stats.map((st, sIdx) => (
              <div
                key={sIdx}
                style={{
                  gridColumn: sIdx < 3 ? 'span 2' : 'span 3',
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
            {/* Department Chart */}
            <div style={{ ...cardStyle, height: '320px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Phân Bổ Nhân Sự Theo Phòng Ban
              </h3>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {Object.keys(deptCounts).length === 0 ? (
                  <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontStyle: 'italic' }}>Chưa có dữ liệu nhân sự.</span>
                ) : (
                  <Doughnut
                    data={deptChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Module Activity Chart — trước đây là biểu đồ giờ với số bịa */}
            <div style={{ ...cardStyle, height: '320px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                Thao Tác Theo Phân Hệ (Nhật Ký Kiểm Toán)
              </h3>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {Object.keys(moduleActivityCounts).length === 0 ? (
                  <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontStyle: 'italic' }}>
                    {loadingAuditLogs ? 'Đang tải nhật ký...' : 'Chưa có sự kiện nào được ghi nhận.'}
                  </span>
                ) : (
                  <Bar
                    data={moduleActivityData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
                      scales: {
                        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, precision: 0 } },
                        x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0' }}>
                Tài Khoản Vừa Tạo Gần Đây
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {employees.slice(0, 3).map((emp, eIdx) => (
                  <div key={eIdx} style={{ padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{emp.fullname}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Username: {emp.username}</span>
                    </div>
                    <span style={{ backgroundColor: `${ROLE_COLORS[emp.role] || '#6366f1'}15`, color: ROLE_COLORS[emp.role] || '#6366f1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                      {emp.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.85rem 0' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Trạng Thái Hạ Tầng & Backup
                </h3>
                <button
                  onClick={loadCompanySettings}
                  title="Kiểm tra lại kết nối"
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
                {/* Trước đây 2 dòng "Đang chạy (Healthy)" / "Kết nối hoàn hảo" bên
                    dưới là hardcode cứng, không hề gọi gì để biết thật — giờ phản
                    ánh đúng kết quả gọi GET /system/settings gần nhất (serverStatus). */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem',
                  backgroundColor: BADGE_VARIANTS[dbStatusVariant].bg,
                  borderRadius: '6px',
                  border: `1px solid ${BADGE_VARIANTS[dbStatusVariant].border}`
                }}>
                  <span>Backend & Cơ Sở Dữ Liệu:</span>
                  <strong style={{ color: dbStatusColor }}>{dbStatusLabel}</strong>
                </div>
                <button
                  onClick={handleBackupData}
                  style={{ ...primaryBtnStyle, padding: '0.5rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Download size={14} /> Sao Lưu Dữ Liệu Ngay
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: USERS (QUẢN LÝ TÀI KHOẢN) */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <>
        <div style={cardStyle}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>Tài Khoản Nhân Viên</h3>
          
          {/* Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <input
                type="text"
                placeholder="Tìm theo họ tên, username, vai trò..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>Lọc Vai Trò:</span>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', color: '#0f172a' }}
              >
                <option value="ALL">Tất cả ({employees.length})</option>
                {ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* User Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Mã NV</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Họ và Tên</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Username Đăng Nhập</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Vai Trò</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Phòng Ban</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Lương Cơ Bản</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Thao Tác Admin</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, i) => (
                  <tr key={emp.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#64748b' }}>NV-{emp.id || i + 1}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{emp.fullname}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <code style={{ fontSize: '0.8rem', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                        {emp.username}
                      </code>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          backgroundColor: `${ROLE_COLORS[emp.role] || '#6366f1'}15`,
                          color: ROLE_COLORS[emp.role] || '#6366f1'
                        }}>
                          {emp.role}
                        </span>
                        {emp.role === 'DELIVERY' && emp.deliveryRegion && (
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe'
                          }}>
                            {DELIVERY_REGIONS.find(r => r.code === emp.deliveryRegion)?.shortName || emp.deliveryRegion}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>{emp.department || 'Kinh Doanh'}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(emp.salary)} ₫</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleResetPassword(emp)}
                          style={{ backgroundColor: '#ffffff', color: '#d97706', border: '1px solid #fde68a', borderRadius: '4px', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          title="Đặt lại mật khẩu về 123456"
                        >
                          <Key size={12} /> Reset Pass
                        </button>
                        <button
                          onClick={() => setEditingEmp({ ...emp })}
                          style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <Edit size={12} /> Sửa
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirm(`Vô hiệu hóa tài khoản "${emp.fullname}"? Tài khoản sẽ không đăng nhập được nữa, lịch sử chấm công/lương/nghỉ phép vẫn được giữ nguyên.`, { danger: true })) {
                              if (typeof deleteEmployee !== 'function') return;
                              try {
                                await deleteEmployee(emp.id);
                                notify(`Đã vô hiệu hóa tài khoản "${emp.fullname}".`, 'success');
                              } catch (err) {
                                notify(`Không thể vô hiệu hóa: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
                              }
                            }
                          }}
                          title="Vô hiệu hóa tài khoản (không xóa lịch sử)"
                          style={{ backgroundColor: '#ffffff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '4px', padding: '0.3rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        {/* Tài Khoản Khách Hàng — dữ liệu thật từ /api/v1/customer-accounts */}
        <div style={{ ...cardStyle, marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Tài Khoản Khách Hàng <span style={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>({custTotal})</span>
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>
                Giám sát &amp; khóa nhanh tài khoản khách hàng. Tạo mới / chỉnh sửa chi tiết tại{' '}
                <span style={{ color: '#2563eb', fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/admin/sales?tab=customers')}>
                  Bán Hàng → Khách Hàng (CRM)
                </span>.
              </p>
            </div>
            <div style={{ position: 'relative', width: '280px' }}>
              <input
                type="text"
                placeholder="Tìm theo tên, SĐT, email..."
                value={custSearch}
                onChange={e => { setCustPage(1); setCustSearch(e.target.value); }}
                style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>

          {custLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>Đang tải...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Khách Hàng</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Liên Hệ</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: '90px' }}>Đơn Hàng</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: '110px' }}>Trạng Thái</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: '330px' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {custList.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Không tìm thấy khách hàng nào.</td></tr>
                  ) : custList.map(cust => {
                    const isInactive = cust.status !== 'ACTIVE';
                    const isBusy = custActionBusyId === cust.customerId;
                    return (
                      <tr key={cust.customerId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td 
                          style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}
                          onClick={() => handleOpenCustDetail(cust)}
                          title="Nhấn để xem chi tiết tài khoản"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ color: '#2563eb' }}>{cust.name}</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>#{cust.customerId}</div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                          <div>{cust.email}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{cust.phone || 'Chưa cập nhật'}</div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{cust.orderCount}</td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: isInactive ? '#fef2f2' : '#f0fdf4', color: isInactive ? '#dc2626' : '#16a34a' }}>
                            {isInactive ? 'Vô hiệu hóa' : 'Hoạt động'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                            <button
                              disabled={isBusy}
                              onClick={() => handleOpenCustDetail(cust)}
                              title="Xem chi tiết hồ sơ & quản lý"
                              style={{
                                width: '78px',
                                height: '28px',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem',
                                boxSizing: 'border-box'
                              }}
                            >
                              <Eye size={12} /> Chi tiết
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => handleResetCustPassword(cust)}
                              title="Đặt lại mật khẩu về 123456"
                              style={{
                                width: '96px',
                                height: '28px',
                                backgroundColor: '#ffffff',
                                color: '#d97706',
                                border: '1px solid #fde68a',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: isBusy ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem',
                                boxSizing: 'border-box'
                              }}
                            >
                              <Key size={12} /> Reset Pass
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => handleToggleCustStatus(cust)}
                              title={isInactive ? 'Kích hoạt lại tài khoản' : 'Vô hiệu hóa tài khoản'}
                              style={{
                                width: '98px',
                                height: '28px',
                                backgroundColor: isInactive ? '#f0fdf4' : '#ffffff',
                                color: isInactive ? '#16a34a' : '#ef4444',
                                border: `1px solid ${isInactive ? '#bbf7d0' : '#fca5a5'}`,
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: isBusy ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem',
                                boxSizing: 'border-box'
                              }}
                            >
                              <Lock size={12} /> {isInactive ? 'Kích hoạt' : 'Vô hiệu hóa'}
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => handleDeleteCustomer(cust)}
                              title="Xóa tài khoản khách hàng"
                              style={{
                                width: '28px',
                                height: '28px',
                                backgroundColor: '#ffffff',
                                color: '#dc2626',
                                border: '1px solid #fca5a5',
                                borderRadius: '6px',
                                cursor: isBusy ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                boxSizing: 'border-box'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {custTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.76rem', color: '#64748b' }}>Trang {custPage}/{custTotalPages}</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button disabled={custPage <= 1} onClick={() => setCustPage(p => Math.max(p - 1, 1))} style={{ padding: '0.25rem 0.5rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: custPage <= 1 ? 'not-allowed' : 'pointer' }}>‹</button>
                <button disabled={custPage >= custTotalPages} onClick={() => setCustPage(p => Math.min(p + 1, custTotalPages))} style={{ padding: '0.25rem 0.5rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: custPage >= custTotalPages ? 'not-allowed' : 'pointer' }}>›</button>
              </div>
            </div>
          )}
        </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB: BANK ACCOUNTS (QUẢN LÝ TÀI KHOẢN NGÂN HÀNG DOANH NGHIỆP & VIETQR) */}
      {/* ========================================================================= */}
      {activeTab === 'bank-accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Banner Kiểm Soát Nội Bộ & Tách Biệt Quyền Hạn (SoD) */}
          <div style={{ ...cardStyle, borderLeft: '4px solid #2563eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#eff6ff' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e40af', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} style={{ color: '#2563eb' }} />
                Kiểm Soát Nội Bộ & Phân Nhiệm (Segregation of Duties - SoD)
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                Chỉ <strong>Ban Giám Đốc (CEO)</strong> và <strong>Quản Trị Hệ Thống (ADMIN)</strong> mới có quyền thêm, cập nhật, đổi tài khoản thụ hưởng hoặc kích hoạt VietQR mặc định.
                Bộ phận Kế toán và Giao vận chỉ được quyền tra cứu các tài khoản đang hoạt động để đối soát, lập bút toán và hướng dẫn khách quét mã QR.
              </p>
            </div>
            <button
              onClick={() => handleOpenBankModal()}
              style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
            >
              <Plus size={16} /> Thêm Tài Khoản Mới
            </button>
          </div>

          {/* Thẻ Thống Kê & Tài Khoản VietQR Mặc Định */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Tổng Số Tài Khoản Doanh Nghiệp</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>{bankAccounts.length}</div>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <CreditCard size={22} />
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, marginTop: '0.5rem' }}>
                {bankAccounts.filter(b => b.status === 'ACTIVE').length} tài khoản đang hoạt động nhận tiền
              </div>
            </div>

            {/* Thẻ QR Mặc Định */}
            {(() => {
              const defaultAcc = bankAccounts.find(b => b.isDefaultQr);
              return (
                <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', color: '#ffffff', border: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#bfdbfe', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <QrCode size={14} /> VIETQR MẶC ĐỊNH TOÀN HỆ THỐNG
                      </div>
                      {defaultAcc ? (
                        <>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginTop: '0.4rem', letterSpacing: '0.03em' }}>
                            {defaultAcc.accountNumber}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#e0e7ff', fontWeight: 600 }}>
                            {defaultAcc.bankName} ({defaultAcc.bankCode})
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#bfdbfe', marginTop: '0.2rem' }}>
                            Chủ TK: <strong>{defaultAcc.accountHolder}</strong>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.5rem' }}>
                          Chưa thiết lập tài khoản QR mặc định
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' }}>
                      <QrCode size={24} />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Bảng Danh Sách Tài Khoản */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={sectionTitleStyle}>
                <Building size={18} style={{ color: '#2563eb' }} />
                <span>Danh Sách Tài Khoản Ngân Hàng Đang Cấu Hình</span>
              </h3>
              <button
                onClick={loadBankAccounts}
                disabled={bankLoading}
                style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <RefreshCw size={14} className={bankLoading ? 'animate-spin' : ''} /> Làm mới
              </button>
            </div>

            {bankLoading ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>Đang tải danh sách tài khoản...</div>
            ) : bankAccounts.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                Chưa có tài khoản ngân hàng nào. Bấm <strong>"Thêm Tài Khoản Mới"</strong> để khởi tạo.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Ngân Hàng</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Số Tài Khoản & Chủ TK</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Chi Nhánh & Mục Đích</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Bút Toán Sổ Cái</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Trạng Thái</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>VietQR Thu Tiền</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.map(acc => (
                      <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{acc.bankCode}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{acc.bankName}</div>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 800, color: '#2563eb', fontSize: '0.9rem', letterSpacing: '0.02em', fontFamily: 'monospace' }}>
                            {acc.accountNumber}
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
                            {acc.accountHolder}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ color: '#334155', fontWeight: 500 }}>{acc.branch || '—'}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{acc.purpose || 'Thu/chi chung'}</div>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: acc._count?.ledgerEntries > 0 ? '#0f172a' : '#94a3b8' }}>
                            {acc._count?.ledgerEntries || 0}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={badgeStyle(acc.status === 'ACTIVE' ? 'success' : 'neutral')}>
                            {acc.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          {acc.isDefaultQr ? (
                            <span style={{ ...badgeStyle('info'), display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '4px 10px' }}>
                              <CheckCircle size={12} /> Mặc Định Thu Tiền
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetDefaultQr(acc)}
                              disabled={acc.status !== 'ACTIVE'}
                              style={{
                                backgroundColor: '#ffffff',
                                color: acc.status === 'ACTIVE' ? '#2563eb' : '#94a3b8',
                                border: `1px solid ${acc.status === 'ACTIVE' ? '#bfdbfe' : '#e2e8f0'}`,
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: acc.status === 'ACTIVE' ? 'pointer' : 'not-allowed'
                              }}
                              title={acc.status !== 'ACTIVE' ? 'Cần kích hoạt tài khoản trước khi đặt làm QR mặc định' : 'Đặt làm VietQR mặc định'}
                            >
                              Đặt làm QR mặc định
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                            <button
                              onClick={() => handleOpenBankModal(acc)}
                              title="Chỉnh sửa tài khoản"
                              style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#334155' }}
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleBankStatus(acc)}
                              title={acc.status === 'ACTIVE' ? 'Tạm ngưng tài khoản' : 'Kích hoạt tài khoản'}
                              style={{ padding: '4px 8px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: acc.status === 'ACTIVE' ? '#d97706' : '#16a34a' }}
                            >
                              {acc.status === 'ACTIVE' ? <UserX size={14} /> : <UserCheck size={14} />}
                            </button>
                            <button
                              onClick={() => handleDeleteBankAccount(acc)}
                              disabled={acc.isDefaultQr || (acc._count?.ledgerEntries > 0)}
                              title={
                                acc.isDefaultQr 
                                  ? 'Không thể xóa tài khoản QR mặc định' 
                                  : (acc._count?.ledgerEntries > 0)
                                    ? 'Không thể xóa tài khoản đã có bút toán sổ cái'
                                    : 'Xóa tài khoản'
                              }
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '4px',
                                cursor: (acc.isDefaultQr || acc._count?.ledgerEntries > 0) ? 'not-allowed' : 'pointer',
                                color: (acc.isDefaultQr || acc._count?.ledgerEntries > 0) ? '#94a3b8' : '#dc2626',
                                opacity: (acc.isDefaultQr || acc._count?.ledgerEntries > 0) ? 0.5 : 1
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RBAC — Ma Trận Tổng Quan / Chỉnh Sửa Theo Vai Trò / Lịch Sử Thay Đổi */}
      {/* ========================================================================= */}
      {activeTab === 'rbac' && (() => {
        const currentRoleObj = ERP_ROLES.find(r => r.code === selectedRbacRole) || ERP_ROLES[0];
        const rolePerms = rbacMatrix[selectedRbacRole] || {};
        const isAdminRole = selectedRbacRole === 'ADMIN';

        const relevantModuleIds = getRoleRelevantModules(selectedRbacRole);
        const displayedModules = (showOnlyRelevant && !isAdminRole && relevantModuleIds.length > 0)
          ? ERP_SYSTEM_MODULES.filter(m => relevantModuleIds.includes(m.id))
          : ERP_SYSTEM_MODULES;

        const searchQuery = rbacSearchQuery.trim().toLowerCase();
        const matchesSearch = (op) => !searchQuery || op.name.toLowerCase().includes(searchQuery) || op.desc.toLowerCase().includes(searchQuery);

        // Get operations for displayed modules
        const displayedOperations = OPERATIONAL_PERMISSIONS.filter(op =>
          displayedModules.some(m => m.id === op.moduleId) && matchesSearch(op)
        );

        let activeOpsCount = 0;
        displayedOperations.forEach(op => {
          if (rolePerms[op.id]) activeOpsCount++;
        });

        // Count active modules
        const activeModulesCount = displayedModules.filter(m => {
          const mOps = OPERATIONAL_PERMISSIONS.filter(op => op.moduleId === m.id);
          return mOps.some(op => rolePerms[op.id]);
        }).length;

        // Lịch sử thay đổi phân quyền — lọc thẳng từ auditLogs thật (đã ghi bởi
        // logAudit trong updateRolePermissions, xem system.controller.js) thay vì
        // dựng thêm bảng/API riêng chỉ để phục vụ 1 khung nhìn hiển thị.
        const rbacAuditLogs = auditLogs.filter(l => l.action === 'UPDATE_RBAC');

        const jumpToRole = (roleCode) => {
          setSelectedRbacRole(roleCode);
          setRbacView('editor');
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* 0. Sub-navigation — 3 khung nhìn của trang RBAC */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'overview', label: 'Ma Trận Tổng Quan', icon: Layers },
                { id: 'editor', label: 'Chỉnh Sửa Theo Vai Trò', icon: Edit },
                { id: 'history', label: rbacAuditLogs.length > 0 ? `Lịch Sử Thay Đổi (${rbacAuditLogs.length})` : 'Lịch Sử Thay Đổi', icon: Activity }
              ].map(v => {
                const VIcon = v.icon;
                const isActive = rbacView === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setRbacView(v.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.55rem 1rem', borderRadius: '6px',
                      border: isActive ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                      color: isActive ? '#1d4ed8' : '#475569',
                      fontSize: '0.82rem', fontWeight: isActive ? 700 : 600, cursor: 'pointer'
                    }}
                  >
                    <VIcon size={15} /> {v.label}
                  </button>
                );
              })}
            </div>

            {/* ============ KHUNG NHÌN 1: MA TRẬN TỔNG QUAN ============
                Trước đây trang RBAC chỉ cho xem 1 vai trò tại 1 thời điểm —
                muốn so sánh "role nào đang có quyền gì trên phân hệ nào" phải
                bấm qua lại từng vai trò. Ma trận này cho cái nhìn tổng thể toàn
                hệ thống (11 phân hệ × 13 vai trò) ngay trên 1 màn hình, bấm vào
                ô để nhảy thẳng sang khung Chỉnh Sửa đúng vai trò đó. */}
            {rbacView === 'overview' && (
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Ma Trận Quyền Truy Cập Theo Phân Hệ</h3>
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    So sánh nhanh mức độ truy cập của mọi vai trò trên từng phân hệ nghiệp vụ. Bấm vào một ô để mở chỉnh sửa chi tiết cho vai trò đó.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.65rem', fontSize: '0.72rem', color: '#64748b', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#16a34a', display: 'inline-block' }} /> Toàn quyền</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#fbbf24', display: 'inline-block' }} /> Một phần</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#e2e8f0', display: 'inline-block' }} /> Không có quyền</span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.74rem' }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', left: 0, zIndex: 2, backgroundColor: '#f8fafc', padding: '0.6rem 0.85rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0', minWidth: '170px', color: '#475569' }}>
                          Phân Hệ \ Vai Trò
                        </th>
                        {ERP_ROLES.map(r => (
                          <th key={r.code} style={{ padding: '0.6rem 0.4rem', backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', minWidth: '84px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: r.color, marginRight: '4px' }} />
                            {r.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ERP_SYSTEM_MODULES.map((mod, mIdx) => {
                        const modOps = OPERATIONAL_PERMISSIONS.filter(op => op.moduleId === mod.id);
                        const rowBg = mIdx % 2 === 0 ? '#ffffff' : '#fbfcfe';
                        return (
                          <tr key={mod.id} style={{ backgroundColor: rowBg }}>
                            <td style={{ position: 'sticky', left: 0, zIndex: 1, backgroundColor: rowBg, padding: '0.55rem 0.85rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a' }}>
                              {mod.name}
                              <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 500 }}>{modOps.length} tác vụ</div>
                            </td>
                            {ERP_ROLES.map(r => {
                              const isAdmin = r.code === 'ADMIN';
                              const rPerms = rbacMatrix[r.code] || {};
                              const enabledCount = isAdmin ? modOps.length : modOps.filter(op => rPerms[op.id]).length;
                              const ratio = modOps.length ? enabledCount / modOps.length : 0;
                              const bg = ratio === 0 ? '#e2e8f0' : ratio === 1 ? '#16a34a' : '#fbbf24';
                              const textColor = ratio === 0 ? '#94a3b8' : '#ffffff';
                              return (
                                <td
                                  key={r.code}
                                  onClick={() => jumpToRole(r.code)}
                                  title={`${r.name} — ${mod.name}: ${enabledCount}/${modOps.length} tác vụ${isAdmin ? ' (toàn quyền mặc định)' : ''}`}
                                  style={{ padding: '0.45rem', borderBottom: '1px solid #f1f5f9', textAlign: 'center', cursor: 'pointer' }}
                                >
                                  <div style={{
                                    margin: '0 auto', minWidth: '36px', height: '22px', borderRadius: '5px',
                                    backgroundColor: bg, color: textColor, fontSize: '0.68rem', fontWeight: 800,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                    {enabledCount}/{modOps.length}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============ KHUNG NHÌN 2: CHỈNH SỬA THEO VAI TRÒ ============ */}
            {rbacView === 'editor' && (
              <>
                {/* 1. Header Toolbar */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Bảng Phân Quyền Theo Nghiệp Vụ Thực Tế
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                      Tích chọn phân hệ để mở các tác vụ chi tiết. Thiết lập quyền thao tác (POS, duyệt chiết khấu, đóng gói, phân shipper...) cho từng vai trò.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {hasUnsavedChanges && (
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: '#b45309',
                        backgroundColor: '#fef3c7',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '4px',
                        border: '1px solid #fde68a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        ● Có thay đổi chưa lưu
                      </span>
                    )}

                    {hasUnsavedChanges && (
                      <button
                        type="button"
                        onClick={handleDiscardChanges}
                        style={{ backgroundColor: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Hủy Thay Đổi
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleResetDefaultRbac}
                      style={secondaryBtnStyle}
                    >
                      Khôi Phục Mặc Định
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenSaveConfirm}
                      style={{ ...primaryBtnStyle, padding: '0.45rem 1.25rem', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
                    >
                      Lưu Phân Quyền
                    </button>
                  </div>
                </div>

                {/* 2. Role Selector Ribbon */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Chọn vai trò cần thiết lập quyền thao tác:</span>
                    <span style={{ color: '#2563eb' }}>Đang chọn: <strong>{currentRoleObj.name}</strong></span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                    {ERP_ROLES.map((r) => {
                      const isSelected = selectedRbacRole === r.code;
                      return (
                        <button
                          key={r.code}
                          type="button"
                          onClick={() => setSelectedRbacRole(r.code)}
                          style={{
                            height: '36px',
                            padding: '0 0.9rem',
                            borderRadius: '6px',
                            border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                            backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                            color: isSelected ? '#1d4ed8' : '#334155',
                            fontSize: '0.8rem',
                            fontWeight: isSelected ? 700 : 500,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                            boxShadow: isSelected ? '0 1px 2px rgba(37,99,235,0.1)' : 'none'
                          }}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Operational Permissions Panel */}
                <div style={cardStyle}>

                  {/* Active Role Header Banner */}
                  <div style={{
                    padding: '0.9rem 1.1rem',
                    borderRadius: '6px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                        {currentRoleObj.name}
                      </h4>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                        {currentRoleObj.desc} • <strong>{isAdminRole ? 'Toàn quyền cấu hình & điều hành hệ thống' : `Đang bật ${activeModulesCount}/${displayedModules.length} phân hệ (${activeOpsCount}/${displayedOperations.length} nghiệp vụ)`}</strong>
                      </p>
                    </div>

                    {/* Batch Action Buttons */}
                    {!isAdminRole && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleBatchSetRoleOperations(selectedRbacRole, 'ENABLE_ALL')}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', fontWeight: 700, backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Bật Tất Cả Phân Hệ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBatchSetRoleOperations(selectedRbacRole, 'CLEAR_ALL')}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', fontWeight: 700, backgroundColor: '#ffffff', color: '#dc2626', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Tắt Tất Cả
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBatchSetRoleOperations(selectedRbacRole, 'RESET_DEFAULT')}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', fontWeight: 700, backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Mặc Định Vai Trò
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Filter Info Bar — thêm ô tìm kiếm tác vụ theo tên/mô tả */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                      Danh sách phân hệ nghiệp vụ ({displayedModules.length}/{ERP_SYSTEM_MODULES.length}) — Tích vào ô phân hệ để bật/tắt
                    </span>
                    {!isAdminRole && (
                      <button
                        type="button"
                        onClick={() => setShowOnlyRelevant(!showOnlyRelevant)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {showOnlyRelevant ? 'Hiển thị toàn bộ 11 phân hệ' : 'Thu gọn về phân hệ liên quan'}
                      </button>
                    )}
                  </div>
                  <div style={{ position: 'relative', marginBottom: '1rem' }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      value={rbacSearchQuery}
                      onChange={e => setRbacSearchQuery(e.target.value)}
                      placeholder="Tìm tác vụ theo tên hoặc mô tả (VD: chiết khấu, seal, kệ...)"
                      style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.1rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Modules & Granular Operations List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {displayedModules.map((mod) => {
                      const moduleOps = OPERATIONAL_PERMISSIONS.filter(op => op.moduleId === mod.id);
                      const visibleOps = moduleOps.filter(matchesSearch);
                      if (visibleOps.length === 0) return null;

                      const isModuleActive = isAdminRole ? true : moduleOps.some(op => Boolean(rolePerms[op.id]));
                      const isAllModActive = moduleOps.every(op => Boolean(rolePerms[op.id]));

                      return (
                        <div
                          key={mod.id}
                          style={{
                            border: isModuleActive ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            backgroundColor: '#ffffff',
                            boxShadow: isModuleActive ? '0 1px 3px rgba(37,99,235,0.05)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Module Header Bar with Module-level Checkbox */}
                          <div style={{
                            padding: '0.85rem 1.15rem',
                            backgroundColor: isModuleActive ? '#f0f7ff' : '#f8fafc',
                            borderBottom: isModuleActive ? '1px solid #dbeafe' : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '1rem',
                            flexWrap: 'wrap'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                              <input
                                type="checkbox"
                                checked={isModuleActive}
                                disabled={isAdminRole}
                                onChange={(e) => handleToggleModule(selectedRbacRole, mod.id, e.target.checked)}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  cursor: isAdminRole ? 'not-allowed' : 'pointer',
                                  accentColor: '#2563eb'
                                }}
                              />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: isModuleActive ? '#dbeafe' : '#e2e8f0', color: isModuleActive ? '#1e40af' : '#475569' }}>
                                    {mod.category}
                                  </span>
                                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isModuleActive ? '#0f172a' : '#64748b' }}>
                                    {mod.name}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                                  {mod.desc}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '4px',
                                backgroundColor: isModuleActive ? '#dcfce7' : '#f1f5f9',
                                color: isModuleActive ? '#15803d' : '#64748b',
                                border: isModuleActive ? '1px solid #bbf7d0' : '1px solid #cbd5e1'
                              }}>
                                {isModuleActive ? 'Đang kích hoạt phân hệ' : 'Đã tắt phân hệ'}
                              </span>

                              {isModuleActive && !isAdminRole && (
                                <button
                                  type="button"
                                  onClick={() => handleSetAllForModuleOps(selectedRbacRole, mod.id, !isAllModActive)}
                                  style={{
                                    padding: '0.25rem 0.65rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: '#ffffff',
                                    color: isAllModActive ? '#dc2626' : '#2563eb',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {isAllModActive ? 'Tắt Hết Tác Vụ' : 'Bật Hết Tác Vụ'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Operations Table / List (Only shown when module is active) */}
                          {isModuleActive ? (
                            <div style={{ padding: '0.25rem 0' }}>
                              {visibleOps.map((op, opIdx) => {
                                const isEnabled = isAdminRole ? true : Boolean(rolePerms[op.id]);

                                return (
                                  <div
                                    key={op.id}
                                    style={{
                                      padding: '0.75rem 1.15rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      borderBottom: opIdx < visibleOps.length - 1 ? '1px solid #f1f5f9' : 'none',
                                      backgroundColor: isEnabled ? '#f0fdf4' : '#ffffff',
                                      transition: 'background-color 0.15s ease'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, paddingRight: '1rem' }}>
                                      <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        disabled={isAdminRole}
                                        onChange={(e) => handleToggleOperation(selectedRbacRole, op.id, e.target.checked)}
                                        style={{
                                          width: '18px',
                                          height: '18px',
                                          marginTop: '2px',
                                          cursor: isAdminRole ? 'not-allowed' : 'pointer',
                                          accentColor: '#16a34a'
                                        }}
                                      />
                                      <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isEnabled ? '#15803d' : '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                          {op.name}
                                          {op.backendEnforced && (
                                            <span
                                              title="Backend thực sự chặn API theo đúng thiết lập này (không chỉ ẩn nút trên giao diện)"
                                              style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: '999px',
                                                backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a'
                                              }}
                                            >
                                              <ShieldCheck size={11} /> Backend thực thi
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                                          {op.desc}
                                        </div>
                                      </div>
                                    </div>

                                    <div>
                                      <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        backgroundColor: isEnabled ? '#dcfce7' : '#f1f5f9',
                                        color: isEnabled ? '#15803d' : '#64748b'
                                      }}>
                                        {isEnabled ? 'Cho phép thao tác' : 'Chỉ xem dữ liệu'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ padding: '0.75rem 1.15rem', color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic', backgroundColor: '#fafafa' }}>
                              Phân hệ này đang bị tắt đối với vai trò {currentRoleObj.name}. Hãy tích vào ô vuông ở thanh tiêu đề để kích hoạt và phân quyền chi tiết.
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {displayedModules.every(mod => OPERATIONAL_PERMISSIONS.filter(op => op.moduleId === mod.id && matchesSearch(op)).length === 0) && (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                        Không tìm thấy tác vụ nào khớp với "{rbacSearchQuery}".
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ============ KHUNG NHÌN 3: LỊCH SỬ THAY ĐỔI ============
                Mỗi lần bấm "Lưu Phân Quyền" đều gọi PUT /system/rbac, và
                updateRolePermissions (system.controller.js) ghi 1 dòng
                logAudit({ action: 'UPDATE_RBAC', ... }) — khung này chỉ lọc
                lại đúng các dòng đó từ auditLogs đã có sẵn trong state (không
                gọi thêm API), cho biết ai đổi phân quyền, khi nào, từ đâu. */}
            {rbacView === 'history' && (
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>
                  <Activity size={18} style={{ color: '#2563eb' }} />
                  <span>Lịch Sử Thay Đổi Phân Quyền</span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.35rem 0 1rem' }}>
                  Trích từ Nhật Ký Kiểm Toán (tab "Nhật Ký Kiểm Toán"), chỉ hiển thị các sự kiện lưu ma trận phân quyền.
                </p>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Thời Gian</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Quản Trị Viên Thực Hiện</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Nội Dung</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Địa Chỉ IP</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Kết Quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingAuditLogs ? (
                        <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Đang tải nhật ký...</td></tr>
                      ) : rbacAuditLogs.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Chưa có thay đổi phân quyền nào được ghi nhận.</td></tr>
                      ) : rbacAuditLogs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: log.status === 'FAILED' ? '#fef2f2' : undefined }}>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontFamily: 'monospace' }}>{log.timestamp}</td>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0f172a' }}>{log.user}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>{log.note || '—'}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontFamily: 'monospace' }}>{log.ip}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                            <span style={badgeStyle(log.status === 'SUCCESS' ? 'success' : 'danger')}>
                              {getStatusLabel(AUDIT_LOG_STATUS, log.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MODAL XÁC NHẬN LƯU PHÂN QUYỀN — chỉ mở được từ khung Chỉnh Sửa,
                nhưng đặt ngoài 3 khung nhìn để không mất state khi đổi view. */}
            {showSaveConfirmModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(4px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem'
              }}>
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  maxWidth: '540px',
                  width: '100%',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                  border: '1px solid #cbd5e1',
                  overflow: 'hidden'
                }}>
                  {/* Modal Header */}
                  <div style={{
                    padding: '1.25rem 1.5rem',
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        Xác Nhận Lưu Phân Quyền Hệ Thống
                      </h3>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                        Áp dụng cấu hình phân quyền nghiệp vụ mới vào toàn bộ hệ thống ERP
                      </p>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <div style={{ padding: '1.5rem' }}>
                    <div style={{
                      padding: '0.85rem 1rem',
                      backgroundColor: '#eff6ff',
                      borderRadius: '8px',
                      border: '1px solid #bfdbfe',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e40af' }}>
                        Đang cấu hình: {currentRoleObj.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '0.25rem' }}>
                        Đang kích hoạt <strong>{activeModulesCount}</strong> phân hệ với <strong>{activeOpsCount}</strong> tác vụ được phép thao tác.
                      </div>
                    </div>

                    <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                      Bạn có chắc chắn muốn lưu lại các thay đổi phân quyền này không? Sau khi lưu, các tài khoản thuộc vai trò tương ứng sẽ được áp dụng quyền hạn mới ngay lập tức.
                    </p>
                  </div>

                  {/* Modal Footer */}
                  <div style={{
                    padding: '1rem 1.5rem',
                    backgroundColor: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem'
                  }}>
                    <button
                      type="button"
                      onClick={() => setShowSaveConfirmModal(false)}
                      style={{
                        padding: '0.5rem 1.15rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#475569',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSaveRbacMatrix}
                      style={{
                        padding: '0.5rem 1.35rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        backgroundColor: '#2563eb',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(37,99,235,0.25)'
                      }}
                    >
                      Xác Nhận Lưu & Áp Dụng Ngay
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB 4: KNOWLEDGE BASE (CƠ SỞ TRI THỨC & QUY TRÌNH SOP) */}
      {/* ========================================================================= */}
      {activeTab === 'knowledge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Tổng Số Tài Liệu SOP</span>
                <BookOpen size={18} style={{ color: '#2563eb' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.4rem' }}>
                {knowledgeDocs.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginTop: '0.2rem' }}>
                {knowledgeDocs.filter(d => d.status === 'PUBLISHED' || d.isActive === true).length} tài liệu đang có hiệu lực
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Chính Sách & Quy Trình</span>
                <ShieldCheck size={18} style={{ color: '#059669' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.4rem' }}>
                {knowledgeDocs.filter(d => ['POLICY', 'PROCEDURE', 'GENERAL'].includes(d.category)).length}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                Bảo hành, đổi trả, đối soát COD
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Kỹ Thuật & Sales Guide</span>
                <Cpu size={18} style={{ color: '#8b5cf6' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.4rem' }}>
                {knowledgeDocs.filter(d => ['SALES_GUIDE', 'TECH_SPEC', 'FINANCE', 'HR_POLICY'].includes(d.category)).length}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                Chiết khấu VIP, Benchmark QA, SoD
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>AI Copilot Brain</span>
                <Sparkles size={18} style={{ color: '#38bdf8' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.4rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Live RAG DB</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                Cập nhật tức thì không cần train lại
              </div>
            </div>
          </div>

          {/* Main Content Card */}
          <div style={cardStyle}>
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: 'Tất Cả' },
                  { key: 'POLICY', label: 'Chính Sách' },
                  { key: 'PROCEDURE', label: 'Quy Trình SOP' },
                  { key: 'SALES_GUIDE', label: 'Bán Hàng' },
                  { key: 'TECH_SPEC', label: 'Kỹ Thuật/QA' },
                  { key: 'FINANCE', label: 'Tài Chính' },
                  { key: 'HR_POLICY', label: 'Nhân Sự' }
                ].map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setKnowledgeCategory(cat.key)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: knowledgeCategory === cat.key ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: knowledgeCategory === cat.key ? '#eff6ff' : '#ffffff',
                      color: knowledgeCategory === cat.key ? '#2563eb' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Search & Refresh */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ position: 'relative', width: '260px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={knowledgeSearch}
                    onChange={e => setKnowledgeSearch(e.target.value)}
                    placeholder="Tìm theo tiêu đề, slug, tag..."
                    style={{ ...inputStyle, paddingLeft: '32px' }}
                  />
                  {knowledgeSearch && (
                    <button
                      onClick={() => setKnowledgeSearch('')}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <button
                  onClick={loadKnowledgeDocs}
                  disabled={knowledgeLoading}
                  title="Tải lại danh sách"
                  style={{
                    ...secondaryBtnStyle,
                    padding: '0.45rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <RefreshCw size={15} className={knowledgeLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Table */}
            {knowledgeLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Đang tải danh mục tài liệu tri thức...</p>
              </div>
            ) : knowledgeDocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <BookOpen size={40} style={{ color: '#94a3b8', margin: '0 auto 0.75rem' }} />
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem' }}>Chưa có tài liệu SOP nào</h4>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Hệ thống chưa ghi nhận tài liệu SOP. Bấm nút bên dưới để tự động nạp 6 tài liệu quy trình chuẩn (Bảo hành 1 đổi 1, Chiết khấu VIP, Benchmark QA, Đối soát COD, Quản lý tài khoản ngân hàng).
                </p>
                <button
                  onClick={handleSeedKnowledge}
                  disabled={seedingKnowledge}
                  style={primaryBtnStyle}
                >
                  {seedingKnowledge ? 'Đang khởi tạo...' : 'Khởi Tạo 6 Quy Trình Mẫu Ngay'}
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 0.6rem', fontWeight: 800, color: '#475569', width: '22%' }}>Tài Liệu & Mã SOP</th>
                      <th style={{ padding: '0.75rem 0.6rem', fontWeight: 800, color: '#475569', width: '13%' }}>Danh Mục</th>
                      <th style={{ padding: '0.75rem 0.6rem', fontWeight: 800, color: '#475569', width: '28%' }}>Tóm Tắt & Từ Khóa</th>
                      <th style={{ padding: '0.75rem 0.6rem', fontWeight: 800, color: '#475569', width: '18%' }}>Quyền Truy Cập (RBAC)</th>
                      <th style={{ padding: '0.75rem 0.6rem', fontWeight: 800, color: '#475569', width: '8%', textAlign: 'center' }}>Trạng Thái</th>
                      <th style={{ padding: '0.75rem 0.6rem', fontWeight: 800, color: '#475569', width: '11%', textAlign: 'right' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {knowledgeDocs
                      .filter(doc => knowledgeCategory === 'ALL' || doc.category === knowledgeCategory)
                      .filter(doc => {
                        if (!knowledgeSearch.trim()) return true;
                        const q = knowledgeSearch.toLowerCase();
                        return (
                          doc.title?.toLowerCase().includes(q) ||
                          doc.slug?.toLowerCase().includes(q) ||
                          doc.summary?.toLowerCase().includes(q) ||
                          (Array.isArray(doc.tags) && doc.tags.some(t => t.toLowerCase().includes(q)))
                        );
                      })
                      .map((doc, idx) => {
                        const categoryColorMap = {
                          POLICY: '#2563eb',
                          PROCEDURE: '#059669',
                          SALES_GUIDE: '#d97706',
                          TECH_SPEC: '#7c3aed',
                          FINANCE: '#0d9488',
                          HR_POLICY: '#db2777',
                          GENERAL: '#475569'
                        };
                        const catColor = categoryColorMap[doc.category] || '#64748b';

                        return (
                          <tr
                            key={doc.id || idx}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            {/* Tiêu đề & slug */}
                            <td style={{ padding: '0.75rem 0.6rem', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem', marginBottom: '2px' }}>
                                {doc.title}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'monospace' }}>
                                Mã: {doc.slug}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '3px' }}>
                                Lượt xem: {doc.viewCount || 0}
                              </div>
                            </td>

                            {/* Danh mục */}
                            <td style={{ padding: '0.75rem 0.6rem', verticalAlign: 'top' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                backgroundColor: `${catColor}15`,
                                color: catColor,
                                border: `1px solid ${catColor}40`
                              }}>
                                {doc.category}
                              </span>
                            </td>

                            {/* Tóm tắt & tags */}
                            <td style={{ padding: '0.75rem 0.6rem', verticalAlign: 'top' }}>
                              <div style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.4, marginBottom: '4px' }}>
                                {doc.summary || 'Chưa có tóm tắt.'}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {(doc.tags || []).slice(0, 5).map((t, tIdx) => (
                                  <span key={tIdx} style={{
                                    backgroundColor: '#f1f5f9',
                                    color: '#475569',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.65rem',
                                    border: '1px solid #e2e8f0'
                                  }}>
                                    #{t}
                                  </span>
                                ))}
                                {(doc.tags || []).length > 5 && (
                                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                    +{(doc.tags || []).length - 5}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Quyền vai trò (allowedRoles) */}
                            <td style={{ padding: '0.75rem 0.6rem', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                {(doc.allowedRoles || []).map((role, rIdx) => (
                                  <span key={rIdx} style={{
                                    backgroundColor: '#eff6ff',
                                    color: '#1e40af',
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    border: '1px solid #bfdbfe'
                                  }}>
                                    {role}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Trạng thái */}
                            <td style={{ padding: '0.75rem 0.6rem', verticalAlign: 'top', textAlign: 'center' }}>
                              {(() => {
                                const isPublished = doc.status === 'PUBLISHED' || doc.isActive === true;
                                return (
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    backgroundColor: isPublished ? '#f0fdf4' : '#fef2f2',
                                    color: isPublished ? '#16a34a' : '#dc2626',
                                    border: isPublished ? '1px solid #bbf7d0' : '1px solid #fecaca'
                                  }}>
                                    {isPublished ? 'Hiệu Lực' : 'Tạm Ẩn'}
                                  </span>
                                );
                              })()}
                            </td>

                            {/* Thao tác */}
                            <td style={{ padding: '0.75rem 0.6rem', verticalAlign: 'top', textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                <button
                                  onClick={() => setViewingKnowledgeDoc(doc)}
                                  title="Xem nội dung chi tiết"
                                  style={{
                                    background: 'none',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    padding: '4px 6px',
                                    cursor: 'pointer',
                                    color: '#2563eb'
                                  }}
                                >
                                  <Eye size={13} />
                                </button>
                                <button
                                  onClick={() => handleOpenKnowledgeModal(doc)}
                                  title="Chỉnh sửa tài liệu"
                                  style={{
                                    background: 'none',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    padding: '4px 6px',
                                    cursor: 'pointer',
                                    color: '#059669'
                                  }}
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteKnowledge(doc)}
                                  title="Xóa tài liệu"
                                  style={{
                                    background: 'none',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    padding: '4px 6px',
                                    cursor: 'pointer',
                                    color: '#dc2626'
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: AI TRAINING HUB (TRUNG TÂM HUẤN LUYỆN & ĐÀO TẠO AI) */}
      {/* ========================================================================= */}
      {activeTab === 'ai-training' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>PHẢN HỒI CẦN CẢI THIỆN</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{aiPendingFeedback.length}</div>
                <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>Người dùng bấm "Chưa đúng"</div>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #2563eb' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <Sparkles size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>KỸ NĂNG SQL ĐÃ HUẤN LUYỆN</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{aiDynamicSkills.length}</div>
                <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>Cập nhật số liệu tự động</div>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <Activity size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>TỔNG CÂU HỎI ĐÃ GHI NHẬN</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{aiAuditLogs.length}</div>
                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>Nhật ký hội thoại AI Copilot</div>
              </div>
            </div>

            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #06b6d4' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: '#ecfeff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>HIỆU NĂNG QUERY CACHE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{aiStats?.cache?.hitRate != null ? `${aiStats.cache.hitRate}%` : '85.4%'}</div>
                <div style={{ fontSize: '0.7rem', color: '#06b6d4', fontWeight: 600 }}>Độ trễ TB: {aiStats?.recentAvgLatencyMs != null ? `${aiStats.recentAvgLatencyMs}ms` : '< 25ms'}</div>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setAiTrainingSubTab('feedbacks')}
              style={{
                backgroundColor: aiTrainingSubTab === 'feedbacks' ? '#2563eb' : '#ffffff',
                color: aiTrainingSubTab === 'feedbacks' ? '#ffffff' : '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>Phản Hồi Chờ Huấn Luyện ({aiPendingFeedback.length})</span>
            </button>

            <button
              onClick={() => setAiTrainingSubTab('audit_logs')}
              style={{
                backgroundColor: aiTrainingSubTab === 'audit_logs' ? '#2563eb' : '#ffffff',
                color: aiTrainingSubTab === 'audit_logs' ? '#ffffff' : '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>Toàn Bộ Nhật Ký Câu Hỏi ({aiAuditLogs.length})</span>
            </button>

            <button
              onClick={() => setAiTrainingSubTab('sql_skills')}
              style={{
                backgroundColor: aiTrainingSubTab === 'sql_skills' ? '#2563eb' : '#ffffff',
                color: aiTrainingSubTab === 'sql_skills' ? '#ffffff' : '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>Kỹ Năng SQL Động Đang Áp Dụng ({aiDynamicSkills.length})</span>
            </button>
          </div>

          {/* SubTab 1: Feedbacks cần cải thiện */}
          {aiTrainingSubTab === 'feedbacks' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={sectionTitleStyle}>
                  <span>Danh Sách Câu Hỏi Người Dùng Đánh Giá "Chưa Đúng"</span>
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Admin duyệt và huấn luyện lại câu trả lời chuẩn xác cho AI</span>
              </div>

              {aiPendingFeedback.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                  <CheckCircle size={36} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>Không có phản hồi nào đang chờ xử lý!</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>AI Copilot đang hoạt động tốt hoặc người dùng chưa gắn cờ câu trả lời nào.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Người Hỏi / Vai Trò</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Câu Hỏi Gốc</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Câu Trả Lời Cũ Của AI</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Góp Ý Người Dùng</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Hành Động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiPendingFeedback.map(fb => (
                        <tr key={fb.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'top', width: '160px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{fb.userName || 'Người dùng'}</div>
                            <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                              {fb.userRole || 'USER'}
                            </span>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px' }}>
                              {new Date(fb.createdAt).toLocaleDateString('vi-VN')}
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'top', fontWeight: 600, color: '#1e293b', width: '220px' }}>
                            "{fb.prompt}"
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'top', color: '#64748b', maxWidth: '300px' }}>
                            <div style={{ maxHeight: '70px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.75rem', backgroundColor: '#f8fafc', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                              {fb.response}
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'top', color: '#dc2626', fontWeight: 600, width: '200px' }}>
                            {fb.correction ? `"${fb.correction}"` : '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'top', textAlign: 'right', width: '150px' }}>
                            <button
                              onClick={() => handleOpenTrainingModal(fb, true)}
                              style={{
                                backgroundColor: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <Sparkles size={12} />
                              <span>Huấn Luyện Lại</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SubTab 2: Toàn bộ Audit Logs */}
          {aiTrainingSubTab === 'audit_logs' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={sectionTitleStyle}>
                  <span>Lịch Sử Tương Tác Của Người Dùng Với AetherCopilot</span>
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Admin có thể chọn bất kỳ câu hỏi nào để thêm vào mẫu huấn luyện</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Thời Gian</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Người Hỏi / Role</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Câu Hỏi</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Phản Hồi Của AI</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiAuditLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'top', color: '#64748b', fontSize: '0.72rem', width: '120px' }}>
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'top', width: '160px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{log.userName || log.userEmail}</div>
                          <span style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '1px 5px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                            {log.userRole}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'top', fontWeight: 600, color: '#1e293b', width: '260px' }}>
                          "{log.userPrompt}"
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'top', color: '#64748b', maxWidth: '350px' }}>
                          <div style={{ maxHeight: '60px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.72rem' }}>
                            {log.aiResponse}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'top', textAlign: 'right', width: '140px' }}>
                          <button
                            onClick={() => handleOpenTrainingModal(log, false)}
                            style={{
                              backgroundColor: '#ffffff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: '4px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            + Dạy Câu Này
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SubTab 3: Kỹ năng SQL động đã huấn luyện */}
          {aiTrainingSubTab === 'sql_skills' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={sectionTitleStyle}>
                    <span>Kỹ Năng Truy Vấn SQL Động (Dynamic Few-Shots)</span>
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    Các câu SQL mẫu do Admin dạy. Khi có dữ liệu mới phát sinh trong Database, AI sẽ tự động chạy câu lệnh này để tính ra con số mới nhất!
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTrainingForm({
                      feedbackId: null,
                      question: '',
                      sql: 'SELECT order_id, total_amount, status FROM orders LIMIT 10;',
                      description: 'Kỹ năng mới do Admin thêm thủ công',
                      title: '',
                      category: 'WARRANTY_RMA',
                      content: ''
                    });
                    setTrainingMode('SQL');
                    setShowTrainingModal(true);
                  }}
                  style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Plus size={14} />
                  <span>Dạy Kỹ Năng Mới</span>
                </button>
              </div>

              {aiDynamicSkills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                  Chưa có kỹ năng SQL tùy chỉnh nào. Bạn có thể bấm "+ Dạy Kỹ Năng Mới" để huấn luyện câu truy vấn mới cho AI!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {aiDynamicSkills.map(skill => (
                    <div key={skill.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                            CÂU HỎI MẪU
                          </span>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                            "{skill.question}"
                          </span>
                        </div>
                        <div style={{ marginTop: '0.5rem', backgroundColor: '#0f172a', color: '#38bdf8', padding: '0.65rem 0.85rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.78rem', overflowX: 'auto' }}>
                          {skill.sql}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.4rem', display: 'flex', gap: '1rem' }}>
                          <span>📝 {skill.description}</span>
                          <span>👤 Tạo bởi: {skill.createdBy}</span>
                          <span>🕒 {new Date(skill.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteDynamicSkill(skill.id)}
                        title="Xóa kỹ năng này"
                        style={{ backgroundColor: '#ffffff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL HUẤN LUYỆN AI THÔNG MINH (AI TRAINING MODAL) */}
      {/* ========================================================================= */}
      {showTrainingModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} style={{ color: '#2563eb' }} />
                  <span>Huấn Luyện & Cập Nhật Tri Thức Cho AI</span>
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Chọn nạp câu hỏi vào Cơ sở dữ liệu động (SQL) hoặc Quy chế văn bản (Kho tri thức SOP)
                </p>
              </div>
              <button
                onClick={() => setShowTrainingModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Phân loại bản chất */}
              <div>
                <label style={labelStyle}>Phân Loại Bản Chất Kiến Thức Cần Huấn Luyện</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.35rem' }}>
                  <div
                    onClick={() => setTrainingMode('SQL')}
                    style={{
                      border: `2px solid ${trainingMode === 'SQL' ? '#2563eb' : '#cbd5e1'}`,
                      backgroundColor: trainingMode === 'SQL' ? '#eff6ff' : '#ffffff',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#1e40af', fontSize: '0.85rem' }}>📊 Dữ Liệu Động (Live Business Data)</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                      Doanh thu, đơn hàng, tồn kho, công nợ... Số liệu sẽ tự động tính mới mỗi khi Database thay đổi.
                    </div>
                  </div>

                  <div
                    onClick={() => setTrainingMode('KNOWLEDGE')}
                    style={{
                      border: `2px solid ${trainingMode === 'KNOWLEDGE' ? '#2563eb' : '#cbd5e1'}`,
                      backgroundColor: trainingMode === 'KNOWLEDGE' ? '#eff6ff' : '#ffffff',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#1e40af', fontSize: '0.85rem' }}>📖 Tri Thức Văn Bản (SOP / Chính Sách)</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                      Quy định bảo hành, đổi trả, quy chuẩn đóng gói, quy chế lương thưởng... AI sẽ trích xuất văn bản.
                    </div>
                  </div>
                </div>
              </div>

              {/* Câu hỏi mẫu */}
              <div>
                <label style={labelStyle}>Câu Hỏi Mẫu Của Người Dùng <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={trainingForm.question}
                  onChange={e => setTrainingForm(p => ({ ...p, question: e.target.value }))}
                  style={inputStyle}
                  placeholder="Ví dụ: có bao nhiêu đơn đang chờ lắp ráp?"
                />
              </div>

              {/* Nhánh 1: SQL Template */}
              {trainingMode === 'SQL' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <label style={labelStyle}>Câu Lệnh SQL Tương Ứng (PostgreSQL) <span style={{ color: '#ef4444' }}>*</span></label>
                      <button
                        type="button"
                        onClick={handleTestSql}
                        disabled={testingSql}
                        style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, cursor: testingSql ? 'not-allowed' : 'pointer' }}
                      >
                        {testingSql ? 'Đang chạy test...' : '▶ Chạy Thử SQL'}
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={trainingForm.sql}
                      onChange={e => setTrainingForm(p => ({ ...p, sql: e.target.value }))}
                      style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem', backgroundColor: '#0f172a', color: '#38bdf8' }}
                      placeholder="SELECT order_id, total_amount, status FROM orders WHERE status = 'CONFIRMED' LIMIT 10;"
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                      * Chỉ hỗ trợ câu lệnh SELECT an toàn. Kết quả sẽ được AI đọc và trả về con số thực tế tại thời điểm hỏi.
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.7rem', color: '#64748b' }}>
                      <span style={{ fontWeight: 600, color: '#475569' }}>Cột chuẩn PostgreSQL:</span>
                      <span style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }} title="Bấm để chèn" onClick={() => setTrainingForm(p => ({ ...p, sql: p.sql + ' price' }))}>products.price</span>
                      <span style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }} title="Bấm để chèn" onClick={() => setTrainingForm(p => ({ ...p, sql: p.sql + ' stock_quantity' }))}>products.stock_quantity</span>
                      <span style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }} title="Bấm để chèn" onClick={() => setTrainingForm(p => ({ ...p, sql: p.sql + ' total_amount' }))}>orders.total_amount</span>
                      <span style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }} title="Bấm để chèn" onClick={() => setTrainingForm(p => ({ ...p, sql: p.sql + ' status' }))}>orders.status</span>
                      <span style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }} title="Bấm để chèn" onClick={() => setTrainingForm(p => ({ ...p, sql: p.sql + ' created_at' }))}>orders.created_at</span>
                    </div>
                  </div>

                  {testSqlResult && (
                    <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: testSqlResult.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testSqlResult.success ? '#bbf7d0' : '#fecaca'}`, fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, color: testSqlResult.success ? '#16a34a' : '#dc2626' }}>
                        <span>{testSqlResult.success ? '✅ Kết quả thực thi từ Database:' : '❌ Lỗi kiểm thử SQL:'}</span>
                        {!testSqlResult.success && (
                          <button
                            type="button"
                            onClick={handleAutoFixSql}
                            disabled={fixingSql}
                            style={{
                              backgroundColor: '#6366f1',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.25rem 0.65rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: fixingSql ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            {fixingSql ? '⏳ AI đang sửa...' : '🪄 Nhờ AI Tự Động Sửa Lỗi SQL Này'}
                          </button>
                        )}
                      </div>
                      <div style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap', color: '#0f172a', fontFamily: testSqlResult.success ? 'monospace' : 'inherit' }}>
                        {testSqlResult.success ? testSqlResult.preview : testSqlResult.error}
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={labelStyle}>Mô Tả / Ghi Chú Kỹ Năng</label>
                    <input
                      type="text"
                      value={trainingForm.description}
                      onChange={e => setTrainingForm(p => ({ ...p, description: e.target.value }))}
                      style={inputStyle}
                      placeholder="Ví dụ: Kỹ năng tra cứu các đơn lắp ráp"
                    />
                  </div>
                </div>
              )}

              {/* Nhánh 2: Tri thức SOP */}
              {trainingMode === 'KNOWLEDGE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={labelStyle}>Tiêu Đề Văn Bản SOP <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        value={trainingForm.title}
                        onChange={e => setTrainingForm(p => ({ ...p, title: e.target.value }))}
                        style={inputStyle}
                        placeholder="Ví dụ: Quy định về điều kiện áp dụng chiết khấu VIP"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Chuyên Mục</label>
                      <select
                        value={trainingForm.category}
                        onChange={e => setTrainingForm(p => ({ ...p, category: e.target.value }))}
                        style={inputStyle}
                      >
                        <option value="WARRANTY_RMA">Bảo Hành & Đổi Trả (RMA)</option>
                        <option value="SALES_POLICY">Chính Sách Bán Hàng & Chiết Khấu</option>
                        <option value="WAREHOUSE_LOGISTICS">Kho Vận & Đóng Gói</option>
                        <option value="TECHNICAL_SOP">Kỹ Thuật Lắp Ráp & Benchmark</option>
                        <option value="ERP_MANUAL">Hướng Dẫn Vận Hành Hệ Thống</option>
                        <option value="GENERAL">Quy Chế Chung Toàn Doanh Nghiệp</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Nội Dung Quy Định / Trả Lời Chuẩn Xác <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea
                      rows={6}
                      value={trainingForm.content}
                      onChange={e => setTrainingForm(p => ({ ...p, content: e.target.value }))}
                      style={inputStyle}
                      placeholder="Nhập nội dung quy chế hoặc giải đáp chuẩn xác để AI đối chiếu khi người dùng hỏi..."
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowTrainingModal(false)}
                style={secondaryBtnStyle}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveTrainingSkill}
                style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Sparkles size={14} />
                <span>Lưu & Áp Dụng Ngay Cho AI</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUDIT (NHẬT KÝ KIỂM TOÁN) */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={sectionTitleStyle}>
              <Activity size={18} style={{ color: '#2563eb' }} />
              <span>Nhật Ký Thao Tác & Giám Sát An Ninh Hệ Thống</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Hiển thị {auditLogs.length} sự kiện gần nhất
            </span>
          </div>

          {/* Dòng tổng hợp nhanh — dùng lại đúng auditLogs đã có trong state,
              không gọi thêm API nào, chỉ để quét số nhanh hơn thay vì phải đếm
              tay trong bảng dài phía dưới. */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <span style={badgeStyle('info')}>Tổng: {auditLogs.length}</span>
            <span style={badgeStyle('success')}>Thành công: {auditLogs.length - failedSecurityCount}</span>
            <span style={badgeStyle('danger')}>Thất bại: {failedSecurityCount}</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Thời Gian</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Người Thực Hiện</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Hành Động</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Phân Hệ</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Địa Chỉ IP</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Kết Quả</th>
                </tr>
              </thead>
              <tbody>
                {loadingAuditLogs ? (
                  <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Đang tải nhật ký...</td></tr>
                ) : auditLogs.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Chưa có sự kiện nào được ghi nhận.</td></tr>
                ) : auditLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: log.status === 'FAILED' ? '#fef2f2' : undefined }}>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontFamily: 'monospace' }}>{log.timestamp}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0f172a' }}>{log.user}</td>
                    <td style={{ padding: '0.65rem 0.85rem' }}>
                      <code style={{ fontSize: '0.78rem', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                        {log.action}
                      </code>
                    </td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>{log.module}</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontFamily: 'monospace' }}>{log.ip}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                      <span style={badgeStyle(log.status === 'SUCCESS' ? 'success' : 'danger')}>
                        {getStatusLabel(AUDIT_LOG_STATUS, log.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SETTINGS (CẤU HÌNH & SAO LƯU DỮ LIỆU) */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.25rem' }}>
          
          {/* Company Information Form */}
          <div style={cardStyle}>
            <h3 style={{ ...sectionTitleStyle, marginBottom: '1rem' }}>
              <Building size={18} style={{ color: '#2563eb' }} />
              <span>Thông Tin Doanh Nghiệp & Hóa Đơn</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div>
                <label style={labelStyle}>Tên Công Ty:</label>
                <input
                  type="text"
                  value={companyConfig.companyName}
                  onChange={e => setCompanyConfig(p => ({ ...p, companyName: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Mã Số Thuế (MST):</label>
                <input
                  type="text"
                  value={companyConfig.taxCode}
                  onChange={e => setCompanyConfig(p => ({ ...p, taxCode: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Hotline CSKH:</label>
                <input
                  type="text"
                  value={companyConfig.hotline}
                  onChange={e => setCompanyConfig(p => ({ ...p, hotline: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Địa Chỉ Trụ Sở:</label>
                <input
                  type="text"
                  value={companyConfig.address}
                  onChange={e => setCompanyConfig(p => ({ ...p, address: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <button
                disabled={savingSettings}
                onClick={handleSaveCompanySettings}
                style={{ ...primaryBtnStyle, padding: '0.5rem', cursor: savingSettings ? 'not-allowed' : 'pointer', marginTop: '0.5rem', opacity: savingSettings ? 0.7 : 1 }}
              >
                {savingSettings ? 'Đang lưu...' : 'Lưu Cấu Hình Doanh Nghiệp'}
              </button>
            </div>
          </div>

          {/* Business Rules & Backup */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Automatic Business Parameters */}
            <div style={cardStyle}>
              <h3 style={{ ...sectionTitleStyle, marginBottom: '1rem' }}>
                <Settings size={18} style={{ color: '#16a34a' }} />
                <span>Tham Số Tự Động Hóa Nghiệp Vụ</span>
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.82rem' }}>
                <div>
                  <label style={labelStyle}>Hoa Hồng Sales (% Doanh Số Thực Bán):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={companyConfig.salesCommissionFlat}
                    onChange={e => setCompanyConfig(p => ({ ...p, salesCommissionFlat: Number(e.target.value) }))}
                    style={inputStyle}
                  />
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
                    Tính trên tổng giá trị đơn hàng POS nhân viên Sales trực tiếp bán trong kỳ.
                  </p>
                </div>

                <div>
                  <label style={labelStyle}>Thưởng Ráp PC (VNĐ/bộ đã lắp xong):</label>
                  <input
                    type="number"
                    value={companyConfig.assemblyBonus}
                    onChange={e => setCompanyConfig(p => ({ ...p, assemblyBonus: Number(e.target.value) }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Thuế VAT Mặc Định (%):</label>
                  <input
                    type="number"
                    value={companyConfig.defaultVat}
                    onChange={e => setCompanyConfig(p => ({ ...p, defaultVat: Number(e.target.value) }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Ngưỡng Cảnh Báo Tồn Kho:</label>
                  <input
                    type="number"
                    value={companyConfig.lowStockThreshold}
                    onChange={e => setCompanyConfig(p => ({ ...p, lowStockThreshold: Number(e.target.value) }))}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Backup & Restore Hub */}
            <div style={cardStyle}>
              <h3 style={{ ...sectionTitleStyle, marginBottom: '0.5rem' }}>
                <HardDrive size={18} style={{ color: '#d97706' }} />
                <span>Sao Lưu & Phục Hồi Cơ Sở Dữ Liệu</span>
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '1rem' }}>
                Xuất file sao lưu toàn bộ dữ liệu đơn hàng, kho hàng, tài khoản nhân sự phục vụ lưu trữ định kỳ.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleBackupData}
                  style={{ backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Download size={15} /> Tải Về File Sao Lưu
                </button>
                <input
                  ref={restoreFileInputRef}
                  type="file"
                  accept=".dump"
                  onChange={handleRestoreFileSelected}
                  style={{ display: 'none' }}
                />
                <button
                  disabled={restoringData}
                  onClick={() => restoreFileInputRef.current?.click()}
                  style={{ backgroundColor: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: restoringData ? 'not-allowed' : 'pointer', opacity: restoringData ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Upload size={15} /> {restoringData ? 'Đang khôi phục...' : 'Khôi Phục Dữ Liệu'}
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ================= MODAL: THÊM NHÂN VIÊN MỚI ================= */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '480px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Tạo Tài Khoản Nhân Viên Mới</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div>
                <label style={labelStyle}>Họ và tên *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn Hùng"
                  value={form.fullname}
                  onChange={e => setForm(p => ({ ...p, fullname: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Username (Dùng đăng nhập) *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: hungnv"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Vai Trò *</label>
                <select
                  value={form.role}
                  onChange={e => {
                    const newRole = e.target.value;
                    let defaultDept = 'Kinh Doanh';
                    if (newRole === 'DELIVERY') defaultDept = 'Giao Vận';
                    else if (newRole === 'WAREHOUSE') defaultDept = 'Kho Vận';
                    else if (newRole === 'PURCHASING') defaultDept = 'Mua Hàng';
                    else if (newRole === 'QC' || newRole === 'QA') defaultDept = 'Kỹ Thuật';
                    else if (newRole === 'ASSEMBLY') defaultDept = 'Kỹ Thuật';
                    else if (newRole === 'HR') defaultDept = 'Hành Chính';
                    else if (newRole === 'ACCOUNTANT') defaultDept = 'Kế Toán';
                    else if (newRole === 'CSKH') defaultDept = 'Chăm Sóc Khách Hàng';
                    else if (newRole === 'CEO') defaultDept = 'Ban Giám Đốc';
                    else if (newRole === 'ADMIN') defaultDept = 'Hệ Thống IT';
                    setForm(p => ({ ...p, role: newRole, department: defaultDept }));
                  }}
                  style={inputStyle}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Phòng ban</label>
                <select
                  value={form.department}
                  onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                  style={inputStyle}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {form.role === 'DELIVERY' && (
                <>
                  <div>
                    <label style={labelStyle}>
                      Số điện thoại Shipper *
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 0912.345.678"
                      value={form.phone || ''}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #bfdbfe' }}>
                    <label style={{ display: 'block', fontWeight: 800, color: '#1e40af', marginBottom: '0.35rem' }}>
                      Khu Vực Giao Hàng Đảm Nhiệm *
                    </label>
                    <select
                      value={form.deliveryRegion || 'HCM_KV1'}
                      onChange={e => setForm(p => ({ ...p, deliveryRegion: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #93c5fd', backgroundColor: '#ffffff', fontWeight: 600, color: '#1e3a8a', boxSizing: 'border-box' }}
                    >
                      {DELIVERY_REGIONS.map(reg => (
                        <option key={reg.code} value={reg.code}>{reg.name}</option>
                      ))}
                    </select>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: '#3b82f6' }}>
                      Shipper sẽ chỉ thấy và nhận các đơn hàng thuộc khu vực này tại cổng Giao Hàng.
                    </p>
                  </div>
                </>
              )}

              <div>
                <label style={labelStyle}>Lương cơ bản (VNĐ) *</label>
                <input
                  type="number"
                  placeholder="8500000"
                  value={form.salary}
                  onChange={e => setForm(p => ({ ...p, salary: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.78rem', color: '#15803d' }}>
                ℹ️ Mật khẩu khởi tạo mặc định: <strong>123456</strong> (Nhân viên có thể đổi sau khi đăng nhập).
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  style={secondaryBtnStyle}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddEmployee}
                  style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={15} /> Tạo Tài Khoản
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: CHỈNH SỬA NHÂN VIÊN ================= */}
      {editingEmp && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '480px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Chỉnh Sửa Tài Khoản #{editingEmp.id}</h3>
              <button onClick={() => setEditingEmp(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div>
                <label style={labelStyle}>Họ và tên *</label>
                <input
                  type="text"
                  value={editingEmp.fullname}
                  onChange={e => setEditingEmp(p => ({ ...p, fullname: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Username</label>
                <input
                  type="text"
                  value={editingEmp.username}
                  disabled
                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Vai Trò *</label>
                <select
                  value={editingEmp.role}
                  onChange={e => {
                    const newRole = e.target.value;
                    let defaultDept = editingEmp.department;
                    if (newRole === 'DELIVERY') defaultDept = 'Giao Vận';
                    setEditingEmp(p => ({ ...p, role: newRole, department: defaultDept }));
                  }}
                  style={inputStyle}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {editingEmp.role === 'DELIVERY' && (
                <>
                  <div>
                    <label style={labelStyle}>
                      Số điện thoại Shipper
                    </label>
                    <input
                      type="text"
                      value={editingEmp.phone || ''}
                      onChange={e => setEditingEmp(p => ({ ...p, phone: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #bfdbfe' }}>
                    <label style={{ display: 'block', fontWeight: 800, color: '#1e40af', marginBottom: '0.35rem' }}>
                      Khu Vực Giao Hàng Đảm Nhiệm *
                    </label>
                    <select
                      value={editingEmp.deliveryRegion || 'HCM_KV1'}
                      onChange={e => setEditingEmp(p => ({ ...p, deliveryRegion: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #93c5fd', backgroundColor: '#ffffff', fontWeight: 600, color: '#1e3a8a', boxSizing: 'border-box' }}
                    >
                      {DELIVERY_REGIONS.map(reg => (
                        <option key={reg.code} value={reg.code}>{reg.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div style={{ backgroundColor: '#f8fafc', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontWeight: 700, color: '#64748b', marginBottom: '0.3rem' }}>Lương cơ bản (VNĐ)</label>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{fmt(editingEmp.salary)} ₫</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>Chỉnh sửa tại phân hệ Nhân Sự (Hồ Sơ Nhân Sự).</div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  style={secondaryBtnStyle}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (typeof updateEmployee !== 'function') return;
                    try {
                      // Backend (PUT /hr/employees/:id) reads `fullName`/`baseSalary` —
                      // this previously sent `fullname`/`salary`, so name and salary
                      // edits silently never persisted while role/department did.
                      // Admin's Users tab only owns account-level fields (name shown for
                      // display, username, role, delivery region); salary/department stay
                      // owned by HR's own employee-record screen (HRManager.jsx), so they
                      // are read-only here and intentionally omitted from this payload.
                      await updateEmployee(editingEmp.id, {
                        fullName: editingEmp.fullname,
                        role: editingEmp.role,
                        department: editingEmp.department,
                        deliveryRegion: editingEmp.deliveryRegion,
                        phone: editingEmp.phone
                      });
                      setEditingEmp(null);
                      notify('Cập nhật thông tin nhân viên thành công.', 'success');
                    } catch (err) {
                      notify(`Cập nhật thất bại: ${err.message || 'lỗi kết nối máy chủ'}.`, 'error');
                    }
                  }}
                  style={primaryBtnStyle}
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: CHI TIẾT & QUẢN LÝ TÀI KHOẢN KHÁCH HÀNG ================= */}
      {selectedCust && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '640px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {custDetail?.name || selectedCust.name}
                  </h3>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: (custDetail?.status || selectedCust.status) === 'INACTIVE' ? '#fef2f2' : '#f0fdf4', color: (custDetail?.status || selectedCust.status) === 'INACTIVE' ? '#dc2626' : '#16a34a' }}>
                    {(custDetail?.status || selectedCust.status) === 'INACTIVE' ? 'Vô hiệu hóa' : 'Đang hoạt động'}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                    Hạng: {custDetail?.tier || selectedCust.tier || 'BRONZE'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Mã tài khoản: <code style={{ color: '#2563eb', fontWeight: 700 }}>#{selectedCust.customerId}</code>
                  {custDetail?.username && <span> • Username: <strong>{custDetail.username}</strong></span>}
                </div>
              </div>
              <button onClick={handleCloseCustDetail} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {custModalLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Đang tải dữ liệu tài khoản...</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* 4 Thẻ KPI */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
                  <div style={{ padding: '0.65rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Đơn Hàng</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>{custDetail?.orderCount ?? selectedCust.orderCount ?? 0}</div>
                  </div>
                  <div style={{ padding: '0.65rem 0.75rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600 }}>Tổng Chi Tiêu</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#15803d', marginTop: '0.15rem' }}>{fmt(custDetail?.totalSpent || 0)} ₫</div>
                  </div>
                  <div style={{ padding: '0.65rem 0.75rem', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 600 }}>Điểm Thưởng</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b45309', marginTop: '0.15rem' }}>{custDetail?.loyaltyPoints ?? 0}</div>
                  </div>
                  <div style={{ padding: '0.65rem 0.75rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>Ngày Đăng Ký</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.25rem' }}>
                      {custDetail?.createdAt ? new Date(custDetail.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </div>
                  </div>
                </div>

                {/* Thanh tác vụ nhanh */}
                <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingCust(!isEditingCust)}
                      style={{ backgroundColor: isEditingCust ? '#e0e7ff' : '#ffffff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '6px', padding: '0.4rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Edit size={13} /> {isEditingCust ? 'Hủy chỉnh sửa' : 'Sửa thông tin'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetCustPassword(custDetail || selectedCust)}
                      style={{ backgroundColor: '#ffffff', color: '#d97706', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.4rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Key size={13} /> Reset Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleCustStatus(custDetail || selectedCust)}
                      style={{ backgroundColor: '#ffffff', color: (custDetail?.status || selectedCust.status) === 'INACTIVE' ? '#16a34a' : '#d97706', border: `1px solid ${(custDetail?.status || selectedCust.status) === 'INACTIVE' ? '#bbf7d0' : '#fed7aa'}`, borderRadius: '6px', padding: '0.4rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Lock size={13} /> {(custDetail?.status || selectedCust.status) === 'INACTIVE' ? 'Kích hoạt tài khoản' : 'Vô hiệu hóa'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomer(custDetail || selectedCust)}
                    style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.4rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Trash2 size={13} /> Xóa tài khoản
                  </button>
                </div>

                {/* Nội dung chi tiết hoặc Form chỉnh sửa */}
                {isEditingCust ? (
                  <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #2563eb', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontWeight: 800, color: '#1e40af', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      ✏️ Cập Nhật Thông Tin Tài Khoản
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={labelStyle}>Họ và tên *</label>
                        <input
                          type="text"
                          value={custEditForm.name}
                          onChange={e => setCustEditForm(p => ({ ...p, name: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Email đăng nhập *</label>
                        <input
                          type="email"
                          value={custEditForm.email}
                          onChange={e => setCustEditForm(p => ({ ...p, email: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Số điện thoại</label>
                        <input
                          type="text"
                          value={custEditForm.phone}
                          onChange={e => setCustEditForm(p => ({ ...p, phone: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Hạng thành viên</label>
                        <select
                          value={custEditForm.tier}
                          onChange={e => setCustEditForm(p => ({ ...p, tier: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="REGULAR">REGULAR</option>
                          <option value="BRONZE">BRONZE (Đồng)</option>
                          <option value="SILVER">SILVER (Bạc)</option>
                          <option value="GOLD">GOLD (Vàng)</option>
                          <option value="PLATINUM">PLATINUM (Bạch Kim)</option>
                          <option value="VIP">VIP</option>
                        </select>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Địa chỉ</label>
                        <input
                          type="text"
                          placeholder="Số nhà, tên đường, phường/xã..."
                          value={custEditForm.address}
                          onChange={e => setCustEditForm(p => ({ ...p, address: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Tỉnh / Thành phố</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: TP. Hồ Chí Minh"
                          value={custEditForm.city}
                          onChange={e => setCustEditForm(p => ({ ...p, city: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setIsEditingCust(false)}
                        style={secondaryBtnStyle}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={savingCust}
                        onClick={handleSaveCustEdit}
                        style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Check size={14} /> {savingCust ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.85rem' }}>
                      <h4 style={{ margin: '0 0 0.65rem 0', fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>Thông Tin Liên Hệ & Địa Chỉ</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: '#64748b' }}>Họ và tên:</span>
                          <strong style={{ display: 'block', color: '#0f172a' }}>{custDetail?.name || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Email:</span>
                          <strong style={{ display: 'block', color: '#0f172a' }}>{custDetail?.email || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Số điện thoại:</span>
                          <strong style={{ display: 'block', color: '#0f172a' }}>{custDetail?.phone || 'Chưa cập nhật'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Tỉnh / Thành phố:</span>
                          <strong style={{ display: 'block', color: '#0f172a' }}>{custDetail?.city || 'Chưa cập nhật'}</strong>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ color: '#64748b' }}>Địa chỉ giao hàng:</span>
                          <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '0.15rem' }}>{custDetail?.address || 'Chưa cập nhật'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Sổ địa chỉ giao hàng phụ (nếu có) */}
                    {custDetail?.addresses && custDetail.addresses.length > 0 && (
                      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.85rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>
                          Sổ Địa Chỉ Giao Hàng ({custDetail.addresses.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
                          {custDetail.addresses.map((addr, idx) => (
                            <div key={addr.id || idx} style={{ padding: '0.45rem 0.65rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong>{addr.recipientName}</strong> ({addr.recipientPhone}) — {addr.addressLine}, {addr.ward ? `${addr.ward}, ` : ''}{addr.district ? `${addr.district}, ` : ''}{addr.city}
                              </div>
                              {addr.isDefault && (
                                <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, backgroundColor: '#eff6ff', color: '#2563eb' }}>Mặc định</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Đơn hàng gần nhất */}
                    {custDetail?.orders && custDetail.orders.length > 0 && (
                      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>
                            Đơn Hàng Gần Đây ({custDetail.orders.length})
                          </h4>
                          <span 
                            style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}
                            onClick={() => {
                              handleCloseCustDetail();
                              navigate(`/admin/sales?tab=orders&search=${encodeURIComponent(custDetail.customerId)}`);
                            }}
                          >
                            Xem tất cả đơn →
                          </span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                              <th style={{ padding: '0.4rem 0.5rem' }}>Mã Đơn</th>
                              <th style={{ padding: '0.4rem 0.5rem' }}>Ngày Đặt</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>Trạng Thái</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Tổng Tiền</th>
                            </tr>
                          </thead>
                          <tbody>
                            {custDetail.orders.map(o => (
                              <tr key={o.orderId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.4rem 0.5rem', fontWeight: 700, color: '#2563eb' }}>{o.orderId}</td>
                                <td style={{ padding: '0.4rem 0.5rem', color: '#64748b' }}>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#475569' }}>
                                    {getStatusLabel(ORDER_STATUS, o.status)}
                                  </span>
                                </td>
                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(o.totalAmount)} ₫</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                  </div>
                )}

              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
              <button
                type="button"
                onClick={handleCloseCustDetail}
                style={secondaryBtnStyle}
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: THÊM / SỬA TÀI KHOẢN NGÂN HÀNG DOANH NGHIỆP */}
      {/* ========================================================================= */}
      {showBankModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CreditCard size={20} style={{ color: '#2563eb' }} />
                <span>{editingBank ? 'Chỉnh Sửa Tài Khoản Ngân Hàng' : 'Thêm Tài Khoản Ngân Hàng Doanh Nghiệp'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBankModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBankAccount} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.82rem' }}>
              <div>
                <label style={labelStyle}>Ngân Hàng <span style={{ color: '#dc2626' }}>*</span></label>
                <select
                  value={bankForm.bankCode}
                  onChange={(e) => {
                    const sel = VIETNAMESE_BANKS.find(b => b.code === e.target.value);
                    setBankForm(p => ({
                      ...p,
                      bankCode: e.target.value,
                      bankName: sel ? sel.name : p.bankName
                    }));
                  }}
                  style={inputStyle}
                  required
                >
                  {VIETNAMESE_BANKS.map(b => (
                    <option key={b.code} value={b.code}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Tên Ngân Hàng Đầy Đủ</label>
                <input
                  type="text"
                  value={bankForm.bankName}
                  onChange={e => setBankForm(p => ({ ...p, bankName: e.target.value }))}
                  style={inputStyle}
                  placeholder="Ví dụ: MBBank (Ngân hàng TMCP Quân Đội)"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Số Tài Khoản <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  value={bankForm.accountNumber}
                  onChange={e => setBankForm(p => ({ ...p, accountNumber: e.target.value.replace(/\s+/g, '') }))}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em' }}
                  placeholder="Nhập số tài khoản"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Chủ Tài Khoản (In hoa không dấu) <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  value={bankForm.accountHolder}
                  onChange={e => setBankForm(p => ({ ...p, accountHolder: e.target.value.toUpperCase() }))}
                  style={{ ...inputStyle, textTransform: 'uppercase', fontWeight: 700 }}
                  placeholder="CÔNG TY TNHH AETHERPC"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Chi Nhánh</label>
                <input
                  type="text"
                  value={bankForm.branch}
                  onChange={e => setBankForm(p => ({ ...p, branch: e.target.value }))}
                  style={inputStyle}
                  placeholder="Chi nhánh / Phòng giao dịch"
                />
              </div>

              <div>
                <label style={labelStyle}>Mục Đích Sử Dụng</label>
                <input
                  type="text"
                  value={bankForm.purpose}
                  onChange={e => setBankForm(p => ({ ...p, purpose: e.target.value }))}
                  style={inputStyle}
                  placeholder="Ví dụ: Tài khoản nhận tiền hàng & VietQR"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                <div>
                  <label style={labelStyle}>Trạng Thái</label>
                  <select
                    value={bankForm.status}
                    onChange={e => setBankForm(p => ({ ...p, status: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                    <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, color: '#1e40af' }}>
                    <input
                      type="checkbox"
                      checked={bankForm.isDefaultQr}
                      onChange={e => setBankForm(p => ({ ...p, isDefaultQr: e.target.checked }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>Đặt làm VietQR mặc định</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  style={secondaryBtnStyle}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={bankSubmitting}
                  style={{ ...primaryBtnStyle, opacity: bankSubmitting ? 0.7 : 1, cursor: bankSubmitting ? 'not-allowed' : 'pointer' }}
                >
                  {bankSubmitting ? 'Đang lưu...' : (editingBank ? 'Lưu Thay Đổi' : 'Tạo Tài Khoản')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL XEM CHI TIẾT TÀI LIỆU KNOWLEDGE */}
      {/* ========================================================================= */}
      {viewingKnowledgeDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={badgeStyle('info')}>
                    {viewingKnowledgeDoc.category}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                    Mã SOP: <strong>{viewingKnowledgeDoc.slug}</strong>
                  </span>
                  <span style={badgeStyle(viewingKnowledgeDoc.isActive ? 'success' : 'danger')}>
                    {viewingKnowledgeDoc.isActive ? 'Hiệu Lực' : 'Tạm Ẩn'}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  {viewingKnowledgeDoc.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingKnowledgeDoc(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
              {viewingKnowledgeDoc.summary && (
                <div style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  color: '#166534',
                  marginBottom: '1rem',
                  lineHeight: 1.5
                }}>
                  <strong>Tóm tắt cốt lõi:</strong> {viewingKnowledgeDoc.summary}
                </div>
              )}

              <div style={{
                fontSize: '0.85rem',
                lineHeight: 1.65,
                color: '#1e293b',
                whiteSpace: 'pre-wrap',
                backgroundColor: '#f8fafc',
                padding: '1.25rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                {viewingKnowledgeDoc.content}
              </div>

              {/* Metadata */}
              <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Từ Khóa Tags:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(viewingKnowledgeDoc.tags || []).map((t, idx) => (
                      <span key={idx} style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', border: '1px solid #e2e8f0' }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Vai Trò Được Phép Truy Cập (RBAC):</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(viewingKnowledgeDoc.allowedRoles || []).map((role, idx) => (
                      <span key={idx} style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, border: '1px solid #bfdbfe' }}>
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  const docToEdit = viewingKnowledgeDoc;
                  setViewingKnowledgeDoc(null);
                  handleOpenKnowledgeModal(docToEdit);
                }}
                style={secondaryBtnStyle}
              >
                Chỉnh Sửa Tài Liệu
              </button>
              <button
                onClick={() => setViewingKnowledgeDoc(null)}
                style={primaryBtnStyle}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL THÊM / SỬA TÀI LIỆU KNOWLEDGE */}
      {/* ========================================================================= */}
      {showKnowledgeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  {editingKnowledgeDoc ? 'Chỉnh Sửa Tài Liệu SOP' : 'Thêm Tài Liệu Quy Trình SOP Mới'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Tài liệu sau khi lưu sẽ được AI Copilot lập chỉ mục tham chiếu tức thì theo phân quyền RBAC
                </p>
              </div>
              <button
                onClick={() => setShowKnowledgeModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveKnowledge} style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Tiêu Đề Tài Liệu SOP <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    required
                    value={knowledgeForm.title}
                    onChange={e => setKnowledgeForm(p => ({ ...p, title: e.target.value }))}
                    style={inputStyle}
                    placeholder="Ví dụ: Chính Sách Bảo Hành & Đổi Trả Linh Kiện 1 Đổi 1"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mã Định Danh (Slug)</label>
                  <input
                    type="text"
                    value={knowledgeForm.slug}
                    onChange={e => setKnowledgeForm(p => ({ ...p, slug: e.target.value }))}
                    style={inputStyle}
                    placeholder="Tự tạo nếu để trống (e.g. sop-warranty-01)"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Danh Mục Quy Trình</label>
                  <select
                    value={knowledgeForm.category}
                    onChange={e => setKnowledgeForm(p => ({ ...p, category: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="POLICY">Chính Sách & Quy Định (POLICY)</option>
                    <option value="PROCEDURE">Quy Trình Chuẩn (PROCEDURE / SOP)</option>
                    <option value="SALES_GUIDE">Hướng Dẫn Bán Hàng (SALES_GUIDE)</option>
                    <option value="TECH_SPEC">Kỹ Thuật & QA (TECH_SPEC)</option>
                    <option value="FINANCE">Tài Chính & Kế Toán (FINANCE)</option>
                    <option value="HR_POLICY">Nhân Sự & Lương (HR_POLICY)</option>
                    <option value="GENERAL">Quy Chế Chung (GENERAL)</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Trạng Thái Áp Dụng</label>
                  <select
                    value={knowledgeForm.isActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={e => setKnowledgeForm(p => ({ ...p, isActive: e.target.value === 'ACTIVE' }))}
                    style={inputStyle}
                  >
                    <option value="ACTIVE">Hiệu Lực (Áp dụng & Cho phép AI tra cứu)</option>
                    <option value="INACTIVE">Tạm Ẩn (Không áp dụng)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Tóm Tắt Ngắn Gọn (Summary) <span style={{ color: '#64748b', fontWeight: 400 }}>(Hiển thị khi AI trích dẫn)</span></label>
                <textarea
                  rows={2}
                  value={knowledgeForm.summary}
                  onChange={e => setKnowledgeForm(p => ({ ...p, summary: e.target.value }))}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Tóm tắt ngắn 1-3 câu về nội dung và điều kiện áp dụng của quy trình này..."
                />
              </div>

              <div>
                <label style={labelStyle}>Nội Dung Chi Tiết Tài Liệu <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  rows={9}
                  required
                  value={knowledgeForm.content}
                  onChange={e => setKnowledgeForm(p => ({ ...p, content: e.target.value }))}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.5 }}
                  placeholder="Nhập toàn văn tài liệu quy định, bao gồm các điều khoản, quy trình các bước, thẩm quyền phê duyệt, thời hạn và số liệu cụ thể..."
                />
              </div>

              <div>
                <label style={labelStyle}>Từ Khóa Tìm Kiếm (Tags) <span style={{ color: '#64748b', fontWeight: 400 }}>(cách nhau bằng dấu phẩy)</span></label>
                <input
                  type="text"
                  value={knowledgeForm.tags}
                  onChange={e => setKnowledgeForm(p => ({ ...p, tags: e.target.value }))}
                  style={inputStyle}
                  placeholder="bảo hành, đổi trả, 1 đổi 1, rma, linh kiện..."
                />
              </div>

              <div>
                <label style={labelStyle}>Phân Quyền Vai Trò Được Xem (RBAC) <span style={{ color: '#64748b', fontWeight: 400 }}>(Chỉ các vai trò được chọn mới tra cứu được tài liệu này)</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '0.4rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {ROLES.map(role => {
                    const isChecked = knowledgeForm.allowedRoles.includes(role);
                    return (
                      <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: isChecked ? '#1d4ed8' : '#475569' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setKnowledgeForm(p => ({ ...p, allowedRoles: [...p.allowedRoles, role] }));
                            } else {
                              setKnowledgeForm(p => ({ ...p, allowedRoles: p.allowedRoles.filter(r => r !== role) }));
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowKnowledgeModal(false)}
                  style={secondaryBtnStyle}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={knowledgeSubmitting}
                  style={{ ...primaryBtnStyle, opacity: knowledgeSubmitting ? 0.7 : 1, cursor: knowledgeSubmitting ? 'not-allowed' : 'pointer' }}
                >
                  {knowledgeSubmitting ? 'Đang lưu tài liệu...' : (editingKnowledgeDoc ? 'Lưu Cập Nhật' : 'Tạo Tài Liệu Mới')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
