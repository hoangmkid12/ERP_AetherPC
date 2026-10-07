const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Dữ liệu mẫu (seed) tạo sản phẩm với averageCost = 0 vì không đi qua phiếu nhập kho,
// nên mọi đơn bán ra đều có giá vốn 0 → báo cáo lãi lỗ cho tỷ suất lợi nhuận ~100%.
// Script này (chạy lại nhiều lần vẫn an toàn):
//  1. Gán giá vốn ước tính cho sản phẩm chưa có giá vốn: 80–88% giá bán, cố định theo mã
//     sản phẩm (biên lợi nhuận gộp 12–20%, phù hợp bán lẻ linh kiện máy tính). Sản phẩm đã có
//     giá vốn thật từ phiếu nhập kho được giữ nguyên.
//  2. Ghi bù bút toán giá vốn (EXPENSE, referenceId COGS-{orderId}) cho các đơn đã xuất kho
//     mà chưa có bút toán này, ghi theo ngày xác nhận đơn.
const NOT_SHIPPED = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_STOCK', 'CANCELLED'];

function costRatio(productId) {
  let h = 0;
  for (const ch of String(productId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 0.80 + (h % 9) / 100;
}

async function run() {
  const products = await prisma.product.findMany({
    where: { averageCost: { lte: 0 } },
    select: { productId: true, price: true }
  });
  let priced = 0;
  for (const p of products) {
    const price = Number(p.price || 0);
    if (price <= 0) continue;
    const cost = Math.round((price * costRatio(p.productId)) / 1000) * 1000;
    await prisma.product.update({ where: { productId: p.productId }, data: { averageCost: cost } });
    priced++;
  }

  const existing = new Set((await prisma.ledgerEntry.findMany({
    where: { referenceId: { startsWith: 'COGS-' } }, select: { referenceId: true }
  })).map(e => e.referenceId));
  const orders = await prisma.order.findMany({
    where: { status: { notIn: NOT_SHIPPED } },
    select: { orderId: true, createdAt: true, confirmedAt: true, items: { select: { quantity: true, product: { select: { averageCost: true } } } } }
  });
  const rows = [];
  for (const o of orders) {
    const ref = `COGS-${o.orderId}`;
    if (existing.has(ref)) continue;
    const cogs = o.items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.product?.averageCost || 0), 0);
    if (cogs <= 0) continue;
    rows.push({
      type: 'EXPENSE', amount: cogs, referenceId: ref,
      description: `Giá vốn hàng bán (COGS) — Đơn Hàng ${o.orderId}`,
      date: o.confirmedAt || o.createdAt, channel: null
    });
  }
  for (let i = 0; i < rows.length; i += 500) {
    await prisma.ledgerEntry.createMany({ data: rows.slice(i, i + 500) });
  }
  console.log(`[backfill-cogs] Gán giá vốn ${priced} sản phẩm, ghi bù ${rows.length} bút toán giá vốn.`);
}

run()
  .catch(e => { console.error('[backfill-cogs] Lỗi:', e.message); process.exitCode = 0; })
  .finally(() => prisma.$disconnect());
