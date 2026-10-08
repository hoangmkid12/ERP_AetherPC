// "Mua kèm giá sốc" — bản sao bảng quy tắc ở backend/src/services/bundleDeals.js (máy chủ mới là nơi
// quyết định giá khi đặt hàng; bản này chỉ để hiển thị). Sửa quy tắc thì sửa cả hai nơi.
import { isInStock } from './catalog';

// Nhóm sản phẩm ở storefront (services/api.js → mapSlugToCategory) dùng chung khóa với máy chủ
export const BUNDLE_TARGETS = {
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

export const BUNDLE_PERCENT = {
  MOUSE: 15, KEYBOARD: 15, COOLER: 10, CASE: 10, RAM: 8, STORAGE: 8, PSU: 8, MONITOR: 5, MAINBOARD: 5,
};

export function bundlePercent(mainCat, accCat) {
  if (!(BUNDLE_TARGETS[mainCat] || []).includes(accCat)) return 0;
  return BUNDLE_PERCENT[accCat] || 0;
}

export function bundlePrice(price, percent) {
  const p = Number(price) || 0;
  if (!percent || p <= 0) return p;
  return Math.max(0, Math.floor((p * (100 - percent)) / 100 / 1000) * 1000);
}

const norm = (v) => String(v ?? '').toUpperCase().replace(/\s+/g, '');
// Socket: lấy từ thông số; thiếu thì suy ra từ chipset trong tên/thông số (vd "B550" → AM4, "B650" → AM5)
const CHIPSET_SOCKET = [
  [/\b(A320|B350|X370|B450|X470|A520|B550|X570)\b/, 'AM4'],
  [/\b(A620|B650E?|X670E?|B840|B850|X870E?)\b/, 'AM5'],
  [/\b(H610|B660|H670|Z690|B760|H770|Z790)\b/, 'LGA1700'],
  [/\b(H810|B860|Z890)\b/, 'LGA1851'],
  [/\b(H410|B460|H470|Z490|H510|B560|H570|Z590)\b/, 'LGA1200'],
];
const socketOf = (p) => {
  const s = norm(p?.specs?.socket);
  if (s) return s;
  const text = `${p?.specs?.chipset || ''} ${p?.name || ''}`.toUpperCase();
  const hit = CHIPSET_SOCKET.find(([re]) => re.test(text));
  return hit ? hit[1] : '';
};
const ramTypeOf = (p) => {
  const t = norm(p?.specs?.ram_type).match(/DDR\d/) || String(p?.name || '').toUpperCase().match(/DDR\d/);
  if (t) return t[0];
  const d = String(p?.name || '').match(/\bD([345])\b/); // tên bo mạch chủ kiểu "H610M-CS D4"
  return d ? `DDR${d[1]}` : '';
};
const coolerSockets = (p) => norm(p?.specs?.['socket_hỗ_trợ']);

// Linh kiện có lắp được với sản phẩm chính không (chỉ xét khi cả hai đều có thông số tương ứng)
function compatible(main, acc) {
  const pair = `${main.category}>${acc.category}`;
  if (pair === 'CPU>MAINBOARD' || pair === 'MAINBOARD>CPU') {
    const a = socketOf(main), b = socketOf(acc);
    return !a || !b || a === b;
  }
  if (pair === 'MAINBOARD>RAM' || pair === 'CPU>RAM') {
    const a = ramTypeOf(main), b = ramTypeOf(acc);
    return !a || !b || a === b;
  }
  if (pair === 'CPU>COOLER' || pair === 'MAINBOARD>COOLER') {
    const a = socketOf(main), list = coolerSockets(acc);
    return !a || !list || list.split(',').includes(a);
  }
  return true;
}

// Chọn tối đa `limit` linh kiện mua kèm: còn hàng, lắp được, mỗi nhóm tối đa 2 món, giá hợp với sản phẩm chính
export function pickBundleItems(main, products, limit = 6) {
  const targets = BUNDLE_TARGETS[main?.category] || [];
  if (!targets.length) return [];
  const mainPrice = Number(main.price) || 0;
  const perGroup = targets.map(cat => products
    .filter(p => p.category === cat && String(p.id) !== String(main.id) && isInStock(p) && Number(p.price) > 0
      && !/laptop|notebook|so-?dimm/i.test(p.name) && compatible(main, p)
      && Number(p.price) <= Math.max(mainPrice * 1.2, 3000000))
    .sort((a, b) => (Number(b.stockQuantity) || 0) - (Number(a.stockQuantity) || 0) || Number(a.price) - Number(b.price))
    .slice(0, 2));
  const out = [];
  for (let i = 0; i < 2 && out.length < limit; i++) {
    for (const g of perGroup) if (g[i] && out.length < limit) out.push(g[i]);
  }
  return out.map(p => {
    const percent = bundlePercent(main.category, p.category);
    return { product: p, percent, price: bundlePrice(p.price, percent) };
  });
}

// Đơn giá thực của một dòng giỏ hàng: dòng mua kèm (selectedSpec.bundleWith) được giá sốc khi sản phẩm
// chính có trong cùng danh sách (mua thường) và số lượng mua kèm không vượt quá số lượng sản phẩm chính.
export function effectiveUnitPrice(item, items) {
  const price = Number(item?.product?.price ?? item?.product?.unitPrice ?? 0);
  const mainId = item?.selectedSpec?.bundleWith;
  if (!mainId) return price;
  const mains = (items || []).filter(it => !it?.selectedSpec?.bundleWith && String(it?.product?.id) === String(mainId));
  const mainQty = mains.reduce((s, it) => s + (parseInt(it.quantity, 10) || 0), 0);
  if (!mains.length || (parseInt(item.quantity, 10) || 1) > mainQty) return price;
  return bundlePrice(price, bundlePercent(mains[0].product.category, item.product.category));
}
