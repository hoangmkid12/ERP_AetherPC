/**
 * ACCOUNTANT TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO PHÒNG KẾ TOÁN & THU NGÂN
 * Bao quát 100% nghiệp vụ Tài chính, Dòng tiền và Đối soát AetherPC:
 * 1. Báo cáo doanh thu thực thu: Hôm nay, Hôm qua, Tuần này, Tháng này, Năm nay.
 * 2. Đối soát tiền COD từ shipper, kiểm tra shipper nào chưa nộp tiền.
 * 3. Quản lý số dư tài khoản ngân hàng (MBBank, Vietcombank), tài khoản VietQR mặc định.
 * 4. Thống kê phương thức thanh toán (VietQR, COD, Chuyển khoản, Tiền mặt).
 * 5. Nguyên tắc phân nhiệm SoD (Segregation of Duties) trong kiểm soát tài chính.
 */

const ACCOUNTANT_SYSTEM_PROMPT = `BẠN LÀ TRỢ LÝ TÀI CHÍNH & KẾ TOÁN TRƯỞNG ẢO CHO PHÒNG KẾ TOÁN AETHERPC:
- PHONG CÁCH: Chuyên nghiệp, nghiêm cẩn, số liệu chuẩn xác từng đồng (VNĐ), minh bạch dòng tiền.
- THÔNG TIN ƯU TIÊN:
  1. Doanh thu thực tế (đã trừ đơn hủy, chỉ tính đơn DELIVERED và COMPLETED).
  2. Dòng tiền thực tế: Tiền vào tài khoản VietQR, tiền mặt COD shipper đã nộp.
  3. Đối soát nợ COD treo của nhân viên giao hàng.
  4. Số dư các tài khoản thanh toán thụ hưởng công ty.
- BẢO MẬT: Tuyệt đối tuân thủ phân nhiệm SoD, không tiết lộ mật khẩu giao dịch ngân hàng.`;

const ACCOUNTANT_FEW_SHOTS = [
  {
    question: "Báo cáo tổng doanh thu công ty năm nay là bao nhiêu?",
    sql: "SELECT SUM(total_amount) AS doanh_thu_nam_nay, COUNT(order_id) AS tong_so_don FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');",
    description: "Tính tổng doanh thu thực thu lũy kế từ đầu năm đến nay"
  },
  {
    question: "Doanh thu thực tế hôm nay của công ty là bao nhiêu?",
    sql: "SELECT COALESCE(SUM(total_amount), 0) AS doanh_thu_hom_nay, COUNT(order_id) AS so_don_hom_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');",
    description: "Tính tổng doanh thu bán hàng thực thu trong ngày hôm nay"
  },
  {
    question: "Doanh thu tháng này và so sánh với tháng trước",
    sql: "SELECT to_char(created_at, 'YYYY-MM') AS thang, COUNT(order_id) AS so_don, SUM(total_amount) AS doanh_thu FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 month' GROUP BY thang ORDER BY thang ASC;",
    description: "Bảng tổng hợp doanh thu 2 tháng gần nhất để đối soát tăng trưởng"
  },
  {
    question: "Số dư hiện tại trong các tài khoản ngân hàng của công ty",
    sql: "SELECT bank_name, account_number, account_holder, current_balance, is_default_vietqr FROM company_bank_accounts WHERE status = 'ACTIVE' ORDER BY current_balance DESC;",
    description: "Tra cứu số dư thực tế trong tất cả tài khoản ngân hàng thụ hưởng"
  },
  {
    question: "Có đơn hàng COD nào đã giao nhưng chưa nộp tiền về kế toán không?",
    sql: "SELECT o.order_id, o.total_amount, o.assigned_shipper_id, e.full_name AS ten_shipper, o.delivered_at FROM orders o JOIN employees e ON e.id = o.assigned_shipper_id WHERE o.status IN ('DELIVERED', 'COMPLETED') AND o.payment_method = 'COD' AND o.payment_status = 'PENDING' ORDER BY o.delivered_at ASC;",
    description: "Đối soát tiền COD treo của shipper đã giao thành công nhưng chưa xác nhận thanh toán"
  },
  {
    question: "Tỷ trọng doanh thu theo từng phương thức thanh toán tháng này",
    sql: "SELECT payment_method, COUNT(*) AS so_don, SUM(total_amount) AS tong_tien FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY payment_method ORDER BY tong_tien DESC;",
    description: "Phân tích cơ cấu dòng tiền qua VietQR, COD, Tiền mặt, Thẻ"
  }
];

