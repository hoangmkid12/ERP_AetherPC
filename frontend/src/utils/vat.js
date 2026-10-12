// Thuế GTGT (VAT) — quy ước chung của toàn hệ thống:
// - Giá bán sản phẩm (Product.price, giá trong giỏ / POS) là giá CHƯA thuế.
// - Khi đặt hàng, thuế GTGT 10% được CỘNG THÊM trên (tiền hàng − chiết khấu + phí ship) và lưu ở
//   Order.vatAmount; Order.totalAmount = số tiền khách trả (đã gồm thuế).
// - Đơn cũ trước khi tách VAT có vatAmount = 0: giá trong đơn khi đó đã gồm thuế.
// - Giá vốn (Product.averageCost, bút toán COGS) và đơn giá nhập PO là giá chưa thuế.
// => Doanh thu thuần của mọi đơn (cũ lẫn mới) = totalAmount / 1,1; lợi nhuận = doanh thu thuần − giá vốn.

export const VAT_RATE = 0.1;

/** Thuế GTGT cộng thêm trên số tiền chưa thuế (làm tròn đồng). */
export const vatOnTop = (netAmount) => Math.round((Number(netAmount) || 0) * VAT_RATE);

/** Tách phần chưa thuế từ số tiền khách trả (đã gồm VAT). */
export const netOfVat = (grossAmount) => Math.round((Number(grossAmount) || 0) / (1 + VAT_RATE));

/** Tiền thuế GTGT nằm trong số tiền đã gồm VAT. */
export const vatInGross = (grossAmount) => Math.round(Number(grossAmount) || 0) - netOfVat(grossAmount);

/** Biên lợi nhuận gộp (%) của 1 sản phẩm: (giá bán chưa thuế − giá vốn) / giá bán chưa thuế. */
export const grossMarginPct = (price, unitCost) => {
  const net = Number(price) || 0;
  const cost = Number(unitCost) || 0;
  if (net <= 0 || cost <= 0) return null;
  return ((net - cost) / net) * 100;
};
