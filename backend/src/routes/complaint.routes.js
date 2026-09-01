const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { getComplaints, createComplaint, updateComplaint, deleteComplaint } = require('../controllers/complaint.controller');

// @route   GET /api/v1/complaints
router.get('/', authMiddleware(['CUSTOMER', 'CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), getComplaints);

// @route   POST /api/v1/complaints
router.post('/', authMiddleware(['CUSTOMER', 'CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), createComplaint);

// @route   PUT /api/v1/complaints/:id
router.put('/:id', authMiddleware(['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), updateComplaint);

// @route   DELETE /api/v1/complaints/:id
router.delete('/:id', authMiddleware(['CSKH', 'CEO', 'ADMIN']), deleteComplaint);

module.exports = router;
