const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService');
const { logAudit } = require('../utils/auditLog');

const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      throw new Error('CRITICAL: JWT_SECRET must be set in production and be at least 32 characters long');
    }
    console.warn('WARNING: JWT_SECRET is weak or not set. This should only happen in development.');
  }
  return secret;
};

// Deliberately decoupled from NODE_ENV: a first deploy often runs in
// production mode over plain HTTP before a domain/TLS is in place, and a
// Secure cookie set over HTTP is silently dropped by the browser, locking
// everyone out. Operators must explicitly opt in once TLS is confirmed.
const isCookieSecure = () => process.env.COOKIE_SECURE === 'true';

const DAY_MS = 24 * 60 * 60 * 1000;
const REMEMBER_DAYS = 30;

// Ký JWT + đặt cookie phiên. `remember`:
//   true      → phiên dài REMEMBER_DAYS ngày, cookie còn sau khi đóng trình duyệt
//   false     → cookie phiên (mất khi đóng trình duyệt), token vẫn hết hạn sau defaultDays
//   undefined → giữ hành vi cũ (cookie sống defaultDays) cho client chưa gửi cờ này
const issueSession = (res, payload, { remember, defaultDays }) => {
  const days = remember === true ? REMEMBER_DAYS : defaultDays;
  const token = jwt.sign(payload, getJWTSecret(), { expiresIn: `${days}d` });
  res.cookie('authToken', token, {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: 'strict',
    ...(remember === false ? {} : { maxAge: days * DAY_MS })
  });
  return token;
};

const toRememberFlag = (v) => (v === undefined || v === null ? undefined : v === true || v === 'true');

const customerUserDto = (c) => ({
  id: c.customerId,
  name: c.name,
  email: c.email,
  username: c.username,
  tier: c.tier,
  loyaltyPoints: c.loyaltyPoints,
  phone: c.phone,
  address: c.address,
  city: c.city
});

const loginCustomer = async (req, res, next) => {
  try {
    const { email, username, password, rememberMe } = req.body;
    const loginIdentifier = (email || username || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tài khoản và mật khẩu.' });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: { equals: loginIdentifier, mode: 'insensitive' } },
          { username: loginIdentifier.toLowerCase() }
        ]
      }
    });

    if (!customer) {
      return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    // Tài khoản tạo qua Google chưa có mật khẩu — bcrypt.compare(…, null) sẽ ném lỗi 500.
    if (!customer.passwordHash) {
      return res.status(401).json({ success: false, message: 'Tài khoản này đăng nhập bằng Google. Hãy chọn "Đăng nhập với Google" hoặc dùng "Quên mật khẩu" để tạo mật khẩu.' });
    }

    const isMatch = await bcrypt.compare(password, customer.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    if (customer.status && customer.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ CSKH để được hỗ trợ.' });
    }

    const token = issueSession(res,
      { id: customer.customerId, email: customer.email, role: 'CUSTOMER', tier: customer.tier },
      { remember: toRememberFlag(rememberMe), defaultDays: 7 });

    res.json({ success: true, token, user: customerUserDto(customer) });
  } catch (err) {
    next(err);
  }
};

