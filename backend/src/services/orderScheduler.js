const prisma = require('../config/database');

const checkAndApprovePendingOrders = async () => {
  try {
    // 5 hours ago
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);

    // Fetch pending orders older than 5 hours
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: fiveHoursAgo
        }
      },
      include: {
        items: true
      }
    });

    if (pendingOrders.length === 0) return;

    console.log(`[OrderScheduler] Found ${pendingOrders.length} pending orders older than 5 hours. Processing...`);

    for (const order of pendingOrders) {
      try {
        await prisma.$transaction(async (tx) => {
          // Re-fetch to ensure order status hasn't changed
          const freshOrder = await tx.order.findUnique({
            where: { orderId: order.orderId },
            include: { items: true }
          });

          if (!freshOrder || freshOrder.status !== 'PENDING') return;

          // Check stock
          let hasShortage = false;
          const shortageItems = [];

          for (const item of freshOrder.items) {
            const prod = await tx.product.findUnique({
              where: { productId: item.productId }
            });

            if (!prod || prod.stockQuantity < item.quantity) {
              hasShortage = true;
              if (prod) shortageItems.push(prod.name);
            }
          }

          const targetStatus = hasShortage ? 'AWAITING_STOCK' : 'CONFIRMED';
          const historyNote = hasShortage
            ? `Hệ thống tự động chuyển Chờ hàng sau 5h (Thiếu tồn kho cho: ${shortageItems.join(', ')}).`
            : `Hệ thống tự động duyệt sau 5h chờ (Đủ tồn kho). Tự động trừ kho.`;

          // If in stock, deduct stock
          if (!hasShortage) {
            for (const item of freshOrder.items) {
              // 1. Deduct Product stock
              await tx.product.update({
                where: { productId: item.productId },
                data: {
                  stockQuantity: {
                    decrement: item.quantity
                  }
                }
              });

              // 2. Deduct Inventory stock for warehouse 1
              const inventory = await tx.inventory.findFirst({
                where: {
                  productId: item.productId,
                  warehouseId: 1
                }
              });

              if (inventory) {
                await tx.inventory.update({
                  where: { id: inventory.id },
                  data: {
                    quantityOnHand: {
                      decrement: item.quantity
                    }
                  }
                });
              }

              // 3. Log Stock Movement
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  fromWarehouseId: 1,
                  type: 'OUT',
                  quantity: item.quantity,
                  referenceId: freshOrder.orderId,
                  note: `Xuất kho tự động sau 5h duyệt cho Đơn Hàng ${freshOrder.orderId}`
                }
              });
            }
          }

          // Update order status
          await tx.order.update({
            where: { orderId: freshOrder.orderId },
            data: { status: targetStatus }
          });

          // Write history log
          await tx.orderStatusHistory.create({
            data: {
              orderId: freshOrder.orderId,
              status: targetStatus,
              note: historyNote,
              changedBy: 'Hệ thống'
            }
          });

          console.log(`[OrderScheduler] Auto-processed order ${freshOrder.orderId} to status ${targetStatus}`);
        });
      } catch (orderError) {
        console.error(`[OrderScheduler] Failed to process order ${order.orderId}:`, orderError.message);
      }
    }
  } catch (error) {
    console.error('[OrderScheduler] Error in checkAndApprovePendingOrders:', error.message);
  }
};

const startScheduler = () => {
  console.log('[OrderScheduler] Order automatic approval scheduler initialized.');
  // Run check every 1 minute
  setInterval(checkAndApprovePendingOrders, 60000);
};

module.exports = { startScheduler };
