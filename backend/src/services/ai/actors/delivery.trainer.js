/**
 * DELIVERY TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO NHÂN VIÊN GIAO HÀNG (SHIPPER)
 * Thiết kế chuẩn hóa theo Giai đoạn 1: Intent Catalog + Parameterized Prisma Handlers
 */

const BaseActorTrainer = require('./BaseActorTrainer');
const { getStartOfMonth, formatVND } = require('../utils/dateHelper');

const deliveryTrainer = new BaseActorTrainer({
  role: 'DELIVERY',
  name: 'Nhân viên Giao hàng (Shipper)',
  systemPrompt: `BẠN LÀ TRỢ LÝ ĐỒNG HÀNH CHUYÊN BIỆT CHO NHÂN VIÊN GIAO HÀNG (SHIPPER) AETHERPC:
- PHONG CÁCH: Gãy gọn, nhanh chóng, trực diện. Shipper đang di chuyển ngoài đường nên KHÔNG trả lời dài dòng.
- THÔNG TIN ƯU TIÊN:
  1. 📍 ĐỊA CHỈ GIAO HÀNG (Kèm ghi chú chỉ đường nếu có).
  2. 📞 SỐ ĐIỆN THOẠI KHÁCH HÀNG (để bấm gọi ngay).
  3. 💰 TIỀN THU HỘ COD (Đã thanh toán hay cần thu bao nhiêu tiền mặt).
- AN TOÀN HÀNG HÓA: Linh kiện PC và case kính rất dễ vỡ, luôn nhắc shipper giữ thẳng đứng thùng máy.`
});

// ============================================================================
// 1. NHÓM KỸ NĂNG TRUY VẤN DỮ LIỆU PRISMA (TYPE-SAFE HANDLERS)
// ============================================================================

