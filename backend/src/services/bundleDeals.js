// "Mua kèm giá sốc": khi mua một sản phẩm chính, các linh kiện đi kèm phù hợp được giảm thêm.
// Máy chủ là nơi quyết định giá — giá gửi lên từ trình duyệt không được tin. Bảng quy tắc này
// có bản sao ở frontend/src/components/Storefront/bundleRules.js để hiển thị; sửa thì sửa cả hai.

// slug danh mục trong CSDL → nhóm sản phẩm
const SLUG_GROUP = {
  cpu: 'CPU', gpu: 'VGA', ram: 'RAM', ram_laptop: 'RAM', ssd: 'STORAGE', hdd: 'STORAGE',
  mainboard: 'MAINBOARD', case: 'CASE', mouse: 'MOUSE', keyboard: 'KEYBOARD', psu: 'PSU',
  cooler: 'COOLER', monitor: 'MONITOR',
};

// Sản phẩm chính → các nhóm linh kiện được mua kèm
const BUNDLE_TARGETS = {
  CPU: ['MAINBOARD', 'COOLER', 'RAM'],
  VGA: ['PSU', 'MONITOR', 'CASE'],
  MAINBOARD: ['RAM', 'STORAGE', 'COOLER'],
  RAM: ['STORAGE', 'MOUSE', 'KEYBOARD'],
  STORAGE: ['RAM', 'MOUSE', 'KEYBOARD'],
  PSU: ['CASE', 'COOLER'],
  CASE: ['PSU', 'COOLER'],
  COOLER: ['CASE', 'PSU'],
  MONITOR: ['MOUSE', 'KEYBOARD'],
  MOUSE: ['KEYBOARD'],
  KEYBOARD: ['MOUSE'],
};

// Mức giảm thêm (%) trên giá bán hiện tại của linh kiện mua kèm
const BUNDLE_PERCENT = {
  MOUSE: 15, KEYBOARD: 15, COOLER: 10, CASE: 10, RAM: 8, STORAGE: 8, PSU: 8, MONITOR: 5, MAINBOARD: 5,
};

// Slug thật trong CSDL là tiếng Việt không dấu ("bo-vi-xu-ly", "card-man-hinh-bak-2", "ram-pc",
// "vo-may-tinh"...), không phải các khóa ngắn của SLUG_GROUP — trước đây tra thẳng SLUG_GROUP nên
// gần như mọi sản phẩm ra null, máy chủ không bao giờ áp giá mua kèm trong khi giỏ hàng vẫn hiển
// thị giá đã giảm (khách thấy một giá ở giỏ, mã QR/hoá đơn lại ra giá khác). Giữ đúng thứ tự so
// khớp của frontend/src/services/api.js → mapSlugToCategory.
const groupOfSlug = (slug) => {
  const s = String(slug || '').toLowerCase();
  if (!s) return null;
  if (SLUG_GROUP[s]) return SLUG_GROUP[s];
  if (s.includes('cpu') || s.includes('bo-vi-xu-ly') || s.includes('xu-ly')) return 'CPU';
  if (s.includes('main') || s.includes('bo-mach-chu')) return 'MAINBOARD';
  if (s.includes('ram')) return 'RAM';
  if (s === 'vga' || s.includes('vga') || s.includes('card')) return 'VGA';
  if (s.includes('psu') || s.includes('nguon')) return 'PSU';
  if (s.includes('ssd') || s.includes('hdd') || s === 'storage' || s.includes('o-cung')) return 'STORAGE';
  if (s.includes('case') || s.includes('vo-may-tinh')) return 'CASE';
  if (s.includes('cooler') || s.includes('tan-nhiet')) return 'COOLER';
  if (s.includes('man-hinh') || s === 'monitor') return 'MONITOR';
  if (s.includes('ban-phim') || s === 'keyboard') return 'KEYBOARD';
  if (s.includes('chuot') || s === 'mouse') return 'MOUSE';
  return null;
};

// % giảm khi mua `accGroup` kèm `mainGroup`; 0 nếu cặp này không có ưu đãi
function bundlePercent(mainGroup, accGroup) {
  if (!mainGroup || !accGroup) return 0;
  if (!(BUNDLE_TARGETS[mainGroup] || []).includes(accGroup)) return 0;
  return BUNDLE_PERCENT[accGroup] || 0;
}

// Giá mua kèm: giảm theo %, làm tròn xuống tới nghìn đồng
function bundlePrice(price, percent) {
  const p = Number(price) || 0;
  if (!percent || p <= 0) return p;
  return Math.max(0, Math.floor((p * (100 - percent)) / 100 / 1000) * 1000);
}

module.exports = { SLUG_GROUP, BUNDLE_TARGETS, BUNDLE_PERCENT, groupOfSlug, bundlePercent, bundlePrice };
