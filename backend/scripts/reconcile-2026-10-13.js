// ĐÃ CHẠY --apply ngày 16/10/2026 (bước 1–3 xong, bước 4 dừng giữa chừng) — KHÔNG chạy lại file này với --apply
// (bước 2 trừ điểm không chặn chạy lặp). Phần còn lại: scripts/reconcile-2026-10-13-resume.js.
// Đối chiếu & chuẩn hoá dữ liệu production ngày 13/10/2026. Mặc định chạy thử; thêm --apply để ghi.
// Chạy: cd backend && node scripts/reconcile-2026-10-13.js [--apply]
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const APPLY = process.argv.includes('--apply');

(async () => {
  // 1. Đề xuất mua đã nhập kho xong (PO DONE) nhưng tạo trước khi có thẻ [PR:...] → đóng.
  const pr = await p.purchaseRequest.findUnique({ where: { prCode: 'PR-03468130' } });
  console.log('1. PR-03468130', pr?.status, '-> COMPLETED');
  if (APPLY && pr?.status === 'RFQ_CREATED') await p.purchaseRequest.update({ where: { id: pr.id }, data: { status: 'COMPLETED' } });

  // 2. Thu hồi điểm của đơn đã hoàn tiền ORD-261013-7467 (hoàn tiền trước khi có bước trừ điểm).
  const ord = await p.order.findUnique({ where: { orderId: 'ORD-261013-7467' } });
  const pts = Math.floor(Number(ord.totalAmount) / 10000);
  const cus = await p.customer.findUnique({ where: { customerId: ord.customerId } });
  console.log('2. loyalty', cus.customerId, cus.loyaltyPoints, '->', cus.loyaltyPoints - pts);
  if (APPLY) await p.customer.update({ where: { customerId: cus.customerId }, data: { loyaltyPoints: { decrement: pts } } });

  // 3. Bút toán chi NCC mồ côi: tham chiếu hoá đơn BILL/260910/3034 & PO-2026-0005 không còn tồn tại.
  const orphan = await p.ledgerEntry.findFirst({ where: { referenceId: 'VENDORBILL-1', description: { contains: 'BILL/260910/3034' } } });
  const poExists = await p.purchaseOrder.findFirst({ where: { poNumber: 'PO-2026-0005' } });
  const billExists = await p.vendorBill.findFirst({ where: { billNumber: 'BILL/260910/3034' } });
  console.log('3. orphan ledger', orphan?.id, orphan?.amount?.toString(), 'po?', !!poExists, 'bill?', !!billExists);
  if (APPLY && orphan && !poExists && !billExists) await p.ledgerEntry.delete({ where: { id: orphan.id } });

  // 4. Serial tồn đầu kỳ: hàng tồn cũ chưa từng có bản ghi serial (nhập trước khi bắt buộc quét
  //    serial) → tạo serial "OB-" (opening balance) để mỗi đơn vị tồn kho có 1 serial truy vết.
  const gaps = await p.$queryRawUnsafe(`
    select p.product_id, p.stock_quantity::int sq,
      (select count(*)::int from serial_numbers s where s.product_id = p.product_id and s.status = 'AVAILABLE') av
    from products p where p.stock_quantity > 0`);
  const need = gaps.filter(g => g.sq > g.av);
  const over = gaps.filter(g => g.av > g.sq);
  const total = need.reduce((s, g) => s + g.sq - g.av, 0);
  console.log(`4. serial backfill: ${need.length} sản phẩm, ${total} serial; ${over.length} sản phẩm có serial khả dụng > tồn`);
  if (APPLY) {
    let done = 0;
    for (const g of need) {
      const rows = Array.from({ length: g.sq - g.av }, (_, i) => ({
        serial: `OB-${g.product_id}-${String(g.av + i + 1).padStart(4, '0')}`,
        productId: g.product_id,
        status: 'AVAILABLE',
        warrantyMonths: 36
      }));
      const r = await p.serialNumber.createMany({ data: rows, skipDuplicates: true });
      done += r.count;
    }
    console.log('   created', done);
  }
  // 5. Đơn COD đã hoàn tất nhưng không có khoản thu (dữ liệu cũ): ghi khoản tiền mặt shipper đã thu,
  //    CHƯA đối soát → hiện ở màn Đối soát COD để Kế toán thu hồi/xác minh với shipper.
  const codGap = await p.order.findMany({
    where: { status: 'COMPLETED', paymentStatus: { not: 'PAID' }, assignedShipperId: { not: null }, payments: { none: {} } }
  });
  console.log('5. COD thiếu khoản thu:', codGap.map(o => `${o.orderId}:${o.totalAmount}`).join(', ') || '—');
  if (APPLY) {
    for (const o of codGap) {
      await p.orderPayment.create({ data: { orderId: o.orderId, method: 'CASH', amount: o.totalAmount, transactionId: `CASH-${o.orderId}-BACKFILL`, status: 'SUCCESS' } });
      await p.order.update({ where: { orderId: o.orderId }, data: { paymentStatus: 'PAID', actualPaymentMethod: 'CASH' } });
      await p.orderStatusHistory.create({ data: { orderId: o.orderId, status: o.status, note: 'Đối chiếu dữ liệu 13/10/2026: bổ sung khoản thu COD tiền mặt shipper đã thu (chờ Kế toán đối soát).', changedBy: 'Hệ thống' } });
    }
  }

  // 6. Đơn cũ có tổng tiền ≠ tạm tính − giảm giá + phí ship (dữ liệu tạo trước khi miễn phí vận chuyển).
  //    Giữ nguyên số tiền khách thật sự trả (total_amount), chỉnh lại phần diễn giải cho khớp:
  //    phí ship = 0 (chính sách miễn phí vận chuyển), giảm giá = tạm tính − tổng tiền.
  const bad = await p.$queryRawUnsafe(`select order_id, subtotal, discount, shipping_fee, total_amount from orders where abs(total_amount - (subtotal - discount + shipping_fee)) > 1`);
  console.log('6. đơn lệch tổng tiền:', bad.length);
  for (const o of bad) {
    const discount = Math.max(0, Number(o.subtotal) - Number(o.total_amount));
    const ok = Math.abs(Number(o.subtotal) - discount - Number(o.total_amount)) <= 1;
    console.log(`   ${o.order_id}: giảm ${o.discount}→${discount}, ship ${o.shipping_fee}→0 ${ok ? '' : '(KHÔNG KHỚP — bỏ qua)'}`);
    if (APPLY && ok) await p.order.update({ where: { orderId: o.order_id }, data: { shippingFee: 0, discount } });
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
