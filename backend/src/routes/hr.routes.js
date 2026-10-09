const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { checkOperationalPermission } = require('../middlewares/rbac.middleware');
const prisma = require('../config/database');
const { STAFF_ROLES, HR_MANAGER_ROLES } = require('../constants/roles');
const { logAudit } = require('../utils/auditLog');
const P = require('../services/hrPolicy');
const { getHrSettings, loadPayrollContext, computePayslip, describePayslip } = require('../services/payrollService');

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const httpError = (status, message) => Object.assign(new Error(message), { statusCode: status });

// Mọi :id ở module nhân sự là số nguyên — mã sai (vd "undefined") trả 400 thay vì lỗi truy vấn 500
router.param('id', (req, res, next, id) => (/^\d+$/.test(id) ? next() : next(httpError(400, 'Mã bản ghi không hợp lệ.'))));
const actorName = (req) => req.user?.name || req.user?.email || `NV #${req.user?.id}`;
const isHrManager = (req) => HR_MANAGER_ROLES.includes(req.user?.role);

// Attendance.date là @db.Date; màn hình cũ gửi chuỗi vi-VN "d/M/yyyy" — parse/format qua
// UTC để tránh lệch ngày do múi giờ server khi đọc/ghi cột Date.
const parseVnDate = (str) => {
  const [d, m, y] = String(str || '').split('/').map(Number);
  if (!d || !m || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
};
const parseAnyDate = (v) => {
  if (!v) return null;
  const vn = parseVnDate(v);
  if (vn) return vn;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return iso ? new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3])) : null;
};
const formatVnDate = (date) => new Date(date).toLocaleDateString('vi-VN', { timeZone: 'UTC' });
const PERIOD_RE = /^\d{4}-\d{2}$/;
const MAX_PHOTO_CHARS = 250000; // ~180KB ảnh JPEG đã thu nhỏ ở client

const cleanPhoto = (img) => (typeof img === 'string' && img.startsWith('data:image/') && img.length <= MAX_PHOTO_CHARS ? img : null);

// ─── Serialize ───────────────────────────────────────────────────────────────

const EMPLOYEE_SELECT = {
  id: true, employeeCode: true, fullName: true, email: true, department: true, role: true, deliveryRegion: true,
  phone: true, baseSalary: true, status: true, createdAt: true, jobTitle: true, hireDate: true,
  responsibilityAllowance: true, allowance: true, dependents: true, annualLeaveQuota: true,
  idNumber: true, personalTaxCode: true, bankName: true, bankAccount: true, faceRegisteredAt: true
};
const serializeEmployee = (e) => e && ({
  ...e,
  baseSalary: parseFloat(e.baseSalary) || 0,
  responsibilityAllowance: parseFloat(e.responsibilityAllowance) || 0,
  allowance: parseFloat(e.allowance) || 0,
  hasFace: Boolean(e.faceRegisteredAt),
  passwordHash: undefined,
  faceDescriptor: undefined,
  faceImage: undefined
});

const serializeAttendance = (l) => ({
  ...l,
  empId: l.employeeId,
  date: formatVnDate(l.date),
  isoDate: P.isoDate(l.date),
  overtimeHours: parseFloat(l.overtimeHours) || 0,
  workHours: parseFloat(l.workHours) || 0,
  faceDistance: l.faceDistance != null ? parseFloat(l.faceDistance) : null,
  checkInPhoto: undefined,
  checkOutPhoto: undefined,
  hasPhoto: Boolean(l.checkInPhoto || l.checkOutPhoto)
});

const DECIMAL_PAYROLL_FIELDS = ['baseSalary', 'allowances', 'bonuses', 'deductions', 'netSalary', 'contractSalary', 'standardDays', 'workDays',
  'paidLeaveDays', 'unpaidDays', 'overtimeHours', 'overtimePay', 'commission', 'assemblyBonus', 'otherBonus', 'grossSalary', 'insuranceSalary',
  'employeeInsurance', 'employerInsurance', 'taxableIncome', 'personalIncomeTax', 'latePenalty', 'otherDeductions'];
const serializePayroll = (p) => {
  const out = { ...p };
  for (const f of DECIMAL_PAYROLL_FIELDS) out[f] = p[f] != null ? parseFloat(p[f]) : null;
  return { ...out, empId: p.employeeId, empName: p.employee?.fullName, salary: out.baseSalary, netAmount: out.netSalary };
};
const PAYROLL_INCLUDE = { employee: { select: { fullName: true, role: true, department: true, employeeCode: true, jobTitle: true, bankName: true, bankAccount: true, dependents: true } } };

// ═══════════════════════════════════════════════════════════════════════════
// 1. TỰ PHỤC VỤ (mọi nhân viên, kể cả tài khoản nhân viên chung EMPLOYEE)
// ═══════════════════════════════════════════════════════════════════════════

const leaveBalance = async (employee, year) => {
  const settings = await getHrSettings();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const [leaves, holidays] = await Promise.all([
    prisma.leaveRequest.findMany({ where: { employeeId: employee.id, startDate: { lt: end }, endDate: { gte: start }, status: { in: ['PENDING', 'APPROVED'] } } }),
    prisma.holiday.findMany({ where: { date: { gte: start, lt: end } } })
  ]);
  const holidaySet = new Set(holidays.map(h => P.isoDate(h.date)));
  const byType = {};
  let used = 0;
  let pending = 0;
  for (const l of leaves) {
    const days = P.countLeaveWorkdays(l.startDate, l.endDate, settings, holidaySet);
    byType[l.type] = (byType[l.type] || 0) + (l.status === 'APPROVED' ? days : 0);
    if (P.ANNUAL_LEAVE_TYPES.includes(l.type)) {
      if (l.status === 'APPROVED') used += days; else pending += days;
    }
  }
  const entitlement = P.annualLeaveEntitlement(employee, year);
  return { year, entitlement, used, pending, remaining: entitlement - used - pending, byType };
};

// GET /hr/me/profile – hồ sơ của chính mình + số ngày phép còn lại
router.get('/me/profile', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const emp = await prisma.employee.findUnique({ where: { id: parseInt(req.user.id) }, select: { ...EMPLOYEE_SELECT, faceImage: true } });
  if (!emp) throw httpError(404, 'Không tìm thấy hồ sơ nhân viên.');
  const balance = await leaveBalance(emp, P.vnToday().getUTCFullYear());
  res.json({ success: true, data: { ...serializeEmployee(emp), faceImage: emp.faceImage, leaveBalance: balance } });
}));

