const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { getSepayPayment, sepayWebhook, listTransferRefunds, completeTransferRefund } = require('../controllers/payment.controller');

const router = express.Router();

// SePay gọi khi tiền vào tài khoản — xác thực bằng "Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>"
router.post('/sepay/webhook', sepayWebhook);

// Thông tin chuyển khoản + trạng thái thanh toán của một đơn (khách chỉ xem được đơn của mình)
router.get('/sepay/orders/:orderId', authMiddleware(['CUSTOMER', 'SALES', 'SALES_MANAGER', 'CSKH', 'ACCOUNTANT']), getSepayPayment);

// Kế toán: các khoản chuyển khoản phải hoàn cho khách (trả thiếu, dư, trùng, vào đơn đã hủy)
router.get('/refunds', authMiddleware(['ACCOUNTANT']), listTransferRefunds);
router.post('/refunds/:id/complete', authMiddleware(['ACCOUNTANT']), completeTransferRefund);

module.exports = router;
