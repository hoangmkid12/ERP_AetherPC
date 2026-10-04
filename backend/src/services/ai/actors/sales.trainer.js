/**
 * SALES TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO BỘ PHẬN KINH DOANH & TƯ VẤN BÁN HÀNG
 * Thiết kế chuẩn hóa theo BaseActorTrainer - Dễ dàng mở rộng và train thêm tình huống mới.
 */

const BaseActorTrainer = require('./BaseActorTrainer');

const salesTrainer = new BaseActorTrainer({
  role: 'SALES',
  name: 'Kinh doanh & Tư vấn Bán lẻ PC',
  systemPrompt: `BẠN LÀ TRỢ LÝ TƯ VẤN BÁN HÀNG & CHUYÊN GIA BUILD PC CAO CẤP AETHERPC:
- PHONG CÁCH: Thân thiện, nhạy bén, am hiểu phần cứng PC chuyên sâu, hướng tới chốt sale hiệu quả.
- THÔNG TIN ƯU TIÊN:
  1. Tình trạng còn hàng (Stock Quantity > 0) và giá bán lẻ niêm yết.
  2. Tính tương thích phần cứng: Cấu hình có bị nghẽn cổ chai (bottleneck) không, nguồn kéo có dư tải không.
  3. Chính sách hậu mãi: Bảo hành 1 đổi 1, quà tặng kèm theo bộ PC.
  4. Mức chiết khấu tối đa được phép áp dụng cho khách.`
});

// ============================================================================
// 1. NHÓM KỸ NĂNG TRUY VẤN DỮ LIỆU ĐỘNG (LIVE SQL)
// ============================================================================

// Kỹ năng 1: Tra cứu giá bán lẻ & tồn kho sản phẩm cụ thể
salesTrainer.addSkill({
  id: 'PRODUCT_PRICE_STOCK',
  title: 'Tra cứu giá bán lẻ và tồn kho khả dụng',
  description: 'Tìm kiếm sản phẩm theo tên hoặc mã để báo giá cho khách',
  type: 'LIVE_SQL',
  examples: [
    'card rtx 4070 còn hàng không và giá bao nhiêu?',
    'card rtx 4070 còn hàng không và giá bao nhiêu',
    'giá bán cpu intel core i5 13400f hiện tại',
    'ram ddr5 corsair dominator giá thế nào',
    'trong kho còn mấy chiếc mainboard b760m'
  ],
  patterns: [
    /(giá bao nhiêu|còn hàng không|còn mấy cái|báo giá|tồn kho.*linh kiện)/i
  ],
  sql: (_userId, lower) => {
    const hwMatch = lower.match(/(rtx\s?\d{4}(?:\s?(?:ti|super))?|gtx\s?\d{4}|rx\s?\d{4}(?:\s?xt)?|core\s?i[3579][\w-]*|ryzen\s?[3579][\w-]*|b\d{3}|z\d{3})/i);
    const kw = hwMatch ? hwMatch[1].trim() : '';
    if (kw) {
      return `SELECT product_id, name, sku, price, stock_quantity FROM products WHERE name ILIKE '%${kw}%' AND status = 'ACTIVE' ORDER BY stock_quantity DESC LIMIT 10;`;
    }
    return `SELECT product_id, name, sku, price, stock_quantity FROM products WHERE stock_quantity > 0 AND status = 'ACTIVE' ORDER BY stock_quantity DESC LIMIT 10;`;
  }
});

// Kỹ năng 2: Tư vấn nguồn công suất thực phù hợp cấu hình
salesTrainer.addSkill({
  id: 'PSU_RECOMMENDATION',
  title: 'Gợi ý nguồn máy tính (PSU) phù hợp cấu hình',
  description: 'Tra cứu các mã nguồn 550W - 850W tương thích',
  type: 'LIVE_SQL',
  examples: [
    'cấu hình i5 13400 + rtx 4060 cần nguồn bao nhiêu watt',
    'rtx 4070 super dùng nguồn 650w có đủ không',
    'tư vấn nguồn cho dàn i7 và vga 4080'
  ],
  patterns: [
    /(nguồn bao nhiêu watt|cần nguồn bao nhiêu|nguồn.*đủ không|nguồn.*kéo nổi)/i
  ],
  sql: () => `SELECT p.name, p.price, p.stock_quantity, p.specs FROM products p JOIN categories c ON c.id = p.category_id WHERE (c.slug ILIKE '%psu%' OR c.slug ILIKE '%nguon%') AND p.stock_quantity > 0 ORDER BY p.price ASC LIMIT 10;`
});

// Kỹ năng 3: Sản phẩm đang có khuyến mãi giảm giá
salesTrainer.addSkill({
  id: 'ACTIVE_PROMOTIONS',
  title: 'Danh sách sản phẩm đang có chiết khấu giảm giá',
  description: 'Tìm các linh kiện đang sale tốt để giới thiệu khách hàng',
  type: 'LIVE_SQL',
  examples: [
    'danh sách sản phẩm đang có chương trình giảm giá tốt?',
    'danh sách sản phẩm đang có chương trình giảm giá tốt',
    'hôm nay có linh kiện nào đang sale không',
    'sản phẩm có mức chiết khấu cao',
    'linh kiện giảm giá hot'
  ],
  patterns: [
    /(giảm giá|khuyến mãi|sale|chiết khấu cao|ưu đãi)/i
  ],
  sql: () => `SELECT product_id, name, original_price, price, discount_percent, stock_quantity FROM products WHERE discount_percent > 0 AND stock_quantity > 0 AND status = 'ACTIVE' ORDER BY discount_percent DESC LIMIT 15;`
});

