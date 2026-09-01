// One-off backfill: assign Product.defaultSupplierCode from the real supplied_brands
// list already present in scraper/data/suppliers.json (never invented — this file was
// seeded but the brand->supplier link it encodes was never actually written to
// Product). Run once against an existing DB; seed.js does the same assignment for any
// future reseed. Usage: node prisma/backfillDefaultSupplier.js
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function buildBrandSupplierMap(suppliers) {
  const byBrand = new Map(); // normalized brand name -> [{ code, suppliedCount }]
  for (const s of suppliers) {
    for (const brandName of s.supplied_brands || []) {
      const key = brandName.trim().toLowerCase();
      if (!byBrand.has(key)) byBrand.set(key, []);
      byBrand.get(key).push({ code: s.code, suppliedCount: s.supplied_brands.length });
    }
  }
  return byBrand;
}

// Prefer the brand's own dedicated VN distributor (supplies exactly this one brand)
// over a general distributor that happens to also carry it; among general
// distributors, prefer the more specialized one (fewer brands carried), then break
// ties alphabetically by code for determinism.
function pickSupplierCode(candidates) {
  if (!candidates || candidates.length === 0) return null;
  const dedicated = candidates.find(c => c.suppliedCount === 1);
  if (dedicated) return dedicated.code;
  const sorted = [...candidates].sort((a, b) => a.suppliedCount - b.suppliedCount || a.code.localeCompare(b.code));
  return sorted[0].code;
}

async function main() {
  const suppliersJsonPath = path.join(__dirname, '..', '..', 'scraper', 'data', 'suppliers.json');
  const suppliers = JSON.parse(fs.readFileSync(suppliersJsonPath, 'utf-8'));
  const brandSupplierMap = buildBrandSupplierMap(suppliers);

  const supplierCodes = new Set((await prisma.supplier.findMany({ select: { code: true } })).map(s => s.code));
  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });

  let matchedBrands = 0;
  let updatedProducts = 0;
  let unmatchedBrands = [];

  for (const brand of brands) {
    const candidates = brandSupplierMap.get(brand.name.trim().toLowerCase());
    const code = pickSupplierCode(candidates);
    if (!code || !supplierCodes.has(code)) {
      unmatchedBrands.push(brand.name);
      continue;
    }
    matchedBrands++;
    const result = await prisma.product.updateMany({
      where: { brandId: brand.id },
      data: { defaultSupplierCode: code }
    });
    updatedProducts += result.count;
  }

  console.log(`Matched ${matchedBrands}/${brands.length} brands to a real supplier from suppliers.json.`);
  console.log(`Updated defaultSupplierCode on ${updatedProducts} products.`);
  console.log(`Brands with no known supplier (left null, not guessed): ${unmatchedBrands.length}`);
  console.log(unmatchedBrands.join(', '));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
