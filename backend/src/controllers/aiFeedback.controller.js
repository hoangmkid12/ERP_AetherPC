const prisma = require('../config/database');

const KNOWLEDGE_CATEGORIES = [
  'WARRANTY_RMA',
  'SALES_POLICY',
  'WAREHOUSE_LOGISTICS',
  'TECHNICAL_SOP',
  'ERP_MANUAL',
  'GENERAL'
];

const slugify = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const submitAiFeedback = async (req, res, next) => {
  try {
    const { chatLogId, prompt, response, rating, correction } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim() || typeof response !== 'string' || !response.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu câu hỏi hoặc câu trả lời cần đánh giá.' });
    }
    if (!['HELPFUL', 'NEEDS_IMPROVEMENT'].includes(rating)) {
      return res.status(400).json({ success: false, message: 'Đánh giá không hợp lệ.' });
    }
    if (chatLogId !== undefined && chatLogId !== null && (typeof chatLogId !== 'string' || chatLogId.length > 50)) {
      return res.status(400).json({ success: false, message: 'Mã hội thoại không hợp lệ.' });
    }
    if (prompt.length > 5000 || response.length > 10000 ||
        (correction !== undefined && typeof correction !== 'string') ||
        (typeof correction === 'string' && correction.length > 5000)) {
      return res.status(400).json({ success: false, message: 'Nội dung phản hồi vượt quá giới hạn cho phép.' });
    }

    if (chatLogId) {
      const auditLog = await prisma.aiAuditLog.findUnique({
        where: { id: chatLogId },
        select: { userId: true }
      });
      if (!auditLog || String(auditLog.userId) !== String(req.user?.id)) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy câu trả lời để gửi đánh giá.' });
      }
    }

    const feedback = await prisma.aiFeedback.create({
      data: {
        chatLogId: chatLogId || null,
        userId: req.user?.id != null ? String(req.user.id) : null,
        userName: req.user?.name || req.user?.fullName || req.user?.email || null,
        userRole: req.user?.role || null,
        prompt: prompt.trim(),
        response: response.trim(),
        rating,
        correction: correction?.trim() || null,
        status: rating === 'NEEDS_IMPROVEMENT' ? 'PENDING' : 'RECORDED'
      },
      select: { id: true, status: true }
    });

    res.status(201).json({
      success: true,
      data: feedback,
      message: 'Cảm ơn bạn đã gửi phản hồi cho AetherCopilot.'
    });
  } catch (err) {
    next(err);
  }
};

const getPendingAiFeedback = async (req, res, next) => {
  try {
    const feedback = await prisma.aiFeedback.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 100
    });
    res.json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
};

const reviewAiFeedback = async (req, res, next) => {
  try {
    const { action, title, category, content } = req.body || {};
    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Thao tác duyệt phản hồi không hợp lệ.' });
    }

    const feedback = await prisma.aiFeedback.findUnique({ where: { id: req.params.id } });
    if (!feedback || feedback.status !== 'PENDING') {
      return res.status(404).json({ success: false, message: 'Phản hồi không tồn tại hoặc đã được xử lý.' });
    }

    if (action === 'REJECT') {
      const updated = await prisma.aiFeedback.updateMany({
        where: { id: feedback.id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewedById: req.user?.id != null ? String(req.user.id) : null,
          reviewedByName: req.user?.name || req.user?.fullName || req.user?.email || null,
          reviewedAt: new Date()
        },
      });
      if (updated.count === 0) {
        return res.status(409).json({ success: false, message: 'Phản hồi đã được người khác xử lý.' });
      }
      return res.json({
        success: true,
        data: { id: feedback.id, status: 'REJECTED' },
        message: 'Đã từ chối phản hồi.'
      });
    }

    if (typeof title !== 'string' || !title.trim() ||
        typeof content !== 'string' || !content.trim() ||
        !KNOWLEDGE_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: 'Khi duyệt, cần nhập tiêu đề, nội dung và chuyên mục hợp lệ.' });
    }
    if (title.trim().length > 255 || content.trim().length > 20000) {
      return res.status(400).json({ success: false, message: 'Tiêu đề hoặc nội dung tài liệu vượt quá giới hạn.' });
    }

    const reviewedById = req.user?.id != null ? String(req.user.id) : null;
    const reviewedByName = req.user?.name || req.user?.fullName || req.user?.email || null;
    const result = await prisma.$transaction(async (tx) => {
      const claimedFeedback = await tx.aiFeedback.updateMany({
        where: { id: feedback.id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          reviewedById,
          reviewedByName,
          reviewedAt: new Date()
        }
      });
      if (claimedFeedback.count === 0) {
        return null;
      }

      const baseSlug = (slugify(title) || `ai-feedback-${feedback.id.slice(0, 8)}`).slice(0, 246);
      let slug = baseSlug;
      if (await tx.knowledgeDocument.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${feedback.id.slice(0, 8)}`;
      }

      const knowledgeDocument = await tx.knowledgeDocument.create({
        data: {
          title: title.trim(),
          slug,
          category,
          summary: `Được đề xuất từ câu hỏi: ${feedback.prompt.slice(0, 900)}`,
          content: content.trim(),
          tags: [],
          allowedRoles: ['ALL'],
          status: 'PUBLISHED',
          authorId: req.user?.id != null && Number.isSafeInteger(Number(req.user.id))
            ? Number(req.user.id)
            : null,
          authorName: reviewedByName || 'Quản trị viên'
        },
        select: { id: true, title: true, slug: true, status: true }
      });

      await tx.aiFeedback.update({
        where: { id: feedback.id },
        data: { knowledgeDocumentId: knowledgeDocument.id }
      });

      return {
        feedback: { id: feedback.id, status: 'APPROVED' },
        knowledgeDocument
      };
    });

    if (!result) {
      return res.status(409).json({ success: false, message: 'Phản hồi đã được người khác xử lý.' });
    }
    res.json({
      success: true,
      data: result,
      message: 'Đã duyệt và bổ sung nội dung vào kho tri thức.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitAiFeedback,
  getPendingAiFeedback,
  reviewAiFeedback
};
