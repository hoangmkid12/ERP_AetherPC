// OSRM (Open Source Routing Machine) - dịch vụ chỉ đường đường bộ thực tế miễn phí của OpenStreetMap

export async function fetchRoadRoute(origin, destination) {
  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    return null;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
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
