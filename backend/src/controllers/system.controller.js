const prisma = require('../config/database');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { logAudit } = require('../utils/auditLog');
const { setMaintenanceMode } = require('../services/maintenanceMode');

// DATABASE_URL carries Prisma's own `?schema=public` query param, which isn't
// a real libpq URI option — pg_dump/pg_restore reject it outright. Strip it
// and target the schema explicitly via -n instead.
const getPgConnectionUrl = () => {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.delete('schema');
  return url.toString();
};

// GET /api/v1/system/audit-logs
const getAuditLogs = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/system/settings
const getSettings = async (req, res, next) => {
  try {
    let settings = await prisma.companySettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await prisma.companySettings.create({ data: { id: 1 } });
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/system/settings
const updateSettings = async (req, res, next) => {
  try {
    const { companyName, taxCode, hotline, address, salesCommissionFlat, assemblyBonus, defaultVat, lowStockThreshold } = req.body;
    const data = {};
    if (companyName !== undefined) data.companyName = companyName;
    if (taxCode !== undefined) data.taxCode = taxCode;
    if (hotline !== undefined) data.hotline = hotline;
    if (address !== undefined) data.address = address;
    if (salesCommissionFlat !== undefined) data.salesCommissionFlat = parseFloat(salesCommissionFlat) || 0;
    if (assemblyBonus !== undefined) data.assemblyBonus = parseFloat(assemblyBonus) || 0;
    if (defaultVat !== undefined) data.defaultVat = parseFloat(defaultVat) || 0;
    if (lowStockThreshold !== undefined) data.lowStockThreshold = parseInt(lowStockThreshold) || 5;

    const settings = await prisma.companySettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data }
    });

    logAudit({ req, action: 'UPDATE_SETTINGS', module: 'Quản Trị Hệ Thống', note: JSON.stringify(data) });
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/system/rbac
const getRolePermissions = async (req, res, next) => {
  try {
    const rows = await prisma.rolePermission.findMany();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/system/rbac — body: { entries: [{ role, operationId, allowed }] }
const updateRolePermissions = async (req, res, next) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ success: false, message: 'entries phải là một mảng [{ role, operationId, allowed }]' });
    }
    const updatedBy = req.user?.name || req.user?.email || req.user?.code || null;

    await prisma.$transaction(
      entries.map(e => prisma.rolePermission.upsert({
        where: { role_operationId: { role: e.role, operationId: e.operationId } },
        update: { allowed: !!e.allowed, updatedBy },
        create: { role: e.role, operationId: e.operationId, allowed: !!e.allowed, updatedBy }
      }))
    );

    logAudit({ req, action: 'UPDATE_RBAC', module: 'Phân Quyền', note: `Cập nhật ${entries.length} quyền` });
    const rows = await prisma.rolePermission.findMany();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/system/backup — streams a real pg_dump (-F c custom format)
const backupDatabase = async (req, res, next) => {
  const tmpFile = path.join(os.tmpdir(), `kltn_backup_${Date.now()}.dump`);
  try {
    await new Promise((resolve, reject) => {
      execFile('pg_dump', [getPgConnectionUrl(), '-n', 'public', '-F', 'c', '-f', tmpFile], (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || error.message));
        resolve();
      });
    });

    logAudit({ req, action: 'BACKUP_DATABASE', module: 'Quản Trị Hệ Thống' });

    const fileName = `AetherPC_ERP_Backup_${new Date().toISOString().slice(0, 10)}.dump`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('close', () => fs.unlink(tmpFile, () => {}));
    stream.on('error', (e) => { fs.unlink(tmpFile, () => {}); next(e); });
  } catch (err) {
    fs.unlink(tmpFile, () => {});
    next(err);
  }
};

