const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Chuẩn hóa tên danh mục thuần tiếng Việt và slug sang tiếng Việt
const CATEGORY_MAP = [
  { oldSlugs: ['cpu', 'bo-vi-xu-ly'], newSlug: 'bo-vi-xu-ly', name: 'Bộ Vi Xử Lý' },
  { oldSlugs: ['gpu', 'vga', 'card-man-hinh'], newSlug: 'card-man-hinh', name: 'Card Màn Hình' },
  { oldSlugs: ['ram', 'ram-pc', 'bo-nho-ram-pc'], newSlug: 'ram-pc', name: 'RAM PC' },
  { oldSlugs: ['ram_laptop', 'ram-laptop', 'bo-nho-ram-laptop'], newSlug: 'ram-laptop', name: 'RAM Laptop' },
  { oldSlugs: ['ssd', 'o-cung-ssd'], newSlug: 'o-cung-ssd', name: 'Ổ Cứng SSD' },
  { oldSlugs: ['hdd', 'o-cung-hdd', 'o-cung-co'], newSlug: 'o-cung-hdd', name: 'Ổ Cứng HDD' },
  { oldSlugs: ['mainboard', 'bo-mach-chu'], newSlug: 'bo-mach-chu', name: 'Bo Mạch Chủ' },
  { oldSlugs: ['psu', 'nguon-may-tinh'], newSlug: 'nguon-may-tinh', name: 'Nguồn Máy Tính' },
  { oldSlugs: ['case', 'vo-may-tinh'], newSlug: 'vo-may-tinh', name: 'Vỏ Máy Tính' },
  { oldSlugs: ['cooler', 'tan-nhiet'], newSlug: 'tan-nhiet', name: 'Tản Nhiệt' },
  { oldSlugs: ['monitor', 'man-hinh'], newSlug: 'man-hinh', name: 'Màn Hình' },
  { oldSlugs: ['keyboard', 'ban-phim'], newSlug: 'ban-phim', name: 'Bàn Phím' },
  { oldSlugs: ['mouse', 'chuot-may-tinh'], newSlug: 'chuot-may-tinh', name: 'Chuột Máy Tính' }
];

async function run() {
  try {
    let updated = 0;
    for (const item of CATEGORY_MAP) {
      const category = await prisma.category.findFirst({
        where: {
          OR: [
            { slug: { in: item.oldSlugs } },
            { slug: item.newSlug },
            { name: { contains: item.name } }
          ]
        }
      });
      if (category) {
        if (category.name !== item.name || category.slug !== item.newSlug) {
          const conflict = await prisma.category.findUnique({ where: { slug: item.newSlug } });
          if (conflict && conflict.id !== category.id) {
            await prisma.category.update({
              where: { id: conflict.id },
              data: { slug: `${item.newSlug}-bak-${conflict.id}` }
            });
          }
          await prisma.category.update({
            where: { id: category.id },
            data: { name: item.name, slug: item.newSlug }
          });
          updated++;
        }
      }
    }
    console.log(updated > 0
      ? `Updated ${updated} categories to pure Vietnamese names and Vietnamese slugs.`
      : 'Categories already use Vietnamese names and slugs — nothing to do.');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error renaming categories:', error);
    process.exit(1);
  }
}

run();
