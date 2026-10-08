import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { useInventoryStore, useSalesStore, useFinanceStore, useHRStore, useUtilityStore } from '../../stores';
import { notify } from '../../context/NotificationContext';
import { api } from '../../services/api';
import { useMenuBadges } from '../../hooks/useRoleTasks';
import { LEAVE_STATUS, getStatusInfo, getStatusLabel } from '../../utils/statusLabels';
import { 
  BarChart2, 
  ShoppingCart, 
  Database, 
  Wrench, 
  Home, 
  LogOut, 
  User,
  ShieldAlert,
  Users,
  DollarSign,
  HeadphonesIcon,
  Truck,
  Bell,
  X,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare,
  RefreshCw,
  Settings,
  CalendarCheck,
  Send,
  Wallet
} from 'lucide-react';

export default function Sidebar({ isOpen = false, onClose }) {
  const { user, logout, isCEO, isSales, isSalesManager, isWarehouse, isWarehouseManager, isAssembly, isHR, isAccountant, isPurchasing, isAdmin } = useAuth();
  // Số trên menu = số việc VAI TRÒ ĐANG ĐĂNG NHẬP cần làm ở mục đó — cùng nguồn với Trung Tâm Nhiệm Vụ đầu trang.
  const { badges: menuBadges, tasks: roleTasks } = useMenuBadges();
  // Phân hệ đang được sổ xuống (bấm mũi tên bên phải). Mặc định thu gọn hết: vừa đăng nhập chỉ thấy các phân hệ lớn.
  const [openModules, setOpenModules] = useState(() => new Set());
  const toggleModule = (path) => setOpenModules(prev => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });
  const MODULES_WITH_SUBMENU = ['/admin/dashboard', '/admin/sales', '/admin/warehouse', '/admin/purchasing', '/admin/quality-control',
    '/admin/assembly', '/admin/hr', '/admin/accounting', '/admin/cskh', '/admin/delivery', '/admin/system'];
  // Tổng số việc của cả phân hệ — hiện cạnh tên khi phân hệ đang thu gọn
  const moduleBadgeTotal = (path) => Object.entries(menuBadges)
    .filter(([k]) => k.startsWith(path + '?'))
    .reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
  const { can, canDo, canRead } = usePermission();
  const inventory = useInventoryStore(state => state.inventory) || [];
  const orders = useSalesStore(state => state.orders) || [];
  const returnRequests = useSalesStore(state => state.returnRequests) || [];
  const complaints = useSalesStore(state => state.complaints) || [];
  const purchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];
  const payrolls = useHRStore(state => state.payrolls) || [];
  const leaveRequests = useHRStore(state => state.leaveRequests) || [];
  const assemblyJobs = useUtilityStore(state => state.assemblyJobs) || [];
  const customNotifs = useUtilityStore(state => state.customNotifs) || [];
  const isCskh = user?.role === 'CSKH';
  const isDelivery = user?.role === 'DELIVERY';
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [notifFilter, setNotifFilter] = useState('ALL');
  const [dismissedNotifIds, setDismissedNotifIds] = useState([]);

  // Mọi nhân viên (không riêng HR/CEO) tự xin nghỉ phép của chính mình —
  // backend POST/GET /hr/leaves đã hỗ trợ mọi role từ lâu nhưng trước đây
  // không có giao diện nào trong toàn bộ frontend gọi tới nó.
  const createMyLeaveRequest = useHRStore(state => state.createMyLeaveRequest);
  const getMyLeaveRequests = useHRStore(state => state.getMyLeaveRequests);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [loadingMyLeaves, setLoadingMyLeaves] = useState(false);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'Phép Năm', startDate: '', endDate: '', reason: '' });

  const openLeaveModal = async () => {
    setShowLeaveModal(true);
    if (typeof getMyLeaveRequests !== 'function') return;
    setLoadingMyLeaves(true);
    try {
      const data = await getMyLeaveRequests();
      setMyLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      notify(err.message || 'Không thể tải đơn nghỉ phép của bạn.', 'error');
    } finally {
      setLoadingMyLeaves(false);
    }
  };

  const handleSubmitLeaveRequest = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate) {
      notify('Vui lòng chọn ngày bắt đầu và kết thúc.', 'error');
      return;
    }
    if (typeof createMyLeaveRequest !== 'function') return;
    setSubmittingLeave(true);
    try {
      const created = await createMyLeaveRequest(leaveForm);
      setMyLeaves(prev => [created, ...prev]);
      setLeaveForm({ type: 'Phép Năm', startDate: '', endDate: '', reason: '' });
      notify('Đã gửi đơn xin nghỉ phép, chờ HR/CEO phê duyệt.', 'success');
    } catch (err) {
      notify(err.message || 'Không thể gửi đơn xin nghỉ phép.', 'error');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const ceoSubItems = [
    { tab: 'overview', label: 'Tổng Quan Điều Hành' },
    { tab: 'approvals', label: 'Trung Tâm Phê Duyệt', badgeKey: 'pendingCeoApprovals' },
    { tab: 'financials', label: 'Tài Chính & Lãi Lỗ (P&L)' },
    { tab: 'kpi', label: 'Năng Suất & KPI Nhân Sự' },
    { tab: 'supplychain', label: 'Chuỗi Cung Ứng & Kho' }
  ];

  const qcSubItems = [
    { tab: 'overview', label: 'Tổng Quan Kiểm Định' },
    { tab: 'inbound', label: 'Kiểm Định Hàng Nhập (PO)', badgeKey: 'pendingQaCount' },
    { tab: 'returns', label: 'Thẩm Định Đổi Trả (RMA)', badgeKey: 'pendingReturnsCount' },
    { tab: 'logs', label: 'Nhật Ký & Biên Bản QA' },
    { tab: 'reports', label: 'Báo Cáo & Đánh Giá NCC' }
  ];

  const adminSubItems = [
    { tab: 'overview', label: 'Tổng Quan Quản Trị' },
    { tab: 'users', label: 'Tài Khoản & Người Dùng' },
    { tab: 'bank-accounts', label: 'Tài Khoản Doanh Nghiệp' },
    { tab: 'rbac', label: 'Ma Trận Phân Quyền' },
    { tab: 'knowledge', label: 'Cơ Sở Tri Thức & SOP' },
    { tab: 'ai-training', label: 'Huấn Luyện & Đào Tạo AI' },
    { tab: 'audit', label: 'Nhật Ký Kiểm Toán' },
    { tab: 'settings', label: 'Cấu Hình & Sao Lưu' }
  ];

  const hrSubItems = [
    { tab: 'overview', label: 'Tổng Quan Nhân Sự' },
    { tab: 'attendance', label: 'Chấm Công Hàng Ngày' },
    { tab: 'timesheet', label: 'Bảng Công Tháng' },
    { tab: 'employees', label: 'Hồ Sơ Nhân Viên' },
    { tab: 'leaves', label: 'Quản Lý Nghỉ Phép', badgeKey: 'pendingLeaveApproval' },
    { tab: 'payroll', label: 'Tính Lương & Trình Duyệt' },
    { tab: 'settings', label: 'Cấu Hình Công & Lương' }
  ];

  const accountingSubItems = [
    { tab: 'overview', label: 'Tổng Quan Tài Chính' },
    { tab: 'ledger', label: 'Sổ Cái Dòng Tiền (Ledger)' },
    { tab: 'po_payments', label: 'Thanh Toán Đơn PO', badgeKey: 'pendingQuotedPOs' },
    { tab: 'cod_settlement', label: 'Đối Soát COD Shipper' },
    { tab: 'payroll_disbursement', label: 'Chi Trả Bảng Lương', badgeKey: 'pendingPayrollApproval' },
    { tab: 'refunds', label: 'Chi Hoàn Tiền Đổi Trả', badgeKey: 'refunds' },
    { tab: 'transfer_refunds', label: 'Hoàn Tiền Chuyển Khoản' },
    { tab: 'reports', label: 'Báo Cáo P&L & VAT' }
  ];

  const cskhSubItems = [
    { tab: 'overview', label: 'Tổng Quan CSKH' },
    { tab: 'complaints', label: 'Xử Lý Khiếu Nại', badgeKey: 'openComplaintsCount' },
    { tab: 'livechat', label: 'Chat Tư Vấn (Live Chat)', badgeKey: 'onlineChatCount' },
    { tab: 'returns', label: 'Tiếp Nhận Đổi Trả', badgeKey: 'pendingReturnsCount' },
    { tab: 'feedback', label: 'Đánh Giá & CSAT' }
  ];

  const deliverySubItems = [
    { tab: 'overview', label: 'Tổng Quan Giao Vận' },
    { tab: 'pending', label: 'Đơn Chờ Nhận Giao', badgeKey: 'readyToShipCount' },
    { tab: 'active', label: 'Đang Giao & Minh Chứng', badgeKey: 'myActiveDeliveryCount' },
    { tab: 'returns', label: 'Thu Hồi Đổi Trả (RMA)', badgeKey: 'pendingReturnsCount' },
    { tab: 'history', label: 'Lịch Sử & Bảng Kê COD' }
  ];

  const warehouseSubItems = [
    { tab: 'overview', label: 'Tổng Quan Tồn Kho' },
    { tab: 'backorders', label: 'Đơn Chờ Hàng', badgeKey: 'backordersCount' },
    { tab: 'grn', label: 'Phiếu Nhập Kho', badgeKey: 'pendingReceipts' },
    { tab: 'delivery', label: 'Lệnh Giao Hàng', badgeKey: 'pendingExportCount' },
    { tab: 'intake', label: 'Nhập Trực Tiếp' },
    { tab: 'rfq', label: 'Bổ Sung Hàng (RFQ)', badgeKey: 'lowStockCount' },
    { tab: 'returns', label: 'Hàng Lỗi & Trả Về', badgeKey: 'pendingReturnsCount' },
    { tab: 'inventory', label: 'Danh Sách Sản Phẩm' },
    { tab: 'history', label: 'Lịch Sử Điều Chuyển' },
    { tab: 'locations', label: 'Kho Hàng & Vị Trí Kệ' },
    { tab: 'categories', label: 'Danh Mục Sản Phẩm' }
  ];


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserDisplayName = () => {
    if (user?.fullname) return user.fullname;
    switch (user?.role) {
      case 'CEO': return 'Nguyễn Văn A (CEO)';
      case 'ADMIN': return 'Quản Trị Viên';
      case 'SALES_MANAGER': return 'Trần Anh Quản Lý Bán Hàng';
      case 'SALES': return 'Trần Thị B (Nhân Viên Bán Hàng)';
      case 'WAREHOUSE_MANAGER': return 'Lê Hoàng Quản Lý Kho';
      case 'WAREHOUSE': return 'Lê Văn C (Thủ Kho)';
      case 'PURCHASING': return 'Nhân Viên Mua Hàng';
      case 'ASSEMBLY': return 'Nhân Viên Lắp Ráp';
      case 'HR': return 'Quản Lý Nhân Sự';
      case 'ACCOUNTANT': return 'Kế Toán Trưởng';
      case 'CSKH': return 'Chăm Sóc Khách Hàng';
      case 'DELIVERY': return 'Nhân Viên Giao Hàng';
      case 'EMPLOYEE': return 'Nhân Viên Văn Phòng';
      default: return user?.username ? user.username.toUpperCase() : 'Tài Khoản ERP';
    }
  };

  const getRoleDisplayName = () => {
    switch (user?.role) {
      case 'CEO': return 'Ban Giám Đốc (CEO)';
      case 'ADMIN': return 'Quản Trị Viên';
      case 'SALES_MANAGER': return 'Quản Lý Bán Hàng';
      case 'SALES': return 'Nhân Viên Bán Hàng';
      case 'WAREHOUSE_MANAGER': return 'Quản Lý Kho Vận';
      case 'WAREHOUSE': return 'Thủ Kho (Vận Hành)';
      case 'PURCHASING': return 'Phòng Mua Hàng';
      case 'ASSEMBLY': return 'Kỹ Thuật Lắp Ráp';
      case 'HR': return 'Quản Lý Nhân Sự';
      case 'ACCOUNTANT': return 'Kế Toán Tài Chính';
      case 'CSKH': return 'Chăm Sóc Khách Hàng';
      case 'DELIVERY': return 'Nhân Viên Giao Hàng';
      case 'EMPLOYEE': return 'Nhân Viên (Văn Phòng)';
      default: return user?.role || 'Nhân Sự';
    }
  };

  const navItems = [
    {
      id: 'dashboard',
      path: '/admin/dashboard',
      label: 'Tổng Quan',
      icon: <BarChart2 size={18} />,
      visible: canRead('dashboard') || isCEO
    },
    {
      id: 'sales',
      path: '/admin/sales',
      label: 'Bán Hàng',
      icon: <ShoppingCart size={18} />,
      visible: canRead('sales')
    },
    {
      id: 'warehouse',
      path: '/admin/warehouse',
      label: 'Kho',
      icon: <Database size={18} />,
      visible: canRead('warehouse')
    },
    {
      id: 'purchasing',
      path: '/admin/purchasing',
      label: 'Mua Hàng',
      icon: <ShoppingCart size={18} />,
      visible: canRead('purchasing')
    },
    {
      id: 'quality-control',
      path: '/admin/quality-control',
      label: 'Kiểm Định',
      icon: <ShieldAlert size={18} />,
      visible: canRead('quality-control')
    },
    {
      id: 'assembly',
      path: '/admin/assembly',
      label: 'Lắp Ráp',
      icon: <Wrench size={18} />,
      visible: canRead('assembly')
    },
    {
      id: 'hr',
      path: '/admin/hr',
      label: 'Nhân Sự',
      icon: <Users size={18} />,
      visible: canRead('hr')
    },
    {
      id: 'accounting',
      path: '/admin/accounting',
      label: 'Kế Toán',
      icon: <DollarSign size={18} />,
      visible: canRead('accounting')
    },
    {
      id: 'cskh',
      path: '/admin/cskh',
      label: 'CSKH',
      icon: <HeadphonesIcon size={18} />,
      visible: canRead('cskh')
    },
    {
      id: 'delivery',
      path: '/admin/delivery',
      label: 'Giao Vận',
      icon: <Truck size={18} />,
      visible: canRead('delivery')
    },
    {
      // Tự phục vụ cho mọi nhân viên: chấm công khuôn mặt, nghỉ phép, phiếu lương, hồ sơ.
      id: 'me',
      path: '/admin/me',
      label: 'Thông tin cá nhân',
      icon: <User size={18} />,
      visible: true
    },
    {
      id: 'system',
      path: '/admin/system',
      label: 'Hệ Thống',
      icon: <Settings size={18} />,
      visible: canRead('system') || isAdmin
    }
  ];

  // Dynamic ERP Notifications Generator
  const getNotifications = () => {
    const list = [];
    const role = user?.role || '';

    // Việc cần làm của vai trò đang đăng nhập — cùng định nghĩa với số trên menu và Trung Tâm Nhiệm Vụ
    // (hooks/useRoleTasks.js), mỗi việc còn tồn đọng là một thông báo.
    roleTasks.filter(t => Number(t.count) > 0).forEach(t => {
      list.push({
        id: `TASK-${role}-${t.key}`,
        title: `${t.count} ${t.label}`,
        desc: `Mở mục tương ứng để ${String(t.action || 'xử lý').toLowerCase()}.`,
        link: t.path,
        badge: 'Việc cần làm',
        badgeColor: t.urgent ? '#d97706' : '#2563eb',
        category: t.urgent ? 'URGENT' : 'WARNING',
        actionText: t.action || 'Xử Lý',
        time: 'Đang chờ'
      });
    });

    // Helper for formatting notification timestamp
    const formatNotifTime = (dateVal, defaultText) => {
      const d = dateVal ? new Date(dateVal) : new Date();
      if (isNaN(d.getTime())) return defaultText || 'Vừa xong';
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${hh}:${mm} - ${dd}/${month}/${yyyy}`;
    };

    // Custom notifications sent dynamically from components
    const seenCustom = new Set();
    (customNotifs || []).forEach(cn => {
      if (!cn.targetRoles || cn.targetRoles.includes(role)) {
        const customKey = `${cn.title || ''}|${cn.link || ''}|${cn.navState?.inspectionPO || ''}`;
        if (seenCustom.has(customKey)) return;
        seenCustom.add(customKey);
        list.push({
          id: cn.id,
          title: cn.title,
          desc: cn.message,
          link: /biên bản|kiểm định|QA\/QC/i.test(String(cn.title || '')) ? '/admin/quality-control' : (cn.link || '/admin/purchasing'),
          navState: (cn.navState && Object.keys(cn.navState).length > 0) ? cn.navState : (
            /biên bản|kiểm định|QA\/QC/i.test(String(cn.title || ''))
              ? { inspectionPO: String(cn.title).match(/PO-[0-9-]+/i)?.[0] }
              : { createRFQ: true, product: cn.itemData }
          ),
          badge: 'Cảnh Báo',
          badgeColor: '#dc2626',
          category: 'URGENT',
          actionText: 'Xử Lý',
          time: formatNotifTime(cn.createdAt, 'Vừa xong'),
          createdAt: cn.createdAt || 0
        });
      }
    });

    return list;
  };

  const notifications = getNotifications();

  return (
    <>
    <aside className={`admin-sidebar-drawer ${isOpen ? 'open' : ''}`} style={{
      width: '264px',
      background: '#ffffff',
      borderRight: '1px solid #e3e8ef',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      flexShrink: 0,
      boxShadow: '2px 0 12px rgba(15,23,42,0.04)',
      overflowX: 'hidden'
    }}>
      {/* Header Brand & Notification Bell */}
      <div style={{
        padding: '1.1rem 1.1rem',
        borderBottom: '1px solid #eef1f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        backgroundColor: 'transparent'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <img 
            src="/favicon.svg?v=red" 
            alt="AetherPC ERP" 
            style={{ width: '36px', height: '36px', borderRadius: '10px', boxShadow: '0 4px 10px rgba(220,38,38,0.25)' }} 
          />
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>
              AetherPC ERP
            </h1>
            <p style={{ fontSize: '0.79rem', color: '#64748b', margin: 0, fontWeight: 500 }}>
              Quản trị doanh nghiệp
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Notification Bell Button */}
          <button
            onClick={() => setShowNotifDrawer(!showNotifDrawer)}
            style={{
              position: 'relative', background: '#f8fafc', border: '1px solid #e3e8ef',
              color: notifications.filter(n => !dismissedNotifIds.includes(n.id)).length > 0 ? '#d97706' : '#64748b',
              borderRadius: '9px', width: '34px', height: '34px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Thông báo hệ thống ERP"
          >
            <Bell size={17} />
            {notifications.filter(n => !dismissedNotifIds.includes(n.id)).length > 0 && (
              <span style={{
                position: 'absolute', top: '-5px', right: '-5px',
                backgroundColor: '#dc2626', color: '#fff',
                borderRadius: '10px', padding: '1px 6px', fontSize: '0.72rem', fontWeight: 800,
                boxShadow: '0 0 8px rgba(220,38,38,0.5)'
              }}>
                {notifications.filter(n => !dismissedNotifIds.includes(n.id)).length}
              </span>
            )}
          </button>

          {/* Close button for mobile drawer */}
          <button
            className="mobile-only"
            onClick={onClose}
            aria-label="Đóng Menu"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '9px',
              width: '34px',
              height: '34px',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Nav Menu */}
      <nav style={{
        flex: 1,
        padding: '0.9rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
        overflowY: 'auto'
      }}>
        {navItems
          .filter(item => item.visible)
          .map(item => {
            const isWarehouseRoute = item.path === '/admin/warehouse';

            return (
              <React.Fragment key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={() => onClose?.()}
                  style={({ isActive }) => {
                    const currentFull = location.pathname + location.search;
                    const isTabMatch = item.path.includes('?')
                      ? (currentFull === item.path || (location.pathname === '/admin/cskh' && !location.search && item.path.includes('tab=complaints')))
                      : isActive;
                    return {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.62rem 0.85rem',
                      borderRadius: '8px',
                      color: isTabMatch ? '#b91c1c' : '#334155',
                      background: isTabMatch ? '#fef2f2' : 'transparent',
                      fontWeight: isTabMatch ? 700 : 500,
                      fontSize: '0.875rem',
                      lineHeight: 1.35,
                      boxShadow: isTabMatch ? 'inset 3px 0 0 #dc2626' : 'none',
                      transition: 'all 0.15s ease'
                    };
                  }}
                >
                  {item.icon}
                  <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                  {MODULES_WITH_SUBMENU.includes(item.path) && (() => {
                    const expanded = openModules.has(item.path);
                    const total = expanded ? 0 : moduleBadgeTotal(item.path);
                    return (
                      <>
                        {total > 0 && (
                          <span style={{ backgroundColor: '#dc2626', color: '#fff', fontSize: '0.68rem', fontWeight: 800, borderRadius: '9999px', minWidth: 18, height: 18, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            {total > 99 ? '99+' : total}
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={expanded ? `Thu gọn ${item.label}` : `Xem chức năng ${item.label}`}
                          aria-expanded={expanded}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleModule(item.path); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleModule(item.path); } }}
                          className="sidebar-module-toggle"
                          style={{
                            marginLeft: 'auto', width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#64748b'
                          }}
                        >
                          <ChevronDown size={16} style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'none' }} />
                        </span>
                      </>
                    );
                  })()}
                </NavLink>

                {/* Render sub-items directly under Trang Tổng Quan (CEO Dashboard) in main sidebar */}
                {item.path === '/admin/dashboard' && openModules.has('/admin/dashboard') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {ceoSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      const badgeVal = menuBadges[`/admin/dashboard?tab=${sub.tab}`] || 0;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/dashboard?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              lineHeight: '1',
                              marginLeft: 'auto',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {badgeVal}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Quản Lý Bán Hàng in main sidebar */}
                {item.path === '/admin/sales' && openModules.has('/admin/sales') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {[
                      { tab: 'overview', label: 'Tổng Quan Bán Hàng' },
                      { tab: 'pos', label: 'Điểm Bán Hàng (POS)', opId: 'sales_pos_checkout' },
                      { tab: 'orders', label: 'Quản Lý Đơn Hàng', badgeKey: 'pendingOrders' },
                      { tab: 'customers', label: 'Khách Hàng (CRM)' },
                      { tab: 'catalog', label: 'Danh Mục Sản Phẩm' },
                      { tab: 'promotions', label: 'Bảng Giá & Khuyến Mãi', opId: 'sales_manage_promotions' },
                      { tab: 'reports', label: 'Báo Cáo Doanh Thu' }
                    ].filter(sub => !sub.opId || canDo(sub.opId)).map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      const badgeVal = menuBadges[`/admin/sales?tab=${sub.tab}`] || 0;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/sales?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              lineHeight: '1',
                              marginLeft: 'auto',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {badgeVal}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Quản Lý Kho in main sidebar */}
                {isWarehouseRoute && openModules.has('/admin/warehouse') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {warehouseSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      const badgeVal = menuBadges[`/admin/warehouse?tab=${sub.tab}`] || 0;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/warehouse?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              lineHeight: '1',
                              marginLeft: 'auto',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {badgeVal}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Quản Lý Mua Hàng in main sidebar */}
                {item.path === '/admin/purchasing' && openModules.has('/admin/purchasing') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {[
                      { tab: 'overview', label: 'Tổng Quan Mua Hàng' },
                      { tab: 'requests', label: 'Yêu Cầu Mua Hàng (PR)', badgeKey: 'prCount' },
                      { tab: 'rfq', label: 'Yêu Cầu Báo Giá (RFQ)', badgeKey: 'rfqCount' },
                      { tab: 'orders', label: 'Đơn Mua Hàng (PO)', badgeKey: 'quotedPoCount' },
                      { tab: 'suppliers', label: 'Nhà Cung Cấp' },
                      { tab: 'products', label: 'Sản Phẩm & Bảng Giá' },
                      { tab: 'reports', label: 'Báo Cáo & Phân Tích' }
                    ].map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      const badgeVal = menuBadges[`/admin/purchasing?tab=${sub.tab}`] || 0;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/purchasing?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: sub.badgeKey === 'quotedPoCount' ? '#f59e0b' : '#3b82f6',
                              color: '#ffffff',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              lineHeight: '1',
                              marginLeft: 'auto',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {badgeVal}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Kiểm Định Chất Lượng (QA/QC) in main sidebar */}
                {item.path === '/admin/quality-control' && openModules.has('/admin/quality-control') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {qcSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      const badgeVal = menuBadges[`/admin/quality-control?tab=${sub.tab}`] || 0;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/quality-control?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: sub.badgeKey === 'pendingQaCount' ? '#f59e0b' : '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              lineHeight: '1',
                              marginLeft: 'auto',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {badgeVal}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Quản Lý Lắp Ráp in main sidebar */}
                {item.path === '/admin/assembly' && openModules.has('/admin/assembly') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {[
                      { tab: 'overview', label: 'Tổng Quan Lắp Ráp' },
                      { tab: 'jobs', label: 'Lệnh Lắp Ráp (Build PC)', badgeKey: 'pendingAssemblyJobs' },
                      { tab: 'qa', label: 'Kiểm Định Xuất Xưởng' },
                      { tab: 'reports', label: 'Báo Cáo Hiệu Suất' }
                    ].map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      const badgeVal = menuBadges[`/admin/assembly?tab=${sub.tab}`] || 0;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/assembly?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#f59e0b',
                              color: '#ffffff',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '10px',
                              lineHeight: '1',
                              marginLeft: 'auto',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {badgeVal}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Quản Lý Nhân Sự in main sidebar */}
                {item.path === '/admin/hr' && openModules.has('/admin/hr') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {hrSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;

                      const badgeVal = menuBadges[`/admin/hr?tab=${sub.tab}`] || 0;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/hr?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.74rem', fontWeight: 800,
                              padding: '2px 8px', borderRadius: '10px', lineHeight: '1', marginLeft: 'auto',
                              flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {badgeVal}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Kế Toán Tài Chính in main sidebar */}
                {item.path === '/admin/accounting' && openModules.has('/admin/accounting') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {accountingSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;

                      const badgeVal = menuBadges[`/admin/accounting?tab=${sub.tab}`] || 0;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/accounting?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.74rem', fontWeight: 800,
                              padding: '2px 8px', borderRadius: '10px', lineHeight: '1', marginLeft: 'auto',
                              flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {badgeVal}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Chăm Sóc Khách Hàng in main sidebar */}
                {item.path === '/admin/cskh' && openModules.has('/admin/cskh') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {cskhSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;

                      // 'onlineChatCount' vẫn bỏ trống — không có nguồn dữ liệu nào
                      // (store/API) đang giữ số phiên chat online để tính, khác với
                      // openComplaintsCount/pendingReturnsCount đã có sẵn dữ liệu thật.
                      const badgeVal = menuBadges[`/admin/cskh?tab=${sub.tab}`] || 0;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/cskh?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.74rem', fontWeight: 800,
                              padding: '2px 8px', borderRadius: '10px', lineHeight: '1', marginLeft: 'auto',
                              flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {badgeVal}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Quản Lý Giao Hàng in main sidebar */}
                {item.path === '/admin/delivery' && openModules.has('/admin/delivery') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {deliverySubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/delivery?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Quản Trị Hệ Thống in main sidebar */}
                {item.path === '/admin/system' && openModules.has('/admin/system') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {adminSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/system?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#b91c1c' : '#64748b',
                            backgroundColor: isSubActive ? '#fef2f2' : 'transparent',
                            borderLeft: isSubActive ? '2px solid #dc2626' : '2px solid #e8edf3',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}
      </nav>

      {/* User Status / Bottom Actions Card */}
      <div className="admin-sidebar-footer" style={{
        padding: '1rem',
        borderTop: '1px solid #eef1f5',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        backgroundColor: '#f8fafc'
      }}>
        {/* User Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.5rem 0.65rem',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e3e8ef'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <User size={18} style={{ color: '#ffffff' }} />
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              margin: 0,
              lineHeight: 1.3
            }} title={getUserDisplayName()}>
              {getUserDisplayName()}
            </p>
            <p style={{
              fontSize: '0.8rem',
              color: '#64748b',
              margin: 0,
              lineHeight: 1.3,
              fontWeight: 500
            }}>
              {getRoleDisplayName()}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="admin-sidebar-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button
            onClick={() => navigate('/')}
            className="btn" 
            style={{ 
              padding: '0.5rem 0.4rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '0.35rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid #e3e8ef',
              color: '#334155',
              cursor: 'pointer'
            }}
            title="Về Cửa Hàng Trang Chủ"
          >
            <Home size={14} />
            <span>Cửa hàng</span>
          </button>
          <button 
            onClick={handleLogout} 
            className="btn" 
            style={{ 
              padding: '0.5rem 0.4rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '0.35rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              cursor: 'pointer'
            }}
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut size={15} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </aside>

    {/* Floating Notification Popover Drawer (Outside Aside for unobstructed clicking) */}
    {showNotifDrawer && (() => {
      const activeNotifs = notifications.filter(n => !dismissedNotifIds.includes(n.id));
      const urgentCount = activeNotifs.filter(n => n.category === 'URGENT').length;
      const warningCount = activeNotifs.filter(n => n.category === 'WARNING' || n.category === 'INFO').length;

      const filteredList = activeNotifs.filter(n => {
        if (notifFilter === 'URGENT') return n.category === 'URGENT';
        if (notifFilter === 'WARNING') return n.category === 'WARNING' || n.category === 'INFO';
        return true;
      });

      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000000,
            backgroundColor: 'rgba(15, 23, 42, 0.25)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start'
          }}
          onClick={() => setShowNotifDrawer(false)}
        >
          {/* Floating Notification Drawer Panel */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '4.25rem',
              left: '1rem',
              width: '420px',
              maxWidth: 'calc(100vw - 2rem)',
              maxHeight: 'calc(100vh - 5.5rem)',
              backgroundColor: '#ffffff',
              border: '1.5px solid #cbd5e1',
              borderRadius: '16px',
              boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.45)',
              zIndex: 100000001,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Drawer Header (Text-only, no icons) */}
            <div style={{
              padding: '0.9rem 1.15rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>THÔNG BÁO & NHIỆM VỤ</strong>
                <span style={{
                  backgroundColor: '#dc2626', color: '#ffffff',
                  padding: '1px 7px', borderRadius: '10px', fontSize: '0.77rem', fontWeight: 800
                }}>
                  {activeNotifs.length}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {activeNotifs.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissedNotifIds(activeNotifs.map(n => n.id));
                    }}
                    style={{
                      background: 'none', border: 'none', color: '#2563eb',
                      fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', padding: '0.2rem 0.4rem'
                    }}
                  >
                    Đã đọc tất cả
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNotifDrawer(false);
                  }}
                  style={{
                    background: '#ffffff', border: '1px solid #e3e8ef', color: '#64748b',
                    borderRadius: '6px', padding: '0.2rem 0.55rem', fontSize: '0.8rem',
                    fontWeight: 700, cursor: 'pointer'
                  }}
                  title="Đóng thông báo"
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* Filter Tabs (Text-only) */}
            <div style={{
              display: 'flex', gap: '0.35rem', padding: '0.5rem 0.85rem',
              backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9', flexShrink: 0
            }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotifFilter('ALL');
                }}
                style={{
                  flex: 1, padding: '0.35rem 0', borderRadius: '6px',
                  border: notifFilter === 'ALL' ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  backgroundColor: notifFilter === 'ALL' ? '#eff6ff' : '#ffffff',
                  color: notifFilter === 'ALL' ? '#2563eb' : '#64748b',
                  fontSize: '0.8rem', fontWeight: notifFilter === 'ALL' ? 800 : 600,
                  cursor: 'pointer'
                }}
              >
                Tất Cả ({activeNotifs.length})
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotifFilter('URGENT');
                }}
                style={{
                  flex: 1, padding: '0.35rem 0', borderRadius: '6px',
                  border: notifFilter === 'URGENT' ? '1px solid #dc2626' : '1px solid #e2e8f0',
                  backgroundColor: notifFilter === 'URGENT' ? '#fef2f2' : '#ffffff',
                  color: notifFilter === 'URGENT' ? '#dc2626' : '#64748b',
                  fontSize: '0.8rem', fontWeight: notifFilter === 'URGENT' ? 800 : 600,
                  cursor: 'pointer'
                }}
              >
                Cần Xử Lý ({urgentCount})
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotifFilter('WARNING');
                }}
                style={{
                  flex: 1, padding: '0.35rem 0', borderRadius: '6px',
                  border: notifFilter === 'WARNING' ? '1px solid #d97706' : '1px solid #e2e8f0',
                  backgroundColor: notifFilter === 'WARNING' ? '#fffbeb' : '#ffffff',
                  color: notifFilter === 'WARNING' ? '#d97706' : '#64748b',
                  fontSize: '0.8rem', fontWeight: notifFilter === 'WARNING' ? 800 : 600,
                  cursor: 'pointer'
                }}
              >
                Cảnh Báo ({warningCount})
              </button>
            </div>

            {/* Drawer Body Items List (Structured Cards - No Icons) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', maxHeight: '440px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <p style={{ margin: '0 0 0.35rem', fontWeight: 800, color: '#0f172a' }}>Không có thông báo nào trong mục này</p>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Tất cả nhiệm vụ phòng ban đã được xử lý hoàn tất.</span>
                </div>
              ) : (
                filteredList.map(n => (
                  <div
                    key={n.id}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      borderLeft: `4px solid ${n.badgeColor || '#2563eb'}`,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}
                  >
                    {/* Meta Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.74rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px',
                        backgroundColor: `${n.badgeColor || '#2563eb'}15`, color: n.badgeColor || '#2563eb',
                        border: `1px solid ${n.badgeColor || '#2563eb'}30`, textTransform: 'uppercase'
                      }}>
                        {n.badge}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>{n.time}</span>
                    </div>

                    {/* Title */}
                    <strong style={{ fontSize: '0.85rem', color: '#0f172a', lineHeight: 1.35 }}>
                      {n.title}
                    </strong>

                    {/* Description */}
                    <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0, lineHeight: 1.45 }}>
                      {n.desc}
                    </p>

                    {/* Action Buttons Row */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', paddingTop: '0.4rem', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDismissedNotifIds(p => [...p, n.id]);
                        }}
                        style={{
                          background: 'none', border: 'none', color: '#94a3b8',
                          fontSize: '0.77rem', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        Bỏ qua
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNotifDrawer(false);
                          navigate(n.link, { state: n.navState });
                        }}
                        style={{
                          backgroundColor: n.badgeColor || '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.79rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {n.actionText || 'Xử Lý Ngay'} →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      );
    })()}

    {/* Modal: Xin Nghỉ Phép Của Tôi (tự phục vụ, mọi role) */}
    {showLeaveModal && (
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 100000001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        onClick={() => setShowLeaveModal(false)}
      >
        <div
          style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e3e8ef', width: '100%', maxWidth: '480px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CalendarCheck size={18} style={{ color: '#7c3aed' }} />
              Nghỉ Phép Của Tôi
            </h3>
            <button onClick={() => setShowLeaveModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={16} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem', marginBottom: '1.25rem', padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem', fontSize: '0.8rem' }}>Loại nghỉ phép</label>
                <select
                  value={leaveForm.type}
                  onChange={e => setLeaveForm(p => ({ ...p, type: e.target.value }))}
                  style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #e3e8ef', boxSizing: 'border-box', fontSize: '0.8rem' }}
                >
                  <option value="Phép Năm">Phép Năm</option>
                  <option value="Nghỉ Ốm">Nghỉ Ốm</option>
                  <option value="Việc Riêng">Việc Riêng</option>
                  <option value="Không Lương">Không Lương</option>
                </select>
              </div>
              <div />
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem', fontSize: '0.8rem' }}>Từ ngày</label>
                <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(p => ({ ...p, startDate: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #e3e8ef', boxSizing: 'border-box', fontSize: '0.8rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem', fontSize: '0.8rem' }}>Đến ngày</label>
                <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(p => ({ ...p, endDate: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #e3e8ef', boxSizing: 'border-box', fontSize: '0.8rem' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem', fontSize: '0.8rem' }}>Lý do</label>
              <input type="text" placeholder="VD: Về quê giỗ tổ" value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #e3e8ef', boxSizing: 'border-box', fontSize: '0.8rem' }} />
            </div>
            <button
              onClick={handleSubmitLeaveRequest}
              disabled={submittingLeave}
              style={{ backgroundColor: submittingLeave ? '#9ca3af' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', fontWeight: 800, cursor: submittingLeave ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
            >
              <Send size={14} /> {submittingLeave ? 'Đang gửi...' : 'Gửi Đơn Xin Nghỉ'}
            </button>
          </div>

          <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.6rem' }}>Lịch sử đơn của bạn</h4>
          {loadingMyLeaves ? (
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Đang tải...</p>
          ) : myLeaves.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Bạn chưa gửi đơn xin nghỉ phép nào.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {myLeaves.map((lv, idx) => (
                <div key={lv.id || idx} style={{ padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#0f172a' }}>{lv.type || 'Phép Năm'}</strong>
                    <span style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '0.74rem', fontWeight: 800,
                      backgroundColor: getStatusInfo(LEAVE_STATUS, ['APPROVED', 'REJECTED'].includes(lv.status) ? lv.status : 'PENDING').bg,
                      color: getStatusInfo(LEAVE_STATUS, ['APPROVED', 'REJECTED'].includes(lv.status) ? lv.status : 'PENDING').color
                    }}>
                      {getStatusLabel(LEAVE_STATUS, ['APPROVED', 'REJECTED'].includes(lv.status) ? lv.status : 'PENDING')}
                    </span>
                  </div>
                  <span style={{ color: '#64748b' }}>
                    {lv.startDate ? new Date(lv.startDate).toLocaleDateString('vi-VN') : '---'} → {lv.endDate ? new Date(lv.endDate).toLocaleDateString('vi-VN') : '---'}
                    {lv.reason ? ` — "${lv.reason}"` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