// POST /api/v1/system/restore — body: { fileBase64, confirm: true }
// DESTRUCTIVE: drops and recreates every table before loading the upload.
const restoreDatabase = async (req, res, next) => {
  const { fileBase64, confirm } = req.body || {};
  if (confirm !== true) {
    return res.status(400).json({ success: false, message: 'Thiếu xác nhận — thao tác này sẽ xoá và ghi đè toàn bộ dữ liệu hiện tại.' });
  }
  if (!fileBase64) {
    return res.status(400).json({ success: false, message: 'Thiếu file backup (.dump).' });
  }

  const tmpFile = path.join(os.tmpdir(), `kltn_restore_${Date.now()}.dump`);
  let poolDisconnected = false;
  try {
    fs.writeFileSync(tmpFile, Buffer.from(fileBase64, 'base64'));

    // `pg_restore --clean` needs ACCESS EXCLUSIVE locks to drop/recreate every
    // table — any concurrent request still holding even a read lock through
    // the app's own Prisma pool would make it hang or fail. Two safeguards:
    // 1. Flip maintenance mode (app.js) so new requests are rejected outright
    //    instead of racing the restore, and give in-flight ones a moment to
    //    finish naturally.
    // 2. Disconnect the shared Prisma pool entirely before running pg_restore,
    //    so this backend process holds zero connections/locks during it.
    setMaintenanceMode(true);
    await new Promise(r => setTimeout(r, 2000));
    await prisma.$disconnect();
    poolDisconnected = true;

    await new Promise((resolve, reject) => {
      // --single-transaction wraps the whole clean+restore in one transaction:
      // if anything fails partway, Postgres rolls back to the pre-restore state
      // instead of leaving the database half-dropped.
      execFile('pg_restore', ['--clean', '--if-exists', '--single-transaction', '-d', getPgConnectionUrl(), tmpFile], (error, stdout, stderr) => {
        // pg_restore exits non-zero even for warnings it explicitly labels as
        // "ignored" — e.g. --if-exists skipping objects that were never there on
        // a first restore, or a session-level SET the dump's newer pg_dump client
        // emitted that an older server version doesn't recognize (cosmetic, not
        // data loss). pg_restore's own "errors ignored on restore: N" summary line
        // is the authoritative signal that it completed rather than aborted — only
        // treat this as a real failure when that summary line is absent.
        if (error && !/errors ignored on restore:/i.test(stderr || '')) {
          return reject(new Error(stderr || error.message));
        }
        resolve();
      });
    });

    await prisma.$connect();
    poolDisconnected = false;

    logAudit({ req, action: 'RESTORE_DATABASE', module: 'Quản Trị Hệ Thống' });
    res.json({ success: true, message: 'Khôi phục dữ liệu thành công.' });
  } catch (err) {
    if (poolDisconnected) {
      // A failed --single-transaction restore rolls back cleanly server-side —
      // the data is intact, we just still need our own pool back before we can
      // even log this failure or serve another request.
      try { await prisma.$connect(); } catch (reErr) {
        console.error('CRITICAL: Prisma pool failed to reconnect after a restore error:', reErr.message);
      }
    }
    logAudit({ req, action: 'RESTORE_DATABASE', module: 'Quản Trị Hệ Thống', status: 'FAILED', note: err.message });
    next(err);
  } finally {
    setMaintenanceMode(false);
    fs.unlink(tmpFile, () => {});
  }
};

// ============================================================================
//   QUẢN LÝ TÀI KHOẢN NGÂN HÀNG DOANH NGHIỆP (COMPANY BANK ACCOUNTS)
//   Chỉ dành riêng cho CEO và ADMIN (Kiểm soát nội bộ / Segregation of Duties)
// ============================================================================

// GET /api/v1/system/bank-accounts/public-default (Public/Fallback cho Storefront & Shipper)
const getDefaultQrAccount = async (req, res, next) => {
  try {
    let account = await prisma.companyBankAccount.findFirst({
      where: { isDefaultQr: true, status: 'ACTIVE' }
    });
    if (!account) {
      account = await prisma.companyBankAccount.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { id: 'asc' }
      });
    }
    // Fallback nếu CSDL chưa có tài khoản nào
    if (!account) {
      return res.json({
        success: true,
        data: {
          bankCode: 'MB',
          bankName: 'Ngân hàng TMCP Quân Đội (MBBank)',
          accountNumber: '1133668899',
          accountHolder: 'AETHERPC ERP CORP',
          isDefaultQr: true
        }
      });
    }
    res.json({ success: true, data: account });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/system/bank-accounts/active (Dành cho Kế toán, Bán hàng, Shipper chọn khi giao dịch)
