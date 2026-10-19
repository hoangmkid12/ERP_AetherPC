// Standard Delivery Regions System
export const DELIVERY_REGIONS = [
  { code: 'HCM_KV1', name: 'TP.HCM - Khu Vực 1 (Trung tâm: Q1, Q3, Q4, Q5, Q10, Phú Nhuận)', shortName: 'TP.HCM (KV1 - Trung Tâm)' },
  { code: 'HCM_KV2', name: 'TP.HCM - Khu Vực 2 (Phía Đông: TP. Thủ Đức, Q2, Q9, Bình Thạnh, Gò Vấp)', shortName: 'TP.HCM (KV2 - Đông & Gò Vấp)' },
  { code: 'HCM_KV3', name: 'TP.HCM - Khu Vực 3 (Phía Nam: Q7, Q8, Nhà Bè, Bình Chánh, Cần Giờ)', shortName: 'TP.HCM (KV3 - Nam & Bình Chánh)' },
  { code: 'HCM_KV4', name: 'TP.HCM - Khu Vực 4 (Phía Tây & Bắc: Tân Bình, Tân Phú, Bình Tân, Q6, Q11, Q12, Hóc Môn, Củ Chi)', shortName: 'TP.HCM (KV4 - Tây & Bắc)' },
  { code: 'HN_NORTH', name: 'Hà Nội & Các Tỉnh Miền Bắc', shortName: 'Hà Nội & Miền Bắc' },
  { code: 'CENTRAL', name: 'Đà Nẵng & Các Tỉnh Miền Trung - Tây Nguyên', shortName: 'Đà Nẵng & Miền Trung' },
  { code: 'SOUTH_PROVINCE', name: 'Miền Tây & Đông Nam Bộ (Ngoại tỉnh TP.HCM)', shortName: 'Miền Tây & Đông Nam Bộ' },
  { code: 'ALL', name: 'Toàn Quốc / Tất Cả Khu Vực (Điều Phối / Cơ Động)', shortName: 'Toàn Quốc (Tất Cả KV)' }
];

// Toạ độ trung tâm gần đúng cho từng khu vực giao hàng — hệ thống chưa tích
// hợp dịch vụ geocode địa chỉ khách thành toạ độ chính xác, nên bản đồ theo
// dõi giao hàng (DeliveryMap.jsx) dùng điểm này làm vị trí đích xấp xỉ, dựa
// trên Order.deliveryRegion đã có sẵn (xem detectDeliveryRegion bên dưới).
export const REGION_COORDS = {
  HCM_KV1: { lat: 10.7769, lng: 106.7009 },
  HCM_KV2: { lat: 10.8386, lng: 106.6653 }, // Gò Vấp / Đông TP.HCM mặc định trọng tâm Gò Vấp
  HCM_KV3: { lat: 10.7411, lng: 106.6989 },
  HCM_KV4: { lat: 10.7756, lng: 106.6250 },
  HN_NORTH: { lat: 21.0285, lng: 105.8542 },
  CENTRAL: { lat: 16.0544, lng: 108.2022 },
  SOUTH_PROVINCE: { lat: 10.9804, lng: 106.6519 },
  ALL: { lat: 10.7769, lng: 106.7009 }
};

