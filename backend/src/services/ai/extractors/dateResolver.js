/**
 * DATE RESOLVER - GIAI ĐOẠN 2: BÓC TÁCH VÀ QUY CHUẨN KHOẢNG THỜI GIAN
 * Chuyển đổi ngôn ngữ tự nhiên tiếng Việt thành Date Objects chuẩn xác (start/end)
 */

const {
  getStartOfDay,
  getEndOfDay,
  getStartOfMonth,
  getEndOfMonth,
  getStartOfYear
} = require('../utils/dateHelper');

/**
 * Lấy ngày bắt đầu và kết thúc của tuần hiện tại (Thứ Hai 00:00 -> Chủ Nhật 23:59:59)
 */
const getWeekRange = (date = new Date(), offsetWeeks = 0) => {
  const d = new Date(date);
  d.setDate(d.getDate() + (offsetWeeks * 7));
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { startDate: monday, endDate: sunday };
};

/**
 * Lấy khoảng thời gian của một tháng cụ thể
 */
const getMonthRange = (year, monthIndex) => {
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return { startDate: start, endDate: end };
};

/**
 * Lấy khoảng thời gian của một quý cụ thể (1, 2, 3, 4)
 */
const getQuarterRange = (year, quarterNumber) => {
  const startMonth = (quarterNumber - 1) * 3;
  const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { startDate: start, endDate: end };
};

/**
 * Hàm phân giải thời gian chính từ chuỗi câu hỏi tự nhiên tiếng Việt
 * @param {string} text 
 * @param {Date} referenceDate (mặc định là thời điểm hiện tại)
 * @returns {object}
 */
