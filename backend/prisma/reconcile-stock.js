// Đối soát tồn kho: Product.stockQuantity (trang bán hàng) với tổng inventory.quantityOnHand (trang Kho).
//
//   node prisma/reconcile-stock.js          → chỉ liệt kê các sản phẩm lệch, không ghi gì
//   node prisma/reconcile-stock.js --apply  → cập nhật Product.stockQuantity = tổng tồn thực tế tại các kho
//
// Tồn thực tế theo từng kho được lấy làm chuẩn vì đó là số đếm vật lý (nhập/xuất kho, kiểm kê đều ghi vào đây).
// Sản phẩm chưa có dòng tồn kho nào nhưng stockQuantity > 0 thì tạo dòng ở Kho chính bằng đúng số đó.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

(async () => {
  const products = await prisma.product.findMany({ select: { productId: true, name: true, stockQuantity: true } });
  const sums = await prisma.inventory.groupBy({ by: ['productId'], _sum: { quantityOnHand: true } });
  const physical = Object.fromEntries(sums.map(r => [r.productId, r._sum.quantityOnHand || 0]));

  const mismatched = [];
  const missingRows = [];
  for (const p of products) {
    if (!(p.productId in physical)) {
      if (p.stockQuantity > 0) missingRows.push(p);
      continue;
    }
    if (physical[p.productId] !== p.stockQuantity) mismatched.push({ ...p, physical: physical[p.productId] });
  }

  console.log(`Tổng sản phẩm: ${products.length}`);
  console.log(`Lệch giữa trang bán hàng và kho: ${mismatched.length}`);
  mismatched.slice(0, 50).forEach(m => console.log(`  ${m.productId}  web=${m.stockQuantity}  kho=${m.physical}  ${m.name.slice(0, 60)}`));
  if (mismatched.length > 50) console.log(`  ... và ${mismatched.length - 50} sản phẩm khác`);
  console.log(`Có tồn trên web nhưng chưa có dòng tồn kho: ${missingRows.length}`);

  if (!APPLY) {
    console.log('\nChưa ghi gì. Chạy lại với --apply để đồng bộ.');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const m of mismatched) {
      await tx.product.update({ where: { productId: m.productId }, data: { stockQuantity: m.physical } });
    }
    for (const p of missingRows) {
      await tx.inventory.create({ data: { productId: p.productId, warehouseId: 1, quantityOnHand: p.stockQuantity } });
      await tx.stockMovement.create({
        data: { productId: p.productId, toWarehouseId: 1, type: 'IN', quantity: p.stockQuantity, referenceId: 'RECONCILE', note: 'Đối soát: tạo dòng tồn kho theo số lượng trên web' },
      });
    }
  }, { timeout: 120000 });
  console.log(`\nĐã đồng bộ ${mismatched.length} sản phẩm lệch và tạo ${missingRows.length} dòng tồn kho.`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