// Từ điển toạ độ chi tiết từng Quận/Huyện/Phường trọng điểm
// Giúp bản đồ xác định ngay toạ độ chuẩn của quận/phường khách hàng,
// không bị lệch 10-15km sang Rạch Chiếc hay trung tâm khu vực rộng.
export const DISTRICT_COORDS = [
  // Gò Vấp - Từng phường & tuyến đường
  { match: ['go vap', 'phuong 3'], lat: 10.8242, lng: 106.6785 },
  { match: ['go vap', 'p.3'], lat: 10.8242, lng: 106.6785 },
  { match: ['go vap', 'p3'], lat: 10.8242, lng: 106.6785 },
  { match: ['go vap', 'phuong 1'], lat: 10.8215, lng: 106.6850 },
  { match: ['go vap', 'phuong 4'], lat: 10.8260, lng: 106.6810 },
  { match: ['go vap', 'phuong 5'], lat: 10.8335, lng: 106.6872 },
  { match: ['go vap', 'phuong 6'], lat: 10.8410, lng: 106.6840 },
  { match: ['go vap', 'phuong 7'], lat: 10.8310, lng: 106.6815 },
  { match: ['go vap', 'phuong 8'], lat: 10.8415, lng: 106.6570 },
  { match: ['go vap', 'phuong 9'], lat: 10.8420, lng: 106.6620 },
  { match: ['go vap', 'phuong 10'], lat: 10.8350, lng: 106.6660 },
  { match: ['go vap', 'phuong 11'], lat: 10.8425, lng: 106.6510 },
  { match: ['go vap', 'phuong 12'], lat: 10.8470, lng: 106.6430 },
  { match: ['go vap', 'phuong 13'], lat: 10.8520, lng: 106.6420 },
  { match: ['go vap', 'phuong 14'], lat: 10.8560, lng: 106.6410 },
  { match: ['go vap', 'phuong 15'], lat: 10.8550, lng: 106.6780 },
  { match: ['go vap', 'phuong 16'], lat: 10.8460, lng: 106.6710 },
  { match: ['go vap', 'phuong 17'], lat: 10.8480, lng: 106.6790 },
  { match: ['go vap', 'phan van tri'], lat: 10.8327, lng: 106.6725 },
  { match: ['go vap', 'nguyen oanh'], lat: 10.8390, lng: 106.6780 },
  { match: ['go vap', 'quang trung'], lat: 10.8360, lng: 106.6610 },
  { match: ['go vap', 'le duc tho'], lat: 10.8450, lng: 106.6730 },
  { match: ['go vap', 'nguyen thai son'], lat: 10.8290, lng: 106.6850 },
  { match: ['go vap', 'pham van dong'], lat: 10.8250, lng: 106.6890 },
  { match: ['go vap'], lat: 10.8386, lng: 106.6653 },

  // Bình Thạnh
  { match: ['binh thanh', 'dien bien phu'], lat: 10.7955, lng: 106.7019 },
  { match: ['binh thanh', 'bach dang'], lat: 10.8035, lng: 106.7020 },
  { match: ['binh thanh', 'xo viet nghe tinh'], lat: 10.8010, lng: 106.7110 },
  { match: ['binh thanh', 'thanh da'], lat: 10.8250, lng: 106.7260 },
  { match: ['binh thanh'], lat: 10.8012, lng: 106.7114 },

  // TP. Thủ Đức, Q2, Q9
  { match: ['thao dien'], lat: 10.8039, lng: 106.7329 },
  { match: ['an phu'], lat: 10.8012, lng: 106.7455 },
  { match: ['quan 2'], lat: 10.7872, lng: 106.7498 },
  { match: ['quan 9'], lat: 10.8428, lng: 106.7944 },
  { match: ['thu duc'], lat: 10.8494, lng: 106.7717 },

  // Phú Nhuận
  { match: ['phu nhuan'], lat: 10.7992, lng: 106.6803 },

  // Tân Bình
  { match: ['tan binh', 'cong hoa'], lat: 10.8010, lng: 106.6500 },
  { match: ['tan binh'], lat: 10.8015, lng: 106.6526 },

  // Tân Phú
  { match: ['tan phu'], lat: 10.7900, lng: 106.6285 },

  // Quận 1
  { match: ['ben nghe'], lat: 10.7713, lng: 106.7058 },
  { match: ['ben thanh'], lat: 10.7725, lng: 106.6980 },
  { match: ['da kao'], lat: 10.7861, lng: 106.6942 },
  { match: ['quan 1'], lat: 10.7769, lng: 106.7009 },

  // Quận 3
  { match: ['quan 3'], lat: 10.7844, lng: 106.6845 },

  // Quận 4
  { match: ['quan 4'], lat: 10.7578, lng: 106.7013 },

  // Quận 5
  { match: ['quan 5'], lat: 10.7540, lng: 106.6634 },

  // Quận 6
  { match: ['quan 6'], lat: 10.7481, lng: 106.6352 },

  // Quận 7
  { match: ['phu my hung'], lat: 10.7290, lng: 106.7160 },
  { match: ['tan phong'], lat: 10.7350, lng: 106.7080 },
  { match: ['quan 7'], lat: 10.7411, lng: 106.6989 },

  // Quận 8
  { match: ['quan 8'], lat: 10.7241, lng: 106.6286 },

  // Quận 10
  { match: ['quan 10'], lat: 10.7674, lng: 106.6669 },

  // Quận 11
  { match: ['quan 11'], lat: 10.7629, lng: 106.6504 },

  // Quận 12
  { match: ['quan 12'], lat: 10.8672, lng: 106.6413 },

  // Bình Tân
  { match: ['binh tan'], lat: 10.7654, lng: 106.6038 },

  // Huyện ngoại thành
  { match: ['hoc mon'], lat: 10.8839, lng: 106.5933 },
  { match: ['cu chi'], lat: 10.9733, lng: 106.4938 },
  { match: ['nha be'], lat: 10.6953, lng: 106.7297 },
  { match: ['binh chanh'], lat: 10.6874, lng: 106.5939 },
  { match: ['can gio'], lat: 10.4114, lng: 106.9547 },

  // Các tỉnh lân cận và miền khác
  { match: ['di an'], lat: 10.9069, lng: 106.7722 },
  { match: ['thuan an'], lat: 10.9238, lng: 106.6974 },
  { match: ['thu dau mot'], lat: 10.9804, lng: 106.6519 },
  { match: ['binh duong'], lat: 10.9804, lng: 106.6519 },
  { match: ['bien hoa'], lat: 10.9574, lng: 106.8427 },
  { match: ['dong nai'], lat: 10.9574, lng: 106.8427 },
  { match: ['tan phuoc', 'phu my'], lat: 10.5502574, lng: 107.0511265 },
  { match: ['phu my'], lat: 10.5960, lng: 107.0673 },
  { match: ['vung tau'], lat: 10.3460, lng: 107.0843 },
  { match: ['ba ria'], lat: 10.4960, lng: 107.1685 },
  { match: ['cau giay'], lat: 21.0362, lng: 105.7906 },
  { match: ['dong da'], lat: 21.0181, lng: 105.8273 },
  { match: ['hoan kiem'], lat: 21.0285, lng: 105.8542 },
  { match: ['ha noi'], lat: 21.0285, lng: 105.8542 },
  { match: ['hai chau'], lat: 16.0544, lng: 108.2022 },
  { match: ['da nang'], lat: 16.0544, lng: 108.2022 },
  { match: ['ninh kieu'], lat: 10.0342, lng: 105.7876 },
  { match: ['can tho'], lat: 10.0342, lng: 105.7876 }
];

