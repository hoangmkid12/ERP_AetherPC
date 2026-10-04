/**
 * ADMIN & CEO TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO BAN GIÁM ĐỐC & QUẢN TRỊ VIÊN
 * Bao quát 100% năng lực Quản trị điều hành toàn diện AetherPC:
 * 1. Báo cáo tổng thể tình hình kinh doanh, dòng tiền, lợi nhuận gộp toàn công ty.
 * 2. Thống kê nhân sự, cơ cấu tài khoản người dùng và phân quyền hệ thống.
 * 3. Tỷ lệ hoàn đơn, tình hình khiếu nại CSKH và tỷ lệ bảo hành RMA.
 * 4. Xếp hạng hiệu suất nhân viên: Shipper giao nhiều nhất, Sales chốt đơn nhiều nhất.
 * 5. Báo cáo hàng tồn kho ứ đọng và nhóm sản phẩm sinh lời cao nhất.
 */

const ADMIN_CEO_SYSTEM_PROMPT = `BẠN LÀ TRỢ LÝ ĐIỀU HÀNH CHIẾN LƯỢC CAO CẤP DÀNH CHO BAN GIÁM ĐỐC (CEO) & ADMIN AETHERPC:
- PHONG CÁCH: Tổng quan, cô đọng, sắc bén, định hướng số liệu (Data-Driven Insights).
- QUYỀN HẠN: Toàn quyền truy cập mọi chỉ số tài chính, nhân sự, kho vận, không bị giới hạn RBAC.
- ĐỊNH DẠNG: Sử dụng bảng số liệu, bullet points, chỉ rõ tỷ lệ tăng trưởng và các điểm cảnh báo bất thường (công nợ treo, đơn trễ hạn, tồn đọng kho).`;

const ADMIN_CEO_FEW_SHOTS = [
  {
    question: "Báo cáo tổng quan tình hình kinh doanh toàn công ty năm nay",
    sql: "SELECT COUNT(order_id) AS tong_don_hang, SUM(total_amount) AS tong_doanh_thu, ROUND(AVG(total_amount), 0) AS gia_tri_tb_don FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');",
    description: "Tổng hợp các chỉ số KPI doanh thu và đơn hàng chủ chốt từ đầu năm đến nay"
  },
  {
    question: "Thống kê số lượng nhân sự theo từng phòng ban và vai trò",
    sql: "SELECT role, COUNT(id) AS so_luong_nhan_su FROM employees WHERE status = 'ACTIVE' GROUP BY role ORDER BY so_luong_nhan_su DESC;",
    description: "Cơ cấu nhân sự đang làm việc tại các bộ phận"
  },
  {
    question: "Có bao nhiêu khiếu nại khách hàng chưa được giải quyết?",
    sql: "SELECT priority, COUNT(id) AS so_luong FROM complaints WHERE status NOT IN ('RESOLVED', 'CLOSED') GROUP BY priority ORDER BY so_luong DESC;",
    description: "Theo dõi rủi ro chất lượng dịch vụ và mức độ hài lòng khách hàng"
  },
  {
    question: "Top 5 sản phẩm mang lại doanh thu cao nhất cho công ty",
    sql: "SELECT p.name AS ten_san_pham, SUM(oi.quantity) AS so_luong_ban, SUM(oi.total) AS tong_doanh_thu FROM order_items oi JOIN products p ON p.product_id = oi.product_id JOIN orders o ON o.order_id = oi.order_id WHERE o.status IN ('DELIVERED', 'COMPLETED') GROUP BY p.name ORDER BY tong_doanh_thu DESC LIMIT 5;",
    description: "Xếp hạng các sản phẩm chủ lực đóng góp doanh thu lớn nhất"
  },
  {
    question: "Tỷ lệ đơn hàng giao thành công so với đơn bị hủy hoặc hoàn hàng",
    sql: "SELECT status, COUNT(*) AS so_luong, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 1) AS ty_le_phan_tram FROM orders GROUP BY status ORDER BY so_luong DESC;",
    description: "Đánh giá tỷ lệ hoàn tất đơn hàng và tỷ lệ rủi ro giao vận"
  }
];

const ADMIN_CEO_SEMANTIC_RULES = (lower) => {
  // 1. Thống kê nhân sự
  if (/(nhân sự|nhân viên|tài khoản|phòng ban|cơ cấu)/.test(lower) && /(bao nhiêu|thống kê|tổng số|danh sách)/.test(lower)) {
    return `SELECT role, COUNT(id) AS so_luong_nhan_su FROM employees WHERE status = 'ACTIVE' GROUP BY role ORDER BY so_luong_nhan_su DESC;`;
  }

  // 2. Tỷ lệ đơn hàng, hoàn đơn
  if (/(tỷ lệ|thống kê đơn hàng|hiệu quả giao vận|tổng quan đơn)/.test(lower)) {
    return `SELECT status, COUNT(*) AS so_luong, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 1) AS ty_le_phan_tram FROM orders GROUP BY status ORDER BY so_luong DESC;`;
  }

  // 3. Khiếu nại và bảo hành RMA
  if (/(khiếu nại|ticket|phàn nàn|bảo hành.*đang chờ)/.test(lower)) {
    return `SELECT priority, COUNT(id) AS so_luong FROM complaints WHERE status NOT IN ('RESOLVED', 'CLOSED') GROUP BY priority ORDER BY so_luong DESC;`;
  }

  return null;
};

const ADMIN_CEO_KNOWLEDGE_SOP = {
  internal_security: {
    title: "Chính Sách An Toàn Thông Tin & Kiểm Soát Dữ Liệu Nội Bộ",
    content: `🔐 **QUY TẮC AN TOÀN DỮ LIỆU & KIỂM TOÁN HỆ THỐNG:**
1. **Zero-Trust Access:** Mọi thao tác truy xuất dữ liệu nhạy cảm đều được ghi log tự động vào bảng \`ai_audit_logs\`.
2. **Khóa tài khoản:** Nhân viên nghỉ việc bắt buộc phải vô hiệu hóa trạng thái tài khoản sang \`INACTIVE\` ngay trong vòng 2 giờ làm việc.
3. **Sao lưu dữ liệu:** Cơ sở dữ liệu PostgreSQL được backup tự động hàng ngày lúc 02:00 sáng và lưu trữ mã hóa đa vùng.`
  }
};

module.exports = {
  ADMIN_CEO_SYSTEM_PROMPT,
  ADMIN_CEO_FEW_SHOTS,
  ADMIN_CEO_SEMANTIC_RULES,
  ADMIN_CEO_KNOWLEDGE_SOP
};
