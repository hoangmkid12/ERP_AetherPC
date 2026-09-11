const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { sendWelcomeEmail } = require('../services/emailService');
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

const loginCustomer = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const loginIdentifier = (email || username || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: loginIdentifier },
          { username: loginIdentifier.toLowerCase() }
        ]
      }
    });

    if (!customer) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, customer.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (customer.status && customer.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ CSKH để được hỗ trợ.' });
    }

    const token = jwt.sign(
      { id: customer.customerId, email: customer.email, role: 'CUSTOMER', tier: customer.tier },
      getJWTSecret(),
      { expiresIn: '7d' }
    );

    // Set HTTP-Only secure cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      token,
      user: {
        id: customer.customerId,
        name: customer.name,
        email: customer.email,
        username: customer.username,
        tier: customer.tier,
        loyaltyPoints: customer.loyaltyPoints,
        phone: customer.phone,
        address: customer.address,
        city: customer.city
      }
    });
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

    const token = jwt.sign(
      { id: newCustomer.customerId, email: newCustomer.email, role: 'CUSTOMER', tier: newCustomer.tier },
      getJWTSecret(),
      { expiresIn: '7d' }
    );

    // Set HTTP-Only secure cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    setImmediate(() => {
      sendWelcomeEmail({
        toEmail: newCustomer.email,
        customerName: newCustomer.name
      }).catch(mailErr => {
        console.warn('[Auth] Error sending welcome email on registration:', mailErr.message);
      });
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newCustomer.customerId,
        name: newCustomer.name,
        email: newCustomer.email,
        username: newCustomer.username,
        tier: newCustomer.tier,
        loyaltyPoints: newCustomer.loyaltyPoints,
        phone: newCustomer.phone,
        address: newCustomer.address,
        city: newCustomer.city
      }
    });
  } catch (err) {
    next(err);
  }
};


const loginEmployee = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const loginIdentifier = (email || username || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
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
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      logAudit({ req, action: 'LOGIN', module: 'Bảo Mật', status: 'FAILED', note: 'Sai mật khẩu', actorOverride: { id: isSupplier ? user.code : user.id, name: loginIdentifier, role } });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (isSupplier) {
      // `name` here is the supplier's real company name — without it, every audit-trail
      // "changedBy" for a supplier action (RFQ status history, GRN confirmation, etc.)
      // fell back to the raw login email, which reads poorly next to CEO/staff names.
      tokenPayload = { id: user.code, code: user.code, email: user.email, name: user.name, role: 'SUPPLIER', department: 'SUPPLY' };
    } else {
      tokenPayload = { id: user.id, code: user.employeeCode, email: user.email, name: user.fullName, role: user.role, department: user.department };
    }

    const token = jwt.sign(
      tokenPayload,
      getJWTSecret(),
      { expiresIn: '1d' }
    );

    // Set HTTP-Only secure cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'strict',
      maxAge: 1 * 24 * 60 * 60 * 1000
    });

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
      return res.status(400).json({ success: false, message: 'Invalid account' });
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
        return res.status(400).json({ success: false, message: 'Invalid employee account' });
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
        return res.status(400).json({ success: false, message: 'Invalid employee account' });
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

module.exports = { loginCustomer, loginEmployee, registerCustomer, getMe, updateProfile, changePassword };