// PUT /hr/me/profile – nhân viên tự cập nhật thông tin liên hệ và tài khoản nhận lương.
// Lương, chức danh, người phụ thuộc phải do HR cập nhật (cần chứng từ).
router.put('/me/profile', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const { phone, bankName, bankAccount } = req.body;
  if (phone && !/^0\d{9}$/.test(String(phone).replace(/[.\s]/g, ''))) throw httpError(400, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.');
  const emp = await prisma.employee.update({
    where: { id: parseInt(req.user.id) },
    data: {
      ...(phone !== undefined ? { phone: phone ? String(phone).replace(/[.\s]/g, '') : null } : {}),
      ...(bankName !== undefined ? { bankName: bankName || null } : {}),
      ...(bankAccount !== undefined ? { bankAccount: bankAccount ? String(bankAccount).replace(/\s/g, '') : null } : {})
    },
    select: EMPLOYEE_SELECT
  });
  logAudit({ req, action: 'UPDATE_OWN_PROFILE', module: 'Nhân Sự', targetId: emp.id, note: emp.fullName });
  res.json({ success: true, data: serializeEmployee(emp) });
}));

// Đăng ký khuôn mặt (dùng chung cho nhân viên tự đăng ký và HR đăng ký hộ tại quầy).
// Chặn trường hợp 1 khuôn mặt đăng ký cho 2 tài khoản — kẽ hở để chấm công hộ.
const registerFace = async (req, employeeId, { descriptor, image }) => {
  if (!P.isValidDescriptor(descriptor)) throw httpError(400, 'Dữ liệu khuôn mặt không hợp lệ. Vui lòng chụp lại.');
  const settings = await getHrSettings();
  const others = await prisma.employee.findMany({
    where: { id: { not: employeeId }, faceRegisteredAt: { not: null } },
    select: { id: true, fullName: true, faceDescriptor: true }
  });
  const duplicate = others.find(o => P.euclideanDistance(o.faceDescriptor, descriptor) < settings.faceMatchThreshold);
  if (duplicate) {
    logAudit({ req, action: 'FACE_REGISTER', module: 'Nhân Sự', status: 'FAILED', targetId: employeeId, note: `Trùng khuôn mặt với NV #${duplicate.id}` });
    throw httpError(409, 'Khuôn mặt này đã được đăng ký cho một nhân viên khác. Vui lòng liên hệ phòng Nhân Sự.');
  }
  const emp = await prisma.employee.update({
    where: { id: employeeId },
    data: { faceDescriptor: descriptor.map(v => Math.round(v * 1e6) / 1e6), faceImage: cleanPhoto(image), faceRegisteredAt: new Date() },
    select: EMPLOYEE_SELECT
  });
  logAudit({ req, action: 'FACE_REGISTER', module: 'Nhân Sự', targetId: emp.id, note: emp.fullName });
  return emp;
};

// POST /hr/me/face – nhân viên tự đăng ký khuôn mặt lần đầu. Đăng ký lại phải qua HR.
router.post('/me/face', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const id = parseInt(req.user.id);
  const current = await prisma.employee.findUnique({ where: { id }, select: { faceRegisteredAt: true } });
  if (!current) throw httpError(404, 'Không tìm thấy hồ sơ nhân viên.');
  if (current.faceRegisteredAt) throw httpError(409, 'Bạn đã đăng ký khuôn mặt. Muốn đăng ký lại, vui lòng đề nghị phòng Nhân Sự đặt lại.');
  const emp = await registerFace(req, id, req.body);
  res.status(201).json({ success: true, message: 'Đăng ký khuôn mặt thành công.', data: serializeEmployee(emp) });
}));

const attendanceSummary = (records) => records.reduce((s, r) => {
  if (['PRESENT', 'LATE'].includes(r.status)) s.workedDays += 1;
  if (r.status === 'LATE') s.lateDays += 1;
  if (r.status === 'ABSENT') s.absentDays += 1;
  s.lateMinutes += (r.lateMinutes || 0);
  s.earlyLeaveMinutes += (r.earlyLeaveMinutes || 0);
  s.overtimeHours += parseFloat(r.overtimeHours) || 0;
  s.workHours += parseFloat(r.workHours) || 0;
  return s;
}, { workedDays: 0, lateDays: 0, absentDays: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeHours: 0, workHours: 0 });

// GET /hr/me/attendance?month=YYYY-MM – lịch sử chấm công của chính mình
router.get('/me/attendance', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const month = PERIOD_RE.test(req.query.month || '') ? req.query.month : P.isoDate(P.vnToday()).slice(0, 7);
  const { start, end } = P.monthRange(month);
  const records = await prisma.attendance.findMany({
    where: { employeeId: parseInt(req.user.id), date: { gte: start, lt: end } },
    orderBy: { date: 'desc' }
  });
  const holidays = await prisma.holiday.findMany({ where: { date: { gte: start, lt: end } } });
  const summary = attendanceSummary(records);
  summary.workHours = Math.round(summary.workHours * 100) / 100;
  res.json({
    success: true,
    data: {
      month,
      records: records.map(serializeAttendance),
      holidays: holidays.map(h => ({ date: P.isoDate(h.date), name: h.name })),
      summary
    }
  });
}));

// GET /hr/me/attendance/today – trạng thái chấm công hôm nay (để màn hình biết đang "vào ca" hay "ra ca")
router.get('/me/attendance/today', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const id = parseInt(req.user.id);
  const today = P.vnToday();
  const [emp, record, settings, holiday] = await Promise.all([
    prisma.employee.findUnique({ where: { id }, select: { faceRegisteredAt: true, fullName: true } }),
    prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: id, date: today } } }),
    getHrSettings(),
    prisma.holiday.findUnique({ where: { date: today } })
  ]);
  res.json({
    success: true,
    data: {
      date: P.isoDate(today),
      now: P.vnNowHHMM(),
      hasFace: Boolean(emp?.faceRegisteredAt),
      record: record ? serializeAttendance(record) : null,
      shift: { start: settings.workStartTime, end: settings.workEndTime, lateGraceMinutes: settings.lateGraceMinutes, breakMinutes: settings.breakMinutes },
      isWorkday: P.isScheduledWorkday(today, settings) && !holiday,
      holiday: holiday ? holiday.name : null
    }
  });
}));

// POST /hr/me/attendance/check – chấm công bằng khuôn mặt. Lần đầu trong ngày là vào ca,
// các lần sau là ra ca (lấy lần ra ca muộn nhất). So khớp khuôn mặt thực hiện ở server
// với vector đã đăng ký — client không thể tự khẳng định "đã khớp".
const MIN_CHECKOUT_GAP_MINUTES = 1;

