import goongjs from '@goongmaps/goong-js';

// Style/marker helpers dùng chung cho các màn hình bản đồ goong-js
// (DeliveryMap.jsx — quan sát của khách/admin, và DeliveryNavigationModal.jsx
// — điều hướng của chính Shipper) để 2 nơi luôn nhìn giống nhau.

const GOONG_MAPTILES_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOONG_MAPTILES_KEY) || '';

// goong-js tự đính kèm access token vào MỌI request tài nguyên nó gọi (tile,
// sprite, glyph...) khi accessToken được set trước khi tạo Map — không cần
// nhét "?api_key=" thủ công vào từng URL.
if (GOONG_MAPTILES_KEY) {
  goongjs.accessToken = GOONG_MAPTILES_KEY;
}

// Bản đồ nền: dùng style thật của Goong (địa danh/tên đường tiếng Việt chính
// xác, đã cập nhật theo sáp nhập hành chính) khi có Maptiles Key. Chưa cấu
// hình key thì tự lùi về tile raster OpenStreetMap thường (không cần key) qua
// 1 style JSON tối giản, để app vẫn chạy được cho người chưa có key Goong.
export const GOONG_STYLE_URL = GOONG_MAPTILES_KEY
  ? 'https://tiles.goong.io/assets/goong_map_web.json'
  : {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
    };

// Pin kiểu Google Maps (giọt nước, chấm trắng giữa)
const pinSvg = (color) => `<svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.3));">
  <path d="M13 0C5.8 0 0 5.8 0 13c0 9.7 13 23 13 23s13-13.3 13-23C26 5.8 20.2 0 13 0z" fill="${color}"/>
  <circle cx="13" cy="13" r="5" fill="#fff"/>
</svg>`;

// goong-js/MapLibre gắn thẳng 1 DOM element vào từng Marker — không thể tái
// dùng chung 1 node cho nhiều marker như L.icon của Leaflet, nên đây là hàm
// tạo mới mỗi lần gọi.
function createPinElement(color) {
  const el = document.createElement('div');
  el.style.width = '26px';
  el.style.height = '36px';
  el.innerHTML = pinSvg(color);
  return el;
}

export function createWarehouseElement() {
  return createPinElement('#1a73e8');
}

export function createOriginHubElement() {
  return createPinElement('#10b981');
}

export function createGpsOriginElement() {
  return createPinElement('#8b5cf6');
}

export function createDestinationElement() {
  return createPinElement('#ea4335');
}

// Chấm xanh "vị trí trực tiếp" kiểu Google Maps
export function createShipperElement() {
  const el = document.createElement('div');
  el.style.width = '32px';
  el.style.height = '32px';
  el.innerHTML = `<div style="position:relative;width:32px;height:32px;">
    <div style="position:absolute;inset:2px;border-radius:50%;background:rgba(26,115,232,0.18);"></div>
    <div style="position:absolute;inset:7px;border-radius:50%;background:#1a73e8;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:11px;">🛵</div>
  </div>`;
  return el;
}

export { goongjs };