const getActiveBankAccounts = async (req, res, next) => {
  try {
    let accounts = await prisma.companyBankAccount.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ isDefaultQr: 'desc' }, { id: 'asc' }]
    });

    // Nếu chưa có tài khoản nào, tự khởi tạo 2 tài khoản mẫu cho công ty
    if (accounts.length === 0) {
      await prisma.companyBankAccount.createMany({
        data: [
          {
            bankCode: 'MB',
            bankName: 'Ngân hàng TMCP Quân Đội (MBBank)',
            accountNumber: '1133668899',
            accountHolder: 'CTY TNHH AETHERPC ERP',
            branch: 'Chi nhánh TP. Hồ Chí Minh',
            purpose: 'COLLECTION',
            isDefaultQr: true,
            status: 'ACTIVE',
            currentBalance: 50000000
          },
          {
            bankCode: 'VCB',
            bankName: 'Ngân hàng TMCP Ngoại Thương VN (Vietcombank)',
            accountNumber: '0071001234567',
            accountHolder: 'CTY TNHH AETHERPC ERP',
            branch: 'Chi nhánh Tân Định - TP.HCM',
            purpose: 'DISBURSEMENT',
            isDefaultQr: false,
            status: 'ACTIVE',
            currentBalance: 120000000
          }
        ]
      });
      accounts = await prisma.companyBankAccount.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ isDefaultQr: 'desc' }, { id: 'asc' }]
      });
    }

    res.json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/system/bank-accounts (Toàn bộ tài khoản cho CEO/ADMIN quản lý)