// Kỹ năng 1: Đơn hàng cần giao hôm nay
deliveryTrainer.addSkill({
  id: 'ASSIGNED_ORDERS_TODAY',
  title: 'Tra cứu đơn hàng cần giao hôm nay',
  description: 'Lấy danh sách các đơn hàng đang phân công cho chính shipper',
  type: 'PRISMA_QUERY',
  examples: [
    'hôm nay tôi có bao nhiêu đơn cần giao?',
    'hôm nay tôi có bao nhiêu đơn cần giao',
    'danh sách đơn của tôi hôm nay',
    'tôi đang có những đơn nào',
    'đơn cần ship hôm nay',
    'hôm nay giao mấy đơn',
    'nhiệm vụ giao hàng hôm nay của tôi'
  ],
  patterns: [
    /(hôm nay.*(giao|ship|đơn)|cần giao hôm nay|đang giao|đang ship|phân công.*giao|nhiệm vụ.*giao)/i
  ],
  keywords: ['đơn', 'giao'],
  allowedRoles: ['DELIVERY', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params, user) => {
    const shipperId = Number(user.id || params.userId || 0);
    return await prisma.order.findMany({
      where: {
        assignedShipperId: shipperId,
        status: { in: ['CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED'] }
      },
      select: {
        orderId: true,
        shippingAddress: true,
        customer: { select: { phone: true, name: true } },
        totalAmount: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
  },
  template: (orders) => {
    if (!orders || orders.length === 0) {
      return '🛵 **Hôm nay bạn hiện không có đơn hàng nào cần giao.** Chúc bạn một ngày làm việc thuận lợi!';
    }
    let res = `🛵 **HÔM NAY BẠN ĐANG CÓ ${orders.length} ĐƠN CẦN GIAO:**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}** - ${formatVND(o.totalAmount)} (${o.paymentMethod === 'COD' ? '💵 Thu COD' : '💳 Đã TT'})\n`;
      res += `   📍 Địa chỉ: ${o.shippingAddress}\n`;
      res += `   📞 SĐT khách: ${o.customer?.phone || 'Chưa cập nhật'}\n`;
      res += `   Trạng thái: \`${o.status}\`\n\n`;
    });
    return res.trim();
  },
  sql: (userId) => `SELECT order_id, shipping_address, shipping_phone, total_amount, payment_method, payment_status, status FROM orders WHERE assigned_shipper_id = ${userId || ':userId'} AND status IN ('CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED') ORDER BY created_at ASC;`
});

// Kỹ năng 2: Lọc các đơn cần thu tiền mặt COD
deliveryTrainer.addSkill({
  id: 'COD_ORDERS_TO_COLLECT',
  title: 'Tra cứu các đơn cần thu tiền mặt COD',
  description: 'Lọc các đơn hàng chưa thanh toán cần thu tiền mặt khi giao',
  type: 'PRISMA_QUERY',
  examples: [
    'đơn nào của tôi cần thu tiền cod?',
    'đơn nào của tôi cần thu tiền cod',
    'thu cod bao nhiêu tiền',
    'những đơn nào phải thu tiền mặt',
    'hôm nay cần thu hộ bao nhiêu tiền',
    'danh sách đơn thu tiền tận nơi'
  ],
  patterns: [
    /(thu hộ|tiền cod|thu cod|tiền mặt|thu bao nhiêu)/i
  ],
  keywords: ['cod'],
  allowedRoles: ['DELIVERY', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params, user) => {
    const shipperId = Number(user.id || params.userId || 0);
    return await prisma.order.findMany({
      where: {
        assignedShipperId: shipperId,
        paymentMethod: 'COD',
        paymentStatus: { not: 'PAID' },
        status: { in: ['READY_TO_SHIP', 'SHIPPED'] }
      },
      select: {
        orderId: true,
        shippingAddress: true,
        customer: { select: { phone: true, name: true } },
        totalAmount: true,
        paymentStatus: true
      },
      orderBy: { createdAt: 'asc' }
    });
  },
  template: (orders) => {
    if (!orders || orders.length === 0) {
      return '✅ **Không có đơn nào cần thu tiền mặt COD.** Các đơn của bạn đều đã thanh toán trước hoặc chưa sẵn sàng ship!';
    }
    const totalCod = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    let res = `💵 **BẠN CÓ ${orders.length} ĐƠN CẦN THU TIỀN COD (TỔNG CỘNG: ${formatVND(totalCod)}):**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}**: Cần thu **${formatVND(o.totalAmount)}** tiền mặt\n`;
      res += `   📍 Địa chỉ: ${o.shippingAddress} (📞 ${o.customer?.phone || 'Chưa có SĐT'})\n`;
    });
    return res.trim();
  },
  sql: (userId) => `SELECT order_id, shipping_address, shipping_phone, total_amount, payment_status FROM orders WHERE assigned_shipper_id = ${userId || ':userId'} AND payment_method = 'COD' AND payment_status != 'PAID' AND status IN ('READY_TO_SHIP', 'SHIPPED') ORDER BY created_at ASC;`
});

// Kỹ năng 3: Hiệu suất giao hàng tháng này
deliveryTrainer.addSkill({
  id: 'MONTHLY_PERFORMANCE',
  title: 'Hiệu suất số đơn giao thành công trong tháng',
  description: 'Thống kê tổng số đơn giao thành công và giá trị đã giao của shipper',
  type: 'PRISMA_QUERY',
  examples: [
    'tháng này tôi đã giao thành công được bao nhiêu đơn?',
    'tháng này tôi đã giao thành công được bao nhiêu đơn',
    'hiệu suất giao hàng tháng này của tôi',
    'tháng này tôi hoàn thành được mấy đơn',
    'tổng kết số đơn đã giao trong tháng'
  ],
  patterns: [
    /(tháng này.*(thành công|hoàn thành|giao)|hiệu suất giao)/i
  ],
  keywords: ['tháng này'],
  allowedRoles: ['DELIVERY', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params, user) => {
    const shipperId = Number(user.id || params.userId || 0);
    const startMonth = getStartOfMonth();
    const result = await prisma.order.aggregate({
      where: {
        assignedShipperId: shipperId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        deliveredAt: { gte: startMonth }
      },
      _count: { orderId: true },
      _sum: { totalAmount: true }
    });
    return {
      deliveredCount: result._count.orderId || 0,
      totalRevenue: Number(result._sum.totalAmount || 0)
    };
  },
  template: (res) => {
    return `🏆 **HIỆU SUẤT GIAO HÀNG THÁNG NÀY CỦA BẠN:**\n` +
           `- Số đơn giao thành công: **${res.deliveredCount} đơn**\n` +
           `- Tổng giá trị hàng đã giao: **${formatVND(res.totalRevenue)}**\n` +
           `Cố gắng hoàn thành chỉ tiêu để nhận thưởng chuyên cần nhé!`;
  },
  sql: (userId) => `SELECT COUNT(*) AS so_don_thanh_cong, COALESCE(SUM(total_amount), 0) AS tong_gia_tri_giao FROM orders WHERE assigned_shipper_id = ${userId || ':userId'} AND status IN ('DELIVERED', 'COMPLETED') AND delivered_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`
});