const registerCustomer = async (req, res, next) => {
  try {
    const { email, username, password, name, phone, address, city } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Email, mật khẩu và họ tên là bắt buộc' });
    }

    const usernameTrim = (username || '').trim().toLowerCase();
    if (!usernameTrim) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập là bắt buộc' });
    }
    if (!/^[a-z0-9_]{3,30}$/.test(usernameTrim)) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập chỉ gồm chữ thường, số và dấu gạch dưới (3-30 ký tự)' });
    }

    const phoneTrim = (phone || '').trim();
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email },
          { username: usernameTrim },
          ...(phoneTrim ? [{ phone: phoneTrim }] : [])
        ]
      }
    });

    if (existingCustomer) {
      let conflictField = 'Thông tin đăng ký';
      if (existingCustomer.email === email) conflictField = 'Email';
      else if (existingCustomer.username === usernameTrim) conflictField = 'Tên đăng nhập';
      else if (phoneTrim && existingCustomer.phone === phoneTrim) conflictField = 'Số điện thoại';
      return res.status(400).json({ success: false, message: `${conflictField} đã được sử dụng bởi tài khoản khác` });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const customerId = `CUST-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCustomer = await prisma.customer.create({
      data: {
        customerId,
        email,
        username: usernameTrim,
        passwordHash,
        name,
        phone: phoneTrim || null,
        address: address || null,
        city: city || null,
        loyaltyPoints: 0,
        tier: 'BRONZE'
      }
    });

    const token = issueSession(res,
      { id: newCustomer.customerId, email: newCustomer.email, role: 'CUSTOMER', tier: newCustomer.tier },
      { remember: undefined, defaultDays: 7 });
    setImmediate(() => {
      sendWelcomeEmail({
        toEmail: newCustomer.email,
        customerName: newCustomer.name
      }).catch(mailErr => {
        console.warn('[Auth] Error sending welcome email on registration:', mailErr.message);
      });
    });

    res.status(201).json({ success: true, token, user: customerUserDto(newCustomer) });
  } catch (err) {
    next(err);
  }
};


const loginEmployee = async (req, res, next) => {
  try {
    const { email, username, password, rememberMe } = req.body;
    const loginIdentifier = (email || username || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tài khoản và mật khẩu.' });
    }

    const lowerId = loginIdentifier.toLowerCase();
    const emailCandidate = lowerId.includes('@') ? lowerId : `${lowerId}@kltn-erp.vn`;

    let user = await prisma.employee.findFirst({
      where: {
        OR: [
          { email: { equals: loginIdentifier, mode: 'insensitive' } },
          { email: { equals: emailCandidate, mode: 'insensitive' } },
          { employeeCode: { equals: loginIdentifier, mode: 'insensitive' } }
        ]
      }
    });

    let role = user ? user.role : null;
    let tokenPayload = null;
    let isSupplier = false;

    if (!user) {
      // Check if it is a Supplier
      const supplier = await prisma.supplier.findFirst({
        where: {
          OR: [
            { email: { equals: loginIdentifier, mode: 'insensitive' } },
            { code: { equals: loginIdentifier, mode: 'insensitive' } }
          ]
        }
      });
      if (supplier) {
        user = supplier;
        role = 'SUPPLIER';
        isSupplier = true;
      }
    }

    if (!user) {
      logAudit({ req, action: 'LOGIN', module: 'Bảo Mật', status: 'FAILED', note: `Không tìm thấy tài khoản: ${loginIdentifier}`, actorOverride: { id: null, name: loginIdentifier, role: null } });
      return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    const isMatch = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!isMatch) {
      logAudit({ req, action: 'LOGIN', module: 'Bảo Mật', status: 'FAILED', note: 'Sai mật khẩu', actorOverride: { id: isSupplier ? user.code : user.id, name: loginIdentifier, role } });
      return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' });
    }

    // Nhân viên đã nghỉ việc (HR vô hiệu hóa) không được đăng nhập nữa.
    if (!isSupplier && user.status === 'INACTIVE') {
      logAudit({ req, action: 'LOGIN', module: 'Bảo Mật', status: 'FAILED', note: 'Tài khoản đã ngừng hoạt động', actorOverride: { id: user.id, name: loginIdentifier, role } });
      return res.status(403).json({ success: false, message: 'Tài khoản đã ngừng hoạt động. Vui lòng liên hệ phòng Nhân Sự.' });
    }

    if (isSupplier) {
      // `name` here is the supplier's real company name — without it, every audit-trail
      // "changedBy" for a supplier action (RFQ status history, GRN confirmation, etc.)
      // fell back to the raw login email, which reads poorly next to CEO/staff names.
      tokenPayload = { id: user.code, code: user.code, email: user.email, name: user.name, role: 'SUPPLIER', department: 'SUPPLY' };
    } else {
      tokenPayload = { id: user.id, code: user.employeeCode, email: user.email, name: user.fullName, role: user.role, department: user.department };
    }

    const token = issueSession(res, tokenPayload, { remember: toRememberFlag(rememberMe), defaultDays: 1 });

    res.json({
      success: true,
      token,
      user: {
        id: isSupplier ? user.code : user.id,
        code: isSupplier ? user.code : user.employeeCode,
        name: isSupplier ? user.name : user.fullName,
        fullname: isSupplier ? user.name : user.fullName,
        email: user.email,
        department: isSupplier ? 'SUPPLY' : user.department,
        role: role,
        deliveryRegion: user.deliveryRegion || null,
        phone: user.phone || null
      }
    });
  } catch (err) {
    next(err);
  }
};



const getMe = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    if (role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({ where: { customerId: id } });
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
      }
      return res.json({
        success: true,
        user: {
          id: customer.customerId,
          name: customer.name,
          email: customer.email,
          username: customer.username,
          tier: customer.tier,
          loyaltyPoints: customer.loyaltyPoints,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          role: 'CUSTOMER'
        }
      });
    }

    if (role === 'SUPPLIER') {
      const supplier = await prisma.supplier.findUnique({ where: { code: id } });
      if (!supplier) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
      }
      return res.json({
        success: true,
        user: {
          id: supplier.code,
          code: supplier.code,
          name: supplier.name,
          fullname: supplier.name,
          email: supplier.email,
          department: 'SUPPLY',
          role: 'SUPPLIER',
          deliveryRegion: null,
          phone: supplier.phone || null
        }
      });
    }

    const employeeId = parseInt(id);
    if (!Number.isInteger(employeeId)) {
      return res.status(400).json({ success: false, message: 'Tài khoản không hợp lệ.' });
    }
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản nhân viên' });
    }
    return res.json({
      success: true,
      user: {
        id: employee.id,
        code: employee.employeeCode,
        name: employee.fullName,
        fullname: employee.fullName,
        email: employee.email,
        department: employee.department,
        role: employee.role,
        deliveryRegion: employee.deliveryRegion || null,
        phone: employee.phone || null
      }
    });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, email, phone, address, city, gender } = req.body;
    const isCustomer = req.user.role === 'CUSTOMER';

    if (isCustomer) {
      const updatedCustomer = await prisma.customer.update({
        where: { customerId: req.user.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(email ? { email } : {}),
          ...(phone !== undefined ? { phone: phone || null } : {}),
          ...(address !== undefined ? { address: address || null } : {}),
          ...(city !== undefined ? { city: city || null } : {}),
          ...(gender !== undefined ? { gender: gender || null } : {})
        }
      });
      return res.json({
        success: true,
        user: {
          id: updatedCustomer.customerId,
          name: updatedCustomer.name,
          email: updatedCustomer.email,
          tier: updatedCustomer.tier,
          loyaltyPoints: updatedCustomer.loyaltyPoints,
          phone: updatedCustomer.phone,
          address: updatedCustomer.address,
          city: updatedCustomer.city,
          gender: updatedCustomer.gender,
          role: 'CUSTOMER'
        }
      });
    } else if (req.user.role === 'SUPPLIER') {
      const updatedSupplier = await prisma.supplier.update({
        where: { code: req.user.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(email ? { email } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(address !== undefined ? { address } : {})
        }
      });
      return res.json({
        success: true,
        user: {
          id: updatedSupplier.code,
          code: updatedSupplier.code,
          name: updatedSupplier.name,
          fullname: updatedSupplier.name,
          email: updatedSupplier.email,
          department: 'SUPPLY',
          role: 'SUPPLIER',
          phone: updatedSupplier.phone || null
        }
      });
    } else {
      const employeeId = parseInt(req.user.id);
      if (!Number.isInteger(employeeId)) {
        return res.status(400).json({ success: false, message: 'Tài khoản nhân viên không hợp lệ.' });
      }
      const updatedEmployee = await prisma.employee.update({
        where: { id: employeeId },
        data: {
          fullName: name
        }
      });
      return res.json({
        success: true,
        user: {
          id: updatedEmployee.id,
          code: updatedEmployee.employeeCode,
          name: updatedEmployee.fullName,
          email: updatedEmployee.email,
          department: updatedEmployee.department,
          role: updatedEmployee.role
        }
      });
    }
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin mật khẩu' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    if (req.user.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({
        where: { customerId: req.user.id }
      });
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản khách hàng' });
      }
      const isMatch = await bcrypt.compare(currentPassword, customer.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
      }
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);
      await prisma.customer.update({
        where: { customerId: req.user.id },
        data: { passwordHash: newHash }
      });
      logAudit({ req, action: 'CHANGE_PASSWORD', module: 'Bảo Mật', targetId: req.user.id });
      return res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } else if (req.user.role === 'SUPPLIER') {
      const supplier = await prisma.supplier.findUnique({
        where: { code: req.user.id }
      });
      if (!supplier) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản nhà cung cấp' });
      }
      const isMatch = await bcrypt.compare(currentPassword, supplier.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
      }
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);
      await prisma.supplier.update({
        where: { code: req.user.id },
        data: { passwordHash: newHash }
      });
      logAudit({ req, action: 'CHANGE_PASSWORD', module: 'Bảo Mật', targetId: req.user.id });
      return res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } else {
      const employeeId = parseInt(req.user.id);
      if (!Number.isInteger(employeeId)) {
        return res.status(400).json({ success: false, message: 'Tài khoản nhân viên không hợp lệ.' });
      }
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId }
      });
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản nhân viên' });
      }
      const isMatch = await bcrypt.compare(currentPassword, employee.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
      }
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(newPassword, salt);
      await prisma.employee.update({
        where: { id: employeeId },
        data: { passwordHash: newHash }
      });
      logAudit({ req, action: 'CHANGE_PASSWORD', module: 'Bảo Mật', targetId: employeeId });
      return res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    }
  } catch (err) {
    next(err);
  }
};

// ───────────────────────── Quên / đặt lại mật khẩu ─────────────────────────
// Token đặt lại là JWT ký bằng JWT_SECRET (purpose riêng) nên không cần bảng lưu token.
// `fp` là dấu vân tay của passwordHash hiện tại: đổi mật khẩu xong thì fp lệch → link cũ
// tự vô hiệu (dùng một lần), và mọi link gửi trước lần đổi mật khẩu đó cũng hết tác dụng.
const RESET_TTL_MINUTES = 30;
const RESET_PURPOSE = 'pwd-reset';

const passwordFingerprint = (hash) =>
  crypto.createHash('sha256').update(String(hash || 'no-password')).digest('hex').slice(0, 16);

// Không lấy origin từ header request (kẻ gian có thể giả Origin để email chứa link trỏ về
// tên miền của họ và đánh cắp token) — chỉ dùng cấu hình do người vận hành đặt.
const getAppUrl = () => {
  const configured = process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || '').split(',')[0].trim();
  if (configured) return configured.replace(/\/+$/, '');
  return process.env.NODE_ENV === 'production' ? 'https://www.aetherpc.site' : 'http://localhost:3000';
};

const findAccountByEmail = async (email) => {
  const where = { email: { equals: email, mode: 'insensitive' } };
  const customer = await prisma.customer.findFirst({ where });
  if (customer) return { kind: 'customer', id: customer.customerId, name: customer.name, email: customer.email, passwordHash: customer.passwordHash, active: !customer.status || customer.status === 'ACTIVE' };
  const employee = await prisma.employee.findFirst({ where });
  if (employee) return { kind: 'employee', id: String(employee.id), name: employee.fullName, email: employee.email, passwordHash: employee.passwordHash, active: employee.status !== 'INACTIVE' };
  const supplier = await prisma.supplier.findFirst({ where });
  if (supplier) return { kind: 'supplier', id: supplier.code, name: supplier.name, email: supplier.email, passwordHash: supplier.passwordHash, active: true };
  return null;
};

const findAccountById = async (kind, id) => {
  if (kind === 'customer') {
    const c = await prisma.customer.findUnique({ where: { customerId: id } });
    return c && { kind, id, name: c.name, email: c.email, passwordHash: c.passwordHash, active: !c.status || c.status === 'ACTIVE' };
  }
  if (kind === 'employee') {
    const employeeId = parseInt(id, 10);
    if (!Number.isInteger(employeeId)) return null;
    const e = await prisma.employee.findUnique({ where: { id: employeeId } });
    return e && { kind, id, name: e.fullName, email: e.email, passwordHash: e.passwordHash, active: e.status !== 'INACTIVE' };
  }
  if (kind === 'supplier') {
    const s = await prisma.supplier.findUnique({ where: { code: id } });
    return s && { kind, id, name: s.name, email: s.email, passwordHash: s.passwordHash, active: true };
  }
  return null;
};

const resetError = (message) => Object.assign(new Error(message), { status: 400 });

// Trả về tài khoản nếu token hợp lệ và chưa dùng, ngược lại ném lỗi có message tiếng Việt.
const resolveResetToken = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(String(token || ''), getJWTSecret());
  } catch (e) {
    throw resetError(e.name === 'TokenExpiredError'
      ? 'Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng gửi yêu cầu mới.'
      : 'Liên kết đặt lại mật khẩu không hợp lệ.');
  }
  const account = decoded?.purpose === RESET_PURPOSE ? await findAccountById(decoded.kind, decoded.id) : null;
  if (!account || !account.active || decoded.fp !== passwordFingerprint(account.passwordHash)) {
    throw resetError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng. Vui lòng gửi yêu cầu mới.');
  }
  return account;
};

const maskEmail = (email) => {
  const [local, domain] = String(email).split('@');
  if (!domain) return email;
  const shown = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${shown}${'*'.repeat(Math.max(1, local.length - shown.length))}@${domain}`;
};

