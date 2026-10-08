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

const groupOfSlug = (slug) => SLUG_GROUP[String(slug || '').toLowerCase()] || null;

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
