const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { checkOperationalPermission } = require('../middlewares/rbac.middleware');
const prisma = require('../config/database');
const { QC_ROLES } = require('../constants/roles');
const { logAudit } = require('../utils/auditLog');

// Attendance.date là @db.Date; frontend so khớp theo chuỗi vi-VN "d/M/yyyy"
// (HRManager.jsx dùng .toLocaleDateString('vi-VN') làm khóa so sánh) — parse/
// format qua UTC để tránh lệch ngày do múi giờ server khi đọc/ghi cột Date.
const parseVnDate = (str) => {
  const [d, m, y] = String(str || '').split('/').map(Number);
  if (!d || !m || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
};
const formatVnDate = (date) => new Date(date).toLocaleDateString('vi-VN', { timeZone: 'UTC' });

// ─── Leave Requests (tự phục vụ) ─────────────────────────────────────────────

// GET /api/v1/hr/leaves – nhân viên xem đơn nghỉ của mình
router.get('/leaves', authMiddleware(['CEO', 'ADMIN', 'HR', 'SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'ASSEMBLY', 'ACCOUNTANT', 'PURCHASING', 'CSKH', 'DELIVERY', ...QC_ROLES]), async (req, res, next) => {
  try {
    const employeeId = req.user.id;
    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: parseInt(employeeId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: leaves });
  } catch (err) { next(err); }
});

// POST /api/v1/hr/leaves – nhân viên tạo đơn nghỉ
router.post('/leaves', authMiddleware(['CEO', 'ADMIN', 'HR', 'SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'ASSEMBLY', 'ACCOUNTANT', 'PURCHASING', 'CSKH', 'DELIVERY', ...QC_ROLES]), async (req, res, next) => {
  try {
    const employeeId = parseInt(req.user.id);
    const { type, startDate, endDate, reason } = req.body;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason || null,
        status: 'PENDING'
      }
    });
    res.status(201).json({ success: true, data: leave });
  } catch (err) { next(err); }
});

// GET /api/v1/hr/leaves/all – HR/CEO xem tất cả đơn nghỉ
router.get('/leaves/all', authMiddleware(['HR', 'CEO', 'ADMIN']), async (req, res, next) => {
  try {
    const leaves = await prisma.leaveRequest.findMany({
      include: {
        employee: { select: { fullName: true, department: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: leaves });
  } catch (err) { next(err); }
});

// PATCH /api/v1/hr/leaves/:id/approve – CEO/HR phê duyệt
router.patch('/leaves/:id/approve', authMiddleware(['HR', 'CEO', 'ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const approverId = parseInt(req.user.id);
    const leave = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'APPROVED', approvedBy: isNaN(approverId) ? null : approverId }
    });
    res.json({ success: true, data: leave });
  } catch (err) { next(err); }
});

// PATCH /api/v1/hr/leaves/:id/reject – CEO/HR từ chối
router.patch('/leaves/:id/reject', authMiddleware(['HR', 'CEO', 'ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const leave = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'REJECTED' }
    });
    res.json({ success: true, data: leave });
  } catch (err) { next(err); }
});

// ─── Employee Management (Admin) ─────────────────────────────────────────────

// GET /api/v1/hr/employees – danh sách nhân viên (HR/CEO/Admin)
router.get('/employees', authMiddleware(['HR', 'CEO', 'ADMIN']), async (req, res, next) => {
  try {
    // Pagination is opt-in via ?page=&limit= — omit both to keep getting the
    // full list, since HR/Dashboard pages currently expect it all at once.
    const pageNum = req.query.page ? Math.max(1, parseInt(req.query.page, 10) || 1) : null;
    const limitNum = req.query.limit ? Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50)) : null;
    const isPaginated = Boolean(pageNum && limitNum);

    const totalCount = isPaginated ? await prisma.employee.count() : null;
    const employees = await prisma.employee.findMany({
      select: { id: true, employeeCode: true, fullName: true, email: true, department: true, role: true, deliveryRegion: true, phone: true, baseSalary: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      ...(isPaginated ? { skip: (pageNum - 1) * limitNum, take: limitNum } : {})
    });
    res.json({
      success: true,
      data: employees,
      ...(isPaginated ? { pagination: { page: pageNum, limit: limitNum, total: totalCount, totalPages: Math.ceil(totalCount / limitNum) } } : {})
    });
  } catch (err) { next(err); }
});

