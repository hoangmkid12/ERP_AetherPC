/**
 * Serial Number allocation for order fulfillment — shared by every real stock-out
 * path (order.controller.js createOrder / updateOrderStatus, orderApprovalService.js
 * used by both the 5h scheduler and the queue worker) so a unit can never leave the
 * warehouse without being tied to a traceable serial (for warranty lookups later).
 *
 * Claims the oldest `quantity` AVAILABLE serials for a product and marks them USED
 * against `orderId`, atomically: the conditional updateMany (not read-then-write)
 * means a losing concurrent sale on the same product sees `count !== quantity` and
 * throws, rolling back its whole transaction instead of double-selling a serial.
 *
 * Must be called inside the same transaction as the Product.stockQuantity decrement
 * for the same line item, so the two can never fall out of sync with each other.
 */
const claimAvailableSerials = async (tx, productId, quantity, orderId) => {
  if (quantity <= 0) return [];

  const candidates = await tx.serialNumber.findMany({
    where: { productId, status: 'AVAILABLE' },
    orderBy: { id: 'asc' },
    take: quantity,
    select: { id: true, serial: true }
  });

  if (candidates.length < quantity) {
    const error = new Error(
      `Không đủ Serial Number khả dụng cho sản phẩm ${productId} (cần ${quantity}, còn ${candidates.length}).`
    );
    error.statusCode = 409;
    throw error;
  }

  const ids = candidates.map(c => c.id);
  const claimed = await tx.serialNumber.updateMany({
    where: { id: { in: ids }, status: 'AVAILABLE' },
    data: { status: 'USED', orderId }
  });

  if (claimed.count !== quantity) {
    const error = new Error(`Serial Number cho sản phẩm ${productId} vừa bị giành bởi giao dịch khác — thử lại.`);
    error.statusCode = 409;
    throw error;
  }

  return candidates.map(c => c.serial);
};

module.exports = { claimAvailableSerials };
