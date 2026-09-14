# Zustand Stores Migration Guide

## Overview

The monolithic ERPContext has been refactored into 5 independent Zustand stores. This improves performance by preventing unnecessary re-renders and makes the codebase more maintainable.

## Store Structure

### 1. **InventoryStore** (`inventoryStore.js`)
Manages all inventory-related data:
- **State**: products, inventory, serialNumbers, error
- **API Actions**: getProducts(), getInventory(), getSerialNumbers()
- **CRUD**: createProduct(), updateProduct(), updateInventory(), deleteProduct()
- **Local (Offline)**: addLocalSerialNumber(), addLocalSerialNumbers()
- **Helpers**: getProductById(), searchProducts(), getLowStockItems(), getOutOfStockItems()
- **LocalStorage Key**: `erp_products`, `erp_inventory`, `erp_serials`

### 2. **SalesStore** (`salesStore.js`)
Manages sales, returns, and complaints:
- **State**: orders, returnRequests, complaints, error
- **API Actions**: getOrders(), getReturnRequests(), getComplaints()
- **CRUD**: createOrder(), updateOrder(), deleteOrder(), createReturnRequest(), updateReturnRequest(), deleteReturnRequest(), createComplaint(), updateComplaint(), deleteComplaint()
- **Local (Offline)**: addLocalOrder()
- **Helpers**: getOrderById(), getOrdersByStatus(), getOrdersByPhone(), getTotalSalesAmount()
- **LocalStorage Keys**: `erp_orders`, `erp_return_requests`, `erp_complaints`

### 3. **HRStore** (`hrStore.js`)
Manages human resources data:
- **State**: employees, attendanceLogs, leaveRequests, payrolls, error
- **API Actions**: getEmployees(), getAttendanceLogs(), getLeaveRequests(), getPayrolls()
- **CRUD**: createEmployee(), updateEmployee(), deleteEmployee(), createAttendanceLog(), updateAttendanceLog(), createLeaveRequest(), updateLeaveRequest(), deleteLeaveRequest(), createPayroll(), updatePayroll(), deletePayroll()
- **Local (Offline)**: addLocalEmployee()
- **Helpers**: getEmployeeById(), getEmployeesByRole(), getPendingLeaveRequests(), getApprovedLeaveRequests()
- **LocalStorage Keys**: `erp_employees`, `erp_attendance_logs`, `erp_leave_requests`, `erp_payrolls`

### 4. **FinanceStore** (`financeStore.js`)
Manages financial data:
- **State**: ledger, purchaseOrders, error
- **API Actions**: getLedger(), getPurchaseOrders()
- **CRUD**: createLedgerEntry(), updateLedgerEntry(), deleteLedgerEntry(), createPurchaseOrder(), updatePurchaseOrder(), deletePurchaseOrder()
- **Local (Offline)**: addLocalLedgerEntry(), addLocalPurchaseOrder()
- **Helpers**: getIncomeEntries(), getExpenseEntries(), getTotalIncome(), getTotalExpenses(), getNetBalance(), getPOsByStatus()
- **LocalStorage Keys**: `erp_ledger`, `erp_pos`

### 5. **UtilityStore** (`utilityStore.js`)
Manages assembly jobs and notifications:
- **State**: assemblyJobs, loading, customNotifs, error
- **API Actions**: getAssemblyJobs()
- **CRUD**: createAssemblyJob(), updateAssemblyJob(), deleteAssemblyJob()
- **Local (Offline)**: addLocalAssemblyJob(), addLocalNotification()
- **Notifications**: sendSystemNotification(), markNotificationAsRead(), markAllNotificationsAsRead(), deleteNotification(), clearNotifications()
- **Helpers**: getAssemblyJobById(), getAssemblyJobsByStatus(), getUnreadNotificationsCount()
- **LocalStorage Keys**: `erp_jobs`, `erp_system_notifications`

## Usage Examples

### Initialize Stores on App Startup

```javascript
import { initializeAllStores } from './stores';

useEffect(() => {
  initializeAllStores();
}, []);
```

### Using InventoryStore

```javascript
import { useInventoryStore } from './stores';

function ProductsList() {
  const { products, inventory, error, getProducts, getLowStockItems } = useInventoryStore();
  
  useEffect(() => {
    getProducts();
  }, [getProducts]);
  
  const lowStockItems = getLowStockItems();
  
  return (
    <div>
      {error && <p>Error: {error}</p>}
      {lowStockItems.map(item => (
        <div key={item.id}>{item.name} - Stock: {item.stock}</div>
      ))}
    </div>
  );
}
```

