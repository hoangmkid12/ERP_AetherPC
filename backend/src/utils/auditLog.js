const prisma = require('../config/database');

// Fire-and-forget audit trail for genuinely sensitive actions only (failed
// logins, password changes, employee CRUD, PO approval, payroll approve/
// disburse, RBAC changes) — never awaited by the caller and never throws,
// so a logging failure can't block the real business action it's recording.
// `actorOverride` lets a pre-authentication event (e.g. a failed login, where
// there's no req.user yet) still record who attempted it.
const logAudit = ({ req, action, module, targetId, note, status = 'SUCCESS', actorOverride }) => {
  const actorId = actorOverride?.id != null ? String(actorOverride.id) : (req?.user?.id ? String(req.user.id) : null);
  const actorName = actorOverride?.name ?? (req?.user?.name || req?.user?.email || req?.user?.code || null);
  const actorRole = actorOverride?.role ?? (req?.user?.role || null);
  const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || null;

  prisma.auditLog.create({
    data: { actorId, actorName, actorRole, action, module, targetId: targetId ? String(targetId) : null, note, ipAddress, status }
  }).catch(err => console.warn('[AuditLog] Failed to record entry:', err.message));
};

module.exports = { logAudit };