router.post('/me/attendance/check', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const id = parseInt(req.user.id);
  const { descriptor, image } = req.body;
  if (!P.isValidDescriptor(descriptor)) throw httpError(400, 'Không nhận được dữ liệu khuôn mặt hợp lệ. Vui lòng thử lại.');

  const [emp, settings] = await Promise.all([
    prisma.employee.findUnique({ where: { id }, select: { id: true, fullName: true, status: true, faceDescriptor: true } }),
    getHrSettings()
  ]);
  if (!emp) throw httpError(404, 'Không tìm thấy hồ sơ nhân viên.');
  if (emp.status === 'INACTIVE') throw httpError(403, 'Tài khoản đã ngừng hoạt động.');
  if (!emp.faceDescriptor) throw httpError(409, 'Bạn chưa đăng ký khuôn mặt. Vui lòng đăng ký trước khi chấm công.');

  const distance = P.euclideanDistance(emp.faceDescriptor, descriptor);
  if (!(distance <= settings.faceMatchThreshold)) {
    logAudit({ req, action: 'FACE_CHECK', module: 'Nhân Sự', status: 'FAILED', targetId: id, note: `Không khớp (khoảng cách ${distance.toFixed(3)})` });
    throw httpError(401, 'Khuôn mặt không khớp với hồ sơ đã đăng ký. Hãy nhìn thẳng vào camera, đủ ánh sáng và thử lại.');
  }

  const today = P.vnToday();
  const now = P.vnNowHHMM();
  const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: id, date: today } } });
  const photo = cleanPhoto(image);
  const distanceVal = Math.round(distance * 10000) / 10000;

  let record;
  let action;
  if (!existing || !existing.checkIn) {
    const m = P.computeAttendanceMetrics({ checkIn: now, checkOut: null, settings });
    const data = {
      checkIn: now, checkInMethod: 'FACE', faceDistance: distanceVal, checkInPhoto: photo,
      status: m.status, lateMinutes: m.lateMinutes, updatedBy: emp.fullName
    };
    record = existing
      ? await prisma.attendance.update({ where: { id: existing.id }, data })
      : await prisma.attendance.create({ data: { employeeId: id, date: today, ...data } });
    action = 'CHECK_IN';
  } else {
    // Chống bấm 2 lần liên tiếp: ra ca phải cách vào ca ít nhất 1 phút. Trả lỗi rõ ràng thay vì
    // "thành công" để người dùng biết lần chấm này KHÔNG được ghi nhận là ra ca.
    const sinceIn = P.toMinutes(now) - P.toMinutes(existing.checkIn);
    if (sinceIn < MIN_CHECKOUT_GAP_MINUTES) {
      throw httpError(409, `Bạn vừa chấm vào ca lúc ${existing.checkIn}. Chấm ra ca sau ít nhất ${MIN_CHECKOUT_GAP_MINUTES} phút kể từ giờ vào ca.`);
    }
    const m = P.computeAttendanceMetrics({ checkIn: existing.checkIn, checkOut: now, settings });
    record = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now, checkOutMethod: 'FACE', checkOutPhoto: photo,
        status: m.status, lateMinutes: m.lateMinutes, earlyLeaveMinutes: m.earlyLeaveMinutes,
        workHours: m.workHours, overtimeHours: m.overtimeHours, updatedBy: emp.fullName
      }
    });
    action = 'CHECK_OUT';
  }
  logAudit({ req, action: action === 'CHECK_IN' ? 'FACE_CHECK_IN' : 'FACE_CHECK_OUT', module: 'Nhân Sự', targetId: id, note: `${emp.fullName} ${now} (khoảng cách ${distanceVal})` });

  const r = serializeAttendance(record);
  const message = action === 'CHECK_IN'
    ? (r.lateMinutes > 0 ? `Chấm công vào ca lúc ${now} — đi muộn ${r.lateMinutes} phút.` : `Chấm công vào ca lúc ${now} — đúng giờ.`)
    : `Chấm công ra ca lúc ${now}. Tổng giờ làm ${r.workHours}h${r.overtimeHours ? `, tăng ca ${r.overtimeHours}h` : ''}${r.earlyLeaveMinutes ? `, về sớm ${r.earlyLeaveMinutes} phút` : ''}.`;
  res.json({ success: true, action, message, data: r });
}));

// GET /hr/me/leave-balance?year=YYYY
router.get('/me/leave-balance', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const emp = await prisma.employee.findUnique({ where: { id: parseInt(req.user.id) } });
  if (!emp) throw httpError(404, 'Không tìm thấy hồ sơ nhân viên.');
  const year = parseInt(req.query.year) || P.vnToday().getUTCFullYear();
  res.json({ success: true, data: await leaveBalance(emp, year) });
}));

// ─── Nghỉ phép ───────────────────────────────────────────────────────────────

// GET /hr/leaves – nhân viên xem đơn nghỉ của mình
router.get('/leaves', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const leaves = await prisma.leaveRequest.findMany({
    where: { employeeId: parseInt(req.user.id) },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: leaves });
}));

// POST /hr/leaves – tạo đơn nghỉ (HR/CEO/Admin được tạo hộ qua employeeId)
router.post('/leaves', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  let employeeId = parseInt(req.user.id);
  if (isHrManager(req) && req.body.employeeId) employeeId = parseInt(req.body.employeeId);
  const { type, startDate, endDate, reason } = req.body;
  if (!type || !startDate || !endDate) throw httpError(400, 'Thiếu loại nghỉ, ngày bắt đầu hoặc ngày kết thúc.');
  if (!P.LEAVE_TYPES.includes(type)) throw httpError(400, `Loại nghỉ không hợp lệ. Chọn một trong: ${P.LEAVE_TYPES.join(', ')}.`);

  const start = parseAnyDate(startDate);
  const end = parseAnyDate(endDate);
  if (!start || !end) throw httpError(400, 'Ngày nghỉ không hợp lệ.');
  if (end < start) throw httpError(400, 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');

  const overlap = await prisma.leaveRequest.findFirst({
    where: { employeeId, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: end }, endDate: { gte: start } }
  });
  if (overlap) throw httpError(409, 'Khoảng thời gian này trùng với một đơn nghỉ khác đang chờ duyệt hoặc đã được duyệt.');

  const settings = await getHrSettings();
  const holidays = await prisma.holiday.findMany({ where: { date: { gte: start, lte: end } } });
  const days = P.countLeaveWorkdays(start, end, settings, new Set(holidays.map(h => P.isoDate(h.date))));
  if (days === 0) throw httpError(400, 'Khoảng thời gian đã chọn không có ngày làm việc nào (toàn ngày nghỉ hằng tuần hoặc nghỉ lễ).');

  if (P.ANNUAL_LEAVE_TYPES.includes(type)) {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    const bal = await leaveBalance(emp, start.getUTCFullYear());
    if (days > bal.remaining) throw httpError(400, `Không đủ ngày phép năm: đơn này cần ${days} ngày, bạn còn ${bal.remaining} ngày (đã tính các đơn đang chờ duyệt).`);
  }

  const leave = await prisma.leaveRequest.create({
    data: { employeeId, type, startDate: start, endDate: end, reason: reason || null, status: 'PENDING' },
    include: { employee: { select: { fullName: true, department: true, role: true } } }
  });
  res.status(201).json({ success: true, data: { ...leave, days } });
}));