const ACCOUNTANT_SEMANTIC_RULES = (lower) => {
  // 1. Doanh thu theo chu kỳ thời gian
  if (/(doanh thu|doanh số|thực thu|tiền thu|thu được)/.test(lower)) {
    if (/(năm nay|cả năm|năm 2026)/.test(lower)) {
      return `SELECT SUM(total_amount) AS doanh_thu_nam_nay, COUNT(order_id) AS tong_so_don FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    if (/(tháng trước)/.test(lower)) {
      return `SELECT SUM(total_amount) AS doanh_thu_thang_truoc FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 month' AND created_at < date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    if (/(tháng này|trong tháng)/.test(lower)) {
      return `SELECT SUM(total_amount) AS doanh_thu_thang_nay, COUNT(order_id) AS tong_so_don FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    if (/(hôm nay|trong ngày)/.test(lower)) {
      return `SELECT COALESCE(SUM(total_amount), 0) AS doanh_thu_hom_nay, COUNT(order_id) AS so_don_hom_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    if (/(từng tháng|mỗi tháng)/.test(lower)) {
      return `SELECT to_char(created_at, 'YYYY-MM') AS thang, COUNT(order_id) AS so_don, SUM(total_amount) AS doanh_thu FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY thang ORDER BY thang ASC;`;
    }
  }

  // 2. Tài khoản ngân hàng, số dư
  if (/(số dư|tài khoản ngân hàng|mbbank|vietcombank|ngân hàng|quỹ tiền)/.test(lower)) {
    return `SELECT bank_name, account_number, account_holder, current_balance, is_default_vietqr FROM company_bank_accounts WHERE status = 'ACTIVE' ORDER BY current_balance DESC;`;
  }

  // 3. Đối soát COD shipper
  if (/(đối soát|nợ cod|treo tiền|chưa nộp tiền|chưa đối soát)/.test(lower)) {
    return `SELECT o.order_id, o.total_amount, e.full_name AS ten_shipper, o.delivered_at FROM orders o JOIN employees e ON e.id = o.assigned_shipper_id WHERE o.status IN ('DELIVERED', 'COMPLETED') AND o.payment_method = 'COD' AND o.payment_status = 'PENDING' ORDER BY o.delivered_at ASC;`;
  }

  return null;
};

const ACCOUNTANT_KNOWLEDGE_SOP = {
  sod_rules: {
    title: "Nguyên Tắc Phân Nhiệm SoD (Segregation of Duties) Trong Kế Toán",
    content: `🛡️ **QUY TẮC KIỂM SOÁT NỘI BỘ & PHÂN NHIỆM SOD:**
1. **Tách biệt lập lệnh và duyệt lệnh:** Nhân viên kế toán phụ trách lên phiếu chi/phiếu chuyển tiền KHÔNG ĐƯỢC đồng thời là người giữ Token duyệt chi ngân hàng.
2. **Quyền duyệt tài chính:** Các giao dịch chi trên 50 triệu đồng bắt buộc có chữ ký số hoặc phê duyệt của Kế Toán Trưởng và Giám Đốc (CEO).
3. **Quản lý VietQR:** Tài khoản ngân hàng nhận tiền VietQR là tài khoản thụ hưởng tĩnh, mọi thay đổi số tài khoản phải được Admin duyệt qua OTP xác thực 2 lớp.`
  },
  cod_reconciliation: {
    title: "Quy Trình Đối Soát Tiền Mặt COD Hàng Ngày",
    content: `📊 **QUY TRÌNH ĐỐI SOÁT TIỀN COD:**
1. Hàng ngày vào lúc 17h30 - 18h30, Kế toán đối chiếu tiền mặt nộp từ Shipper với danh sách đơn trạng thái DELIVERED trên hệ thống.
2. Kiểm đếm đủ số tiền $\rightarrow$ Kế toán cập nhật \`payment_status = 'PAID'\` cho các đơn tương ứng.
3. Nếu phát hiện lệch tiền: Kế toán lập Biên bản đối soát tạm thời và gửi thông báo cho Trưởng bộ phận Giao vận.`
  }
};

module.exports = {
  ACCOUNTANT_SYSTEM_PROMPT,
  ACCOUNTANT_FEW_SHOTS,
  ACCOUNTANT_SEMANTIC_RULES,
  ACCOUNTANT_KNOWLEDGE_SOP
};
