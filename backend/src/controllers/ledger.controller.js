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
            customer: { select: { name: true, phone: true } }
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
        customerPhone: payment.order.customer?.phone,
        amount: Number(payment.amount),
        deliveredAt: payment.order.deliveredAt,
        shippingAddress: payment.order.shippingAddress
      });
    }

    // Lịch sử các khoản COD đã đối soát gần đây (30 ngày qua)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const settledPayments = await prisma.orderPayment.findMany({
      where: {
        method: 'CASH',
        status: 'SUCCESS',
        settledAt: { gte: thirtyDaysAgo },
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
      orderBy: { settledAt: 'desc' },
      take: 200
    });

    res.json({
      success: true,
      data: Object.values(byShipper),
      history: settledPayments.map(p => ({
        paymentId: p.id,
        orderId: p.order?.orderId,
        shipperId: p.order?.assignedShipperId,
        shipperName: p.order?.assignedShipper?.fullName || 'Shipper',
        customerName: p.order?.customer?.name,
        amount: Number(p.amount),
        deliveredAt: p.order?.deliveredAt,
        settledAt: p.settledAt,
        settledBy: p.settledBy
      }))
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/ledger/cod-settlement/:shipperId/settle — Kế Toán xác nhận đã
// thu hồi tiền mặt COD từ 1 shipper cụ thể, đóng toàn bộ khoản còn nợ của
// shipper đó tại thời điểm này và ghi nhận bút toán thu tiền vào Sổ Cái.
const settleCodForShipper = async (req, res, next) => {
  try {
    const shipperId = parseInt(req.params.shipperId, 10);
    if (!Number.isInteger(shipperId)) {
      return res.status(400).json({ success: false, message: 'Mã shipper không hợp lệ.' });
    }

    const pendingPayments = await prisma.orderPayment.findMany({
      where: {
        method: 'CASH',
        status: 'SUCCESS',
        settledAt: null,
        order: { assignedShipperId: shipperId }
      },
      include: {
        order: {
          select: {
            orderId: true,
            assignedShipper: { select: { fullName: true } }
          }
        }
      }
    });

    if (pendingPayments.length === 0) {
      return res.status(409).json({ success: false, message: 'Không có khoản COD nào đang chờ đối soát cho shipper này.' });
    }

    const totalAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const shipperName = pendingPayments[0]?.order?.assignedShipper?.fullName || `Shipper #${shipperId}`;
    const settledBy = req.user?.fullname || req.user?.name || req.user?.email || req.user?.code || 'Kế toán';
    const now = new Date();

    const paymentIds = pendingPayments.map(p => p.id);
    await prisma.orderPayment.updateMany({
      where: { id: { in: paymentIds } },
      data: { settledAt: now, settledBy }
    });

    // Tự động ghi bút toán thu tiền vào Sổ Cái Kế Toán (LedgerEntry)
    if (totalAmount > 0) {
      await prisma.ledgerEntry.create({
        data: {
          type: 'INCOME',
          amount: totalAmount,
          description: `Thu tiền mặt COD từ shipper ${shipperName} (${pendingPayments.length} đơn hàng)`,
          referenceId: `COD-SETTLE-${shipperId}-${Date.now().toString().slice(-6)}`,
          date: now
        }
      }).catch(e => console.warn('[LedgerEntry] Lỗi ghi nhận sổ cái COD:', e.message));
    }

    logAudit({ req, action: 'SETTLE_COD', module: 'Kế Toán', targetId: shipperId, note: `${pendingPayments.length} đơn, ${totalAmount}đ` });

    res.json({
      success: true,
      message: `Đã đối soát thành công ${pendingPayments.length} đơn COD (Tổng: ${totalAmount.toLocaleString('vi-VN')}đ).`,
      data: {
        count: pendingPayments.length,
        totalAmount,
        settledBy,
        settledAt: now
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLedger, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, getCodSettlement, settleCodForShipper };
