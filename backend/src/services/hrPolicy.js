// Quy định lao động – tiền lương – thuế dùng chung cho chấm công và tính lương.
// Tách riêng khỏi route để kiểm thử độc lập và để báo cáo/thuyết minh dẫn nguồn
// một chỗ. Các mức dưới đây cần rà soát lại mỗi khi Nhà nước điều chỉnh.

const VN_TZ = 'Asia/Ho_Chi_Minh';

// ─── Bảo hiểm bắt buộc (Luật BHXH 2024, Luật BHYT, Luật Việc làm) ───
const BASE_SALARY_LEVEL = 2340000;              // lương cơ sở (NĐ 73/2024/NĐ-CP, từ 01/07/2024)
const INSURANCE_CAP = 20 * BASE_SALARY_LEVEL;  // trần lương đóng BHXH, BHYT = 20 × lương cơ sở
const EMPLOYEE_RATES = { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 };   // NLĐ đóng 10.5%
const EMPLOYER_RATES = { bhxh: 0.175, bhyt: 0.03, bhtn: 0.01 };   // DN đóng 21.5% (gồm 0.5% TNLĐ-BNN)
// Nghỉ không hưởng lương từ 14 ngày làm việc trở lên trong tháng thì tháng đó không đóng BHXH.
const NO_INSURANCE_UNPAID_DAYS = 14;

// ─── Thuế thu nhập cá nhân ───
// Giảm trừ gia cảnh: 15,5 triệu/tháng bản thân, 6,2 triệu/người phụ thuộc từ kỳ tính thuế 2026
// (Nghị quyết 110/2025/UBTVQH15); trước đó 11 triệu và 4,4 triệu.
const familyDeduction = (period) => (period >= '2026-01'
  ? { self: 15500000, dependent: 6200000 }
  : { self: 11000000, dependent: 4400000 });

// Biểu thuế lũy tiến từng phần theo tháng. Luật Thuế TNCN số 109/2025/QH15 có hiệu lực từ 01/07/2026
// nhưng quy định về thu nhập từ tiền lương, tiền công của cá nhân cư trú áp dụng từ kỳ tính thuế 2026,
// nên biểu 5 bậc dùng cho mọi kỳ lương từ 01/2026; trước đó là biểu 7 bậc của Luật Thuế TNCN 2007.
const TAX_BRACKETS_7 = [[5e6, 0.05], [10e6, 0.10], [18e6, 0.15], [32e6, 0.20], [52e6, 0.25], [80e6, 0.30], [Infinity, 0.35]];
const TAX_BRACKETS_5 = [[10e6, 0.05], [30e6, 0.10], [60e6, 0.20], [100e6, 0.30], [Infinity, 0.35]];
const NEW_PIT_LAW_PERIOD = '2026-01';
const taxBrackets = (period) => (period >= NEW_PIT_LAW_PERIOD ? TAX_BRACKETS_5 : TAX_BRACKETS_7);
// Tiền lương làm thêm giờ: từ kỳ tính thuế 2026 được miễn thuế toàn bộ (khoản 8 Điều 4 Luật 109/2025/QH15);
// trước đó chỉ miễn phần trả cao hơn so với giờ làm việc bình thường.
const overtimeFullyExempt = (period) => period >= NEW_PIT_LAW_PERIOD;

const progressiveTax = (taxable, period) => {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of taxBrackets(period)) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return Math.round(tax);
};

// Phụ cấp ăn giữa ca không tính thuế TNCN tối đa 730.000đ/tháng.
const MEAL_ALLOWANCE_TAX_FREE = 730000;

// ─── Tăng ca (Bộ luật Lao động 2019, Điều 98) ───
const OT_RATE = { WEEKDAY: 1.5, REST_DAY: 2.0, HOLIDAY: 3.0 };

// Loại nghỉ không hưởng lương; mọi loại khác (phép năm, ốm, việc riêng có lương) được trả lương.
const UNPAID_LEAVE_TYPES = ['Không Lương'];
// Loại nghỉ trừ vào quỹ phép năm.
const ANNUAL_LEAVE_TYPES = ['Phép Năm'];
// Danh sách loại nghỉ hợp lệ duy nhất (khớp form ở EmployeePortal/Sidebar/HRManager). Loại khác bị từ chối —
// trước đây gửi loại tự đặt (vd "ANNUAL") là vượt được quỹ phép mà vẫn được tính lương.
const LEAVE_TYPES = ['Phép Năm', 'Nghỉ Ốm', 'Việc Riêng', 'Không Lương'];

// ─── Thời gian theo giờ Việt Nam ───
const vnParts = (d = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map(p => [p.type, p.value])
  );
  return { y: +parts.year, m: +parts.month, d: +parts.day, hh: +parts.hour, mm: +parts.minute };
};

// Ngày hôm nay theo giờ VN, biểu diễn ở nửa đêm UTC (đúng cách cột @db.Date lưu).
const vnToday = (d = new Date()) => {
  const p = vnParts(d);
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
};
const vnNowHHMM = (d = new Date()) => {
  const p = vnParts(d);
  return `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`;
};

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  return m ? (+m[1]) * 60 + (+m[2]) : null;
};
const isoDate = (date) => new Date(date).toISOString().slice(0, 10);

// Số giờ làm chuẩn/ngày suy ra từ ca làm việc trong cấu hình.
const standardHoursPerDay = (settings) => {
  const start = toMinutes(settings.workStartTime) ?? 480;
  const end = toMinutes(settings.workEndTime) ?? 1050;
  const hours = (end - start - (settings.breakMinutes ?? 90)) / 60;
  return hours > 0 ? hours : 8;
};

