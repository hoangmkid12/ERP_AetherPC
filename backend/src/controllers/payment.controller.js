const prisma = require('../config/database');
const {
  getReceivingAccount, transferContentOf, buildQrUrl, findOrderByTransfer, verifyWebhookAuth,
} = require('../services/sepay');
const { approveOrderIfReady } = require('../services/orderApprovalService');

const STAFF_ROLES = ['SALES', 'SALES_MANAGER', 'CSKH', 'ACCOUNTANT', 'CEO', 'ADMIN'];
const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

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
    const total = Number(order.totalAmount);
    const base = {
      orderId: order.orderId,
      orderStatus: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      amount: total,
      paidAmount: Number(paid._sum.amount || 0),
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
      const already = await db.orderPayment.findFirst({ where: { transactionId } });
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

      await db.orderPayment.create({
        data: {
          orderId, method: 'BANK_TRANSFER', amount, transactionId,
          status: outcome === 'PAID' ? 'SUCCESS' : 'REFUND_PENDING',
          settledAt: new Date(), settledBy: 'SePay',
        },
      });

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
        await log(order.status, `Nhận ${fmt(amount)} qua SePay${ref}, không đúng số tiền đơn hàng ${fmt(total)} — đơn chưa được xác nhận. Cần Kế toán hoàn lại ${fmt(amount)} cho khách.`);
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
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSepayPayment, sepayWebhook };
