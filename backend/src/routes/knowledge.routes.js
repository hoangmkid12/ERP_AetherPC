const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  getKnowledgeDocuments,
  getKnowledgeDocument,
  createKnowledgeDocument,
  updateKnowledgeDocument,
  deleteKnowledgeDocument,
  seedSampleKnowledge
} = require('../controllers/knowledge.controller');

// @route   GET /api/v1/knowledge
// Tra cứu danh sách tài liệu tri thức (Toàn bộ nhân viên có tài khoản đều được truy cập theo quyền)
router.get('/', authMiddleware(), getKnowledgeDocuments);

// @route   POST /api/v1/knowledge/seed-samples
// Khởi tạo các tài liệu mẫu quy chuẩn AetherPC (Chỉ Admin / CEO)
router.post('/seed-samples', authMiddleware(['ADMIN', 'CEO']), seedSampleKnowledge);

// @route   GET /api/v1/knowledge/:idOrSlug
// Chi tiết một tài liệu tri thức
router.get('/:idOrSlug', authMiddleware(), getKnowledgeDocument);

// @route   POST /api/v1/knowledge
// Tạo tài liệu tri thức mới (Chỉ Admin / CEO)
router.post('/', authMiddleware(['ADMIN', 'CEO']), createKnowledgeDocument);

// @route   PUT /api/v1/knowledge/:id
// Cập nhật tài liệu tri thức (Chỉ Admin / CEO)
router.put('/:id', authMiddleware(['ADMIN', 'CEO']), updateKnowledgeDocument);

// @route   DELETE /api/v1/knowledge/:id
// Xóa tài liệu tri thức (Chỉ Admin / CEO)
router.delete('/:id', authMiddleware(['ADMIN', 'CEO']), deleteKnowledgeDocument);

module.exports = router;
