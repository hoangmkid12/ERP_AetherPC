const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { getLedger, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, getCodSettlement, settleCodForShipper } = require('../controllers/ledger.controller');

const LEDGER_ROLES = ['ACCOUNTANT', 'CEO', 'ADMIN'];

// @route   GET /api/v1/ledger
router.get('/', authMiddleware(LEDGER_ROLES), getLedger);

// @route   POST /api/v1/ledger
router.post('/', authMiddleware(LEDGER_ROLES), createLedgerEntry);

// @route   PUT /api/v1/ledger/:id
router.put('/:id', authMiddleware(LEDGER_ROLES), updateLedgerEntry);

// @route   DELETE /api/v1/ledger/:id
router.delete('/:id', authMiddleware(LEDGER_ROLES), deleteLedgerEntry);

// @route   GET /api/v1/ledger/cod-settlement
// @desc    Tiền mặt COD từng shipper đang giữ, chưa đối soát (accounting_settle_cod)
router.get('/cod-settlement', authMiddleware(LEDGER_ROLES), getCodSettlement);

// @route   POST /api/v1/ledger/cod-settlement/:shipperId/settle
// @desc    Xác nhận đã thu hồi tiền mặt COD từ 1 shipper
router.post('/cod-settlement/:shipperId/settle', authMiddleware(LEDGER_ROLES), settleCodForShipper);

module.exports = router;
