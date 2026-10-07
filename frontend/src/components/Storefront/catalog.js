// Dữ liệu dùng chung cho giao diện storefront: danh mục, khoảng giá, định dạng giá, tóm tắt thông số.
import { Cpu, Gamepad2, CircuitBoard, MemoryStick, HardDrive, PlugZap, Server, Fan, Monitor, Mouse } from 'lucide-react';

// Chỉ các danh mục thật sự có hàng trong CSDL (key khớp mapSlugToCategory ở services/api.js)
export const SF_CATEGORIES = [
  { key: 'VGA', label: 'Card màn hình', short: 'VGA', icon: Gamepad2, tint: '#fee2e2', color: '#dc2626' },
  { key: 'CPU', label: 'CPU - Bộ vi xử lý', short: 'CPU', icon: Cpu, tint: '#dbeafe', color: '#2563eb' },
  { key: 'MAINBOARD', label: 'Bo mạch chủ', short: 'Mainboard', icon: CircuitBoard, tint: '#fef3c7', color: '#d97706' },
  { key: 'RAM', label: 'RAM - Bộ nhớ trong', short: 'RAM', icon: MemoryStick, tint: '#dcfce7', color: '#16a34a' },
  { key: 'STORAGE', label: 'Ổ cứng SSD', short: 'SSD', icon: HardDrive, tint: '#e0f2fe', color: '#0284c7' },
  { key: 'PSU', label: 'Nguồn máy tính', short: 'Nguồn', icon: PlugZap, tint: '#ffedd5', color: '#ea580c' },
  { key: 'CASE', label: 'Vỏ case', short: 'Case', icon: Server, tint: '#f3f4f6', color: '#4b5563' },
  { key: 'COOLER', label: 'Tản nhiệt', short: 'Tản nhiệt', icon: Fan, tint: '#cffafe', color: '#0891b2' },
  { key: 'MONITOR', label: 'Màn hình', short: 'Màn hình', icon: Monitor, tint: '#fce7f3', color: '#db2777' },
  { key: 'MOUSE', label: 'Chuột gaming', short: 'Chuột', icon: Mouse, tint: '#ede9fe', color: '#7c3aed' },
];

export const categoryLabel = (key) => SF_CATEGORIES.find(c => c.key === key)?.label || key;

export const PRICE_RANGES = [
  { key: 'u2', label: 'Dưới 2 triệu', min: 0, max: 2000000 },
  { key: '2-5', label: '2 - 5 triệu', min: 2000000, max: 5000000 },
  { key: '5-10', label: '5 - 10 triệu', min: 5000000, max: 10000000 },
  { key: '10-20', label: '10 - 20 triệu', min: 10000000, max: 20000000 },
  { key: 'o20', label: 'Trên 20 triệu', min: 20000000, max: Infinity },
];

export const SORTS = [
  { key: 'popular', label: 'Nổi bật' },
  { key: 'discount', label: 'Giảm giá nhiều' },
  { key: 'price_asc', label: 'Giá tăng dần' },
  { key: 'price_desc', label: 'Giá giảm dần' },
  { key: 'name_asc', label: 'Tên A - Z' },
];

export function fmtVnd(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}₫`;
}

export function isInStock(p) {
  return (Number(p?.stockQuantity) > 0 || Number(p?.stock) > 0) && !p?.isPreorder;
}

export function discountOf(p) {
  const orig = Number(p?.originalPrice) || 0;
  const price = Number(p?.price) || 0;
  if (orig > price && price > 0) return Math.round((1 - price / orig) * 100);
  return Math.round(Number(p?.discountPercent) || 0);
}

// Vài thông số ngắn hiển thị trên thẻ sản phẩm (bỏ bảo hành, bỏ giá trị quá dài)
const SKIP_SPEC = /bảo_hành|bao_hanh|warranty|tình_trạng|xuất_xứ/;
export function shortSpecs(p, limit = 3) {
  const out = [];
  for (const [k, v] of Object.entries(p?.specs || {})) {
    if (SKIP_SPEC.test(k)) continue;
    const s = Array.isArray(v) ? v.join(', ') : String(v ?? '').trim();
    if (!s || s.length > 18) continue;
    out.push(k === 'cores' ? `${s} nhân` : k === 'threads' ? `${s} luồng` : s);
    if (out.length >= limit) break;
  }
  return out;
}

export const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f3f4f6"/><text x="100" y="108" font-family="Arial" font-size="14" fill="#9ca3af" text-anchor="middle">AetherPC</text></svg>'
);

// Thông tin liên hệ hiển thị thống nhất trên storefront
export const SHOP = {
  hotline: '1800 9999',
  hotlineSales: '0912.888.999',
  email: 'support@aetherpc.vn',
  address: '123 Nguyễn Văn Linh, Q.7, TP.HCM',
};
