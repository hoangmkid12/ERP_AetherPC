// Nâng cấp dữ liệu phân hệ Nhân Sự cho DB đang chạy (chạy lúc khởi động, an toàn khi chạy lại):
//  1. Tạo tài khoản nhân viên chung "nhanvien" nếu chưa có.
//  2. Lần đầu (hrUpgradeVersion < 1): cân đối lương theo khung SALARY_GRID cho nhân viên chưa được
//     HR cấu hình phụ cấp, bổ sung chức danh còn trống.
//  3. Nạp danh sách ngày lễ nếu bảng còn trống.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { GENERAL_EMPLOYEE, HOLIDAYS, gridFor } = require('./hr-reference-data');

const prisma = new PrismaClient();
const UPGRADE_VERSION = 1;

async function run() {
  try {
    const settings = await prisma.companySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

    const existing = await prisma.employee.findFirst({
      where: { OR: [{ email: GENERAL_EMPLOYEE.email }, { employeeCode: GENERAL_EMPLOYEE.code }] }
    });
    if (!existing) {
      const g = gridFor(GENERAL_EMPLOYEE.role);
      await prisma.employee.create({
        data: {
          employeeCode: GENERAL_EMPLOYEE.code,
          fullName: GENERAL_EMPLOYEE.name,
          email: GENERAL_EMPLOYEE.email,
          passwordHash: await bcrypt.hash('123456', 10),
          department: GENERAL_EMPLOYEE.dept,
          role: GENERAL_EMPLOYEE.role,
          phone: GENERAL_EMPLOYEE.phone,
          status: 'ACTIVE',
          hireDate: new Date(Date.UTC(2025, 2, 1)),
          ...g
        }
      });
      console.log('Đã tạo tài khoản nhân viên chung: nhanvien / 123456');
    }

    if ((settings.hrUpgradeVersion || 0) < UPGRADE_VERSION) {
      const employees = await prisma.employee.findMany();
      let rebalanced = 0;
      for (const e of employees) {
        const g = gridFor(e.role);
        const data = {};
        // Chỉ cân đối lương cho hồ sơ chưa được HR khai báo phụ cấp (tức còn là dữ liệu mẫu cũ).
        if (Number(e.allowance) === 0 && Number(e.responsibilityAllowance) === 0) {
          data.baseSalary = g.baseSalary;
          data.responsibilityAllowance = g.responsibilityAllowance;
          data.allowance = g.allowance;
          rebalanced += 1;
        }
        if (!e.jobTitle) data.jobTitle = g.jobTitle;
        // Không suy ngày vào làm từ createdAt: bản ghi mẫu được tạo lúc deploy nên ngày đó không phải
        // ngày nhận việc thật, và tính lương sẽ coi mọi ngày trước đó là chưa đi làm. HR tự cập nhật.
        if (Object.keys(data).length) await prisma.employee.update({ where: { id: e.id }, data });
      }
      await prisma.companySettings.update({ where: { id: 1 }, data: { hrUpgradeVersion: UPGRADE_VERSION } });
      console.log(`Nâng cấp nhân sự v${UPGRADE_VERSION}: cân đối lương cho ${rebalanced}/${employees.length} nhân viên.`);
    }

    if ((await prisma.holiday.count()) === 0) {
      await prisma.holiday.createMany({
        data: HOLIDAYS.map(([d, name]) => ({ date: new Date(`${d}T00:00:00.000Z`), name })),
        skipDuplicates: true
      });
      console.log(`Đã nạp ${HOLIDAYS.length} ngày nghỉ lễ.`);
    }
  } catch (err) {
    console.error('Lỗi nâng cấp phân hệ Nhân Sự:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
