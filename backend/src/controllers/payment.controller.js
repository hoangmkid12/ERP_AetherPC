const prisma = require('../config/database');
const {
  getReceivingAccount, transferContentOf, buildQrUrl, findOrderByTransfer, verifyWebhookAuth,
} = require('../services/sepay');
const { approveOrderIfReady } = require('../services/orderApprovalService');
const { sendOrderConfirmationEmail } = require('../services/emailService');

const STAFF_ROLES = ['SALES', 'SALES_MANAGER', 'CSKH', 'ACCOUNTANT', 'CEO', 'ADMIN'];
const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

// Lý do một khoản chuyển khoản phải hoàn lại cho khách
function refundReasonOf(payment, order) {
  if (String(payment.transactionId || '').endsWith('-DU')) return 'Chuyển dư so với giá trị đơn';
  if (order?.status === 'CANCELLED') return 'Chuyển vào đơn đã hủy';
  if (Number(payment.amount) < Number(order?.totalAmount || 0)) return 'Chuyển thiếu số tiền đơn hàng';
  return 'Chuyển trùng, đơn đã được thanh toán';
}

// GET /payments/sepay/orders/:orderId — thông tin chuyển khoản (QR, số tài khoản, nội dung) và
// trạng thái thanh toán hiện tại của đơn. Trang thanh toán gọi lại định kỳ để biết khi nào tiền về.
const getSepayPayment = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderId: req.params.orderId },
      select: { orderId: true, customerId: true, totalAmount: true, status: true, paymentMethod: true, paymentStatus: true, createdAt: true },
    });
    const isStaff = STAFF_ROLES.includes(req.user?.role);
    if (!order || (!isStaff && order.customerId !== req.user?.id)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    const paid = await prisma.orderPayment.aggregate({
      where: { orderId: order.orderId, method: 'BANK_TRANSFER', status: 'SUCCESS', transactionId: { startsWith: 'SEPAY-' } },
      _sum: { amount: true },
    });
    const refundRows = await prisma.orderPayment.findMany({
      where: { orderId: order.orderId, method: 'BANK_TRANSFER', status: { in: ['REFUND_PENDING', 'REFUNDED'] } },
      select: { amount: true, status: true, createdAt: true, transactionId: true },
      orderBy: { createdAt: 'asc' },
    });
    const total = Number(order.totalAmount);
    const base = {
      orderId: order.orderId,
      orderStatus: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      amount: total,
      paidAmount: Number(paid._sum.amount || 0),
      // Khoản đã chuyển nhưng không dùng để thanh toán đơn (thiếu / dư / trùng) — sẽ được hoàn lại
      refunds: refundRows.map(r => ({
        amount: Number(r.amount), status: r.status, at: r.createdAt,
        reason: refundReasonOf(r, order),
      })),
    };

    if (order.paymentStatus === 'PAID' || order.paymentMethod !== 'BANK_TRANSFER' || order.status === 'CANCELLED') {
      return res.json({ success: true, data: base });
    }

    const account = await getReceivingAccount();
    if (!account) {
      return res.status(503).json({ success: false, message: 'Cửa hàng chưa cấu hình tài khoản nhận chuyển khoản. Vui lòng liên hệ CSKH.' });
    }
    const content = transferContentOf(order.orderId);
    res.json({
      success: true,
      data: {
        ...base,
        content,
        qrUrl: buildQrUrl(account, total, content),
        bank: account.bank,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountHolder: account.accountHolder,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /payments/sepay/webhook — SePay gọi khi có giao dịch trên tài khoản đã liên kết.
// Luôn trả 200 { success: true } cho giao dịch đã xử lý hoặc cố ý bỏ qua để SePay không gửi lại;
// chỉ trả lỗi khi xác thực sai hoặc máy chủ lỗi (SePay sẽ thử gửi lại).
const sepayWebhook = async (req, res, next) => {
  const auth = verifyWebhookAuth(req);
  if (!auth.ok) {
    console.warn(`[SePay] Từ chối webhook: ${auth.message}`);
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  try {
    const tx = req.body || {};
    const sepayId = tx.id;
    const amount = Number(tx.transferAmount) || 0;
    if (!sepayId || tx.transferType !== 'in' || amount <= 0) {
      return res.json({ success: true, message: 'Bỏ qua: không phải giao dịch tiền vào.' });
    }

    const account = await getReceivingAccount();
    if (account && tx.accountNumber && ![tx.accountNumber, tx.subAccount].includes(account.accountNumber)) {
      return res.json({ success: true, message: 'Bỏ qua: không phải tài khoản nhận tiền bán hàng.' });
    }

    const transactionId = `SEPAY-${sepayId}`;

    const orderId = await findOrderByTransfer(tx);
    if (!orderId) {
      console.warn(`[SePay] Giao dịch ${sepayId} (${fmt(amount)}) không khớp đơn hàng nào: "${tx.content}"`);
      return res.json({ success: true, message: 'Không tìm thấy mã đơn hàng trong nội dung chuyển khoản.' });
    }

    const ref = tx.referenceCode ? ` · Mã GD ngân hàng ${tx.referenceCode}` : '';
    const result = await prisma.$transaction(async (db) => {
      // Khóa theo đơn hàng: các webhook cùng đơn (kể cả SePay gửi lại cùng giao dịch) xử lý lần lượt
      await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'sepay:' + orderId}))::text`;
      const already = await db.orderPayment.findFirst({ where: { transactionId: { in: [transactionId, `${transactionId}-DU`] } } });
      if (already) return { orderId, outcome: 'DUPLICATE' };

      const order = await db.order.findUnique({ where: { orderId } });
      const total = Number(order.totalAmount);
      const log = (status, note) => db.orderStatusHistory.create({ data: { orderId, status, note, changedBy: 'SePay' } });

      // Mỗi lần quét QR là một lần thanh toán trọn đơn: chỉ một giao dịch ĐỦ tổng tiền mới xác nhận
      // đơn. Giao dịch ít hơn (khách sửa số tiền trong app ngân hàng) không cộng dồn, không xác nhận —
      // ghi nhận REFUND_PENDING để Kế toán hoàn trả; đơn vẫn chờ thanh toán đúng số tiền.
      let outcome;
      if (order.status === 'CANCELLED') outcome = 'CANCELLED_NEEDS_REFUND';
      else if (order.paymentStatus === 'PAID') outcome = 'ALREADY_PAID';
      else if (amount < total) outcome = 'UNDERPAID';
      else outcome = 'PAID';

      const paidPart = outcome === 'PAID' ? total : 0;
      const refundPart = amount - paidPart; // > 0: chuyển thiếu / dư / trùng / vào đơn đã hủy
      if (paidPart > 0) {
        await db.orderPayment.create({
          data: { orderId, method: 'BANK_TRANSFER', amount: paidPart, transactionId, status: 'SUCCESS', settledAt: new Date(), settledBy: 'SePay' },
        });
      }
      if (refundPart > 0) {
        await db.orderPayment.create({
          data: {
            orderId, method: 'BANK_TRANSFER', amount: refundPart,
            transactionId: paidPart > 0 ? `${transactionId}-DU` : transactionId,
            status: 'REFUND_PENDING',
          },
        });
      }

      // Tiền đã vào tài khoản công ty (kể cả khoản phải hoàn): ghi sổ cái và cộng số dư ngân hàng
      await db.ledgerEntry.create({
        data: {
          type: 'INCOME', amount, channel: 'BANK', bankAccountId: account?.bankAccountId || null,
          description: `Thu chuyển khoản SePay cho Đơn Hàng ${orderId} (${tx.gateway || 'Ngân hàng'}${ref})${outcome === 'PAID' ? '' : ' — chờ hoàn trả khách'}`,
          referenceId: transactionId,
          date: tx.transactionDate ? new Date(String(tx.transactionDate).replace(' ', 'T') + '+07:00') : new Date(),
        },
      });
      if (account?.bankAccountId) {
        await db.companyBankAccount.update({ where: { id: account.bankAccountId }, data: { currentBalance: { increment: amount } } });
      }

      if (outcome === 'CANCELLED_NEEDS_REFUND') {
        await log(order.status, `Nhận ${fmt(amount)} chuyển khoản qua SePay${ref} nhưng đơn đã hủy — cần Kế toán hoàn tiền cho khách.`);
        return { orderId, outcome };
      }
      if (outcome === 'ALREADY_PAID') {
        await log(order.status, `Nhận thêm ${fmt(amount)} qua SePay${ref} sau khi đơn đã thanh toán — cần Kế toán hoàn lại khoản này cho khách.`);
        return { orderId, outcome };
      }
      if (outcome === 'UNDERPAID') {
        await log(order.status, `Nhận ${fmt(amount)} qua SePay${ref}, chưa đủ số tiền đơn hàng ${fmt(total)} — đơn chưa được xác nhận. Khoản ${fmt(amount)} chờ Kế toán hoàn lại cho khách.`);
        return { orderId, outcome };
      }

      // Đủ tiền: đánh dấu đã thanh toán, đưa đơn về PENDING rồi duyệt ngay (trừ kho, gán serial,
      // hoặc chuyển Chờ hàng nếu thiếu tồn) bằng đúng logic duyệt đơn dùng chung của hệ thống.
      const wasWaiting = order.status === 'WAITING_PAYMENT';
      await db.order.update({
        where: { orderId },
        data: { paymentStatus: 'PAID', ...(wasWaiting ? { status: 'PENDING' } : {}) },
      });
      await log(wasWaiting ? 'PENDING' : order.status,
        `Đã thanh toán ${fmt(total)} qua SePay${ref}${amount > total ? ` (khách chuyển dư ${fmt(amount - total)}, cần hoàn lại)` : ''}.`);
      const approved = wasWaiting ? await approveOrderIfReady(db, orderId, { noteSuffix: ' (đã thanh toán chuyển khoản)' }) : null;
      return { orderId, outcome, status: approved?.status || (wasWaiting ? 'PENDING' : order.status) };
    });

    console.log(`[SePay] Giao dịch ${sepayId}: ${fmt(amount)} → đơn ${result.orderId} (${result.outcome})`);

    // Gửi email xác nhận đơn hàng khi thanh toán online thành công
    if (result.outcome === 'PAID') {
      try {
        const fullOrder = await prisma.order.findUnique({
          where: { orderId: result.orderId },
          include: {
            customer: true,
            items: { include: { product: true } }
          }
        });
        if (fullOrder?.customer?.email) {
          sendOrderConfirmationEmail({
            toEmail: fullOrder.customer.email,
            customerName: fullOrder.customer.name,
            orderId: fullOrder.orderId,
            items: fullOrder.items,
            subtotal: fullOrder.subtotal,
            discount: fullOrder.discount,
            shippingFee: fullOrder.shippingFee,
            totalAmount: fullOrder.totalAmount,
            paymentMethod: fullOrder.paymentMethod,
            shippingAddress: fullOrder.shippingAddress
          }).catch(err => console.warn('[Email] Lỗi gửi email xác nhận sau thanh toán online:', err.message));
        }
      } catch (mailErr) {
        console.warn('[Email] Lỗi tìm đơn hàng để gửi email xác nhận sau thanh toán:', mailErr.message);
      }
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// GET /payments/refunds?status=REFUND_PENDING|REFUNDED — các khoản chuyển khoản SePay phải hoàn cho khách
const listTransferRefunds = async (req, res, next) => {
  try {
    const status = req.query.status === 'REFUNDED' ? 'REFUNDED' : 'REFUND_PENDING';
    const rows = await prisma.orderPayment.findMany({
      where: { method: 'BANK_TRANSFER', status, transactionId: { startsWith: 'SEPAY-' } },
      include: {
        order: {
          select: {
            orderId: true, totalAmount: true, status: true, paymentStatus: true,
            customer: { select: { name: true, phone: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: status === 'REFUNDED' ? 'desc' : 'asc' },
      take: 200,
    });
    // Mã giao dịch ngân hàng gốc nằm trong mô tả bút toán thu tương ứng
    const baseIdOf = (r) => r.transactionId.replace(/-DU$/, '');
    const ledger = await prisma.ledgerEntry.findMany({
      where: { referenceId: { in: [...new Set(rows.map(baseIdOf))] }, type: 'INCOME' },
      select: { referenceId: true, description: true, date: true },
    });
    const ledgerOf = Object.fromEntries(ledger.map(l => [l.referenceId, l]));
    res.json({
      success: true,
      data: rows.map(r => {
        const l = ledgerOf[baseIdOf(r)];
        return {
          id: r.id,
          orderId: r.orderId,
          amount: Number(r.amount),
          status: r.status,
          reason: refundReasonOf(r, r.order),
          receivedAt: l?.date || r.createdAt,
          bankRef: (l?.description.match(/Mã GD ngân hàng ([^)\s]+)/) || [])[1] || null,
          refundedAt: r.status === 'REFUNDED' ? r.settledAt : null,
          refundedBy: r.status === 'REFUNDED' ? r.settledBy : null,
          orderTotal: Number(r.order?.totalAmount || 0),
          orderStatus: r.order?.status,
          orderPaymentStatus: r.order?.paymentStatus,
          customerName: r.order?.customer?.name || '',
          customerPhone: r.order?.customer?.phone || '',
          customerEmail: r.order?.customer?.email || '',
        };
      }),
    });
  } catch (err) {
    next(err);
  }
};

// POST /payments/refunds/:id/complete { refundRef, note } — Kế toán xác nhận đã chuyển trả khách.
// Ghi bút toán REFUND, trừ số dư tài khoản đã nhận tiền, ghi lịch sử đơn.
const completeTransferRefund = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const refundRef = String(req.body?.refundRef || '').trim().slice(0, 60);
    const note = String(req.body?.note || '').trim().slice(0, 300);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: 'Mã khoản hoàn không hợp lệ.' });
    if (!refundRef) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã giao dịch chuyển trả tiền cho khách.' });
    }
    const by = req.user?.fullname || req.user?.name || req.user?.email || req.user?.code || 'Kế toán';

    const result = await prisma.$transaction(async (db) => {
      // Chỉ chuyển REFUND_PENDING → REFUNDED một lần (hai người bấm cùng lúc: người sau nhận lỗi)
      const claimed = await db.orderPayment.updateMany({
        where: { id, status: 'REFUND_PENDING', method: 'BANK_TRANSFER' },
        data: { status: 'REFUNDED', settledAt: new Date(), settledBy: by },
      });
      if (claimed.count !== 1) {
        const error = new Error('Khoản này không còn ở trạng thái chờ hoàn tiền.');
        error.statusCode = 409;
        throw error;
      }
      const payment = await db.orderPayment.findUnique({ where: { id }, include: { order: true } });
      const income = await db.ledgerEntry.findFirst({ where: { referenceId: payment.transactionId.replace(/-DU$/, ''), type: 'INCOME' } });
      const amount = Number(payment.amount);
      const reason = refundReasonOf(payment, payment.order);
      const detail = `(${reason}) · Mã GD hoàn ${refundRef}${note ? ` · ${note}` : ''}`;

      await db.ledgerEntry.create({
        data: {
          type: 'REFUND', amount, channel: 'BANK', bankAccountId: income?.bankAccountId || null,
          description: `Hoàn tiền chuyển khoản cho khách — Đơn Hàng ${payment.orderId} ${detail}`,
          referenceId: `RF-${payment.transactionId}`.slice(0, 50),
        },
      });
      if (income?.bankAccountId) {
        await db.companyBankAccount.update({ where: { id: income.bankAccountId }, data: { currentBalance: { decrement: amount } } });
      }
      await db.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          status: payment.order.status,
          note: `Kế toán ${by} đã hoàn ${fmt(amount)} cho khách ${detail}.`,
          changedBy: by,
        },
      });
      return { id, orderId: payment.orderId, amount };
    });

    res.json({ success: true, message: `Đã ghi nhận hoàn ${fmt(result.amount)} cho đơn ${result.orderId}.`, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSepayPayment, sepayWebhook, listTransferRefunds, completeTransferRefund };