const getBankAccounts = async (req, res, next) => {
  try {
    let accounts = await prisma.companyBankAccount.findMany({
      orderBy: [{ isDefaultQr: 'desc' }, { id: 'asc' }],
      include: {
        _count: {
          select: { ledgerEntries: true }
        }
      }
    });

    if (accounts.length === 0) {
      await prisma.companyBankAccount.createMany({
        data: [
          {
            bankCode: 'MB',
            bankName: 'Ngân hàng TMCP Quân Đội (MBBank)',
            accountNumber: '1133668899',
            accountHolder: 'CTY TNHH AETHERPC ERP',
            branch: 'Chi nhánh TP. Hồ Chí Minh',
            purpose: 'COLLECTION',
            isDefaultQr: true,
            status: 'ACTIVE',
            currentBalance: 50000000
          },
          {
            bankCode: 'VCB',
            bankName: 'Ngân hàng TMCP Ngoại Thương VN (Vietcombank)',
            accountNumber: '0071001234567',
            accountHolder: 'CTY TNHH AETHERPC ERP',
            branch: 'Chi nhánh Tân Định - TP.HCM',
            purpose: 'DISBURSEMENT',
            isDefaultQr: false,
            status: 'ACTIVE',
            currentBalance: 120000000
          }
        ]
      });
      accounts = await prisma.companyBankAccount.findMany({
        orderBy: [{ isDefaultQr: 'desc' }, { id: 'asc' }],
        include: {
          _count: {
            select: { ledgerEntries: true }
          }
        }
      });
    }

    res.json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/system/bank-accounts (Thêm mới tài khoản - CEO/ADMIN)
const createBankAccount = async (req, res, next) => {
  try {
    const { bankCode, bankName, accountNumber, accountHolder, branch, purpose, isDefaultQr } = req.body;

    if (!bankCode || !bankName || !accountNumber || !accountHolder) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ mã ngân hàng, tên ngân hàng, số tài khoản và tên chủ tài khoản.'
      });
    }

    const cleanAccNo = String(accountNumber).trim().replace(/\s+/g, '');
    const cleanHolder = String(accountHolder).trim().toUpperCase();

    const existing = await prisma.companyBankAccount.findUnique({
      where: { accountNumber: cleanAccNo }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Số tài khoản ${cleanAccNo} đã tồn tại trong hệ thống!`
      });
    }

    // Nếu chọn làm QR mặc định, gỡ cờ mặc định của các tài khoản cũ
    if (isDefaultQr === true) {
      await prisma.companyBankAccount.updateMany({
        where: { isDefaultQr: true },
        data: { isDefaultQr: false }
      });
    }

    const totalCount = await prisma.companyBankAccount.count();
    const shouldBeDefault = isDefaultQr === true || totalCount === 0;

    const account = await prisma.companyBankAccount.create({
      data: {
        bankCode: String(bankCode).trim().toUpperCase(),
        bankName: String(bankName).trim(),
        accountNumber: cleanAccNo,
        accountHolder: cleanHolder,
        branch: branch ? String(branch).trim() : null,
        purpose: purpose || 'GENERAL',
        isDefaultQr: shouldBeDefault,
        status: 'ACTIVE'
      }
    });

    logAudit({
      req,
      action: 'CREATE_BANK_ACCOUNT',
      module: 'Quản Trị Hệ Thống',
      targetId: String(account.id),
      note: `Thêm tài khoản ngân hàng ${account.bankName} - ${account.accountNumber} (${account.accountHolder})`
    });

    res.status(201).json({
      success: true,
      message: 'Thêm tài khoản ngân hàng thành công!',
      data: account
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/system/bank-accounts/:id (Cập nhật thông tin - CEO/ADMIN)
const updateBankAccount = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { bankCode, bankName, accountNumber, accountHolder, branch, purpose, status, isDefaultQr } = req.body;

    const existing = await prisma.companyBankAccount.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản ngân hàng.' });
    }

    const cleanAccNo = accountNumber ? String(accountNumber).trim().replace(/\s+/g, '') : existing.accountNumber;
    if (cleanAccNo !== existing.accountNumber) {
      const duplicate = await prisma.companyBankAccount.findUnique({ where: { accountNumber: cleanAccNo } });
      if (duplicate) {
        return res.status(409).json({ success: false, message: `Số tài khoản ${cleanAccNo} đã thuộc tài khoản khác!` });
      }
    }

    if (isDefaultQr === true && !existing.isDefaultQr) {
      await prisma.companyBankAccount.updateMany({
        where: { isDefaultQr: true },
        data: { isDefaultQr: false }
      });
    }

    const updated = await prisma.companyBankAccount.update({
      where: { id },
      data: {
        ...(bankCode ? { bankCode: String(bankCode).trim().toUpperCase() } : {}),
        ...(bankName ? { bankName: String(bankName).trim() } : {}),
        ...(accountNumber ? { accountNumber: cleanAccNo } : {}),
        ...(accountHolder ? { accountHolder: String(accountHolder).trim().toUpperCase() } : {}),
        ...(branch !== undefined ? { branch: branch ? String(branch).trim() : null } : {}),
        ...(purpose ? { purpose } : {}),
        ...(status ? { status } : {}),
        ...(isDefaultQr !== undefined ? { isDefaultQr: Boolean(isDefaultQr) } : {})
      }
    });

    logAudit({
      req,
      action: 'UPDATE_BANK_ACCOUNT',
      module: 'Quản Trị Hệ Thống',
      targetId: String(id),
      note: `Cập nhật tài khoản ${updated.bankName} - ${updated.accountNumber}`
    });

    res.json({
      success: true,
      message: 'Cập nhật tài khoản ngân hàng thành công!',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/system/bank-accounts/:id/default-qr (Gán làm tài khoản nhận QR mặc định)
const setDefaultQrAccount = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.companyBankAccount.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản ngân hàng.' });
    }

    await prisma.companyBankAccount.updateMany({
      where: { isDefaultQr: true },
      data: { isDefaultQr: false }
    });

    const updated = await prisma.companyBankAccount.update({
      where: { id },
      data: { isDefaultQr: true, status: 'ACTIVE' }
    });

    logAudit({
      req,
      action: 'SET_DEFAULT_QR_BANK',
      module: 'Quản Trị Hệ Thống',
      targetId: String(id),
      note: `Đặt ${updated.bankName} - ${updated.accountNumber} làm tài khoản nhận VietQR mặc định toàn hệ thống`
    });

    res.json({
      success: true,
      message: `Đã thiết lập ${updated.bankName} (${updated.accountNumber}) làm tài khoản nhận VietQR chính!`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/system/bank-accounts/:id (Xóa tài khoản - CEO/ADMIN)
const deleteBankAccount = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.companyBankAccount.findUnique({
      where: { id },
      include: { _count: { select: { ledgerEntries: true } } }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản ngân hàng.' });
    }

    if (existing._count.ledgerEntries > 0) {
      return res.status(400).json({
        success: false,
        message: `Tài khoản này đã có ${existing._count.ledgerEntries} bút toán giao dịch trong Sổ Cái. Không thể xóa để đảm bảo toàn vẹn kế toán. Bạn có thể chuyển trạng thái sang "Ngưng hoạt động".`
      });
    }

    if (existing.isDefaultQr) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa tài khoản đang được chọn làm VietQR mặc định. Hãy chỉ định tài khoản khác trước.'
      });
    }

    await prisma.companyBankAccount.delete({ where: { id } });

    logAudit({
      req,
      action: 'DELETE_BANK_ACCOUNT',
      module: 'Quản Trị Hệ Thống',
      targetId: String(id),
      note: `Xóa tài khoản ${existing.bankName} - ${existing.accountNumber}`
    });

    res.json({
      success: true,
      message: 'Đã xóa tài khoản ngân hàng.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs,
  getSettings,
  updateSettings,
  getRolePermissions,
  updateRolePermissions,
  backupDatabase,
  restoreDatabase,
  getDefaultQrAccount,
  getActiveBankAccounts,
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  setDefaultQrAccount,
  deleteBankAccount
};
