const prisma = require('../config/database');
const { logAudit } = require('../utils/auditLog');

const VALID_TYPES = ['INCOME', 'EXPENSE', 'EXPENSE_PROJECTED', 'SHIPPING', 'REFUND'];

// Bút toán do nghiệp vụ tự sinh (giá vốn khi xuất kho, thu tiền POS/SePay/COD, chi trả NCC,
// chi lương, hoàn tiền khách). Đây là chứng từ gắn với giao dịch thật — sửa/xoá tay làm Sổ
// Cái lệch với đơn hàng/hoá đơn/bảng lương. Sai sót xử lý bằng bút toán điều chỉnh.
const SYSTEM_REF = /^(COGS|VENDORBILL|COD-SETTLE|SEPAY|POS|PAYROLL|RF)-/;
const isSystemEntry = (entry) => !!entry?.referenceId && (SYSTEM_REF.test(entry.referenceId) || entry.type === 'REFUND');
const systemEntryError = () => Object.assign(
  new Error('Bút toán do hệ thống tự ghi nhận từ nghiệp vụ (đơn hàng, hoá đơn NCC, bảng lương...) — không được sửa/xoá. Hãy lập bút toán điều chỉnh nếu cần.'),
  { statusCode: 409 }
);

// GET /api/v1/ledger
const getLedger = async (req, res, next) => {
  try {
    const entries = await prisma.ledgerEntry.findMany({
      orderBy: { date: 'desc' },
      include: {
        bankAccount: {
          select: { id: true, bankCode: true, bankName: true, accountNumber: true, isDefaultQr: true }
        }
      }
    });
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/ledger
const createLedgerEntry = async (req, res, next) => {
  try {
    const { type, amount, description, referenceId, channel, bankAccountId, date } = req.body;
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
    if (referenceId && SYSTEM_REF.test(String(referenceId))) {
      const error = new Error('Mã tham chiếu này dành cho bút toán hệ thống tự sinh — vui lòng dùng mã khác.');
      error.statusCode = 400;
      throw error;
    }
    if (!description || !String(description).trim()) {
      const error = new Error('Vui lòng nhập diễn giải cho bút toán.');
      error.statusCode = 400;
      throw error;
    }

    const finalChannel = channel === 'CASH' ? 'CASH' : 'BANK';
    let targetBankAccountId = null;

    if (finalChannel === 'BANK' && bankAccountId) {
      const bankAcc = await prisma.companyBankAccount.findUnique({ where: { id: bankAccountId } });
      if (bankAcc) {
        targetBankAccountId = bankAcc.id;
        if (entryType === 'INCOME') {
          await prisma.companyBankAccount.update({
            where: { id: bankAcc.id },
            data: { currentBalance: { increment: parsedAmount } }
          }).catch(err => console.warn('[LedgerEntry] Không thể cập nhật số dư TK:', err.message));
        } else if (entryType === 'EXPENSE' || entryType === 'REFUND') {
          await prisma.companyBankAccount.update({
            where: { id: bankAcc.id },
            data: { currentBalance: { decrement: parsedAmount } }
          }).catch(err => console.warn('[LedgerEntry] Không thể cập nhật số dư TK:', err.message));
        }
      }
    }

    const entry = await prisma.ledgerEntry.create({
      data: {
        type: entryType,
        amount: parsedAmount,
        description: String(description).trim(),
        referenceId: referenceId || null,
        channel: finalChannel,
        bankAccountId: targetBankAccountId,
        date: date ? new Date(date) : new Date()
      },
      include: {
        bankAccount: {
          select: { id: true, bankCode: true, bankName: true, accountNumber: true, isDefaultQr: true }
        }
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
    if (isSystemEntry(existing)) throw systemEntryError();

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
    if (isSystemEntry(existing)) throw systemEntryError();
    await prisma.ledgerEntry.delete({ where: { id } });
    logAudit({ req, action: 'DELETE_LEDGER_ENTRY', module: 'Kế Toán', targetId: id, note: `${existing.type} ${existing.amount}đ — ${existing.description}` });
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
          remittedAmount: 0,
          orders: []
        };
      }
      byShipper[shipperId].totalAmount += Number(payment.amount);
      if (payment.remittedAt) byShipper[shipperId].remittedAmount += Number(payment.amount);
      byShipper[shipperId].orders.push({
        paymentId: payment.id,
        orderId: payment.order.orderId,
        customerName: payment.order.customer?.name,
        customerPhone: payment.order.customer?.phone,
        amount: Number(payment.amount),
        deliveredAt: payment.order.deliveredAt,
        shippingAddress: payment.order.shippingAddress,
        remittedAt: payment.remittedAt,
        remitNote: payment.remitNote
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
// thu hồi tiền mặt COD từ 1 shipper cụ thể. Body { paymentIds } (tuỳ chọn) để
// chỉ chốt một phần khi shipper nộp thiếu; bỏ trống thì chốt toàn bộ khoản
// còn nợ. Đánh dấu settledAt và ghi bút toán Sổ Cái trong cùng 1 transaction
// để không xảy ra cảnh đã chốt COD mà Sổ Cái thiếu bút toán thu.
const settleCodForShipper = async (req, res, next) => {
  try {
    const shipperId = parseInt(req.params.shipperId, 10);
    if (!Number.isInteger(shipperId)) {
      return res.status(400).json({ success: false, message: 'Mã shipper không hợp lệ.' });
    }

    let paymentIds = null;
    if (req.body?.paymentIds !== undefined) {
      paymentIds = Array.isArray(req.body.paymentIds) ? req.body.paymentIds.map(Number) : [];
      if (paymentIds.length === 0 || paymentIds.some(id => !Number.isInteger(id))) {
        return res.status(400).json({ success: false, message: 'Danh sách khoản COD cần đối soát không hợp lệ.' });
      }
    }

    const settledBy = req.user?.fullname || req.user?.name || req.user?.email || req.user?.code || 'Kế toán';
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const pendingPayments = await tx.orderPayment.findMany({
        where: {
          ...(paymentIds ? { id: { in: paymentIds } } : {}),
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

      if (pendingPayments.length === 0) return null;
      if (paymentIds && pendingPayments.length !== new Set(paymentIds).size) {
        const error = new Error('Một số khoản COD đã chọn không còn chờ đối soát hoặc không thuộc shipper này. Vui lòng tải lại danh sách.');
        error.statusCode = 409;
        throw error;
      }

      const totalAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const shipperName = pendingPayments[0]?.order?.assignedShipper?.fullName || `Shipper #${shipperId}`;

      // settledAt: null trong where chặn 2 kế toán cùng chốt 1 khoản
      const updated = await tx.orderPayment.updateMany({
        where: { id: { in: pendingPayments.map(p => p.id) }, settledAt: null },
        data: { settledAt: now, settledBy }
      });
      if (updated.count !== pendingPayments.length) {
        const error = new Error('Khoản COD vừa được người khác đối soát. Vui lòng tải lại danh sách.');
        error.statusCode = 409;
        throw error;
      }

      if (totalAmount > 0) {
        await tx.ledgerEntry.create({
          data: {
            type: 'INCOME',
            amount: totalAmount,
            channel: 'CASH',
            description: `Thu tiền mặt COD từ shipper ${shipperName} (${pendingPayments.length} đơn: ${pendingPayments.map(p => p.order.orderId).join(', ')})`,
            referenceId: `COD-SETTLE-${shipperId}-${Date.now().toString().slice(-6)}`,
            date: now
          }
        });
      }

      return { count: pendingPayments.length, totalAmount };
    });

    if (!result) {
      return res.status(409).json({ success: false, message: 'Không có khoản COD nào đang chờ đối soát cho shipper này.' });
    }

    logAudit({ req, action: 'SETTLE_COD', module: 'Kế Toán', targetId: shipperId, note: `${result.count} đơn, ${result.totalAmount}đ` });

    res.json({
      success: true,
      message: `Đã đối soát thành công ${result.count} đơn COD (Tổng: ${result.totalAmount.toLocaleString('vi-VN')}đ).`,
      data: {
        count: result.count,
        totalAmount: result.totalAmount,
        settledBy,
        settledAt: now
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/ledger/cod/my — Shipper xem tiền mặt COD mình đang giữ theo dữ
// liệu thật (OrderPayment.settledAt), không ước tính từ danh sách đơn.
const getMyCod = async (req, res, next) => {
  try {
    const shipperId = Number(req.user?.id);
    if (!Number.isInteger(shipperId)) {
      return res.status(403).json({ success: false, message: 'Không xác định được shipper.' });
    }

    const orderSelect = {
      orderId: true,
      deliveredAt: true,
      shippingAddress: true,
      customer: { select: { name: true } }
    };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [unsettled, settled] = await Promise.all([
      prisma.orderPayment.findMany({
        where: { method: 'CASH', status: 'SUCCESS', settledAt: null, order: { assignedShipperId: shipperId } },
        include: { order: { select: orderSelect } },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.orderPayment.findMany({
        where: { method: 'CASH', status: 'SUCCESS', settledAt: { gte: thirtyDaysAgo }, order: { assignedShipperId: shipperId } },
        include: { order: { select: orderSelect } },
        orderBy: { settledAt: 'desc' },
        take: 100
      })
    ]);

    const toRow = p => ({
      paymentId: p.id,
      orderId: p.order?.orderId,
      customerName: p.order?.customer?.name,
      shippingAddress: p.order?.shippingAddress,
      deliveredAt: p.order?.deliveredAt,
      amount: Number(p.amount),
      remittedAt: p.remittedAt,
      remitNote: p.remitNote,
      settledAt: p.settledAt,
      settledBy: p.settledBy
    });
    const sum = rows => rows.reduce((s, p) => s + Number(p.amount), 0);

    res.json({
      success: true,
      data: {
        holdingAmount: sum(unsettled.filter(p => !p.remittedAt)),
        remittedPendingAmount: sum(unsettled.filter(p => p.remittedAt)),
        settledAmount30d: sum(settled),
        pending: unsettled.map(toRow),
        history: settled.map(toRow)
      }
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/ledger/cod/my/remit — Shipper khai báo đã nộp tiền mặt cho Kế
// Toán. Body { paymentIds?, note? }; bỏ trống paymentIds = khai báo toàn bộ
// khoản đang giữ. Chỉ là khai báo — Kế Toán vẫn phải xác nhận (settle).
const remitMyCod = async (req, res, next) => {
  try {
    const shipperId = Number(req.user?.id);
    if (!Number.isInteger(shipperId)) {
      return res.status(403).json({ success: false, message: 'Không xác định được shipper.' });
    }

    let paymentIds = null;
    if (req.body?.paymentIds !== undefined) {
      paymentIds = Array.isArray(req.body.paymentIds) ? req.body.paymentIds.map(Number) : [];
      if (paymentIds.length === 0 || paymentIds.some(id => !Number.isInteger(id))) {
        return res.status(400).json({ success: false, message: 'Danh sách khoản COD không hợp lệ.' });
      }
    }
    const note = req.body?.note ? String(req.body.note).trim().slice(0, 255) : null;

    const payments = await prisma.orderPayment.findMany({
      where: {
        ...(paymentIds ? { id: { in: paymentIds } } : {}),
        method: 'CASH',
        status: 'SUCCESS',
        settledAt: null,
        remittedAt: null,
        order: { assignedShipperId: shipperId }
      },
      select: { id: true, amount: true }
    });
    if (payments.length === 0) {
      return res.status(409).json({ success: false, message: 'Không có khoản COD nào đang giữ để khai báo nộp.' });
    }

    await prisma.orderPayment.updateMany({
      where: { id: { in: payments.map(p => p.id) }, settledAt: null, remittedAt: null },
      data: { remittedAt: new Date(), remitNote: note }
    });

    const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
    logAudit({ req, action: 'REMIT_COD', module: 'Giao Hàng', targetId: shipperId, note: `${payments.length} đơn, ${totalAmount}đ` });

    res.json({
      success: true,
      message: `Đã khai báo nộp ${totalAmount.toLocaleString('vi-VN')}đ (${payments.length} đơn). Chờ Kế toán xác nhận.`,
      data: { count: payments.length, totalAmount }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLedger, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, getCodSettlement, settleCodForShipper, getMyCod, remitMyCod };
