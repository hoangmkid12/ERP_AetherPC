/**
 * Định vị địa chỉ giao hàng & ma trận quãng đường dùng chung cho bản đồ
 * Shipper, bản đồ theo dõi đơn của khách và bộ tối ưu lộ trình.
 *
 * Định vị (geocode) theo thứ tự chính xác giảm dần:
 *   1. Goong AutoComplete + Place/Detail — khớp tới số nhà / số hẻm (đã kiểm
 *      chứng: "12/34 Lê Văn Sỹ" ra đúng nhà trong hẻm, còn Goong Geocode trả
 *      nhầm sang "351/34B Lê Văn Sỹ").
 *   2. Goong Geocode — dự phòng khi AutoComplete không có gợi ý khớp.
 *   3. Nominatim (OpenStreetMap) — khi Goong lỗi mạng / hết hạn mức.
 * Mỗi kết quả kèm `precision` (house | street | ward | approx) để giao diện
 * nói rõ cho Shipper biết vị trí chính xác tới đâu, thay vì lặng lẽ trả về
 * tâm Quận 1 như trước.
 */

const GOONG_API_KEY = process.env.GOONG_API_KEY || 'X7wwio8EL8HNn0PTMeM3BWVXHNMyXcc1Im59lkRa';
const GOONG_BASE = 'https://rsapi.goong.io';
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

const removeAccents = s => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase();

const tokenize = s => removeAccents(s).replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Chuẩn hoá địa chỉ
// ---------------------------------------------------------------------------

// Tách địa chỉ thành { street, houseNumber, streetName, ward, province, full }
function parseVnAddress(raw) {
  let text = String(raw || '')
    .replace(/\(\s*ghi chú[^)]*\)/gi, '')
    .replace(/\s*\(gồm[^)]*\)/gi, '')
    // buildStandardAddress() ghép phường chưa rõ loại thành "Phường/Xã Tên"
    .replace(/Phường\/Xã\s+(Phường|Xã|Thị trấn)\s+/gi, '$1 ')
    .replace(/Phường\/Xã\s+/gi, '')
    // Không dùng \b: \b của JS không nhận chữ có dấu như "Đ"
    .replace(/(^|[\s,])Đ\.\s*/g, '$1Đường ')
    .replace(/\bTP\.?\s*HCM\b/gi, 'Thành phố Hồ Chí Minh')
    .replace(/\bTP\.\s*/gi, 'Thành phố ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = text.split(',').map(s => s.trim()).filter(Boolean);
  let street = parts[0] || '';
  // Bỏ "Tổ 5", "Khu phố 3"... đứng riêng đầu địa chỉ — không giúp định vị
  if (parts.length > 1 && /^(tổ|khu phố|kp|ấp)\b/i.test(street)) {
    parts.shift();
    street = parts[0] || '';
  }

  // "Số 12 hẻm 34 Lê Văn Sỹ" / "12 Hẻm 34 Lê Văn Sỹ" => "34/12 Lê Văn Sỹ"
  // (quy ước TP.HCM: số hẻm trước, số nhà sau). Hà Nội "Số 5 ngõ 102 X" giữ
  // nguyên vì Goong hiểu đúng dạng ngõ/ngách.
  const hem = street.match(/^(?:số\s*)?(\d+[a-z]?)\s*,?\s*(?:hẻm|hem|kiệt|kiet)\s+(\d+[a-z]?(?:\/\d+[a-z]?)*)\s+(.+)$/i);
  if (hem) street = `${hem[2]}/${hem[1]} ${hem[3]}`;
  street = street.replace(/^số\s+(?=\d)/i, '');

  const house = street.match(/^(\d+[a-z]?(?:\/\d+[a-z]?)*)\s+(.+)$/i);
  const houseNumber = house ? house[1].toLowerCase() : null;
  // Tên đường "trần" để so khớp: bỏ "Đường/Phố" và tiền tố "Hẻm 51 / Ngõ 102 / Ngách 4"
  const streetName = (house ? house[2] : street)
    .replace(/^((hẻm|hem|kiệt|kiet|ngõ|ngo|ngách|ngach)\s+\d+[a-z]?(\/\d+[a-z]?)*\s+)+/i, '')
    .replace(/^(đường|phố)\s+/i, '')
    .trim();

  const tail = parts.slice(1);
  const province = tail.length ? tail[tail.length - 1] : '';
  const ward = tail.length >= 2 ? tail[0] : '';
  parts[0] = street;
  return { street, houseNumber, streetName, ward, province, full: parts.join(', ') };
}

