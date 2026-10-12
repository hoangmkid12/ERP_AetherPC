// Thuế GTGT (VAT) — quy ước chung của toàn hệ thống (bán lẻ cho người tiêu dùng):
// - Giá niêm yết (Product.price, giá trong giỏ / POS) ĐÃ GỒM VAT 10% — khách trả đúng giá hiển thị.
// - Order.totalAmount = số tiền khách trả (đã gồm thuế); Order.vatAmount = phần thuế nằm trong đó.
// - Giá vốn (Product.averageCost, bút toán COGS) và đơn giá nhập PO là giá CHƯA VAT (VAT đầu vào
//   được khấu trừ, không tính vào giá vốn — VAS 02).
// => Doanh thu thuần = giá / 1,1; lợi nhuận gộp = doanh thu thuần − giá vốn.

export const VAT_RATE = 0.1;

/** Phần chưa thuế của số tiền đã gồm VAT (làm tròn đồng). */
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

/** Lãi gộp trên 1 sản phẩm = giá bán chưa VAT − giá vốn. */
export const grossProfitPerUnit = (grossPrice, unitCost) => netOfVat(grossPrice) - (Number(unitCost) || 0);
