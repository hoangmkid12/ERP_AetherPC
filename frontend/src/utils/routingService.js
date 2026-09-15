// OSRM (Open Source Routing Machine) - dịch vụ chỉ đường đường bộ thực tế miễn phí của OpenStreetMap
// Mặc định gọi server demo công khai (không có SLA); trỏ VITE_OSRM_BASE_URL
// sang instance tự host (xem thư mục osrm/) để có routing ổn định hơn.
const OSRM_BASE_URL = import.meta.env.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org';

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