// Chấm điểm 1 gợi ý theo mức trùng số nhà / tên đường / phường
function scoreCandidate(parsed, text) {
  const t = tokenize(text);
  const main = tokenize(String(text).split(',')[0]).replace(/^(so|duong) /, '');
  const firstTok = main.split(' ')[0];
  const houseMatch = Boolean(parsed.houseNumber) && firstTok === parsed.houseNumber.replace(/[^a-z0-9/]/g, '');
  const streetTok = tokenize(parsed.streetName);
  const streetMatch = streetTok.length > 1 && t.includes(streetTok);
  const wardTok = tokenize(parsed.ward).replace(/^(phuong|xa|thi tran) /, '');
  const wardMatch = wardTok.length > 1 && t.includes(wardTok);
  return { score: (houseMatch ? 4 : 0) + (streetMatch ? 2 : 0) + (wardMatch ? 1 : 0), houseMatch, streetMatch, wardMatch };
}

// Khung toạ độ thô của TP.HCM mới (gồm Bình Dương, Bà Rịa - Vũng Tàu cũ)
const isHcmText = s => /h[oồ] ch[ií] minh|\bhcm\b|s[aà]i g[oò]n/i.test(s);
const inHcmBox = (lat, lng) => lat >= 10.2 && lat <= 11.4 && lng >= 106.2 && lng <= 107.6;

