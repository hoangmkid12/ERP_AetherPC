/**
 * Route Optimizer Controller
 * Tối ưu lộ trình giao hàng cho Shipper sử dụng:
 *   1. OSRM Table API — lấy duration matrix (thời gian đi thực tế giữa các điểm)
 *   2. Nearest Neighbor Heuristic — sắp xếp thứ tự giao hàng tối ưu
 */

const prisma = require('../config/database');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

// ---- Geocode địa chỉ văn bản → {lat, lng} bằng Nominatim (free, no key) ----
async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=vn&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AetherPC-ERP/1.0 (contact@aetherpc.vn)' },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const list = await res.json();
    if (Array.isArray(list) && list.length > 0 && list[0].lat && list[0].lon) {
      return { lat: parseFloat(list[0].lat), lng: parseFloat(list[0].lon) };
    }
  } catch (_) { /* ignore */ }
  return null;
}

// ---- Gọi OSRM Table API: lấy ma trận thời gian (giây) giữa N điểm ----
async function fetchOsrmDurationMatrix(coords) {
  // coords: [{lat, lng}] — index 0 là kho xuất phát
  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `${OSRM_BASE_URL}/table/v1/driving/${coordStr}?annotations=duration`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    if (data.code === 'Ok' && data.durations) return data.durations;
  } catch (err) {
    console.warn('[RouteOptimizer] OSRM Table API lỗi:', err.message);
  }
  // Fallback: dùng khoảng cách Haversine (giây ước tính)
  return buildHaversineMatrix(coords);
}

// ---- Fallback: ma trận Haversine khi OSRM không khả dụng ----
function buildHaversineMatrix(coords) {
  const n = coords.length;
  const R = 6371;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const a = coords[i], b = coords[j];
      const dLat = (b.lat - a.lat) * Math.PI / 180;
      const dLng = (b.lng - a.lng) * Math.PI / 180;
      const sinLat = Math.sin(dLat / 2);
      const sinLng = Math.sin(dLng / 2);
      const hav = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
      const km = R * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
      matrix[i][j] = Math.round((km / 20) * 3600); // 20 km/h đô thị → giây
    }
  }
  return matrix;
}

// ---- Thuật toán Nearest Neighbor Heuristic ----
// startIdx: index của điểm xuất phát (kho), deliveryIndices: [1..n-1]
function nearestNeighborTSP(matrix, startIdx, deliveryIndices) {
  const visited = new Set();
  const route = [];
  let current = startIdx;

  while (route.length < deliveryIndices.length) {
    let nearestIdx = -1;
    let nearestDuration = Infinity;
    for (const idx of deliveryIndices) {
      if (visited.has(idx)) continue;
      const d = matrix[current][idx];
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

// ---- Handler chính: POST /api/v1/routes/optimize ----
exports.optimizeRoute = async (req, res) => {
  try {
    const { orderIds, originLat, originLng } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu danh sách đơn hàng (orderIds).' });
    }
    if (orderIds.length < 2) {
      return res.status(400).json({ success: false, message: 'Cần ít nhất 2 đơn hàng để tối ưu lộ trình.' });
    }

    // 1. Lấy thông tin đơn hàng từ DB
    const orders = await prisma.order.findMany({
      where: { orderId: { in: orderIds } },
      select: {
        orderId: true,
        shippingAddress: true,
        customerName: true,
        totalAmount: true,
        paymentMethod: true,
      }
    });

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng nào.' });
    }

    // 2. Điểm xuất phát: dùng GPS thực tế của Shipper nếu được cung cấp,
    //    fallback về tọa độ Kho AetherPC mặc định (Quận 1, TP.HCM)
    const usingGps = typeof originLat === 'number' && typeof originLng === 'number';
    const warehouseCoord = usingGps
      ? { lat: originLat, lng: originLng, name: '📍 Vị trí hiện tại của bạn' }
      : { lat: 10.7769, lng: 106.7009, name: 'Kho AetherPC' };

    console.log(`[RouteOptimizer] Điểm xuất phát: ${warehouseCoord.name} (${warehouseCoord.lat}, ${warehouseCoord.lng})`);

    // 3. Geocode tọa độ từng đơn bằng Nominatim
    const orderCoords = await Promise.all(
      orders.map(async (ord) => {
        const geo = await geocodeAddress(ord.shippingAddress);
        return geo || warehouseCoord; // nếu geocode thất bại, côi như ở kho
      })
    );

    // 4. Xây dựng mảng tọa độ: [kho, đơn1, đơn2, ...]
    const allCoords = [warehouseCoord, ...orderCoords];
    const deliveryIndices = orders.map((_, i) => i + 1); // index 1..n

    // 5. Lấy OSRM duration matrix
    const matrix = await fetchOsrmDurationMatrix(allCoords);

    // 6. Chạy thuật toán Nearest Neighbor từ kho (index 0)
    const optimizedRoute = nearestNeighborTSP(matrix, 0, deliveryIndices);

    // 7. Tính ETA tích lũy và ghép thông tin đơn hàng
    const now = new Date();
    let cumulativeSeconds = 0;
    // Thêm 5 phút chuẩn bị xuất phát
    cumulativeSeconds += 5 * 60;

    const result = optimizedRoute.map((stop, seq) => {
      cumulativeSeconds += stop.durationFromPrev;
      const eta = new Date(now.getTime() + cumulativeSeconds * 1000);
      const ord = orders[stop.index - 1];
      const coord = orderCoords[stop.index - 1];

      return {
        sequence: seq + 1,
        orderId: ord.orderId,
        customerName: ord.customerName,
        shippingAddress: ord.shippingAddress,
        totalAmount: ord.totalAmount,
        paymentMethod: ord.paymentMethod,
        lat: coord.lat,
        lng: coord.lng,
        durationFromPrevSeconds: stop.durationFromPrev,
        durationFromPrevMinutes: Math.round(stop.durationFromPrev / 60),
        estimatedArrival: eta.toISOString(),
        distanceFromPrevKm: +(((stop.durationFromPrev / 3600) * 20)).toFixed(1), // 20km/h ước tính
      };
    });

    const totalDurationMinutes = Math.round(cumulativeSeconds / 60);
    const totalDistanceKm = result.reduce((sum, s) => sum + s.distanceFromPrevKm, 0).toFixed(1);

    res.json({
      success: true,
      data: {
        warehouse: warehouseCoord,
        optimizedRoute: result,
        summary: {
          totalOrders: result.length,
          totalDurationMinutes,
          totalDistanceKm: +totalDistanceKm,
          estimatedFinish: new Date(now.getTime() + cumulativeSeconds * 1000).toISOString(),
          algorithm: 'nearest_neighbor',
          matrixSource: 'osrm_or_haversine_fallback'
        }
      }
    });
  } catch (err) {
    console.error('[RouteOptimizer] Lỗi:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tối ưu lộ trình.' });
  }
};
