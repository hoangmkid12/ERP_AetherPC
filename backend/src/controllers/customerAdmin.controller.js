const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { logAudit } = require('../utils/auditLog');

const DEFAULT_RESET_PASSWORD = '123456';

const sanitize = (customer) => customer ? { ...customer, passwordHash: undefined } : customer;

// GET /api/v1/customer-accounts — danh sách tài khoản khách hàng thật (không
// phải suy ra từ đơn hàng như tab CRM cũ), kèm số đơn & tổng chi tiêu thật.
const listCustomers = async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const status = req.query.status;
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));

    const where = {
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } }
        ]
      } : {})
    };

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        select: {
          customerId: true, email: true, username: true, name: true, phone: true,
          address: true, city: true, tier: true, status: true, loyaltyPoints: true,
          createdAt: true,
          _count: { select: { orders: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      })
    ]);

    // Prisma has no relation-sum in findMany, so total spent per customer comes
    // from a separate groupBy over just this page's ids and gets merged in memory.
    const ids = customers.map(c => c.customerId);
    const spendByCustomer = ids.length > 0
      ? await prisma.order.groupBy({
          by: ['customerId'],
          where: { customerId: { in: ids }, status: { not: 'CANCELLED' } },
          _sum: { totalAmount: true }
        })
      : [];
    const spendMap = Object.fromEntries(spendByCustomer.map(s => [s.customerId, Number(s._sum.totalAmount || 0)]));

    const data = customers.map(c => ({
      ...c,
      orderCount: c._count.orders,
      totalSpent: spendMap[c.customerId] || 0,
      _count: undefined
    }));

    res.json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (err) { next(err); }
};

// GET /api/v1/customer-accounts/:id
const getCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { customerId: id },
      include: {
        addresses: true,
        _count: { select: { orders: true } }
      }
    });
    if (!customer) return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });

    const spend = await prisma.order.aggregate({
      where: { customerId: id, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true }
    });

    res.json({
      success: true,
      data: {
        ...sanitize(customer),
        orderCount: customer._count.orders,
        totalSpent: Number(spend._sum.totalAmount || 0),
        _count: undefined
      }
    });
  } catch (err) { next(err); }
};

