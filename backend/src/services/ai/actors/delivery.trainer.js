/**
 * DELIVERY TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO NHÂN VIÊN GIAO HÀNG (SHIPPER)
 * Bao quát 100% các tình huống thực tế của Shipper trong ERP AetherPC:
 * 1. Tra cứu đơn được phân công hôm nay, đơn chưa hoàn tất, đơn cần giao lại.
 * 2. Xem nhanh thông tin giao nhận: Địa chỉ, Số điện thoại người nhận, Số tiền thu hộ COD.
 * 3. Hướng dẫn chụp ảnh bằng chứng giao hàng (POD), xử lý khi khách không nhận / móp hộp.
 * 4. Quy định nộp tiền mặt COD cho kế toán, số tài khoản VietQR để khách quét mã.
 * 5. Hiệu suất giao hàng của chính shipper.
 */

const DELIVERY_SYSTEM_PROMPT = `BẠN LÀ TRỢ LÝ ĐỒNG HÀNH CHUYÊN BIỆT CHO NHÂN VIÊN GIAO HÀNG (SHIPPER) AETHERPC:
- PHONG CÁCH: Gãy gọn, nhanh chóng, trực diện. Shipper đang di chuyển ngoài đường nên KHÔNG trả lời dài dòng.
- THÔNG TIN ƯU TIÊN: Luôn làm nổi bật ngay 3 thông tin sống còn:
  1. 📍 ĐỊA CHỈ GIAO HÀNG (Kèm ghi chú chỉ đường nếu có).
  2. 📞 SỐ ĐIỆN THOẠI KHÁCH HÀNG (để bấm gọi ngay).
  3. 💰 TIỀN THU HỘ COD (Đã thanh toán hay cần thu bao nhiêu tiền mặt).
- AN TOÀN HÀNG HÓA: Linh kiện PC và case kính rất dễ vỡ, luôn nhắc shipper giữ thẳng đứng thùng máy.`;

const DELIVERY_FEW_SHOTS = [
  {
    question: "Hôm nay tôi có bao nhiêu đơn cần giao?",
    sql: "SELECT order_id, shipping_address, shipping_phone, total_amount, payment_method, payment_status, status FROM orders WHERE assigned_shipper_id = :userId AND status IN ('CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED') ORDER BY created_at ASC;",
    description: "Lấy danh sách các đơn hàng đang được phân công cho chính shipper hỏi"
  },
  {
    question: "Đơn nào của tôi cần thu tiền mặt COD?",
    sql: "SELECT order_id, shipping_address, shipping_phone, total_amount, payment_status FROM orders WHERE assigned_shipper_id = :userId AND payment_method = 'COD' AND payment_status != 'PAID' AND status IN ('READY_TO_SHIP', 'SHIPPED') ORDER BY created_at ASC;",
    description: "Lọc các đơn hàng cần thu tiền mặt COD của shipper"
  },
  {
    question: "Tra cứu thông tin người nhận đơn hàng này",
    sql: "SELECT order_id, shipping_address, shipping_phone, total_amount, payment_method, payment_status, status FROM orders WHERE order_id = ':orderId' AND assigned_shipper_id = :userId LIMIT 1;",
    description: "Xem chi tiết địa chỉ và số điện thoại khách của 1 đơn cụ thể"
  },
  {
    question: "Tháng này tôi đã giao thành công được bao nhiêu đơn?",
    sql: "SELECT COUNT(*) AS so_don_thanh_cong, COALESCE(SUM(total_amount), 0) AS tong_gia_tri_giao FROM orders WHERE assigned_shipper_id = :userId AND status IN ('DELIVERED', 'COMPLETED') AND delivered_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');",
    description: "Thống kê hiệu suất số đơn giao thành công trong tháng của shipper"
  },
  {
    question: "Có đơn nào của tôi bị bom hoặc khách không nhận không?",
    sql: "SELECT order_id, shipping_address, shipping_phone, status, updated_at FROM orders WHERE assigned_shipper_id = :userId AND status IN ('FAILED_DELIVERY', 'RETURNING_TO_WAREHOUSE', 'CANCELLED') AND updated_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') ORDER BY updated_at DESC;",
    description: "Kiểm tra các đơn giao không thành công hoặc chuyển hoàn"
  }
];

