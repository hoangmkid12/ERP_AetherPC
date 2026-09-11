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

async function run() {
  try {
    const count = await prisma.promotion.count();
    if (count > 0) {
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