// DELETE /hr/leaves/:id – nhân viên rút đơn của mình khi còn chờ duyệt
router.delete('/leaves/:id', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!leave || (leave.employeeId !== parseInt(req.user.id) && !isHrManager(req))) throw httpError(404, 'Không tìm thấy đơn nghỉ.');
  if (leave.status !== 'PENDING') throw httpError(409, 'Chỉ rút được đơn đang chờ duyệt.');
  await prisma.leaveRequest.delete({ where: { id: leave.id } });
  res.json({ success: true, message: 'Đã rút đơn nghỉ phép.' });
}));

// GET /hr/leaves/all – HR/CEO xem tất cả đơn nghỉ (kèm số ngày làm việc của từng đơn)
router.get('/leaves/all', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const [leaves, settings, holidays] = await Promise.all([
    prisma.leaveRequest.findMany({ include: { employee: { select: { fullName: true, department: true, role: true } } }, orderBy: { createdAt: 'desc' } }),
    getHrSettings(),
    prisma.holiday.findMany()
  ]);
  const holidaySet = new Set(holidays.map(h => P.isoDate(h.date)));
  res.json({ success: true, data: leaves.map(l => ({ ...l, days: P.countLeaveWorkdays(l.startDate, l.endDate, settings, holidaySet) })) });
}));

const decideLeave = (status) => ah(async (req, res) => {
  const id = parseInt(req.params.id);
  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) throw httpError(404, 'Không tìm thấy đơn nghỉ.');
  if (leave.status !== 'PENDING') throw httpError(409, 'Đơn này đã được xử lý.');
  const approverId = parseInt(req.user.id);
  const reason = status === 'REJECTED' && req.body?.reason
    ? `${leave.reason ? `${leave.reason}\n` : ''}[Lý do từ chối] ${req.body.reason}` : undefined;
  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: { status, approvedBy: Number.isInteger(approverId) ? approverId : null, ...(reason ? { reason } : {}) }
  });
  logAudit({ req, action: status === 'APPROVED' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE', module: 'Nhân Sự', targetId: id });
  res.json({ success: true, data: updated });
});
router.patch('/leaves/:id/approve', authMiddleware(HR_MANAGER_ROLES), decideLeave('APPROVED'));
router.patch('/leaves/:id/reject', authMiddleware(HR_MANAGER_ROLES), decideLeave('REJECTED'));

// ═══════════════════════════════════════════════════════════════════════════
// 2. HỒ SƠ NHÂN VIÊN (HR/CEO/Admin)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/employees', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  // Phân trang tùy chọn qua ?page=&limit= — không truyền thì trả toàn bộ như trước.
  const pageNum = req.query.page ? Math.max(1, parseInt(req.query.page, 10) || 1) : null;
  const limitNum = req.query.limit ? Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50)) : null;
  const isPaginated = Boolean(pageNum && limitNum);
  const totalCount = isPaginated ? await prisma.employee.count() : null;
  const employees = await prisma.employee.findMany({
    select: EMPLOYEE_SELECT,
    orderBy: { createdAt: 'desc' },
    ...(isPaginated ? { skip: (pageNum - 1) * limitNum, take: limitNum } : {})
  });
  res.json({
    success: true,
    data: employees.map(serializeEmployee),
    ...(isPaginated ? { pagination: { page: pageNum, limit: limitNum, total: totalCount, totalPages: Math.ceil(totalCount / limitNum) } } : {})
  });
}));

// GET /hr/employees/shippers – danh sách shipper rút gọn (không lộ lương) cho Kho phân công giao hàng.
router.get('/employees/shippers', authMiddleware(['WAREHOUSE', 'WAREHOUSE_MANAGER', 'SALES', 'SALES_MANAGER', 'CEO', 'ADMIN', 'HR']), ah(async (req, res) => {
  const shippers = await prisma.employee.findMany({
    where: { role: 'DELIVERY', status: 'ACTIVE' },
    select: { id: true, employeeCode: true, fullName: true, phone: true, deliveryRegion: true },
    orderBy: { id: 'asc' }
  });
  res.json({ success: true, data: shippers });
}));

// Chuẩn hóa các trường hồ sơ HR được phép ghi.
const employeeFields = async (body) => {
  const data = {};
  const str = (k) => { if (body[k] !== undefined) data[k] = body[k] === '' ? null : String(body[k]).trim(); };
  ['fullName', 'department', 'role', 'deliveryRegion', 'phone', 'jobTitle', 'idNumber', 'personalTaxCode', 'bankName', 'bankAccount'].forEach(str);
  if (data.fullName === null) delete data.fullName;
  if (data.department === null) delete data.department;
  if (data.role === null) delete data.role;
  const money = (k) => {
    if (body[k] === undefined) return;
    const v = parseFloat(body[k]);
    if (!Number.isFinite(v) || v < 0) throw httpError(400, 'Số tiền lương/phụ cấp không hợp lệ.');
    data[k] = Math.round(v);
  };
  ['baseSalary', 'responsibilityAllowance', 'allowance'].forEach(money);
  if (body.dependents !== undefined) data.dependents = Math.max(0, parseInt(body.dependents) || 0);
  if (body.annualLeaveQuota !== undefined) data.annualLeaveQuota = Math.max(12, parseInt(body.annualLeaveQuota) || 12);
  if (body.hireDate !== undefined) data.hireDate = body.hireDate ? parseAnyDate(body.hireDate) : null;

  if (data.baseSalary !== undefined && data.baseSalary > 0) {
    const settings = await getHrSettings();
    if (data.baseSalary < settings.regionMinimumWage) {
      throw httpError(400, `Lương cơ bản không được thấp hơn lương tối thiểu vùng (${settings.regionMinimumWage.toLocaleString('vi-VN')}đ).`);
    }
  }
  return data;
};

router.post('/employees', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const { fullName, email, department, role, password } = req.body;
  if (!fullName || !email || !department || !role || !password) throw httpError(400, 'Thiếu họ tên, email, phòng ban, chức danh hoặc mật khẩu.');
  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) throw httpError(400, 'Email đã tồn tại');

  const data = await employeeFields(req.body);
  const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
  // Mã NV theo số lớn nhất hiện có thay vì đếm bản ghi — đếm sẽ trùng mã khi đã từng xóa nhân viên.
  const codes = await prisma.employee.findMany({ where: { employeeCode: { startsWith: 'EMP-' } }, select: { employeeCode: true } });
  const maxNo = codes.reduce((m, c) => Math.max(m, parseInt(c.employeeCode.slice(4)) || 0), 0);
  const employeeCode = `EMP-${String(maxNo + 1).padStart(4, '0')}`;

  const emp = await prisma.employee.create({
    data: {
      ...data,
      employeeCode,
      fullName,
      email,
      passwordHash,
      department,
      role,
      deliveryRegion: role === 'DELIVERY' || department === 'Giao Vận' ? (data.deliveryRegion || 'HCM_KV1') : null,
      baseSalary: data.baseSalary ?? 0,
      hireDate: data.hireDate ?? P.vnToday()
    },
    select: EMPLOYEE_SELECT
  });
  logAudit({ req, action: 'CREATE_EMPLOYEE', module: 'Nhân Sự', targetId: emp.id, note: `${emp.fullName} (${emp.role})` });
  res.status(201).json({ success: true, data: serializeEmployee(emp) });
}));

