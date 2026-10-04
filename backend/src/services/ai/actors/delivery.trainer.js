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
    'nhiệm vụ giao hàng hôm nay của tôi',
    'xem các đơn phân công cho tôi',
    'hôm nay phải chạy những đơn nào',
    'danh sách kiện hàng cần phát trong ngày'
  ],
  patterns: [
    /(hôm nay.*(giao|ship|đơn)|cần giao hôm nay|đang giao|đang ship|phân công.*giao|nhiệm vụ.*giao|chạy.*đơn|cần phát)/i
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
      return '🛵 **Hôm nay bạn hiện không có đơn hàng nào cần giao.** Chúc bạn một ngày làm việc an toàn!';
    }
    let res = `🛵 **HÔM NAY BẠN ĐANG CÓ ${orders.length} ĐƠN CẦN GIAO:**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}** - ${formatVND(o.totalAmount)} (${o.paymentMethod === 'COD' ? '💵 Thu COD' : '💳 Đã TT'})\n`;
      res += `   📍 Địa chỉ: ${o.shippingAddress}\n`;
      res += `   📞 SĐT khách: ${o.customer?.phone || 'Chưa cập nhật'} (${o.customer?.name || 'Khách'})\n`;
      res += `   Trạng thái: \`${o.status}\`\n\n`;
    });
    return res.trim();
  },
  sql: (userId) => `SELECT order_id, shipping_address, total_amount, payment_method, payment_status, status FROM orders WHERE assigned_shipper_id = ${userId || ':userId'} AND status IN ('CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED') ORDER BY created_at ASC;`
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
    'danh sách đơn thu tiền tận nơi',
    'tổng tiền cod phải cầm về hôm nay',
    'đơn nào chưa trả tiền cần thu tay'
  ],
  patterns: [
    /(thu hộ|tiền cod|thu cod|tiền mặt|thu bao nhiêu|thu tận nơi)/i
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
      return '✅ **Không có đơn nào cần thu tiền mặt COD.** Các đơn của bạn đều đã thanh toán trước qua chuyển khoản!';
    }
    const totalCod = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    let res = `💵 **BẠN CÓ ${orders.length} ĐƠN CẦN THU TIỀN COD (TỔNG CỘNG: ${formatVND(totalCod)}):**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}**: Cần thu **${formatVND(o.totalAmount)}** tiền mặt\n`;
      res += `   📍 Địa chỉ: ${o.shippingAddress} (📞 ${o.customer?.phone || 'Chưa có SĐT'})\n`;
    });
    return res.trim();
  },
  sql: (userId) => `SELECT order_id, shipping_address, total_amount, payment_status FROM orders WHERE assigned_shipper_id = ${userId || ':userId'} AND payment_method = 'COD' AND payment_status != 'PAID' AND status IN ('READY_TO_SHIP', 'SHIPPED') ORDER BY created_at ASC;`
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
    'tổng kết số đơn đã giao trong tháng',
    'tỷ lệ giao hàng tháng này của tôi',
    'tổng số kiện hàng tôi đã giao xong tháng này'
  ],
  patterns: [
    /(tháng này.*(thành công|hoàn thành|giao)|hiệu suất giao|giao xong tháng này)/i
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

// Kỹ năng 4: Ước tính hoa hồng & tiền công giao hàng tháng này
deliveryTrainer.addSkill({
  id: 'SHIPPER_ESTIMATED_COMMISSION',
  title: 'Ước tính hoa hồng và tiền thưởng giao hàng tháng này',
  description: 'Tính tiền công giao hàng tạm tính (20.000 VNĐ / đơn hoàn tất)',
  type: 'PRISMA_QUERY',
  examples: [
    'tháng này tôi được bao nhiêu tiền hoa hồng ship hàng?',
    'tiền thưởng giao hàng tháng này của tôi',
    'ước tính hoa hồng shipper tháng này',
    'tôi nhận được bao nhiêu tiền ship tháng này',
    'tính tiền công giao hàng của tôi',
    'hoa hồng giao hàng tạm tính'
  ],
  patterns: [
    /(hoa hồng|tiền thưởng|tiền công|tiền ship.*nhận|tạm tính).*(giao hàng|shipper|ship)/i
  ],
  allowedRoles: ['DELIVERY', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params, user) => {
    const shipperId = Number(user.id || params.userId || 0);
    const startMonth = getStartOfMonth();
    const count = await prisma.order.count({
      where: {
        assignedShipperId: shipperId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        deliveredAt: { gte: startMonth }
      }
    });
    const feePerOrder = 20000; // 20k VNĐ / đơn
    return {
      count,
      feePerOrder,
      estimatedTotal: count * feePerOrder
    };
  },
  template: (data) => {
    return `💰 **HOA HỒNG GIAO HÀNG TẠM TÍNH (THÁNG NÀY):**\n\n` +
           `- Số đơn hoàn thành: **${data.count} đơn**\n` +
           `- Đơn giá hoa hồng: **${formatVND(data.feePerOrder)} / đơn**\n` +
           `- 💵 **Tổng tiền công tạm tính: ${formatVND(data.estimatedTotal)}**\n\n` +
           `Số tiền sẽ được cộng trực tiếp vào kỳ lương cuối tháng của bạn.`;
  }
});

// Kỹ năng 5: Xem lại các đơn vừa giao thành công gần đây
deliveryTrainer.addSkill({
  id: 'DELIVERY_HISTORY_RECENT',
  title: 'Xem lại các đơn hàng vừa giao thành công gần nhất',
  description: 'Tra cứu 5 đơn hàng vừa hoàn tất giao nhận',
  type: 'PRISMA_QUERY',
  examples: [
    'các đơn hàng tôi vừa giao thành công gần đây',
    'xem lại các đơn đã giao xong',
    'lịch sử đơn hàng tôi vừa giao',
    '5 đơn vừa ship thành công',
    'vừa giao xong đơn nào'
  ],
  patterns: [
    /(vừa giao thành công|đã giao xong|lịch sử.*đã giao|vừa ship)/i
  ],
  allowedRoles: ['DELIVERY', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params, user) => {
    const shipperId = Number(user.id || params.userId || 0);
    return await prisma.order.findMany({
      where: {
        assignedShipperId: shipperId,
        status: { in: ['DELIVERED', 'COMPLETED'] }
      },
      select: {
        orderId: true,
        shippingAddress: true,
        totalAmount: true,
        deliveredAt: true
      },
      orderBy: { deliveredAt: 'desc' },
      take: 5
    });
  },
  template: (orders) => {
    if (!orders || orders.length === 0) return 'Bạn chưa có lịch sử đơn giao thành công nào gần đây.';
    let res = `📋 **5 ĐƠN HÀNG VỪA GIAO THÀNH CÔNG GẦN ĐÂY:**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}** - ${formatVND(o.totalAmount)}\n`;
      res += `   📍 Nơi giao: ${o.shippingAddress}\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 6: Đơn hàng bị thất bại, hoàn hàng
deliveryTrainer.addSkill({
  id: 'FAILED_OR_RETURNED_ORDERS',
  title: 'Các đơn giao không thành công hoặc chuyển hoàn',
  description: 'Kiểm tra đơn bị bom hoặc khách từ chối nhận',
  type: 'PRISMA_QUERY',
  examples: [
    'có đơn nào của tôi bị bom không',
    'các đơn chuyển hoàn của tôi',
    'đơn giao không thành công gần đây',
    'đơn khách từ chối nhận',
    'danh sách đơn giao xịt trong tháng'
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
  sql: (userId) => `SELECT order_id, shipping_address, status, updated_at FROM orders WHERE assigned_shipper_id = ${userId || ':userId'} AND status IN ('FAILED_DELIVERY', 'RETURNING_TO_WAREHOUSE', 'CANCELLED') AND updated_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') ORDER BY updated_at DESC;`
});

// ============================================================================
// 2. NHÓM KỸ NĂNG QUY TRÌNH & TRI THỨC VĂN BẢN (KNOWLEDGE SOP)
// ============================================================================

// Kỹ năng 7: Tiêu chuẩn chụp ảnh bằng chứng giao hàng (POD)
deliveryTrainer.addSkill({
  id: 'SOP_POD_RULES',
  title: 'Quy chuẩn chụp ảnh bằng chứng giao hàng (POD)',
  description: 'Hướng dẫn góc chụp và yêu cầu bắt buộc của ảnh POD',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy định chụp ảnh pod như thế nào',
    'cách chụp ảnh xác nhận đã giao hàng',
    'chụp pod cần chụp những gì',
    'khách không cho chụp mặt thì làm sao',
    'hướng dẫn chụp hình chứng minh giao thành công'
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

// Kỹ năng 8: Quy trình nộp tiền mặt COD về kế toán
deliveryTrainer.addSkill({
  id: 'SOP_COD_DEPOSIT',
  title: 'Quy trình nộp tiền mặt COD cho kế toán',
  description: 'Khung giờ nộp tiền COD và cú pháp chuyển khoản nộp COD trễ',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'shipper nộp tiền cod trước mấy giờ',
    'quy định nộp tiền mặt cod hàng ngày',
    'về trễ thì nộp tiền cod thế nào',
    'số tài khoản nộp tiền cod của công ty',
    'cú pháp chuyển tiền cod cho thủ quỹ'
  ],
  patterns: [
    /(nộp tiền cod|mấy giờ.*nộp tiền|nộp cod.*trễ|nộp tiền mặt)/i
  ],
  sop: `💵 **QUY ĐỊNH NỘP TIỀN COD HÀNG NGÀY:**
1. **Khung giờ:** Toàn bộ tiền mặt thu từ khách (COD) phải được bàn giao về Phòng Kế toán trước **18h00 cùng ngày**.
2. **Trường hợp đi giao về trễ:** Shipper quét mã VietQR thụ hưởng của công ty để nộp tiền tài khoản kèm cú pháp: \`NOP COD - [Tên Shipper] - [Mã các đơn]\`.
3. Kế toán sẽ đối soát và bấm xác nhận hoàn tất nộp COD trên phần mềm quản trị.`
});

// Kỹ năng 9: Quy trình hẹn giao lại và xử lý khách không nghe máy
deliveryTrainer.addSkill({
  id: 'SOP_REDELIVERY_POLICY',
  title: 'Quy trình hẹn giao lại và xử lý khách không nghe máy',
  description: 'Quy chuẩn gọi tối thiểu 3 cuộc và cập nhật hẹn giao lại',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'khách không nghe máy thì xử lý thế nào',
    'gọi khách 3 cuộc không được thì làm sao',
    'quy định hẹn giao lại lần 2 lần 3',
    'khách hẹn giao vào ngày mai thì bấm nút gì'
  ],
  patterns: [
    /(không nghe máy|hẹn giao lại|gọi không được|hẹn ngày mai)/i
  ],
  sop: `📞 **QUY TRÌNH XỬ LÝ KHÁCH HÀNG KHÔNG LIÊN LẠC ĐƯỢC:**
1. **Số lần gọi:** Gọi tối thiểu 3 cuộc cách nhau 15 phút (cuộc 1: lúc tới nơi, cuộc 2: sau 10p, cuộc 3: sau 20p).
2. **Nhắn tin SMS/Zalo:** Gửi tin nhắn mẫu: "AetherPC đang giao đơn hàng #... cho quý khách nhưng chưa liên lạc được, vui lòng liên hệ lại số...".
3. **Cập nhật ứng dụng:** Chọn trạng thái **[Giao Thất Bại - Hẹn Lại]** $\rightarrow$ Chọn lý do "Khách không nghe máy" để hệ thống tự động xếp lịch giao vào ngày mai.`
});

// Kỹ năng 10: Xử lý sự cố móp hộp / khách từ chối nhận
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

// Kỹ năng 11: Đơn hàng đã thanh toán trước (Không cần thu tiền COD)
deliveryTrainer.addSkill({
  id: 'PREPAID_ORDERS_TODAY',
  title: 'Đơn hàng đã thanh toán trước (Không cần thu tiền mặt)',
  description: 'Lọc các đơn hàng khách đã chuyển khoản 100%, shipper chỉ cần giao và chụp POD',
  type: 'PRISMA_QUERY',
  examples: [
    'đơn nào của tôi đã thanh toán trước rồi?',
    'những đơn không cần thu tiền',
    'đơn khách chuyển khoản rồi',
    'hôm nay có bao nhiêu đơn đã trả tiền trước',
    'danh sách đơn đã trả đủ tiền chỉ việc giao'
  ],
  patterns: [
    /(thanh toán trước|không cần thu tiền|chuyển khoản rồi|đã trả tiền|chỉ việc giao)/i
  ],
  allowedRoles: ['DELIVERY', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params, user) => {
    const shipperId = Number(user.id || params.userId || 0);
    return await prisma.order.findMany({
      where: {
        assignedShipperId: shipperId,
        paymentStatus: 'PAID',
        status: { in: ['READY_TO_SHIP', 'SHIPPED'] }
      },
      select: {
        orderId: true,
        shippingAddress: true,
        customer: { select: { phone: true, name: true } },
        totalAmount: true
      },
      orderBy: { createdAt: 'asc' }
    });
  },
  template: (orders) => {
    if (!orders || orders.length === 0) {
      return 'Hiện không có đơn nào thanh toán trước, các đơn đang chờ của bạn đều là đơn COD thu tiền mặt.';
    }
    let res = `💳 **CÓ ${orders.length} ĐƠN ĐÃ THANH TOÁN TRƯỚC (KHÔNG THU TIỀN MẶT):**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}** - Trị giá: ${formatVND(o.totalAmount)} (ĐÃ TRẢ ĐỦ)\n`;
      res += `   📍 Địa chỉ: ${o.shippingAddress} (📞 ${o.customer?.phone || 'Chưa có SĐT'})\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 12: Thông tin và địa chỉ kho lấy hàng xuất phát
deliveryTrainer.addSkill({
  id: 'WAREHOUSE_PICKUP_LOCATION',
  title: 'Thông tin và địa chỉ kho lấy hàng xuất phát',
  description: 'Tra cứu địa chỉ các kho hàng trung tâm của AetherPC để shipper qua lấy hàng',
  type: 'PRISMA_QUERY',
  examples: [
    'kho lấy hàng ở địa chỉ nào?',
    'tôi cần đến đâu để nhận kiện hàng',
    'địa chỉ kho trung tâm xuất hàng',
    'kho chính aetherpc ở đâu',
    'địa điểm lấy hàng của shipper'
  ],
  patterns: [
    /(kho lấy hàng|địa chỉ kho|đến đâu.*nhận hàng|kho chính.*ở đâu|địa điểm lấy hàng)/i
  ],
  allowedRoles: ['DELIVERY', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.warehouse.findMany({
      where: { isActive: true },
      select: { name: true, address: true }
    });
  },
  template: (warehouses) => {
    if (!warehouses || warehouses.length === 0) return 'Chưa có thông tin kho hoạt động.';
    let res = `🏢 **ĐỊA ĐIỂM KHO TRUNG TÂM XUẤT HÀNG AETHERPC:**\n\n`;
    warehouses.forEach((w, idx) => {
      res += `${idx + 1}. **${w.name}**\n`;
      res += `   📍 Địa chỉ: ${w.address || 'Trung tâm công nghệ AetherPC'}\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 13: Quy định bàn giao hàng cho người nhận hộ
deliveryTrainer.addSkill({
  id: 'SOP_THIRD_PARTY_RECIPIENT',
  title: 'Quy định bàn giao hàng cho người nhận hộ',
  description: 'Hướng dẫn giao cho bảo vệ chung cư, đồng nghiệp, người thân nhận thay',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'khách nhờ bảo vệ chung cư nhận hộ thì làm sao?',
    'giao cho đồng nghiệp nhận thay có được không',
    'người nhà nhận hộ gói hàng cần thủ tục gì',
    'quy định giao hàng cho người nhận thay'
  ],
  patterns: [
    /(nhận hộ|nhận thay|bảo vệ chung cư|đồng nghiệp nhận|người nhà nhận)/i
  ],
  sop: `🤝 **QUY ĐỊNH BÀN GIAO HÀNG CHO NGƯỜI NHẬN THAY:**
1. **Xác nhận từ chính chủ:** Bắt buộc gọi điện thoại trực tiếp cho số khách đặt hàng để ghi âm hoặc có tin nhắn xác nhận: "Đồng ý cho người nhận thay [Tên / Quan hệ]".
2. **Đối với đơn COD:** Người nhận thay bắt buộc thanh toán đủ 100% tiền mặt hoặc quét mã VietQR trước khi shipper bàn giao kiện hàng.
3. **Ảnh POD:** Chụp ảnh người nhận hộ cầm kiện hàng kèm ghi chú trong app: \`Nhận hộ bởi: [Tên + SĐT người nhận hộ]\`.`
});

// Kỹ năng 14: Thống kê các đơn giao không thành công hoặc bị hoàn trả
deliveryTrainer.addSkill({
  id: 'FAILED_DELIVERY_REASONS',
  title: 'Thống kê danh sách đơn giao không thành công hoặc bị hoàn trả',
  description: 'Theo dõi các đơn hàng bị khách từ chối, không liên lạc được hoặc yêu cầu hoàn trả',
  type: 'PRISMA_QUERY',
  examples: [
    'lý do các đơn giao thất bại gần đây',
    'những đơn nào bị khách từ chối nhận',
    'danh sách đơn bị hoàn trả',
    'các đơn ship không thành công',
    'đơn hàng bị boom hoặc hủy tại chỗ'
  ],
  patterns: [
    /(giao thất bại|từ chối nhận|hoàn trả.*đơn|ship không thành công|bị boom|hủy tại chỗ)/i
  ],
  allowedRoles: ['DELIVERY', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, _params, user) => {
    const shipperId = Number(user?.id || 0);
    const isShipper = user?.role === 'DELIVERY';

    return await prisma.order.findMany({
      where: {
        status: { in: ['RETURNED', 'CANCELLED'] },
        ...(isShipper && shipperId ? { assignedShipperId: shipperId } : {})
      },
      select: {
        orderId: true,
        totalAmount: true,
        status: true,
        shippingAddress: true,
        customer: { select: { name: true, phone: true } },
        failReason: true,
        failNote: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 6
    });
  },
  template: (orders) => {
    if (!orders || orders.length === 0) {
      return '🎉 **Tuyệt vời! Không có đơn hàng nào bị hủy hoặc hoàn trả gần đây.**';
    }
    let res = `⚠️ **DANH SÁCH CÁC ĐƠN HÀNG GIAO THẤT BẠI / HOÀN TRẢ GẦN NHẤT:**\n\n`;
    orders.forEach((o, idx) => {
      const reasonStr = o.failReason ? ` | Lý do: ${o.failReason}` : '';
      res += `${idx + 1}. **Đơn #${o.orderId}** - ${formatVND(o.totalAmount)} (Trạng thái: \`${o.status}\`${reasonStr})\n`;
      res += `   Khách: ${o.customer?.name || 'Khách'} (${o.customer?.phone || 'Ẩn'}) | Địa chỉ: ${o.shippingAddress}\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 15: Quy định giao hàng linh kiện an toàn khi trời mưa bão
deliveryTrainer.addSkill({
  id: 'SOP_INCLEMENT_WEATHER_DELIVERY',
  title: 'Quy định giao hàng linh kiện điện tử an toàn trong thời tiết mưa bão',
  description: 'Biện pháp bảo quản thùng PC và linh kiện tránh bị ẩm ướt nước mưa',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy định giao hàng khi trời mưa to bão gió',
    'làm sao bảo vệ linh kiện khi đi giao trời mưa',
    'có được hoãn giao hàng khi thời tiết xấu không',
    'hướng dẫn bọc hàng chống nước khi đi ship'
  ],
  patterns: [
    /(trời mưa|mưa bão|thời tiết xấu|chống nước|bọc kiện hàng)/i
  ],
  sop: `🌧️ **QUY ĐỊNH GIAO HÀNG LINH KIỆN ĐIỆN TỬ TRỜI MƯA BÃO:**
1. **Bảo quản chống nước:** Toàn bộ thùng máy PC và hộp linh kiện (VGA, CPU, Main) bắt buộc bọc màng co nilon hoặc trùm áo mưa bọc hàng chuyên dụng trước khi rời khỏi kho.
2. **Quyền hoãn giao:** Nếu mưa ngập sâu hoặc giông bão sấm sét cấp 6 trở lên: Shipper được quyền chủ động liên hệ khách hàng dời lịch hẹn giao sang thời điểm tạnh mưa an toàn.
3. **Nghiêm cấm:** Tuyệt đối không để kiện hàng linh kiện tiếp xúc trực tiếp với nước mưa trên xe máy; mọi rủi ro chập cháy bo mạch do ngấm nước shipper chịu trách nhiệm theo biên chế bồi thường.`
});

// Kỹ năng 16: Tra cứu tiến độ và người giao của đơn hàng cụ thể
deliveryTrainer.addSkill({
  id: 'DELIVERY_TRACK_ORDER',
  title: 'Tra cứu tiến độ và thông tin giao nhận đơn hàng cụ thể',
  description: 'Kiểm tra trạng thái giao hàng, shipper phụ trách, tiền thu hộ COD của một đơn hàng',
  type: 'PRISMA_QUERY',
  examples: [
    'kiểm tra tiến độ đơn hàng DH-1002',
    'kiểm tra tiến độ đơn hàng',
    'kiểm tra đơn hàng DH-1002',
    'đơn hàng 1002 giao tới đâu rồi',
    'ai đang đi giao đơn này',
    'khách đã trả tiền chưa',
    'tiến độ giao hàng của đơn',
    'tra cứu trạng thái giao đơn hàng'
  ],
  patterns: [
    /(tiến độ đơn hàng|kiểm tra đơn|giao tới đâu|ai đang.*giao|khách.*trả tiền|trạng thái đơn hàng)/i
  ],
  allowedRoles: ['DELIVERY', 'SALES', 'WAREHOUSE', 'ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params) => {
    let orderId = Number(params?.orderId || 0);
    if (!orderId && params?.orderId) {
      const numMatch = String(params.orderId).match(/\d+/);
      if (numMatch) orderId = parseInt(numMatch[0], 10);
    }
    if (!orderId) return null;

    return await prisma.order.findUnique({
      where: { orderId },
      select: {
        orderId: true,
        trackingNumber: true,
        deliveryStatus: true,
        status: true,
        shippingAddress: true,
        paymentStatus: true,
        paymentMethod: true,
        totalAmount: true,
        customer: { select: { name: true, phone: true } },
        assignedShipper: { select: { fullName: true, phone: true } }
      }
    });
  },
  template: (order) => {
    if (!order) {
      return '⚠️ **Không tìm thấy thông tin đơn hàng này trong hệ thống.**';
    }
    const shipperInfo = order.assignedShipper
      ? `**${order.assignedShipper.fullName}** (📞 ${order.assignedShipper.phone || 'Chưa cập nhật'})`
      : '*Chưa phân công shipper*';
    const payStatus = order.paymentStatus === 'PAID' ? '✅ Đã thanh toán đủ' : '💵 Chưa thanh toán (Thu COD)';

    return `📦 **THÔNG TIN TIẾN ĐỘ ĐƠN HÀNG #${order.orderId}:**\n\n` +
           `- **Trạng thái:** \`${order.deliveryStatus || order.status}\`\n` +
           `- **Shipper phụ trách:** ${shipperInfo}\n` +
           `- **Thanh toán:** ${payStatus} (Tổng tiền: **${formatVND(order.totalAmount)}**)\n` +
           `- **Địa chỉ nhận:** ${order.shippingAddress || 'Nội thành'}\n` +
           `- **Khách hàng:** ${order.customer?.name || 'Khách'} (📞 ${order.customer?.phone || 'Chưa có SĐT'})`;
  }
});

module.exports = deliveryTrainer;


