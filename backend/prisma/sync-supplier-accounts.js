const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const SUPPLIERS_JSON = path.join(__dirname, '..', '..', 'scraper', 'data', 'suppliers.json');
const DEFAULT_PASSWORD_HASH = '$2a$10$IyfWpe/v6d3OiOESKMx74eJNfiLnHx0T2oPH.isjyKrGgqXVHFRSG'; // 123456

async function run() {
  let suppliers = [];
  if (fs.existsSync(SUPPLIERS_JSON)) {
    try {
      suppliers = JSON.parse(fs.readFileSync(SUPPLIERS_JSON, 'utf8'));
    } catch (e) {
      console.warn('Could not parse suppliers.json, reading from DB instead');
    }
  }

  // If suppliers.json not found or empty, sync all suppliers in database
  if (!suppliers || suppliers.length === 0) {
    const dbSuppliers = await prisma.supplier.findMany({ select: { code: true } });
    suppliers = dbSuppliers;
  }

  let provisioned = 0;
  for (const supplier of suppliers) {
    if (!supplier.code) continue;
    const result = await prisma.supplier.updateMany({
      where: { code: supplier.code, passwordHash: null },
      data: { passwordHash: DEFAULT_PASSWORD_HASH }
    });
    provisioned += result.count;
  }

  console.log(`Supplier accounts ready; initialized ${provisioned} account(s).`);
}

run()
  .catch((error) => {
    console.error('Unable to initialize supplier accounts:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