router.patch('/employees/:id/status', authMiddleware(HR_MANAGER_ROLES), checkOperationalPermission('hr_manage_employees'), ah(async (req, res) => {
  const { status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw httpError(400, 'Trạng thái không hợp lệ.');
  const emp = await prisma.employee.update({ where: { id: parseInt(req.params.id) }, data: { status }, select: EMPLOYEE_SELECT });
  logAudit({ req, action: 'UPDATE_EMPLOYEE_STATUS', module: 'Nhân Sự', targetId: emp.id, note: `${emp.fullName} -> ${status}` });
  res.json({ success: true, data: serializeEmployee(emp) });
}));

// PATCH /hr/employees/:id/reset-password – đặt lại mật khẩu về mặc định "123456".
router.patch('/employees/:id/reset-password', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const passwordHash = await bcrypt.hash('123456', await bcrypt.genSalt(10));
  const emp = await prisma.employee.update({ where: { id: parseInt(req.params.id) }, data: { passwordHash }, select: EMPLOYEE_SELECT });
  logAudit({ req, action: 'RESET_PASSWORD', module: 'Bảo Mật', targetId: emp.id, note: emp.fullName });
  res.json({ success: true, message: `Đã đặt lại mật khẩu cho ${emp.fullName} về mặc định.`, data: serializeEmployee(emp) });
}));

router.put('/employees/:id', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const data = await employeeFields(req.body);
  const emp = await prisma.employee.update({ where: { id: parseInt(req.params.id) }, data, select: EMPLOYEE_SELECT });
  logAudit({ req, action: 'UPDATE_EMPLOYEE', module: 'Nhân Sự', targetId: emp.id, note: emp.fullName });
  res.json({ success: true, data: serializeEmployee(emp) });
}));

// GET /hr/employees/:id/face – ảnh mẫu khuôn mặt để HR đối chiếu
router.get('/employees/:id/face', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const emp = await prisma.employee.findUnique({ where: { id: parseInt(req.params.id) }, select: { faceImage: true, faceRegisteredAt: true } });
  if (!emp) throw httpError(404, 'Không tìm thấy nhân viên.');
  res.json({ success: true, data: emp });
}));

// POST /hr/employees/:id/face – HR đăng ký khuôn mặt hộ nhân viên (tại quầy nhân sự)
router.post('/employees/:id/face', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const emp = await registerFace(req, parseInt(req.params.id), req.body);
  res.status(201).json({ success: true, message: `Đã đăng ký khuôn mặt cho ${emp.fullName}.`, data: serializeEmployee(emp) });
}));

// DELETE /hr/employees/:id/face – xóa dữ liệu khuôn mặt để nhân viên đăng ký lại
router.delete('/employees/:id/face', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const emp = await prisma.employee.update({
    where: { id: parseInt(req.params.id) },
    data: { faceDescriptor: null, faceImage: null, faceRegisteredAt: null },
    select: EMPLOYEE_SELECT
  });
  logAudit({ req, action: 'FACE_RESET', module: 'Nhân Sự', targetId: emp.id, note: emp.fullName });
  res.json({ success: true, message: `Đã xóa dữ liệu khuôn mặt của ${emp.fullName}.`, data: serializeEmployee(emp) });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 3. CHẤM CÔNG (HR/CEO/Admin)
// ═══════════════════════════════════════════════════════════════════════════

// GET /hr/attendance?month=YYYY-MM (hoặc ?from=&to=) – mặc định 2 tháng gần nhất
router.get('/attendance', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  let where = {};
  if (PERIOD_RE.test(req.query.month || '')) {
    const { start, end } = P.monthRange(req.query.month);
    where = { date: { gte: start, lt: end } };
  } else if (req.query.from || req.query.to) {
    where = { date: { ...(req.query.from ? { gte: parseAnyDate(req.query.from) } : {}), ...(req.query.to ? { lte: parseAnyDate(req.query.to) } : {}) } };
  } else {
    const today = P.vnToday();
    where = { date: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)) } };
  }
  const logs = await prisma.attendance.findMany({ where, orderBy: { date: 'desc' } });
  res.json({ success: true, data: logs.map(serializeAttendance) });
}));

// GET /hr/attendance/:id/photos – ảnh chụp lúc chấm công (bằng chứng)
router.get('/attendance/:id/photos', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const rec = await prisma.attendance.findUnique({
    where: { id: parseInt(req.params.id) },
    select: { checkInPhoto: true, checkOutPhoto: true, employee: { select: { faceImage: true, fullName: true } } }
  });
  if (!rec) throw httpError(404, 'Không tìm thấy bản ghi chấm công.');
  res.json({ success: true, data: { checkInPhoto: rec.checkInPhoto, checkOutPhoto: rec.checkOutPhoto, registeredFace: rec.employee?.faceImage, fullName: rec.employee?.fullName } });
}));

