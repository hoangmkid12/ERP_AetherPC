const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  getAuditLogs,
  getSettings,
  updateSettings,
  getRolePermissions,
  updateRolePermissions,
  backupDatabase,
  restoreDatabase
} = require('../controllers/system.controller');

// @route   GET /api/v1/system/audit-logs
router.get('/audit-logs', authMiddleware(['ADMIN']), getAuditLogs);

// @route   GET/PUT /api/v1/system/settings
router.get('/settings', authMiddleware(['ADMIN', 'CEO']), getSettings);
router.put('/settings', authMiddleware(['ADMIN']), updateSettings);

// @route   GET/PUT /api/v1/system/rbac
// GET is any authenticated role, not just ADMIN — every logged-in user's
// frontend calls loadRbacFromServer() (rbacEngine.js) on login to know which
// modules/operations THEY personally can see, not just admins configuring the
// screen. Restricting this to ADMIN meant every other role's GET 403'd, the
// frontend silently fell back to the hardcoded DEFAULT_OPERATIONAL_MATRIX,
// and any customization an admin saved was invisible to the very roles it
// was meant to restrict/allow (CEO happened to still work — authMiddleware
// always lets CEO through regardless of the roles array). PUT stays
// ADMIN-only since that's the actual sensitive write.
router.get('/rbac', authMiddleware(), getRolePermissions);
router.put('/rbac', authMiddleware(['ADMIN']), updateRolePermissions);

// @route   GET /api/v1/system/backup
router.get('/backup', authMiddleware(['ADMIN']), backupDatabase);

// @route   POST /api/v1/system/restore
router.post('/restore', authMiddleware(['ADMIN']), restoreDatabase);

module.exports = router;
