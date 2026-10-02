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
  reviewAiFeedback,
  getDynamicSkills,
  saveDynamicSkill,
  deleteDynamicSkill,
  executeTestSql,
  generateSuggestedSql
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

// @route   GET /api/v1/ai/dynamic-skills
// Lấy danh sách kỹ năng huấn luyện SQL động
router.get('/dynamic-skills', authMiddleware(['ADMIN', 'CEO']), getDynamicSkills);

// @route   POST /api/v1/ai/dynamic-skills
// Lưu kỹ năng huấn luyện SQL mới
router.post('/dynamic-skills', authMiddleware(['ADMIN', 'CEO']), saveDynamicSkill);

// @route   DELETE /api/v1/ai/dynamic-skills/:id
// Xóa kỹ năng huấn luyện SQL
router.delete('/dynamic-skills/:id', authMiddleware(['ADMIN', 'CEO']), deleteDynamicSkill);

// @route   POST /api/v1/ai/test-sql
// Thực thi kiểm thử câu lệnh SQL trong modal training
router.post('/test-sql', authMiddleware(['ADMIN', 'CEO']), executeTestSql);

// @route   POST /api/v1/ai/suggest-sql
// AI tự động gợi ý câu lệnh SQL chuẩn xác cho câu hỏi trong modal training
router.post('/suggest-sql', authMiddleware(['ADMIN', 'CEO']), generateSuggestedSql);

// @route   GET /api/v1/ai/audit-logs
// Nhật ký kiểm toán gọi tool của AI (Chỉ Admin / CEO)
router.get('/audit-logs', authMiddleware(['ADMIN', 'CEO']), getAiAuditLogs);

module.exports = router;
