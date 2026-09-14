// Vietnamese currency-in-words, for official document printing (Phiếu Mua Hàng,
// Phiếu Đề Xuất Mua Hàng...) — Vietnamese business documents conventionally spell
// out the amount in words next to the numeric figure to prevent tampering.
const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function docBaChuSo(baChuSo, dayDu) {
  const tram = Math.floor(baChuSo / 100);
  const chuc = Math.floor((baChuSo % 100) / 10);
  const donvi = baChuSo % 10;
  let ket = '';

  if (tram === 0 && dayDu) {
    ket += 'không trăm';
  } else if (tram > 0) {
    ket += `${CHU_SO[tram]} trăm`;
  }

  if (chuc === 0) {
    if (tram > 0 || dayDu) {
      if (donvi > 0) ket += ' lẻ';
    }
  } else if (chuc === 1) {
    ket += ' mười';
  } else {
    ket += ` ${CHU_SO[chuc]} mươi`;
  }

  if (chuc >= 2 && donvi === 1) {
    ket += ' mốt';
  } else if (chuc >= 1 && donvi === 5) {
    ket += ' lăm';
  } else if (donvi > 0) {
    ket += ` ${CHU_SO[donvi]}`;
  }

  return ket.trim();
}

/** Converts a non-negative integer into Vietnamese words (no currency suffix). */
export function numberToVietnameseWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'không';

  const groups = [];
  let remaining = n;
  while (remaining > 0) {
    groups.unshift(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const UNIT_NAMES = ['', ' nghìn', ' triệu', ' tỷ'];
  let words = '';
  const totalGroups = groups.length;

  groups.forEach((group, idx) => {
    if (group === 0) return;
    const groupIdxFromEnd = totalGroups - idx - 1;
    const dayDu = idx > 0;
    const groupWords = docBaChuSo(group, dayDu);
    words += `${groupWords}${UNIT_NAMES[groupIdxFromEnd] || ''} `;
  });

  return words.trim();
}

/** Formats a VND amount as a capitalized Vietnamese words string ending in "đồng". */
export function formatCurrencyInWords(amount) {
  const n = Math.round(Number(amount) || 0);
  if (n <= 0) return 'Không đồng';
  const words = numberToVietnameseWords(n);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} đồng`;
}