export function getAddressCoordinates(address) {
  if (!address || typeof address !== 'string') return REGION_COORDS.ALL;
  const norm = address.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  // Toạ độ quận/phường trong từ điển chỉ là của TP.HCM — địa chỉ tỉnh khác
  // (vd. "Trần Phú, Đà Nẵng" chứa chữ "an phu") không được khớp vào đây.
  const zone = detectProvinceZone(address).zone;
  for (const item of (zone === null || zone === 'HCM') ? DISTRICT_COORDS : []) {
    if (item.match.every(m => norm.includes(m))) {
      return { lat: item.lat, lng: item.lng };
    }
  }
  const region = detectDeliveryRegion(address);
  return REGION_COORDS[region] || REGION_COORDS.ALL;
}

// ── Nhận diện tỉnh/thành từ chuỗi địa chỉ ─────────────────────────────
// Tên tỉnh cũ (63) và mới (34, NQ 202/2025/QH15) => nhóm vùng giao hàng.
// Đọc từ CUỐI địa chỉ lên (tỉnh luôn ở cuối) để tên đường như "Nguyễn Huệ",
// "Xa lộ Hà Nội" hay tên phường trùng tên tỉnh không làm nhận nhầm tỉnh.
const PROVINCE_ZONE = {
  'ho chi minh': 'HCM', 'tp hcm': 'HCM', 'tphcm': 'HCM', 'hcm': 'HCM', 'sai gon': 'HCM',
  'binh duong': 'HCM_OUTER', 'ba ria vung tau': 'HCM_OUTER', 'ba ria': 'HCM_OUTER', 'vung tau': 'HCM_OUTER',
  'ha noi': 'NORTH', 'cao bang': 'NORTH', 'tuyen quang': 'NORTH', 'ha giang': 'NORTH', 'dien bien': 'NORTH',
  'lai chau': 'NORTH', 'son la': 'NORTH', 'lao cai': 'NORTH', 'yen bai': 'NORTH', 'thai nguyen': 'NORTH',
  'bac kan': 'NORTH', 'lang son': 'NORTH', 'quang ninh': 'NORTH', 'bac ninh': 'NORTH', 'bac giang': 'NORTH',
  'phu tho': 'NORTH', 'vinh phuc': 'NORTH', 'hoa binh': 'NORTH', 'hai phong': 'NORTH', 'hai duong': 'NORTH',
  'hung yen': 'NORTH', 'thai binh': 'NORTH', 'ninh binh': 'NORTH', 'ha nam': 'NORTH', 'nam dinh': 'NORTH',
  'thanh hoa': 'CENTRAL', 'nghe an': 'CENTRAL', 'ha tinh': 'CENTRAL', 'quang tri': 'CENTRAL', 'quang binh': 'CENTRAL',
  'hue': 'CENTRAL', 'thua thien hue': 'CENTRAL', 'da nang': 'CENTRAL', 'quang nam': 'CENTRAL', 'quang ngai': 'CENTRAL',
  'kon tum': 'CENTRAL', 'gia lai': 'CENTRAL', 'binh dinh': 'CENTRAL', 'khanh hoa': 'CENTRAL', 'ninh thuan': 'CENTRAL',
  'dak lak': 'CENTRAL', 'phu yen': 'CENTRAL', 'lam dong': 'CENTRAL', 'dak nong': 'CENTRAL', 'binh thuan': 'CENTRAL',
  'dong nai': 'SOUTH', 'binh phuoc': 'SOUTH', 'tay ninh': 'SOUTH', 'long an': 'SOUTH', 'can tho': 'SOUTH',
  'soc trang': 'SOUTH', 'hau giang': 'SOUTH', 'vinh long': 'SOUTH', 'ben tre': 'SOUTH', 'tra vinh': 'SOUTH',
  'dong thap': 'SOUTH', 'tien giang': 'SOUTH', 'ca mau': 'SOUTH', 'bac lieu': 'SOUTH', 'an giang': 'SOUTH', 'kien giang': 'SOUTH'
};

