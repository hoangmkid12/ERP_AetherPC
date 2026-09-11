const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { QC_ROLES } = require('../constants/roles');
const {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  createSupplierEvaluation,
  getPurchasingProducts,
  getMySuppliedProducts,
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  createVendorBill,
  registerPayment,
  validateReceipt
} = require('../controllers/purchase.controller');
const { listPurchaseRequests } = require('../controllers/warehouse.controller');

// @route   GET /api/v1/purchasing/requests
// @desc    Lấy danh sách phiếu yêu cầu mua hàng nội bộ (PR)
router.get('/requests', authMiddleware(['PURCHASING', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), listPurchaseRequests);

// @route   GET /api/v1/purchasing/suppliers
router.get('/suppliers', authMiddleware(['PURCHASING', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN', 'SUPPLIER']), getSuppliers);

// @route   POST /api/v1/purchasing/suppliers
router.post('/suppliers', authMiddleware(['PURCHASING', 'CEO', 'ADMIN']), createSupplier);

// @route   PUT /api/v1/purchasing/suppliers/:code
router.put('/suppliers/:code', authMiddleware(['PURCHASING', 'CEO', 'ADMIN']), updateSupplier);

// @route   DELETE /api/v1/purchasing/suppliers/:code
router.delete('/suppliers/:code', authMiddleware(['PURCHASING', 'CEO', 'ADMIN']), deactivateSupplier);

// @route   POST /api/v1/purchasing/suppliers/:code/evaluations
router.post('/suppliers/:code/evaluations', authMiddleware(['PURCHASING', 'CEO', 'ADMIN']), createSupplierEvaluation);

// @route   GET /api/v1/purchasing/products
router.get('/products', authMiddleware(['PURCHASING', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), getPurchasingProducts);

// @route   GET /api/v1/purchasing/suppliers/me/products
// @desc    NCC tự xem danh sách sản phẩm mình đang là nhà cung cấp mặc định
router.get('/suppliers/me/products', authMiddleware(['SUPPLIER']), getMySuppliedProducts);

// @route   GET /api/v1/purchasing/orders
router.get('/orders', authMiddleware(['PURCHASING', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN', 'SUPPLIER', 'ACCOUNTANT', ...QC_ROLES]), getPurchaseOrders);

// @route   POST /api/v1/purchasing/orders
router.post('/orders', authMiddleware(['PURCHASING', 'CEO', 'ADMIN']), createPurchaseOrder);

// @route   PATCH /api/v1/purchasing/orders/:id/status
router.patch('/orders/:id/status', authMiddleware(['PURCHASING', 'CEO', 'ADMIN', 'ACCOUNTANT', 'SUPPLIER', ...QC_ROLES]), updatePurchaseOrderStatus);

// @route   POST /api/v1/purchasing/orders/:id/bills
router.post('/orders/:id/bills', authMiddleware(['ACCOUNTANT', 'CEO', 'ADMIN']), createVendorBill);

// @route   POST /api/v1/purchasing/bills/:billId/payments
router.post('/bills/:billId/payments', authMiddleware(['ACCOUNTANT', 'CEO', 'ADMIN']), registerPayment);

// @route   POST /api/v1/purchasing/receipts/:receiptId/validate
router.post('/receipts/:receiptId/validate', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), validateReceipt);

module.exports = router;
