const express = require('express');
const router = express.Router();
const { getProducts, getProductById, getAIRecommendations, getProductReviews, addProductReview, createProduct, updateProduct, deleteProduct } = require('../controllers/product.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// @route   GET /api/v1/products
// @desc    Query products list with pagination & filters
router.get('/', getProducts);

// @route   GET /api/v1/products/:id
// @desc    Get detailed product by ID
router.get('/:id', getProductById);

// @route   GET /api/v1/products/:id/recommendations
// @desc    Get AI recommendations based on similarity of specs
router.get('/:id/recommendations', getAIRecommendations);

// @route   GET /api/v1/products/:id/reviews
// @desc    Get all reviews for a product (public)
router.get('/:id/reviews', getProductReviews);

// @route   POST /api/v1/products/:id/reviews
// @desc    Add a review to a product (requires logged-in Customer)
router.post('/:id/reviews', authMiddleware(['CUSTOMER']), addProductReview);

// ======================
// Admin Product CRUD
// ======================

// @route   POST /api/v1/products/admin
// @desc    Create a new product (Admin / Warehouse Manager only)
router.post('/admin', authMiddleware(['WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), createProduct);

// @route   PUT /api/v1/products/admin/:id
// @desc    Update a product (Admin / Warehouse Manager only)
router.put('/admin/:id', authMiddleware(['WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), updateProduct);

// @route   DELETE /api/v1/products/admin/:id
// @desc    Soft-delete (mark unavailable) a product (Admin only)
router.delete('/admin/:id', authMiddleware(['CEO', 'ADMIN']), deleteProduct);

module.exports = router;