// POST /hr/attendance – HR chấm công/điều chỉnh thủ công 1 nhân viên/1 ngày (upsert).
// Có giờ vào/ra thì hệ thống tự tính đi muộn, về sớm, giờ làm, tăng ca như chấm khuôn mặt.
router.post('/attendance', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const { empId, employeeId, date, status, checkIn, checkOut, overtimeHours, note } = req.body;
  const finalEmployeeId = parseInt(employeeId ?? empId);
  const finalDate = parseAnyDate(date);
  if (!Number.isInteger(finalEmployeeId) || !finalDate) throw httpError(400, 'Thiếu employeeId hoặc date hợp lệ.');
  for (const t of [checkIn, checkOut]) {
    if (t && P.toMinutes(t) == null) throw httpError(400, 'Giờ chấm công phải theo định dạng HH:mm.');
  }

  const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId: finalEmployeeId, date: finalDate } } });
  const settings = await getHrSettings();
  const inT = checkIn !== undefined ? (checkIn || null) : existing?.checkIn ?? null;
  const outT = checkOut !== undefined ? (checkOut || null) : existing?.checkOut ?? null;

  let data;
  if (status === 'ABSENT') {
    data = { status: 'ABSENT', checkIn: null, checkOut: null, lateMinutes: 0, earlyLeaveMinutes: 0, workHours: 0, overtimeHours: 0 };
  } else if (inT) {
    const m = P.computeAttendanceMetrics({ checkIn: inT, checkOut: outT, settings });
    data = {
      checkIn: inT, checkOut: outT, lateMinutes: m.lateMinutes, earlyLeaveMinutes: outT ? m.earlyLeaveMinutes : 0,
      workHours: m.workHours, overtimeHours: overtimeHours !== undefined ? (parseFloat(overtimeHours) || 0) : m.overtimeHours,
      // HR được ghi đè "Có mặt" khi đi muộn có lý do chính đáng.
      status: status === 'PRESENT' ? 'PRESENT' : m.status,
      ...(status === 'PRESENT' ? { lateMinutes: 0 } : {})
    };
    if (checkIn !== undefined) data.checkInMethod = 'MANUAL';
    if (checkOut !== undefined && checkOut) data.checkOutMethod = 'MANUAL';
  } else {
    // Chấm nhanh không kèm giờ (giữ tương thích nút "Có mặt / Đi muộn / Vắng" cũ).
    data = { status: status || 'PRESENT', ...(overtimeHours !== undefined ? { overtimeHours: parseFloat(overtimeHours) || 0 } : {}), checkInMethod: 'MANUAL' };
  }
  data.updatedBy = actorName(req);
  if (note !== undefined) data.note = note || null;

  const log = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: finalEmployeeId, date: finalDate } },
    update: data,
    create: { employeeId: finalEmployeeId, date: finalDate, ...data }
  });
  logAudit({ req, action: 'MANUAL_ATTENDANCE', module: 'Nhân Sự', targetId: finalEmployeeId, note: `${P.isoDate(finalDate)} ${log.status}` });
  res.status(201).json({ success: true, data: serializeAttendance(log) });
}));

// GET /hr/attendance/timesheet?month=YYYY-MM – bảng công tháng (cùng quy tắc với tính lương)
router.get('/attendance/timesheet', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const month = PERIOD_RE.test(req.query.month || '') ? req.query.month : P.isoDate(P.vnToday()).slice(0, 7);
  const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE' }, orderBy: { id: 'asc' } });
  const ctx = await loadPayrollContext(month, employees);
  const rows = employees.map(e => {
    const s = computePayslip(e, ctx);
    const recs = Object.values(ctx.attendanceByEmp[e.id] || {});
    return {
      employeeId: e.id, employeeCode: e.employeeCode, fullName: e.fullName, role: e.role, department: e.department,
      hasFace: Boolean(e.faceRegisteredAt),
      standardDays: s.standardDays, workDays: s.workDays, paidLeaveDays: s.paidLeaveDays, unpaidDays: s.unpaidDays,
      lateMinutes: s.lateMinutes, overtimeHours: s.overtimeHours,
      recordedDays: recs.filter(r => ['PRESENT', 'LATE'].includes(r.status)).length,
      faceDays: recs.filter(r => r.checkIn && r.status !== 'ABSENT').length,
      lateDays: recs.filter(r => r.status === 'LATE').length,
      absentDays: recs.filter(r => r.status === 'ABSENT').length
    };
  });
  res.json({ success: true, data: { month, strictMode: ctx.settings.attendanceStrictMode, holidays: [...ctx.holidaySet], rows } });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 4. NGÀY LỄ & CẤU HÌNH CÔNG – LƯƠNG
// ═══════════════════════════════════════════════════════════════════════════

router.get('/holidays', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const year = parseInt(req.query.year);
  const where = year ? { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } } : {};
  const list = await prisma.holiday.findMany({ where, orderBy: { date: 'asc' } });
  res.json({ success: true, data: list.map(h => ({ ...h, date: P.isoDate(h.date) })) });
}));

router.post('/holidays', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const date = parseAnyDate(req.body.date);
  const name = String(req.body.name || '').trim();
  if (!date || !name) throw httpError(400, 'Cần nhập ngày và tên ngày lễ.');
  const h = await prisma.holiday.upsert({ where: { date }, update: { name }, create: { date, name } });
  logAudit({ req, action: 'UPSERT_HOLIDAY', module: 'Nhân Sự', note: `${P.isoDate(date)} ${name}` });
  res.status(201).json({ success: true, data: { ...h, date: P.isoDate(h.date) } });
}));

router.delete('/holidays/:id', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  await prisma.holiday.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
}));

const SETTINGS_KEYS = ['workStartTime', 'workEndTime', 'breakMinutes', 'lateGraceMinutes', 'workOnSaturday', 'attendanceStrictMode',
  'faceMatchThreshold', 'regionMinimumWage', 'salesCommissionFlat', 'assemblyBonus', 'absencePenalty'];

router.get('/settings', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const s = await getHrSettings();
  res.json({
    success: true,
    data: {
      ...Object.fromEntries(SETTINGS_KEYS.map(k => [k, s[k]])),
      standardHoursPerDay: P.standardHoursPerDay(s),
      policy: describePayslip({ period: P.isoDate(P.vnToday()).slice(0, 7) })
    }
  });
}));

router.put('/settings', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const b = req.body || {};
  const data = {};
  for (const k of ['workStartTime', 'workEndTime']) {
    if (b[k] !== undefined) {
      if (P.toMinutes(b[k]) == null) throw httpError(400, 'Giờ làm việc phải theo định dạng HH:mm.');
      data[k] = b[k];
    }
  }
  for (const k of ['breakMinutes', 'lateGraceMinutes']) if (b[k] !== undefined) data[k] = Math.max(0, parseInt(b[k]) || 0);
  for (const k of ['workOnSaturday', 'attendanceStrictMode']) if (b[k] !== undefined) data[k] = Boolean(b[k]);
  if (b.faceMatchThreshold !== undefined) {
    const v = parseFloat(b.faceMatchThreshold);
    if (!(v >= 0.3 && v <= 0.7)) throw httpError(400, 'Ngưỡng so khớp khuôn mặt nên trong khoảng 0.30 – 0.70.');
    data.faceMatchThreshold = v;
  }
  if (b.salesCommissionFlat !== undefined) {
    const v = parseFloat(b.salesCommissionFlat);
    if (!(v >= 0 && v <= 20)) throw httpError(400, 'Hoa hồng bán hàng phải từ 0% đến 20%.');
    data.salesCommissionFlat = v;
  }
  for (const k of ['regionMinimumWage', 'assemblyBonus', 'absencePenalty']) {
    if (b[k] !== undefined) {
      const v = parseFloat(b[k]);
      if (!(v >= 0)) throw httpError(400, 'Giá trị tiền không hợp lệ.');
      data[k] = Math.round(v);
    }
  }
  const current = await getHrSettings();
  if (P.toMinutes(data.workEndTime ?? current.workEndTime) <= P.toMinutes(data.workStartTime ?? current.workStartTime)) {
    throw httpError(400, 'Giờ tan ca phải sau giờ vào ca.');
  }

  await prisma.companySettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  logAudit({ req, action: 'UPDATE_HR_SETTINGS', module: 'Nhân Sự', note: Object.keys(data).join(', ') });
  const s = await getHrSettings();
  res.json({ success: true, data: { ...Object.fromEntries(SETTINGS_KEYS.map(k => [k, s[k]])), standardHoursPerDay: P.standardHoursPerDay(s) } });
}));

