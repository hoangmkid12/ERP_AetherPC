const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// checkOperationalPermission (src/middlewares/rbac.middleware.js) fails
// closed on a missing RolePermission row — so the small set of operations it
// actually enforces must be seeded with the same default grants the frontend
// ma trận phân quyền (rbacEngine.js DEFAULT_OPERATIONAL_MATRIX) already ships
// with, or CEO/Accountant/Sales Manager/HR get locked out of their own job
// the moment this middleware goes live on a deployment that hasn't opened
// the RBAC screen yet. Only seeds rows for these enforced operations, not
// the full 56-operation matrix — that one stays a display-only concern for
// the frontend to seed via its own UI, per the scoped Phase 3 plan.
const DEFAULT_GRANTS = [
  { role: 'CEO', operationId: 'purchasing_approve_po' },
  { role: 'CEO', operationId: 'hr_approve_payroll_ceo' },
  { role: 'ACCOUNTANT', operationId: 'accounting_disburse_payroll' },
  { role: 'SALES_MANAGER', operationId: 'sales_cancel_order' },
  { role: 'HR', operationId: 'hr_manage_employees' },
  { role: 'CEO', operationId: 'sales_manage_customers' },
  { role: 'SALES_MANAGER', operationId: 'sales_manage_customers' },
  { role: 'CEO', operationId: 'sales_approve_discount' },
  { role: 'SALES_MANAGER', operationId: 'sales_approve_discount' },
  { role: 'CEO', operationId: 'sales_manage_promotions' },
  { role: 'SALES_MANAGER', operationId: 'sales_manage_promotions' }
];

async function run() {
  try {
    let created = 0;
    for (const { role, operationId } of DEFAULT_GRANTS) {
      const existing = await prisma.rolePermission.findUnique({
        where: { role_operationId: { role, operationId } }
      });
      if (!existing) {
        await prisma.rolePermission.create({ data: { role, operationId, allowed: true, updatedBy: 'system-seed' } });
        created++;
      }
    }
    console.log(created > 0 ? `Seeded ${created} default RolePermission grant(s) for enforced operations.` : 'RolePermission enforced-operation defaults already present.');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error seeding RolePermission defaults:', error);
    process.exit(1);
  }
}

run();