### Using SalesStore

```javascript
import { useSalesStore } from './stores';

function OrdersList() {
  const { orders, getOrders, createOrder, getOrdersByStatus } = useSalesStore();
  
  useEffect(() => {
    getOrders();
  }, [getOrders]);
  
  const handleCreateOrder = async (orderData) => {
    try {
      await createOrder(orderData);
    } catch (err) {
      console.error('Failed to create order:', err);
    }
  };
  
  const processedOrders = getOrdersByStatus('PROCESSING');
  
  return <div>{/* render orders */}</div>;
}
```

### Using HRStore

```javascript
import { useHRStore } from './stores';

function EmployeesView() {
  const { employees, getEmployees, updateEmployee } = useHRStore();
  
  useEffect(() => {
    getEmployees();
  }, [getEmployees]);
  
  const handleUpdateEmployee = async (empId, data) => {
    try {
      await updateEmployee(empId, data);
    } catch (err) {
      console.error('Failed to update employee:', err);
    }
  };
  
  return <div>{/* render employees */}</div>;
}
```

### Using FinanceStore

```javascript
import { useFinanceStore } from './stores';

function FinanceDashboard() {
  const { 
    ledger, 
    purchaseOrders, 
    getLedger, 
    getTotalIncome, 
    getTotalExpenses, 
    getNetBalance 
  } = useFinanceStore();
  
  useEffect(() => {
    getLedger();
  }, [getLedger]);
  
  const income = getTotalIncome();
  const expenses = getTotalExpenses();
  const balance = getNetBalance();
  
  return (
    <div>
      <p>Income: {income}</p>
      <p>Expenses: {expenses}</p>
      <p>Balance: {balance}</p>
    </div>
  );
}
```

### Using UtilityStore

```javascript
import { useUtilityStore } from './stores';

function NotificationsCenter() {
  const { 
    customNotifs, 
    getAssemblyJobs, 
    sendSystemNotification, 
    markNotificationAsRead,
    getUnreadNotificationsCount 
  } = useUtilityStore();
  
  useEffect(() => {
    getAssemblyJobs();
  }, [getAssemblyJobs]);
  
  const handleSendNotif = () => {
    sendSystemNotification({
      title: 'Test Notification',
      message: 'This is a test',
      targetRoles: ['ADMIN'],
      type: 'TEST'
    });
  };
  
  const unreadCount = getUnreadNotificationsCount();
  
  return (
    <div>
      <p>Unread: {unreadCount}</p>
      <button onClick={handleSendNotif}>Send Notification</button>
    </div>
  );
}
```

## Migration from ERPContext to Zustand

### Old Way (ERPContext):
```javascript
import { useERP } from './context/ERPContext';

function Component() {
  const { products, orders, employees, createOrder } = useERP();
  // All state updates trigger re-render for ALL consumers
  return <div>{/* component */}</div>;
}
```

### New Way (Zustand Stores):
```javascript
import { useInventoryStore, useSalesStore, useHRStore } from './stores';

function Component() {
  const products = useInventoryStore(state => state.products);
  const orders = useSalesStore(state => state.orders);
  const employees = useHRStore(state => state.employees);
  const createOrder = useSalesStore(state => state.createOrder);
  
  // Only re-renders when relevant store state changes
  return <div>{/* component */}</div>;
}
```

### Or use destructuring (with caution for performance):
```javascript
import { useSalesStore } from './stores';

function Component() {
  // All properties of store - re-renders on any store change
  const { orders, createOrder } = useSalesStore();
  
  return <div>{/* component */}</div>;
}
```

### Better Performance Pattern:
```javascript
import { useSalesStore } from './stores';

function Component() {
  // Only selects needed properties - more selective re-renders
  const orders = useSalesStore(state => state.orders);
  const createOrder = useSalesStore(state => state.createOrder);
  
  return <div>{/* component */}</div>;
}
```

## Offline Support (localStorage)

All stores automatically persist to localStorage and restore on page reload:

```javascript
// Data is automatically saved on any action
const { createOrder } = useSalesStore();
await createOrder(orderData); // Saved to localStorage automatically

// On page refresh, data is restored
// Works perfectly offline until backend is available
```