async function fetchJson(url, ms = 5000, headers = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Geocode
// ---------------------------------------------------------------------------

const geocodeCache = new Map(); // key => { value, expires }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 3000;

async function goongAutocomplete(parsed, query) {
  const data = await fetchJson(`${GOONG_BASE}/Place/AutoComplete?api_key=${GOONG_API_KEY}&input=${encodeURIComponent(query)}&limit=6`);
  const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
  let best = null;
  for (const p of predictions) {
    const s = scoreCandidate(parsed, p.description || '');
    if (!best || s.score > best.s.score) best = { p, s };
  }
  // Chỉ khớp tên đường thôi chưa đủ (nhiều nơi có đường trùng tên, vd. "Nguyễn
  // Huệ" ở Đất Đỏ) — phải khớp thêm số nhà hoặc phường mới nhận.
  if (!best || !best.s.streetMatch || !(best.s.houseMatch || best.s.wardMatch)) return null;
  const detail = await fetchJson(`${GOONG_BASE}/Place/Detail?api_key=${GOONG_API_KEY}&place_id=${encodeURIComponent(best.p.place_id)}`);
  const loc = detail?.result?.geometry?.location;
  if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return null;
  return {
    lat: loc.lat,
    lng: loc.lng,
    precision: best.s.houseMatch ? 'house' : 'street',
    matchedAddress: best.p.description,
    source: 'goong_autocomplete'
  };
}

async function goongGeocode(parsed, query) {
  const data = await fetchJson(`${GOONG_BASE}/geocode?address=${encodeURIComponent(query)}&api_key=${GOONG_API_KEY}`);
  const top = data?.results?.[0];
  const loc = top?.geometry?.location;
  if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return null;
  const s = scoreCandidate(parsed, top.formatted_address || top.name || '');
  return {
    lat: loc.lat,
    lng: loc.lng,
    // Không khớp đường lẫn phường => chỉ là vị trí phỏng đoán (approx), không
    // được nhận là "đúng phường" như trước.
    precision: s.houseMatch && s.streetMatch ? 'house' : s.streetMatch ? 'street' : s.wardMatch ? 'ward' : 'approx',
    matchedAddress: top.formatted_address || query,
    source: 'goong_geocode'
  };
}

async function nominatimGeocode(query) {
  const list = await fetchJson(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=vn&limit=1`,
    4000,
    { 'User-Agent': 'AetherPC-ERP/1.0 (contact@aetherpc.vn)' }
  );
  const top = Array.isArray(list) ? list[0] : null;
  if (!top?.lat || !top?.lon) return null;
  return { lat: parseFloat(top.lat), lng: parseFloat(top.lon), precision: 'approx', matchedAddress: top.display_name, source: 'nominatim' };
}

const PRECISION_RANK = { house: 3, street: 2, ward: 1, approx: 0 };

/**
 * Định vị 1 địa chỉ giao hàng.
 * @returns {Promise<{lat,lng,precision,matchedAddress,source}|null>} null nếu không định vị được
 */
async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') return null;
  const key = tokenize(address);
  const cached = geocodeCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const parsed = parseVnAddress(address);
  const hcm = isHcmText(address);
  const valid = r => r && Number.isFinite(r.lat) && Number.isFinite(r.lng) && (!hcm || inHcmBox(r.lat, r.lng));

  // Câu truy vấn: đầy đủ trước; bỏ tỉnh sau (tên tỉnh mới sau sáp nhập đôi
  // khi làm Goong khớp nhầm phường trùng tên ở nơi khác).
  const queries = [...new Set([
    parsed.full,
    parsed.ward ? [parsed.street, parsed.ward].join(', ') : null
  ].filter(q => q && q.length > 3))];

  let best = null;
  const consider = (r) => {
    if (valid(r) && (!best || PRECISION_RANK[r.precision] > PRECISION_RANK[best.precision])) best = r;
  };

  if (GOONG_API_KEY) {
    for (const q of queries) {
      consider(await goongAutocomplete(parsed, q).catch(() => null));
      if (best?.precision === 'house') break;
    }
    if (!best || PRECISION_RANK[best.precision] < 2) {
      consider(await goongGeocode(parsed, parsed.full).catch(() => null));
    }
    if (!best && parsed.ward) {
      const wardOnly = await goongGeocode(parsed, [parsed.ward, parsed.province].filter(Boolean).join(', ')).catch(() => null);
      if (wardOnly) consider({ ...wardOnly, precision: 'ward' });
    }
  }
  if (!best) consider(await nominatimGeocode(parsed.full).catch(() => null));

  if (best) {
    if (geocodeCache.size >= CACHE_MAX) geocodeCache.delete(geocodeCache.keys().next().value);
    geocodeCache.set(key, { value: best, expires: Date.now() + CACHE_TTL_MS });
  }
  return best;
}

// ---------------------------------------------------------------------------
// Ma trận thời gian / quãng đường (xe máy)
// ---------------------------------------------------------------------------

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Goong DistanceMatrix (vehicle=bike) — từng hàng 1 request để không vượt giới hạn số phần tử
async function goongMatrix(points) {
  const dests = points.map(p => `${p.lat},${p.lng}`).join('|');
  const rows = await Promise.all(points.map(async (o) => {
    const data = await fetchJson(`${GOONG_BASE}/DistanceMatrix?origins=${o.lat},${o.lng}&destinations=${dests}&vehicle=bike&api_key=${GOONG_API_KEY}`, 8000);
    const els = data?.rows?.[0]?.elements;
    if (!Array.isArray(els) || els.length !== points.length) throw new Error('Goong matrix thiếu dữ liệu');
    return els;
  }));
  return {
    durations: rows.map((els, i) => els.map((e, j) => (i === j ? 0 : (e?.status === 'OK' ? e.duration.value : null)))),
    distances: rows.map((els, i) => els.map((e, j) => (i === j ? 0 : (e?.status === 'OK' ? e.distance.value : null)))),
    source: 'goong_bike'
  };
}

async function osrmMatrix(points) {
  const coordStr = points.map(c => `${c.lng},${c.lat}`).join(';');
  const data = await fetchJson(`${OSRM_BASE_URL}/table/v1/driving/${coordStr}?annotations=duration,distance`, 8000);
  if (data.code !== 'Ok' || !data.durations) throw new Error('OSRM table lỗi');
  return { durations: data.durations, distances: data.distances, source: 'osrm' };
}

// Đường chim bay × 1.35 (hệ số đường vòng đô thị), xe máy ~25 km/h
function haversineMatrix(points) {
  const durations = [], distances = [];
  for (const a of points) {
    const dRow = [], mRow = [];
    for (const b of points) {
      const m = a === b ? 0 : haversineKm(a, b) * 1350;
      mRow.push(Math.round(m));
      dRow.push(Math.round(m / (25000 / 3600)));
    }
    durations.push(dRow);
    distances.push(mRow);
  }
  return { durations, distances, source: 'haversine' };
}

/**
 * Ma trận durations (giây) & distances (mét) giữa các điểm. Ô thiếu dữ liệu
 * (Goong không tìm được đường) được lấp bằng ước tính đường chim bay.
 */
async function getTravelMatrix(points) {
  const fallback = haversineMatrix(points);
  let m = null;
  if (GOONG_API_KEY) m = await goongMatrix(points).catch(err => { console.warn('[geo] Goong matrix lỗi:', err.message); return null; });
  if (!m) m = await osrmMatrix(points).catch(err => { console.warn('[geo] OSRM matrix lỗi:', err.message); return null; });
  if (!m) return fallback;
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (m.durations[i][j] == null) m.durations[i][j] = fallback.durations[i][j];
      if (!m.distances || m.distances[i]?.[j] == null) {
        if (!m.distances) m.distances = fallback.distances.map(r => [...r]);
        else m.distances[i][j] = fallback.distances[i][j];
      }
    }
  }
  return m;
}

module.exports = { geocodeAddress, getTravelMatrix, parseVnAddress, scoreCandidate, haversineKm };
