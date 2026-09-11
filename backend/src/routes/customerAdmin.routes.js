const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { checkOperationalPermission } = require('../middlewares/rbac.middleware');
const {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  setCustomerStatus,
  resetCustomerPassword,
  deleteCustomer
} = require('../controllers/customerAdmin.controller');

// Đọc danh sách: mọi vai trò có thể thấy tab Khách Hàng trong Bán Hàng/CSKH.
const READ_ROLES = ['CEO', 'ADMIN', 'SALES_MANAGER', 'SALES', 'CSKH'];
// Thao tác tạo/sửa/xóa tài khoản: chỉ quản lý trở lên ở tầng route baseline —
// `sales_manage_customers` (Ma Trận Phân Quyền) là lớp thứ 2 bên trên, cho
// phép ADMIN tắt/bật quyền này cho từng vai trò mà không phải sửa code.
const WRITE_ROLES = ['CEO', 'ADMIN', 'SALES_MANAGER'];
const requireManageCustomers = checkOperationalPermission('sales_manage_customers');

// @route   GET /api/v1/customer-accounts
router.get('/', authMiddleware(READ_ROLES), listCustomers);

// @route   GET /api/v1/customer-accounts/:id
router.get('/:id', authMiddleware(READ_ROLES), getCustomer);

// @route   POST /api/v1/customer-accounts
router.post('/', authMiddleware(WRITE_ROLES), requireManageCustomers, createCustomer);

// @route   PUT /api/v1/customer-accounts/:id
router.put('/:id', authMiddleware(WRITE_ROLES), requireManageCustomers, updateCustomer);

// @route   PATCH /api/v1/customer-accounts/:id/status
router.patch('/:id/status', authMiddleware(WRITE_ROLES), requireManageCustomers, setCustomerStatus);

// @route   PATCH /api/v1/customer-accounts/:id/reset-password
router.patch('/:id/reset-password', authMiddleware(WRITE_ROLES), requireManageCustomers, resetCustomerPassword);

// @route   DELETE /api/v1/customer-accounts/:id
router.delete('/:id', authMiddleware(WRITE_ROLES), requireManageCustomers, deleteCustomer);

module.exports = router;
