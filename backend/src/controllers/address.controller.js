// Proxies AddressKit API & provinces.open-api.vn for standardized Vietnamese administrative divisions
const ADDRESSKIT_BASE = 'https://production.cas.so/address-kit/latest';
const OPENAPI_BASE = 'https://provinces.open-api.vn/api';

// Provinces/communes barely ever change — cache in-process to avoid hammering upstream APIs
let provincesCache = null;
const communesCache = new Map();
const openApiProvinceCache = new Map();

const removeAccents = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

const PROVINCE_NAME_TO_CODE = {
  'ha noi': 1, 'hanoi': 1, 'hn': 1, 'thanh pho ha noi': 1,
  'ha giang': 2, 'cao bang': 4, 'bac kan': 6, 'tuyen quang': 8, 'lao cai': 10,
  'dien bien': 11, 'lai chau': 12, 'son la': 14, 'yen bai': 15, 'hoa binh': 17,
  'thai nguyen': 19, 'lang son': 20, 'quang ninh': 22, 'bac giang': 24, 'phu tho': 25,
  'vinh phuc': 26, 'bac ninh': 27, 'hai duong': 30, 'hai phong': 31, 'hung yen': 33,
  'thai binh': 34, 'ha nam': 35, 'nam dinh': 36, 'ninh binh': 37, 'thanh hoa': 38,
  'nghe an': 40, 'ha tinh': 42, 'quang binh': 44, 'quang tri': 45, 'hue': 46, 'thua thien hue': 46,
  'da nang': 48, 'danang': 48, 'dn': 48, 'thanh pho da nang': 48,
  'quang nam': 49, 'quang ngai': 51, 'binh dinh': 52,
  'phu yen': 54, 'khanh hoa': 56, 'ninh thuan': 58, 'binh thuan': 60, 'kon tum': 62,
  'gia lai': 64, 'dak lak': 66, 'dak nong': 67, 'lam dong': 68, 'binh phuoc': 70,
  'tay ninh': 72, 'binh duong': 74, 'dong nai': 75, 'ba ria - vung tau': 77, 'ba ria vung tau': 77,
  'tp. ho chi minh': 79, 'ho chi minh': 79, 'hcm': 79, 'sai gon': 79, 'thanh pho ho chi minh': 79,
  'long an': 80, 'tien giang': 82, 'ben tre': 83, 'tra vinh': 84, 'vinh long': 86,
  'dong thap': 87, 'an giang': 89, 'kien giang': 91, 'can tho': 92, 'hau giang': 93,
  'soc trang': 94, 'bac lieu': 95, 'ca mau': 96
};

// Match district string flexibly (e.g. "Quận 1" matches "Quận 1", "TP. Thủ Đức" matches "Thành phố Thủ Đức")
const matchDistrictName = (a, b) => {
  if (!a || !b) return false;
  const normA = removeAccents(a).replace(/^(quan|huyen|thanh pho|tp\.|thi xa)\s+/i, '');
  const normB = removeAccents(b).replace(/^(quan|huyen|thanh pho|tp\.|thi xa)\s+/i, '');
  return normA === normB || normA.includes(normB) || normB.includes(normA);
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
    const { code } = req.params;
    if (!communesCache.has(code)) {
      const upstream = await fetch(`${ADDRESSKIT_BASE}/provinces/${encodeURIComponent(code)}/communes`);
      if (!upstream.ok) throw new Error(`Không tải được danh sách phường/xã (dịch vụ địa chỉ lỗi ${upstream.status}).`);
      const data = await upstream.json();
      communesCache.set(code, Array.isArray(data?.communes) ? data.communes : []);
    }
    res.json({ success: true, data: { communes: communesCache.get(code) } });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/address/wards?province=...&district=...
const getWards = async (req, res, next) => {
  try {
    const { province, district } = req.query;
    if (!province) {
      return res.json({ success: true, data: { wards: [] } });
    }

    // Resolve province code
    let provCode = null;
    if (/^\d+$/.test(String(province).trim())) {
      provCode = parseInt(province, 10);
    } else {
      const cleanProv = removeAccents(province).replace(/\s*\(gồm[^)]*\)/gi, '').trim();
      provCode = PROVINCE_NAME_TO_CODE[cleanProv];
      if (!provCode) {
        for (const [key, val] of Object.entries(PROVINCE_NAME_TO_CODE)) {
          if (cleanProv.includes(key) || key.includes(cleanProv)) {
            provCode = val;
            break;
          }
        }
      }
    }

    if (!provCode) {
      return res.json({ success: true, data: { wards: [] } });
    }

    // Fetch province tree with depth 3 (provinces -> districts -> wards)
    if (!openApiProvinceCache.has(provCode)) {
      const upstream = await fetch(`${OPENAPI_BASE}/p/${provCode}?depth=3`);
      if (upstream.ok) {
        const pData = await upstream.json();
        openApiProvinceCache.set(provCode, pData);
      }
    }

    const provData = openApiProvinceCache.get(provCode);
    if (provData && Array.isArray(provData.districts)) {
      // If district is specified, filter strictly by that district
      if (district && district.trim()) {
        const foundDistrict = provData.districts.find(d => matchDistrictName(d.name, district));
        if (foundDistrict && Array.isArray(foundDistrict.wards)) {
          const wards = foundDistrict.wards.map(w => ({
            code: String(w.code),
            name: w.name,
            districtCode: String(foundDistrict.code),
            districtName: foundDistrict.name
          }));
          return res.json({ success: true, data: { wards } });
        }
      }

      // If no district specified or not matched, return all wards
      const allWards = [];
      provData.districts.forEach(d => {
        if (Array.isArray(d.wards)) {
          d.wards.forEach(w => {
            allWards.push({
              code: String(w.code),
              name: w.name,
              districtCode: String(d.code),
              districtName: d.name
            });
          });
        }
      });
      return res.json({ success: true, data: { wards: allWards } });
    }

    // Fallback: return communes from AddressKit
    res.json({ success: true, data: { wards: [] } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProvinces, getCommunes, getWards };

