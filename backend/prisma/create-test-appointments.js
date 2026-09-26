const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n🚀 Bắt đầu tạo dữ liệu kiểm thử Đơn Giao Lại & Hẹn Giờ (VRPTW)...\n');

  // 1. Tìm hoặc lấy Shipper
  const shippers = await prisma.employee.findMany({
    where: { role: 'DELIVERY' },
    select: { id: true, employeeCode: true, fullName: true, email: true }
  });

  console.log(`Tìm thấy ${shippers.length} nhân viên giao hàng:`);
  shippers.forEach(s => console.log(`  - ID: ${s.id} | Mã: ${s.employeeCode} | Tên: ${s.fullName} | Email: ${s.email}`));

  const targetShipper = shippers.find(s => s.email === 'delivery@kltn-erp.vn') || shippers[0];
  if (!targetShipper) {
    console.error('❌ Không tìm thấy nhân viên DELIVERY nào trong database!');
    return;
  }
  console.log(`\n🎯 Gán dữ liệu kiểm thử cho Shipper: ${targetShipper.fullName} (ID: ${targetShipper.id}, Email: ${targetShipper.email})`);

  // 2. Tìm sản phẩm mẫu
  const sampleProduct = await prisma.product.findFirst();
  const productId = sampleProduct?.productId || null;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // 3. Danh sách các đơn test đặc biệt
  const TEST_ORDERS = [
    {
      orderId: 'ORD-HEN-001',
      customerName: 'Nguyễn Tuấn Kiệt (Hẹn Đầu Chiều)',
      phone: '0903112233',
      shippingAddress: '12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      totalAmount: 2450000,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      status: 'SHIPPED',
      shippedAt: now,
      // Hẹn giờ đầu chiều: 13:30 - 15:30 (Đúng hẹn hoặc Sắp tới giờ hẹn)
      notes: `[GIAO_LAI] [HEN:${todayStr}_13:30-15:30] Khách hẹn giao chiều sau 13h30`,
      failNote: `[GIAO_LAI] [HEN:${todayStr}_13:30-15:30]`,
      deliveryRegion: 'HCM_INNER'
    },
    {
      orderId: 'ORD-HEN-002',
      customerName: 'Trần Thị Mai Phương (Hẹn Sáng - Trễ)',
      phone: '0918445566',
      shippingAddress: '180 Hai Bà Trưng, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh',
      totalAmount: 4800000,
      paymentMethod: 'BANK_TRANSFER',
      paymentStatus: 'PAID',
      status: 'SHIPPED',
      shippedAt: now,
      // Hẹn giờ sáng: 08:30 - 11:00 (Cảnh báo TRỄ GIỜ HẸN)
      notes: `[GIAO_LAI] [HEN:${todayStr}_08:30-11:00] Khách hẹn trước trưa, gọi trước 15p`,
      failNote: `[GIAO_LAI] [HEN:${todayStr}_08:30-11:00]`,
      deliveryRegion: 'HCM_INNER'
    },
    {
      orderId: 'ORD-HEN-003',
      customerName: 'Lê Hoàng Long (Hẹn Cuối Chiều)',
      phone: '0933778899',
      shippingAddress: '65 Điện Biên Phủ, Phường 15, Quận Bình Thạnh, TP. Hồ Chí Minh',
      totalAmount: 5800000,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      status: 'SHIPPED',
      shippedAt: now,
      // Hẹn giờ cuối chiều: 15:30 - 18:00
      notes: `[GIAO_LAI] [HEN:${todayStr}_15:30-18:00] Khách đi làm về sau 16h`,
      failNote: `[GIAO_LAI] [HEN:${todayStr}_15:30-18:00]`,
      deliveryRegion: 'HCM_INNER'
    },
    {
      orderId: 'ORD-NEW-101',
      customerName: 'Phạm Minh Trí (Đơn Mới Ca Hôm Nay)',
      phone: '0977223344',
      shippingAddress: '240 Nguyễn Thị Minh Khai, Phường 6, Quận 3, TP. Hồ Chí Minh',
      totalAmount: 1200000,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      status: 'SHIPPED',
      shippedAt: now,
      // Đơn mới toanh - tự do
      notes: 'Đơn mới xuất kho ca hôm nay, giao giờ hành chính',
      failNote: null,
      deliveryRegion: 'HCM_INNER'
    },
    {
      orderId: 'ORD-NEW-102',
      customerName: 'Vũ Quỳnh Nga (Đơn Mới Ca Hôm Nay)',
      phone: '0944556677',
      shippingAddress: '15 Phan Văn Trị, Phường 10, Quận Gò Vấp, TP. Hồ Chí Minh',
      totalAmount: 3500000,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      status: 'SHIPPED',
      shippedAt: now,
      // Đơn mới toanh - tự do
      notes: 'Giao tận tay người nhận, kiểm tra hàng thoải mái',
      failNote: null,
      deliveryRegion: 'HCM_INNER'
    },
    {
      orderId: 'ORD-HEN-PENDING',
      customerName: 'Hoàng Bích Thủy (Chờ Shipper Bấm Giao Lại)',
      phone: '0908889900',
      shippingAddress: '50 Nam Kỳ Khởi Nghĩa, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      totalAmount: 4200000,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      status: 'SHIPPING_FAILED',
      failReason: 'Khách hẹn giao lại ngày khác (Bận việc / Đi vắng)',
      failNote: `[HEN:${todayStr}_14:00-16:00] Khách bận họp, hẹn giao lại buổi chiều`,
      notes: 'Khách hẹn giao chiều',
      deliveryRegion: 'HCM_INNER'
    }
  ];

  for (const ord of TEST_ORDERS) {
    // 4. Tìm hoặc tạo Customer cho mỗi đơn
    let cust = await prisma.customer.findFirst({ where: { phone: ord.phone } });
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          customerId: `CUST-${ord.phone.slice(-6)}`,
          name: ord.customerName,
          phone: ord.phone,
          email: `${ord.phone}@customer.test`,
          city: 'Hồ Chí Minh',
          customerType: 'B2C'
        }
      });
    } else {
      await prisma.customer.update({
        where: { customerId: cust.customerId },
        data: { name: ord.customerName }
      });
    }

    const existing = await prisma.order.findUnique({ where: { orderId: ord.orderId } });
    if (existing) {
      await prisma.order.update({
        where: { orderId: ord.orderId },
        data: {
          customerId: cust.customerId,
          assignedShipperId: targetShipper.id,
          status: ord.status,
          shippedAt: ord.shippedAt || existing.shippedAt,
          failReason: ord.failReason || null,
          failNote: ord.failNote,
          notes: ord.notes,
          shippingAddress: ord.shippingAddress,
          shippingCity: 'Hồ Chí Minh',
          totalAmount: ord.totalAmount,
          paymentMethod: ord.paymentMethod,
          paymentStatus: ord.paymentStatus
        }
      });
      console.log(`  🔄 Đã cập nhật đơn test: ${ord.orderId} (${ord.customerName})`);
    } else {
      await prisma.order.create({
        data: {
          orderId: ord.orderId,
          customerId: cust.customerId,
          assignedShipperId: targetShipper.id,
          subtotal: ord.totalAmount,
          discount: 0,
          shippingFee: 30000,
          totalAmount: ord.totalAmount,
          paymentMethod: ord.paymentMethod,
          paymentStatus: ord.paymentStatus,
          status: ord.status,
          shippedAt: ord.shippedAt || null,
          failReason: ord.failReason || null,
          failNote: ord.failNote,
          notes: ord.notes,
          shippingAddress: ord.shippingAddress,
          shippingCity: 'Hồ Chí Minh',
          deliveryRegion: ord.deliveryRegion,
          ...(sampleProduct ? {
            items: {
              create: [
                {
                  orderItemId: `${ord.orderId}-ITEM-1`,
                  productId: sampleProduct.productId,
                  name: sampleProduct.name || 'Linh Kiện Test Demo',
                  sku: sampleProduct.sku || 'SKU-TEST',
                  quantity: 1,
                  price: ord.totalAmount,
                  originalPrice: ord.totalAmount,
                  totalPrice: ord.totalAmount
                }
              ]
            }
          } : {})
        }
      });
      console.log(`  ✅ Đã tạo mới đơn test: ${ord.orderId} (${ord.customerName})`);
    }
  }

  console.log('\n🎉 Hoàn tất tạo dữ liệu test! Hãy đăng nhập tài khoản Shipper hoặc vào /admin/delivery để trải nghiệm.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