// Phường/xã thuộc Bình Dương & Bà Rịa - Vũng Tàu cũ, nay nằm trong TP.HCM mới —
// xa trung tâm nên xếp vùng ngoại thành thay vì KV1-4 nội thành.
const HCM_OUTER_KEYS = ['thu dau mot', 'di an', 'thuan an', 'ben cat', 'tan uyen', 'bau bang', 'dau tieng', 'phu giao',
  'vung tau', 'ba ria', 'long dien', 'dat do', 'xuyen moc', 'chau duc', 'con dao', 'ngai giao', 'kim long'];

const normalizeAddr = (address) => String(address || '')
  .replace(/\(ghi chú[^)]*\)/gi, '')
  .toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');

const stripUnitPrefix = (seg) => seg
  .replace(/^(thanh pho|tinh|tp\.?|t\.)\s*/, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const hasWord = (text, key) => new RegExp(`(^|[^a-z0-9])${key}($|[^a-z0-9])`).test(text);

// Trả về { zone, rest } — zone: HCM | HCM_OUTER | NORTH | CENTRAL | SOUTH | null;
// rest: phần địa chỉ phía trước tỉnh (số nhà, phường...) để chia khu vực chi tiết.
export const detectProvinceZone = (address = '') => {
  const segments = normalizeAddr(address).split(',').map(s => s.trim()).filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const bare = stripUnitPrefix(segments[i]);
    if (PROVINCE_ZONE[bare]) return { zone: PROVINCE_ZONE[bare], rest: segments.slice(0, i).join(', ') };
    // "TP. Hồ Chí Minh (gồm ...)" / "Thành phố HCM - Việt Nam"
    if (hasWord(bare, 'ho chi minh') || hasWord(bare, 'tp hcm') || hasWord(bare, 'tphcm')) {
      return { zone: 'HCM', rest: segments.slice(0, i).join(', ') };
    }
  }
  return { zone: null, rest: segments.join(', ') };
};

