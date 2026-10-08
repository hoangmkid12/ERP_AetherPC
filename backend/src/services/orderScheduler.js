const prisma = require('../config/database');
const { approveOrderIfReady } = require('./orderApprovalService');

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
      select: { orderId: true }
    });

    if (pendingOrders.length === 0) return;

    console.log(`[OrderScheduler] Found ${pendingOrders.length} pending orders older than 5 hours. Processing...`);

    for (const order of pendingOrders) {
      try {
        const result = await prisma.$transaction((tx) => approveOrderIfReady(tx, order.orderId, { noteSuffix: ' (sau 5h chờ)' }));
        if (result) {
          console.log(`[OrderScheduler] Auto-processed order ${order.orderId} to status ${result.status}`);
        }
      } catch (orderError) {
        console.error(`[OrderScheduler] Failed to process order ${order.orderId}:`, orderError.message);
      }
    }
  } catch (error) {
    console.error('[OrderScheduler] Error in checkAndApprovePendingOrders:', error.message);
  }
};

const checkAndCancelUnpaidOrders = async () => {
  try {
    const { autoCancelUnpaidOrders } = require('../controllers/order.controller');
    if (typeof autoCancelUnpaidOrders === 'function') {
      await autoCancelUnpaidOrders();
    }
  } catch (error) {
    console.error('[OrderScheduler] Error in checkAndCancelUnpaidOrders:', error.message);
  }
};

const startScheduler = () => {
  console.log('[OrderScheduler] Order automatic approval & unpaid expiration scheduler initialized.');
  // Run immediately on boot
  checkAndCancelUnpaidOrders().catch(() => {});
  // Run checks every 1 minute
  setInterval(async () => {
    await checkAndApprovePendingOrders();
    await checkAndCancelUnpaidOrders();
  }, 60000);
};

module.exports = { startScheduler };
