// Xuất kho / hoàn kho cho đơn bán hàng — một chỗ duy nhất cho mọi đường trừ/cộng tồn
// (tạo đơn POS/online, duyệt đơn, hệ thống tự duyệt, đơn đổi mới 1-1, huỷ đơn, nhập lại
// hàng trả). Trước đây mỗi đường tự viết lại logic này và đã lệch nhau: hệ thống tự
// duyệt chỉ trừ ở Kho 1 (bỏ qua nếu không có dòng tồn), đơn đổi mới xuất hàng mà không
// trừ kho, hàng trả nhập lại kệ nhưng serial vẫn mắc ở USED và giá vốn không được đảo.
//
// Một đơn "đang xuất kho" khi tổng StockMovement OUT gắn mã đơn lớn hơn tổng IN gắn mã
// đơn — dùng số lượng thay vì dò chuỗi ghi chú nên idempotent với mọi đường hoàn kho.
const { claimAvailableSerials } = require('../utils/serialAllocation');
const { deductInventory, restockInventory } = require('./stockSync');

const LOYALTY_VND_PER_POINT = 10000; // 10.000 VNĐ = 1 điểm

const tierForPoints = (points) => {
  if (points >= 10000) return 'PLATINUM';
  if (points >= 5000) return 'GOLD';
  if (points >= 1000) return 'SILVER';
  return 'BRONZE';
};

/**
 * Cộng ('add') hoặc trừ ('subtract') điểm thành viên tương ứng với giá trị đơn, và tự
 * điều chỉnh hạng thành viên theo tổng điểm mới.
 */
const adjustLoyaltyForOrder = async (tx, customerId, totalAmount, direction) => {
  if (!customerId || customerId === 'WALK-IN') return;
  const points = Math.floor(parseFloat(totalAmount || 0) / LOYALTY_VND_PER_POINT);
  if (points === 0) return;
  const delta = direction === 'add' ? points : -points;

  let updatedCustomer = await tx.customer.update({
    where: { customerId },
    data: { loyaltyPoints: { increment: delta } }
  });
  if (updatedCustomer.loyaltyPoints < 0) {
    updatedCustomer = await tx.customer.update({ where: { customerId }, data: { loyaltyPoints: 0 } });
  }
  const nextTier = tierForPoints(updatedCustomer.loyaltyPoints);
  if (nextTier !== updatedCustomer.tier) {
    await tx.customer.update({ where: { customerId }, data: { tier: nextTier } });
  }
};

/** Số lượng hàng của đơn hiện đang nằm ngoài kho (OUT − IN theo mã đơn). */
const netStockOut = async (tx, orderId) => {
  const rows = await tx.stockMovement.groupBy({
    by: ['type'],
    where: { referenceId: orderId, type: { in: ['OUT', 'IN'] } },
    _sum: { quantity: true }
  });
  const sum = (t) => rows.find(r => r.type === t)?._sum.quantity || 0;
  return sum('OUT') - sum('IN');
};

const isStockOut = async (tx, orderId) => (await netStockOut(tx, orderId)) > 0;

/**
 * Trừ tồn kho cho toàn bộ dòng hàng của đơn: Product.stockQuantity (có điều kiện, chống
 * bán trùng), gán Serial, chụp giá vốn bình quân vào OrderItem.unitCost, trừ tồn vật lý
 * theo kho và ghi bút toán COGS. Ném lỗi 409 khi thiếu hàng để giao dịch được hoàn tác.
 * @returns {Promise<{ totalCogs: number }>}
 */
