// Thuế GTGT (VAT) — quy ước chung của toàn hệ thống:
// - Giá bán niêm yết, giá trong giỏ hàng và Order.totalAmount ĐÃ GỒM VAT 10% (giá khách trả).
// - Giá vốn (Product.averageCost, bút toán COGS) và đơn giá nhập PO là giá CHƯA VAT (VAT đầu vào
//   được khấu trừ, không tính vào giá vốn — theo VAS 02).
// => Lợi nhuận phải so DOANH THU THUẦN (chưa VAT) với giá vốn, không so tổng tiền khách trả.

export const VAT_RATE = 0.1;

/** Tách phần chưa thuế từ số tiền đã gồm VAT (làm tròn đồng). */
export const netOfVat = (grossAmount) => Math.round((Number(grossAmount) || 0) / (1 + VAT_RATE));

/** Tiền thuế GTGT nằm trong số tiền đã gồm VAT. */
export const vatInGross = (grossAmount) => Math.round(Number(grossAmount) || 0) - netOfVat(grossAmount);

/** Biên lợi nhuận gộp (%) của 1 sản phẩm: (giá bán chưa VAT − giá vốn) / giá bán chưa VAT. */
export const grossMarginPct = (grossPrice, unitCost) => {
  const net = netOfVat(grossPrice);
  const cost = Number(unitCost) || 0;
  if (net <= 0 || cost <= 0) return null;
  return ((net - cost) / net) * 100;
};