// POST /api/v1/customer-accounts — admin tạo tài khoản khách hàng thủ công
const createCustomer = async (req, res, next) => {
  try {
    const { email, username, password, name, phone, address, city, tier } = req.body;

    if (!email || !name) {
      return res.status(400).json({ success: false, message: 'Email và họ tên là bắt buộc' });
    }
    const usernameTrim = (username || '').trim().toLowerCase();
    if (usernameTrim && !/^[a-z0-9_]{3,30}$/.test(usernameTrim)) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập chỉ gồm chữ thường, số và dấu gạch dưới (3-30 ký tự)' });
    }
    const phoneTrim = (phone || '').trim();

    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          { email },
          ...(usernameTrim ? [{ username: usernameTrim }] : []),
          ...(phoneTrim ? [{ phone: phoneTrim }] : [])
        ]
      }
    });
    if (existing) {
      let conflictField = 'Thông tin';
      if (existing.email === email) conflictField = 'Email';
      else if (usernameTrim && existing.username === usernameTrim) conflictField = 'Tên đăng nhập';
      else if (phoneTrim && existing.phone === phoneTrim) conflictField = 'Số điện thoại';
      return res.status(400).json({ success: false, message: `${conflictField} đã được sử dụng bởi tài khoản khác` });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password || DEFAULT_RESET_PASSWORD, salt);
    const customerId = `CUST-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const customer = await prisma.customer.create({
      data: {
        customerId,
        email,
        username: usernameTrim || null,
        passwordHash,
        name,
        phone: phoneTrim || null,
        address: address || null,
        city: city || null,
        tier: tier || 'BRONZE',
        loyaltyPoints: 0,
        status: 'ACTIVE'
      }
    });

    logAudit({ req, action: 'CREATE_CUSTOMER', module: 'Khách Hàng', targetId: customer.customerId, note: `${customer.name} (${customer.email})` });
    res.status(201).json({ success: true, data: sanitize(customer) });
  } catch (err) { next(err); }
};

// PUT /api/v1/customer-accounts/:id — cập nhật thông tin (không đổi mật khẩu ở đây)
const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, city, tier } = req.body;

    const target = await prisma.customer.findUnique({ where: { customerId: id } });
    if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });

    const phoneTrim = phone !== undefined ? (phone || '').trim() : undefined;
    if ((email && email !== target.email) || (phoneTrim && phoneTrim !== target.phone)) {
      const conflict = await prisma.customer.findFirst({
        where: {
          customerId: { not: id },
          OR: [
            ...(email && email !== target.email ? [{ email }] : []),
            ...(phoneTrim && phoneTrim !== target.phone ? [{ phone: phoneTrim }] : [])
          ]
        }
      });
      if (conflict) {
        const conflictField = email && conflict.email === email ? 'Email' : 'Số điện thoại';
        return res.status(400).json({ success: false, message: `${conflictField} đã được sử dụng bởi tài khoản khác` });
      }
    }

    const customer = await prisma.customer.update({
      where: { customerId: id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phoneTrim !== undefined ? { phone: phoneTrim || null } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(tier !== undefined ? { tier } : {})
      }
    });

    logAudit({ req, action: 'UPDATE_CUSTOMER', module: 'Khách Hàng', targetId: customer.customerId, note: customer.name });
    res.json({ success: true, data: sanitize(customer) });
  } catch (err) { next(err); }
};

// PATCH /api/v1/customer-accounts/:id/status — vô hiệu hóa / kích hoạt lại
// (đây là "xóa" an toàn: chặn đăng nhập mà không đụng lịch sử đơn hàng của khách)
const setCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }
    const customer = await prisma.customer.update({ where: { customerId: id }, data: { status } });
    logAudit({ req, action: 'UPDATE_CUSTOMER_STATUS', module: 'Khách Hàng', targetId: customer.customerId, note: `${customer.name} -> ${status}` });
    res.json({ success: true, data: sanitize(customer) });
  } catch (err) { next(err); }
};

// PATCH /api/v1/customer-accounts/:id/reset-password
const resetCustomerPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(DEFAULT_RESET_PASSWORD, salt);
    const customer = await prisma.customer.update({ where: { customerId: id }, data: { passwordHash } });
    logAudit({ req, action: 'RESET_CUSTOMER_PASSWORD', module: 'Bảo Mật', targetId: customer.customerId, note: customer.name });
    res.json({ success: true, message: `Đã đặt lại mật khẩu về mặc định (${DEFAULT_RESET_PASSWORD}) cho ${customer.name}.`, data: sanitize(customer) });
  } catch (err) { next(err); }
};

// DELETE /api/v1/customer-accounts/:id — chỉ cho phép xóa vĩnh viễn khi khách
// chưa từng có đơn hàng nào (Order.customerId là FK bắt buộc, không cascade) —
// khách đã có lịch sử đơn hàng phải dùng vô hiệu hóa (status) thay vì xóa.
const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const target = await prisma.customer.findUnique({
      where: { customerId: id },
      include: { _count: { select: { orders: true } } }
    });
    if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });

    if (target._count.orders > 0) {
      return res.status(400).json({
        success: false,
        message: `Khách hàng này đã có ${target._count.orders} đơn hàng — không thể xóa vĩnh viễn. Hãy vô hiệu hóa tài khoản thay vì xóa.`
      });
    }

    await prisma.customer.delete({ where: { customerId: id } });
    logAudit({ req, action: 'DELETE_CUSTOMER', module: 'Khách Hàng', targetId: id, note: target.name });
    res.json({ success: true, message: `Đã xóa vĩnh viễn tài khoản ${target.name}.` });
  } catch (err) { next(err); }
};

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  setCustomerStatus,
  resetCustomerPassword,
  deleteCustomer
};
