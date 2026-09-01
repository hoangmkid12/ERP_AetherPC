const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const {
  getAssemblyJobs,
  createAssemblyJob,
  updateAssemblyJob,
  deleteAssemblyJob
} = require('../controllers/assembly.controller');

// Role list mirrors the existing /admin/assembly frontend route guard
// (App.jsx `allowedRoles={['ASSEMBLY', 'CEO', 'ADMIN']}`) — kept identical
// here so backend and frontend access agree.
const ASSEMBLY_ROLES = ['ASSEMBLY', 'CEO', 'ADMIN'];

// @route   GET /api/v1/assembly-jobs
router.get('/', authMiddleware(ASSEMBLY_ROLES), getAssemblyJobs);

// @route   POST /api/v1/assembly-jobs
router.post('/', authMiddleware(ASSEMBLY_ROLES), createAssemblyJob);

// @route   PUT /api/v1/assembly-jobs/:jobId
router.put('/:jobId', authMiddleware(ASSEMBLY_ROLES), updateAssemblyJob);

// @route   DELETE /api/v1/assembly-jobs/:jobId
router.delete('/:jobId', authMiddleware(ASSEMBLY_ROLES), deleteAssemblyJob);

module.exports = router;
