/**
 * seed-demo-shipper.js
 * Tạo dữ liệu test:
 *   - 1 tài khoản khách hàng demo (email: demo.customer@aetherpc.vn / pass: 123456)
 *   - 1 tài khoản shipper demo (email: demo.shipper@aetherpc.vn / pass: 123456)
 *   - 5 đơn hàng ở các quận khác nhau trong TP.HCM, đã giao cho shipper đó
 *
 * Chạy bằng lệnh:
 *   docker compose exec backend node prisma/seed-demo-shipper.js
 * HOẶC nếu chạy local:
 *   cd backend && node prisma/seed-demo-shipper.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const CUSTOMER_ID   = 'CUST-DEMO-001';
const CUSTOMER_EMAIL = 'demo.customer@aetherpc.vn';
const CUSTOMER_PASS  = '123456';

const SHIPPER_EMAIL  = 'demo.shipper@aetherpc.vn';
const SHIPPER_CODE   = 'EMP-SHIPPER-01';
const SHIPPER_PASS   = '123456';

// 5 địa chỉ thực tế trong TP.HCM (các quận khác nhau để test route optimization)
const ORDERS_DATA = [
  {
    orderId: 'ORD-DEMO-0001',
    shippingAddress: '12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    shippingCity: 'Hồ Chí Minh',
    totalAmount: 3990000,
    paymentMethod: 'COD',
    notes: 'Giao giờ hành chính. Gọi trước 30 phút.',
    productName: 'RAM Kingston 16GB DDR4 3200MHz',
  },
  {
    orderId: 'ORD-DEMO-0002',
    shippingAddress: '45 Nguyễn Thị Minh Khai, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
    shippingCity: 'Hồ Chí Minh',
    totalAmount: 8500000,
    paymentMethod: 'BANK_TRANSFER',
    notes: 'Đã chuyển khoản, không thu tiền mặt.',
    productName: 'Ổ cứng SSD Samsung 970 EVO 1TB',
  },
  {
    orderId: 'ORD-DEMO-0003',
    shippingAddress: '78 Đinh Tiên Hoàng, Phường 3, Quận Bình Thạnh, TP. Hồ Chí Minh',
    shippingCity: 'Hồ Chí Minh',
    totalAmount: 2100000,
    paymentMethod: 'COD',
    notes: 'Chú gác cổng nhận hộ được.',
    productName: 'Chuột Gaming Logitech G304',
  },
  {
    orderId: 'ORD-DEMO-0004',
    shippingAddress: '15 Phan Văn Trị, Phường 10, Quận Gò Vấp, TP. Hồ Chí Minh',
    shippingCity: 'Hồ Chí Minh',
    totalAmount: 5200000,
    paymentMethod: 'COD',
    notes: 'Khách muốn kiểm tra hàng trước khi thanh toán.',
    productName: 'Bàn phím cơ Keychron K8 RGB',
  },
  {
    orderId: 'ORD-DEMO-0005',
    shippingAddress: '30 Hoàng Diệu 2, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh',
    shippingCity: 'Hồ Chí Minh',
    totalAmount: 12990000,
    paymentMethod: 'COD',
    notes: 'Tòa nhà Landmark Thủ Đức, tầng 8, phòng 802.',
    productName: 'Card đồ họa RTX 4060 8GB',
  },
];

async function findOrCreateProduct() {
  // Tìm bất kỳ sản phẩm nào để gắn vào OrderItem
  const anyProduct = await prisma.product.findFirst({ select: { productId: true, price: true } });
  return anyProduct;
}

async function main() {
  console.log('\n🚀 Bắt đầu tạo dữ liệu test Shipper Demo...\n');

  // ─── 1. Tạo tài khoản khách hàng ───────────────────────────────────
  const customerPasswordHash = await bcrypt.hash(CUSTOMER_PASS, 10);
  const customer = await prisma.customer.upsert({
    where: { customerId: CUSTOMER_ID },
    update: {
      email: CUSTOMER_EMAIL,
      passwordHash: customerPasswordHash,
      name: 'Nguyễn Văn Demo',
      phone: '0901234567',
      city: 'Hồ Chí Minh',
      status: 'ACTIVE',
    },
    create: {
      customerId: CUSTOMER_ID,
      email: CUSTOMER_EMAIL,
      username: 'demo_customer',
      passwordHash: customerPasswordHash,
      name: 'Nguyễn Văn Demo',
      phone: '0901234567',
      city: 'Hồ Chí Minh',
      customerType: 'B2C',
      status: 'ACTIVE',
    }
  });
  console.log(`✅ Khách hàng: ${customer.name} (${CUSTOMER_EMAIL} / ${CUSTOMER_PASS})`);

  // ─── 2. Tạo tài khoản Shipper (Employee với role DELIVERY) ─────────
  const shipperPasswordHash = await bcrypt.hash(SHIPPER_PASS, 10);
  let shipper = await prisma.employee.findUnique({ where: { employeeCode: SHIPPER_CODE } });
  if (!shipper) {
    // Reset sequence PostgreSQL để tránh lỗi trùng id khi bảng employees có autoincrement bị lệch
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"employees"', 'id'), COALESCE((SELECT MAX(id) FROM employees), 0) + 1, false)`;
    shipper = await prisma.employee.create({
      data: {
        employeeCode: SHIPPER_CODE,
        email: SHIPPER_EMAIL,
        passwordHash: shipperPasswordHash,
        fullName: 'Trần Giao Demo',
        department: 'Giao Hàng',
        role: 'DELIVERY',
        deliveryRegion: 'HCM_INNER',
        phone: '0912345678',
        baseSalary: 8000000,
        status: 'ACTIVE',
      }
    });
  } else {
    shipper = await prisma.employee.update({
      where: { employeeCode: SHIPPER_CODE },
      data: {
        email: SHIPPER_EMAIL,
        passwordHash: shipperPasswordHash,
        fullName: 'Trần Giao Demo',
        role: 'DELIVERY',
        status: 'ACTIVE',
      }
    });
  }
  console.log(`✅ Shipper: ${shipper.fullName} (${SHIPPER_EMAIL} / ${SHIPPER_PASS}) — ID: ${shipper.id}`);

  // ─── 3. Tìm sản phẩm bất kỳ để dùng trong OrderItem ───────────────
  const sampleProduct = await findOrCreateProduct();
  if (!sampleProduct) {
    console.warn('⚠️  Không tìm thấy sản phẩm trong DB. OrderItems sẽ không được tạo (nhưng đơn vẫn tồn tại).');
  }

  // ─── 4. Tạo 5 đơn hàng, phân công cho shipper ─────────────────────
  console.log('\n📦 Tạo 5 đơn hàng...');
  for (const orderData of ORDERS_DATA) {
    const existingOrder = await prisma.order.findUnique({ where: { orderId: orderData.orderId } });
    if (existingOrder) {
      // Chỉ cập nhật shipper assignment và status nếu đơn đã tồn tại
      await prisma.order.update({
        where: { orderId: orderData.orderId },
        data: {
          assignedShipperId: shipper.id,
          status: 'SHIPPED',
          shippedAt: new Date(),
        }
      });
      console.log(`  🔄 Đã cập nhật (assign shipper): ${orderData.orderId} — ${orderData.shippingAddress.split(',')[1]?.trim() || ''}`);
      continue;
    }

    // Tạo đơn mới
    const amount = orderData.totalAmount;
    await prisma.order.create({
      data: {
        orderId: orderData.orderId,
        customerId: CUSTOMER_ID,
        subtotal: amount,
        discount: 0,
        shippingFee: 30000,
        totalAmount: amount + 30000,
        paymentMethod: orderData.paymentMethod,
        paymentStatus: orderData.paymentMethod === 'BANK_TRANSFER' ? 'PAID' : 'PENDING',
        status: 'SHIPPED',
        notes: orderData.notes,
        shippingAddress: orderData.shippingAddress,
        shippingCity: orderData.shippingCity,
        assignedShipperId: shipper.id,
        deliveryRegion: 'HCM_INNER',
        confirmedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        shippedAt: new Date(),
        // Thêm OrderItem nếu có sản phẩm
        items: sampleProduct ? {
          create: {
            orderItemId: `${orderData.orderId}-ITEM-001`,
            productId: sampleProduct.productId,
            name: orderData.productName,
            quantity: 1,
            price: amount,
            originalPrice: amount,
            totalPrice: amount,
          }
        } : undefined,
        // Tạo status history
        statusHistory: {
          createMany: {
            data: [
              { status: 'PENDING', changedBy: 'system', note: 'Đơn hàng mới', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000) },
              { status: 'CONFIRMED', changedBy: 'CSKH Demo', note: 'Đã xác nhận đơn hàng', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) },
              { status: 'READY_TO_SHIP', changedBy: 'Kho Demo', note: 'Hàng đã đóng gói, sẵn sàng giao', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
              { status: 'SHIPPED', changedBy: 'system', note: `Đã phân công cho Shipper: ${shipper.fullName}`, timestamp: new Date() },
            ]
          }
        }
      }
    });

    const addr = orderData.shippingAddress.split(',').slice(1, 3).join(',').trim();
    console.log(`  ✅ ${orderData.orderId} — ${addr} — ${(amount + 30000).toLocaleString('vi-VN')}₫ [${orderData.paymentMethod}]`);
  }

  // ─── 5. Tóm tắt ────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('🎉 HOÀN THÀNH! Dữ liệu test đã được tạo:');
  console.log('─'.repeat(60));
  console.log('\n👤 TÀI KHOẢN KHÁCH HÀNG:');
  console.log(`   Email   : ${CUSTOMER_EMAIL}`);
  console.log(`   Password: ${CUSTOMER_PASS}`);
  console.log(`   Họ tên  : Nguyễn Văn Demo`);
  console.log('\n🚚 TÀI KHOẢN SHIPPER:');
  console.log(`   Email   : ${SHIPPER_EMAIL}`);
  console.log(`   Password: ${SHIPPER_PASS}`);
  console.log(`   Họ tên  : Trần Giao Demo`);
  console.log(`   Vai trò : DELIVERY`);
  console.log('\n📦 5 ĐƠN HÀNG ĐÃ PHÂN CÔNG:');
  ORDERS_DATA.forEach((o, i) => {
    const addr = o.shippingAddress.split(',').slice(1, 3).join(',').trim();
    console.log(`   ${i + 1}. ${o.orderId} — ${addr} — ${o.paymentMethod}`);
  });
  console.log('\n💡 GỢI Ý TEST:');
  console.log('   1. Đăng nhập bằng tk Shipper');
  console.log('   2. Vào Tab "Đang Giao"');
  console.log('   3. Bấm "✨ Tối Ưu Lộ Trình" để xem thuật toán hoạt động');
  console.log('─'.repeat(60) + '\n');
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi seed dữ liệu:', err.message);
    if (err.code === 'P2002') {
      console.error('   → Lỗi trùng dữ liệu. Thử chạy lại, script sẽ tự dùng upsert.');
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