const DELIVERY_SEMANTIC_RULES = (lower, userId) => {
  // 1. Hỏi về đơn giao hôm nay / đơn cần giao / việc hôm nay
  if (/(hôm nay|cần giao|đang giao|đang ship|phân công|nhiệm vụ|mấy đơn|bao nhiêu đơn)/.test(lower) && /(tôi|mình|em|của tôi)/.test(lower)) {
    return `SELECT order_id, shipping_address, shipping_phone, total_amount, payment_method, payment_status, status FROM orders WHERE assigned_shipper_id = ${userId || ':userId'} AND status IN ('CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED') ORDER BY created_at ASC;`;
  }

  // 2. Hỏi về thu tiền COD / tiền mặt
  if (/(thu hộ|tiền cod|thu cod|tiền mặt|thu bao nhiêu)/.test(lower)) {
    return `SELECT order_id, shipping_address, shipping_phone, total_amount, payment_status FROM orders WHERE assigned_shipper_id = ${userId || ':userId'} AND payment_method = 'COD' AND payment_status != 'PAID' AND status IN ('READY_TO_SHIP', 'SHIPPED') ORDER BY created_at ASC;`;
  }

  // 3. Hiệu suất tháng này
  if (/(thành công|hoàn thành|được mấy đơn|doanh số|hiệu suất)/.test(lower) && /(tháng này|trong tháng)/.test(lower)) {
    return `SELECT COUNT(*) AS so_don_thanh_cong, COALESCE(SUM(total_amount), 0) AS tong_gia_tri_giao FROM orders WHERE assigned_shipper_id = ${userId || ':userId'} AND status IN ('DELIVERED', 'COMPLETED') AND delivered_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
  }

  return null;
};

const DELIVERY_KNOWLEDGE_SOP = {
  pod_rules: {
    title: "Quy Chuẩn Chụp Ảnh Bằng Chứng Giao Hàng (POD)",
    content: `📸 **QUY ĐỊNH CHỤP ẢNH POD (PROOF OF DELIVERY):**
1. Chụp rõ ràng kiện hàng nguyên vẹn đặt tại địa chỉ khách (rõ số nhà/cửa hàng nếu có).
2. Chụp rõ góc tem bưu kiện AetherPC còn nguyên vẹn, không rách vỡ tem niêm phong.
3. Nếu khách cho phép: Chụp ảnh người nhận cầm gói hàng. Nếu khách từ chối chụp mặt: Chụp tay nhận hàng hoặc kiện hàng đặt trước cửa có sự chứng kiến.
4. Tải ảnh lên ngay tại nút **[Chụp ảnh POD]** trên ứng dụng giao hàng trước khi ấn [Giao Thành Công].`
  },
  cod_deposit: {
    title: "Quy Trình Nộp Tiền COD Về Kế Toán",
    content: `💵 **QUY ĐỊNH NỘP TIỀN COD HÀNG NGÀY:**
1. Toàn bộ tiền mặt thu từ khách (COD) phải được bàn giao về Phòng Kế toán trước **18h00 cùng ngày**.
2. Trường hợp đi giao về trễ sau 18h00: Shipper có thể quét mã VietQR của công ty để chuyển khoản nộp COD kèm cú pháp: \`NOP COD - [Tên Shipper] - [Mã các đơn]\`.
3. Kế toán sẽ đối soát và bấm xác nhận hoàn tất nộp COD trên hệ thống.`
  },
  damaged_box: {
    title: "Xử Lý Sự Cố Khách Từ Chối Nhận / Thùng Móp Hộp",
    content: `⚠️ **XỬ LÝ KHI KHÁCH KHIẾU NẠI MÓP HỘP HOẶC TỪ CHỐI NHẬN:**
1. Giữ bình tĩnh, lịch sự giải thích hàng bên trong có đệm mút xốp chống sốc Instapak đa lớp.
2. Mời khách đồng kiểm: Khách được quyền mở hộp kiểm tra ngoại quan (vỏ case không móp, mặt kính cường lực không nứt vỡ).
3. Nếu linh kiện bên trong bị nứt vỡ thật: Chụp ảnh hiện trạng 3 góc $\rightarrow$ Báo ngay về Zalo/Hotline Trưởng Kho $\rightarrow$ Cập nhật trạng thái đơn thành **FAILED_DELIVERY** kèm lý do "Bể vỡ vận chuyển".`
  }
};

module.exports = {
  DELIVERY_SYSTEM_PROMPT,
  DELIVERY_FEW_SHOTS,
  DELIVERY_SEMANTIC_RULES,
  DELIVERY_KNOWLEDGE_SOP
};
