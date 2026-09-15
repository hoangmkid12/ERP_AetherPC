import L from 'leaflet';

// Icon/tile bản đồ dùng chung cho mọi màn hình Leaflet trong app (DeliveryMap.jsx
// — quan sát của khách/admin, và DeliveryNavigationModal.jsx — điều hướng của
// chính Shipper) để 2 nơi luôn nhìn giống nhau thay vì mỗi nơi tự vẽ marker
// kiểu emoji-trong-vòng-tròn riêng như trước.

// Nền bản đồ OpenStreetMap chuẩn — hiển thị đầy đủ tên đường phố, ngõ hẻm, công trình
export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const TILE_MAX_ZOOM = 19;

// Pin kiểu Google Maps (giọt nước, chấm trắng giữa) — gọn và quen mắt hơn
// vòng tròn emoji to bản trước đây.
export const pinIcon = (color) => L.divIcon({
  className: 'aetherpc-pin-marker',
  html: `<svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3));">
    <path d="M13 0C5.8 0 0 5.8 0 13c0 9.7 13 23 13 23s13-13.3 13-23C26 5.8 20.2 0 13 0z" fill="${color}"/>
    <circle cx="13" cy="13" r="5" fill="#fff"/>
  </svg>`,
  iconSize: [26, 36],
  iconAnchor: [13, 36],
  popupAnchor: [0, -32]
});

export const WAREHOUSE_ICON = pinIcon('#1a73e8');
export const DESTINATION_ICON = pinIcon('#ea4335');

// Chấm xanh "vị trí trực tiếp" kiểu Google Maps thay vì vòng tròn emoji lớn.
export const SHIPPER_ICON = L.divIcon({
  className: 'aetherpc-shipper-marker',
  html: `<div style="position:relative;width:32px;height:32px;">
    <div style="position:absolute;inset:2px;border-radius:50%;background:rgba(26,115,232,0.18);"></div>
    <div style="position:absolute;inset:7px;border-radius:50%;background:#1a73e8;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:11px;">🛵</div>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});
