const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth.middleware');
const { getLedger, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, getCodSettlement, settleCodForShipper, getMyCod, remitMyCod } = require('../controllers/ledger.controller');

const LEDGER_ROLES = ['ACCOUNTANT', 'CEO', 'ADMIN'];

// Khai báo trước '/:id' để '/cod/...' không bị nuốt bởi route tham số.
// @route   GET /api/v1/ledger/cod/my
// @desc    Shipper xem tiền mặt COD mình đang giữ / đã khai báo nộp / đã được đối soát
router.get('/cod/my', authMiddleware(['DELIVERY']), getMyCod);

// @route   POST /api/v1/ledger/cod/my/remit
// @desc    Shipper khai báo đã nộp tiền mặt COD cho Kế Toán (chờ Kế Toán xác nhận)
router.post('/cod/my/remit', authMiddleware(['DELIVERY']), remitMyCod);

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
