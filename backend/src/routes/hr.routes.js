const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const prisma = require('../config/database');

// ─── Leave Requests (tự phục vụ) ─────────────────────────────────────────────

// GET /api/v1/hr/leaves – nhân viên xem đơn nghỉ của mình
router.get('/leaves', authMiddleware(['CEO', 'ADMIN', 'HR', 'SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'ASSEMBLY', 'ACCOUNTANT', 'PURCHASING', 'CSKH', 'DELIVERY', 'QC', 'QA', 'QUALITY_CONTROL']), async (req, res, next) => {
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
router.post('/leaves', authMiddleware(['CEO', 'ADMIN', 'HR', 'SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'ASSEMBLY', 'ACCOUNTANT', 'PURCHASING', 'CSKH', 'DELIVERY', 'QC', 'QA', 'QUALITY_CONTROL']), async (req, res, next) => {
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
    const employees = await prisma.employee.findMany({
      select: { id: true, employeeCode: true, fullName: true, email: true, department: true, role: true, deliveryRegion: true, phone: true, baseSalary: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: employees });
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
    res.status(201).json({ success: true, data: { ...emp, passwordHash: undefined } });
  } catch (err) { next(err); }
});

// PATCH /api/v1/hr/employees/:id/status – kích hoạt/vô hiệu hóa tài khoản
router.patch('/employees/:id/status', authMiddleware(['ADMIN', 'HR', 'CEO']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const emp = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: { status }
    });
    res.json({ success: true, data: emp });
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
    res.json({ success: true, data: { ...emp, passwordHash: undefined } });
  } catch (err) { next(err); }
});

module.exports = router;
