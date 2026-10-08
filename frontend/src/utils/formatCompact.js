// Số tiền rút gọn cho khung chỉ số (vd 68.255.382.800 → "68,26 tỷ ₫"), giữ cùng cỡ chữ với các
// con số khác trong hàng. Số đầy đủ nên đặt ở thuộc tính title để rê chuột vẫn xem được.
export function formatCompactVnd(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const fmt = (x) => x.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  if (abs >= 1e9) return `${fmt(n / 1e9)} tỷ ₫`;
  if (abs >= 1e6) return `${fmt(n / 1e6)} tr ₫`;
  return `${Math.round(n).toLocaleString('vi-VN')} ₫`;
}
