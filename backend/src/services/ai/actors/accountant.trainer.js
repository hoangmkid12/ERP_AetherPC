/**
 * ACCOUNTANT TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO PHÒNG KẾ TOÁN & THU NGÂN
 * Thiết kế chuẩn hóa theo BaseActorTrainer - Dễ dàng mở rộng và train thêm tình huống mới.
 */

const BaseActorTrainer = require('./BaseActorTrainer');

const accountantTrainer = new BaseActorTrainer({
  role: 'ACCOUNTANT',
  name: 'Phòng Kế toán & Dòng tiền',
  systemPrompt: `BẠN LÀ TRỢ LÝ TÀI CHÍNH & KẾ TOÁN TRƯỞNG ẢO CHO PHÒNG KẾ TOÁN AETHERPC:
- PHONG CÁCH: Chuyên nghiệp, nghiêm cẩn, số liệu chuẩn xác từng đồng (VNĐ), minh bạch dòng tiền.
- THÔNG TIN ƯU TIÊN:
  1. Doanh thu thực tế (đã trừ đơn hủy, chỉ tính đơn DELIVERED và COMPLETED).
  2. Dòng tiền thực tế: Tiền vào tài khoản VietQR, tiền mặt COD shipper đã nộp.
  3. Đối soát nợ COD treo của nhân viên giao hàng.
  4. Số dư các tài khoản thanh toán thụ hưởng công ty.
- BẢO MẬT: Tuyệt đối tuân thủ phân nhiệm SoD, không tiết lộ mật khẩu giao dịch ngân hàng.`
});

// ============================================================================
// 1. NHÓM KỸ NĂNG TRUY VẤN DỮ LIỆU ĐỘNG (LIVE SQL)
// ============================================================================

// Kỹ năng 1: Doanh thu năm nay
accountantTrainer.addSkill({
  id: 'ANNUAL_REVENUE',
  title: 'Báo cáo tổng doanh thu công ty năm nay',
  description: 'Tổng doanh thu thực thu lũy kế từ đầu năm đến thời điểm hiện tại',
  type: 'LIVE_SQL',
  examples: [
    'báo cáo tổng doanh thu công ty năm nay là bao nhiêu?',
    'báo cáo tổng doanh thu công ty năm nay là bao nhiêu',
    'doanh thu năm nay của công ty',
    'tổng thu cả năm 2026',
    'cho tôi biết doanh thu năm nay',
    'doanh thu năm nay'
  ],
  patterns: [
    /(doanh thu|thực thu|tiền thu).*(năm nay|cả năm|năm 2026)/i
  ],
  sql: () => `SELECT SUM(total_amount) AS doanh_thu_nam_nay, COUNT(order_id) AS tong_so_don FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`
});

// Kỹ năng 2: Doanh thu hôm nay
accountantTrainer.addSkill({
  id: 'TODAY_REVENUE',
  title: 'Báo cáo doanh thu thực tế hôm nay',
  description: 'Tính tổng doanh thu bán hàng thực thu trong ngày',
  type: 'LIVE_SQL',
  examples: [
    'doanh thu thực tế hôm nay của công ty là bao nhiêu',
    'hôm nay thu được bao nhiêu tiền',
    'báo cáo doanh thu ngày hôm nay',
    'doanh thu hôm nay'
  ],
  patterns: [
    /(doanh thu|thực thu|tiền thu).*(hôm nay|trong ngày)/i
  ],
  sql: () => `SELECT COALESCE(SUM(total_amount), 0) AS doanh_thu_hom_nay, COUNT(order_id) AS so_don_hom_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`
});

// Kỹ năng 3: Doanh thu tháng này & so sánh tháng trước
accountantTrainer.addSkill({
  id: 'MONTHLY_REVENUE',
  title: 'Báo cáo doanh thu theo tháng',
  description: 'Tổng hợp doanh thu tháng này hoặc so sánh với các tháng trước',
  type: 'LIVE_SQL',
  examples: [
    'doanh thu tháng này của công ty',
    'tổng kết doanh thu tháng này',
    'doanh thu theo từng tháng trong năm nay'
  ],
  patterns: [
    /(doanh thu|thực thu).*(tháng này|từng tháng|mỗi tháng)/i
  ],
  sql: () => `SELECT to_char(created_at, 'YYYY-MM') AS thang, COUNT(order_id) AS so_don, SUM(total_amount) AS doanh_thu FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY thang ORDER BY thang ASC;`
});

