const prisma = require('../config/database');
const { logAudit } = require('../utils/auditLog');

const VALID_TYPES = ['INCOME', 'EXPENSE', 'EXPENSE_PROJECTED', 'SHIPPING', 'REFUND'];

// GET /api/v1/ledger
const getLedger = async (req, res, next) => {
  try {
    const entries = await prisma.ledgerEntry.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/ledger
const createLedgerEntry = async (req, res, next) => {
  try {
    const { type, amount, description, referenceId, date } = req.body;
    const entryType = String(type || '').toUpperCase();

    if (!VALID_TYPES.includes(entryType)) {
      const error = new Error(`Loại bút toán không hợp lệ: ${type}. Phải là một trong: ${VALID_TYPES.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }
    const parsedAmount = parseFloat(amount);
    if (!(parsedAmount > 0)) {
      const error = new Error('Số tiền bút toán phải lớn hơn 0.');
      error.statusCode = 400;
      throw error;
    }
    if (!description || !String(description).trim()) {
      const error = new Error('Vui lòng nhập diễn giải cho bút toán.');
      error.statusCode = 400;
      throw error;
    }

    const entry = await prisma.ledgerEntry.create({
      data: {
        type: entryType,
        amount: parsedAmount,
        description: String(description).trim(),
        referenceId: referenceId || null,
        date: date ? new Date(date) : new Date()
      }
    });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/ledger/:id
const updateLedgerEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, amount, description, referenceId, date } = req.body;

    const existing = await prisma.ledgerEntry.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Không tìm thấy bút toán: ${id}`);
      error.statusCode = 404;
      throw error;
    }

    if (type && !VALID_TYPES.includes(String(type).toUpperCase())) {
      const error = new Error(`Loại bút toán không hợp lệ: ${type}.`);
      error.statusCode = 400;
      throw error;
    }
    if (amount !== undefined && !(parseFloat(amount) > 0)) {
      const error = new Error('Số tiền bút toán phải lớn hơn 0.');
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.ledgerEntry.update({
      where: { id },
      data: {
        ...(type ? { type: String(type).toUpperCase() } : {}),
        ...(amount !== undefined ? { amount: parseFloat(amount) } : {}),
        ...(description !== undefined ? { description: String(description).trim() } : {}),
        ...(referenceId !== undefined ? { referenceId } : {}),
        ...(date ? { date: new Date(date) } : {})
      }
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/ledger/:id
const deleteLedgerEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.ledgerEntry.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Không tìm thấy bút toán: ${id}`);
      error.statusCode = 404;
      throw error;
    }
    await prisma.ledgerEntry.delete({ where: { id } });
    res.json({ success: true, message: 'Đã xóa bút toán.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/ledger/cod-settlement — tiền mặt COD shipper đang giữ, nhóm
// theo shipper, chưa được Kế Toán đối soát/thu hồi (OrderPayment.settledAt
// còn null). Chỉ tính đơn có shipper thật (giao hàng COD), không tính bán
// lẻ tại quầy (không qua shipper nào để thu hồi).
const getCodSettlement = async (req, res, next) => {
  try {
    const unsettled = await prisma.orderPayment.findMany({
      where: {
        method: 'CASH',
        status: 'SUCCESS',
        settledAt: null,
        order: { assignedShipperId: { not: null } }
      },
      include: {
        order: {
          select: {
            orderId: true,
            deliveredAt: true,
            shippingAddress: true,
            assignedShipperId: true,
            assignedShipper: { select: { id: true, fullName: true, employeeCode: true } },
            customer: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const byShipper = {};
    for (const payment of unsettled) {
      const shipper = payment.order?.assignedShipper;
      const shipperId = shipper?.id;
      if (!shipperId) continue;
      if (!byShipper[shipperId]) {
        byShipper[shipperId] = {
          shipperId,
          shipperName: shipper.fullName,
          shipperCode: shipper.employeeCode,
          totalAmount: 0,
          orders: []
        };
      }
      byShipper[shipperId].totalAmount += Number(payment.amount);
      byShipper[shipperId].orders.push({
        paymentId: payment.id,
        orderId: payment.order.orderId,
        customerName: payment.order.customer?.name,
        amount: Number(payment.amount),
        deliveredAt: payment.order.deliveredAt,
        shippingAddress: payment.order.shippingAddress
      });
    }

    res.json({ success: true, data: Object.values(byShipper) });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/ledger/cod-settlement/:shipperId/settle — Kế Toán xác nhận đã
// thu hồi tiền mặt COD từ 1 shipper cụ thể, đóng toàn bộ khoản còn nợ của
// shipper đó tại thời điểm này.
const settleCodForShipper = async (req, res, next) => {
  try {
    const shipperId = parseInt(req.params.shipperId, 10);
    if (!Number.isInteger(shipperId)) {
      return res.status(400).json({ success: false, message: 'Mã shipper không hợp lệ.' });
    }

    const settledBy = req.user?.email || req.user?.code || 'Kế toán';
    const result = await prisma.orderPayment.updateMany({
      where: {
        method: 'CASH',
        status: 'SUCCESS',
        settledAt: null,
        order: { assignedShipperId: shipperId }
      },
      data: { settledAt: new Date(), settledBy }
    });

    if (result.count === 0) {
      return res.status(409).json({ success: false, message: 'Không có khoản COD nào đang chờ đối soát cho shipper này.' });
    }

    logAudit({ req, action: 'SETTLE_COD', module: 'Kế Toán', targetId: shipperId, note: `${result.count} đơn` });
    res.json({ success: true, message: `Đã đối soát ${result.count} đơn COD.`, data: { count: result.count } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLedger, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, getCodSettlement, settleCodForShipper };
