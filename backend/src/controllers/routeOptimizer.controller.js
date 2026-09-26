/**
 * Route Optimizer Controller
 * Tối ưu lộ trình giao hàng cho Shipper sử dụng:
 *   1. Goong Geocoding API + Fallback TP.HCM dictionary (định vị chuẩn xác số nhà VN)
 *   2. OSRM Table API — lấy ma trận thời gian đi thực tế đường bộ
 *   3. VRPTW (Vehicle Routing Problem with Time Windows) Heuristic:
 *      - Đơn ĐÃ TRỄ / SẮP TRỄ: Ưu tiên cứu nguy số 1 (High Penalty nếu để trễ thêm)
 *      - Đơn ĐÚNG KHUNG GIỜ HẸN: Giao đúng khung giờ vàng của khách
 *      - Đơn HẸN TƯƠNG LAI (ví dụ hẹn chiều mà bây giờ mới trưa): Phạt đến quá sớm (Early Penalty), dời về sau
 *      - Đơn TỰ DO (không hẹn giờ): Gom tiện đường giữa các điểm hẹn theo khoảng cách ngắn nhất
 */

const prisma = require('../config/database');

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
const GOONG_API_KEY = process.env.GOONG_API_KEY || 'X7wwio8EL8HNn0PTMeM3BWVXHNMyXcc1Im59lkRa';

// Từ điển tọa độ chuẩn các quận huyện TP.HCM để fallback tuyệt đối, không bao giờ văng ra tỉnh khác
const DISTRICT_COORDS_HCM = [
  { keys: ['đa kao', 'da kao'], lat: 10.7861, lng: 106.6942 },
  { keys: ['bến nghé', 'ben nghe', 'lê lợi', 'nam kỳ khởi nghĩa'], lat: 10.7713, lng: 106.7058 },
  { keys: ['bến thành', 'ben thanh'], lat: 10.7725, lng: 106.6980 },
  { keys: ['quận 1', 'quan 1', 'q1', 'q.1'], lat: 10.7769, lng: 106.7009 },
  { keys: ['quận 3', 'quan 3', 'q3', 'q.3', 'nguyễn thị minh khai'], lat: 10.7844, lng: 106.6845 },
  { keys: ['quận 10', 'quan 10', 'q10', 'q.10'], lat: 10.7674, lng: 106.6669 },
  { keys: ['bình thạnh', 'binh thanh', 'điện biên phủ'], lat: 10.8012, lng: 106.7114 },
  { keys: ['gò vấp', 'go vap', 'phan văn trị'], lat: 10.8386, lng: 106.6653 },
  { keys: ['phú nhuận', 'phu nhuan'], lat: 10.7992, lng: 106.6803 },
  { keys: ['tân bình', 'tan binh'], lat: 10.8015, lng: 106.6526 },
  { keys: ['quận 5', 'quan 5', 'q5', 'q.5'], lat: 10.7554, lng: 106.6627 },
  { keys: ['quận 7', 'quan 7', 'q7', 'q.7'], lat: 10.7411, lng: 106.6989 },
  { keys: ['thủ đức', 'thu duc', 'quận 2', 'quận 9'], lat: 10.8494, lng: 106.7717 }
];

