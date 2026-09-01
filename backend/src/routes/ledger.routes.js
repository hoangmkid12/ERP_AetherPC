const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { getLedger, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry } = require('../controllers/ledger.controller');

const LEDGER_ROLES = ['ACCOUNTANT', 'CEO', 'ADMIN'];

// @route   GET /api/v1/ledger
router.get('/', authMiddleware(LEDGER_ROLES), getLedger);

// @route   POST /api/v1/ledger
router.post('/', authMiddleware(LEDGER_ROLES), createLedgerEntry);

// @route   PUT /api/v1/ledger/:id
router.put('/:id', authMiddleware(LEDGER_ROLES), updateLedgerEntry);

// @route   DELETE /api/v1/ledger/:id
router.delete('/:id', authMiddleware(LEDGER_ROLES), deleteLedgerEntry);

module.exports = router;