// Kỹ năng 4: Đơn hàng bị thất bại, hoàn hàng
deliveryTrainer.addSkill({
  id: 'FAILED_OR_RETURNED_ORDERS',
  title: 'Các đơn giao không thành công hoặc chuyển hoàn',
  description: 'Kiểm tra đơn bị bom hoặc khách từ chối nhận',
  type: 'PRISMA_QUERY',
  examples: [
    'có đơn nào của tôi bị bom không',
    'các đơn chuyển hoàn của tôi',
    'đơn giao không thành công gần đây',
    'đơn khách từ chối nhận'
  ],
  patterns: [
    /(bị bom|chuyển hoàn|giao xịt|không nhận hàng|giao thất bại)/i
  ],
  allowedRoles: ['DELIVERY', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params, user) => {
    const shipperId = Number(user.id || params.userId || 0);
    return await prisma.order.findMany({
      where: {
        assignedShipperId: shipperId,
        status: { in: ['FAILED_DELIVERY', 'RETURNING_TO_WAREHOUSE', 'CANCELLED'] },
        updatedAt: { gte: getStartOfMonth() }
      },
      select: {
        orderId: true,
        shippingAddress: true,
        customer: { select: { phone: true, name: true } },
        status: true,
        failReason: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    });
  },
  template: (orders) => {
    if (!orders || orders.length === 0) {
      return '🎉 **Tuyệt vời! Không có đơn nào bị bom hoặc chuyển hoàn trong tháng này.**';
    }
    let res = `⚠️ **DANH SÁCH ${orders.length} ĐƠN HOÀN / GIAO THẤT BẠI TRONG THÁNG:**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}** - Trạng thái: \`${o.status}\`\n`;
      res += `   Lý do: ${o.failReason || 'Khách hẹn lại / Không nghe máy'}\n`;
      res += `   Địa chỉ: ${o.shippingAddress}\n`;
    });
    return res.trim();
  },
  sql: (userId) => `SELECT order_id, shipping_address, shipping_phone, status, updated_at FROM orders WHERE assigned_shipper_id = ${userId || ':userId'} AND status IN ('FAILED_DELIVERY', 'RETURNING_TO_WAREHOUSE', 'CANCELLED') AND updated_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') ORDER BY updated_at DESC;`
});

// ============================================================================
// 2. NHÓM KỸ NĂNG QUY TRÌNH & TRI THỨC VĂN BẢN (KNOWLEDGE SOP)
// ============================================================================

