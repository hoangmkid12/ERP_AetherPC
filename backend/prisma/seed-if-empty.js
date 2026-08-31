const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Checking database status...');
    const productCount = await prisma.product.count();
    
    if (productCount === 0) {
      console.log('Database is empty. Running database seed...');
      // Execute the main seeding file
      require('./seed.js');
    } else {
      console.log(`Database already has data (${productCount} products). Skipping seeding to preserve manual changes.`);
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Error checking database status:', error);
    // Exit with 0 if it is a transient error or just log it
    // Wait: if postgres is not ready or schema has issues, let it crash so docker restarts
    process.exit(1);
  }
}

run();
