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

const fs = require('fs');
const path = require('path');
const DYNAMIC_SKILLS_PATH = path.join(__dirname, '../services/ai/dynamic_few_shots.json');

// Lấy danh sách kỹ năng huấn luyện SQL động
const getDynamicSkills = async (req, res, next) => {
  try {
    let skills = [];
    if (fs.existsSync(DYNAMIC_SKILLS_PATH)) {
      skills = JSON.parse(fs.readFileSync(DYNAMIC_SKILLS_PATH, 'utf8'));
    }
    res.json({ success: true, data: skills });
  } catch (err) {
    next(err);
  }
};

// Lưu kỹ năng huấn luyện SQL động mới
const saveDynamicSkill = async (req, res, next) => {
  try {
    const { question, sql, description, feedbackId } = req.body || {};
    if (!question || !question.trim() || !sql || !sql.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp cả câu hỏi mẫu và câu lệnh SQL tương ứng.' });
    }

    let skills = [];
    if (fs.existsSync(DYNAMIC_SKILLS_PATH)) {
      skills = JSON.parse(fs.readFileSync(DYNAMIC_SKILLS_PATH, 'utf8'));
    }

    const newSkill = {
      id: 'SKILL-' + Date.now(),
      question: question.trim(),
      sql: sql.trim(),
      description: description?.trim() || 'Kỹ năng do Admin huấn luyện trực tiếp',
      createdBy: req.user?.name || req.user?.fullName || req.user?.email || 'Admin',
      createdAt: new Date().toISOString()
    };

    skills.unshift(newSkill);
    fs.writeFileSync(DYNAMIC_SKILLS_PATH, JSON.stringify(skills, null, 2), 'utf8');

    // Nếu tạo từ một Feedback cụ thể, đánh dấu feedback là APPROVED
    if (feedbackId) {
      await prisma.aiFeedback.updateMany({
        where: { id: feedbackId, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          reviewedById: req.user?.id != null ? String(req.user.id) : null,
          reviewedByName: req.user?.name || req.user?.fullName || null,
          reviewedAt: new Date()
        }
      }).catch(() => {});
    }

    res.json({
      success: true,
      data: newSkill,
      message: 'Đã lưu kỹ năng SQL thành công! AI Copilot sẽ tự động học mẫu truy vấn này.'
    });
  } catch (err) {
    next(err);
  }
};

// Xóa kỹ năng huấn luyện SQL
const deleteDynamicSkill = async (req, res, next) => {
  try {
    const { id } = req.params;
    let skills = [];
    if (fs.existsSync(DYNAMIC_SKILLS_PATH)) {
      skills = JSON.parse(fs.readFileSync(DYNAMIC_SKILLS_PATH, 'utf8'));
    }
    skills = skills.filter(s => s.id !== id);
    fs.writeFileSync(DYNAMIC_SKILLS_PATH, JSON.stringify(skills, null, 2), 'utf8');
    res.json({ success: true, message: 'Đã xóa kỹ năng huấn luyện.' });
  } catch (err) {
    next(err);
  }
};

