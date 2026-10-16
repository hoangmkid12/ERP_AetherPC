import goongjs from '@goongmaps/goong-js';

// Style/marker helpers dùng chung cho các màn hình bản đồ goong-js
// (DeliveryMap.jsx — quan sát của khách/admin, và DeliveryNavigationModal.jsx
// — điều hướng của chính Shipper) để 2 nơi luôn nhìn giống nhau.

const GOONG_MAPTILES_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOONG_MAPTILES_KEY) || 'qteWdj9oo6cq07oHwt1OmVuivWHRxsKIRlaBRUE5';

if (GOONG_MAPTILES_KEY) {
  goongjs.accessToken = GOONG_MAPTILES_KEY;
}

// Bản đồ dự phòng (CartoDB Voyager): chạy mượt, CDN châu Á cực nhanh, không bao giờ bị chặn hay lỗi trắng màn hình
export const CARTO_VOYAGER_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors, © CARTO'
    }
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }]
};

// Bản đồ nền: ưu tiên style vector của Goong Maps (có sẵn api_key) để hiển thị tên đường và địa danh VN chuẩn xác.
export const GOONG_STYLE_URL = GOONG_MAPTILES_KEY
  ? `https://tiles.goong.io/assets/goong_map_web.json?api_key=${GOONG_MAPTILES_KEY}`
  : CARTO_VOYAGER_STYLE;

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

// Marker định vị Shipper trực tiếp kiểu Google Maps Navigation:
// - Vòng xung phát sóng GPS (Pulse halo)
// - Tia quét radar / hình nón định hướng (Direction beam / flashlight cone)
// - Mũi tên chỉ hướng điều hướng 3D / xe máy xoay 360 độ cực mượt theo cảm biến con quay hồi chuyển điện thoại (DeviceOrientation)
export function createShipperElement({ heading = 0 } = {}) {
  const el = document.createElement('div');
  el.className = 'shipper-puck-wrapper';
  el.style.width = '60px';
  el.style.height = '60px';
  el.style.cursor = 'pointer';
  el.style.userSelect = 'none';

  // Chèn keyframes animation cho vòng xung GPS nếu chưa có
  if (typeof document !== 'undefined' && !document.getElementById('shipper-marker-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'shipper-marker-styles';
    styleEl.textContent = `
      @keyframes shipperGpsPulse {
        0% { transform: scale(0.6); opacity: 0.85; }
        70% { transform: scale(1.55); opacity: 0; }
        100% { transform: scale(1.55); opacity: 0; }
      }
    `;
    document.head.appendChild(styleEl);
  }

  const initialRotate = typeof heading === 'number' && !isNaN(heading) ? heading : 0;

  el.innerHTML = `
    <div style="position:relative;width:60px;height:60px;display:flex;align-items:center;justify-content:center;">
      <!-- Vòng xung sóng GPS lan toả (luôn cố định đồng tâm tại toạ độ thực) -->
      <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(37,99,235,0.22);animation:shipperGpsPulse 2.2s infinite ease-out;pointer-events:none;"></div>

      <!-- Lớp xoay đồng tâm chuẩn xác theo la bàn / hướng di chuyển -->
      <div class="shipper-heading-rotor" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(${initialRotate}deg);transition:transform 0.18s cubic-bezier(0.2, 0, 0.2, 1);transform-origin:30px 30px;pointer-events:none;">
        <!-- Nón sáng chỉ hướng (Conical Flashlight Beam) chiếu từ tâm ra phía trước -->
        <svg width="60" height="60" viewBox="0 0 60 60" style="position:absolute;top:0;left:0;">
          <defs>
            <radialGradient id="shipperBeamGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#2563eb" stop-opacity="0.6"/>
              <stop offset="55%" stop-color="#3b82f6" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <!-- Nón góc 60 độ hướng thẳng lên phía trước (0 deg) -->
          <path d="M30 30 L12 2 A30 30 0 0 1 48 2 Z" fill="url(#shipperBeamGrad)"/>
        </svg>

        <!-- Chấm tròn trung tâm GPS màu xanh dương đậm viền trắng sắc nét + Mũi tên điều hướng tích hợp bên trong -->
        <div style="position:relative;width:26px;height:26px;border-radius:50%;background:#1d4ed8;border:3px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:auto;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#ffffff" style="filter:drop-shadow(0 1px 1px rgba(0,0,0,0.35));">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
      </div>
    </div>
  `;

  return el;
}

// Cập nhật góc quay của Shipper Marker trực tiếp trên DOM mà không cần huỷ/tạo lại Marker
// Giúp đạt tốc độ 60 khung hình/giây cực mượt khi người dùng xoay điện thoại
export function updateShipperElementHeading(element, heading) {
  if (!element || heading == null || isNaN(heading)) return;
  const rotors = element.querySelectorAll('.shipper-heading-rotor');
  rotors.forEach(r => {
    r.style.transform = `rotate(${heading}deg)`;
  });
}

export { goongjs };

