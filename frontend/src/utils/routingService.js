// OSRM (Open Source Routing Machine) - dịch vụ chỉ đường đường bộ thực tế miễn phí của OpenStreetMap
// Mặc định gọi server demo công khai (không có SLA); trỏ VITE_OSRM_BASE_URL
const OSRM_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OSRM_BASE_URL) || 'https://router.project-osrm.org';

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

export async function forwardGeocode(address) {
  if (!address || typeof address !== 'string') return null;
  const cleanKey = address.trim().toLowerCase();
  if (geocodeCache.has(cleanKey)) return geocodeCache.get(cleanKey);

  // 1. Làm sạch sơ bộ chuỗi địa chỉ
  const cleanAddr = address
    .replace(/\(Ghi chú:[^)]*\)/gi, '')
    .replace(/\s*\(gồm[^)]*\)/gi, '')
    .replace(/^Tổ\s+\d+[^,]*,/i, '')
    .replace(/^Số\s+[^,]*,/i, '')
    .trim();

  // Tách các thành phần cách nhau bởi dấu phẩy
  const rawParts = cleanAddr.split(',').map(s => s.trim()).filter(Boolean);

  // Bỏ từ định danh hành chính (Phường, Xã, Quận, Huyện, Thị xã, TP...)
  const stripPrefix = str => str
    .replace(/\b(Phường|Xã|Thị trấn|Thị xã|Quận|Huyện|Thành phố|Tỉnh|TP\.?)\s+/gi, '')
    .trim();

  const cleanParts = rawParts.map(stripPrefix).filter(Boolean);

  const queries = [];

  if (cleanParts.length >= 3) {
    // Trường hợp 3 cấp: [Phường/Xã], [Quận/Huyện], [Tỉnh/TP]
    const ward = cleanParts[cleanParts.length - 3];
    const district = cleanParts[cleanParts.length - 2];
    const province = cleanParts[cleanParts.length - 1];

    queries.push(`${ward}, ${district}`);               // Thử 1: "Tân Phước, Phú Mỹ" (chuẩn nhất OSM)
    queries.push(`${ward}, ${province}`);               // Thử 2: "Bến Nghé, Hồ Chí Minh"
    queries.push(`${ward}, ${district}, ${province}`);   // Thử 3: Đầy đủ 3 cấp không tiền tố
    queries.push(`${district}, ${province}`);           // Thử 4: "Phú Mỹ, Hồ Chí Minh"
  } else if (cleanParts.length === 2) {
    // Trường hợp 2 cấp: [Phường/Xã], [Tỉnh/TP]
    const wardOrDist = cleanParts[0];
    const province = cleanParts[1];

    queries.push(`${wardOrDist}, ${province}`);         // Thử 1: "Bến Nghé, Hồ Chí Minh"
    queries.push(wardOrDist);                           // Thử 2: Tên xã/phường
  }

  // Thử thêm chuỗi đã bỏ tiền tố và chuỗi nguyên bản
  if (cleanParts.length > 0) {
    queries.push(cleanParts.join(', '));
  }
  queries.push(cleanAddr);

  const uniqueQueries = [...new Set(queries.filter(q => q && q.length > 2))];

  for (const q of uniqueQueries) {
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
          const result = {
            lat: parseFloat(list[0].lat),
            lng: parseFloat(list[0].lon),
            displayName: list[0].display_name
          };
          geocodeCache.set(cleanKey, result);
          return result;
        }
      }
    } catch (_) {
      // Tiếp tục fallback query tiếp theo
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

