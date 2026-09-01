const prisma = require('../config/database');
const { adjustLoyaltyForOrder } = require('../controllers/order.controller');

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

          if (hasShortage) {
            await tx.order.update({
              where: { orderId: freshOrder.orderId },
              data: { status: 'AWAITING_STOCK' }
            });
            await tx.orderStatusHistory.create({
              data: {
                orderId: freshOrder.orderId,
                status: 'AWAITING_STOCK',
                note: `Hệ thống tự động chuyển Chờ hàng sau 5h (Thiếu tồn kho cho: ${shortageItems.join(', ')}).`,
                changedBy: 'Hệ thống'
              }
            });
            console.log(`[OrderScheduler] Auto-processed order ${freshOrder.orderId} to status AWAITING_STOCK`);
            return;
          }

          // Đủ tồn kho lúc kiểm tra ở trên — trừ ATOMIC-CONDITIONAL từng item
          // (cùng pattern với order.controller.js) để tránh race-condition với
          // checkout/duyệt đơn khác diễn ra song song. Nếu bất kỳ item nào bị
          // giành mất tồn kho ngay trước khi trừ, ném lỗi để Prisma tự rollback
          // toàn bộ transaction này — đơn giữ nguyên PENDING, lượt quét kế tiếp
          // sẽ xử lý lại (rơi vào catch (orderError) bên dưới).
          for (const item of freshOrder.items) {
            const productUpdate = await tx.product.updateMany({
              where: { productId: item.productId, available: true, stockQuantity: { gte: item.quantity } },
              data: { stockQuantity: { decrement: item.quantity } }
            });
            if (productUpdate.count !== 1) {
              throw new Error(`Tồn kho không đủ cho sản phẩm ${item.productId} (race với giao dịch khác) — giữ nguyên PENDING`);
            }

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

          await adjustLoyaltyForOrder(tx, freshOrder.customerId, freshOrder.totalAmount, 'add');

          await tx.order.update({
            where: { orderId: freshOrder.orderId },
            data: { status: 'CONFIRMED' }
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: freshOrder.orderId,
              status: 'CONFIRMED',
              note: `Hệ thống tự động duyệt sau 5h chờ (Đủ tồn kho). Tự động trừ kho & tích điểm thành viên.`,
              changedBy: 'Hệ thống'
            }
          });

          console.log(`[OrderScheduler] Auto-processed order ${freshOrder.orderId} to status CONFIRMED`);
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
