const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  getAddresses,
  addAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  getProfile
} = require('../controllers/customer.controller');

// Tất cả các route dưới đây đều yêu cầu khách hàng đăng nhập
router.use(authMiddleware(['CUSTOMER']));

// @route   GET /api/v1/customers/profile
// @desc    Lấy thông tin hồ sơ cá nhân của khách hàng
router.get('/profile', getProfile);

// @route   GET /api/v1/customers/addresses
// @desc    Lấy danh sách sổ địa chỉ
router.get('/addresses', getAddresses);

// @route   POST /api/v1/customers/addresses
// @desc    Thêm địa chỉ mới vào sổ
router.post('/addresses', addAddress);

// @route   PUT /api/v1/customers/addresses/:id
// @desc    Cập nhật thông tin địa chỉ
router.put('/addresses/:id', updateAddress);

// @route   PATCH /api/v1/customers/addresses/:id/default
// @desc    Đặt địa chỉ làm mặc định
router.patch('/addresses/:id/default', setDefaultAddress);

// @route   DELETE /api/v1/customers/addresses/:id
// @desc    Xóa địa chỉ
router.delete('/addresses/:id', deleteAddress);

module.exports = router;