// Kỹ năng 4: Số dư tài khoản ngân hàng & VietQR
accountantTrainer.addSkill({
  id: 'BANK_ACCOUNT_BALANCES',
  title: 'Số dư hiện tại trong các tài khoản ngân hàng',
  description: 'Tra cứu số dư thực tế trong tất cả tài khoản ngân hàng MBBank, VCB',
  type: 'LIVE_SQL',
  examples: [
    'số dư hiện tại trong các tài khoản ngân hàng?',
    'số dư hiện tại trong các tài khoản ngân hàng của công ty',
    'tài khoản ngân hàng mbbank và vietcombank còn bao nhiêu tiền',
    'tài khoản nào đang bật vietqr tự động',
    'số dư quỹ tiền ngân hàng'
  ],
  patterns: [
    /(số dư|tài khoản ngân hàng|mbbank|vietcombank|ngân hàng|quỹ tiền|vietqr.*mặc định)/i
  ],
  sql: () => `SELECT bank_name, account_number, account_holder, current_balance, is_default_vietqr FROM company_bank_accounts WHERE status = 'ACTIVE' ORDER BY current_balance DESC;`
});

// Kỹ năng 5: Các đơn hàng chưa thanh toán tiền (Công nợ phải thu)
accountantTrainer.addSkill({
  id: 'UNPAID_ORDERS',
  title: 'Các đơn hàng chưa thanh toán tiền',
  description: 'Danh sách đơn hàng chưa hoàn tất thanh toán hoặc công nợ khách chưa thu',
  type: 'LIVE_SQL',
  examples: [
    'các đơn hàng nào chưa thanh toán tiền?',
    'các đơn hàng nào chưa thanh toán tiền',
    'danh sách đơn chưa thanh toán',
    'đơn hàng công nợ chưa thu',
    'những đơn khách chưa trả tiền'
  ],
  patterns: [
    /(chưa thanh toán|chưa trả tiền|nợ tiền|công nợ khách)/i
  ],
  sql: () => `SELECT order_id, customer_id, total_amount, payment_status, payment_method, created_at FROM orders WHERE payment_status != 'PAID' AND status NOT IN ('CANCELLED', 'RETURNED') ORDER BY created_at DESC LIMIT 20;`
});

// Kỹ năng 6: Đối soát COD shipper
accountantTrainer.addSkill({
  id: 'UNRECONCILED_COD_ORDERS',
  title: 'Đối soát các đơn COD chưa nộp tiền',
  description: 'Danh sách đơn hàng đã giao thành công nhưng chưa xác nhận thanh toán COD',
  type: 'LIVE_SQL',
  examples: [
    'có đơn hàng cod nào đã giao nhưng chưa nộp tiền về kế toán không',
    'shipper nào chưa nộp tiền cod',
    'danh sách đơn cod còn treo tiền',
    'đối soát nợ tiền cod shipper'
  ],
  patterns: [
    /(đối soát|nợ cod|treo tiền|chưa nộp tiền|chưa đối soát)/i
  ],
  sql: () => `SELECT o.order_id, o.total_amount, e.full_name AS ten_shipper, o.delivered_at FROM orders o JOIN employees e ON e.id = o.assigned_shipper_id WHERE o.status IN ('DELIVERED', 'COMPLETED') AND o.payment_method = 'COD' AND o.payment_status = 'PENDING' ORDER BY o.delivered_at ASC;`
});

