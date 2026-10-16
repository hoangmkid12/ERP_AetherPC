// Chạy: cd backend && node scripts/reconcile-2026-10-13-resume.js
// Resume reconcile-2026-10-13.js --apply from step 4 (steps 1–3 already applied; step 2 is not idempotent,
// so the original script must NOT be re-run). Same logic as steps 4–6, serial inserts batched across products.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // 4. serial tồn đầu kỳ còn thiếu
  const gaps = await p.$queryRawUnsafe(`
    select p.product_id, p.stock_quantity::int sq,
      (select count(*)::int from serial_numbers s where s.product_id = p.product_id and s.status = 'AVAILABLE') av
    from products p where p.stock_quantity > 0`);
  const need = gaps.filter(g => g.sq > g.av);
  let buf = [], done = 0;
  const flush = async () => {
    if (!buf.length) return;
    const r = await p.serialNumber.createMany({ data: buf, skipDuplicates: true });
    done += r.count; buf = [];
    console.log('   created so far', done);
  };
  for (const g of need) {
    for (let i = 0; i < g.sq - g.av; i++) {
      buf.push({ serial: `OB-${g.product_id}-${String(g.av + i + 1).padStart(4, '0')}`, productId: g.product_id, status: 'AVAILABLE', warrantyMonths: 36 });
    }
    if (buf.length >= 5000) await flush();
  }
  await flush();
  console.log(`4. serial backfill: ${need.length} sản phẩm, created ${done}`);

  // 5. Đơn COD hoàn tất thiếu khoản thu
  const codGap = await p.order.findMany({
    where: { status: 'COMPLETED', paymentStatus: { not: 'PAID' }, assignedShipperId: { not: null }, payments: { none: {} } }
  });
  for (const o of codGap) {
    await p.$transaction([
      p.orderPayment.create({ data: { orderId: o.orderId, method: 'CASH', amount: o.totalAmount, transactionId: `CASH-${o.orderId}-BACKFILL`, status: 'SUCCESS' } }),
      p.order.update({ where: { orderId: o.orderId }, data: { paymentStatus: 'PAID', actualPaymentMethod: 'CASH' } }),
      p.orderStatusHistory.create({ data: { orderId: o.orderId, status: o.status, note: 'Đối chiếu dữ liệu 13/10/2026: bổ sung khoản thu COD tiền mặt shipper đã thu (chờ Kế toán đối soát).', changedBy: 'Hệ thống' } }),
    ]);
  }
  console.log('5. COD backfilled:', codGap.map(o => o.orderId).join(', ') || '—');

  // 6. Đơn lệch tổng tiền: phí ship = 0, giảm giá = tạm tính − tổng tiền (giữ nguyên số tiền khách trả)
  const bad = await p.$queryRawUnsafe(`select order_id, subtotal, discount, shipping_fee, total_amount from orders where abs(total_amount - (subtotal - discount + shipping_fee)) > 1`);
  let fixed = 0;
  for (const o of bad) {
    const discount = Math.max(0, Number(o.subtotal) - Number(o.total_amount));
    const ok = Math.abs(Number(o.subtotal) - discount - Number(o.total_amount)) <= 1;
    if (ok) { await p.order.update({ where: { orderId: o.order_id }, data: { shippingFee: 0, discount } }); fixed++; }
    console.log(`   ${o.order_id}: ${ok ? 'fixed' : 'skipped (không khớp)'}`);
  }
  console.log(`6. mismatch fixed ${fixed}/${bad.length}`);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
