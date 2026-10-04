/**
 * ADMIN & CEO TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO BAN GIÁM ĐỐC & QUẢN TRỊ VIÊN
 * Thiết kế chuẩn hóa theo BaseActorTrainer - Dễ dàng mở rộng và train thêm tình huống mới.
 */

const BaseActorTrainer = require('./BaseActorTrainer');

const adminCeoTrainer = new BaseActorTrainer({
  role: 'ADMIN_CEO',
  name: 'Ban Giám Đốc & Quản trị viên (Admin / CEO)',
  systemPrompt: `BẠN LÀ TRỢ LÝ ĐIỀU HÀNH CHIẾN LƯỢC CAO CẤP DÀNH CHO BAN GIÁM ĐỐC (CEO) & ADMIN AETHERPC:
- PHONG CÁCH: Tổng quan, cô đọng, sắc bén, định hướng số liệu (Data-Driven Insights).
- QUYỀN HẠN: Toàn quyền truy cập mọi chỉ số tài chính, nhân sự, kho vận, không bị giới hạn RBAC.
- ĐỊNH DẠNG: Sử dụng bảng số liệu, bullet points, chỉ rõ tỷ lệ tăng trưởng và các điểm cảnh báo bất thường (công nợ treo, đơn trễ hạn, tồn đọng kho).`
});

// ============================================================================
// 1. NHÓM KỸ NĂNG TRUY VẤN DỮ LIỆU ĐỘNG (LIVE SQL)
// ============================================================================

// Kỹ năng 1: Báo cáo tổng quan tình hình kinh doanh toàn công ty năm nay
adminCeoTrainer.addSkill({
  id: 'ANNUAL_EXECUTIVE_SUMMARY',
  title: 'Báo cáo tổng quan tình hình kinh doanh năm nay',
  description: 'Tổng hợp các chỉ số KPI doanh thu và đơn hàng chủ chốt từ đầu năm đến nay',
  type: 'LIVE_SQL',
  examples: [
    'báo cáo tổng quan tình hình kinh doanh toàn công ty năm nay',
    'tổng quan doanh thu năm nay',
    'tổng kết kinh doanh từ đầu năm',
    'tình hình kinh doanh năm nay thế nào',
    'doanh số và đơn hàng năm nay của công ty',
    'báo cáo kết quả kinh doanh năm nay'
  ],
  patterns: [
    /(tổng quan|tổng kết|kết quả).*(kinh doanh|doanh thu).*năm nay/i,
    /(kinh doanh|doanh thu|doanh số).*năm nay/i
  ],
  sql: `SELECT COUNT(order_id) AS tong_don_hang, SUM(total_amount) AS tong_doanh_thu, ROUND(AVG(total_amount), 0) AS gia_tri_tb_don FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`
});

// Kỹ năng 2: Thống kê số lượng nhân sự theo từng phòng ban và vai trò
adminCeoTrainer.addSkill({
  id: 'HR_HEADCOUNT_DISTRIBUTION',
  title: 'Thống kê số lượng nhân sự theo từng phòng ban và vai trò',
  description: 'Cơ cấu nhân sự đang làm việc tại các bộ phận trong công ty',
  type: 'LIVE_SQL',
  examples: [
    'thống kê số lượng nhân sự theo từng phòng ban và vai trò',
    'thống kê số lượng nhân sự theo từng phòng ban?',
    'công ty có bao nhiêu nhân sự',
    'công ty hiện có bao nhiêu nhân viên',
    'cơ cấu nhân sự các bộ phận',
    'thống kê nhân viên theo vai trò',
    'tổng số nhân sự đang hoạt động'
  ],
  patterns: [
    /(nhân sự|nhân viên|cơ cấu nhân sự)/i
  ],
  keywords: ['nhân sự'],
  sql: `SELECT role, COUNT(id) AS so_luong_nhan_su FROM employees WHERE status = 'ACTIVE' GROUP BY role ORDER BY so_luong_nhan_su DESC;`
});

// Kỹ năng 3: Các khiếu nại khách hàng chưa được giải quyết
adminCeoTrainer.addSkill({
  id: 'PENDING_COMPLAINTS',
  title: 'Các khiếu nại khách hàng chưa được giải quyết',
  description: 'Theo dõi rủi ro chất lượng dịch vụ và mức độ hài lòng khách hàng',
  type: 'LIVE_SQL',
  examples: [
    'có bao nhiêu khiếu nại khách hàng chưa được giải quyết?',
    'có bao nhiêu khiếu nại khách hàng chưa được giải quyết',
    'khiếu nại đang chờ xử lý',
    'danh sách khiếu nại cskh',
    'tình hình phàn nàn của khách',
    'khiếu nại tồn đọng chưa xong'
  ],
  patterns: [
    /(khiếu nại|ticket|phàn nàn)/i
  ],
  sql: `SELECT priority, COUNT(id) AS so_luong FROM complaints WHERE status NOT IN ('RESOLVED', 'CLOSED') GROUP BY priority ORDER BY so_luong DESC;`
});

