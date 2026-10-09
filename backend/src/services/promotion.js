// Tính tiền giảm của mã khuyến mãi ở máy chủ — giá trị duy nhất được tin cậy khi tạo đơn.
// Trình duyệt chỉ gửi MÃ; số tiền giảm luôn tính lại từ bảng promotions.

const isUsable = (p, now = new Date()) =>
  p && p.status === 'ACTIVE' && (!p.expiresAt || new Date(p.expiresAt) >= now);

const discountOf = (p, subtotal) => {
  const base = Math.max(0, Number(subtotal) || 0);
  if (base < Number(p.minSpend || 0)) return 0;
  const value = Number(p.discountValue) || 0;
  const raw = p.discountType === 'FIXED' ? value : (base * value) / 100;
  return Math.min(base, Math.round(raw));
};

// Trả về { promotion, discount }. Mã sai, hết hạn hoặc chưa đủ giá trị tối thiểu → lỗi 400 có thông báo cụ thể.
async function resolvePromotion(db, code, subtotal) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return { promotion: null, discount: 0 };
  const promotion = await db.promotion.findUnique({ where: { code: clean } });
  const fail = (message) => Object.assign(new Error(message), { statusCode: 400 });
  if (!isUsable(promotion)) throw fail(`Mã giảm giá ${clean} không tồn tại hoặc đã hết hạn.`);
  if (Number(subtotal) < Number(promotion.minSpend || 0)) {
    throw fail(`Mã ${clean} chỉ áp dụng cho đơn từ ${Number(promotion.minSpend).toLocaleString('vi-VN')}đ.`);
  }
  return { promotion, discount: discountOf(promotion, subtotal) };
}

module.exports = { isUsable, discountOf, resolvePromotion };
