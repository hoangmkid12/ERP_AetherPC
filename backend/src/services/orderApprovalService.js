const { adjustLoyaltyForOrder } = require('../controllers/order.controller');
const { claimAvailableSerials } = require('../utils/serialAllocation');

/**
 * Idempotent, stock-safe order approval — the single real implementation shared by
 * orderScheduler.js (polls PENDING orders older than 5h) and orderWorker.js (the
 * Redis queue consumer). Both call this from inside their own prisma.$transaction,
 * so whichever of the two mechanisms is actually wired up to a given order — or if
 * both somehow race on the same order — only one can ever flip it out of PENDING:
 * the fresh re-fetch below rejects anything already moved, and the stock decrement
 * uses an atomic conditional updateMany (not read-then-write), so a losing racer
 * throws and its whole transaction rolls back instead of double-decrementing.
 *
 * Returns { status: 'CONFIRMED' | 'AWAITING_STOCK' } on success, or null if the
 * order was no longer PENDING by the time this ran (already handled elsewhere).
 */
const approveOrderIfReady = async (tx, orderId, { noteSuffix = '' } = {}) => {
  const freshOrder = await tx.order.findUnique({
    where: { orderId },
    include: { items: true }
  });

  if (!freshOrder || freshOrder.status !== 'PENDING') return null;

  let hasShortage = false;
  const shortageItems = [];

  for (const item of freshOrder.items) {
    const prod = await tx.product.findUnique({ where: { productId: item.productId } });
    if (!prod || prod.stockQuantity < item.quantity) {
      hasShortage = true;
      if (prod) shortageItems.push(prod.name);
    }
  }

  if (hasShortage) {
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

  // Atomic-conditional decrement per item — losing a race here throws and rolls
  // back this entire transaction, leaving the order untouched for a later retry.
  let totalCogs = 0;
  for (const item of freshOrder.items) {
    const productBeforeUpdate = await tx.product.findUnique({
      where: { productId: item.productId },
      select: { averageCost: true }
    });

    const productUpdate = await tx.product.updateMany({
      where: { productId: item.productId, available: true, stockQuantity: { gte: item.quantity } },
      data: { stockQuantity: { decrement: item.quantity } }
    });
    if (productUpdate.count !== 1) {
      throw new Error(`Tồn kho không đủ cho sản phẩm ${item.productId} (race với giao dịch khác) — giữ nguyên PENDING`);
    }

    // Bắt buộc gán Serial Number cho từng đơn vị xuất kho — không có serial khả
    // dụng nghĩa là tồn kho thật không đủ, dù Product.stockQuantity nói khác.
    await claimAvailableSerials(tx, item.productId, item.quantity, freshOrder.orderId);

    totalCogs += Number(productBeforeUpdate?.averageCost || 0) * item.quantity;

    const inventory = await tx.inventory.findFirst({
      where: { productId: item.productId, warehouseId: 1 }
    });
    if (inventory) {
      await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantityOnHand: { decrement: item.quantity } }
      });
    }

    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        fromWarehouseId: 1,
        type: 'OUT',
        quantity: item.quantity,
        referenceId: freshOrder.orderId,
        note: `Xuất kho tự động duyệt cho Đơn Hàng ${freshOrder.orderId}${noteSuffix}`
      }
    });
  }

  // Giá vốn hàng bán (COGS) thực tế của đơn hàng này, theo giá bình quân gia
  // quyền tại thời điểm bán — ghi vào Sổ Cái để P&L (Accountant.jsx) đối chiếu
  // đúng doanh thu với giá vốn thật, thay vì lấy tổng tiền mua NCC làm COGS.
  if (totalCogs > 0) {
    await tx.ledgerEntry.create({
      data: {
        type: 'EXPENSE',
        amount: totalCogs,
        description: `Giá vốn hàng bán (COGS) — Đơn Hàng ${freshOrder.orderId}`,
        referenceId: `COGS-${freshOrder.orderId}`
      }
    });
  }

  await adjustLoyaltyForOrder(tx, freshOrder.customerId, freshOrder.totalAmount, 'add');

  await tx.order.update({
    where: { orderId: freshOrder.orderId },
    data: { status: 'CONFIRMED' }
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

module.exports = { approveOrderIfReady };