// Chia khu vực nội thành TP.HCM theo tên quận/huyện cũ hoặc tên phường mới
// mang tên khu vực cũ (vd. "Phường Gò Vấp", "Phường Bình Thạnh").
const HCM_KV_KEYS = {
  HCM_KV1: ['quan 1', 'quan 3', 'quan 4', 'quan 5', 'quan 10', 'phu nhuan', 'ben nghe', 'ben thanh', 'da kao', 'sai gon',
    'tan dinh', 'vo thi sau', 'xuan hoa', 'ban co', 'vinh hoi', 'khanh hoi', 'xom chieu', 'cho quan', 'an dong', 'dien hong', 'hoa hung'],
  HCM_KV2: ['thu duc', 'quan 2', 'quan 9', 'binh thanh', 'go vap', 'thao dien', 'an khanh', 'binh trung', 'cat lai', 'hiep phu',
    'tang nhon phu', 'long binh', 'linh xuan', 'tam binh', 'hiep binh', 'gia dinh', 'thanh my tay', 'hanh thong', 'an nhon', 'thong tay hoi'],
  HCM_KV3: ['quan 7', 'quan 8', 'nha be', 'binh chanh', 'can gio', 'tan phong', 'phu my hung', 'tan thuan', 'tan my', 'tan hung',
    'chanh hung', 'binh dong', 'phu dinh', 'hiep phuoc'],
  HCM_KV4: ['tan binh', 'tan phu', 'binh tan', 'quan 6', 'quan 11', 'quan 12', 'hoc mon', 'cu chi', 'tan son nhat', 'bay hien',
    'tan son', 'phu tho hoa', 'binh tri dong', 'an lac', 'binh phu', 'minh phung', 'trung my tay', 'dong hung thuan']
};
const detectHcmKv = (addr) => {
  for (const [kv, keys] of Object.entries(HCM_KV_KEYS)) {
    if (keys.some(k => hasWord(addr, k))) return kv;
  }
  return null;
};

export const detectDeliveryRegion = (address = '') => {
  const { zone, rest } = detectProvinceZone(address);
  if (zone === 'NORTH') return 'HN_NORTH';
  if (zone === 'CENTRAL') return 'CENTRAL';
  if (zone === 'SOUTH' || zone === 'HCM_OUTER') return 'SOUTH_PROVINCE';
  if (zone === 'HCM') {
    if (HCM_OUTER_KEYS.some(k => hasWord(rest, k))) return 'SOUTH_PROVINCE';
    return detectHcmKv(rest) || 'HCM_KV1';
  }
  // Không ghi tỉnh (địa chỉ cũ kiểu "..., Quận 1"): thử theo tên quận TP.HCM
  return detectHcmKv(rest) || 'SOUTH_PROVINCE';
};

// Địa chỉ có thuộc TP.HCM (kể cả phần sáp nhập từ Bình Dương / BR-VT) hay không
export const isHcmProvinceAddress = (address = '') => {
  const { zone, rest } = detectProvinceZone(address);
  if (zone) return zone === 'HCM' || zone === 'HCM_OUTER';
  return Boolean(detectHcmKv(rest));
};
