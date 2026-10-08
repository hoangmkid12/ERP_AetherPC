/**
 * Zustand Stores Index
 * Central export point for all ERP stores
 * 
 * Each store is independent and can be used separately:
 * - useInventoryStore: Products, inventory, serial numbers
 * - useSalesStore: Orders, returns, complaints
 * - useHRStore: Employees, attendance, leaves, payrolls
 * - useFinanceStore: Ledger entries, purchase orders
 * - useUtilityStore: Assembly jobs, notifications
 */

import { useInventoryStore } from './inventoryStore';
import { useSalesStore } from './salesStore';
import { useHRStore } from './hrStore';
import { useFinanceStore } from './financeStore';
import { useUtilityStore } from './utilityStore';
import { loadRbacFromServer } from '../utils/rbacEngine';

export { useInventoryStore, useSalesStore, useHRStore, useFinanceStore, useUtilityStore };

// Quyền đọc của từng nguồn dữ liệu — khớp authMiddleware ở backend (routes/*.routes.js). Trước đây mọi tài
// khoản (kể cả khách chưa đăng nhập, mỗi 45 giây) đều gọi tất cả API: phần lớn trả 403/404 nhưng vẫn chiếm
// kết nối cơ sở dữ liệu và hạn mức yêu cầu, góp phần làm trang quản trị treo khi nhiều người cùng dùng.
const QC = ['QC', 'QA', 'QUALITY_CONTROL'];
const EMPLOYEE_ROLES = ['CEO', 'ADMIN', 'SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'PURCHASING', 'ASSEMBLY',
  'HR', 'ACCOUNTANT', 'CSKH', 'DELIVERY', 'EMPLOYEE', ...QC];
const ACCESS = {
  products: EMPLOYEE_ROLES,
  inventory: ['WAREHOUSE', 'WAREHOUSE_MANAGER', ...QC, 'SALES', 'SALES_MANAGER', 'PURCHASING', 'ACCOUNTANT', 'CEO', 'ADMIN'],
  orders: ['CUSTOMER', 'DELIVERY', 'SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN', 'CSKH', 'ACCOUNTANT'],
  returns: ['CUSTOMER', 'SALES', 'SALES_MANAGER', 'CEO', 'ADMIN', 'CSKH', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'ACCOUNTANT', 'DELIVERY', ...QC],
  complaints: ['CUSTOMER', 'CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN'],
  hrAll: ['HR', 'CEO', 'ADMIN'],
  ownLeaves: EMPLOYEE_ROLES,
  payrolls: ['HR', 'CEO', 'ADMIN', 'ACCOUNTANT'],
  ledger: ['ACCOUNTANT', 'CEO', 'ADMIN'],
  purchaseOrders: ['PURCHASING', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN', 'SUPPLIER', 'ACCOUNTANT', ...QC],
  assemblyJobs: ['ASSEMBLY', 'CEO', 'ADMIN'],
  rbac: EMPLOYEE_ROLES,
};

let currentIdentity = null; // `${role}:${id}` của người đang đăng nhập; null = khách
let currentRole = null;

/**
 * Gọi khi người dùng đăng nhập/đăng xuất/khôi phục phiên. Khi danh tính đổi, xoá sạch dữ liệu của người trước
 * (cả bộ nhớ lẫn localStorage) để người dùng sau trên cùng máy không thấy bảng lương, sổ cái... của người trước.
 */
export const setStoreUser = (user) => {
  const identity = user ? `${user.role}:${user.id ?? user.username ?? ''}` : null;
  if (identity === currentIdentity) return;
  clearAllStores(); // kể cả lần đầu: localStorage có thể còn dữ liệu của phiên trước chưa đăng xuất
  currentIdentity = identity;
  currentRole = user?.role || null;
};

/**
 * Tải lại dữ liệu từ API cho người đang đăng nhập — chỉ những nguồn vai trò đó được phép đọc.
 * Khách chưa đăng nhập không tải gì (cửa hàng trực tuyến có nguồn dữ liệu riêng).
 */
export const initializeAllStores = async (user) => {
  if (user !== undefined) setStoreUser(user);
  const role = currentRole;
  if (!role) return;
  const can = (key) => ACCESS[key].includes(role);
  const inv = useInventoryStore.getState();
  const sales = useSalesStore.getState();
  const hr = useHRStore.getState();
  const fin = useFinanceStore.getState();
  const util = useUtilityStore.getState();
  const tasks = [];
  if (can('products')) tasks.push(inv.getProducts());
  if (can('inventory')) tasks.push(inv.getInventory());
  if (can('orders')) tasks.push(sales.getOrders());
  if (can('returns')) tasks.push(sales.getReturnRequests());
  if (can('complaints')) tasks.push(sales.getComplaints());
  if (can('hrAll')) tasks.push(hr.getEmployees(), hr.getAttendanceLogs(), hr.getLeaveRequests({ all: true }));
  else if (can('ownLeaves')) tasks.push(hr.getLeaveRequests({ all: false }));
  if (can('payrolls')) tasks.push(hr.getPayrolls());
  if (can('ledger')) tasks.push(fin.getLedger());
  if (can('purchaseOrders')) tasks.push(fin.getPurchaseOrders());
  if (can('assemblyJobs')) tasks.push(util.getAssemblyJobs());
  if (can('rbac')) tasks.push(loadRbacFromServer());
  await Promise.allSettled(tasks);
};

/**
 * Clear all store data
 * Use with caution - this removes all persisted data
 */
export const clearAllStores = () => {
  useInventoryStore.getState().clearAll();
  useSalesStore.getState().clearAll();
  useHRStore.getState().clearAll();
  useFinanceStore.getState().clearAll();
  useUtilityStore.getState().clearAll();
};

/**
 * Get summary statistics across all stores
 */
export const getSystemSummary = async () => {
  const inventory = useInventoryStore.getState();
  const sales = useSalesStore.getState();
  const hr = useHRStore.getState();
  const finance = useFinanceStore.getState();
  const utility = useUtilityStore.getState();

  return {
    inventory: {
      totalProducts: inventory.products.length,
      totalInventoryValue: inventory.inventory.reduce((sum, item) => sum + (item.stock * item.price), 0),
      lowStockItems: inventory.getLowStockItems().length,
      outOfStockItems: inventory.getOutOfStockItems().length,
    },
    sales: {
      totalOrders: sales.orders.length,
      totalSalesAmount: sales.getTotalSalesAmount(),
      averageOrderValue: sales.getAverageOrderValue(),
      pendingReturnRequests: sales.getReturnsByStatus('PENDING').length,
      openComplaints: sales.getComplaintsByStatus('OPEN').length,
    },
    hr: {
      totalEmployees: hr.employees.length,
      presentToday: hr.employees.filter(e => e.attendance === 'PRESENT').length,
      absentToday: hr.employees.filter(e => e.attendance === 'ABSENT').length,
      pendingLeaveRequests: hr.getPendingLeaveRequests().length,
      totalPayrollAmount: hr.getTotalPayrollAmount(),
    },
    finance: {
      totalIncome: finance.getTotalIncome(),
      totalExpenses: finance.getTotalExpenses(),
      netBalance: finance.getNetBalance(),
      totalPOAmount: finance.getTotalPOAmount(),
      pendingPOs: finance.getPendingPOs().length,
    },
    utility: {
      totalAssemblyJobs: utility.assemblyJobs.length,
      assemblingJobs: utility.getAssemblingJobs().length,
      completedJobs: utility.getCompletedAssemblyJobs().length,
      unreadNotifications: utility.getUnreadNotificationsCount(),
    },
  };
};
