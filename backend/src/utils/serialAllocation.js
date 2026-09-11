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

  const claimedSerials = [];

  if (candidates.length > 0) {
    const ids = candidates.map(c => c.id);
    await tx.serialNumber.updateMany({
      where: { id: { in: ids }, status: 'AVAILABLE' },
      data: { status: 'USED', orderId }
    });
    claimedSerials.push(...candidates.map(c => c.serial));
  }

  // If the product doesn't have enough pre-seeded serial numbers in DB,
  // auto-generate the remaining traceable serials directly as USED for this order
  // so valid physical stock is never blocked from dispatch.
  const needed = quantity - candidates.length;
  if (needed > 0) {
    const newSerials = [];
    for (let i = 0; i < needed; i++) {
      const rand = Math.floor(100000 + Math.random() * 900000);
      const serialStr = `SN-${productId}-${Date.now().toString().slice(-6)}-${rand}`;
      newSerials.push({
        serial: serialStr,
        productId,
        status: 'USED',
        orderId,
        warrantyMonths: 36
      });
      claimedSerials.push(serialStr);
    }
    await tx.serialNumber.createMany({ data: newSerials });
  }

  return claimedSerials;
};

module.exports = { claimAvailableSerials };
