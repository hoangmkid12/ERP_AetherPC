// Xử lý 2 việc còn mở sau đối chiếu dữ liệu 13/10/2026. Mặc định chạy thử; thêm --apply để ghi.
// Chạy: cd backend && node scripts/fix-open-items-2026-10-16.js [--apply]
// Mỗi bước tự kiểm tra trạng thái hiện tại nên chạy lại không ghi trùng.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const APPLY = process.argv.includes('--apply');

(async () => {
  // A. 4 đơn ghi "giảm giá" nhưng tổng tiền = tạm tính + phí ship: giảm giá chưa từng được áp (khách trả và
  //    được hoàn đúng tổng tiền). Giữ nguyên số tiền khách trả, ghi lại giảm giá = 0 cho khớp.
  const ORDERS = ['ORD-143082', 'ORD-278680', 'ORD-576569', 'ORD-205210'];
  for (const id of ORDERS) {
    const o = await p.order.findUnique({ where: { orderId: id } });
    const sub = Number(o.subtotal), ship = Number(o.shippingFee), total = Number(o.totalAmount), disc = Number(o.discount);
    const matches = Math.abs(sub + ship - total) <= 1;
    const todo = matches && disc !== 0;
    console.log(`A. ${id}: tạm tính ${sub} + ship ${ship} = ${sub + ship} vs tổng ${total}; giảm giá ${disc} → ${todo ? 0 : '(giữ nguyên)'}`);
    if (APPLY && todo) {
      await p.$transaction([
        p.order.update({ where: { orderId: id }, data: { discount: 0 } }),
        p.orderStatusHistory.create({ data: { orderId: id, status: o.status, changedBy: 'Hệ thống', note: `Đối chiếu dữ liệu 16/10/2026: giảm giá ${disc.toLocaleString('vi-VN')}đ chưa từng được trừ vào số tiền khách trả (${total.toLocaleString('vi-VN')}đ) — ghi lại giảm giá 0đ, giữ nguyên số tiền.` } }),
      ]);
    }
  }

  // B1. Bàn phím Logitech 1050103254: đơn cũ ORD-413208 đã xuất 1 chiếc (OUT 1) trước khi bắt buộc gán serial,
  //     serial SN-1050103254-00001 (hàng tồn ban đầu duy nhất) vẫn "Sẵn có" → gắn cho đơn.
  const sLogi = await p.serialNumber.findUnique({ where: { serial: 'SN-1050103254-00001' } });
  const o413 = await p.order.findUnique({ where: { orderId: 'ORD-413208' }, include: { items: true } });
  const o413ok = o413 && o413.items.some(i => i.productId === '1050103254') && !(await p.serialNumber.count({ where: { orderId: 'ORD-413208', productId: '1050103254' } }));
  console.log(`B1. ${sLogi?.serial} ${sLogi?.status} → USED cho ORD-413208 (${o413?.status}); hợp lệ: ${o413ok && sLogi?.status === 'AVAILABLE'}`);
  if (APPLY && o413ok && sLogi?.status === 'AVAILABLE') {
    await p.serialNumber.update({ where: { serial: sLogi.serial }, data: { status: 'USED', orderId: 'ORD-413208' } });
  }

  // B2. HDD Seagate 1047243498:
  //   - ORD-834751 mua 1 chiếc nhưng có 3 dòng xuất kho trong 8 giây (bấm lặp) → tồn bị trừ thừa 2.
  //   - ORD-576569 đã hoàn về kệ bán A1 (IN 1) nhưng serial SN-1047243498-00001 vẫn USED.
  const PID = '1047243498';
  const outs = await p.stockMovement.findMany({ where: { productId: PID, referenceId: 'ORD-834751', type: 'OUT' } });
  const fixIn = await p.stockMovement.count({ where: { productId: PID, referenceId: 'ORD-834751', type: 'IN' } });
  const o834 = await p.order.findUnique({ where: { orderId: 'ORD-834751' }, include: { items: true } });
  const qty834 = o834.items.filter(i => i.productId === PID).reduce((s, i) => s + i.quantity, 0);
  const extra = outs.reduce((s, m) => s + m.quantity, 0) - qty834 - fixIn;
  const prod = await p.product.findUnique({ where: { productId: PID } });
  const inv = await p.inventory.findFirst({ where: { productId: PID, warehouseId: 1 } });
  console.log(`B2. ORD-834751 xuất ${outs.length} lần cho ${qty834} chiếc → hoàn ${extra}; tồn ${prod.stockQuantity} → ${prod.stockQuantity + Math.max(0, extra)}, kho 1 ${inv.quantityOnHand} → ${inv.quantityOnHand + Math.max(0, extra)}`);
  if (APPLY && extra > 0) {
    await p.$transaction([
      p.product.update({ where: { productId: PID }, data: { stockQuantity: { increment: extra } } }),
      p.inventory.update({ where: { id: inv.id }, data: { quantityOnHand: { increment: extra } } }),
      p.stockMovement.create({ data: { productId: PID, type: 'IN', quantity: extra, referenceId: 'ORD-834751', note: `Đối chiếu 16/10/2026: hoàn ${extra} chiếc bị trừ thừa do đơn ORD-834751 ghi xuất kho lặp ${outs.length} lần cho ${qty834} chiếc` } }),
    ]);
  }
  // Giá vốn của đơn có bị ghi 3 lần không?
  const cogs = await p.ledgerEntry.findMany({ where: { referenceId: 'COGS-ORD-834751' } });
  console.log(`    bút toán giá vốn ORD-834751: ${cogs.map(c => c.amount.toString()).join(', ') || '—'}`);

  const s576 = await p.serialNumber.findUnique({ where: { serial: 'SN-1047243498-00001' } });
  const o576 = await p.order.findUnique({ where: { orderId: 'ORD-576569' } });
  const restocked = await p.stockMovement.count({ where: { productId: PID, referenceId: 'ORD-576569', type: 'IN' } });
  console.log(`B2. ${s576.serial} ${s576.status} (đơn ${s576.orderId}, ${o576.status}, đã nhập lại kệ: ${restocked > 0}) → AVAILABLE`);
  if (APPLY && s576.status === 'USED' && s576.orderId === 'ORD-576569' && restocked > 0) {
    await p.serialNumber.update({ where: { serial: s576.serial }, data: { status: 'AVAILABLE', orderId: null } });
  }

  for (const pid of ['1050103254', PID]) {
    const pr = await p.product.findUnique({ where: { productId: pid } });
    const av = await p.serialNumber.count({ where: { productId: pid, status: 'AVAILABLE' } });
    const invSum = (await p.inventory.findMany({ where: { productId: pid } })).reduce((s, i) => s + i.quantityOnHand, 0);
    console.log(`   ${pid}: tồn ${pr.stockQuantity}, tồn các kho ${invSum}, serial sẵn có ${av}`);
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
