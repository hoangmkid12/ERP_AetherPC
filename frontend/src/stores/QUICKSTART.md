# 🚀 QUICK START GUIDE - Zustand Stores

## 📍 Location
```
frontend/src/stores/
```

## 📦 What's Included

### 5 Production-Ready Stores
1. **inventoryStore.js** - Products, inventory, serial numbers
2. **salesStore.js** - Orders, returns, complaints  
3. **hrStore.js** - Employees, attendance, leaves, payrolls
4. **financeStore.js** - Ledger, purchase orders
5. **utilityStore.js** - Assembly jobs, notifications

### Central Export
- **index.js** - Exports all stores + helper functions

### Documentation (Choose Your Style)
- **README.md** - Overview & examples (⭐ START HERE)
- **MIGRATION_GUIDE.md** - Detailed before/after code
- **SETUP_CHECKLIST.md** - Verification & next steps
- **DELIVERY_SUMMARY.md** - Complete delivery report

---

## ⚡ 60-Second Setup

### 1. Initialize Stores (App.jsx)
```javascript
import { initializeAllStores } from './stores';

useEffect(() => {
  initializeAllStores(); // Load from localStorage
}, []);
```

### 2. Use in Component
```javascript
import { useInventoryStore } from './stores';

function MyComponent() {
  const { products, getProducts, getLowStockItems } = useInventoryStore();
  
  useEffect(() => {
    getProducts(); // Fetch from API
  }, []);
  
  const lowStock = getLowStockItems();
  
  return <div>{/* render */}</div>;
}
```

### 3. That's It! 🎉
- ✅ Data auto-loads from localStorage
- ✅ Updates auto-save to localStorage
- ✅ Works offline
- ✅ Component optimized for performance

---

## 🎯 Store Functions (Quick Reference)

### InventoryStore
```javascript
// Fetch
getProducts()
getInventory()
getSerialNumbers()

// Create/Update
createProduct(data)
updateProduct(id, data)
updateInventory(id, data)
updateSerialNumber(serial, status)

// Delete
deleteProduct(id)

// Local (Offline)
addLocalSerialNumber(serial)
addLocalSerialNumbers([serials])

// Query
getProductById(id)
getInventoryByProductId(id)
searchProducts(query)
getLowStockItems()
getOutOfStockItems()
getProductsByCategory(category)
```

### SalesStore
```javascript
// Fetch
getOrders()
getReturnRequests()
getComplaints()

// Create/Update/Delete Orders
createOrder(data)
updateOrder(id, data)
deleteOrder(id)

// Create/Update/Delete Returns
createReturnRequest(data)
updateReturnRequest(id, data)
deleteReturnRequest(id)

// Create/Update/Delete Complaints
createComplaint(data)
updateComplaint(id, data)
deleteComplaint(id)

// Query
getOrderById(id)
getOrdersByStatus(status)
getOrdersByPhone(phone)
getTotalSalesAmount()
getReturnsByStatus(status)
getComplaintsByStatus(status)
getComplaintsByPriority(priority)

// Local (Offline)
addLocalOrder(order)
```

### HRStore
```javascript
// Fetch
getEmployees()
getAttendanceLogs()
getLeaveRequests()
getPayrolls()

// Employee CRUD
createEmployee(data)
updateEmployee(id, data)
deleteEmployee(id)

// Attendance CRUD
createAttendanceLog(data)
updateAttendanceLog(id, data)

// Leave CRUD
createLeaveRequest(data)
updateLeaveRequest(id, data)
deleteLeaveRequest(id)

// Payroll CRUD
createPayroll(data)
updatePayroll(id, data)
deletePayroll(id)

// Query
getEmployeeById(id)
getEmployeesByRole(role)
getEmployeeAttendance(empId)
getPendingLeaveRequests()
getApprovedLeaveRequests()
getEmployeePayrolls(empId)
getTotalPayrollAmount()

// Local (Offline)
addLocalEmployee(employee)
```

### FinanceStore
```javascript
// Fetch
getLedger()
getPurchaseOrders()

// Ledger CRUD
createLedgerEntry(data)
updateLedgerEntry(id, data)
deleteLedgerEntry(id)

// PO CRUD
createPurchaseOrder(data)
updatePurchaseOrder(id, data)
deletePurchaseOrder(id)

// Query
getLedgerEntryById(id)
getPurchaseOrderById(id)
getIncomeEntries()
getExpenseEntries()
getLedgerByDateRange(start, end)
getTotalIncome()
getTotalExpenses()
getNetBalance()
getPOsByStatus(status)
getPOsBySupplier(code)
getTotalPOAmount()
getPendingPOs()

// Local (Offline)
addLocalLedgerEntry(entry)
addLocalPurchaseOrder(po)
```

