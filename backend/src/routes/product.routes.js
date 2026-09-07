const express = require('express');
const router = express.Router();
const { getProducts, getProductById, getAIRecommendations, getProductReviews, addProductReview, createProduct, updateProduct, updateProductVisibility, deleteProductImage, deleteProduct } = require('../controllers/product.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { uploadProductImage } = require('../middlewares/upload.middleware');

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
router.post('/admin', authMiddleware(['WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), uploadProductImage, createProduct);

// @route   PUT /api/v1/products/admin/:id
// @desc    Update a product (Admin / Warehouse Manager only)
router.put('/admin/:id', authMiddleware(['WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), uploadProductImage, updateProduct);

// @route   PATCH /api/v1/products/admin/:id/visibility
// @desc    Toggle whether a product shows on the storefront — narrower than the full
//          update above, so Sales Manager can also use it without gaining edit rights
//          over price/stock/supplier (those stay Kho/CEO/ADMIN only via the route above).
router.patch('/admin/:id/visibility', authMiddleware(['WAREHOUSE_MANAGER', 'SALES_MANAGER', 'CEO', 'ADMIN']), updateProductVisibility);

// @route   DELETE /api/v1/products/admin/:id/images/:imageId
// @desc    Remove one gallery photo (Admin / Warehouse Manager only)
router.delete('/admin/:id/images/:imageId', authMiddleware(['WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), deleteProductImage);

// @route   DELETE /api/v1/products/admin/:id
// @desc    Soft-delete (mark unavailable) a product (Admin only)
router.delete('/admin/:id', authMiddleware(['CEO', 'ADMIN']), deleteProduct);

module.exports = router;
