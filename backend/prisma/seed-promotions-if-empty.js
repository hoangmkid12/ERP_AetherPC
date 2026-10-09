const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// SalesPOS.jsx tab "Khuyến Mãi" trước đây chỉ hiện 4 mã giảm giá hardcode
// trong state (sales_manage_promotions là quyền "ma" — không CRUD được gì).
// Giờ đã có bảng Promotion thật; seed lại đúng 4 mã demo cũ này làm dữ liệu
// khởi điểm để không hiện màn hình trống ngay sau khi triển khai.
const DEMO_PROMOTIONS = [
  { code: 'SUMMER2026', title: 'Khuyến mãi Hè Rực Rỡ', discountType: 'PERCENT', discountValue: 10, minSpend: 5000000, expiresAt: new Date('2026-08-30') },
  { code: 'VIPGAMING', title: 'Tri Ân Khách Hàng VIP PC Gaming', discountType: 'FIXED', discountValue: 500000, minSpend: 15000000, expiresAt: new Date('2026-12-31') },
  { code: 'BUILDPC', title: 'Ưu đãi giảm giá khi Build trọn bộ PC', discountType: 'PERCENT', discountValue: 8, minSpend: 10000000, expiresAt: new Date('2026-09-15') },
  { code: 'FREESHIP', title: 'Miễn phí vận chuyển hỏa tốc nội thành', discountType: 'FIXED', discountValue: 100000, minSpend: 2000000, expiresAt: new Date('2026-10-31') }
];

// Hai mã trước đây viết cứng trong giỏ hàng (Cart.jsx) — nay giỏ hàng đọc mã từ bảng Promotion nên
// cần có trong CSDL. Chỉ thêm nếu chưa tồn tại, không ghi đè mã quản lý đã chỉnh.
const STOREFRONT_PROMOTIONS = [
  { code: 'AETHER10', title: 'Giảm 10% cho đơn từ 2 triệu', discountType: 'PERCENT', discountValue: 10, minSpend: 2000000, expiresAt: new Date('2026-12-31') },
  { code: 'NEWPC200K', title: 'Giảm 200.000đ cho đơn từ 5 triệu', discountType: 'FIXED', discountValue: 200000, minSpend: 5000000, expiresAt: new Date('2026-12-31') }
];

async function run() {
  try {
    const added = await prisma.promotion.createMany({ data: STOREFRONT_PROMOTIONS, skipDuplicates: true });
    if (added.count) console.log(`Đã thêm ${added.count} mã giảm giá của cửa hàng.`);
    const count = await prisma.promotion.count();
    if (count > added.count) {
      console.log('Bảng Promotion đã có dữ liệu — bỏ qua seed.');
      await prisma.$disconnect();
      return;
    }
    await prisma.promotion.createMany({ data: DEMO_PROMOTIONS });
    console.log(`Đã seed ${DEMO_PROMOTIONS.length} khuyến mãi demo.`);
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error seeding promotions:', error);
    process.exit(1);
  }
}

run();