// Kỹ năng 4: Doanh số cá nhân của nhân viên Sales
salesTrainer.addSkill({
  id: 'SALES_MY_PERFORMANCE',
  title: 'Doanh số bán hàng cá nhân của nhân viên Sales',
  description: 'Thống kê số đơn chốt và tổng tiền bán được của nhân viên theo ngày hoặc tháng',
  type: 'LIVE_SQL',
  examples: [
    'tháng này tôi đã bán được bao nhiêu doanh số?',
    'tháng này tôi đã bán được bao nhiêu doanh số',
    'hôm nay tôi đã bán được bao nhiêu tiền doanh số',
    'doanh số cá nhân của tôi hôm nay',
    'tôi chốt được mấy đơn rồi',
    'hôm nay bán được bao nhiêu'
  ],
  patterns: [
    /(doanh số.*(của tôi|tôi bán)|tôi bán được bao nhiêu|tôi chốt được mấy đơn)/i
  ],
  sql: (userId, lower) => {
    const isMonth = /(tháng|thang)/i.test(lower || '');
    const dateTrunc = isMonth ? 'month' : 'day';
    return `SELECT COUNT(order_id) AS so_don_da_chot, COALESCE(SUM(total_amount), 0) AS doanh_so_ca_nhan FROM orders WHERE sold_by_id = ${userId || ':userId'} AND created_at >= date_trunc('${dateTrunc}', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
  }
});

// Kỹ năng 5: Danh sách khách hàng VIP
salesTrainer.addSkill({
  id: 'VIP_CUSTOMERS_LIST',
  title: 'Danh sách khách hàng VIP nhất công ty',
  description: 'Khách hàng hạng Kim Cương, Vàng có điểm tích lũy cao',
  type: 'LIVE_SQL',
  examples: [
    'danh sách khách hàng vip nhất của công ty',
    'khách hàng mua nhiều nhất',
    'top khách hàng tích điểm cao',
    'danh sách khách vip'
  ],
  patterns: [
    /(khách hàng vip|khách vip|mua nhiều nhất|tích điểm cao|hạng kim cương)/i
  ],
  sql: () => `SELECT customer_id, name, phone, tier, loyalty_points FROM customers ORDER BY loyalty_points DESC LIMIT 10;`
});

// ============================================================================
// 2. NHÓM KỸ NĂNG QUY TRÌNH & TRI THỨC VĂN BẢN (KNOWLEDGE SOP)
// ============================================================================

// Kỹ năng 6: Chính sách bảo hành 1 đổi 1 trong 30 ngày
salesTrainer.addSkill({
  id: 'SOP_WARRANTY_POLICY',
  title: 'Chính sách bảo hành 1 đổi 1 trong 30 ngày đầu',
  description: 'Quy định đổi mới linh kiện và điều kiện bảo hành máy nguyên bộ',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'chính sách bảo hành đổi trả 1 đổi 1 của công ty thế nào',
    'quy định đổi trả linh kiện trong 30 ngày đầu',
    'điều kiện để khách hàng được áp dụng chính sách đổi mới 100%',
    'máy nguyên bộ được bảo hành tận nơi bao lâu'
  ],
  patterns: [
    /(bảo hành 1 đổi 1|đổi trả 1 đổi 1|đổi mới 100%|bảo hành tận nơi)/i
  ],
  sop: `🛡️ **CHÍNH SÁCH BẢO HÀNH AETHERPC CHO KHÁCH HÀNG:**
1. **Linh kiện rời:** Đổi mới 100% trong 30 ngày đầu nếu phát sinh lỗi phần cứng từ nhà sản xuất (phải còn nguyên hộp, số serial trùng khớp, tem không rách).
2. **Bộ máy nguyên bộ (PC Full Set):** Bảo hành tận nơi nội thành 12 tháng đầu tiên. Hỗ trợ cho mượn linh kiện thay thế tương đương trong thời gian chờ thẩm định RMA.
3. **Từ chối bảo hành đổi mới:** Cháy nổ chip, cong chân socket CPU do tự lắp đặt sai, vô nước hoặc rơi vỡ móp méo vỏ linh kiện.`
});

// Kỹ năng 7: Quy chế duyệt chiết khấu khách VIP & B2B
salesTrainer.addSkill({
  id: 'SOP_VIP_DISCOUNT_POLICY',
  title: 'Quy chế duyệt chiết khấu cho khách VIP và khách B2B',
  description: 'Hạn mức giảm giá nhân viên sales được quyền tự quyết',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy chế duyệt chiết khấu cho khách vip và khách doanh nghiệp b2b',
    'đơn hàng pc trên 50 triệu có mức giảm giá chiết khấu ra sao',
    'quy định về mức giảm giá tối đa nhân viên sales được tự quyết'
  ],
  patterns: [
    /(chiết khấu.*vip|chiết khấu.*b2b|giảm giá.*50 triệu|tự quyết.*giảm giá)/i
  ],
  sop: `🎁 **HƯỚNG DẪN MỨC GIẢM GIÁ CHO NHÂN VIÊN SALES:**
1. **Khách hàng Bạc / Vàng:** Tự động áp dụng giảm 1% - 2% trên tổng hóa đơn.
2. **Khách hàng Kim Cương:** Giảm 3% và tặng gói vệ sinh PC trọn đời máy.
3. **Đơn hàng trên 50 triệu:** Nhân viên Sales được quyền tự quyết giảm tối đa 2.5%. Nếu khách yêu cầu giảm trên 3% bắt buộc phải có Trưởng phòng Sales (SALES_MANAGER) duyệt trên phần mềm.`
});

module.exports = salesTrainer;
