// Proxies AddressKit API for standardized Vietnamese administrative divisions
const ADDRESSKIT_BASE = 'https://production.cas.so/address-kit/latest';
const { toNewProvinceCode } = require('../utils/vnAdminUnits');

// Provinces/communes barely ever change — cache in-process to avoid hammering upstream APIs
let provincesCache = null;
const communesCache = new Map();

// Danh sách phường/xã MỚI (2 cấp, sau 01/07/2025) của 1 tỉnh mới từ AddressKit
const loadCommunes = async (code) => {
  if (!communesCache.has(code)) {
    const upstream = await fetch(`${ADDRESSKIT_BASE}/provinces/${encodeURIComponent(code)}/communes`);
    if (!upstream.ok) throw new Error(`Không tải được danh sách phường/xã (dịch vụ địa chỉ lỗi ${upstream.status}).`);
    const data = await upstream.json();
    communesCache.set(code, Array.isArray(data?.communes) ? data.communes : []);
  }
  return communesCache.get(code);
};

// GET /api/v1/address/provinces
const getProvinces = async (req, res, next) => {
  try {
    if (!provincesCache) {
      const upstream = await fetch(`${ADDRESSKIT_BASE}/provinces`);
      if (!upstream.ok) throw new Error(`Không tải được danh sách tỉnh/thành (dịch vụ địa chỉ lỗi ${upstream.status}).`);
      const data = await upstream.json();
      provincesCache = Array.isArray(data?.provinces) ? data.provinces : [];
    }
    res.json({ success: true, data: { provinces: provincesCache } });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/address/provinces/:code/communes
const getCommunes = async (req, res, next) => {
  try {
    res.json({ success: true, data: { communes: await loadCommunes(req.params.code) } });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/address/wards?province=...
// Trước đây lấy phường/xã từ provinces.open-api.vn bản v1 (63 tỉnh, 3 cấp, phường
// CŨ theo quận/huyện) trong khi danh sách tỉnh lại là 34 tỉnh MỚI — nên chọn
// "Thành phố Hồ Chí Minh" chỉ ra phường cũ của TP.HCM cũ, thiếu toàn bộ phường của
// Bình Dương / Bà Rịa - Vũng Tàu cũ; tỉnh gộp thì lệch mã (vd. Bắc Ninh mới = 24).
// Giờ luôn trả phường/xã mới của tỉnh mới; tên tỉnh cũ được quy đổi sang tỉnh mới.
// Tham số district (cũ) vẫn nhận nhưng bỏ qua vì đơn vị hành chính mới không còn cấp huyện.
const getWards = async (req, res, next) => {
  try {
    const { province } = req.query;
    const code = toNewProvinceCode(province);
    if (!code) {
      return res.json({ success: true, data: { wards: [] } });
    }
    const communes = await loadCommunes(code);
    const wards = communes.map(c => ({
      code: String(c.code),
      name: c.name,
      provinceCode: c.provinceCode || code,
      provinceName: c.provinceName || ''
    }));
    // provinceName = tên tỉnh MỚI, để form đổi tên tỉnh cũ của địa chỉ đã lưu sang tên mới
    const provinceName = communes[0]?.provinceName || '';
    res.json({ success: true, data: { wards, provinceCode: code, provinceName } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProvinces, getCommunes, getWards };