// Kỹ năng 4: Top 5 sản phẩm mang lại doanh thu cao nhất cho công ty
adminCeoTrainer.addSkill({
  id: 'TOP_REVENUE_PRODUCTS',
  title: 'Top 5 sản phẩm mang lại doanh thu cao nhất cho công ty',
  description: 'Xếp hạng các sản phẩm chủ lực đóng góp doanh thu lớn nhất',
  type: 'LIVE_SQL',
  examples: [
    'top 5 sản phẩm mang lại doanh thu cao nhất cho công ty',
    'sản phẩm nào bán chạy nhất',
    'top sản phẩm doanh thu cao nhất',
    'mặt hàng sinh lời nhiều nhất',
    'những linh kiện đem lại doanh thu cao'
  ],
  patterns: [
    /(top.*sản phẩm|sản phẩm.*doanh thu cao|mặt hàng bán chạy|sinh lời cao nhất)/i
  ],
  sql: `SELECT p.name AS ten_san_pham, SUM(oi.quantity) AS so_luong_ban, SUM(oi.total) AS tong_doanh_thu FROM order_items oi JOIN products p ON p.product_id = oi.product_id JOIN orders o ON o.order_id = oi.order_id WHERE o.status IN ('DELIVERED', 'COMPLETED') GROUP BY p.name ORDER BY tong_doanh_thu DESC LIMIT 5;`
});

// Kỹ năng 5: Tỷ lệ đơn hàng giao thành công so với đơn bị hủy hoặc hoàn hàng
adminCeoTrainer.addSkill({
  id: 'ORDER_FULFILLMENT_RATIO',
  title: 'Tỷ lệ đơn hàng giao thành công so với đơn bị hủy hoặc hoàn hàng',
  description: 'Đánh giá tỷ lệ hoàn tất đơn hàng và tỷ lệ rủi ro giao vận',
  type: 'LIVE_SQL',
  examples: [
    'tỷ lệ đơn hàng giao thành công so với hoàn hàng?',
    'tỷ lệ đơn hàng giao thành công so với đơn bị hủy hoặc hoàn hàng',
    'tỷ lệ giao thành công toàn công ty',
    'thống kê tỷ lệ hoàn đơn',
    'tỷ lệ hoàn tất đơn hàng và hủy đơn',
    'hiệu quả giao vận toàn hệ thống'
  ],
  patterns: [
    /(tỷ lệ.*(giao|hủy|hoàn|thành công)|thống kê đơn hàng|hiệu quả giao vận|tổng quan đơn)/i
  ],
  sql: `SELECT status, COUNT(*) AS so_luong, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 1) AS ty_le_phan_tram FROM orders GROUP BY status ORDER BY so_luong DESC;`
});

// ============================================================================
// 2. NHÓM KỸ NĂNG QUY TRÌNH & TRI THỨC VĂN BẢN (KNOWLEDGE SOP)
// ============================================================================

// Kỹ năng 6: Chính sách an toàn thông tin & kiểm toán hệ thống
adminCeoTrainer.addSkill({
  id: 'SOP_INTERNAL_SECURITY',
  title: 'Chính sách an toàn thông tin & kiểm toán hệ thống',
  description: 'Quy tắc an toàn dữ liệu, phân quyền và ghi log kiểm toán',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'chính sách an toàn thông tin nội bộ',
    'quy định bảo mật và kiểm toán hệ thống',
    'quy tắc kiểm soát dữ liệu khách hàng',
    'nhân viên nghỉ việc xử lý tài khoản thế nào'
  ],
  patterns: [
    /(an toàn thông tin|bảo mật|kiểm toán|zero-trust|khóa tài khoản)/i
  ],
  sop: `🔐 **QUY TẮC AN TOÀN DỮ LIỆU & KIỂM TOÁN HỆ THỐNG:**
1. **Zero-Trust Access:** Mọi thao tác truy xuất dữ liệu nhạy cảm đều được ghi log tự động vào bảng \`ai_audit_logs\`.
2. **Khóa tài khoản:** Nhân viên nghỉ việc bắt buộc phải vô hiệu hóa trạng thái tài khoản sang \`INACTIVE\` ngay trong vòng 2 giờ làm việc.
3. **Sao lưu dữ liệu:** Cơ sở dữ liệu PostgreSQL được backup tự động hàng ngày lúc 02:00 sáng và lưu trữ mã hóa đa vùng.`
});

// Kỹ năng 7: Quy trình ứng phó khẩn cấp và phục hồi thảm họa
adminCeoTrainer.addSkill({
  id: 'SOP_DISASTER_RECOVERY',
  title: 'Quy trình ứng phó khẩn cấp và phục hồi thảm họa',
  description: 'Các bước xử lý khẩn cấp khi gặp sự cố máy chủ hoặc rò rỉ dữ liệu',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy trình xử lý sự cố rò rỉ dữ liệu',
    'khi hệ thống sập thì báo cáo thế nào',
    'kịch bản ứng phó sự cố máy chủ',
    'phục hồi thảm họa dữ liệu'
  ],
  patterns: [
    /(rò rỉ dữ liệu|sập hệ thống|sự cố máy chủ|ứng phó sự cố|phục hồi thảm họa)/i
  ],
  sop: `🚨 **QUY TRÌNH ỨNG PHÓ KHẨN CẤP (DISASTER RECOVERY):**
1. **Cô lập:** Ngắt ngay quyền truy cập IP bất thường và chuyển hệ thống sang chế độ bảo trì (Maintenance Mode).
2. **Báo cáo:** Trưởng bộ phận IT thông báo ngay cho CEO và CTO trong vòng 15 phút.
3. **Phục hồi:** Khôi phục điểm snapshot gần nhất từ máy chủ sao lưu dự phòng (DR Site).`
});

module.exports = adminCeoTrainer;