// @route POST /api/v1/auth/forgot-password  { email }
// Luôn trả cùng một thông báo dù email có tồn tại hay không, tránh lộ danh sách tài khoản.
const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
    }

    const account = await findAccountByEmail(email);
    if (account && account.active) {
      const token = jwt.sign(
        { purpose: RESET_PURPOSE, kind: account.kind, id: account.id, fp: passwordFingerprint(account.passwordHash) },
        getJWTSecret(),
        { expiresIn: `${RESET_TTL_MINUTES}m` }
      );
      const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await sendPasswordResetEmail({ toEmail: account.email, customerName: account.name, resetUrl, expiresMinutes: RESET_TTL_MINUTES });
        logAudit({ req, action: 'FORGOT_PASSWORD', module: 'Bảo Mật', targetId: account.id, actorOverride: { id: account.id, name: account.email, role: account.kind.toUpperCase() } });
      } catch (mailErr) {
        console.error('[Auth] Không gửi được email đặt lại mật khẩu:', mailErr.message);
        return res.status(503).json({ success: false, message: 'Hệ thống email đang gặp sự cố, chưa gửi được thư. Vui lòng thử lại sau ít phút.' });
      }
    }

    res.json({ success: true, message: 'Nếu email này đã đăng ký tài khoản, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (kể cả mục Spam).' });
  } catch (err) {
    next(err);
  }
};

