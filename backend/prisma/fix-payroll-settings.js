const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// hr.routes.js POST /payrolls trước đây đọc 2 cột này như SỐ TIỀN CỐ ĐỊNH mỗi
// kỳ lương (salesCommissionFlat mặc định 1.250.000đ, assemblyBonus 750.000đ).
// Sau khi sửa để tính đúng công thức README §6.2 (hoa hồng Sales = % doanh số
// thật, thưởng lắp ráp = đơn giá × số máy thật lắp trong kỳ), 2 cột này đổi
// hẳn ý nghĩa: salesCommissionFlat giờ là PHẦN TRĂM (mặc định 1), assemblyBonus
// vẫn là đơn giá/bộ nhưng đúng mức README ghi (150.000đ, không phải 750.000đ).
// Script này chỉ reset khi giá trị hiện tại còn mang dáng dấp số tiền cố định
// cũ (rõ ràng không phải % hợp lệ / lớn hơn hẳn 150k) — nếu quản trị viên đã
// chỉnh tay sang giá trị hợp lý mới thì để nguyên, không ghi đè.
async function run() {
  try {
    const settings = await prisma.companySettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      console.log('Chưa có CompanySettings — bỏ qua, giá trị mặc định trong schema đã đúng.');
      await prisma.$disconnect();
      return;
    }

    const data = {};
    const commission = parseFloat(settings.salesCommissionFlat);
    if (commission > 100) data.salesCommissionFlat = 1.0; // % doanh số Sales

    const assemblyBonus = parseFloat(settings.assemblyBonus);
    if (assemblyBonus > 200000) data.assemblyBonus = 150000.0; // đơn giá/bộ

    if (Object.keys(data).length === 0) {
      console.log('Cấu hình lương đã đúng chuẩn mới — không cần sửa.');
    } else {
      await prisma.companySettings.update({ where: { id: 1 }, data });
      console.log(`Đã cập nhật cấu hình lương sang chuẩn mới: ${JSON.stringify(data)}`);
    }
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error fixing payroll settings:', error);
    process.exit(1);
  }
}

run();
