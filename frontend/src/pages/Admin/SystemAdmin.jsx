import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { 
  Settings, Shield, Users, Database, Plus, X, Eye, EyeOff, Search, 
  CheckCircle, XCircle, AlertCircle, Key, Lock, Edit, Trash2, 
  RefreshCw, Download, Upload, Server, ShieldCheck, FileText, Check, 
  AlertTriangle, HardDrive, Cpu, Layers, Activity, ArrowRight, UserCheck, UserX,
  Building
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
import { AUDIT_LOG_STATUS, getStatusLabel } from '../../utils/statusLabels';
import {
  ERP_SYSTEM_MODULES,
  ERP_ROLES,
  getRoleRelevantModules,
  OPERATIONAL_PERMISSIONS,
  DEFAULT_OPERATIONAL_MATRIX,
  getOperationalRbac,
  saveOperationalRbac
} from '../../utils/rbacEngine';

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

  // RBAC Selected Role & Matrix State
  const [selectedRbacRole, setSelectedRbacRole] = useState('SALES_MANAGER');
  const [savedRbacMatrix, setSavedRbacMatrix] = useState(() => getOperationalRbac());
  const [rbacMatrix, setRbacMatrix] = useState(() => getOperationalRbac());
  const [showOnlyRelevant, setShowOnlyRelevant] = useState(true);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

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
            {activeTab === 'rbac' && 'Ma Trận Phân Quyền Vai Trò'}
            {activeTab === 'audit' && 'Nhật Ký Kiểm Toán & Giám Sát'}
            {activeTab === 'settings' && 'Cấu Hình & Sao Lưu Dữ Liệu'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            Quản trị người dùng, phân quyền chi tiết cho từng vai trò và sao lưu dữ liệu an toàn
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
        <div style={cardStyle}>
          
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
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RBAC (DANH MỤC PHÂN QUYỀN THEO NGHIỆP VỤ THỰC TẾ) */}
      {/* ========================================================================= */}
      {activeTab === 'rbac' && (() => {
        const currentRoleObj = ERP_ROLES.find(r => r.code === selectedRbacRole) || ERP_ROLES[0];
        const rolePerms = rbacMatrix[selectedRbacRole] || {};
        const isAdminRole = selectedRbacRole === 'ADMIN';

        const relevantModuleIds = getRoleRelevantModules(selectedRbacRole);
        const displayedModules = (showOnlyRelevant && !isAdminRole && relevantModuleIds.length > 0)
          ? ERP_SYSTEM_MODULES.filter(m => relevantModuleIds.includes(m.id))
          : ERP_SYSTEM_MODULES;

        // Get operations for displayed modules
        const displayedOperations = OPERATIONAL_PERMISSIONS.filter(op => 
          displayedModules.some(m => m.id === op.moduleId)
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

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Phần lớn ma trận này vẫn chỉ điều khiển việc ẨN/HIỆN menu và khoá/mở
                nút trên giao diện — quyền gọi API cho đa số tác vụ vẫn do
                authMiddleware() ở từng route backend quyết định độc lập, không
                đọc ma trận này. Ngoại lệ: 5 tác vụ rủi ro cao nhất (duyệt PO,
                CEO duyệt lương, giải ngân lương, hủy đơn & hoàn tiền, vô hiệu
                hóa nhân viên) ĐÃ được backend thực sự kiểm tra qua bảng này
                (checkOperationalPermission, xem rbac.middleware.js) — tắt 1
                trong 5 quyền đó sẽ chặn thật API tương ứng, không chỉ ẩn nút. */}
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#92400e', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>
                Phần lớn đây là cấu hình <strong>hiển thị giao diện</strong> (ẩn/hiện menu, khoá nút) theo vai trò —
                quyền gọi API cho đa số tác vụ vẫn do backend kiểm soát độc lập theo vai trò đăng nhập.
                Riêng <strong>5 tác vụ rủi ro cao</strong> (Ký duyệt Báo Giá/PO, Phê duyệt Bảng lương, Giải ngân lương,
                Duyệt hủy đơn & hoàn tiền, Quản lý hồ sơ nhân viên) đã được backend <strong>thực sự chặn API</strong> theo đúng thiết lập ở đây.
              </span>
            </div>

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

              {/* Filter Info Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
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

              {/* Modules & Granular Operations List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {displayedModules.map((mod) => {
                  const moduleOps = OPERATIONAL_PERMISSIONS.filter(op => op.moduleId === mod.id);
                  if (moduleOps.length === 0) return null;

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
                          {moduleOps.map((op, opIdx) => {
                            const isEnabled = isAdminRole ? true : Boolean(rolePerms[op.id]);

                            return (
                              <div
                                key={op.id}
                                style={{
                                  padding: '0.75rem 1.15rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  borderBottom: opIdx < moduleOps.length - 1 ? '1px solid #f1f5f9' : 'none',
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
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isEnabled ? '#15803d' : '#334155' }}>
                                      {op.name}
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
              </div>
            </div>

            {/* 4. MODAL XÁC NHẬN LƯU PHÂN QUYỀN */}
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
                  <label style={labelStyle}>Hoa Hồng Sales (VNĐ/kỳ lương):</label>
                  <input
                    type="number"
                    value={companyConfig.salesCommissionFlat}
                    onChange={e => setCompanyConfig(p => ({ ...p, salesCommissionFlat: Number(e.target.value) }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Thưởng Ráp PC (VNĐ/bộ):</label>
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

    </div>
  );
}
