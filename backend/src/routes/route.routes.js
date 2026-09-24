const express = require('express');
const router = express.Router();
const { optimizeRoute } = require('../controllers/routeOptimizer.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// @route   POST /api/v1/routes/optimize
// @desc    Tối ưu lộ trình giao hàng cho Shipper (Nearest Neighbor + OSRM)
// @body    { orderIds: string[] }
// @auth    DELIVERY, CSKH, CEO, ADMIN
router.post('/optimize', authMiddleware(['DELIVERY', 'CSKH', 'CEO', 'ADMIN']), optimizeRoute);

module.exports = router;
