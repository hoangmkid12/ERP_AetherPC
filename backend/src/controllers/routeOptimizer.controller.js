/**
 * Route Optimizer Controller
 * Tối ưu thứ tự giao hàng cho Shipper, xuất phát từ VỊ TRÍ HIỆN TẠI của Shipper
 * (GPS hoặc điểm Shipper tự chọn) — không còn mặc định xuất phát từ kho:
 *   1. Định vị từng đơn tới số nhà / hẻm (geo.service: Goong AutoComplete + Detail)
 *   2. Ma trận thời gian & quãng đường xe máy thực tế (Goong DistanceMatrix,
 *      dự phòng OSRM, cuối cùng ước tính đường chim bay)
 *   3. Giải bài toán giao hàng có khung giờ hẹn (VRPTW):
 *      - Lời giải ban đầu: tham lam theo độ khẩn cấp khung giờ + gần nhất
 *      - Cải thiện cục bộ: 2-opt + dời 1 điểm (or-opt), chỉ nhận thay đổi
 *        làm giảm (số phút trễ hẹn, tổng thời gian) theo thứ tự ưu tiên đó
 */

const prisma = require('../config/database');
const { geocodeAddress, getTravelMatrix } = require('../services/geo.service');

const SERVICE_SECONDS = 5 * 60;   // thời gian giao tại mỗi điểm (gọi khách, chụp POD, thu tiền)
const PREP_SECONDS = 2 * 60;      // chuẩn bị xuất phát
const EARLY_SLACK_MIN = 15;       // được đến sớm tối đa 15 phút trước khung hẹn
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// Phút trong ngày & ngày (YYYY-MM-DD) theo giờ Việt Nam — máy chủ (Railway)
// chạy UTC, dùng getHours() trực tiếp sẽ lệch 7 tiếng so với giờ hẹn của khách.
const vnClock = (date = new Date()) => {
  const d = new Date(date.getTime() + VN_OFFSET_MS);
  return { minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), day: d.toISOString().slice(0, 10) };
};

