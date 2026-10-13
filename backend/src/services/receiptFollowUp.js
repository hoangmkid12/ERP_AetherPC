// Việc cần làm ngay sau khi Kho xác nhận nhập một phiếu nhận hàng (GRN) — dùng chung cho
// cả 2 route xác nhận nhập kho (purchase.controller.js và warehouse.controller.js):
//  1. Đóng Phiếu Đề Xuất Mua Hàng gốc (thẻ [PR:...] đi theo RFQ → PO) — trước đây đề xuất
//     nằm mãi ở "Đã lập RFQ" và luôn bị đếm là việc còn mở của Mua Hàng/Kho.
//  2. Phân bổ hàng vừa về cho các đơn đang "Chờ hàng" (FIFO).
// Chạy SAU khi giao dịch nhập kho đã commit; lỗi ở đây không được làm hỏng phiếu nhập.
const { allocateAwaitingOrders } = require('./orderApprovalService');

const afterReceiptValidated = async (prisma, poId) => {
  const result = { allocatedOrders: [], closedRequest: null };
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: { select: { productId: true } }, sourceRfq: { select: { notes: true } } }
    });
    if (!po) return result;

    const tag = `${po.notes || ''} ${po.sourceRfq?.notes || ''}`.match(/\[PR:([^\]]+)\]/);
    if (tag) {
      const closed = await prisma.purchaseRequest.updateMany({
        where: { prCode: tag[1], status: { in: ['APPROVED', 'RFQ_CREATED'] } },
        data: { status: 'COMPLETED' }
      });
      if (closed.count > 0) result.closedRequest = tag[1];
    }

    result.allocatedOrders = await allocateAwaitingOrders(prisma, [...new Set(po.items.map(i => i.productId))]);
  } catch (err) {
    console.warn('[ReceiptFollowUp]', err.message);
  }
  return result;
};

module.exports = { afterReceiptValidated };