const deductOrderStock = async (tx, order, { note } = {}) => {
  const orderId = order.orderId;
  const items = order.items || await tx.orderItem.findMany({ where: { orderId } });
  let totalCogs = 0;

  for (const item of items) {
    const product = await tx.product.findUnique({
      where: { productId: item.productId },
      select: { averageCost: true, name: true }
    });

    const productUpdate = await tx.product.updateMany({
      where: { productId: item.productId, available: true, stockQuantity: { gte: item.quantity } },
      data: { stockQuantity: { decrement: item.quantity } }
    });
    if (productUpdate.count !== 1) {
      const error = new Error(`Tồn kho không đủ cho sản phẩm ${product?.name || item.productId}.`);
      error.statusCode = 409;
      throw error;
    }

    await claimAvailableSerials(tx, item.productId, item.quantity, orderId);

    const unitCost = Number(product?.averageCost || 0);
    totalCogs += unitCost * item.quantity;
    await tx.orderItem.update({ where: { orderItemId: item.orderItemId }, data: { unitCost } });

    await deductInventory(tx, item.productId, item.quantity, {
      referenceId: orderId,
      note: note || `Xuất kho cho Đơn Hàng ${orderId}`
    });
  }

  if (totalCogs > 0) {
    await tx.ledgerEntry.create({
      data: {
        type: 'EXPENSE',
        amount: Math.round(totalCogs),
        description: `Giá vốn hàng bán (COGS) — Đơn Hàng ${orderId}`,
        referenceId: `COGS-${orderId}`
      }
    });
  }
  return { totalCogs };
};

/**
 * Hàng của đơn quay về kho. `sellable` = nhập lại kệ bán: cộng tồn, serial về AVAILABLE,
 * đảo bút toán COGS (hàng chưa bị tiêu thụ). Không bán được (hư hỏng do vận chuyển, phế
 * phẩm, gửi hãng): KHÔNG cộng tồn bán, serial chuyển `lostSerialStatus`, giữ COGS như một
 * khoản tổn thất thật. Không làm gì nếu đơn không còn hàng nằm ngoài kho (idempotent).
 * @returns {Promise<boolean>} true nếu đã xử lý hàng của đơn
 */
const returnOrderStock = async (tx, order, { sellable = true, note, lostSerialStatus = 'DEFECTIVE', warehouseId } = {}) => {
  const orderId = order.orderId;
  if (!(await isStockOut(tx, orderId))) return false;
  const items = order.items || await tx.orderItem.findMany({ where: { orderId } });

  if (sellable) {
    for (const item of items) {
      await tx.product.update({
        where: { productId: item.productId },
        data: { stockQuantity: { increment: item.quantity } }
      });
      await restockInventory(tx, item.productId, item.quantity, {
        ...(warehouseId ? { warehouseId } : {}),
        referenceId: orderId,
        note: note || `Hoàn kho cho Đơn Hàng ${orderId}`
      });
    }
    await tx.serialNumber.updateMany({
      where: { orderId, status: 'USED' },
      data: { status: 'AVAILABLE', orderId: null }
    });
    await tx.ledgerEntry.deleteMany({ where: { referenceId: `COGS-${orderId}` } });
    await tx.orderItem.updateMany({ where: { orderId }, data: { unitCost: null } });
  } else {
    // Hàng lỗi về kho: ghi cặp IN (hàng đã về, cân lại OUT của đơn để isStockOut = false)
    // + WRITE_OFF (xuất huỷ ngay) — tồn bán và bảng inventory không đổi.
    for (const item of items) {
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'IN',
          quantity: item.quantity,
          referenceId: orderId,
          note: note || `Hàng của Đơn ${orderId} về kho ở trạng thái lỗi — không nhập tồn bán (ghi nhận tổn thất)`
        }
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'WRITE_OFF',
          quantity: item.quantity,
          referenceId: orderId,
          note: `Xuất huỷ / chờ xử lý bồi thường hàng lỗi của Đơn ${orderId}`
        }
      });
    }
    await tx.serialNumber.updateMany({
      where: { orderId, status: 'USED' },
      data: { status: lostSerialStatus }
    });
  }
  return true;
};

module.exports = {
  LOYALTY_VND_PER_POINT,
  tierForPoints,
  adjustLoyaltyForOrder,
  netStockOut,
  isStockOut,
  deductOrderStock,
  returnOrderStock
};