// POST /api/v1/hr/employees – tạo nhân viên mới (Admin)
router.post('/employees', authMiddleware(['ADMIN', 'HR', 'CEO']), async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const { fullName, email, department, role, baseSalary, password, deliveryRegion, phone } = req.body;
    if (!fullName || !email || !department || !role || !password) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }
    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ success: false, message: 'Email đã tồn tại' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const count = await prisma.employee.count();
    const employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`;

    const emp = await prisma.employee.create({
      data: {
        employeeCode,
        fullName,
        email,
        passwordHash,
        department,
        role,
        deliveryRegion: role === 'DELIVERY' || department === 'Giao Vận' ? (deliveryRegion || 'HCM_KV1') : null,
        phone: phone || null,
        baseSalary: parseFloat(baseSalary) || 0
      }
    });
    logAudit({ req, action: 'CREATE_EMPLOYEE', module: 'Nhân Sự', targetId: emp.id, note: `${emp.fullName} (${emp.role})` });
    res.status(201).json({ success: true, data: { ...emp, passwordHash: undefined } });
  } catch (err) { next(err); }
});

// PATCH /api/v1/hr/employees/:id/status – kích hoạt/vô hiệu hóa tài khoản
router.patch('/employees/:id/status', authMiddleware(['ADMIN', 'HR', 'CEO']), checkOperationalPermission('hr_manage_employees'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const emp = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: { status }
    });
    logAudit({ req, action: 'UPDATE_EMPLOYEE_STATUS', module: 'Nhân Sự', targetId: emp.id, note: `${emp.fullName} -> ${status}` });
    res.json({ success: true, data: { ...emp, passwordHash: undefined } });
  } catch (err) { next(err); }
});

// PATCH /api/v1/hr/employees/:id/reset-password – đặt lại mật khẩu về mặc
// định "123456". SystemAdmin.jsx's "Reset Pass" nút trước đây không gọi API
// nào cả — chỉ hiện toast "đã đặt lại thành công" trong khi mật khẩu thật
// không hề đổi.
router.patch('/employees/:id/reset-password', authMiddleware(['ADMIN', 'HR', 'CEO']), async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const { id } = req.params;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('123456', salt);
    const emp = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: { passwordHash }
    });
    logAudit({ req, action: 'RESET_PASSWORD', module: 'Bảo Mật', targetId: emp.id, note: emp.fullName });
    res.json({ success: true, message: `Đã đặt lại mật khẩu cho ${emp.fullName} về mặc định.`, data: { ...emp, passwordHash: undefined } });
  } catch (err) { next(err); }
});

// PUT /api/v1/hr/employees/:id – cập nhật thông tin nhân viên
router.put('/employees/:id', authMiddleware(['ADMIN', 'HR', 'CEO']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, department, role, deliveryRegion, phone, baseSalary } = req.body;
    const emp = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: {
        ...(fullName ? { fullName } : {}),
        ...(department ? { department } : {}),
        ...(role ? { role } : {}),
        ...(deliveryRegion !== undefined ? { deliveryRegion } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(baseSalary !== undefined ? { baseSalary: parseFloat(baseSalary) || 0 } : {})
      }
    });
    logAudit({ req, action: 'UPDATE_EMPLOYEE', module: 'Nhân Sự', targetId: emp.id, note: emp.fullName });
    res.json({ success: true, data: { ...emp, passwordHash: undefined } });
  } catch (err) { next(err); }
});

// ─── Attendance (chấm công) ───────────────────────────────────────────────

// GET /api/v1/hr/attendance – HR/CEO/Admin xem toàn bộ chấm công
router.get('/attendance', authMiddleware(['HR', 'CEO', 'ADMIN']), async (req, res, next) => {
  try {
    const logs = await prisma.attendance.findMany({ orderBy: { date: 'desc' } });
    const serialized = logs.map(l => ({
      ...l,
      empId: l.employeeId,
      date: formatVnDate(l.date)
    }));
    res.json({ success: true, data: serialized });
  } catch (err) { next(err); }
});

// POST /api/v1/hr/attendance – HR đánh dấu chấm công 1 nhân viên/1 ngày
// (upsert theo unique [employeeId, date] đã có sẵn trong schema)
router.post('/attendance', authMiddleware(['HR', 'CEO', 'ADMIN']), async (req, res, next) => {
  try {
    const { empId, employeeId, date, status, checkIn, checkOut, overtimeHours } = req.body;
    const finalEmployeeId = parseInt(employeeId ?? empId);
    const finalDate = parseVnDate(date) || (date ? new Date(date) : null);

    if (!Number.isInteger(finalEmployeeId) || !finalDate) {
      return res.status(400).json({ success: false, message: 'Thiếu employeeId hoặc date hợp lệ.' });
    }

    const log = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: finalEmployeeId, date: finalDate } },
      update: {
        ...(status ? { status } : {}),
        ...(checkIn !== undefined ? { checkIn } : {}),
        ...(checkOut !== undefined ? { checkOut } : {}),
        ...(overtimeHours !== undefined ? { overtimeHours: parseFloat(overtimeHours) || 0 } : {})
      },
      create: {
        employeeId: finalEmployeeId,
        date: finalDate,
        status: status || 'PRESENT',
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        overtimeHours: parseFloat(overtimeHours) || 0
      }
    });
    res.status(201).json({ success: true, data: { ...log, empId: log.employeeId, date: formatVnDate(log.date) } });
  } catch (err) { next(err); }
});

// ─── Payroll (bảng lương) ─────────────────────────────────────────────────

const serializePayroll = (p) => ({
  ...p,
  empId: p.employeeId,
  empName: p.employee?.fullName,
  salary: parseFloat(p.baseSalary),
  netAmount: parseFloat(p.netSalary)
});

// GET /api/v1/hr/payrolls – HR/CEO/Kế toán xem bảng lương
router.get('/payrolls', authMiddleware(['HR', 'CEO', 'ADMIN', 'ACCOUNTANT']), async (req, res, next) => {
  try {
    const payrolls = await prisma.payroll.findMany({
      include: { employee: { select: { fullName: true, role: true, department: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: payrolls.map(serializePayroll) });
  } catch (err) { next(err); }
});

// POST /api/v1/hr/payrolls – HR lập bảng lương kỳ mới cho toàn bộ nhân viên
// ACTIVE (body: { period }). Bỏ qua nhân viên đã có bảng lương kỳ đó rồi.
router.post('/payrolls', authMiddleware(['HR', 'CEO', 'ADMIN']), async (req, res, next) => {
  try {
    const { period } = req.body;
    if (!period || !String(period).trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập kỳ lương (VD: 2026-09).' });
    }

    const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE' } });
    const existing = await prisma.payroll.findMany({ where: { period } });
    const existingEmpIds = new Set(existing.map(p => p.employeeId));

    const toCreate = employees.filter(e => !existingEmpIds.has(e.id));
    if (toCreate.length === 0) {
      return res.status(409).json({ success: false, message: `Bảng lương kỳ ${period} đã được lập cho toàn bộ nhân viên.` });
    }

    // Khớp đúng công thức đã hiển thị ở HRManager.jsx tab "Bảng Lương" (preview
    // "Dự Thảo" trước khi có route thật): hoa hồng bán hàng cho SALES, thưởng
    // lắp ráp cho ASSEMBLY, khấu trừ cố định cho mọi nhân viên. Hai mức đầu giờ
    // đọc từ CompanySettings (Admin > Cấu Hình) thay vì hardcode — quản trị viên
    // đổi được thật, không còn là hằng số cứng không ai chỉnh nổi.
    const settings = await prisma.companySettings.findUnique({ where: { id: 1 } });
    const SALES_COMMISSION = settings ? parseFloat(settings.salesCommissionFlat) : 1250000;
    const ASSEMBLY_BONUS = settings ? parseFloat(settings.assemblyBonus) : 750000;
    const FLAT_DEDUCTION = 50000;

    await prisma.payroll.createMany({
      data: toCreate.map(e => {
        const base = parseFloat(e.baseSalary) || 0;
        const commission = e.role === 'SALES' ? SALES_COMMISSION : 0;
        const assemblyBonus = e.role === 'ASSEMBLY' ? ASSEMBLY_BONUS : 0;
        const bonuses = commission + assemblyBonus;
        const netSalary = base + bonuses - FLAT_DEDUCTION;
        return {
          employeeId: e.id,
          period,
          baseSalary: base,
          allowances: 0,
          bonuses,
          deductions: FLAT_DEDUCTION,
          netSalary,
          status: 'SUBMITTED_TO_ACCOUNTING'
        };
      })
    });

    const created = await prisma.payroll.findMany({
      where: { period, employeeId: { in: toCreate.map(e => e.id) } },
      include: { employee: { select: { fullName: true, role: true, department: true } } }
    });
    res.status(201).json({ success: true, data: created.map(serializePayroll) });
  } catch (err) { next(err); }
});

// PATCH /api/v1/hr/payrolls/approve-ceo – CEO duyệt toàn bộ bảng lương đang
// chờ (SUBMITTED_TO_ACCOUNTING) sang APPROVED_BY_CEO, theo kỳ (body: { period })
router.patch('/payrolls/approve-ceo', authMiddleware(['CEO', 'ADMIN']), checkOperationalPermission('hr_approve_payroll_ceo'), async (req, res, next) => {
  try {
    const { period } = req.body;
    const result = await prisma.payroll.updateMany({
      where: { status: 'SUBMITTED_TO_ACCOUNTING', ...(period ? { period } : {}) },
      data: { status: 'APPROVED_BY_CEO' }
    });
    if (result.count > 0) {
      logAudit({ req, action: 'APPROVE_PAYROLL', module: 'Kế Toán', note: `Kỳ ${period || 'tất cả'}: ${result.count} bảng lương` });
    }
    res.json({ success: true, message: `CEO đã duyệt ${result.count} bảng lương.`, data: { count: result.count } });
  } catch (err) { next(err); }
});

// POST /api/v1/hr/payrolls/:id/disburse – Kế toán giải ngân 1 bảng lương,
// tự động ghi 1 bút toán chi (EXPENSE) thật vào Sổ Cái trong cùng transaction.
router.post('/payrolls/:id/disburse', authMiddleware(['ACCOUNTANT', 'CEO', 'ADMIN']), checkOperationalPermission('accounting_disburse_payroll'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const payroll = await prisma.payroll.findUnique({
      where: { id: parseInt(id) },
      include: { employee: { select: { fullName: true } } }
    });
    if (!payroll) {
      return res.status(404).json({ success: false, message: `Không tìm thấy bảng lương: ${id}` });
    }
    if (payroll.status === 'PAID') {
      return res.status(409).json({ success: false, message: 'Bảng lương này đã được chi trả.' });
    }
    // Trước đây chỉ chặn 'PAID', nghĩa là 1 bảng lương vừa được HR lập
    // (SUBMITTED_TO_ACCOUNTING) — CHƯA qua CEO duyệt — vẫn giải ngân được thẳng,
    // bỏ qua hoàn toàn bước kiểm soát tài chính bắt buộc.
    if (payroll.status !== 'APPROVED_BY_CEO') {
      return res.status(409).json({ success: false, message: 'Bảng lương này chưa được Ban Giám Đốc phê duyệt, không thể giải ngân.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.payroll.update({
        where: { id: payroll.id },
        data: { status: 'PAID', paidAt: new Date() },
        include: { employee: { select: { fullName: true } } }
      });
      await tx.ledgerEntry.create({
        data: {
          type: 'EXPENSE',
          amount: updated.netSalary,
          description: `Chi trả lương kỳ ${updated.period} — ${updated.employee?.fullName || `NV #${updated.employeeId}`}`,
          referenceId: `PAYROLL-${updated.id}`
        }
      });
      return updated;
    });

    logAudit({ req, action: 'DISBURSE_PAYROLL', module: 'Kế Toán', targetId: result.id, note: `${result.employee?.fullName || `NV #${result.employeeId}`}: ${result.netSalary}đ` });
    res.json({ success: true, data: { ...result, empId: result.employeeId, empName: result.employee?.fullName, netAmount: parseFloat(result.netSalary) } });
  } catch (err) { next(err); }
});

// POST /api/v1/hr/payrolls/disburse-all – Kế toán giải ngân toàn bộ bảng
// lương đã CEO duyệt trong 1 giao dịch, ghi 1 bút toán/nhân viên.
router.post('/payrolls/disburse-all', authMiddleware(['ACCOUNTANT', 'CEO', 'ADMIN']), checkOperationalPermission('accounting_disburse_payroll'), async (req, res, next) => {
  try {
    // 'SUBMITTED_TO_ACCOUNTING' trước đây cũng được coi là "đang chờ" và bị
    // giải ngân hàng loạt cùng APPROVED_BY_CEO — nghĩa là bảng lương HR vừa
    // lập, CEO còn chưa xem, vẫn bị chi trả thật. Chỉ APPROVED_BY_CEO mới
    // được giải ngân.
    const eligible = await prisma.payroll.findMany({
      where: { status: 'APPROVED_BY_CEO' },
      include: { employee: { select: { fullName: true } } }
    });
    if (eligible.length === 0) {
      return res.status(409).json({ success: false, message: 'Không có bảng lương nào đang chờ giải ngân.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.payroll.updateMany({
        where: { id: { in: eligible.map(p => p.id) } },
        data: { status: 'PAID', paidAt: new Date() }
      });
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
  } catch (err) { next(err); }
});

module.exports = router;
