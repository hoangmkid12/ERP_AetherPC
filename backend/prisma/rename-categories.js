const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Category names came straight from the scraper's raw labels — inconsistent
// style ("RAM PC" vs "CPU - Bo vi xu ly" vs a leftover product model number
// "Ban phim co GX" vs a brand name "HDD Seagate"). Renamed to one consistent
// "ENGLISH CODE - Vietnamese description" convention across all 13. Keyed by
// slug (stable, never changes) so this is safe to re-run — it just re-applies
// the same target name and is a no-op once already renamed.
const RENAMES = {
  cpu: 'CPU - Bộ Vi Xử Lý',
  gpu: 'GPU - Card Màn Hình',
  ram: 'RAM - Bộ Nhớ Trong (PC)',
  ram_laptop: 'RAM - Bộ Nhớ Trong (Laptop)',
  ssd: 'SSD - Ổ Cứng Thể Rắn',
  hdd: 'HDD - Ổ Cứng Cơ',
  mainboard: 'Mainboard - Bo Mạch Chủ',
  psu: 'PSU - Nguồn Máy Tính',
  case: 'Case - Vỏ Máy Tính',
  cooler: 'Cooler - Tản Nhiệt',
  monitor: 'Monitor - Màn Hình',
  keyboard: 'Keyboard - Bàn Phím',
  mouse: 'Mouse - Chuột Máy Tính'
};

async function run() {
  try {
    let renamed = 0;
    for (const [slug, name] of Object.entries(RENAMES)) {
      const category = await prisma.category.findUnique({ where: { slug } });
      if (category && category.name !== name) {
        await prisma.category.update({ where: { id: category.id }, data: { name } });
        renamed++;
      }
    }
    console.log(renamed > 0
      ? `Renamed ${renamed} categor${renamed === 1 ? 'y' : 'ies'} to the standardized naming convention.`
      : 'Categories already use the standardized naming convention — nothing to do.');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error renaming categories:', error);
    process.exit(1);
  }
}

run();
