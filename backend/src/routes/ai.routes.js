const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  chatWithAi,
  getPromptChips,
  getAiAuditLogs
} = require('../controllers/ai.controller');

// @route   GET /api/v1/ai/prompt-chips
// Lấy danh sách câu hỏi gợi ý nhanh theo vai trò của người dùng
router.get('/prompt-chips', authMiddleware(), getPromptChips);

// @route   POST /api/v1/ai/chat
// Hội thoại với AetherCopilot (Hỗ trợ Tool Calling, đối chiếu Knowledge Base)
router.post('/chat', authMiddleware(), chatWithAi);

// @route   GET /api/v1/ai/audit-logs
// Nhật ký kiểm toán gọi tool của AI (Chỉ Admin / CEO)
router.get('/audit-logs', authMiddleware(['ADMIN', 'CEO']), getAiAuditLogs);

module.exports = router;
