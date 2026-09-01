// One-off/repeatable script to populate demo Sales Orders and Purchase Orders
// so the admin/storefront pages have something real to display. The main
// seed.js never actually creates any Order rows — its orders.json uses
// product_id values (e.g. "SSD-002") that don't match the real seeded
// product IDs, so every order's item list filters down to empty and gets
// skipped. This script sidesteps that by using real, already-seeded
// customers/products/suppliers directly.
//
// Usage: node prisma/seedSampleTransactions.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const iso = (daysAgo, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  const customers = await prisma.customer.findMany({ take: 10, orderBy: { customerId: 'asc' } });
  const products = await prisma.product.findMany({ take: 40, where: { available: true }, orderBy: { productId: 'asc' } });
  const suppliers = await prisma.supplier.findMany({ where: { code: { not: 'supplier' } }, orderBy: { code: 'asc' } });

  if (customers.length < 10 || products.length < 20 || suppliers.length < 10) {
    throw new Error('Not enough base data (customers/products/suppliers) to seed sample transactions.');
  }

  const pickItems = (startIdx, count) => products.slice(startIdx, startIdx + count);

  // ─── 10 Sales Orders (Order-to-Cash) ────────────────────────────────────
  const orderPlans = [
    { n: '0001', cust: 0, status: 'PENDING', payStatus: 'PENDING', pay: 'COD', daysAgo: 0, items: pickItems(0, 2) },
    { n: '0002', cust: 1, status: 'CONFIRMED', payStatus: 'PAID', pay: 'BANK_TRANSFER', daysAgo: 1, items: pickItems(2, 1) },
    { n: '0003', cust: 2, status: 'PROCESSING', payStatus: 'PAID', pay: 'BANK_TRANSFER', daysAgo: 2, items: pickItems(3, 3) },
    { n: '0004', cust: 3, status: 'PACKED', payStatus: 'PENDING', pay: 'COD', daysAgo: 2, items: pickItems(6, 2) },
    { n: '0005', cust: 4, status: 'READY_TO_SHIP', payStatus: 'PAID', pay: 'ONLINE', daysAgo: 3, items: pickItems(8, 1) },
    { n: '0006', cust: 5, status: 'SHIPPED', payStatus: 'PAID', pay: 'ONLINE', daysAgo: 4, items: pickItems(9, 2) },
    { n: '0007', cust: 6, status: 'DELIVERED', payStatus: 'PAID', pay: 'COD', daysAgo: 6, items: pickItems(11, 2) },
    { n: '0008', cust: 7, status: 'COMPLETED', payStatus: 'PAID', pay: 'BANK_TRANSFER', daysAgo: 9, items: pickItems(13, 3) },
    { n: '0009', cust: 8, status: 'CANCELLED', payStatus: 'REFUNDED', pay: 'COD', daysAgo: 5, items: pickItems(16, 1) },
    { n: '0010', cust: 9, status: 'DELIVERED', payStatus: 'PAID', pay: 'COD', daysAgo: 7, items: pickItems(17, 2) }
  ];

  console.log('Seeding 10 sample sales orders...');
  for (const plan of orderPlans) {
    const orderId = `ORD-260901-${plan.n}`;
    const exists = await prisma.order.findUnique({ where: { orderId } });
    if (exists) { console.log('  skip (exists):', orderId); continue; }

    const cust = customers[plan.cust];
    const items = plan.items.map((p, i) => ({
      orderItemId: `ORI-260901-${plan.n}-${i + 1}`,
      productId: p.productId,
      sku: p.sku,
      name: p.name,
      quantity: 1 + (i % 2),
      price: p.price,
      originalPrice: p.price,
      totalPrice: Number(p.price) * (1 + (i % 2))
    }));
    const subtotal = items.reduce((s, it) => s + Number(it.totalPrice), 0);
    const shippingFee = plan.status === 'CANCELLED' ? 0 : 30000;
    const totalAmount = subtotal + shippingFee;

    const createdAt = iso(plan.daysAgo, 9);
    const confirmedAt = ['CONFIRMED', 'PROCESSING', 'PACKED', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(plan.status)
      ? iso(plan.daysAgo, 10) : null;
    const shippedAt = ['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(plan.status) ? iso(plan.daysAgo - 1, 8) : null;
    const deliveredAt = ['DELIVERED', 'COMPLETED'].includes(plan.status) ? iso(Math.max(plan.daysAgo - 2, 0), 15) : null;
    const cancelledAt = plan.status === 'CANCELLED' ? iso(plan.daysAgo, 14) : null;

    await prisma.order.create({
      data: {
        orderId,
        customerId: cust.customerId,
        subtotal,
        discount: 0,
        shippingFee,
        totalAmount,
        paymentMethod: plan.pay,
        paymentStatus: plan.payStatus,
        status: plan.status,
        shippingAddress: cust.address || 'Địa chỉ chưa cập nhật',
        shippingCity: cust.city || 'Hồ Chí Minh',
        createdAt,
        confirmedAt,
        shippedAt,
        deliveredAt,
        cancelledAt,
        items: { create: items }
      }
    });

    const history = [{ status: 'PENDING', note: 'Khởi tạo đơn hàng từ giỏ hàng', changedBy: 'Khách hàng', timestamp: createdAt }];
    if (confirmedAt) history.push({ status: 'CONFIRMED', note: 'Đã xác nhận đơn hàng', changedBy: 'Nhân viên bán hàng', timestamp: confirmedAt });
    if (shippedAt) history.push({ status: 'SHIPPED', note: 'Đã xuất kho bàn giao giao vận', changedBy: 'Thủ kho', timestamp: shippedAt });
    if (deliveredAt) history.push({ status: 'DELIVERED', note: 'Giao hàng thành công', changedBy: 'Shipper', timestamp: deliveredAt });
    if (cancelledAt) history.push({ status: 'CANCELLED', note: 'Khách yêu cầu hủy đơn', changedBy: 'Hệ thống', timestamp: cancelledAt });
    for (const h of history) {
      await prisma.orderStatusHistory.create({ data: { orderId, ...h } });
    }

    if (plan.payStatus === 'PAID' || plan.payStatus === 'REFUNDED') {
      await prisma.orderPayment.create({
        data: {
          orderId,
          method: plan.pay,
          amount: totalAmount,
          transactionId: plan.pay === 'COD' ? null : `TXN-${orderId}`,
          status: plan.payStatus,
          createdAt
        }
      });
    }

    console.log('  created:', orderId, `(${plan.status})`);
  }

  // ─── 10 Purchase Orders (Procure-to-Pay) ────────────────────────────────
  const poPlans = [
    { n: 'RFQ-2026-0003', supplierIdx: 6, status: 'RFQ', daysAgo: 1, items: pickItems(20, 2) },
    { n: 'RFQ-2026-0004', supplierIdx: 7, status: 'RFQ_SENT', daysAgo: 2, items: pickItems(22, 1) },
    { n: 'RFQ-2026-0005', supplierIdx: 8, status: 'QUOTED', daysAgo: 3, items: pickItems(23, 3) },
    { n: 'PO-2026-0007', supplierIdx: 9, status: 'APPROVED', daysAgo: 4, items: pickItems(26, 2) },
    { n: 'PO-2026-0008', supplierIdx: 10, status: 'PO', daysAgo: 5, items: pickItems(28, 2) },
    { n: 'PO-2026-0009', supplierIdx: 11, status: 'CONFIRMED_BY_SUPPLIER', daysAgo: 6, items: pickItems(30, 1) },
    { n: 'PO-2026-0010', supplierIdx: 12, status: 'PENDING_QA', daysAgo: 8, items: pickItems(31, 2) },
    { n: 'PO-2026-0011', supplierIdx: 13, status: 'QA_PASSED', daysAgo: 9, items: pickItems(33, 3) },
    { n: 'PO-2026-0012', supplierIdx: 0, status: 'DONE', daysAgo: 12, items: pickItems(36, 2) },
    { n: 'PO-2026-0013', supplierIdx: 1, status: 'CANCELLED', daysAgo: 3, items: pickItems(38, 1) }
  ];

  console.log('Seeding 10 sample purchase orders...');
  for (const plan of poPlans) {
    const exists = await prisma.purchaseOrder.findUnique({ where: { poNumber: plan.n } });
    if (exists) { console.log('  skip (exists):', plan.n); continue; }

    const supplier = suppliers[plan.supplierIdx % suppliers.length];
    const items = plan.items.map((p) => {
      const unitCost = Math.round(Number(p.price) * 0.72 / 1000) * 1000; // wholesale ~72% of retail
      const quantity = 5 + Math.floor(Math.random() * 15);
      return { productId: p.productId, quantity, unitCost, totalCost: unitCost * quantity };
    });
    const totalAmount = items.reduce((s, it) => s + it.totalCost, 0);
    const createdAt = iso(plan.daysAgo, 9);

    await prisma.purchaseOrder.create({
      data: {
        poNumber: plan.n,
        supplierCode: supplier.code,
        status: plan.status,
        totalAmount,
        expectedDeliveryDate: iso(plan.daysAgo - 5, 0),
        cancelReason: plan.status === 'CANCELLED' ? 'Nhà cung cấp báo hết hàng, không thể giao đúng hẹn.' : null,
        createdBy: 'purchasing@kltn-erp.vn',
        createdAt,
        items: { create: items }
      }
    });

    await prisma.purchaseOrderStatusHistory.create({
      data: {
        poId: (await prisma.purchaseOrder.findUnique({ where: { poNumber: plan.n } })).id,
        status: plan.status,
        note: `Khởi tạo đơn ở trạng thái ${plan.status}`,
        changedBy: 'Phòng Mua Hàng',
        changedByRole: 'PURCHASING',
        timestamp: createdAt
      }
    });

    console.log('  created:', plan.n, `(${plan.status}, NCC: ${supplier.code})`);
  }

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
