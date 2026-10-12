const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { STAFF_ROLES } = require('../constants/roles');

// AetherCopilot là trợ lý NỘI BỘ: chỉ tài khoản nhân viên được dùng. Trước đây
// các route này dùng authMiddleware() không giới hạn vai trò, nên tài khoản
// khách hàng / nhà cung cấp cũng gọi được và hỏi ra dữ liệu nội bộ.
const AI_STAFF = authMiddleware(STAFF_ROLES);

// Mỗi câu hỏi có thể gọi Gemini nhiều lần + chạy SQL — giới hạn theo người dùng
// để tránh lạm dụng chi phí / tải DB.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `ai-chat:${req.user?.role || 'anon'}:${req.user?.id || 'anon'}`,
  message: { success: false, message: 'Bạn hỏi trợ lý AI quá nhanh, vui lòng thử lại sau ít phút.' }
});
const {
  chatWithAi,
  getPromptChips,
  getAiAuditLogs,
  getAiStats
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
router.get('/prompt-chips', AI_STAFF, getPromptChips);

// @route   POST /api/v1/ai/chat
// Hội thoại với AetherCopilot (Hỗ trợ Tool Calling, đối chiếu Knowledge Base)
router.post('/chat', AI_STAFF, chatLimiter, chatWithAi);

// @route   POST /api/v1/ai/feedback
// Lưu đánh giá của người dùng; phản hồi cần cải thiện sẽ chờ Admin/CEO duyệt
router.post('/feedback', AI_STAFF, submitAiFeedback);

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

// @route   POST /api/v1/ai/fix-sql
// AI tự động sửa lỗi SQL dựa trên schema và thông báo lỗi database
const { autoFixSql, explainSql, generateSmartTemplate, evaluateSqlRewardApi, getPseudoSamplesApi } = require('../controllers/aiFeedback.controller');
router.post('/fix-sql', authMiddleware(['ADMIN', 'CEO']), autoFixSql);

// @route   POST /api/v1/ai/evaluate-sql-reward
// Thẩm định phần thưởng kiểm chứng RLVR (Verifiable Reward Evaluation) cho câu lệnh SQL
router.post('/evaluate-sql-reward', authMiddleware(['ADMIN', 'CEO']), evaluateSqlRewardApi);

// @route   GET /api/v1/ai/pseudo-memory
// Lấy danh sách mẫu câu hỏi AI tự học qua tương tác nhân viên (Pseudo-Labeling Memory)
router.get('/pseudo-memory', authMiddleware(['ADMIN', 'CEO']), getPseudoSamplesApi);

// @route   POST /api/v1/ai/explain-sql
// Dịch câu lệnh SQL sang Tiếng Việt nghiệp vụ dễ hiểu
router.post('/explain-sql', authMiddleware(['ADMIN', 'CEO']), explainSql);

// @route   POST /api/v1/ai/generate-template
// Tự động sinh mẫu câu trả lời và gợi ý câu hỏi đào sâu
router.post('/generate-template', authMiddleware(['ADMIN', 'CEO']), generateSmartTemplate);

// @route   GET /api/v1/ai/audit-logs
// Nhật ký kiểm toán gọi tool của AI (Chỉ Admin / CEO)
router.get('/audit-logs', authMiddleware(['ADMIN', 'CEO']), getAiAuditLogs);

// @route   GET /api/v1/ai/stats
// Thống kê hiệu năng cache, độ trễ và số lượt truy vấn (Chỉ Admin / CEO)
router.get('/stats', authMiddleware(['ADMIN', 'CEO']), getAiStats);

// @route   POST /api/v1/ai/session/clear
// Làm mới phiên hội thoại và bộ nhớ đệm AI
const { clearAiSession } = require('../controllers/ai.controller');
router.post('/session/clear', AI_STAFF, clearAiSession);

module.exports = router;
