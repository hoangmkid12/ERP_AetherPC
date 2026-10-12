/**
 * Khởi tạo GIÁ VỐN ĐẦU KỲ và ghi bù GIÁ VỐN HÀNG BÁN (COGS) cho dữ liệu cũ.
 *
 * Vì sao cần: Product.averageCost chỉ được tính khi nhập kho qua phiếu nhập (GRN). Hàng tồn
 * nạp từ dữ liệu seed không đi qua GRN nên averageCost = 0 → mọi đơn bán ra ghi giá vốn 0đ
 * và báo cáo lợi nhuận gộp ≈ doanh thu (sai).
 *
 * Cách làm (theo thứ tự ưu tiên, không đụng sản phẩm đã có giá vốn hợp lệ):
 *   1. Có phiếu mua hàng (PO) với đơn giá nhập hợp lý → bình quân gia quyền các lần mua đó.
 *   2. Không có → ƯỚC TÍNH giá vốn đầu kỳ = giá bán chưa VAT × (1 − biên lợi nhuận gộp chuẩn
 *      của ngành hàng). Đây là số ước tính; các lần nhập kho sau sẽ tự bình quân với giá nhập thật.
 *   3. Đơn đã xuất kho (đã qua CONFIRMED, chưa huỷ) mà chưa có bút toán COGS → ghi bù bút toán
 *      COGS-<mã đơn> (ngày = ngày tạo đơn) và chụp giá vốn vào order_items.unit_cost.
 *
 * Chạy:  npm run db:backfill-cost                → chỉ xem trước (không ghi gì)
 *        npm run db:backfill-cost -- --apply     → ghi vào CSDL
 *        thêm --fix-outliers  → tính lại cả các mã có giá vốn bất thường (< 30% hoặc > 100% giá bán chưa VAT)
 *        thêm --reprice-legacy → các mã đang mang giá vốn ƯỚC TÍNH theo quy ước cũ (giá bán đã gồm VAT,
 *                               vốn = giá/1,1 × (1 − biên)) được tính lại theo quy ước mới: giá bán là giá
 *                               CHƯA VAT → vốn = giá × (1 − biên). Bút toán COGS của đơn cũ giữ nguyên.
 */
require('dotenv').config();
const prisma = require('../src/config/database');

const APPLY = process.argv.includes('--apply');
const FIX_OUTLIERS = process.argv.includes('--fix-outliers');
const REPRICE_LEGACY = process.argv.includes('--reprice-legacy');
const VAT_RATE = 0.1;

// Biên lợi nhuận gộp chuẩn (trên giá bán chưa VAT) theo ngành hàng linh kiện PC bán lẻ.
const MARGIN_BY_CATEGORY = [
  [/card-man-hinh|^gpu$|vga/, 0.08],
  [/bo-vi-xu-ly|cpu/, 0.07],
  [/bo-mach-chu|mainboard/, 0.10],
  [/ram/, 0.12],
  [/o-cung|ssd|hdd/, 0.12],
  [/nguon|psu/, 0.15],
  [/vo-may-tinh|case/, 0.20],
  [/tan-nhiet|cooler/, 0.20],
  [/man-hinh|monitor/, 0.10],
  [/chuot|ban-phim|mouse|keyboard/, 0.25]
];
const DEFAULT_MARGIN = 0.12;
const marginFor = (slug = '') => (MARGIN_BY_CATEGORY.find(([re]) => re.test(slug)) || [null, DEFAULT_MARGIN])[1];

// Đơn đã trừ kho & ghi giá vốn theo luồng thật (createOrder / updateOrderStatus / orderApprovalService).
// Không tính đơn giao thất bại: hàng quay về kho và báo cáo doanh thu cũng loại các đơn này.
const SOLD_STATUSES = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'RETURNING_TO_WAREHOUSE', 'EXCHANGED', 'REFUNDED'];

const round = (n, step = 1000) => Math.round(n / step) * step;
const fmt = (n) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

