const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  getReceipts,
  getReceiptById,
  validateReceipt,
  getStockMovements,
  getInventory
} = require('../controllers/warehouse.controller');

// @route   GET /api/v1/warehouse/receipts
router.get('/receipts', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', 'QC', 'QA', 'PURCHASING', 'ACCOUNTANT', 'CEO', 'ADMIN']), getReceipts);

// @route   GET /api/v1/warehouse/receipts/:id
router.get('/receipts/:id', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', 'QC', 'QA', 'PURCHASING', 'ACCOUNTANT', 'CEO', 'ADMIN']), getReceiptById);

// @route   POST /api/v1/warehouse/receipts/:id/validate
router.post('/receipts/:id/validate', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), validateReceipt);

// @route   GET /api/v1/warehouse/stock-movements
router.get('/stock-movements', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', 'QC', 'QA', 'SALES', 'SALES_MANAGER', 'PURCHASING', 'ACCOUNTANT', 'CEO', 'ADMIN']), getStockMovements);

// @route   GET /api/v1/warehouse/inventory
router.get('/inventory', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', 'QC', 'QA', 'SALES', 'SALES_MANAGER', 'PURCHASING', 'ACCOUNTANT', 'CEO', 'ADMIN']), getInventory);

module.exports = router;