// ---- Geocode địa chỉ văn bản → {lat, lng} ưu tiên Goong API, fallback TP.HCM ----
async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') return null;

  // 1. Thử Goong Geocoding API (chuẩn nhất cho địa chỉ Việt Nam)
  if (GOONG_API_KEY) {
    try {
      const url = `https://rsapi.goong.io/geocode?address=${encodeURIComponent(address)}&api_key=${GOONG_API_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const loc = data?.results?.[0]?.geometry?.location;
        if (loc?.lat && loc?.lng) {
          // Bắt buộc nằm trong phạm vi TP.HCM và lân cận (tránh văng ra tỉnh xa)
          if (loc.lat >= 10.2 && loc.lat <= 11.2 && loc.lng >= 106.2 && loc.lng <= 107.2) {
            return { lat: loc.lat, lng: loc.lng };
          }
        }
      }
    } catch (_) { /* ignore Goong error and fallback */ }
  }

  // 2. Thử Nominatim với viewbox TP.HCM
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=vn&viewbox=106.3,11.2,107.1,10.3&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AetherPC-ERP/1.0 (contact@aetherpc.vn)' },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0 && list[0].lat && list[0].lon) {
        const lat = parseFloat(list[0].lat);
        const lng = parseFloat(list[0].lon);
        if (lat >= 10.2 && lat <= 11.2 && lng >= 106.2 && lng <= 107.2) {
          return { lat, lng };
        }
      }
    }
  } catch (_) { /* ignore */ }

  // 3. Fallback theo từ điển quận huyện TP.HCM
  const lower = address.toLowerCase();
  for (const item of DISTRICT_COORDS_HCM) {
    if (item.keys.some(k => lower.includes(k))) {
      return { lat: item.lat, lng: item.lng };
    }
  }

  // Mặc định trả về trung tâm TP.HCM (Quận 1)
  return { lat: 10.7769, lng: 106.7009 };
}

// ---- Trích xuất thông tin hẹn giờ từ notes và failNote ----
function parseAppointment(notes, failNote) {
  const text = `${notes || ''} ${failNote || ''}`;
  const match = text.match(/\[HEN:(?:(\d{4}-\d{2}-\d{2})_)?(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\]/);
  if (!match) return null;

  const dateStr = match[1] || null;
  const startTime = match[2];
  const endTime = match[3];

  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);

  return {
    date: dateStr,
    startMinutes: sH * 60 + sM,
    endMinutes: eH * 60 + eM,
    timeWindow: `${startTime} - ${endTime}`
  };
}

// ---- Gọi OSRM Table API: lấy ma trận thời gian (giây) giữa N điểm ----
async function fetchOsrmDurationMatrix(coords) {
  const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `${OSRM_BASE_URL}/table/v1/driving/${coordStr}?annotations=duration`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Dịch vụ tìm đường OSRM lỗi ${res.status}`);
    const data = await res.json();
    if (data.code === 'Ok' && data.durations) return data.durations;
  } catch (err) {
    console.warn('[RouteOptimizer] OSRM Table API lỗi, dùng Haversine fallback:', err.message);
  }
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
      matrix[i][j] = Math.round((km / 22) * 3600); // 22 km/h đô thị xe máy → giây
    }
  }
  return matrix;
}