// ═══════════════════════════════════════════════════════════════════════════
// 5. BẢNG LƯƠNG
// Luồng: HR tính lương (DRAFT) → rà soát/điều chỉnh → trình duyệt (SUBMITTED_TO_ACCOUNTING,
// hiển thị "Chờ Ban Giám Đốc duyệt") → CEO duyệt (APPROVED_BY_CEO) hoặc trả về
// (REJECTED_BY_CEO, HR sửa rồi trình lại) → Kế Toán giải ngân (PAID).
// ═══════════════════════════════════════════════════════════════════════════

const EDITABLE_PAYROLL = ['DRAFT', 'REJECTED_BY_CEO'];

router.get('/payrolls', authMiddleware(['HR', 'CEO', 'ADMIN', 'ACCOUNTANT']), ah(async (req, res) => {
  const where = req.query.period ? { period: String(req.query.period) } : {};
  // Kế Toán không cần thấy bảng lương HR còn đang soạn.
  if (req.user.role === 'ACCOUNTANT') where.status = { notIn: EDITABLE_PAYROLL };
  const payrolls = await prisma.payroll.findMany({ where, include: PAYROLL_INCLUDE, orderBy: [{ period: 'desc' }, { employeeId: 'asc' }] });
  res.json({ success: true, data: payrolls.map(serializePayroll) });
}));

// GET /hr/payrolls/mine – phiếu lương của chính mình (chỉ những kỳ đã được Ban Giám Đốc duyệt)
router.get('/payrolls/mine', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const payrolls = await prisma.payroll.findMany({
    where: { employeeId: parseInt(req.user.id, 10), status: { notIn: [...EDITABLE_PAYROLL, 'SUBMITTED_TO_ACCOUNTING'] } },
    include: PAYROLL_INCLUDE,
    orderBy: { period: 'desc' }
  });
  res.json({ success: true, data: payrolls.map(serializePayroll) });
}));

// GET /hr/payrolls/:id – phiếu lương chi tiết (chủ phiếu hoặc HR/CEO/Admin/Kế Toán)
router.get('/payrolls/:id(\\d+)', authMiddleware(STAFF_ROLES), ah(async (req, res) => {
  const p = await prisma.payroll.findUnique({ where: { id: parseInt(req.params.id) }, include: PAYROLL_INCLUDE });
  const privileged = [...HR_MANAGER_ROLES, 'ACCOUNTANT'].includes(req.user.role);
  if (!p || (!privileged && p.employeeId !== parseInt(req.user.id))) throw httpError(404, 'Không tìm thấy phiếu lương.');
  res.json({ success: true, data: { ...serializePayroll(p), policy: describePayslip(p) } });
}));

// POST /hr/payrolls – HR tính lương kỳ (body: { period }). Tạo bản nháp cho nhân viên chưa có
// phiếu và tính lại các phiếu còn nháp/bị trả về (giữ nguyên khoản điều chỉnh tay).
router.post('/payrolls', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const period = String(req.body.period || '').trim();
  if (!PERIOD_RE.test(period)) throw httpError(400, 'Vui lòng nhập kỳ lương đúng định dạng YYYY-MM (VD: 2026-09).');

  const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE' } });
  const existing = await prisma.payroll.findMany({ where: { period } });
  const byEmp = new Map(existing.map(p => [p.employeeId, p]));
  const targets = employees.filter(e => !byEmp.has(e.id) || EDITABLE_PAYROLL.includes(byEmp.get(e.id).status));
  if (targets.length === 0) throw httpError(409, `Bảng lương kỳ ${period} đã được trình duyệt cho toàn bộ nhân viên, không thể tính lại.`);

  const ctx = await loadPayrollContext(period, targets);
  let created = 0;
  let recalculated = 0;
  await prisma.$transaction(async (tx) => {
    for (const e of targets) {
      const old = byEmp.get(e.id);
      const slip = computePayslip(e, ctx, old ? { otherBonus: old.otherBonus, otherDeductions: old.otherDeductions, note: old.note } : {});
      if (old) {
        await tx.payroll.update({ where: { id: old.id }, data: { ...slip, status: 'DRAFT' } });
        recalculated += 1;
      } else {
        await tx.payroll.create({ data: { ...slip, status: 'DRAFT' } });
        created += 1;
      }
    }
  });
  logAudit({ req, action: 'CALCULATE_PAYROLL', module: 'Nhân Sự', note: `Kỳ ${period}: ${created} mới, ${recalculated} tính lại` });
  const rows = await prisma.payroll.findMany({ where: { period }, include: PAYROLL_INCLUDE, orderBy: { employeeId: 'asc' } });
  res.status(201).json({ success: true, message: `Đã tính lương kỳ ${period}: ${created} phiếu mới, ${recalculated} phiếu tính lại.`, data: rows.map(serializePayroll) });
}));

// PATCH /hr/payrolls/:id/adjust – HR nhập thưởng/khấu trừ khác (có ghi chú) rồi hệ thống tính lại thuế, thực lĩnh.
router.patch('/payrolls/:id/adjust', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const p = await prisma.payroll.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!p) throw httpError(404, 'Không tìm thấy phiếu lương.');
  if (!EDITABLE_PAYROLL.includes(p.status)) throw httpError(409, 'Chỉ điều chỉnh được phiếu lương đang soạn hoặc bị Ban Giám Đốc trả về.');
  const otherBonus = Math.max(0, parseFloat(req.body.otherBonus) || 0);
  const otherDeductions = Math.max(0, parseFloat(req.body.otherDeductions) || 0);
  const note = req.body.note !== undefined ? (String(req.body.note).trim() || null) : p.note;
  if ((otherBonus || otherDeductions) && !note) throw httpError(400, 'Vui lòng ghi rõ lý do thưởng/khấu trừ.');

  const emp = await prisma.employee.findUnique({ where: { id: p.employeeId } });
  const ctx = await loadPayrollContext(p.period, [emp]);
  const slip = computePayslip(emp, ctx, { otherBonus, otherDeductions, note });
  const updated = await prisma.payroll.update({ where: { id: p.id }, data: slip, include: PAYROLL_INCLUDE });
  logAudit({ req, action: 'ADJUST_PAYROLL', module: 'Nhân Sự', targetId: p.id, note: `+${otherBonus} / -${otherDeductions}: ${note || ''}` });
  res.json({ success: true, data: serializePayroll(updated) });
}));