// @route GET /api/v1/auth/reset-password/verify?token=
const verifyResetToken = async (req, res, next) => {
  try {
    const account = await resolveResetToken(req.query.token);
    res.json({ success: true, email: maskEmail(account.email), name: account.name });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// @route POST /api/v1/auth/reset-password  { token, newPassword }
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }
    const account = await resolveResetToken(token);
    const passwordHash = await bcrypt.hash(String(newPassword), await bcrypt.genSalt(10));

    if (account.kind === 'customer') {
      await prisma.customer.update({ where: { customerId: account.id }, data: { passwordHash } });
    } else if (account.kind === 'employee') {
      await prisma.employee.update({ where: { id: parseInt(account.id, 10) }, data: { passwordHash } });
    } else {
      await prisma.supplier.update({ where: { code: account.id }, data: { passwordHash } });
    }

    logAudit({ req, action: 'RESET_PASSWORD', module: 'Bảo Mật', targetId: account.id, actorOverride: { id: account.id, name: account.email, role: account.kind.toUpperCase() } });
    res.json({ success: true, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// ───────────────────────── Đăng nhập Google ─────────────────────────
// Frontend dùng Google Identity Services lấy ID token, backend xác minh qua endpoint
// tokeninfo của Google (không cần thêm thư viện) rồi đăng nhập/tạo tài khoản khách hàng.
const getGoogleClientId = () => (process.env.GOOGLE_CLIENT_ID || '').trim();

// @route GET /api/v1/auth/google/config
const getGoogleConfig = (req, res) => {
  res.json({ success: true, clientId: getGoogleClientId() || null });
};

const uniqueUsernameFromEmail = async (email) => {
  const base = (email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'user')
    .slice(0, 22).padEnd(3, '0');
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? base : `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
    const taken = await prisma.customer.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }
  return `${base}_${Date.now().toString().slice(-6)}`;
};

// @route POST /api/v1/auth/google  { credential, rememberMe }
const loginWithGoogle = async (req, res, next) => {
  try {
    const clientId = getGoogleClientId();
    if (!clientId) {
      return res.status(503).json({ success: false, message: 'Đăng nhập Google chưa được cấu hình trên máy chủ (thiếu GOOGLE_CLIENT_ID).' });
    }
    const credential = String(req.body?.credential || '');
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin xác thực Google.' });
    }

    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const info = await verifyRes.json().catch(() => ({}));
    const validIssuer = ['accounts.google.com', 'https://accounts.google.com'].includes(info.iss);
    if (!verifyRes.ok || info.aud !== clientId || !validIssuer || Number(info.exp) * 1000 < Date.now()) {
      return res.status(401).json({ success: false, message: 'Xác thực Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.' });
    }
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      return res.status(401).json({ success: false, message: 'Email Google của bạn chưa được xác minh.' });
    }

    const email = String(info.email).toLowerCase();
    const byEmail = { email: { equals: email, mode: 'insensitive' } };
    let customer = await prisma.customer.findFirst({ where: byEmail });
    let isNew = false;

    if (customer) {
      if (customer.status && customer.status !== 'ACTIVE') {
        return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ CSKH để được hỗ trợ.' });
      }
    } else {
      // Email trùng tài khoản nhân viên/NCC: không tự tạo tài khoản khách hàng song song.
      const staff = await prisma.employee.findFirst({ where: byEmail }) || await prisma.supplier.findFirst({ where: byEmail });
      if (staff) {
        return res.status(409).json({ success: false, message: 'Email này thuộc tài khoản nội bộ. Vui lòng đăng nhập bằng tên đăng nhập và mật khẩu.' });
      }
      customer = await prisma.customer.create({
        data: {
          customerId: `CUST-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          email,
          username: await uniqueUsernameFromEmail(email),
          passwordHash: null,
          name: (info.name || email.split('@')[0]).slice(0, 150),
          loyaltyPoints: 0,
          tier: 'BRONZE'
        }
      });
      isNew = true;
      setImmediate(() => {
        sendWelcomeEmail({ toEmail: customer.email, customerName: customer.name })
          .catch(mailErr => console.warn('[Auth] Error sending welcome email (Google):', mailErr.message));
      });
    }

    const token = issueSession(res,
      { id: customer.customerId, email: customer.email, role: 'CUSTOMER', tier: customer.tier },
      { remember: toRememberFlag(req.body?.rememberMe), defaultDays: 7 });

    res.status(isNew ? 201 : 200).json({ success: true, isNew, token, user: customerUserDto(customer) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  loginCustomer, loginEmployee, registerCustomer, getMe, updateProfile, changePassword,
  forgotPassword, verifyResetToken, resetPassword, getGoogleConfig, loginWithGoogle
};
