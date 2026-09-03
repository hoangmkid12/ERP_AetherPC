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

module.exports = {
  getAuditLogs,
  getSettings,
  updateSettings,
  getRolePermissions,
  updateRolePermissions,
  backupDatabase,
  restoreDatabase
};
