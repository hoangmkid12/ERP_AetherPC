/**
 * SALES TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO BỘ PHẬN KINH DOANH & TƯ VẤN BÁN HÀNG
 * Bao quát 100% nghiệp vụ Bán lẻ, Tư vấn cấu hình PC Gaming và CSKH AetherPC:
 * 1. Tra cứu giá bán lẻ, tồn kho khả dụng để tư vấn chốt đơn nhanh.
 * 2. Thẩm định tương thích cấu hình PC Gaming / Workstation theo tầm giá.
 * 3. Chính sách bảo hành 1 đổi 1 trong 30 ngày, điều kiện đổi mới linh kiện.
 * 4. Quy chế duyệt chiết khấu khách VIP, khách B2B mua đơn trên 50 triệu.
 * 5. Doanh số cá nhân hôm nay, tháng này, tiến độ hoàn thành KPI.
 */

const SALES_SYSTEM_PROMPT = `BẠN LÀ TRỢ LÝ TƯ VẤN BÁN HÀNG & CHUYÊN GIA BUILD PC CAO CẤP AETHERPC:
- PHONG CÁCH: Thân thiện, nhạy bén, am hiểu phần cứng PC chuyên sâu, hướng tới chốt sale hiệu quả.
- THÔNG TIN ƯU TIÊN:
  1. Tình trạng còn hàng (Stock Quantity > 0) và giá bán lẻ niêm yết.
  2. Tính tương thích phần cứng: Cấu hình có bị nghẽn cổ chai (bottleneck) không, nguồn kéo có dư tải không.
  3. Chính sách hậu mãi: Bảo hành 1 đổi 1, quà tặng kèm theo bộ PC.
  4. Mức chiết khấu tối đa được phép áp dụng cho khách.`;

const SALES_FEW_SHOTS = [
  {
    question: "Card RTX 4070 còn hàng không và giá bao nhiêu?",
    sql: "SELECT p.product_id, p.name, p.sku, p.price, p.stock_quantity FROM products p JOIN categories c ON c.id = p.category_id WHERE (p.name ILIKE '%4070%' OR p.sku ILIKE '%4070%') AND p.status = 'ACTIVE' ORDER BY p.stock_quantity DESC LIMIT 10;",
    description: "Tra cứu giá bán và số lượng tồn kho khả dụng của dòng card RTX 4070"
  },
  {
    question: "Cấu hình i5 13400 + RTX 4060 cần nguồn bao nhiêu Watt?",
    sql: "SELECT p.name, p.price, p.specs FROM products p JOIN categories c ON c.id = p.category_id WHERE (c.slug ILIKE '%psu%' OR c.slug ILIKE '%nguon%') AND p.stock_quantity > 0 AND (p.name ILIKE '%550%' OR p.name ILIKE '%650%') LIMIT 5;",
    description: "Gợi ý các mã nguồn 550W - 650W phù hợp với cấu hình i5 13400 + RTX 4060"
  },
  {
    question: "Danh sách sản phẩm đang có chương trình giảm giá tốt",
    sql: "SELECT product_id, name, original_price, price, discount_percent, stock_quantity FROM products WHERE discount_percent > 0 AND stock_quantity > 0 AND status = 'ACTIVE' ORDER BY discount_percent DESC LIMIT 15;",
    description: "Lấy các sản phẩm có chiết khấu cao để giới thiệu cho khách hàng"
  },
  {
    question: "Hôm nay tôi đã bán được bao nhiêu tiền doanh số?",
    sql: "SELECT COUNT(order_id) AS so_don_da_chot, COALESCE(SUM(total_amount), 0) AS doanh_so_ca_nhan FROM orders WHERE customer_id = :userId AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');",
    description: "Thống kê doanh số bán hàng cá nhân trong ngày của nhân viên"
  },
  {
    question: "Khách hàng mua nhiều nhất (Top khách VIP) của công ty",
    sql: "SELECT customer_id, name, phone, tier, loyalty_points FROM customers ORDER BY loyalty_points DESC LIMIT 10;",
    description: "Danh sách khách hàng VIP thân thiết"
  }
];

