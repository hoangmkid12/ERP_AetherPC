// Nâng cấp dữ liệu phân hệ Nhân Sự cho DB đang chạy (chạy lúc khởi động, an toàn khi chạy lại):
//  1. Tạo tài khoản nhân viên chung "nhanvien" nếu chưa có.
//  2. Lần đầu (hrUpgradeVersion < 1): cân đối lương theo khung SALARY_GRID cho nhân viên chưa được
//     HR cấu hình phụ cấp, bổ sung chức danh còn trống.
//  3. hrUpgradeVersion < 2: tính lại số phút muộn/về sớm, giờ làm, giờ tăng ca của các bản ghi chấm công
//     theo công thức mới (trừ phần trùng nghỉ trưa, giới hạn trong thời lượng ca). Bỏ qua những tháng đã có
//     bảng lương được duyệt hoặc đã chi để không làm lệch chứng từ đã chốt.
//  4. Nạp danh sách ngày lễ nếu bảng còn trống.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { GENERAL_EMPLOYEE, HOLIDAYS, gridFor } = require('./hr-reference-data');
const { computeAttendanceMetrics } = require('../src/services/hrPolicy');

const prisma = new PrismaClient();
const UPGRADE_VERSION = 2;

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

    const version = settings.hrUpgradeVersion || 0;
    if (version < 1) {
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
      await prisma.companySettings.update({ where: { id: 1 }, data: { hrUpgradeVersion: 1 } });
      console.log(`Nâng cấp nhân sự v1: cân đối lương cho ${rebalanced}/${employees.length} nhân viên.`);
    }

    if (version < 2) {
      const locked = new Set((await prisma.payroll.findMany({
        where: { status: { in: ['APPROVED_BY_CEO', 'PAID'] } }, select: { period: true }, distinct: ['period']
      })).map(p => p.period));
      const records = await prisma.attendance.findMany({ where: { checkIn: { not: null } } });
      let fixed = 0;
      for (const r of records) {
        if (locked.has(r.date.toISOString().slice(0, 7))) continue;
        if (r.status !== 'PRESENT' && r.status !== 'LATE') continue;
        const m = computeAttendanceMetrics({ checkIn: r.checkIn, checkOut: r.checkOut, settings });
        const changed = m.lateMinutes !== r.lateMinutes || m.earlyLeaveMinutes !== r.earlyLeaveMinutes
          || Number(r.workHours || 0) !== m.workHours || Number(r.overtimeHours || 0) !== m.overtimeHours || m.status !== r.status;
        if (!changed) continue;
        await prisma.attendance.update({
          where: { id: r.id },
          data: { lateMinutes: m.lateMinutes, earlyLeaveMinutes: m.earlyLeaveMinutes, workHours: m.workHours, overtimeHours: m.overtimeHours, status: m.status }
        });
        fixed += 1;
      }
      await prisma.companySettings.update({ where: { id: 1 }, data: { hrUpgradeVersion: UPGRADE_VERSION } });
      console.log(`Nâng cấp nhân sự v2: tính lại ${fixed}/${records.length} bản ghi chấm công theo công thức mới.`);
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
