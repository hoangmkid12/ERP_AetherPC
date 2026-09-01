// One-off backfill: generate one AVAILABLE SerialNumber row per unit of a
// product's current (now-reconciled) stockQuantity. Existing warehouse stock was
// received before Serial Number tracking was enforced, so there is no real scanned
// serial on file for it — these are synthetic placeholders (SN-<productId>-<index>),
// clearly distinguishable from real scanned serials going forward, so intake/outtake
// enforcement (see purchase.controller.js / warehouse.controller.js / order flows)
// has something to work against instead of making all existing stock unsellable.
// Run once against an existing DB: node prisma/backfillSerialNumbers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CHUNK_SIZE = 2000;

async function main() {
  const products = await prisma.product.findMany({ select: { productId: true, stockQuantity: true } });
  const existingCounts = await prisma.serialNumber.groupBy({ by: ['productId'], _count: true });
  const existingCountMap = new Map(existingCounts.map(r => [r.productId, r._count]));

  let toCreate = [];
  let totalCreated = 0;

  const flush = async () => {
    if (toCreate.length === 0) return;
    const result = await prisma.serialNumber.createMany({ data: toCreate, skipDuplicates: true });
    totalCreated += result.count;
    toCreate = [];
  };

  for (const p of products) {
    const already = existingCountMap.get(p.productId) || 0;
    const missing = p.stockQuantity - already;
    if (missing <= 0) continue;

    for (let i = already + 1; i <= p.stockQuantity; i++) {
      toCreate.push({
        serial: `SN-${p.productId}-${String(i).padStart(5, '0')}`,
        productId: p.productId,
        status: 'AVAILABLE'
      });
      if (toCreate.length >= CHUNK_SIZE) await flush();
    }
  }
  await flush();

  console.log(`Created ${totalCreated} placeholder AVAILABLE serial numbers.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
