const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting stock reallocation...');
  
  // 1. Path to scraper json
  const jsonPath = path.join(__dirname, '..', '..', 'scraper', 'data', 'products_clean.json');
  let products = [];
  if (fs.existsSync(jsonPath)) {
    products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }
  
  console.log(`Total products in JSON: ${products.length}`);
  
  // Target distribution out of total items (1580 total):
  // - 1000 items SAFE (stockQuantity >= 15)
  // - 250 items WARNING (1 <= stockQuantity <= 5)
  // - 330 items OUT_OF_STOCK (stockQuantity = 0)
  
  const targetSafe = 1000;
  const targetWarning = 250;
  
  let safeCount = 0;
  let warningCount = 0;
  let outCount = 0;

  for (let i = 0; i < products.length; i++) {
    let stock = 0;
    
    if (i < targetSafe) {
      // Safe stock: 15 to 100 items
      stock = Math.floor(15 + (i % 85));
      safeCount++;
    } else if (i < targetSafe + targetWarning) {
      // Warning stock: 1 to 5 items
      stock = (i % 5) + 1;
      warningCount++;
    } else {
      // Out of stock
      stock = 0;
      outCount++;
    }
    
    products[i].stock_quantity = stock;
    products[i].available = true;
  }

  // Save back to products_clean.json
  fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2), 'utf8');
  console.log(`Updated products_clean.json: Safe=${safeCount}, Warning=${warningCount}, OutOfStock=${outCount}`);

  // 2. Update Database via Prisma
  try {
    const dbProducts = await prisma.product.findMany({ select: { productId: true } });
    console.log(`Found ${dbProducts.length} products in Database.`);
    
    for (let i = 0; i < dbProducts.length; i++) {
      const p = dbProducts[i];
      let stock = 0;
      if (i < targetSafe) {
        stock = Math.floor(15 + (i % 85));
      } else if (i < targetSafe + targetWarning) {
        stock = (i % 5) + 1;
      } else {
        stock = 0;
      }
      
      await prisma.product.update({
        where: { productId: p.productId },
        data: { stockQuantity: stock, available: true }
      });
      
      // Update inventory table if exists
      const stockWh1 = Math.floor(stock * 0.7);
      const stockWh2 = stock - stockWh1;
      
      await prisma.inventory.updateMany({
        where: { productId: p.productId, warehouseId: 1 },
        data: { quantityOnHand: stockWh1 }
      });
      await prisma.inventory.updateMany({
        where: { productId: p.productId, warehouseId: 2 },
        data: { quantityOnHand: stockWh2 }
      });
    }
    console.log('Database stock quantities updated successfully!');
  } catch (err) {
    console.error('Error updating DB:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
