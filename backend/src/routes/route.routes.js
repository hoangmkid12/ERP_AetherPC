const express = require('express');
const router = express.Router();
const { optimizeRoute, geocode } = require('../controllers/routeOptimizer.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// @route   POST /api/v1/routes/optimize
// @desc    Tối ưu thứ tự giao hàng, xuất phát từ vị trí hiện tại của Shipper
// @body    { orderIds: string[], originLat: number, originLng: number, originName?: string }
// @auth    DELIVERY, CSKH, CEO, ADMIN
router.post('/optimize', authMiddleware(['DELIVERY', 'CSKH', 'CEO', 'ADMIN']), optimizeRoute);

// @route   GET /api/v1/routes/geocode?address=...
// @desc    Định vị địa chỉ giao hàng tới số nhà/hẻm (kèm độ chính xác) — dùng
//          chung cho bản đồ Shipper và bản đồ theo dõi đơn của khách
// @auth    Mọi người dùng đã đăng nhập (trang theo dõi đơn đã yêu cầu đăng nhập)
router.get('/geocode', authMiddleware(), geocode);

module.exports = router;