### UtilityStore
```javascript
// Fetch
getAssemblyJobs()

// Assembly CRUD
createAssemblyJob(data)
updateAssemblyJob(id, data)
deleteAssemblyJob(id)

// Notifications
sendSystemNotification(data)
markNotificationAsRead(id)
markAllNotificationsAsRead()
deleteNotification(id)
clearNotifications()

// Query
getAssemblyJobById(id)
getAssemblyJobsByOrderId(orderId)
getAssemblyJobsByStatus(status)
getUnreadNotificationsCount()
getNotificationsForRole(role)
getUnreadNotificationsForRole(role)
getNotificationsByType(type)
getAssemblingJobs()
getCompletedAssemblyJobs()

// Local (Offline)
addLocalAssemblyJob(job)
addLocalNotification(notif)
```

---

## 💡 Common Patterns

### Pattern 1: Fetch & Display
```javascript
const { products } = useInventoryStore();

useEffect(() => {
  useInventoryStore.getState().getProducts();
}, []);

return products.map(p => <div key={p.id}>{p.name}</div>);
```

### Pattern 2: Selective Performance
```javascript
// Only subscribe to products (not other store state)
const products = useInventoryStore(state => state.products);
const getProducts = useInventoryStore(state => state.getProducts);

// Component only re-renders if products change
```

### Pattern 3: Create with Error Handling
```javascript
const { createOrder, error } = useSalesStore();

const handleSubmit = async (formData) => {
  try {
    await createOrder(formData);
    toast.success('Order created!');
  } catch (err) {
    toast.error(error || 'Failed to create order');
  }
};
```

### Pattern 4: Filter & Display
```javascript
const getLowStockItems = useInventoryStore(state => state.getLowStockItems);
const lowStock = getLowStockItems();

return lowStock.map(item => <Alert key={item.id}>{item.name}</Alert>);
```

### Pattern 5: System Summary
```javascript
import { getSystemSummary } from './stores';

const summary = getSystemSummary();
console.log(summary.sales.totalOrders);
console.log(summary.inventory.outOfStockItems);
console.log(summary.finance.netBalance);
```

---

## 🧪 Testing Examples

```javascript
import { useInventoryStore } from './stores';

// Get store state
const store = useInventoryStore.getState();

// Test initial state
expect(store.products).toEqual([]);

// Test fetch
await store.getProducts();
expect(store.products.length).toBeGreaterThan(0);

// Test create
const newProduct = await store.createProduct({ name: 'Test' });
expect(store.products).toContain(newProduct);

// Test error handling
try {
  await store.getProducts();
} catch (err) {
  expect(store.error).toBeDefined();
}
```

---

## 🌐 Offline Support

All stores work completely offline:

```javascript
// Online: Fetches from API + saves to localStorage
await store.getProducts();

// Offline: Loads from localStorage automatically
// No API call = no error, data still available

// When back online: Data syncs automatically
```

---

## 📝 Error Handling

All stores include error state:

```javascript
const { products, error } = useInventoryStore();

if (error) {
  return <ErrorAlert message={error} />;
}
```

---

## 🔑 LocalStorage Keys

| Store | Key | Data |
|-------|-----|------|
| Inventory | `erp_products` | Products |
| | `erp_inventory` | Stock levels |
| | `erp_serials` | Serial numbers |
| Sales | `erp_orders` | Orders |
| | `erp_return_requests` | Returns |
| | `erp_complaints` | Complaints |
| HR | `erp_employees` | Employees |
| | `erp_attendance_logs` | Attendance |
| | `erp_leave_requests` | Leaves |
| | `erp_payrolls` | Payrolls |
| Finance | `erp_ledger` | Ledger |
| | `erp_pos` | Purchase orders |
| Utility | `erp_jobs` | Assembly jobs |
| | `erp_system_notifications` | Notifications |

---

## 🆘 Troubleshooting

### Data not persisting?
```javascript
// Check localStorage
localStorage.getItem('erp_products')

// Manually save
useInventoryStore.getState().initialize()
```

### Component not updating?
```javascript
// Use selective subscription (better performance)
const products = useInventoryStore(state => state.products);

// vs full destructure (slower)
const { products } = useInventoryStore();
```

### API not responding?
```javascript
// Stores work offline automatically
// Data loads from localStorage
// No manual error handling needed
```

---

## 📚 Full Documentation

- **README.md** - Complete overview
- **MIGRATION_GUIDE.md** - Step-by-step integration
- **SETUP_CHECKLIST.md** - Verification checklist
- **DELIVERY_SUMMARY.md** - Full details

---

## ✅ You're All Set!

1. ✅ Stores are ready
2. ✅ Documentation is complete
3. ✅ No dependencies needed
4. ✅ Works offline
5. ✅ Production-ready

**Start integrating!** 🚀

---

**Questions?** Check the full documentation files!
