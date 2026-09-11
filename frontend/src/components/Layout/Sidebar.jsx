import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { useInventoryStore, useSalesStore, useFinanceStore, useHRStore, useUtilityStore } from '../../stores';
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
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare,
  RefreshCw,
  Settings
} from 'lucide-react';

export default function Sidebar({ isOpen = false, onClose }) {
  const { user, logout, isCEO, isSales, isSalesManager, isWarehouse, isWarehouseManager, isAssembly, isHR, isAccountant, isPurchasing, isAdmin } = useAuth();
  const { can, canDo, canRead } = usePermission();
  const inventory = useInventoryStore(state => state.inventory) || [];
  const orders = useSalesStore(state => state.orders) || [];
  const returnRequests = useSalesStore(state => state.returnRequests) || [];
  const purchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];
  const payrolls = useHRStore(state => state.payrolls) || [];
  const leaveRequests = useHRStore(state => state.leaveRequests) || [];
  const assemblyJobs = useUtilityStore(state => state.assemblyJobs) || [];
  const customNotifs = useUtilityStore(state => state.customNotifs) || [];
  const receipts = [];
  const isCskh = user?.role === 'CSKH';
  const isDelivery = user?.role === 'DELIVERY';
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [notifFilter, setNotifFilter] = useState('ALL');
  const [dismissedNotifIds, setDismissedNotifIds] = useState([]);

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
    { tab: 'rbac', label: 'Ma Trận Phân Quyền' },
    { tab: 'audit', label: 'Nhật Ký Kiểm Toán' },
    { tab: 'settings', label: 'Cấu Hình & Sao Lưu' }
  ];

  const hrSubItems = [
    { tab: 'overview', label: 'Tổng Quan Nhân Sự' },
    { tab: 'attendance', label: 'Chấm Công Hàng Ngày' },
    { tab: 'employees', label: 'Hồ Sơ Nhân Viên' },
    { tab: 'leaves', label: 'Quản Lý Nghỉ Phép', badgeKey: 'pendingLeaveApproval' },
    { tab: 'payroll', label: 'Bảng Lương & Trình CEO' }
  ];

  const accountingSubItems = [
    { tab: 'overview', label: 'Tổng Quan Tài Chính' },
    { tab: 'ledger', label: 'Sổ Cái Dòng Tiền (Ledger)' },
    { tab: 'po_payments', label: 'Thanh Toán Đơn PO', badgeKey: 'pendingQuotedPOs' },
    { tab: 'payroll_disbursement', label: 'Chi Trả Bảng Lương', badgeKey: 'pendingPayrollApproval' },
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
    { tab: 'backorders', label: 'Đơn Chờ Hàng (Nợ Khách)', badgeKey: 'backordersCount' },
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

  const isItemDiscontinued = (item) => {
    return !item || item.available === false || item.isAvailable === false || item.status === 'DISCONTINUED' || item.status === 'INACTIVE' || item.available === 'false';
  };

  const activeInventory = (inventory || []).filter(item => !isItemDiscontinued(item));
  const lowStockCount = activeInventory.filter(item => Number(item.stock || 0) <= Number(item.threshold || 0)).length;
  const backordersCount = (orders || []).filter(o => o && o.status === 'AWAITING_STOCK').length;
  const pendingReceipts = (receipts && receipts.length > 0)
    ? receipts.filter(r => r && r.status === 'READY').length
    : 2;
  const pendingExportCount = (orders || []).filter(o => o && o.status === 'CONFIRMED').length;
  const pendingReturnsCount = (returnRequests && returnRequests.length > 0)
    ? returnRequests.filter(r => r && !['QC_PASSED', 'RESTOCKED', 'APPROVED', 'VENDOR_WARRANTY', 'INSPECTED_SCRAP', 'EXCHANGE_NEW', 'EXCHANGED', 'REJECTED', 'REJECT_RMA'].includes(r.status)).length
    : 0;
  const pendingQuotedPOs = (purchaseOrders || []).filter(p => p && p.status === 'QUOTED').length;
  const pendingPayrollApproval = (payrolls && payrolls.length > 0 && payrolls[0]?.status === 'SUBMITTED_TO_CEO') ? 1 : 0;
  const pendingLeaveApproval = (leaveRequests || []).filter(l => l && (l.status === 'PENDING_CEO' || l.status === 'PENDING')).length;
  const pendingCeoApprovals = pendingQuotedPOs + pendingPayrollApproval + pendingLeaveApproval;
  const pendingQaCount = (purchaseOrders || []).filter(p => p && ['CONFIRMED_BY_SUPPLIER', 'PO', 'APPROVED', 'PENDING_QA', 'SHIPPED', 'DELIVERED'].includes(p.status)).length;

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
      default: return user?.role || 'Nhân Sự';
    }
  };

  const navItems = [
    {
      id: 'dashboard',
      path: '/admin/dashboard',
      label: 'Trang Tổng Quan',
      icon: <BarChart2 size={18} />,
      visible: canRead('dashboard') || isCEO
    },
    {
      id: 'sales',
      path: '/admin/sales',
      label: 'Bán Hàng & Đơn Hàng',
      icon: <ShoppingCart size={18} />,
      visible: canRead('sales')
    },
    {
      id: 'warehouse',
      path: '/admin/warehouse',
      label: 'Quản Lý Kho & Tồn Kho',
      icon: <Database size={18} />,
      visible: canRead('warehouse')
    },
    {
      id: 'purchasing',
      path: '/admin/purchasing',
      label: 'Quản Lý Mua Hàng (RFQ/PO)',
      icon: <ShoppingCart size={18} />,
      visible: canRead('purchasing')
    },
    {
      id: 'quality-control',
      path: '/admin/quality-control',
      label: 'Kiểm Định Chất Lượng (QA/QC)',
      icon: <ShieldAlert size={18} />,
      visible: canRead('quality-control')
    },
    {
      id: 'assembly',
      path: '/admin/assembly',
      label: 'Quản Lý Lắp Ráp PC',
      icon: <Wrench size={18} />,
      visible: canRead('assembly')
    },
    {
      id: 'hr',
      path: '/admin/hr',
      label: 'Quản Trị Nhân Sự (HRM)',
      icon: <Users size={18} />,
      visible: canRead('hr')
    },
    {
      id: 'accounting',
      path: '/admin/accounting',
      label: 'Kế Toán & Dòng Tiền',
      icon: <DollarSign size={18} />,
      visible: canRead('accounting')
    },
    {
      id: 'cskh',
      path: '/admin/cskh',
      label: 'Chăm Sóc Khách Hàng (CSKH)',
      icon: <HeadphonesIcon size={18} />,
      visible: canRead('cskh')
    },
    {
      id: 'delivery',
      path: '/admin/delivery',
      label: 'Quản Lý & Điều Phối Giao Hàng',
      icon: <Truck size={18} />,
      visible: canRead('delivery')
    },
    {
      id: 'system',
      path: '/admin/system',
      label: 'Quản Trị Hệ Thống & Phân Quyền',
      icon: <Settings size={18} />,
      visible: canRead('system') || isAdmin
    }
  ];

  // Dynamic ERP Notifications Generator
  const getNotifications = () => {
    const list = [];
    const role = user?.role || '';

    // 1. BAN GIÁM ĐỐC (CEO): Chỉ nhận nhiệm vụ phê duyệt cấp cao & báo cáo tổng quan
    if (['CEO', 'ADMIN'].includes(role)) {
      // Phê duyệt bảng lương nhân sự toàn công ty
      const submittedPayrolls = (payrolls || []).filter(p => p.status === 'SUBMITTED_TO_CEO');
      if (submittedPayrolls.length > 0) {
        const totalFund = submittedPayrolls.reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0);
        list.push({
          id: 'NOTIF-CEO-PAYROLL',
          title: `Phê duyệt Bảng lương nhân sự`,
          desc: `Bộ phận HR đã trình duyệt Bảng lương cho ${submittedPayrolls.length} nhân sự (Tổng quỹ lương: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalFund)}). Cần CEO xem xét phê duyệt.`,
          link: '/admin/dashboard',
          badge: 'Ban Giám Đốc',
          badgeColor: '#dc2626',
          category: 'URGENT',
          actionText: 'Phê Duyệt Lương',
          time: 'Chờ duyệt'
        });
      }

      // Phê duyệt đơn mua hàng PO giá trị lớn
      const quotedPOs = (purchaseOrders || []).filter(po => po.status === 'QUOTED');
      quotedPOs.forEach(po => {
        list.push({
          id: `NOTIF-CEO-${po.id || po.poNumber}`,
          title: `Phê duyệt Đơn mua hàng PO #${po.poNumber || po.id}`,
          desc: `Nhà cung cấp: ${po.supplier?.name || po.supplierCode || 'NCC'} — Giá trị đơn: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(po.totalAmount || 0)}. Cần CEO duyệt để tiến hành ký kết.`,
          link: '/admin/purchasing',
          badge: 'Ban Giám Đốc',
          badgeColor: '#d97706',
          category: 'URGENT',
          actionText: 'Duyệt PO',
          time: 'Chờ duyệt'
        });
      });
    }

    // 2. KẾ TOÁN (ACCOUNTANT): Chỉ nhận đơn mua hàng cần chi trả & bảng lương giải ngân
    if (['ACCOUNTANT', 'ADMIN'].includes(role)) {
      // Chi trả NCC cho các đơn PO đã xác nhận
      const payablePOs = (purchaseOrders || []).filter(po => po.status === 'PO' || po.status === 'UNPAID');
      payablePOs.forEach(po => {
        list.push({
          id: `NOTIF-ACC-${po.id || po.poNumber}`,
          title: `Thanh toán Đơn mua hàng PO #${po.poNumber || po.id}`,
          desc: `Nhà cung cấp: ${po.supplier?.name || po.supplierName || 'NCC'} — Số tiền cần chi: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(po.totalAmount || po.totalCost || 0)}.`,
          link: '/admin/accounting?tab=po_payments',
          badge: 'Kế Toán',
          badgeColor: '#16a34a',
          category: 'URGENT',
          actionText: 'Chi Trả',
          time: 'Chờ thanh toán'
        });
      });

      // Giải ngân bảng lương tháng
      const approvedPayrolls = (payrolls || []).filter(p => p.status === 'CEO_APPROVED' || p.status === 'PENDING_PAYMENT');
      if (approvedPayrolls.length > 0) {
        list.push({
          id: 'NOTIF-ACC-PAYROLL',
          title: `Giải ngân Bảng lương tháng đã duyệt`,
          desc: `CEO đã phê duyệt bảng lương cho ${approvedPayrolls.length} nhân sự. Kế toán tiến hành chi trả giải ngân tài khoản.`,
          link: '/admin/accounting?tab=payroll_disbursement',
          badge: 'Kế Toán',
          badgeColor: '#16a34a',
          category: 'URGENT',
          actionText: 'Giải Ngân',
          time: 'Đã duyệt'
        });
      }
    }

    // 3. KHO HÀNG (WAREHOUSE/WAREHOUSE_MANAGER): Cảnh báo tồn kho & đơn hàng cần xuất kho
    // — quản lý kho trước đây không nằm trong danh sách này nên không nhận được
    // cảnh báo gì dù cùng chịu trách nhiệm vận hành kho với thủ kho.
    if (['WAREHOUSE', 'WAREHOUSE_MANAGER', 'ADMIN'].includes(role)) {
      const lowStock = (inventory || []).filter(item => Number(item.stock) <= Number(item.threshold));
      if (lowStock.length > 0) {
        list.push({
          id: 'NOTIF-WH-LOWSTOCK',
          title: `Cảnh báo ${lowStock.length} linh kiện dưới ngưỡng an toàn`,
          desc: `Tồn kho các mã linh kiện chạm hoặc dưới mức tối thiểu (Min-Max Rule). Kho cần kiểm tra và gửi đề xuất mua hàng.`,
          link: '/admin/warehouse?tab=lowstock',
          badge: 'Kho Hàng',
          badgeColor: '#d97706',
          category: 'WARNING',
          actionText: 'Kiểm Tra Kho',
          time: 'Hệ thống'
        });
      }

      // Đơn hàng bán lẻ cần đóng gói xuất kho
      const pendingShip = (orders || []).filter(o => o.status === 'CONFIRMED' || o.status === 'PROCESSING');
      if (pendingShip.length > 0) {
        list.push({
          id: 'NOTIF-WH-ORDERS',
          title: `Đóng gói & xuất kho ${pendingShip.length} đơn hàng`,
          desc: `Các đơn hàng bán lẻ đã xác nhận thanh toán đang chờ kho đóng gói và in phiếu xuất kho.`,
          link: '/admin/warehouse?tab=delivery',
          badge: 'Kho Hàng',
          badgeColor: '#2563eb',
          category: 'URGENT',
          actionText: 'Xuất Kho',
          time: 'Mới'
        });
      }
    }

    // 4. MUA HÀNG (PURCHASING): Chỉ nhận cảnh báo hết hàng cần lập RFQ & theo dõi NCC
    if (['PURCHASING', 'ADMIN'].includes(role)) {
      const outOfStockList = (inventory || []).filter(item => Number(item.stock) === 0 && item.available !== false);
      if (outOfStockList.length > 0) {
        list.push({
          id: 'NOTIF-PURCHASE-OUT',
          title: `Cần lập RFQ: ${outOfStockList.length} linh kiện đã hết tồn kho`,
          desc: `Linh kiện có số lượng tồn kho = 0. Bộ phận Mua hàng cần liên hệ NCC và lập phiếu yêu cầu báo giá gấp.`,
          link: '/admin/purchasing?tab=rfq',
          navState: { openCreateRFQ: true, timestamp: Date.now() },
          badge: 'Mua Hàng',
          badgeColor: '#dc2626',
          category: 'URGENT',
          actionText: 'Lập RFQ',
          time: 'Khẩn cấp'
        });
      }

      const lowStockList = (inventory || []).filter(item => Number(item.stock) > 0 && Number(item.stock) <= Number(item.threshold));
      if (lowStockList.length > 0) {
        list.push({
          id: 'NOTIF-PURCHASE-LOW',
          title: `Đề xuất bổ sung ${lowStockList.length} linh kiện sắp hết`,
          desc: `Tồn kho chạm ngưỡng cảnh báo. Đề xuất khảo sát giá NCC để lên kế hoạch nhập hàng.`,
          link: '/admin/purchasing?tab=products',
          navState: { filterLowStock: true, timestamp: Date.now() },
          badge: 'Mua Hàng',
          badgeColor: '#d97706',
          category: 'WARNING',
          actionText: 'Khảo Sát Giá',
          time: 'Định kỳ'
        });
      }
    }

    // 5. GIAO VẬN (DELIVERY): Nhận đơn hàng đã bàn giao & đơn chờ nhận tại kho
    if (['DELIVERY', 'ADMIN'].includes(role)) {
      const uName = String(user?.fullname || user?.name || '').toLowerCase();
      const uUser = String(user?.username || '').toLowerCase();
      const uPhone = String(user?.phone || '').replace(/\D/g, '');

      // Đơn hàng đã bàn giao cho shipper này
      const myAssignedOrders = (orders || []).filter(o => {
        if (!o || o.status !== 'SHIPPED') return false;
        const s = String(o.assignedShipper || '').toLowerCase();
        return (uName && s.includes(uName)) || (uUser && s.includes(uUser)) || (uPhone && s.includes(uPhone)) || String(o.assignedShipperId) === String(user?.id);
      });

      if (myAssignedOrders.length > 0) {
        list.push({
          id: 'NOTIF-DELIVERY-ASSIGNED',
          title: `Có ${myAssignedOrders.length} đơn hàng mới đã bàn giao cho bạn`,
          desc: `Thủ kho đã hoàn tất đóng gói và bàn giao ${myAssignedOrders.length} kiện hàng. Bạn tiến hành xuất phát giao hàng và thu tiền COD.`,
          link: '/admin/delivery?tab=pending',
          badge: 'Giao Vận',
          badgeColor: '#16a34a',
          category: 'URGENT',
          actionText: 'Xem Đơn Ngay',
          time: 'Vừa giao'
        });
      }

      const readyOrders = (orders || []).filter(o => o.status === 'READY_TO_SHIP');
      if (readyOrders.length > 0) {
        list.push({
          id: 'NOTIF-DELIVERY-READY',
          title: `Có ${readyOrders.length} đơn hàng đóng gói xong chờ lấy tại kho`,
          desc: `Kho đã niêm phong xong ${readyOrders.length} đơn. Shipper có thể đến kho nhận chuyến và đi giao.`,
          link: '/admin/delivery?tab=pending',
          badge: 'Kho Chờ Giao',
          badgeColor: '#2563eb',
          category: 'INFO',
          actionText: 'Nhận Chuyến',
          time: 'Chờ nhận'
        });
      }
    }

    // 6. NHÂN SỰ (HR): Nhắc nhở chấm công & tổng hợp bảng lương
    if (['HR', 'ADMIN'].includes(role)) {
      list.push({
        id: 'NOTIF-HR-TIMESHEET',
        title: `Tổng hợp Chấm công & Bảng lương tháng`,
        desc: `Kiểm tra dữ liệu điểm danh, ngày phép và hoa hồng doanh số của toàn bộ nhân sự để lập Bảng lương trình CEO.`,
        link: '/admin/hr?tab=payroll',
        badge: 'Nhân Sự',
        badgeColor: '#7c3aed',
        category: 'INFO',
        actionText: 'Xem Bảng Lương',
        time: 'Hàng tháng'
      });
    }

    // 7. CHĂM SÓC KHÁCH HÀNG: mã vai trò thật là 'CSKH' (không phải
    // 'CUSTOMER_SERVICE' — giá trị đó không tồn tại trong hệ thống), nên khối
    // này trước đây không bao giờ khớp và CSKH không hề nhận được thông báo.
    // SALES_MANAGER cũng được cấp quyền cskh_handle_tickets nên gộp chung.
    if (['CSKH', 'SALES_MANAGER', 'ADMIN'].includes(role)) {
      const pendingRMA = (returnRequests || []).filter(r => r.status === 'PENDING' || r.status === 'NEW');
      if (pendingRMA.length > 0) {
        list.push({
          id: 'NOTIF-CSKH-RMA',
          title: `Tiếp nhận ${pendingRMA.length} hồ sơ Đổi trả / Bảo hành (RMA)`,
          desc: `Khách hàng gửi yêu cầu hỗ trợ lỗi linh kiện. CSKH cần đối chiếu hóa đơn và hướng dẫn thu hồi.`,
          link: '/admin/cskh?tab=returns',
          badge: 'CSKH & Bảo Hành',
          badgeColor: '#ea580c',
          category: 'URGENT',
          actionText: 'Xử Lý RMA',
          time: 'Mới nhận'
        });
      }
    }

    // 8. KIỂM ĐỊNH CHẤT LƯỢNG: mã vai trò thật là 'QC' (không phải 'QA_QC' —
    // cũng không tồn tại), nên khối này trước đây không bao giờ khớp. Đồng
    // thời đổi từ 1 thông báo hiển thị cố định (luôn hiện bất kể có việc hay
    // không) sang dựa trên số liệu thật (pendingQaCount/pendingReturnsCount,
    // đã tính sẵn ở trên cho badge sidebar) để đúng "chỉ xem thông báo liên
    // quan" — QC rảnh việc thì không nên thấy thông báo khẩn cấp giả.
    if (['QC', 'ADMIN'].includes(role)) {
      if (pendingQaCount > 0) {
        list.push({
          id: 'NOTIF-QC-INSPECTION',
          title: `Kiểm định chất lượng ${pendingQaCount} lô hàng PO mới về`,
          desc: `Lô hàng linh kiện từ NCC đã về kho. QC cần lấy mẫu ngẫu nhiên kiểm tra tiêu chuẩn AQL trước khi nhập kho.`,
          link: '/admin/quality-control?tab=inbound',
          badge: 'Kiểm Định QA/QC',
          badgeColor: '#0284c7',
          category: 'URGENT',
          actionText: 'Nghiệm Thu',
          time: 'Chờ kiểm định'
        });
      }
      if (pendingReturnsCount > 0) {
        list.push({
          id: 'NOTIF-QC-RMA',
          title: `Thẩm định ${pendingReturnsCount} hồ sơ đổi trả/bảo hành`,
          desc: `CSKH đã chuyển hồ sơ RMA — QC cần kiểm tra lỗi kỹ thuật thực tế để kết luận Đạt/Lỗi.`,
          link: '/admin/quality-control?tab=returns',
          badge: 'Kiểm Định QA/QC',
          badgeColor: '#0284c7',
          category: 'URGENT',
          actionText: 'Thẩm Định',
          time: 'Chờ xử lý'
        });
      }
    }

    // 9. LẮP RÁP (ASSEMBLY): Lệnh lắp ráp đang chờ/đang xử lý được bàn giao
    if (['ASSEMBLY', 'ADMIN'].includes(role)) {
      const myAssemblyJobs = (assemblyJobs || []).filter(j => j && ['PENDING', 'ASSEMBLING'].includes(j.status));
      if (myAssemblyJobs.length > 0) {
        list.push({
          id: 'NOTIF-ASSEMBLY-JOBS',
          title: `Có ${myAssemblyJobs.length} lệnh lắp ráp đang chờ xử lý`,
          desc: `Kho đã bàn giao linh kiện — tiến hành lắp ráp, chạy stress test và dán tem niêm phong trước khi xuất xưởng.`,
          link: '/admin/assembly?tab=jobs',
          badge: 'Lắp Ráp',
          badgeColor: '#0ea5e9',
          category: 'URGENT',
          actionText: 'Xem Lệnh Lắp Ráp',
          time: 'Đang chờ'
        });
      }
    }

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
      width: '260px',
      backgroundColor: '#ffffff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      flexShrink: 0,
      boxShadow: '4px 0 16px rgba(15,23,42,0.03)',
      overflowX: 'hidden'
    }}>
      {/* Header Brand & Notification Bell */}
      <div style={{
        padding: '1.25rem 1.25rem',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        backgroundColor: '#ffffff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 4px 10px rgba(37,99,235,0.3)'
          }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Quản Lý ERP
            </h1>
            <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, fontWeight: 500 }}>
              Hệ thống Doanh Nghiệp
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Notification Bell Button */}
          <button
            onClick={() => setShowNotifDrawer(!showNotifDrawer)}
            style={{
              position: 'relative', background: '#f8fafc', border: '1px solid #cbd5e1',
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
                borderRadius: '10px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 800,
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
        padding: '1.25rem 0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        overflowY: 'auto'
      }}>
        {navItems
          .filter(item => item.visible)
          .map(item => {
            const isWarehouseRoute = item.path === '/admin/warehouse';
            const isOnWarehousePage = location.pathname.startsWith('/admin/warehouse');

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
                      gap: '0.85rem',
                      padding: '0.7rem 1rem',
                      borderRadius: '10px',
                      color: isTabMatch ? '#ffffff' : '#334155',
                      background: isTabMatch ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'transparent',
                      fontWeight: isTabMatch ? 700 : 600,
                      fontSize: '0.88rem',
                      boxShadow: isTabMatch ? '0 4px 12px rgba(37, 99, 235, 0.28)' : 'none',
                      transition: 'all 0.15s ease'
                    };
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>

                {/* Render sub-items directly under Trang Tổng Quan (CEO Dashboard) in main sidebar */}
                {item.path === '/admin/dashboard' && location.pathname.startsWith('/admin/dashboard') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {ceoSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      let badgeVal = 0;
                      if (sub.badgeKey === 'pendingCeoApprovals') {
                        badgeVal = pendingCeoApprovals;
                      }

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/dashboard?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.68rem',
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
                {item.path === '/admin/sales' && location.pathname.startsWith('/admin/sales') && (
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
                      
                      let badgeVal = 0;
                      if (sub.badgeKey === 'pendingOrders') {
                        badgeVal = (orders || []).filter(o => ['PENDING', 'WAITING_PAYMENT', 'CONFIRMED'].includes(o.status)).length;
                      }

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/sales?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.68rem',
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
                {isWarehouseRoute && isOnWarehousePage && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {warehouseSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      let badgeVal = 0;
                      if (sub.badgeKey === 'backordersCount') badgeVal = backordersCount;
                      if (sub.badgeKey === 'pendingReceipts') badgeVal = pendingReceipts;
                      if (sub.badgeKey === 'pendingExportCount') badgeVal = pendingExportCount;
                      if (sub.badgeKey === 'lowStockCount') badgeVal = lowStockCount;
                      if (sub.badgeKey === 'pendingReturnsCount') badgeVal = pendingReturnsCount;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/warehouse?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.68rem',
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
                {item.path === '/admin/purchasing' && location.pathname.startsWith('/admin/purchasing') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {[
                      { tab: 'overview', label: 'Tổng Quan Mua Hàng' },
                      { tab: 'rfq', label: 'Yêu Cầu Báo Giá (RFQ)', badgeKey: 'rfqCount' },
                      { tab: 'orders', label: 'Đơn Mua Hàng (PO)', badgeKey: 'quotedPoCount' },
                      { tab: 'suppliers', label: 'Nhà Cung Cấp' },
                      { tab: 'compare', label: 'So Sánh Báo Giá NCC' },
                      { tab: 'products', label: 'Sản Phẩm & Bảng Giá' },
                      { tab: 'reports', label: 'Báo Cáo & Phân Tích' }
                    ].map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      let badgeVal = 0;
                      if (sub.badgeKey === 'rfqCount') {
                        badgeVal = (purchaseOrders || []).filter(p => ['RFQ', 'RFQ_SENT', 'QUOTED', 'QUOTED_PENDING_CEO'].includes(p.status)).length;
                      }
                      if (sub.badgeKey === 'quotedPoCount') {
                        badgeVal = (purchaseOrders || []).filter(p => ['PO', 'CONFIRMED_BY_SUPPLIER', 'APPROVED', 'APPROVED_BY_CEO'].includes(p.status)).length;
                      }

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/purchasing?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: sub.badgeKey === 'quotedPoCount' ? '#f59e0b' : '#3b82f6',
                              color: '#ffffff',
                              fontSize: '0.68rem',
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
                {item.path === '/admin/quality-control' && location.pathname.startsWith('/admin/quality-control') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {qcSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      let badgeVal = 0;
                      if (sub.badgeKey === 'pendingQaCount') badgeVal = pendingQaCount;
                      if (sub.badgeKey === 'pendingReturnsCount') badgeVal = pendingReturnsCount;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/quality-control?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: sub.badgeKey === 'pendingQaCount' ? '#f59e0b' : '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.68rem',
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
                {item.path === '/admin/assembly' && location.pathname.startsWith('/admin/assembly') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {[
                      { tab: 'overview', label: 'Tổng Quan Lắp Ráp' },
                      { tab: 'jobs', label: 'Lệnh Lắp Ráp (Build PC)', badgeKey: 'pendingAssemblyJobs' },
                      { tab: 'qa', label: 'Kiểm Định Xuất Xưởng' },
                      { tab: 'reports', label: 'Báo Cáo Hiệu Suất' }
                    ].map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;
                      
                      let badgeVal = 0;
                      if (sub.badgeKey === 'pendingAssemblyJobs') {
                        badgeVal = (assemblyJobs || []).filter(j => ['PENDING', 'ASSEMBLING'].includes(j.status)).length;
                      }

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/assembly?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                          {badgeVal > 0 && (
                            <span style={{
                              backgroundColor: '#f59e0b',
                              color: '#ffffff',
                              fontSize: '0.68rem',
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
                {item.path === '/admin/hr' && location.pathname.startsWith('/admin/hr') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {hrSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/hr?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Kế Toán Tài Chính in main sidebar */}
                {item.path === '/admin/accounting' && location.pathname.startsWith('/admin/accounting') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {accountingSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/accounting?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Chăm Sóc Khách Hàng in main sidebar */}
                {item.path === '/admin/cskh' && location.pathname.startsWith('/admin/cskh') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {cskhSubItems.map(sub => {
                      const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                      const isSubActive = currentTab === sub.tab;

                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/admin/cskh?tab=${sub.tab}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ flex: 1 }}>{sub.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Render sub-items directly under Quản Lý Giao Hàng in main sidebar */}
                {item.path === '/admin/delivery' && location.pathname.startsWith('/admin/delivery') && (
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
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
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
                {item.path === '/admin/system' && location.pathname.startsWith('/admin/system') && (
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
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: isSubActive ? 700 : 500,
                            color: isSubActive ? '#2563eb' : '#475569',
                            backgroundColor: isSubActive ? '#eff6ff' : 'transparent',
                            borderLeft: isSubActive ? '3px solid #2563eb' : '3px solid transparent',
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
      <div style={{
        padding: '1rem',
        borderTop: '1px solid #e2e8f0',
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
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 6px rgba(15,23,42,0.03)'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #bfdbfe',
            flexShrink: 0
          }}>
            <User size={18} style={{ color: '#2563eb' }} />
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{
              fontSize: '0.85rem',
              fontWeight: 800,
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
              fontSize: '0.72rem',
              color: '#64748b',
              margin: 0,
              lineHeight: 1.3,
              fontWeight: 600
            }}>
              {getRoleDisplayName()}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
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
              border: '1px solid #cbd5e1',
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
                  padding: '1px 7px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 800
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
                      fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: '0.2rem 0.4rem'
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
                    background: '#ffffff', border: '1px solid #cbd5e1', color: '#64748b',
                    borderRadius: '6px', padding: '0.2rem 0.55rem', fontSize: '0.75rem',
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
                  fontSize: '0.75rem', fontWeight: notifFilter === 'ALL' ? 800 : 600,
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
                  fontSize: '0.75rem', fontWeight: notifFilter === 'URGENT' ? 800 : 600,
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
                  fontSize: '0.75rem', fontWeight: notifFilter === 'WARNING' ? 800 : 600,
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
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tất cả nhiệm vụ phòng ban đã được xử lý hoàn tất.</span>
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
                        fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px',
                        backgroundColor: `${n.badgeColor || '#2563eb'}15`, color: n.badgeColor || '#2563eb',
                        border: `1px solid ${n.badgeColor || '#2563eb'}30`, textTransform: 'uppercase'
                      }}>
                        {n.badge}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>{n.time}</span>
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
                          fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer'
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
                          fontSize: '0.74rem',
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
    </>
  );
}
