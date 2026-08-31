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

export const detectDeliveryRegion = (address = '') => {
  const addr = (address || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // KV1: Q1, Q3, Q4, Q5, Q10, Phu Nhuan
  if (
    (addr.includes('quan 1') && !addr.includes('quan 10') && !addr.includes('quan 11') && !addr.includes('quan 12')) ||
    addr.includes('quan 3') || addr.includes('quan 4') || addr.includes('quan 5') ||
    addr.includes('quan 10') || addr.includes('phu nhuan') ||
    addr.includes('ben nghe') || addr.includes('ben thanh') || addr.includes('da kao')
  ) {
    return 'HCM_KV1';
  }

  // KV2: Thu Duc, Q2, Q9, Binh Thanh, Go Vap
  if (
    addr.includes('thu duc') || addr.includes('quan 2') || addr.includes('quan 9') ||
    addr.includes('binh thanh') || addr.includes('go vap') || addr.includes('thao dien') || addr.includes('an phu')
  ) {
    return 'HCM_KV2';
  }

  // KV3: Q7, Q8, Nha Be, Binh Chanh, Can Gio
  if (
    addr.includes('quan 7') || addr.includes('quan 8') ||
    addr.includes('nha be') || addr.includes('binh chanh') || addr.includes('can gio') || addr.includes('tan phong') || addr.includes('phu my hung')
  ) {
    return 'HCM_KV3';
  }

  // KV4: Tan Binh, Tan Phu, Binh Tan, Q6, Q11, Q12, Hoc Mon, Cu Chi
  if (
    addr.includes('tan binh') || addr.includes('tan phu') || addr.includes('binh tan') ||
    addr.includes('quan 6') || addr.includes('quan 11') || addr.includes('quan 12') ||
    addr.includes('hoc mon') || addr.includes('cu chi')
  ) {
    return 'HCM_KV4';
  }

  // North / Hanoi
  if (
    addr.includes('ha noi') || addr.includes('hanoi') || addr.includes('hai phong') ||
    addr.includes('quang ninh') || addr.includes('bac ninh') || addr.includes('thai nguyen') ||
    addr.includes('hai duong') || addr.includes('nam dinh') || addr.includes('ha giang') || addr.includes('ngoc ha')
  ) {
    return 'HN_NORTH';
  }

  // Central / Danang
  if (
    addr.includes('da nang') || addr.includes('hue') || addr.includes('quang nam') ||
    addr.includes('khanh hoa') || addr.includes('nha trang') || addr.includes('binh dinh') ||
    addr.includes('quy nhon') || addr.includes('dak lak') || addr.includes('gia lai')
  ) {
    return 'CENTRAL';
  }

  // South Provinces
  if (
    addr.includes('can tho') || addr.includes('binh duong') || addr.includes('dong nai') ||
    addr.includes('vung tau') || addr.includes('long an') || addr.includes('tien giang') ||
    addr.includes('an giang') || addr.includes('kien giang') || addr.includes('ben tre') ||
    addr.includes('vinh long') || addr.includes('tay ninh')
  ) {
    return 'SOUTH_PROVINCE';
  }

  // General HCM fallback
  if (addr.includes('ho chi minh') || addr.includes('hcm') || addr.includes('sai gon')) {
    return 'HCM_KV1';
  }

  return 'SOUTH_PROVINCE';
};
