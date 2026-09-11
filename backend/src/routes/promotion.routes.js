const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { checkOperationalPermission } = require('../middlewares/rbac.middleware');
const { listPromotions, createPromotion, updatePromotion, deletePromotion } = require('../controllers/promotion.controller');

const VIEW_ROLES = ['SALES', 'SALES_MANAGER', 'CEO', 'ADMIN'];
const MANAGE_ROLES = ['SALES_MANAGER', 'CEO', 'ADMIN'];

// @route   GET /api/v1/promotions
// @desc    Danh sách khuyến mãi thật (nhân viên Sales đứng quầy dùng để áp mã)
router.get('/', authMiddleware(VIEW_ROLES), listPromotions);

// @route   POST /api/v1/promotions
router.post('/', authMiddleware(MANAGE_ROLES), checkOperationalPermission('sales_manage_promotions'), createPromotion);

// @route   PUT /api/v1/promotions/:id
router.put('/:id', authMiddleware(MANAGE_ROLES), checkOperationalPermission('sales_manage_promotions'), updatePromotion);

// @route   DELETE /api/v1/promotions/:id
router.delete('/:id', authMiddleware(MANAGE_ROLES), checkOperationalPermission('sales_manage_promotions'), deletePromotion);

module.exports = router;