const resolveDate = (text, referenceDate = new Date()) => {
  if (!text || typeof text !== 'string') {
    return {
      hasDate: false,
      startDate: null,
      endDate: null,
      periodType: 'NONE',
      label: null,
      period: null
    };
  }

  const lower = text.toLowerCase().trim();
  const now = new Date(referenceDate);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // 1. NGÀY CỤ THỂ HOẶC KHOẢNG NGÀY ĐỊNH DẠNG DD/MM/YYYY
  // Ví dụ: từ ngày 01/10/2026 đến ngày 15/10/2026
  const dateRangeMatch = lower.match(/(?:từ|tu)\s*(?:ngày|ngay)?\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(?:đến|den|tới|toi)\s*(?:ngày|ngay)?\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (dateRangeMatch) {
    const start = new Date(Number(dateRangeMatch[3]), Number(dateRangeMatch[2]) - 1, Number(dateRangeMatch[1]), 0, 0, 0, 0);
    const end = new Date(Number(dateRangeMatch[6]), Number(dateRangeMatch[5]) - 1, Number(dateRangeMatch[4]), 23, 59, 59, 999);
    return {
      hasDate: true,
      startDate: start,
      endDate: end,
      periodType: 'RANGE',
      label: `${dateRangeMatch[1]}/${dateRangeMatch[2]}/${dateRangeMatch[3]} -> ${dateRangeMatch[4]}/${dateRangeMatch[5]}/${dateRangeMatch[6]}`,
      period: 'khoảng ngày chỉ định'
    };
  }

  // Ví dụ: ngày 15/10/2026 hoặc 15/10
  const singleDateMatch = lower.match(/(?:ngày|ngay|vào ngày)\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/i);
  if (singleDateMatch) {
    const year = singleDateMatch[3] ? Number(singleDateMatch[3]) : currentYear;
    const month = Number(singleDateMatch[2]) - 1;
    const day = Number(singleDateMatch[1]);
    const start = new Date(year, month, day, 0, 0, 0, 0);
    const end = new Date(year, month, day, 23, 59, 59, 999);
    return {
      hasDate: true,
      startDate: start,
      endDate: end,
      periodType: 'DAY',
      label: `ngày ${day}/${month + 1}/${year}`,
      period: 'ngày cụ thể'
    };
  }

  // 2. NGÀY TƯƠNG ĐỐI
  // Hôm nay / Bữa nay
  if (/(hôm nay|hom nay|bữa nay|bua nay|trong ngày|trong ngay)/i.test(lower)) {
    return {
      hasDate: true,
      startDate: getStartOfDay(now),
      endDate: getEndOfDay(now),
      periodType: 'DAY',
      label: 'hôm nay',
      period: 'hôm nay'
    };
  }

  // Hôm qua / Bữa qua
  if (/(hôm qua|hom qua|ngày hôm qua|ngay hom qua|bữa qua|bua qua)/i.test(lower)) {
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    return {
      hasDate: true,
      startDate: getStartOfDay(yest),
      endDate: getEndOfDay(yest),
      periodType: 'DAY',
      label: 'hôm qua',
      period: 'hôm qua'
    };
  }

  // Ngày mai / Bữa mai
  if (/(ngày mai|ngay mai|hôm mai|bữa mai|bua mai)/i.test(lower)) {
    const tmr = new Date(now);
    tmr.setDate(now.getDate() + 1);
    return {
      hasDate: true,
      startDate: getStartOfDay(tmr),
      endDate: getEndOfDay(tmr),
      periodType: 'DAY',
      label: 'ngày mai',
      period: 'ngày mai'
    };
  }

  // 3. N NGÀY GẦN ĐÂY
  const lastNDaysMatch = lower.match(/(\d+)\s*(?:ngày|ngay)\s*(?:gần đây|gan day|vừa qua|qua|trở lại đây)/i);
  if (lastNDaysMatch) {
    const n = Number(lastNDaysMatch[1]);
    const past = new Date(now);
    past.setDate(now.getDate() - n);
    past.setHours(0, 0, 0, 0);
    return {
      hasDate: true,
      startDate: past,
      endDate: getEndOfDay(now),
      periodType: 'ROLLING_DAYS',
      label: `${n} ngày qua`,
      period: `${n} ngày qua`
    };
  }

  // 4. TUẦN
  if (/(tuần này|tuan nay|trong tuần|trong tuan)/i.test(lower)) {
    const range = getWeekRange(now, 0);
    return {
      hasDate: true,
      startDate: range.startDate,
      endDate: range.endDate,
      periodType: 'WEEK',
      label: 'tuần này',
      period: 'tuần này'
    };
  }

  if (/(tuần trước|tuan truoc|tuần rồi|tuan roi|tuần vừa rồi)/i.test(lower)) {
    const range = getWeekRange(now, -1);
    return {
      hasDate: true,
      startDate: range.startDate,
      endDate: range.endDate,
      periodType: 'WEEK',
      label: 'tuần trước',
      period: 'tuần trước'
    };
  }

  // 5. THÁNG
  // Tháng cụ thể: tháng 9, tháng 10 năm 2026, tháng 10/2026
  const specificMonthMatch = lower.match(/tháng\s*(\d{1,2})(?:\s*(?:năm|\/)\s*(\d{4}))?/i);
  if (specificMonthMatch) {
    const m = Number(specificMonthMatch[1]);
    const y = specificMonthMatch[2] ? Number(specificMonthMatch[2]) : currentYear;
    if (m >= 1 && m <= 12) {
      const range = getMonthRange(y, m - 1);
      return {
        hasDate: true,
        startDate: range.startDate,
        endDate: range.endDate,
        periodType: 'MONTH',
        label: `tháng ${m}/${y}`,
        period: `tháng ${m}/${y}`
      };
    }
  }

  // Tháng trước
  if (/(tháng trước|thang truoc|tháng rồi|thang roi|tháng vừa rồi)/i.test(lower)) {
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const range = getMonthRange(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
    return {
      hasDate: true,
      startDate: range.startDate,
      endDate: range.endDate,
      periodType: 'MONTH',
      label: 'tháng trước',
      period: 'tháng trước'
    };
  }

  // Tháng này
  if (/(tháng này|thang nay|trong tháng|trong thang|tháng hiện tại)/i.test(lower)) {
    const range = getMonthRange(currentYear, currentMonth);
    return {
      hasDate: true,
      startDate: range.startDate,
      endDate: range.endDate,
      periodType: 'MONTH',
      label: 'tháng này',
      period: 'tháng này'
    };
  }

  // 6. QUÝ (QUARTER)
  const quarterMatch = lower.match(/quý\s*([1-4]|i|ii|iii|iv|một|hai|ba|bốn|tư)(?:\s*(?:năm|\/)\s*(\d{4}))?/i);
  if (quarterMatch) {
    const qStr = quarterMatch[1].toLowerCase();
    let qNum = 1;
    if (qStr === '2' || qStr === 'ii' || qStr === 'hai') qNum = 2;
    if (qStr === '3' || qStr === 'iii' || qStr === 'ba') qNum = 3;
    if (qStr === '4' || qStr === 'iv' || qStr === 'bốn' || qStr === 'tư') qNum = 4;
    const y = quarterMatch[2] ? Number(quarterMatch[2]) : currentYear;
    const range = getQuarterRange(y, qNum);
    return {
      hasDate: true,
      startDate: range.startDate,
      endDate: range.endDate,
      periodType: 'QUARTER',
      label: `quý ${qNum}/${y}`,
      period: `quý ${qNum}`
    };
  }

  // 7. NĂM
  // Năm ngoái / Năm trước
  if (/(năm ngoái|nam ngoai|năm trước|nam truoc)/i.test(lower)) {
    const y = currentYear - 1;
    return {
      hasDate: true,
      startDate: new Date(y, 0, 1, 0, 0, 0, 0),
      endDate: new Date(y, 11, 31, 23, 59, 59, 999),
      periodType: 'YEAR',
      label: `năm ${y}`,
      period: 'năm trước'
    };
  }

  // Năm cụ thể (ví dụ: năm 2025, năm 2026)
  const specificYearMatch = lower.match(/(?:năm|nam)\s*(\d{4})/i);
  if (specificYearMatch) {
    const y = Number(specificYearMatch[1]);
    return {
      hasDate: true,
      startDate: new Date(y, 0, 1, 0, 0, 0, 0),
      endDate: new Date(y, 11, 31, 23, 59, 59, 999),
      periodType: 'YEAR',
      label: `năm ${y}`,
      period: `năm ${y}`
    };
  }

  // Năm nay
  if (/(năm nay|nam nay|cả năm|ca nam|từ đầu năm|tu dau nam|ytd)/i.test(lower)) {
    return {
      hasDate: true,
      startDate: getStartOfYear(now),
      endDate: getEndOfDay(now),
      periodType: 'YEAR',
      label: 'năm nay (YTD)',
      period: 'năm nay'
    };
  }

  // Mặc định không tìm thấy mốc thời gian rõ ràng
  return {
    hasDate: false,
    startDate: null,
    endDate: null,
    periodType: 'NONE',
    label: null,
    period: null
  };
};

module.exports = {
  resolveDate,
  getWeekRange,
  getMonthRange,
  getQuarterRange
};
