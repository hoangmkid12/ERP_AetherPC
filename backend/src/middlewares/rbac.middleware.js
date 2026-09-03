const prisma = require('../config/database');

// The `RolePermission` table (Quản Trị Hệ Thống > Ma Trận Phân Quyền) has
// always existed as a UI-visibility toggle only — `authMiddleware`'s
// hardcoded role arrays are the real, only authorization backend routes
// ever enforced. This layer makes a small, curated set of genuinely
// high-risk operations (duyệt PO, duyệt/giải ngân lương, huỷ đơn hoàn
// tiền, vô hiệu hóa nhân viên) actually obey what an admin configures in
// that matrix — on TOP of, not instead of, the route's own authMiddleware
// role check, which stays the baseline of defense.
//
// ADMIN always passes (mirrors `canDo()` in frontend/src/utils/rbacEngine.js,
// the only role that unconditionally bypasses the matrix there too). Every
// other role — CEO included — needs an explicit `allowed: true` row; a
// missing row fails closed, not open, so this can't be silently defeated
// by simply never configuring it. Because of that, the operations gated
// here must be seeded with sane defaults (see prisma/seed-rbac-if-empty.js)
// so a fresh deployment isn't locked out before an admin ever opens the
// RBAC screen.
const hasOperationalPermission = async (role, operationId) => {
  if (role === 'ADMIN') return true;
  const perm = await prisma.rolePermission.findUnique({
    where: { role_operationId: { role: role || '', operationId } }
  });
  return Boolean(perm?.allowed);
};

const checkOperationalPermission = (operationId) => {
  return async (req, res, next) => {
    try {
      const allowed = await hasOperationalPermission(req.user?.role, operationId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản của bạn không có quyền thực hiện thao tác này (đã bị quản trị viên tắt trong Ma Trận Phân Quyền).'
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { checkOperationalPermission, hasOperationalPermission };
