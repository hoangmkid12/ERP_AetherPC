const prisma = require('../config/database');
const { logAudit } = require('../utils/auditLog');

const serializePromotion = (p) => ({
  id: p.id,
  code: p.code,
  title: p.title,
  type: p.discountType,
  discount: parseFloat(p.discountValue),
  minSpend: parseFloat(p.minSpend),
  expiry: p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('vi-VN') : null,
  expiresAt: p.expiresAt,
  status: p.status
});

// GET /api/v1/promotions — danh sách khuyến mãi thật, nhân viên Sales dùng để
// áp mã vào POS (ai đứng quầy cũng xem/áp được, chỉ CRUD mới cần quyền quản lý)
const listPromotions = async (req, res, next) => {
  try {
    const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: promotions.map(serializePromotion) });
  } catch (err) { next(err); }
};

// POST /api/v1/promotions — tạo khuyến mãi mới (quyền sales_manage_promotions)
const createPromotion = async (req, res, next) => {
  try {
    const { code, title, type, discount, minSpend, expiresAt } = req.body;
    if (!code || !String(code).trim() || !title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã và tên chương trình khuyến mãi.' });
    }
    const discountType = type === 'FIXED' ? 'FIXED' : 'PERCENT';
    const discountValue = parseFloat(discount);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return res.status(400).json({ success: false, message: 'Mức giảm không hợp lệ.' });
    }
    if (discountType === 'PERCENT' && discountValue > 100) {
      return res.status(400).json({ success: false, message: 'Mức giảm theo % không được vượt quá 100%.' });
    }
    const normalizedCode = String(code).trim().toUpperCase();

    const existing = await prisma.promotion.findUnique({ where: { code: normalizedCode } });
    if (existing) {
      return res.status(400).json({ success: false, message: `Mã "${normalizedCode}" đã tồn tại.` });
    }

    const promo = await prisma.promotion.create({
      data: {
        code: normalizedCode,
        title: String(title).trim(),
        discountType,
        discountValue,
        minSpend: parseFloat(minSpend) || 0,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });
    logAudit({ req, action: 'CREATE_PROMOTION', module: 'Bán Hàng', targetId: promo.id, note: promo.code });
    res.status(201).json({ success: true, data: serializePromotion(promo) });
  } catch (err) { next(err); }
};

// PUT /api/v1/promotions/:id — sửa khuyến mãi (quyền sales_manage_promotions)
const updatePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.promotion.findUnique({ where: { id: parseInt(id, 10) } });
    if (!existing) return res.status(404).json({ success: false, message: `Không tìm thấy khuyến mãi: ${id}` });

    const { title, type, discount, minSpend, expiresAt, status } = req.body;
    const data = {};
    if (title !== undefined) data.title = String(title).trim();
    if (type !== undefined) data.discountType = type === 'FIXED' ? 'FIXED' : 'PERCENT';
    if (discount !== undefined) {
      const discountValue = parseFloat(discount);
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        return res.status(400).json({ success: false, message: 'Mức giảm không hợp lệ.' });
      }
      data.discountValue = discountValue;
    }
    if (minSpend !== undefined) data.minSpend = parseFloat(minSpend) || 0;
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (status !== undefined) data.status = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const promo = await prisma.promotion.update({ where: { id: existing.id }, data });
    logAudit({ req, action: 'UPDATE_PROMOTION', module: 'Bán Hàng', targetId: promo.id, note: promo.code });
    res.json({ success: true, data: serializePromotion(promo) });
  } catch (err) { next(err); }
};

// DELETE /api/v1/promotions/:id — xóa khuyến mãi (quyền sales_manage_promotions)
const deletePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.promotion.findUnique({ where: { id: parseInt(id, 10) } });
    if (!existing) return res.status(404).json({ success: false, message: `Không tìm thấy khuyến mãi: ${id}` });

    await prisma.promotion.delete({ where: { id: existing.id } });
    logAudit({ req, action: 'DELETE_PROMOTION', module: 'Bán Hàng', targetId: existing.id, note: existing.code });
    res.json({ success: true, message: `Đã xóa khuyến mãi "${existing.code}".` });
  } catch (err) { next(err); }
};

module.exports = { listPromotions, createPromotion, updatePromotion, deletePromotion };
