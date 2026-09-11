// Backfill Product.defaultSupplierCode — production has this null on every single
// product (confirmed via /api/v1/warehouse/inventory: 0/1580 rows carry a
// supplierName), which is why Warehouse.jsx's "Nhà Cung Cấp" column shows "Chưa
// rõ"/blank on both the Danh Sách Sản Phẩm and Bổ Sung Hàng (RFQ) tabs.
//
// This was originally derived from scraper/data/suppliers.json's real supplied_brands
// list, but that file is `scraper/data/`-gitignored (.gitignore line 50) and was never
// committed — it doesn't exist in this repo or the deployed image (confirmed: ENOENT
// when the old version of this script tried to read it).
//
// The mapping below is NOT a guess: it's extracted verbatim from the local dev
// database (docker-compose kltn_postgres), which still has defaultSupplierCode
// correctly populated on all 1538 of its products from before suppliers.json was
// lost — `SELECT b.name, p.default_supplier_code FROM products p JOIN brands b ON
// b.id = p.brand_id WHERE p.default_supplier_code IS NOT NULL GROUP BY 1, 2`
// returned exactly one supplier per brand (no conflicts), confirming it's the
// original real assignment. Production's Brand table is the same seeded catalog,
// so brand name is a reliable join key between the two databases.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Brand.name -> Supplier.code, sourced from local dev DB (see comment above).
const BRAND_SUPPLIER_MAP = {
  'ACER': 'SUP-FPT',
  'AKKO': 'SUP-VIENSON',
  'AMD': 'SUP-AMD-VN',
  'AOC': 'SUP-MAIHOANG',
  'ASRock': 'SUP-THUYLINH',
  'ASUS': 'SUP-ASUS-VN',
  'ATK': 'SUP-KTC',
  'Adata': 'SUP-ANHNGOC',
  'Arctic': 'SUP-FPT',
  'BenQ': 'SUP-VIENSON',
  'Colorful': 'SUP-MAIHOANG',
  'Cooler Master': 'SUP-THUYLINH',
  'Corsair': 'SUP-CORSAIR-VN',
  'Cougar': 'SUP-KTC',
  'Crucial': 'SUP-ANHNGOC',
  'DELL': 'SUP-FPT',
  'DareU': 'SUP-VIENSON',
  'Deepcool': 'SUP-MAIHOANG',
  'Ducky': 'SUP-THUYLINH',
  'E-Dra': 'SUP-KTC',
  'EVGA': 'SUP-ANHNGOC',
  'FSP': 'SUP-FPT',
  'G.Skill': 'SUP-VIENSON',
  'GIGABYTE': 'SUP-GIGABYTE-VN',
  'Glorious': 'SUP-MAIHOANG',
  'HKC': 'SUP-THUYLINH',
  'HYTE': 'SUP-KTC',
  'HyperWork': 'SUP-ANHNGOC',
  'HyperX': 'SUP-FPT',
  'ID-Cooling': 'SUP-VIENSON',
  'INNO3D': 'SUP-MAIHOANG',
  'InWin': 'SUP-THUYLINH',
  'Intel': 'SUP-INTEL-VN',
  'Jetek': 'SUP-KTC',
  'Jonsbo': 'SUP-ANHNGOC',
  'KINGMAX': 'SUP-FPT',
  'KOORUI': 'SUP-VIENSON',
  'Không thương hiệu': 'SUP-MAIHOANG',
  'Kingston': 'SUP-KINGSTON-VN',
  'Klevv': 'SUP-THUYLINH',
  'LG': 'SUP-LG-VN',
  'Leadtek': 'SUP-KTC',
  'Lexar': 'SUP-ANHNGOC',
  'Lian Li': 'SUP-FPT',
  'Logitech': 'SUP-VIENSON',
  'MSI': 'SUP-MSI-VN',
  'Manli': 'SUP-MAIHOANG',
  'MonsGeek': 'SUP-THUYLINH',
  'NVIDIA': 'SUP-KTC',
  'NZXT': 'SUP-ANHNGOC',
  'Noctua': 'SUP-FPT',
  'PNY': 'SUP-VIENSON',
  'Palit': 'SUP-MAIHOANG',
  'Patriot': 'SUP-THUYLINH',
  'Phanteks': 'SUP-KTC',
  'Philips': 'SUP-ANHNGOC',
  'Pulsar': 'SUP-FPT',
  'Rapoo': 'SUP-VIENSON',
  'Razer': 'SUP-MAIHOANG',
  'SPARKLE': 'SUP-THUYLINH',
  'SSTC': 'SUP-KTC',
  'Samsung': 'SUP-SAMSUNG-VN',
  'Seagate': 'SUP-ANHNGOC',
  'Segotep': 'SUP-FPT',
  'SilverStone': 'SUP-VIENSON',
  'Steelseries': 'SUP-MAIHOANG',
  'TRYX': 'SUP-THUYLINH',
  'Team Group': 'SUP-KTC',
  'Thermaltake': 'SUP-ANHNGOC',
  'V-Color': 'SUP-FPT',
  'VSP': 'SUP-VIENSON',
  'Veekos': 'SUP-MAIHOANG',
  'ViewSonic': 'SUP-THUYLINH',
  'Western Digital': 'SUP-KTC',
  'Xigmatek': 'SUP-ANHNGOC',
  'Zotac': 'SUP-FPT'
};

async function main() {
  const supplierCodes = new Set((await prisma.supplier.findMany({ select: { code: true } })).map(s => s.code));
  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const brandByName = new Map(brands.map(b => [b.name, b.id]));

  let matchedBrands = 0;
  let updatedProducts = 0;
  const skipped = [];

  for (const [brandName, code] of Object.entries(BRAND_SUPPLIER_MAP)) {
    const brandId = brandByName.get(brandName);
    if (!brandId) { skipped.push(`${brandName} (không có trong Brand)`); continue; }
    if (!supplierCodes.has(code)) { skipped.push(`${brandName} (thiếu nhà cung cấp ${code})`); continue; }

    matchedBrands++;
    const result = await prisma.product.updateMany({
      where: { brandId, defaultSupplierCode: null },
      data: { defaultSupplierCode: code }
    });
    updatedProducts += result.count;
  }

  console.log(`Gán defaultSupplierCode cho ${matchedBrands}/${Object.keys(BRAND_SUPPLIER_MAP).length} hãng.`);
  console.log(`Cập nhật ${updatedProducts} sản phẩm.`);
  if (skipped.length) console.log(`Bỏ qua (không khớp brand/nhà cung cấp trên DB này): ${skipped.join(', ')}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
