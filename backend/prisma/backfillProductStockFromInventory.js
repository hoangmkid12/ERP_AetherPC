// One-off backfill: reconcile Product.stockQuantity with the real sum of its
// Inventory rows across every warehouse. seed.js used to generate an independent
// random quantity for Inventory while leaving Product.stockQuantity at whatever
// the scraper's raw stock_quantity happened to be (usually 0) — so ~80% of the
// catalog (1266/1580 products) showed stockQuantity=0 and was effectively
// unsellable through checkout despite the warehouse holding real stock.
// Run once against an existing DB: node prisma/backfillProductStockFromInventory.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sums = await prisma.inventory.groupBy({
    by: ['productId'],
    _sum: { quantityOnHand: true }
  });

  let updated = 0;
  for (const row of sums) {
    const realTotal = row._sum.quantityOnHand || 0;
    const result = await prisma.product.updateMany({
      where: { productId: row.productId, stockQuantity: { not: realTotal } },
      data: { stockQuantity: realTotal }
    });
    updated += result.count;
  }

  console.log(`Reconciled Product.stockQuantity for ${updated} products against real Inventory sums.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
