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

export { useInventoryStore, useSalesStore, useHRStore, useFinanceStore, useUtilityStore };

/**
 * Initialize all stores: hydrate from localStorage for an instant paint,
 * then refresh every store from the API so data reflects the server.
 * Call this once on app startup.
 */
export const initializeAllStores = async () => {
  await Promise.allSettled([
    useInventoryStore.getState().initialize(),
    useSalesStore.getState().initialize(),
    useHRStore.getState().initialize(),
    useFinanceStore.getState().initialize(),
    useUtilityStore.getState().initialize(),
  ]);
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
