const { adjustLoyaltyForOrder, isStockOut, deductOrderStock } = require('./orderFulfillment');

/**
 * Idempotent, stock-safe order approval — the single real implementation shared by
 * orderScheduler.js (polls PENDING orders older than 5h), orderWorker.js (the Redis queue
 * consumer), the SePay webhook (paid bank-transfer orders) and goods-receipt validation
 * (re-allocating AWAITING_STOCK orders when stock arrives). Callers run it inside their own
 * prisma.$transaction; the fresh re-fetch rejects anything already moved, and the stock
 * decrement in deductOrderStock is an atomic conditional updateMany, so a losing racer
 * throws and its whole transaction rolls back instead of double-decrementing.
 *
 * Stock-out goes through services/orderFulfillment.js like every other path — this used to
 * carry its own copy that only touched warehouse 1 and silently skipped products without an
 * inventory row there, so Product.stockQuantity and the warehouse totals drifted apart.
 *
 * Returns { status: 'CONFIRMED' | 'AWAITING_STOCK' } on success, or null if the order was not
 * in an approvable state (or, with allowAwaiting, is still short of stock).
 */
const approveOrderIfReady = async (tx, orderId, { noteSuffix = '', allowAwaiting = false } = {}) => {
  const freshOrder = await tx.order.findUnique({
    where: { orderId },
    include: { items: true }
  });

  const approvable = ['PENDING', ...(allowAwaiting ? ['AWAITING_STOCK'] : [])];
  if (!freshOrder || !approvable.includes(freshOrder.status)) return null;

  const shortageItems = [];
  for (const item of freshOrder.items) {
    const prod = await tx.product.findUnique({ where: { productId: item.productId } });
    if (!prod || !prod.available || prod.stockQuantity < item.quantity) {
      shortageItems.push(prod ? prod.name : item.productId);
    }
  }

  if (shortageItems.length > 0) {
    // Đơn đang chờ hàng mà hàng về vẫn chưa đủ: giữ nguyên, không ghi thêm lịch sử.
    if (freshOrder.status === 'AWAITING_STOCK') return null;
    await tx.order.update({
      where: { orderId: freshOrder.orderId },
      data: { status: 'AWAITING_STOCK' }
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: freshOrder.orderId,
        status: 'AWAITING_STOCK',
        note: `Hệ thống tự động chuyển Chờ hàng (Thiếu tồn kho cho: ${shortageItems.join(', ')}).${noteSuffix}`,
        changedBy: 'Hệ thống'
      }
    });
    return { status: 'AWAITING_STOCK' };
  }

  if (!(await isStockOut(tx, freshOrder.orderId))) {
    await deductOrderStock(tx, freshOrder, { note: `Xuất kho tự động duyệt cho Đơn Hàng ${freshOrder.orderId}${noteSuffix}` });
    await adjustLoyaltyForOrder(tx, freshOrder.customerId, freshOrder.totalAmount, 'add');
  }

  await tx.order.update({
    where: { orderId: freshOrder.orderId },
    data: { status: 'CONFIRMED', confirmedAt: new Date() }
  });

  await tx.orderStatusHistory.create({
    data: {
      orderId: freshOrder.orderId,
      status: 'CONFIRMED',
      note: `Hệ thống tự động duyệt (Đủ tồn kho). Tự động trừ kho & tích điểm thành viên.${noteSuffix}`,
      changedBy: 'Hệ thống'
    }
  });

  return { status: 'CONFIRMED' };
};

/**
 * Hàng vừa nhập kho: phân bổ lần lượt (đơn đặt trước được ưu tiên — FIFO) cho các đơn đang
 * "Chờ hàng" có chứa các sản phẩm vừa về. Mỗi đơn một giao dịch riêng để một đơn lỗi không
 * chặn các đơn khác. Trước đây đơn AWAITING_STOCK nằm im cho tới khi nhân viên tự bấm duyệt.
 * @returns {Promise<string[]>} các mã đơn đã được duyệt
 */
const allocateAwaitingOrders = async (prisma, productIds, { limit = 20 } = {}) => {
  if (productIds !== null && (!Array.isArray(productIds) || productIds.length === 0)) return [];
  const waiting = await prisma.order.findMany({
    where: { status: 'AWAITING_STOCK', ...(productIds ? { items: { some: { productId: { in: productIds } } } } : {}) },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { orderId: true }
  });
  const approved = [];
  for (const { orderId } of waiting) {
    try {
      const result = await prisma.$transaction(
        (tx) => approveOrderIfReady(tx, orderId, { allowAwaiting: true, noteSuffix: ' (hàng về kho, tự phân bổ)' }),
        { maxWait: 10000, timeout: 60000 }
      );
      if (result?.status === 'CONFIRMED') approved.push(orderId);
    } catch (err) {
      console.warn(`[AllocateAwaiting] Không thể phân bổ hàng cho đơn ${orderId}:`, err.message);
    }
  }
  return approved;
};

module.exports = { approveOrderIfReady, allocateAwaitingOrders };
