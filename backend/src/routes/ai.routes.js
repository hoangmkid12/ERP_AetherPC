const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  chatWithAi,
  getPromptChips,
  getAiAuditLogs
} = require('../controllers/ai.controller');
const {
  submitAiFeedback,
  getPendingAiFeedback,
  reviewAiFeedback
} = require('../controllers/aiFeedback.controller');

// @route   GET /api/v1/ai/prompt-chips
// Lấy danh sách câu hỏi gợi ý nhanh theo vai trò của người dùng
router.get('/prompt-chips', authMiddleware(), getPromptChips);

// @route   POST /api/v1/ai/chat
// Hội thoại với AetherCopilot (Hỗ trợ Tool Calling, đối chiếu Knowledge Base)
router.post('/chat', authMiddleware(), chatWithAi);

// @route   POST /api/v1/ai/feedback
// Lưu đánh giá của người dùng; phản hồi cần cải thiện sẽ chờ Admin/CEO duyệt
router.post('/feedback', authMiddleware(), submitAiFeedback);

// @route   GET /api/v1/ai/feedback/pending
// Danh sách phản hồi đang chờ duyệt (Chỉ Admin / CEO)
router.get('/feedback/pending', authMiddleware(['ADMIN', 'CEO']), getPendingAiFeedback);

// @route   POST /api/v1/ai/feedback/:id/review
// Duyệt phản hồi và bổ sung nội dung đã hiệu chỉnh vào kho tri thức
router.post('/feedback/:id/review', authMiddleware(['ADMIN', 'CEO']), reviewAiFeedback);

// @route   GET /api/v1/ai/audit-logs
// Nhật ký kiểm toán gọi tool của AI (Chỉ Admin / CEO)
router.get('/audit-logs', authMiddleware(['ADMIN', 'CEO']), getAiAuditLogs);

module.exports = router;