// ---- Trích xuất thông tin hẹn giờ từ notes và failNote ----
function parseAppointment(notes, failNote) {
  const text = `${notes || ''} ${failNote || ''}`;
  const match = text.match(/\[HEN:(?:(\d{4}-\d{2}-\d{2})_)?(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\]/);
  if (!match) return null;
  const [sH, sM] = match[2].split(':').map(Number);
  const [eH, eM] = match[3].split(':').map(Number);
  return {
    date: match[1] || null,
    startMinutes: sH * 60 + sM,
    endMinutes: eH * 60 + eM,
    timeWindow: `${match[2]} - ${match[3]}`
  };
}

/**
 * Mô phỏng 1 thứ tự giao: trả về số phút trễ hẹn, tổng thời gian và chi tiết
 * từng điểm. `order` là mảng index trong ma trận (0 = điểm xuất phát).
 */
function simulate(order, matrix, windows, startMinutes) {
  let clockSec = startMinutes * 60 + PREP_SECONDS;
  let prev = 0;
  let lateMin = 0;
  const stops = [];
  for (const idx of order) {
    const travel = matrix.durations[prev][idx];
    clockSec += travel;
    const w = windows[idx];
    let waitSec = 0;
    if (w && clockSec < (w.startMinutes - EARLY_SLACK_MIN) * 60) {
      waitSec = (w.startMinutes - EARLY_SLACK_MIN) * 60 - clockSec;
      clockSec += waitSec;
    }
    const arrivalSec = clockSec;
    const late = w ? Math.max(0, Math.round((arrivalSec - w.endMinutes * 60) / 60)) : 0;
    lateMin += late;
    stops.push({ idx, travelSec: travel, distanceM: matrix.distances[prev][idx], waitSec, arrivalSec, lateMin: late });
    clockSec += SERVICE_SECONDS;
    prev = idx;
  }
  return { lateMin, totalSec: clockSec - startMinutes * 60, stops };
}

// So sánh lời giải: ít phút trễ hẹn hơn là tốt hơn; bằng nhau thì tổng thời gian ngắn hơn
const better = (a, b) => a.lateMin < b.lateMin || (a.lateMin === b.lateMin && a.totalSec < b.totalSec - 1);

// Lời giải ban đầu: chọn điểm kế tiếp theo (khẩn cấp khung giờ, rồi gần nhất)
function greedyInitial(n, matrix, windows, startMinutes) {
  const unvisited = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const order = [];
  let cur = 0;
  let clockSec = startMinutes * 60 + PREP_SECONDS;
  while (unvisited.size) {
    let best = null;
    for (const idx of unvisited) {
      const arrival = clockSec + matrix.durations[cur][idx];
      const w = windows[idx];
      let score = matrix.durations[cur][idx];
      if (w) {
        const slackSec = w.endMinutes * 60 - arrival;                       // còn bao lâu là trễ
        const earlySec = (w.startMinutes - EARLY_SLACK_MIN) * 60 - arrival; // đến sớm bao lâu
        if (slackSec < 30 * 60) score -= 6 * 3600 - Math.max(0, slackSec);  // sắp/đã trễ: kéo lên đầu
        else if (earlySec > 0) score += earlySec * 2;                        // quá sớm: dời về sau
      }
      if (!best || score < best.score) best = { idx, score };
    }
    unvisited.delete(best.idx);
    order.push(best.idx);
    clockSec += matrix.durations[cur][best.idx] + SERVICE_SECONDS;
    cur = best.idx;
  }
  return order;
}

function nearestNeighbor(n, matrix) {
  const unvisited = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const order = [];
  let cur = 0;
  while (unvisited.size) {
    let best = null;
    for (const idx of unvisited) if (best === null || matrix.durations[cur][idx] < matrix.durations[cur][best]) best = idx;
    unvisited.delete(best);
    order.push(best);
    cur = best;
  }
  return order;
}

// Cải thiện cục bộ: 2-opt (đảo đoạn) + or-opt (dời 1 điểm sang vị trí khác)
function improve(order, matrix, windows, startMinutes) {
  let bestOrder = [...order];
  let bestSim = simulate(bestOrder, matrix, windows, startMinutes);
  const n = bestOrder.length;
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = 0; i < n - 1 && !improved; i++) {
      for (let k = i + 1; k < n && !improved; k++) {
        const cand = [...bestOrder.slice(0, i), ...bestOrder.slice(i, k + 1).reverse(), ...bestOrder.slice(k + 1)];
        const sim = simulate(cand, matrix, windows, startMinutes);
        if (better(sim, bestSim)) { bestOrder = cand; bestSim = sim; improved = true; }
      }
    }
    for (let i = 0; i < n && !improved; i++) {
      for (let j = 0; j < n && !improved; j++) {
        if (i === j) continue;
        const cand = [...bestOrder];
        const [moved] = cand.splice(i, 1);
        cand.splice(j, 0, moved);
        const sim = simulate(cand, matrix, windows, startMinutes);
        if (better(sim, bestSim)) { bestOrder = cand; bestSim = sim; improved = true; }
      }
    }
  }
  return { order: bestOrder, sim: bestSim };
}

function solveRoute(n, matrix, windows, startMinutes) {
  const candidates = [greedyInitial(n, matrix, windows, startMinutes), nearestNeighbor(n, matrix)];
  let best = null;
  for (const c of candidates) {
    const r = improve(c, matrix, windows, startMinutes);
    if (!best || better(r.sim, best.sim)) best = r;
  }
  return best;
}

// ---- Handler: GET /api/v1/routes/geocode?address=... ----
exports.geocode = async (req, res) => {
  const address = String(req.query.address || '').trim();
  if (address.length < 4 || address.length > 300) {
    return res.status(400).json({ success: false, message: 'Địa chỉ không hợp lệ.' });
  }
  try {
    const result = await geocodeAddress(address);
    if (!result) return res.status(404).json({ success: false, message: 'Không định vị được địa chỉ này.' });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Geocode] Lỗi:', err.message);
    res.status(502).json({ success: false, message: 'Dịch vụ bản đồ đang lỗi, thử lại sau.' });
  }
};

