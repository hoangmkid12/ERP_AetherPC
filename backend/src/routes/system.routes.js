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
router.get('/rbac', authMiddleware(['ADMIN']), getRolePermissions);
router.put('/rbac', authMiddleware(['ADMIN']), updateRolePermissions);

// @route   GET /api/v1/system/backup
router.get('/backup', authMiddleware(['ADMIN']), backupDatabase);

// @route   POST /api/v1/system/restore
router.post('/restore', authMiddleware(['ADMIN']), restoreDatabase);

module.exports = router;
