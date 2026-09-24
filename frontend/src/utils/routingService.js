// OSRM (Open Source Routing Machine) - dịch vụ chỉ đường đường bộ thực tế miễn phí của OpenStreetMap
// Mặc định gọi server demo công khai (không có SLA); trỏ VITE_OSRM_BASE_URL
const OSRM_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OSRM_BASE_URL) || 'https://router.project-osrm.org';

// Goong Maps (rsapi.goong.io) - dịch vụ geocode của Việt Nam, dữ liệu số
// nhà/tên đường/phường-xã (kể cả sau sáp nhập hành chính 2024-2025) chính xác
// hơn hẳn Nominatim/OSM cho địa chỉ VN. Tương thích định dạng Google Maps
// Geocoding API. Cần VITE_GOONG_API_KEY (đăng ký miễn phí tại goong.io) —
// nếu chưa cấu hình, toàn bộ hệ thống tự động dùng lại Nominatim như trước.
const GOONG_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOONG_API_KEY) || '';

export async function fetchRoadRoute(origin, destination) {
  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    return null;
  }

  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      // OSRM trả về [lng, lat], Leaflet cần [lat, lng]
      const coordinates = primaryRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const distanceMeters = Math.round(primaryRoute.distance);
      const distanceKm = (distanceMeters / 1000).toFixed(1);
      const durationMinutes = Math.max(1, Math.round(primaryRoute.duration / 60));

      return {
        coordinates,
        distanceMeters,
        distanceKm,
        durationMinutes,
        summary: `Lộ trình đường bộ: ~${distanceKm} km (ước tính ${durationMinutes} phút)`
      };
    }
  } catch (err) {
    console.warn('Không thể tải tuyến đường OSRM:', err.message);
  }

  // Fallback: nếu OSRM lỗi mạng, trả về đường thẳng với khoảng cách Haversine
  const R = 6371;
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const km = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);

  return {
    coordinates: [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng]
    ],
    distanceMeters: Math.round(km * 1000),
    distanceKm: km,
    durationMinutes: Math.round(km * 3), // ~20km/h trong đô thị
    summary: `Khoảng cách ước tính: ~${km} km`
  };
}

// Lấy mẫu đều các điểm trên lộ trình thực tế để mô phỏng xe máy lăn bánh mượt mà qua các góc cua
export function sampleRoutePoints(coordinates, count = 35) {
  if (!coordinates || coordinates.length === 0) return [];
  if (coordinates.length <= count) return coordinates;

  const sampled = [];
  const total = coordinates.length;
  for (let i = 0; i < count; i++) {
    const idx = Math.min(Math.floor((i / (count - 1)) * (total - 1)), total - 1);
    sampled.push(coordinates[idx]);
  }
  return sampled;
}

