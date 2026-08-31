const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { handleChat, getCskhSessions, sendCskhCustomerMessage, sendCskhStaffMessage } = require('../controllers/chat.controller');

// @route   POST /api/v1/chat
router.post('/', handleChat);

// CSKH Realtime Sync Endpoints
router.get('/cskh/sessions', authMiddleware(['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), getCskhSessions);
router.post('/cskh/send', authMiddleware(['CUSTOMER', 'CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), sendCskhCustomerMessage);
router.post('/cskh/reply', authMiddleware(['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), sendCskhStaffMessage);

module.exports = router;
