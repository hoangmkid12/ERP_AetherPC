const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Chuẩn hóa tên danh mục thuần tiếng Việt và slug sang tiếng Việt
//
// `man-hinh-bak-2` trong oldSlugs của GPU là để SỬA một lỗi dữ liệu thật đã xảy ra
// trên production: category GPU từng bị đổi nhầm thành tên "Màn Hình" (đụng tên với
// Monitor thật), do vòng lặp bên dưới TRƯỚC ĐÂY còn khớp category theo cả
// `name.contains` — sau khi GPU được đổi tên thành "Card Màn Hình" ở bước trước, tên
// đó lại VÔ TÌNH chứa chuỗi con "Màn Hình", nên khi xử lý tới dòng Monitor,
// `findFirst` có thể khớp nhầm sang category GPU (qua name.contains) thay vì
// category Monitor thật — kết quả: GPU bị đổi tên đè thành "Màn Hình", slug bị dồn
// thành "man-hinh-bak-<id>" khi động chạm unique constraint với Monitor thật (đã xác
// nhận qua đối chiếu trực tiếp sản phẩm thật theo từng slug trên production: slug
// "man-hinh-bak-2" toàn card đồ họa GeForce/Radeon, không phải màn hình). Bên dưới đã
// bỏ hẳn `name.contains` — chỉ khớp theo slug (duy nhất, không mơ hồ) — để lỗi này
// không lặp lại.
const CATEGORY_MAP = [
  { oldSlugs: ['cpu', 'bo-vi-xu-ly'], newSlug: 'bo-vi-xu-ly', name: 'Bộ Vi Xử Lý' },
  { oldSlugs: ['gpu', 'vga', 'card-man-hinh', 'man-hinh-bak-2'], newSlug: 'card-man-hinh', name: 'Card Màn Hình' },
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
      // Chỉ khớp theo slug — xem giải thích ở CATEGORY_MAP phía trên vì sao đã bỏ
      // hẳn điều kiện `name.contains` (nguồn gốc lỗi dữ liệu GPU/Monitor thật).
      const category = await prisma.category.findFirst({
        where: { slug: { in: [...item.oldSlugs, item.newSlug] } }
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