// Kỹ năng 7: Tỷ trọng phương thức thanh toán
accountantTrainer.addSkill({
  id: 'PAYMENT_METHODS_BREAKDOWN',
  title: 'Tỷ trọng doanh thu theo từng phương thức thanh toán',
  description: 'Phân tích cơ cấu dòng tiền qua VietQR, COD, Tiền mặt, Thẻ',
  type: 'LIVE_SQL',
  examples: [
    'tỷ trọng doanh thu theo từng phương thức thanh toán tháng này',
    'khách thanh toán vietqr nhiều hơn hay cod nhiều hơn',
    'tổng tiền thu qua vietqr hôm nay'
  ],
  patterns: [
    /(phương thức thanh toán|vietqr.*cod|hình thức thanh toán)/i
  ],
  sql: () => `SELECT payment_method, COUNT(*) AS so_don, SUM(total_amount) AS tong_tien FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY payment_method ORDER BY tong_tien DESC;`
});

// ============================================================================
// 2. NHÓM KỸ NĂNG QUY TRÌNH & TRI THỨC VĂN BẢN (KNOWLEDGE SOP)
// ============================================================================

// Kỹ năng 8: Nguyên tắc phân nhiệm SoD
accountantTrainer.addSkill({
  id: 'SOP_SOD_INTERNAL_CONTROL',
  title: 'Nguyên tắc phân nhiệm SoD (Segregation of Duties) trong kế toán',
  description: 'Quy định bảo mật kiểm soát dòng tiền và phân chia quyền hạn',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'nguyên tắc phân nhiệm sod trong kế toán thế nào',
    'quy định bảo mật duyệt chi và đối soát tài khoản',
    'người tạo phiếu thu có được tự duyệt không'
  ],
  patterns: [
    /(phân nhiệm sod|nguyên tắc sod|kiểm soát dòng tiền|tự duyệt phiếu)/i
  ],
  sop: `🔒 **QUY ĐỊNH PHÂN NHIỆM KIỂM SOÁT NỘI BỘ (SOD):**
1. **Tách biệt vai trò:** Kế toán viên lập phiếu thu/chi (MAKER) KHÔNG ĐƯỢC trùng với người bấm duyệt xuất tiền trên tài khoản ngân hàng (CHECKER / APPROVER).
2. **Hạn mức duyệt:** Phiếu chi dưới 20 triệu: Kế toán trưởng phê duyệt. Phiếu chi trên 20 triệu: Bắt buộc Giám đốc (CEO) duyệt online trên ERP.
3. **Mã PIN/OTP:** Nghiêm cấm chia sẻ mã OTP ngân hàng doanh nghiệp hoặc đăng nhập chéo tài khoản của nhau.`
});

// Kỹ năng 9: Quy chuẩn đối soát VietQR tự động
accountantTrainer.addSkill({
  id: 'SOP_VIETQR_RECONCILIATION',
  title: 'Quy chuẩn đối soát VietQR và webhook ngân hàng',
  description: 'Hướng dẫn xử lý các giao dịch lệch tiền hoặc chậm webhook',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'xử lý khi khách quét vietqr nhưng đơn chưa tự động cập nhật',
    'tiền vào tài khoản nhưng hệ thống báo pending thì làm sao',
    'cách đối soát giao dịch vietqr lệch tiền'
  ],
  patterns: [
    /(chậm webhook|quét vietqr.*chưa cập nhật|lệch tiền vietqr)/i
  ],
  sop: `💳 **QUY CHUẨN ĐỐI SOÁT VIETQR TỰ ĐỘNG:**
1. **Kiểm tra mã tham chiếu:** Tra cứu mã tham chiếu ngân hàng (Bank Reference Code) trên app Ngân hàng MBBank/VCB đối chiếu với trường \`bank_ref_code\` trong đơn hàng.
2. **Khớp nội dung:** Nếu nội dung chuyển khoản thiếu mã đơn: Vào mục **[Kế toán $\rightarrow$ Đối soát VietQR thủ công]** $\rightarrow$ Chọn đơn tương ứng $\rightarrow$ Bấm [Khớp Giao Dịch].
3. **Lệch số tiền:** Nếu khách chuyển thiếu tiền: Hệ thống tự động ghi nhận là "Đã cọc một phần" (PARTIAL_PAID), nhân viên liên hệ khách để bổ sung.`
});

module.exports = accountantTrainer;