// ---- Thuật toán VRPTW (Vehicle Routing Problem with Time Windows) ----
function solveVRPTW(matrix, startIdx, ordersWithMeta, startMinutesOfDay) {
  const unvisited = new Set(ordersWithMeta.map((_, i) => i + 1)); // 1..n
  const route = [];
  let current = startIdx;
  let currentMinutes = startMinutesOfDay + 5; // 5 phút chuẩn bị xuất phát

  while (unvisited.size > 0) {
    let bestIdx = -1;
    let bestScore = Infinity;
    let bestTravelSec = 0;

    for (const idx of unvisited) {
      const travelSec = matrix[current][idx] || 300;
      const travelMin = Math.round(travelSec / 60);
      const arrivalMin = currentMinutes + travelMin;
      const ord = ordersWithMeta[idx - 1];
      const apt = ord.appointment;

      let penalty = 0;

      if (apt && apt.startMinutes != null && apt.endMinutes != null) {
        const { startMinutes: sMin, endMinutes: eMin } = apt;

        if (arrivalMin > eMin) {
          // ⚠️ ĐÃ TRỄ HẸN hoặc SẼ TRỄ HẸN:
          // Đây là vi phạm nghiêm trọng SLA. Phải giải quyết khẩn cấp!
          // Điểm phạt cực âm để kéo lên đầu, đơn nào trễ nhiều hơn thì càng khẩn cấp.
          const minutesLate = arrivalMin - eMin;
          penalty = -10000 - (minutesLate * 25);
        } else if (arrivalMin < sMin - 15) {
          // ⏳ ĐẾN QUÁ SỚM (ví dụ hẹn 15:30 mà 13:50 đã tới):
          // Khách đi làm chưa về, Shipper tới sẽ không giao được hoặc phải chờ cả tiếng!
          // Phạt dương rất nặng để thuật toán dời đơn này về sau.
          const minutesEarly = (sMin - 15) - arrivalMin;
          penalty = 5000 + (minutesEarly * 60);
        } else {
          // ✅ ĐÚNG KHUNG GIỜ VÀNG [sMin - 15, eMin]:
          // Lý tưởng nhất! Thưởng điểm ưu tiên cao để thực hiện ngay.
          penalty = -3000;
        }
      } else {
        // Đơn tự do (không hẹn giờ):
        // Không phạt thời gian, linh hoạt xếp theo khoảng cách di chuyển ngắn nhất.
        penalty = 0;
      }

      // Tổng chi phí = Thời gian di chuyển (phút) + Trọng số Time Window
      const score = travelMin + penalty;

      if (score < bestScore) {
        bestScore = score;
        bestIdx = idx;
        bestTravelSec = travelSec;
      }
    }

    if (bestIdx === -1) break;

    unvisited.delete(bestIdx);
    const chosenTravelMin = Math.round(bestTravelSec / 60);
    currentMinutes += chosenTravelMin + 4; // +4 phút thời gian giao hàng POD tại điểm
    route.push({
      index: bestIdx,
      durationFromPrev: bestTravelSec
    });
    current = bestIdx;
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
        totalAmount: true,
        paymentMethod: true,
        notes: true,
        failNote: true,
        customer: { select: { name: true, phone: true } }
      }
    });

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng nào.' });
    }

    // 2. Điểm xuất phát: dùng GPS thực tế của Shipper nếu có, fallback về Kho AetherPC (Quận 1)
    const usingGps = typeof originLat === 'number' && typeof originLng === 'number';
    const warehouseCoord = usingGps
      ? { lat: originLat, lng: originLng, name: '📍 Vị trí hiện tại của bạn' }
      : { lat: 10.7769, lng: 106.7009, name: 'Kho AetherPC' };

    console.log(`[RouteOptimizer] Điểm xuất phát: ${warehouseCoord.name} (${warehouseCoord.lat}, ${warehouseCoord.lng})`);

    // 3. Geocode tọa độ từng đơn hàng chuẩn xác
    const ordersWithMeta = await Promise.all(
      orders.map(async (ord) => {
        const geo = await geocodeAddress(ord.shippingAddress);
        const apt = parseAppointment(ord.notes, ord.failNote);
        return {
          ...ord,
          customerName: ord.customerName || ord.customer?.name || 'Khách Hàng',
          coord: geo || warehouseCoord,
          appointment: apt
        };
      })
    );

    // 4. Xây dựng mảng tọa độ: [điểm xuất phát, đơn1, đơn2, ...]
    const allCoords = [warehouseCoord, ...ordersWithMeta.map(o => o.coord)];

    // 5. Lấy ma trận thời gian từ OSRM Table API
    const matrix = await fetchOsrmDurationMatrix(allCoords);

    // 6. Tính phút hiện tại trong ngày để thuật toán VRPTW biết khung giờ thực tế
    const now = new Date();
    const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

    // 7. Giải bài toán VRPTW kết hợp Time Window & Khoảng cách đường bộ
    const optimizedRoute = solveVRPTW(matrix, 0, ordersWithMeta, currentMinutesOfDay);

    // 8. Tính ETA tích lũy theo từng điểm dừng
    let cumulativeSeconds = 5 * 60; // 5 phút chuẩn bị xuất phát

    const result = optimizedRoute.map((stop, seq) => {
      cumulativeSeconds += stop.durationFromPrev;
      const eta = new Date(now.getTime() + cumulativeSeconds * 1000);
      cumulativeSeconds += 4 * 60; // +4 phút thời gian giao tại nhà khách

      const ord = ordersWithMeta[stop.index - 1];
      const isRedeliv = Boolean(ord.notes?.includes('GIAO_LAI') || ord.failNote?.includes('GIAO_LAI'));
      const distanceKm = +(((stop.durationFromPrev / 3600) * 22)).toFixed(1);

      return {
        sequence: seq + 1,
        orderId: ord.orderId,
        customerName: ord.customerName,
        shippingAddress: ord.shippingAddress,
        totalAmount: ord.totalAmount,
        paymentMethod: ord.paymentMethod,
        lat: ord.coord.lat,
        lng: ord.coord.lng,
        isRedelivery: isRedeliv,
        notes: ord.notes,
        appointment: ord.appointment,
        durationFromPrevSeconds: stop.durationFromPrev,
        durationFromPrevMinutes: Math.max(1, Math.round(stop.durationFromPrev / 60)),
        estimatedArrival: eta.toISOString(),
        distanceFromPrevKm: distanceKm
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
          algorithm: 'vrptw_time_windows',
          matrixSource: 'osrm_table_with_goong_geocoding'
        }
      }
    });
  } catch (err) {
    console.error('[RouteOptimizer] Lỗi xử lý VRPTW:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tối ưu lộ trình.' });
  }
};