## Error Handling

All stores include error state and provide error information:

```javascript
const { error, getOrders } = useSalesStore();

useEffect(() => {
  getOrders().catch(err => {
    // Error is also set in store.error
    console.error('Failed to fetch:', store.error);
  });
}, []);

// In component
{error && <ErrorAlert message={error} />}
```

## System Summary

Get a bird's-eye view of all stores:

```javascript
import { getSystemSummary } from './stores';

async function Dashboard() {
  const summary = await getSystemSummary();
  // Returns object with counts, totals, and metrics from all stores
  console.log(summary);
}
```

## Performance Benefits

1. **Selective Re-renders**: Components only re-render when their specific store state changes
2. **Modular Code**: Each domain is isolated and independently maintainable
3. **Type Safety**: Better TypeScript support with JSDoc comments
4. **Offline Support**: All data persists to localStorage automatically
5. **No Dependencies Between Stores**: Each store is completely independent
6. **Efficient Updates**: Only affected components re-render on updates

## LocalStorage Keys Reference

| Store | Key | Data |
|-------|-----|------|
| Inventory | `erp_products` | Products list |
| | `erp_inventory` | Inventory items with stock levels |
| | `erp_serials` | Serial numbers |
| Sales | `erp_orders` | All orders |
| | `erp_return_requests` | Return requests |
| | `erp_complaints` | Customer complaints |
| HR | `erp_employees` | Employee list |
| | `erp_attendance_logs` | Attendance records |
| | `erp_leave_requests` | Leave requests |
| | `erp_payrolls` | Payroll records |
| Finance | `erp_ledger` | General ledger |
| | `erp_pos` | Purchase orders |
| Utility | `erp_jobs` | Assembly jobs |
| | `erp_system_notifications` | System notifications |

## API Endpoints Required

The stores expect these API endpoints to be available:

```
GET    /api/v1/products
POST   /api/v1/products
PUT    /api/v1/products/:id
DELETE /api/v1/products/:id

GET    /api/v1/inventory
PUT    /api/v1/inventory/:id

GET    /api/v1/serials
PATCH  /api/v1/serials/:serial

GET    /api/v1/orders
POST   /api/v1/orders
PUT    /api/v1/orders/:id
DELETE /api/v1/orders/:id

GET    /api/v1/returns
POST   /api/v1/returns
PUT    /api/v1/returns/:id
DELETE /api/v1/returns/:id

GET    /api/v1/complaints
POST   /api/v1/complaints
PUT    /api/v1/complaints/:id
DELETE /api/v1/complaints/:id

GET    /api/v1/employees
POST   /api/v1/employees
PUT    /api/v1/employees/:id
DELETE /api/v1/employees/:id

GET    /api/v1/attendance
POST   /api/v1/attendance
PUT    /api/v1/attendance/:id

GET    /api/v1/leaves
POST   /api/v1/leaves
PUT    /api/v1/leaves/:id
DELETE /api/v1/leaves/:id

GET    /api/v1/payrolls
POST   /api/v1/payrolls
PUT    /api/v1/payrolls/:id
DELETE /api/v1/payrolls/:id

GET    /api/v1/ledger
POST   /api/v1/ledger
PUT    /api/v1/ledger/:id
DELETE /api/v1/ledger/:id

GET    /api/v1/purchase-orders
POST   /api/v1/purchase-orders
PUT    /api/v1/purchase-orders/:id
DELETE /api/v1/purchase-orders/:id

GET    /api/v1/assembly-jobs
POST   /api/v1/assembly-jobs
PUT    /api/v1/assembly-jobs/:id
DELETE /api/v1/assembly-jobs/:id
```

## Next Steps

1. ✅ Zustand stores created and configured
2. ⏳ Gradually migrate components from ERPContext to individual stores
3. ⏳ Update API endpoints to match store expectations
4. ⏳ Remove ERPContext after all components are migrated
5. ⏳ Add TypeScript interfaces for better type safety

## Notes

- **Do NOT delete ERPContext yet** - We'll provide a migration guide after stores are fully tested
- All stores work **offline** with localStorage
- Stores are **completely independent** - no circular dependencies
- Each action includes **automatic error handling** and **logging**
- **All data is persisted** to localStorage automatically
