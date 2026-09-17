const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth.middleware');
const { handleChat, getCskhSessions, sendCskhCustomerMessage, sendCskhStaffMessage } = require('../controllers/chat.controller');

// @route   POST /api/v1/chat
// optionalAuthMiddleware: chatbot vẫn trả lời được cho khách vãng lai chưa
// đăng nhập (req.user = null), nhưng nếu có JWT hợp lệ (khách đã đăng nhập)
// thì req.user sẽ có sẵn để tra cứu đơn hàng/hạng thành viên CỦA ĐÚNG khách
// đó (order_status, member_tier) — không bắt buộc đăng nhập mới chat được.
router.post('/', optionalAuthMiddleware, handleChat);

// CSKH Realtime Sync Endpoints
router.get('/cskh/sessions', authMiddleware(['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), getCskhSessions);
// DELIVERY được phép gửi vào đây để dùng nút "Báo CSKH" ở app Shipper (tạo 1
// phiên chat mới, hiện ngay lập tức trong danh sách phiên của nhân viên CSKH
// đang trực — cùng cơ chế 1 khách hàng vãng lai chủ động chat vào).
router.post('/cskh/send', authMiddleware(['CUSTOMER', 'DELIVERY', 'CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), sendCskhCustomerMessage);
router.post('/cskh/reply', authMiddleware(['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), sendCskhStaffMessage);

module.exports = router;
