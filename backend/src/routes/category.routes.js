const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { listCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/category.controller');

const MANAGE_ROLES = ['WAREHOUSE_MANAGER', 'CEO', 'ADMIN'];

// @route   GET /api/v1/categories
// @desc    Danh sách danh mục thật kèm số sản phẩm & tổng giá trị tồn (public, giống GET /products)
router.get('/', listCategories);

// @route   POST /api/v1/categories
router.post('/', authMiddleware(MANAGE_ROLES), createCategory);

// @route   PUT /api/v1/categories/:id
router.put('/:id', authMiddleware(MANAGE_ROLES), updateCategory);

// @route   DELETE /api/v1/categories/:id
router.delete('/:id', authMiddleware(MANAGE_ROLES), deleteCategory);

module.exports = router;
