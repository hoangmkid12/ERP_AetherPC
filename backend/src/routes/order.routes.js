const express = require('express');
const router = express.Router();
const {
  createOrder,
  createPosOrder,
  getCustomerOrders,
  updateOrderStatus,
  createReturnRequest,
  shipperPickupReturn,
  shipperDeliverWarehouseReturn,
  qcInspectReturn,
  confirmReturnWarehouse,
  processRefund,
  getReturnRequests,
  updateOrderDetails,
  reviewReturnRequest,
  batchApproveReturns,
  getReturnSettings,
  updateReturnSettings
} = require('../controllers/order.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { getEmailLogs } = require('../services/emailService');
const { QC_ROLES } = require('../constants/roles');

// @route   POST /api/v1/orders
// @desc    Tạo đơn hàng mới (Khách hàng)
router.post('/', authMiddleware(['CUSTOMER']), createOrder);
router.post('/pos', authMiddleware(['SALES', 'SALES_MANAGER', 'CEO', 'ADMIN']), createPosOrder);

// @route   GET /api/v1/orders
// @desc    Lấy danh sách đơn hàng (Khách hàng xem đơn của mình, Nhân viên/Shipper xem danh sách phân công)
router.get('/', authMiddleware(['CUSTOMER', 'DELIVERY', 'SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN', 'CSKH', 'ACCOUNTANT']), getCustomerOrders);

// @route   PATCH /api/v1/orders/:id/status
// @desc    Cập nhật trạng thái đơn hàng (Nhân viên Sale / Kho / Delivery / Admin)
router.patch('/:id/status', authMiddleware(['SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN', 'CSKH', 'DELIVERY']), updateOrderStatus);

// @route   PATCH /api/v1/orders/:id/details
// @desc    Khách hàng tự cập nhật thông tin đơn hàng PENDING
router.patch('/:id/details', authMiddleware(['CUSTOMER']), updateOrderDetails);

// @route   POST /api/v1/orders/:id/return
// @desc    Khách hàng / CSKH gửi Yêu cầu Đổi / Trả / Hoàn tiền
router.post('/:id/return', authMiddleware(['CUSTOMER', 'CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), createReturnRequest);

// @route   GET /api/v1/orders/returns
// @desc    Lấy danh sách các đơn đổi trả (Shipper / QC / Kho / Kế toán / CSKH)
router.get('/returns', authMiddleware(['SALES', 'SALES_MANAGER', 'CEO', 'ADMIN', 'CSKH', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'ACCOUNTANT', 'DELIVERY', ...QC_ROLES]), getReturnRequests);

// @route   GET/PUT /api/v1/orders/returns/settings
// @desc    Lấy & Cập nhật cấu hình Tự Động Duyệt (Auto-Approve) đổi trả
router.get('/returns/settings', authMiddleware(['CSKH', 'SALES', 'SALES_MANAGER', 'CEO', 'ADMIN']), getReturnSettings);
router.put('/returns/settings', authMiddleware(['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), updateReturnSettings);

// @route   POST /api/v1/orders/returns/batch-approve
// @desc    CSKH duyệt tự động tất cả các đơn đổi trả đang PENDING
router.post('/returns/batch-approve', authMiddleware(['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), batchApproveReturns);

// @route   PATCH /api/v1/orders/returns/:id/review & /status
// @desc    CSKH thẩm định & duyệt (APPROVE) hoặc từ chối (REJECT) yêu cầu đổi trả
router.patch('/returns/:id/review', authMiddleware(['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), reviewReturnRequest);
router.patch('/returns/:id/status', authMiddleware(['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN']), reviewReturnRequest);

// @route   PATCH /api/v1/orders/returns/:id/pickup
// @desc    Shipper xác nhận đã lấy hàng thu hồi tại nhà khách
router.patch('/returns/:id/pickup', authMiddleware(['DELIVERY', 'CEO', 'ADMIN', 'CSKH']), shipperPickupReturn);

// @route   PATCH /api/v1/orders/returns/:id/deliver-warehouse
// @desc    Shipper xác nhận đã bàn giao hàng về kho cho QC
router.patch('/returns/:id/deliver-warehouse', authMiddleware(['DELIVERY', 'CEO', 'ADMIN', 'CSKH']), shipperDeliverWarehouseReturn);

// @route   PATCH /api/v1/orders/returns/:id/qc-inspect
// @desc    QC kiểm định chất lượng hàng hoàn trả (Duyệt Hoàn Tiền / Từ Chối)
router.patch('/returns/:id/qc-inspect', authMiddleware([...QC_ROLES, 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), qcInspectReturn);

// @route   PATCH /api/v1/orders/returns/:id/restock
// @desc    Thủ kho xác nhận nhập lại kho bán lẻ/cách ly
router.patch('/returns/:id/restock', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), confirmReturnWarehouse);
router.patch('/:id/return/receive', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN']), confirmReturnWarehouse);

// @route   PATCH /api/v1/orders/returns/:id/refund & POST /:id/return/refund
// @desc    Kế toán giải ngân hoàn tiền & ghi sổ cái
router.patch('/returns/:id/refund', authMiddleware(['ACCOUNTANT', 'CEO', 'ADMIN']), processRefund);
router.post('/:id/return/refund', authMiddleware(['ACCOUNTANT', 'CEO', 'ADMIN']), processRefund);

// @route   GET /api/v1/orders/:id/proof-photo
// @desc    Lấy ảnh minh chứng giao hàng (Công khai để email client như Gmail tải hiển thị)
router.get('/:id/proof-photo', async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = require('../config/database');
    const order = await prisma.order.findUnique({
      where: { orderId: id },
      select: { proofPhoto: true, paymentProofPhoto: true }
    });
    const photo = order?.proofPhoto || order?.paymentProofPhoto;
    if (!photo) {
      return res.status(404).send('Không tìm thấy ảnh minh chứng giao hàng.');
    }
    const raw = photo.trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return res.redirect(raw);
    }
    const matches = raw.match(/^data:image\/(\w+);base64,(.+)$/);
    if (matches) {
      const ext = matches[1].toLowerCase() === 'jpg' ? 'jpeg' : matches[1].toLowerCase();
      const imgBuffer = Buffer.from(matches[2], 'base64');
      res.set('Content-Type', `image/${ext}`);
      res.set('Cache-Control', 'public, max-age=604800, immutable');
      return res.send(imgBuffer);
    }
    return res.status(400).send('Định dạng ảnh không hợp lệ.');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// @route   GET /api/v1/orders/email-logs
// @desc    Xem nhật ký email gửi đơn hàng (CEO / Admin / CSKH)
router.get('/email-logs', authMiddleware(['CEO', 'ADMIN', 'CSKH', 'SALES_MANAGER']), (req, res) => {
  const logs = getEmailLogs();
  res.json({ success: true, data: logs });
});

// @route   POST /api/v1/orders/email-notify
// @desc    Gửi email thông báo đơn hàng / trạng thái / chào mừng cho khách hàng
router.post('/email-notify', authMiddleware(['CUSTOMER', 'SALES', 'SALES_MANAGER', 'CSKH', 'DELIVERY', 'CEO', 'ADMIN']), async (req, res) => {
  try {
    const { type, toEmail, customerName, orderId, items, totalAmount, paymentMethod, shippingAddress, status, note, proofPhoto, proofUrl, receiverNote, deliveredTime } = req.body;
    const { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail, sendWelcomeEmail } = require('../services/emailService');
    
    if (type === 'WELCOME') {
      await sendWelcomeEmail({ toEmail, customerName });
    } else if (type === 'STATUS_UPDATE') {
      await sendOrderStatusUpdateEmail({ 
        toEmail, customerName, orderId, status, note, items, totalAmount,
        proofPhoto: proofPhoto || proofUrl, receiverNote, deliveredTime
      });
    } else {
      await sendOrderConfirmationEmail({ toEmail, customerName, orderId, items, totalAmount, paymentMethod, shippingAddress });
    }
    res.json({ success: true, message: 'Đã gửi email thông báo thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