// Tính đi muộn, về sớm, giờ làm và giờ tăng ca từ giờ vào/ra thực tế.
const LUNCH_START = 12 * 60; // nghỉ trưa bắt đầu 12:00, kéo dài settings.breakMinutes phút

/**
 * Tính số phút đi muộn, về sớm, giờ làm thực tế và giờ tăng ca của một ngày.
 * Mọi khoảng thời gian đều tính theo PHÚT LÀM VIỆC THỰC, tức đã loại phần trùng với giờ nghỉ trưa:
 * vào ca 13:00 với ca 08:00 thì chỉ thiếu 240 phút làm việc (không phải 300), làm 08:00–13:00 là 4 giờ.
 * Tổng phút muộn + về sớm không vượt quá thời lượng ca, để tiền trừ chuyên cần của một ngày không bao
 * giờ lớn hơn tiền công của chính ngày đó (kể cả khi chấm vào ca sau giờ tan ca).
 */
const computeAttendanceMetrics = ({ checkIn, checkOut, settings }) => {
  const start = toMinutes(settings.workStartTime) ?? 480;
  const end = toMinutes(settings.workEndTime) ?? 1050;
  const grace = settings.lateGraceMinutes ?? 5;
  const breakMin = settings.breakMinutes ?? 90;
  const lunchEnd = LUNCH_START + breakMin;
  const inMin = toMinutes(checkIn);
  const outMin = toMinutes(checkOut);
  // Số phút làm việc trong khoảng [a, b), trừ phần trùng giờ nghỉ trưa.
  const workingMinutes = (a, b) => (b <= a ? 0 : (b - a) - Math.max(0, Math.min(b, lunchEnd) - Math.max(a, LUNCH_START)));
  const shiftMinutes = workingMinutes(start, end);

  const rawLate = inMin != null ? workingMinutes(start, Math.min(inMin, end)) : 0;
  const lateMinutes = rawLate > grace ? rawLate : 0;
  let earlyLeaveMinutes = outMin != null && (inMin == null || outMin > inMin)
    ? workingMinutes(Math.max(outMin, start), end) : 0;
  earlyLeaveMinutes = Math.min(earlyLeaveMinutes, Math.max(0, shiftMinutes - lateMinutes));

  let workHours = 0;
  let overtimeHours = 0;
  if (inMin != null && outMin != null && outMin > inMin) {
    workHours = workingMinutes(inMin, outMin) / 60;
    // Tăng ca: phần làm sau giờ tan ca từ 30 phút trở lên, làm tròn xuống từng nửa giờ.
    const afterEnd = outMin - Math.max(end, inMin);
    if (afterEnd >= 30) overtimeHours = Math.floor(afterEnd / 30) * 0.5;
  }
  return {
    lateMinutes,
    earlyLeaveMinutes,
    workHours: Math.round(workHours * 100) / 100,
    overtimeHours,
    status: lateMinutes > 0 ? 'LATE' : 'PRESENT'
  };
};

// Ngày làm việc theo lịch công ty (T2–T7 hoặc T2–T6), ngày = Date ở nửa đêm UTC.
const isScheduledWorkday = (date, settings) => {
  const dow = new Date(date).getUTCDay();
  if (dow === 0) return false;
  if (dow === 6 && settings.workOnSaturday === false) return false;
  return true;
};

const monthRange = (period) => {
  const [y, m] = period.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
};

const eachDay = (start, end) => {
  const days = [];
  for (let t = start.getTime(); t < end.getTime(); t += 86400000) days.push(new Date(t));
  return days;
};

// Số ngày làm việc (không tính ngày nghỉ hằng tuần và ngày lễ) giữa 2 ngày, tính cả 2 đầu.
const countLeaveWorkdays = (startDate, endDate, settings, holidaySet = new Set()) => {
  const s = new Date(startDate);
  const e = new Date(endDate);
  let n = 0;
  for (let t = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()); t <= e.getTime(); t += 86400000) {
    const d = new Date(t);
    if (isScheduledWorkday(d, settings) && !holidaySet.has(isoDate(d))) n += 1;
  }
  return n;
};

// Phép năm: 12 ngày (BLLĐ 2019, Điều 113) + 1 ngày cho mỗi đủ 5 năm làm việc (Điều 114).
const annualLeaveEntitlement = (employee, year) => {
  const quota = employee.annualLeaveQuota ?? 12;
  if (!employee.hireDate) return quota;
  const hire = new Date(employee.hireDate);
  const years = year - hire.getUTCFullYear() - (hire.getUTCMonth() > 0 || hire.getUTCDate() > 1 ? 1 : 0);
  return quota + Math.max(0, Math.floor(years / 5));
};

const euclideanDistance = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = Number(a[i]) - Number(b[i]);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

const isValidDescriptor = (d) => Array.isArray(d) && d.length === 128 && d.every(v => typeof v === 'number' && Number.isFinite(v));

module.exports = {
  VN_TZ, BASE_SALARY_LEVEL, INSURANCE_CAP, EMPLOYEE_RATES, EMPLOYER_RATES, NO_INSURANCE_UNPAID_DAYS,
  familyDeduction, taxBrackets, overtimeFullyExempt, progressiveTax, MEAL_ALLOWANCE_TAX_FREE, OT_RATE,
  UNPAID_LEAVE_TYPES, ANNUAL_LEAVE_TYPES, LEAVE_TYPES,
  vnToday, vnNowHHMM, toMinutes, isoDate, standardHoursPerDay, computeAttendanceMetrics,
  isScheduledWorkday, monthRange, eachDay, countLeaveWorkdays, annualLeaveEntitlement,
  euclideanDistance, isValidDescriptor
};