// Kiểm thử câu lệnh SQL trực tiếp và trả về kết quả thời gian thực
const executeTestSql = async (req, res, next) => {
  try {
    const { sql, question } = req.body || {};
    if (!sql || !sql.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp câu lệnh SQL để kiểm thử.' });
    }

    const { isSafeSqlQuery } = require('../services/ai/universalData.service');
    if (!isSafeSqlQuery(sql)) {
      return res.status(400).json({ success: false, message: 'Câu lệnh SQL không an toàn (chỉ cho phép SELECT đọc dữ liệu).' });
    }

    const currentUserId = Number(req.user?.id) || 0;
    const finalSql = sql.replace(/:userId/g, currentUserId.toString());

    // Thực thi trực tiếp trên PostgreSQL
    const rawData = await prisma.$queryRawUnsafe(finalSql);
    const cleanData = JSON.parse(JSON.stringify(rawData, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    res.json({
      success: true,
      data: {
        rowCount: cleanData.length,
        rows: cleanData.slice(0, 10),
        previewSql: finalSql
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: `Lỗi SQL: ${err.message}` });
  }
};

// Gợi ý câu lệnh SQL thông minh cho câu hỏi dựa trên Gemini NL2SQL & Semantic Rules
const generateSuggestedSql = async (req, res, next) => {
  try {
    const { question } = req.body || {};
    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu câu hỏi cần gợi ý SQL.' });
    }

    const { generateSqlFromQuestion, generateSqlBySemanticPattern } = require('../services/ai/universalData.service');
    let sql = await generateSqlFromQuestion(question.trim(), req.user?.role || 'ADMIN');
    if (!sql) {
      sql = generateSqlBySemanticPattern(question.trim(), req.user?.role || 'ADMIN');
    }

    // Fallback thông minh theo chủ đề câu hỏi thay vì hardcode generic query
    if (!sql) {
      const lower = question.toLowerCase();
      if (/(doanh thu|doanh số|tiền thu|thu được)/.test(lower)) {
        sql = `SELECT SUM(total_amount) AS doanh_thu_nam_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
      } else if (/(tồn kho|hết hàng|sản phẩm)/.test(lower)) {
        sql = `SELECT product_id, name, sku, stock_quantity, price FROM products WHERE stock_quantity > 0 ORDER BY stock_quantity DESC LIMIT 15;`;
      } else {
        sql = `SELECT order_id, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10;`;
      }
    }

    res.json({
      success: true,
      sql
    });
  } catch (err) {
    next(err);
  }
};

// Tự động phân tích lỗi SQL và sửa lại cho đúng theo schema PostgreSQL của AetherPC
const autoFixSql = async (req, res, next) => {
  try {
    const { sql, error, question } = req.body || {};
    if (!sql || !sql.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu câu SQL cần sửa.' });
    }

    let fixedSql = sql.trim();

    // 1. Khắc phục các lỗi cột thông dụng (Common schema column fixes)
    fixedSql = fixedSql.replace(/\bretail_price\b/gi, 'price');
    fixedSql = fixedSql.replace(/\bproduct_name\b/gi, 'name');
    fixedSql = fixedSql.replace(/\bcustomer_name\b/gi, 'name');
    fixedSql = fixedSql.replace(/\bamount\b/gi, 'total_amount');
    fixedSql = fixedSql.replace(/\border_date\b/gi, 'created_at');
    fixedSql = fixedSql.replace(/\bquantity\b/gi, 'stock_quantity');
    fixedSql = fixedSql.replace(/\bstock\b/gi, 'stock_quantity');

    // 2. Nếu có Gemini AI, kết hợp sửa lỗi thông minh theo Error Message
    let GoogleGenAI = null;
    try {
      GoogleGenAI = require('@google/genai').GoogleGenAI;
    } catch (e) {}

    if (GoogleGenAI && process.env.GEMINI_API_KEY) {
      try {
        const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const { ERP_DATABASE_SCHEMA_PROMPT } = require('../services/ai/universalData.service');
        const prompt = `${ERP_DATABASE_SCHEMA_PROMPT}

CÂU LỆNH SQL ĐANG BỊ LỖI KHI CHẠY TRÊN POSTGRESQL:
"${sql}"

THÔNG BÁO LỖI TỪ DATABASE:
"${error || 'Lỗi không xác định'}"

CÂU HỎI GỐC CỦA NGƯỜI DÙNG:
"${question || ''}"

YÊU CẦU:
Hãy sửa lại câu lệnh SQL trên để chạy thành công 100% trên PostgreSQL AetherPC.
CHỈ TRẢ VỀ ĐÚNG 1 CÂU LỆNH SQL DUY NHẤT (không markdown, không giải thích).`;

        const aiGen = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { temperature: 0.05, maxOutputTokens: 300 }
        });
        const aiClean = aiGen.text?.replace(/```sql/gi, '').replace(/```/g, '').trim();
        if (aiClean && aiClean.toUpperCase().startsWith('SELECT')) {
          fixedSql = aiClean;
        }
      } catch (aiErr) {
        console.warn('[AutoFixSql] Gemini error, using rule-based fix:', aiErr.message);
      }
    }

    res.json({
      success: true,
      fixedSql,
      message: 'Đã tự động sửa câu lệnh SQL phù hợp với cấu trúc dữ liệu.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitAiFeedback,
  getPendingAiFeedback,
  reviewAiFeedback,
  getDynamicSkills,
  saveDynamicSkill,
  deleteDynamicSkill,
  executeTestSql,
  generateSuggestedSql,
  autoFixSql
};
