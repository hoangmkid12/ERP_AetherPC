const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const existingCount = await prisma.leaveRequest.count();
    if (existingCount > 0) {
      console.log(`Leave requests already seeded (${existingCount} records). Skipping.`);
      await prisma.$disconnect();
      return;
    }

    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      take: 10
    });

    if (employees.length === 0) {
      console.log('No active employees found to seed leave requests.');
      await prisma.$disconnect();
      return;
    }

    // Map some sample employees
    const salesEmp = employees.find(e => e.role === 'SALES') || employees[0];
    const warehouseEmp = employees.find(e => e.role === 'WAREHOUSE') || employees[1 % employees.length];
    const techEmp = employees.find(e => e.role === 'ASSEMBLY') || employees[2 % employees.length];
    const accountantEmp = employees.find(e => e.role === 'ACCOUNTANT') || employees[3 % employees.length];

    const sampleLeaves = [
      {
        employeeId: salesEmp.id,
        type: 'Phép Năm',
        startDate: new Date('2026-09-15'),
        endDate: new Date('2026-09-17'),
        reason: 'Nghỉ du lịch gia đình thường niên',
        status: 'PENDING'
      },
      {
        employeeId: warehouseEmp.id,
        type: 'Nghỉ Ốm',
        startDate: new Date('2026-09-12'),
        endDate: new Date('2026-09-13'),
        reason: 'Bị sốt siêu vi cần theo dõi sức khỏe tại nhà',
        status: 'PENDING'
      },
      {
        employeeId: techEmp.id,
        type: 'Việc Riêng',
        startDate: new Date('2026-09-18'),
        endDate: new Date('2026-09-18'),
        reason: 'Về quê giải quyết thủ tục giấy tờ cá nhân',
        status: 'PENDING'
      },
      {
        employeeId: accountantEmp.id,
        type: 'Phép Năm',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-03'),
        reason: 'Nghỉ phép cá nhân sau đợt quyết toán tháng',
        status: 'APPROVED'
      }
    ];

    let created = 0;
    for (const item of sampleLeaves) {
      await prisma.leaveRequest.create({ data: item });
      created++;
    }

    console.log(`Successfully seeded ${created} sample leave requests.`);
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error seeding sample leave requests:', error);
    process.exit(1);
  }
}

run();