// Reverse geocoding qua Nominatim (OpenStreetMap, miễn phí) — hiển thị "đang ở
// đâu" cho vị trí Shipper hiện tại, kiểu Grab. Usage policy của Nominatim giới
// hạn ~1 request/giây; gọi hàm này nên tự throttle ở phía component, không gọi
// theo mỗi lần cập nhật GPS (8s/lần đã đủ thưa nhưng vẫn nên throttle ở caller).
export async function reverseGeocode(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  if (GOONG_API_KEY) {
    try {
      const url = `https://rsapi.goong.io/Geocode?latlng=${lat},${lng}&api_key=${GOONG_API_KEY}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const address = data?.results?.[0]?.formatted_address;
        if (address) return address;
      }
    } catch (err) {
      console.warn('Không thể lấy địa chỉ hiện tại (Goong):', err.message);
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=0`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch (err) {
    console.warn('Không thể lấy địa chỉ hiện tại (Nominatim):', err.message);
    return null;
  }
}

// Từ điển toạ độ dự phòng chính xác cho các đơn vị hành chính trọng điểm & sáp nhập
const ADMIN_FALLBACK_COORDS = [
  { keys: ['tan phuoc', 'phu my'], lat: 10.5502574, lng: 107.0511265, name: 'Phường Tân Phước, Thị xã Phú Mỹ' },
  { keys: ['phu my'], lat: 10.5960, lng: 107.0673, name: 'Thị xã Phú Mỹ' },
  { keys: ['ben nghe'], lat: 10.7713, lng: 106.7058, name: 'Phường Bến Nghé, Quận 1' },
  { keys: ['ben thanh'], lat: 10.7725, lng: 106.6980, name: 'Phường Bến Thành, Quận 1' },
  { keys: ['thu duc'], lat: 10.8494, lng: 106.7717, name: 'TP. Thủ Đức' },
  { keys: ['di an'], lat: 10.9069, lng: 106.7722, name: 'TP. Dĩ An' },
  { keys: ['thuan an'], lat: 10.9238, lng: 106.6974, name: 'TP. Thuận An' },
  { keys: ['thu dau mot'], lat: 10.9804, lng: 106.6519, name: 'TP. Thủ Dầu Một' },
  { keys: ['bien hoa'], lat: 10.9574, lng: 106.8427, name: 'TP. Biên Hòa' },
  { keys: ['vung tau'], lat: 10.3460, lng: 107.0843, name: 'TP. Vũng Tàu' },
  { keys: ['ba ria'], lat: 10.4960, lng: 107.1685, name: 'TP. Bà Rịa' },
  { keys: ['thuy nguyen'], lat: 20.9320, lng: 106.6780, name: 'TP. Thủy Nguyên' },
  { keys: ['quan 1'], lat: 10.7769, lng: 106.7009, name: 'Quận 1, TP.HCM' },
  { keys: ['quan 7'], lat: 10.7411, lng: 106.6989, name: 'Quận 7, TP.HCM' },
  { keys: ['binh thanh'], lat: 10.8012, lng: 106.7114, name: 'Quận Bình Thạnh' },
  { keys: ['cau giay'], lat: 21.0362, lng: 105.7906, name: 'Quận Cầu Giấy, Hà Nội' },
  { keys: ['dong da'], lat: 21.0181, lng: 105.8273, name: 'Quận Đống Đa, Hà Nội' },
  { keys: ['hoan kiem'], lat: 21.0285, lng: 105.8542, name: 'Quận Hoàn Kiếm, Hà Nội' },
  { keys: ['hai chau'], lat: 16.0544, lng: 108.2022, name: 'Quận Hải Châu, Đà Nẵng' },
  { keys: ['ninh kieu'], lat: 10.0342, lng: 105.7876, name: 'Quận Ninh Kiều, Cần Thơ' }
];

// Forward Geocoding thông minh cho địa chỉ Việt Nam (tự động thích ứng cả địa phương 2 cấp và 3 cấp)
const geocodeCache = new Map();

// Gọi 1 query lên Goong Geocoding API — trả {lat,lng,displayName} hoặc null.
async function geocodeQueryGoong(q) {
  if (!GOONG_API_KEY) return null;
  try {
    const url = `https://rsapi.goong.io/geocode?address=${encodeURIComponent(q)}&api_key=${GOONG_API_KEY}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const top = data?.results?.[0];
      const loc = top?.geometry?.location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return { lat: loc.lat, lng: loc.lng, displayName: top.formatted_address || q };
      }
    }
  } catch (err) {
    console.warn('Không thể geocode qua Goong:', err.message);
  }
  return null;
}

// Gọi 1 query lên Nominatim — trả {lat,lng,displayName} hoặc null.
async function geocodeQueryNominatim(q) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=vn&limit=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'AetherPC-ERP/1.0' }
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0 && list[0].lat && list[0].lon) {
        return { lat: parseFloat(list[0].lat), lng: parseFloat(list[0].lon), displayName: list[0].display_name };
      }
    }
  } catch (_) {
    // Tiếp tục fallback query tiếp theo
  }
  return null;
}

export async function forwardGeocode(address) {
  if (!address || typeof address !== 'string') return null;
  const cleanKey = address.trim().toLowerCase();
  if (geocodeCache.has(cleanKey)) return geocodeCache.get(cleanKey);

  // 1. Làm sạch sơ bộ chuỗi địa chỉ — CHỈ bỏ ghi chú/tổ dân phố, GIỮ NGUYÊN số
  // nhà/tên đường. Trước đây hàm này cắt bỏ hẳn "Số ..." khỏi mọi query, khiến
  // không lần tra cứu nào còn đủ chi tiết để định vị đúng nhà — bản đồ vì vậy
  // chỉ hiện tâm phường/xã (không đúng vị trí thực tế).
  const cleanAddr = address
    .replace(/\(Ghi chú:[^)]*\)/gi, '')
    .replace(/\s*\(gồm[^)]*\)/gi, '')
    .replace(/^Tổ\s+\d+[^,]*,/i, '')
    .trim();
  // Biến thể bỏ riêng chữ "Số" (giữ số nhà) — định dạng Nominatim dễ khớp hơn
  const cleanAddrNoSoTu = cleanAddr.replace(/\bSố\s+(?=\d)/gi, '');

  // Tách các thành phần cách nhau bởi dấu phẩy
  const rawParts = cleanAddr.split(',').map(s => s.trim()).filter(Boolean);

  // Bỏ từ định danh hành chính (Phường, Xã, Quận, Huyện, Thị xã, TP...). Ghi
  // chú: buildStandardAddress() (vietnamProvinces.js) ghép nhãn phường/xã
  // chưa rõ loại thành "Phường/Xã Tên" — khớp "Phường/Xã" trước (dài nhất) rồi
  // mới tới từng từ đơn, và cho phép dấu "/" hoặc khoảng trắng sau tiền tố,
  // nếu không "Phường/Xã Thắng Nhất" sẽ chỉ bị cắt nửa vời thành "Phường/Thắng
  // Nhất" (còn sót "Phường/") do "Phường" không có khoảng trắng theo ngay sau.
  const stripPrefix = str => str
    .replace(/\b(Phường\/Xã|Xã\/Phường|Phường|Xã|Thị trấn|Thị xã|Quận|Huyện|Thành phố|Tỉnh|TP\.?)[\s/]+/gi, '')
    .trim();

  const cleanParts = rawParts.map(stripPrefix).filter(Boolean);

  // Xác định các cấp hành chính theo SỐ LƯỢNG phần tử thực tế thay vì luôn coi 3
  // phần tử cuối là Phường/Quận/Tỉnh — địa chỉ "2 cấp" (sau sáp nhập, không còn
  // quận/huyện) chỉ có [Số nhà+đường, Phường/Xã, Tỉnh/TP] = 3 phần tử. Coi nhầm
  // sẽ khiến tên đường bị tra như tên phường ⇒ ra toạ độ sai/nhảy lung tung.
  let street = null, ward = null, district = null, province = null;
  if (cleanParts.length >= 4) {
    province = cleanParts[cleanParts.length - 1];
    district = cleanParts[cleanParts.length - 2];
    ward = cleanParts[cleanParts.length - 3];
    street = cleanParts.slice(0, cleanParts.length - 3).join(', ');
  } else if (cleanParts.length === 3) {
    province = cleanParts[2];
    ward = cleanParts[1];
    street = cleanParts[0];
  } else if (cleanParts.length === 2) {
    province = cleanParts[1];
    ward = cleanParts[0];
  } else if (cleanParts.length === 1) {
    ward = cleanParts[0];
  }

  // Danh sách tỉnh/thành trong vietnamProvinces.js đã gộp theo "siêu tỉnh" sau
  // sáp nhập 2025 (VD nhiều quận/huyện vốn thuộc Bình Dương, Bà Rịa-Vũng Tàu...
  // giờ đều gắn nhãn tỉnh "Thành phố Hồ Chí Minh"), trong khi CSDL bản đồ
  // (Goong/Nominatim) vẫn dùng tên tỉnh THỰC TẾ cũ. Nhét nhãn tỉnh sai vào query
  // có thể khiến geocoder khớp NHẦM sang 1 phường/xã trùng tên ở tỉnh khác hẳn
  // — đã kiểm chứng thực tế: "Thị xã Phú Mỹ, Thành phố Hồ Chí Minh" bị Goong
  // khớp nhầm sang phường Phú Mỹ ở Quận 7 thay vì đúng Thị xã Phú Mỹ, Bà
  // Rịa-Vũng Tàu (cách nhau ~100km), trong khi bỏ hẳn tỉnh ra thì khớp đúng.
  // Quận/huyện/phường-xã tự nó đã đủ đặc trưng để geocoder tự suy ra đúng tỉnh
  // thật, nên luôn thử KHÔNG kèm tỉnh trước, kèm tỉnh sau cùng làm dự phòng.
  const queries = [];

  if (street && ward && district) queries.push(`${street}, ${ward}, ${district}`);
  if (ward && district) queries.push(`${ward}, ${district}`);
  if (street && ward) queries.push(`${street}, ${ward}`);
  if (ward) queries.push(ward);

  // Sau đó mới thử kèm tỉnh/thành — vẫn cần cho các tỉnh KHÔNG bị gộp (tên vẫn
  // đúng thực tế) hoặc khi thiếu quận/huyện (địa chỉ 2 cấp).
  queries.push(rawParts.join(', '));
  queries.push(cleanAddrNoSoTu);
  queries.push(cleanParts.join(', '));
  if (street && ward) {
    queries.push(`${street}, ${ward}, ${district || province}`);
    if (district) queries.push(`${street}, ${ward}, ${province}`);
  }
  if (ward && district) queries.push(`${ward}, ${district}, ${province}`);
  if (ward && province) queries.push(`${ward}, ${province}`);
  if (district && province) queries.push(`${district}, ${province}`);

  queries.push(cleanAddr);

  const uniqueQueries = [...new Set(queries.filter(q => q && q.length > 2))];

  for (const q of uniqueQueries) {
    const result = (await geocodeQueryGoong(q)) || (await geocodeQueryNominatim(q));
    if (result) {
      geocodeCache.set(cleanKey, result);
      return result;
    }
  }

  // Fallback từ điển các đơn vị hành chính sau sáp nhập
  const normAddr = cleanKey.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  for (const item of ADMIN_FALLBACK_COORDS) {
    const allMatch = item.keys.every(k => normAddr.includes(k));
    if (allMatch) {
      const fallbackResult = {
        lat: item.lat,
        lng: item.lng,
        displayName: item.name
      };
      geocodeCache.set(cleanKey, fallbackResult);
      return fallbackResult;
    }
  }

  return null;
}

// ============================================================
// Route Optimization Helpers (Nearest Neighbor + OSRM Table)
// ============================================================

/**
 * Gọi OSRM Table API để lấy ma trận thời gian đi (giây) giữa N điểm.
 * @param {Array<{lat: number, lng: number}>} coords - Index 0 là kho xuất phát
 * @returns {Promise<number[][]>} - Ma trận duration (giây), null nếu lỗi
 */
export async function fetchOsrmTable(coords) {
  if (!coords || coords.length < 2) return null;
  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `${OSRM_BASE_URL}/table/v1/driving/${coordStr}?annotations=duration`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.code === 'Ok' && data.durations) return data.durations;
  } catch (err) {
    console.warn('[routingService] OSRM Table API lỗi:', err.message);
  }
  return null;
}

/**
 * Thuật toán Nearest Neighbor Heuristic chạy hoàn toàn trên Frontend.
 * Dùng làm fallback khi backend không khả dụng.
 * @param {number[][]} matrix - Ma trận duration (giây)
 * @param {number} startIdx - Index điểm xuất phát (kho = 0)
 * @param {number[]} deliveryIndices - Danh sách index các điểm giao hàng
 * @returns {Array<{index: number, durationFromPrev: number}>}
 */
export function nearestNeighborTSP(matrix, startIdx, deliveryIndices) {
  const visited = new Set();
  const route = [];
  let current = startIdx;

  while (route.length < deliveryIndices.length) {
    let nearestIdx = -1;
    let nearestDuration = Infinity;
    for (const idx of deliveryIndices) {
      if (visited.has(idx)) continue;
      const d = matrix[current]?.[idx];
      if (d != null && d < nearestDuration) {
        nearestDuration = d;
        nearestIdx = idx;
      }
    }
    if (nearestIdx === -1) break;
    visited.add(nearestIdx);
    route.push({ index: nearestIdx, durationFromPrev: nearestDuration });
    current = nearestIdx;
  }
  return route;
}

/**
 * Lấy polyline đường bộ qua nhiều điểm dừng (multi-stop route).
 * Gọi OSRM Route API với tất cả waypoints.
 * @param {Array<{lat: number, lng: number}>} waypoints - Danh sách tọa độ theo thứ tự giao
 * @returns {Promise<{coordinates: number[][], totalDistanceKm: string, totalDurationMinutes: number} | null>}
 */
export async function fetchMultiStopRoute(waypoints) {
  if (!waypoints || waypoints.length < 2) return null;
  const coordStr = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.length > 0) {
      const r = data.routes[0];
      return {
        coordinates: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        totalDistanceKm: (r.distance / 1000).toFixed(1),
        totalDurationMinutes: Math.round(r.duration / 60)
      };
    }
  } catch (err) {
    console.warn('[routingService] OSRM multi-stop route lỗi:', err.message);
  }
  return null;
}

/**
 * Tìm kiếm gợi ý địa chỉ (autocomplete) với Nominatim, Photon, Goong & Fallback địa phương.
 * Phục vụ tìm kiếm địa chỉ chính xác, ngõ hẻm, đường phố kèm bản đồ.
 * @param {string} query
 * @returns {Promise<Array<{displayName: string, mainText: string, secondaryText: string, lat: number, lng: number}>>}
 */
export async function searchAddressSuggestions(query) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) return [];
  const q = query.trim();

  // 1. Thử Goong Geocoding nếu có key
  if (GOONG_API_KEY) {
    try {
      const url = `https://rsapi.goong.io/geocode?address=${encodeURIComponent(q)}&api_key=${GOONG_API_KEY}&limit=5`;
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          return data.results.map(r => {
            const parts = (r.formatted_address || '').split(',').map(s => s.trim());
            return {
              displayName: r.formatted_address,
              mainText: parts[0] || q,
              secondaryText: parts.slice(1).join(', '),
              lat: r.geometry.location.lat,
              lng: r.geometry.location.lng,
            };
          });
        }
      }
    } catch (_) {}
  }

  // 2. Thử Nominatim (OpenStreetMap Search)
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=vn&limit=6&addressdetails=1`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'AetherPC-ERP/1.0' }
    });
    clearTimeout(tid);
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        return list.map(item => {
          const parts = (item.display_name || '').split(',').map(s => s.trim());
          const main = item.name || parts[0] || q;
          const sub = parts.filter(p => p !== main).slice(0, 3).join(', ');
          return {
            displayName: item.display_name,
            mainText: main,
            secondaryText: sub || parts.slice(1, 3).join(', '),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          };
        });
      }
    }
  } catch (_) {}

  // 3. Fallback Photon (Komoot OSM - siêu nhanh, không rate limit)
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lat=10.7769&lon=106.7009`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.features) && data.features.length > 0) {
        return data.features.map(f => {
          const p = f.properties || {};
          const coords = f.geometry?.coordinates || [];
          const name = p.name || p.street || q;
          const sub = [p.street, p.district, p.city || p.state, p.country].filter(Boolean).filter(s => s !== name).join(', ');
          const full = [name, sub].filter(Boolean).join(', ');
          return {
            displayName: full || name,
            mainText: name,
            secondaryText: sub,
            lat: coords[1],
            lng: coords[0]
          };
        }).filter(r => typeof r.lat === 'number' && typeof r.lng === 'number');
      }
    }
  } catch (_) {}

  // 4. Fallback danh mục địa bàn phổ biến
  const normalizedQ = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matches = ADMIN_FALLBACK_COORDS.filter(item =>
    item.keys.some(k => normalizedQ.includes(k) || k.includes(normalizedQ))
  );
  if (matches.length > 0) {
    return matches.slice(0, 4).map(m => ({
      displayName: m.name,
      mainText: m.name,
      secondaryText: 'Khu vực phổ biến',
      lat: m.lat,
      lng: m.lng
    }));
  }

  return [];
}

