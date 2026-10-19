// Quy đổi tỉnh/thành CŨ (63 đơn vị) sang tỉnh/thành MỚI (34 đơn vị) theo
// Nghị quyết 202/2025/QH15, có hiệu lực từ 01/07/2025. Giá trị là mã tỉnh mới
// đúng như AddressKit (production.cas.so/address-kit/latest) trả về.
const removeAccents = s => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().trim();

// Bỏ tiền tố "tỉnh / thành phố / tp." để so khớp tên trần
const bareProvinceName = name => removeAccents(name)
  .replace(/\s*\(gom[^)]*\)/g, '')
  .replace(/^(thanh pho|tinh|tp\.?)\s+/, '')
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const PROVINCE_TO_NEW_CODE = {
  // 11 tỉnh/thành giữ nguyên
  'ha noi': '01', 'hn': '01', 'cao bang': '04', 'dien bien': '11', 'lai chau': '12',
  'son la': '14', 'lang son': '20', 'quang ninh': '22', 'thanh hoa': '38',
  'nghe an': '40', 'ha tinh': '42', 'hue': '46', 'thua thien hue': '46',
  // 23 tỉnh/thành mới sau sáp nhập (tên mới + các tên cũ được gộp vào)
  'tuyen quang': '08', 'ha giang': '08',
  'lao cai': '15', 'yen bai': '15',
  'thai nguyen': '19', 'bac kan': '19',
  'phu tho': '25', 'vinh phuc': '25', 'hoa binh': '25',
  'bac ninh': '24', 'bac giang': '24',
  'hung yen': '33', 'thai binh': '33',
  'hai phong': '31', 'hai duong': '31',
  'ninh binh': '37', 'ha nam': '37', 'nam dinh': '37',
  'quang tri': '44', 'quang binh': '44',
  'da nang': '48', 'quang nam': '48',
  'quang ngai': '51', 'kon tum': '51',
  'gia lai': '52', 'binh dinh': '52',
  'khanh hoa': '56', 'ninh thuan': '56',
  'lam dong': '68', 'dak nong': '68', 'binh thuan': '68',
  'dak lak': '66', 'phu yen': '66',
  'ho chi minh': '79', 'hcm': '79', 'sai gon': '79', 'binh duong': '79', 'ba ria vung tau': '79', 'ba ria': '79', 'vung tau': '79',
  'dong nai': '75', 'binh phuoc': '75',
  'tay ninh': '80', 'long an': '80',
  'can tho': '92', 'soc trang': '92', 'hau giang': '92',
  'vinh long': '86', 'ben tre': '86', 'tra vinh': '86',
  'dong thap': '82', 'tien giang': '82',
  'ca mau': '96', 'bac lieu': '96',
  'an giang': '91', 'kien giang': '91'
};

// Tên tỉnh (cũ hoặc mới, có/không dấu, có/không tiền tố) => mã tỉnh mới, null nếu không nhận ra
const toNewProvinceCode = name => {
  if (!name) return null;
  const raw = String(name).trim();
  if (/^\d{1,2}$/.test(raw)) return raw.padStart(2, '0');
  const bare = bareProvinceName(raw);
  if (PROVINCE_TO_NEW_CODE[bare]) return PROVINCE_TO_NEW_CODE[bare];
  // Khớp tên dài nhất xuất hiện trong chuỗi (vd. "TP. Hồ Chí Minh (gồm Bình Dương...)")
  const hit = Object.keys(PROVINCE_TO_NEW_CODE)
    .filter(k => k.length > 3 && bare.includes(k))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? PROVINCE_TO_NEW_CODE[hit] : null;
};

module.exports = { removeAccents, toNewProvinceCode };