async function main() {
  console.log(`\n=== Khởi tạo giá vốn đầu kỳ (${APPLY ? 'GHI VÀO CSDL' : 'XEM TRƯỚC — thêm --apply để ghi'}) ===\n`);

  const products = await prisma.product.findMany({
    select: { productId: true, name: true, price: true, averageCost: true, category: { select: { slug: true } } }
  });

  // Đơn giá nhập thật từ các PO (bình quân gia quyền theo số lượng)
  const poRows = await prisma.purchaseOrderItem.findMany({ select: { productId: true, quantity: true, unitCost: true } });
  const poCost = new Map();
  for (const r of poRows) {
    const c = Number(r.unitCost) || 0;
    if (c <= 0) continue;
    const acc = poCost.get(r.productId) || { qty: 0, total: 0 };
    acc.qty += r.quantity; acc.total += c * r.quantity;
    poCost.set(r.productId, acc);
  }

  const updates = [];
  let fromPo = 0, estimated = 0, keptValid = 0, outliers = 0;
  for (const p of products) {
    // Giá bán sản phẩm là giá CHƯA VAT (xem frontend/src/utils/vat.js)
    const price = Number(p.price) || 0;
    const net = price;
    const current = Number(p.averageCost) || 0;
    const isOutlier = current > 0 && net > 0 && (current < net * 0.3 || current > net);
    const margin = marginFor(p.category?.slug);
    const isLegacyEstimate = current > 0 && current === round((price / (1 + VAT_RATE)) * (1 - margin));
    if (current > 0 && !(FIX_OUTLIERS && isOutlier) && !(REPRICE_LEGACY && isLegacyEstimate)) {
      keptValid++;
      if (isOutlier) outliers++;
      continue;
    }
    if (price <= 0) continue;
    const po = poCost.get(p.productId);
    const poAvg = po ? po.total / po.qty : 0;
    let cost; let source;
    if (poAvg >= net * 0.3 && poAvg <= net) { cost = Math.round(poAvg); source = 'PO'; fromPo++; }
    else { cost = round(net * (1 - margin)); source = 'ước tính'; estimated++; }
    updates.push({ productId: p.productId, name: p.name, price, old: current, cost, source });
  }

  console.log(`Sản phẩm: ${products.length} | giữ nguyên giá vốn hiện có: ${keptValid}${outliers ? ` (trong đó ${outliers} mã bất thường — chạy thêm --fix-outliers để tính lại)` : ''}`);
  console.log(`Cập nhật: ${updates.length} mã (từ PO: ${fromPo}, ước tính theo biên ngành hàng: ${estimated})`);
  updates.slice(0, 8).forEach(u => console.log(`  - ${u.name.slice(0, 60)} | giá bán ${fmt(u.price)} → giá vốn ${fmt(u.cost)} (${u.source})`));

  // Đơn đã xuất kho nhưng chưa có bút toán COGS
  const costAfter = new Map(products.map(p => [p.productId, Number(p.averageCost) || 0]));
  updates.forEach(u => costAfter.set(u.productId, u.cost));
  const cogsRefs = new Set((await prisma.ledgerEntry.findMany({
    where: { referenceId: { startsWith: 'COGS-' } }, select: { referenceId: true }
  })).map(l => l.referenceId));
  const orders = await prisma.order.findMany({
    where: { status: { in: SOLD_STATUSES } },
    select: { orderId: true, createdAt: true, items: { select: { orderItemId: true, productId: true, quantity: true, unitCost: true } } }
  });
  const cogsToCreate = [];
  const itemCosts = [];
  for (const o of orders) {
    const hasLedger = cogsRefs.has(`COGS-${o.orderId}`);
    let total = 0;
    for (const it of o.items) {
      const c = costAfter.get(it.productId) || 0;
      if (it.unitCost == null) itemCosts.push({ orderItemId: it.orderItemId, unitCost: c });
      total += (it.unitCost != null ? Number(it.unitCost) : c) * it.quantity;
    }
    if (!hasLedger && total > 0) cogsToCreate.push({ orderId: o.orderId, date: o.createdAt, amount: Math.round(total * 100) / 100 });
  }
  const cogsSum = cogsToCreate.reduce((s, c) => s + c.amount, 0);
  console.log(`\nĐơn đã xuất kho: ${orders.length} | ghi bù bút toán COGS: ${cogsToCreate.length} đơn, tổng ${fmt(cogsSum)} | chụp giá vốn cho ${itemCosts.length} dòng hàng`);

  if (!APPLY) {
    console.log('\n(Chưa ghi gì. Chạy lại với --apply để áp dụng.)\n');
    return;
  }

  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    await prisma.$transaction(updates.slice(i, i + BATCH).map(u =>
      prisma.product.update({ where: { productId: u.productId }, data: { averageCost: u.cost } })));
  }
  for (let i = 0; i < itemCosts.length; i += BATCH) {
    await prisma.$transaction(itemCosts.slice(i, i + BATCH).map(c =>
      prisma.orderItem.update({ where: { orderItemId: c.orderItemId }, data: { unitCost: c.unitCost } })));
  }
  for (let i = 0; i < cogsToCreate.length; i += BATCH) {
    await prisma.ledgerEntry.createMany({
      data: cogsToCreate.slice(i, i + BATCH).map(c => ({
        type: 'EXPENSE',
        amount: c.amount,
        description: `Giá vốn hàng bán (COGS) — Đơn Hàng ${c.orderId} (ghi bù theo giá vốn đầu kỳ)`,
        referenceId: `COGS-${c.orderId}`,
        date: c.date,
        createdAt: c.date
      }))
    });
  }
  console.log('\n✅ Đã ghi vào CSDL.\n');
}

main()
  .catch(err => { console.error('❌ Lỗi:', err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