// Kỹ năng 5: Tiêu chuẩn chụp ảnh bằng chứng giao hàng (POD)
deliveryTrainer.addSkill({
  id: 'SOP_POD_RULES',
  title: 'Quy chuẩn chụp ảnh bằng chứng giao hàng (POD)',
  description: 'Hướng dẫn góc chụp và yêu cầu bắt buộc của ảnh POD',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy định chụp ảnh pod như thế nào',
    'cách chụp ảnh xác nhận đã giao hàng',
    'chụp pod cần chụp những gì',
    'khách không cho chụp mặt thì làm sao'
  ],
  patterns: [
    /(chụp ảnh pod|chụp pod|bằng chứng giao hàng|ảnh giao hàng|chụp mặt)/i
  ],
  sop: `📸 **QUY ĐỊNH CHỤP ẢNH BẰNG CHỨNG GIAO HÀNG (POD):**
1. **Góc chụp kiện hàng:** Chụp rõ ràng kiện hàng nguyên vẹn đặt tại địa chỉ khách (thấy rõ số nhà/cửa hàng nếu có).
2. **Tem niêm phong:** Chụp rõ góc tem bưu kiện AetherPC còn nguyên vẹn, không rách vỡ tem niêm phong.
3. **Người nhận:** Nếu khách cho phép, chụp ảnh khách cầm gói hàng. Nếu khách từ chối chụp mặt: Chụp tay nhận hàng hoặc gói hàng đặt trước cửa có sự chứng kiến của khách.
4. **Tải lên:** Bắt buộc bấm nút **[Chụp ảnh POD]** trên ứng dụng giao hàng trước khi ấn [Giao Thành Công].`
});

// Kỹ năng 6: Quy trình nộp tiền mặt COD về kế toán
deliveryTrainer.addSkill({
  id: 'SOP_COD_DEPOSIT',
  title: 'Quy trình nộp tiền mặt COD cho kế toán',
  description: 'Khung giờ nộp tiền COD và cú pháp chuyển khoản nộp COD trễ',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'shipper nộp tiền cod trước mấy giờ',
    'quy định nộp tiền mặt cod hàng ngày',
    'về trễ thì nộp tiền cod thế nào',
    'số tài khoản nộp tiền cod của công ty'
  ],
  patterns: [
    /(nộp tiền cod|mấy giờ.*nộp tiền|nộp cod.*trễ|nộp tiền mặt)/i
  ],
  sop: `💵 **QUY ĐỊNH NỘP TIỀN COD HÀNG NGÀY:**
1. **Khung giờ:** Toàn bộ tiền mặt thu từ khách (COD) phải được bàn giao về Phòng Kế toán trước **18h00 cùng ngày**.
2. **Trường hợp đi giao về trễ:** Shipper quét mã VietQR thụ hưởng của công ty để nộp tiền tài khoản kèm cú pháp: \`NOP COD - [Tên Shipper] - [Mã các đơn]\`.
3. Kế toán sẽ đối soát và bấm xác nhận hoàn tất nộp COD trên phần mềm quản trị.`
});

// Kỹ năng 7: Xử lý sự cố móp hộp / khách từ chối nhận
deliveryTrainer.addSkill({
  id: 'SOP_DAMAGED_BOX',
  title: 'Xử lý khi kiện hàng bị móp hộp hoặc khách từ chối nhận',
  description: 'Quy trình xử lý ngoại quan và đồng kiểm với khách',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'khách từ chối nhận hàng do móp hộp thì xử lý thế nào',
    'thùng máy bị móp kính có cho khách xem không',
    'khách muốn mở hộp xem hàng trước khi nhận',
    'vỡ kính khi vận chuyển thì làm sao'
  ],
  patterns: [
    /(móp hộp|từ chối nhận|bể kính|vỡ kính|đồng kiểm|mở hộp)/i
  ],
  sop: `⚠️ **XỬ LÝ KHI KHÁCH KHIẾU NẠI MÓP HỘP HOẶC TỪ CHỐI NHẬN:**
1. **Lịch sự giải thích:** Thùng máy tính có đệm xốp Instapak dày bảo vệ linh kiện bên trong an toàn.
2. **Mời khách đồng kiểm:** Khách được quyền kiểm tra ngoại quan (vỏ case không móp méo, mặt kính cường lực không nứt vỡ).
3. **Nếu có bể vỡ thật:** Chụp ảnh hiện trạng 3 góc $\rightarrow$ Báo ngay về Hotline Trưởng Kho $\rightarrow$ Cập nhật trạng thái đơn thành **FAILED_DELIVERY** kèm lý do "Bể vỡ vận chuyển".`
});

module.exports = deliveryTrainer;