// POST /hr/payrolls/submit – HR trình Ban Giám Đốc duyệt toàn bộ phiếu nháp của kỳ
router.post('/payrolls/submit', authMiddleware(HR_MANAGER_ROLES), ah(async (req, res) => {
  const period = String(req.body.period || '').trim();
  if (!PERIOD_RE.test(period)) throw httpError(400, 'Kỳ lương không hợp lệ.');
  const result = await prisma.payroll.updateMany({
    where: { period, status: { in: EDITABLE_PAYROLL } },
    data: { status: 'SUBMITTED_TO_ACCOUNTING', rejectReason: null }
  });
  if (result.count === 0) throw httpError(409, `Kỳ ${period} không có phiếu lương nháp nào để trình duyệt.`);
  logAudit({ req, action: 'SUBMIT_PAYROLL', module: 'Nhân Sự', note: `Kỳ ${period}: ${result.count} phiếu` });
  res.json({ success: true, message: `Đã trình Ban Giám Đốc duyệt ${result.count} phiếu lương kỳ ${period}.`, data: { count: result.count } });
}));

// PATCH /hr/payrolls/approve-ceo – CEO duyệt bảng lương đang chờ (theo kỳ nếu có)
router.patch('/payrolls/approve-ceo', authMiddleware(['CEO', 'ADMIN']), checkOperationalPermission('hr_approve_payroll_ceo'), ah(async (req, res) => {
  const { period } = req.body;
  const result = await prisma.payroll.updateMany({
    where: { status: 'SUBMITTED_TO_ACCOUNTING', ...(period ? { period } : {}) },
    data: { status: 'APPROVED_BY_CEO', approvedBy: actorName(req), approvedAt: new Date() }
  });
  if (result.count > 0) logAudit({ req, action: 'APPROVE_PAYROLL', module: 'Kế Toán', note: `Kỳ ${period || 'tất cả'}: ${result.count} bảng lương` });
  res.json({ success: true, message: `CEO đã duyệt ${result.count} bảng lương.`, data: { count: result.count } });
}));

// PATCH /hr/payrolls/reject-ceo – CEO trả bảng lương về cho HR điều chỉnh (bắt buộc nêu lý do)
router.patch('/payrolls/reject-ceo', authMiddleware(['CEO', 'ADMIN']), checkOperationalPermission('hr_approve_payroll_ceo'), ah(async (req, res) => {
  const { period } = req.body;
  const reason = String(req.body.reason || '').trim();
  if (!reason) throw httpError(400, 'Vui lòng nêu lý do trả bảng lương về để Nhân Sự điều chỉnh.');
  const result = await prisma.payroll.updateMany({
    where: { status: 'SUBMITTED_TO_ACCOUNTING', ...(period ? { period } : {}) },
    data: { status: 'REJECTED_BY_CEO', rejectReason: reason }
  });
  if (result.count === 0) throw httpError(409, 'Không có bảng lương nào đang chờ duyệt.');
  logAudit({ req, action: 'REJECT_PAYROLL', module: 'Nhân Sự', note: `Kỳ ${period || 'tất cả'}: ${reason}` });
  res.json({ success: true, message: `Đã trả ${result.count} phiếu lương về Nhân Sự.`, data: { count: result.count } });
}));

// POST /hr/payrolls/:id/disburse – Kế toán giải ngân 1 bảng lương, ghi bút toán chi trong cùng transaction.
router.post('/payrolls/:id/disburse', authMiddleware(['ACCOUNTANT', 'CEO', 'ADMIN']), checkOperationalPermission('accounting_disburse_payroll'), ah(async (req, res) => {
  const payroll = await prisma.payroll.findUnique({ where: { id: parseInt(req.params.id) }, include: { employee: { select: { fullName: true } } } });
  if (!payroll) throw httpError(404, `Không tìm thấy bảng lương: ${req.params.id}`);
  if (payroll.status === 'PAID') throw httpError(409, 'Bảng lương này đã được chi trả.');
  if (payroll.status !== 'APPROVED_BY_CEO') throw httpError(409, 'Bảng lương này chưa được Ban Giám Đốc phê duyệt, không thể giải ngân.');

  const result = await prisma.$transaction(async (tx) => {
    // Cập nhật có điều kiện theo trạng thái để 2 lần bấm đồng thời không chi trả trùng.
    const claimed = await tx.payroll.updateMany({ where: { id: payroll.id, status: 'APPROVED_BY_CEO' }, data: { status: 'PAID', paidAt: new Date() } });
    if (claimed.count === 0) throw httpError(409, 'Bảng lương này vừa được xử lý bởi người khác.');
    await tx.ledgerEntry.create({
      data: {
        type: 'EXPENSE',
        amount: payroll.netSalary,
        description: `Chi trả lương kỳ ${payroll.period} — ${payroll.employee?.fullName || `NV #${payroll.employeeId}`}`,
        referenceId: `PAYROLL-${payroll.id}`
      }
    });
    return tx.payroll.findUnique({ where: { id: payroll.id }, include: PAYROLL_INCLUDE });
  });
  logAudit({ req, action: 'DISBURSE_PAYROLL', module: 'Kế Toán', targetId: result.id, note: `${result.employee?.fullName || `NV #${result.employeeId}`}: ${result.netSalary}đ` });
  res.json({ success: true, data: serializePayroll(result) });
}));

// POST /hr/payrolls/disburse-all – Kế toán giải ngân toàn bộ bảng lương đã CEO duyệt.
router.post('/payrolls/disburse-all', authMiddleware(['ACCOUNTANT', 'CEO', 'ADMIN']), checkOperationalPermission('accounting_disburse_payroll'), ah(async (req, res) => {
  const eligible = await prisma.payroll.findMany({ where: { status: 'APPROVED_BY_CEO' }, include: { employee: { select: { fullName: true } } } });
  if (eligible.length === 0) throw httpError(409, 'Không có bảng lương nào đang chờ giải ngân.');
  await prisma.$transaction(async (tx) => {
    await tx.payroll.updateMany({ where: { id: { in: eligible.map(p => p.id) }, status: 'APPROVED_BY_CEO' }, data: { status: 'PAID', paidAt: new Date() } });
    await tx.ledgerEntry.createMany({
      data: eligible.map(p => ({
        type: 'EXPENSE',
        amount: p.netSalary,
        description: `Chi trả lương kỳ ${p.period} — ${p.employee?.fullName || `NV #${p.employeeId}`}`,
        referenceId: `PAYROLL-${p.id}`
      }))
    });
  });
  logAudit({ req, action: 'DISBURSE_PAYROLL', module: 'Kế Toán', note: `Giải ngân hàng loạt: ${eligible.length} bảng lương` });
  res.json({ success: true, message: `Đã giải ngân ${eligible.length} bảng lương.`, data: { count: eligible.length } });
}));

module.exports = router;
