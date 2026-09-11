const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Original seed data (before warehouse_manage_locations existed) dumped every
// single Inventory row for a warehouse into ONE location — 1538 items into a
// bin with capacity 200. Idempotent fix: give each product category its own
// zone/shelf per warehouse (sized to comfortably fit that category's real
// product count) and move every Inventory row to its product's category
// zone. Safe to run on every boot: once a location already holds the right
// key, it's reused rather than recreated, and reassigning an Inventory row
// to the location it's already in is a no-op update.
async function run() {
  try {
    const warehouses = await prisma.warehouse.findMany({ select: { id: true } });
    const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
    const productCountByCategory = await prisma.product.groupBy({ by: ['categoryId'], _count: { productId: true } });
    const countByCat = Object.fromEntries(productCountByCategory.map(r => [r.categoryId, r._count.productId]));

    let moved = 0;
    for (const wh of warehouses) {
      for (const cat of categories) {
        const zone = cat.slug.toUpperCase().slice(0, 10);
        const itemCount = countByCat[cat.id] || 0;
        // Generous headroom over the real product count for this category so
        // future catalog growth doesn't immediately overflow the zone again.
        const capacity = Math.max(50, itemCount + 50);

        let location = await prisma.warehouseLocation.findFirst({
          where: { warehouseId: wh.id, zone, shelf: '01', bin: '01' }
        });
        if (!location) {
          location = await prisma.warehouseLocation.create({
            data: { warehouseId: wh.id, zone, shelf: '01', bin: '01', capacity }
          });
        } else if (location.capacity !== capacity) {
          location = await prisma.warehouseLocation.update({ where: { id: location.id }, data: { capacity } });
        }

        const result = await prisma.inventory.updateMany({
          where: { warehouseId: wh.id, product: { categoryId: cat.id }, NOT: { locationId: location.id } },
          data: { locationId: location.id }
        });
        moved += result.count;
      }
    }

    // Clean up the old generic seed locations now that everything real has a
    // category zone — only if they ended up empty (never force-delete).
    const leftoverGeneric = await prisma.warehouseLocation.findMany({
      where: { zone: { in: ['ZONE-A', 'ZONE-B'] } },
      include: { _count: { select: { inventories: true } } }
    });
    let removed = 0;
    for (const loc of leftoverGeneric) {
      if (loc._count.inventories === 0) {
        await prisma.warehouseLocation.delete({ where: { id: loc.id } });
        removed++;
      }
    }

    console.log(moved > 0 || removed > 0
      ? `Rebalanced warehouse locations: moved ${moved} inventory row(s) into category zones, removed ${removed} empty legacy location(s).`
      : 'Warehouse locations already balanced by category — nothing to do.');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error rebalancing warehouse locations:', error);
    process.exit(1);
  }
}

run();