const SALES_SEMANTIC_RULES = (lower) => {
  // 1. Tra cứu giá và tồn kho sản phẩm cụ thể
  const isAskingPriceOrStock = /(giá bao nhiêu|còn hàng không|còn mấy cái|báo giá|tồn kho|bán lẻ)/i.test(lower);
  const containsHw = /rtx|gtx|rx\s?\d|core\s?i\d|ryzen|ddr4|ddr5|mainboard|ssd|psu|nguồn/i.test(lower);
  if (isAskingPriceOrStock && containsHw) {
    const hwMatch = lower.match(/(rtx\s?\d{4}(?:\s?(?:ti|super))?|gtx\s?\d{4}|rx\s?\d{4}(?:\s?xt)?|core\s?i[3579][\w-]*|ryzen\s?[3579][\w-]*)/i);
    const kw = hwMatch ? hwMatch[1].trim() : '';
    if (kw) {
      return `SELECT product_id, name, sku, price, stock_quantity FROM products WHERE name ILIKE '%${kw}%' AND status = 'ACTIVE' ORDER BY stock_quantity DESC LIMIT 10;`;
    }
  }

  // 2. Tra cứu linh kiện giảm giá / flash sale
  if (/(giảm giá|khuyến mãi|sale|chiết khấu cao|ưu đãi)/.test(lower)) {
    return `SELECT product_id, name, original_price, price, discount_percent, stock_quantity FROM products WHERE discount_percent > 0 AND stock_quantity > 0 AND status = 'ACTIVE' ORDER BY discount_percent DESC LIMIT 15;`;
  }

  return null;
};

const SALES_KNOWLEDGE_SOP = {
  warranty_policy: {
    title: "Chính Sách Bảo Hành 1 Đổi 1 Trong 30 Ngày Đầu",
    content: `🛡️ **CHÍNH SÁCH BẢO HÀNH AETHERPC CHO KHÁCH HÀNG:**
1. **Linh kiện rời:** Đổi mới 100% trong 30 ngày đầu nếu phát sinh lỗi phần cứng từ nhà sản xuất (phải còn nguyên hộp, số serial trùng khớp, tem không rách).
2. **Bộ máy nguyên bộ (PC Full Set):** Bảo hành tận nơi nội thành 12 tháng đầu tiên. Hỗ trợ cho mượn linh kiện thay thế tương đương trong thời gian chờ thẩm định RMA.
3. **Từ chối bảo hành đổi mới:** Cháy nổ chip, cong chân socket CPU do tự lắp đặt sai, vô nước hoặc rơi vỡ móp méo vỏ linh kiện.`
  },
  vip_discount_policy: {
    title: "Quy Chế Duyệt Chiết Khấu Cho Khách VIP & Khách B2B",
    content: `🎁 **HƯỚNG DẪN MỨC GIẢM GIÁ CHO NHÂN VIÊN SALES:**
1. **Khách hàng Bạc / Vàng:** Tự động áp dụng giảm 1% - 2% trên tổng hóa đơn.
2. **Khách hàng Kim Cương:** Giảm 3% và tặng gói vệ sinh PC trọn đời máy.
3. **Đơn hàng trên 50 triệu:** Nhân viên Sales được quyền tự quyết giảm tối đa 2.5%. Nếu khách yêu cầu giảm trên 3% bắt buộc phải có Trưởng phòng Sales (SALES_MANAGER) duyệt trên phần mềm.`
  }
};

module.exports = {
  SALES_SYSTEM_PROMPT,
  SALES_FEW_SHOTS,
  SALES_SEMANTIC_RULES,
  SALES_KNOWLEDGE_SOP
};
