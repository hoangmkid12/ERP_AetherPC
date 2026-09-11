const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { QC_ROLES } = require('../constants/roles');
const {
  getReceipts,
  getReceiptById,
  validateReceipt,
  getStockMovements,
  getInventory,
  adjustInventory,
  auditDecreaseInventory,
  listPurchaseRequests,
  createPurchaseRequest,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  listWarehouseLocations,
  getLocationProducts,
  createWarehouseLocation,
  updateWarehouseLocation,
  deleteWarehouseLocation,
  assignInventoryLocation
} = require('../controllers/warehouse.controller');

const WAREHOUSE_ROLES = ['WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN'];
// warehouse_audit_adjust / warehouse_approve_pr / warehouse_manage_locations —
// theo Ma Trận Phân Quyền, đây là 3 nghiệp vụ chỉ Quản Lý Kho được duyệt,
// không phải việc Thủ Kho làm hàng ngày.
const WAREHOUSE_MANAGER_ROLES = ['WAREHOUSE_MANAGER', 'CEO', 'ADMIN'];

// @route   GET /api/v1/warehouse/receipts
router.get('/receipts', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', ...QC_ROLES, 'PURCHASING', 'ACCOUNTANT', 'CEO', 'ADMIN']), getReceipts);

// @route   GET /api/v1/warehouse/receipts/:id
router.get('/receipts/:id', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', ...QC_ROLES, 'PURCHASING', 'ACCOUNTANT', 'CEO', 'ADMIN']), getReceiptById);

// @route   POST /api/v1/warehouse/receipts/:id/validate
router.post('/receipts/:id/validate', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), validateReceipt);

// @route   GET /api/v1/warehouse/stock-movements
router.get('/stock-movements', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', ...QC_ROLES, 'SALES', 'SALES_MANAGER', 'PURCHASING', 'ACCOUNTANT', 'CEO', 'ADMIN']), getStockMovements);

// @route   GET /api/v1/warehouse/inventory
router.get('/inventory', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', ...QC_ROLES, 'SALES', 'SALES_MANAGER', 'PURCHASING', 'ACCOUNTANT', 'CEO', 'ADMIN']), getInventory);

// @route   POST /api/v1/warehouse/inventory/adjust
// @desc    Nhập kho trực tiếp / kiểm kê bổ sung (không qua đơn mua PO)
router.post('/inventory/adjust', authMiddleware(WAREHOUSE_ROLES), adjustInventory);

// @route   POST /api/v1/warehouse/inventory/audit-adjust
// @desc    Kiểm kê điều chỉnh GIẢM tồn kho (warehouse_audit_adjust) — chỉ Quản Lý Kho
router.post('/inventory/audit-adjust', authMiddleware(WAREHOUSE_MANAGER_ROLES), auditDecreaseInventory);

// @route   PATCH /api/v1/warehouse/inventory/:id/location
// @desc    Gán 1 dòng tồn kho vào vị trí kệ cụ thể
router.patch('/inventory/:id/location', authMiddleware(WAREHOUSE_ROLES), assignInventoryLocation);

// ─── Phiếu Yêu Cầu Mua Hàng nội bộ (PR) ─────────────────────────────────────

// @route   GET /api/v1/warehouse/purchase-requests
router.get('/purchase-requests', authMiddleware(['PURCHASING', ...WAREHOUSE_ROLES]), listPurchaseRequests);

// @route   POST /api/v1/warehouse/purchase-requests
// @desc    Thủ Kho lập đề xuất (warehouse_create_pr)
router.post('/purchase-requests', authMiddleware(WAREHOUSE_ROLES), createPurchaseRequest);

// @route   PATCH /api/v1/warehouse/purchase-requests/:id/approve
// @desc    Quản Lý Kho ký duyệt (warehouse_approve_pr)
router.patch('/purchase-requests/:id/approve', authMiddleware(WAREHOUSE_MANAGER_ROLES), approvePurchaseRequest);

// @route   PATCH /api/v1/warehouse/purchase-requests/:id/reject
router.patch('/purchase-requests/:id/reject', authMiddleware(WAREHOUSE_MANAGER_ROLES), rejectPurchaseRequest);

// ─── Vị Trí Kệ Kho ───────────────────────────────────────────────────────────

// @route   GET /api/v1/warehouse/locations
router.get('/locations', authMiddleware(WAREHOUSE_ROLES), listWarehouseLocations);

// @route   GET /api/v1/warehouse/locations/:id/products
router.get('/locations/:id/products', authMiddleware(WAREHOUSE_ROLES), getLocationProducts);

// @route   POST /api/v1/warehouse/locations
// @desc    Quản Lý Kho tạo vị trí kệ mới (warehouse_manage_locations)
router.post('/locations', authMiddleware(WAREHOUSE_MANAGER_ROLES), createWarehouseLocation);

// @route   PUT /api/v1/warehouse/locations/:id
router.put('/locations/:id', authMiddleware(WAREHOUSE_MANAGER_ROLES), updateWarehouseLocation);

// @route   DELETE /api/v1/warehouse/locations/:id
router.delete('/locations/:id', authMiddleware(WAREHOUSE_MANAGER_ROLES), deleteWarehouseLocation);

module.exports = router;