// ---- Handler chính: POST /api/v1/routes/optimize ----
exports.optimizeRoute = async (req, res) => {
  try {
    const { orderIds, originLat, originLng, originName } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu danh sách đơn hàng (orderIds).' });
    }
    if (orderIds.length < 2) {
      return res.status(400).json({ success: false, message: 'Cần ít nhất 2 đơn hàng để tối ưu lộ trình.' });
    }
    if (orderIds.length > 30) {
      return res.status(400).json({ success: false, message: 'Tối đa 30 đơn mỗi lần tối ưu.' });
    }
    // Điểm xuất phát bắt buộc là vị trí của Shipper (GPS hoặc điểm tự chọn)
    const lat = Number(originLat), lng = Number(originLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ success: false, message: 'Cần vị trí hiện tại của Shipper (bật GPS hoặc chọn điểm xuất phát).' });
    }
    const origin = { lat, lng, name: originName ? String(originName).slice(0, 120) : 'Vị trí hiện tại của bạn' };

    const orders = await prisma.order.findMany({
      where: { orderId: { in: orderIds } },
      select: {
        orderId: true, shippingAddress: true, totalAmount: true, paymentMethod: true,
        notes: true, failNote: true, customer: { select: { name: true, phone: true } }
      }
    });
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng nào.' });
    }

    // 1. Định vị từng đơn — đơn không định vị được tách riêng, KHÔNG gán bừa toạ độ
    const today = vnClock().day;
    const geocoded = await Promise.all(orders.map(async (ord) => {
      const geo = await geocodeAddress(ord.shippingAddress).catch(() => null);
      const apt = parseAppointment(ord.notes, ord.failNote);
      return {
        ...ord,
        customerName: ord.customer?.name || 'Khách hàng',
        geo,
        // Hẹn ngày khác hôm nay thì không ràng buộc khung giờ của tuyến hôm nay
        appointment: apt && (!apt.date || apt.date === today) ? apt : null
      };
    }));
    const located = geocoded.filter(o => o.geo);
    const unlocated = geocoded.filter(o => !o.geo).map(o => ({
      orderId: o.orderId, customerName: o.customerName, shippingAddress: o.shippingAddress
    }));
    if (located.length === 0) {
      return res.status(422).json({ success: false, message: 'Không định vị được địa chỉ nào trong các đơn đã chọn.', data: { unlocated } });
    }

    // 2. Ma trận thời gian/quãng đường: [xuất phát, đơn1, đơn2, ...]
    const points = [origin, ...located.map(o => ({ lat: o.geo.lat, lng: o.geo.lng }))];
    const matrix = await getTravelMatrix(points);
    const windows = [null, ...located.map(o => o.appointment)];

    // 3. Giải
    const now = new Date();
    const startMinutes = vnClock(now).minutes;
    const { order: bestOrder, sim } = located.length === 1
      ? { order: [1], sim: simulate([1], matrix, windows, startMinutes) }
      : solveRoute(located.length, matrix, windows, startMinutes);

    const toIso = (sec) => new Date(now.getTime() + (sec - startMinutes * 60) * 1000).toISOString();
    const optimizedRoute = sim.stops.map((st, seq) => {
      const ord = located[st.idx - 1];
      return {
        sequence: seq + 1,
        matrixIndex: st.idx,
        orderId: ord.orderId,
        customerName: ord.customerName,
        shippingAddress: ord.shippingAddress,
        totalAmount: ord.totalAmount,
        paymentMethod: ord.paymentMethod,
        lat: ord.geo.lat,
        lng: ord.geo.lng,
        geoPrecision: ord.geo.precision,
        matchedAddress: ord.geo.matchedAddress,
        isRedelivery: Boolean(ord.notes?.includes('GIAO_LAI') || ord.failNote?.includes('GIAO_LAI')),
        notes: ord.notes,
        appointment: ord.appointment,
        durationFromPrevSeconds: st.travelSec,
        durationFromPrevMinutes: Math.max(1, Math.round(st.travelSec / 60)),
        distanceFromPrevKm: +(st.distanceM / 1000).toFixed(1),
        waitMinutes: Math.round(st.waitSec / 60),
        lateMinutes: st.lateMin,
        estimatedArrival: toIso(st.arrivalSec)
      };
    });

    const totalDistanceKm = +(sim.stops.reduce((s, st) => s + st.distanceM, 0) / 1000).toFixed(1);
    res.json({
      success: true,
      data: {
        origin,
        optimizedRoute,
        unlocated,
        // Trả kèm ma trận để giao diện tự tính lại ETA khi Shipper đổi thứ tự tay
        matrix: { durations: matrix.durations, distances: matrix.distances, serviceSeconds: SERVICE_SECONDS, prepSeconds: PREP_SECONDS },
        summary: {
          totalOrders: optimizedRoute.length,
          totalDurationMinutes: Math.round(sim.totalSec / 60),
          totalDistanceKm,
          totalLateMinutes: sim.lateMin,
          estimatedFinish: new Date(now.getTime() + sim.totalSec * 1000).toISOString(),
          algorithm: 'vrptw_greedy_2opt_oropt',
          matrixSource: matrix.source
        }
      }
    });
  } catch (err) {
    console.error('[RouteOptimizer] Lỗi tối ưu lộ trình:', err);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi tối ưu lộ trình.' });
  }
};

// Xuất để kiểm thử thuật toán độc lập
exports._internal = { simulate, solveRoute, vnClock, parseAppointment };
