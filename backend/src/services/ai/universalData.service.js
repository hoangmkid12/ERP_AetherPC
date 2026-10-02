const prisma = require('../../config/database');

// Khởi tạo Gemini client linh hoạt (Dynamic Lazy Initialization)
let GoogleGenAI = null;
try {
  const genaiPkg = require('@google/genai');
  GoogleGenAI = genaiPkg.GoogleGenAI;
} catch (e) {}

const getAiClient = () => {
  if (process.env.GEMINI_API_KEY && GoogleGenAI) {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return null;
};

/**
 * Tóm tắt Schema Cơ Sở Dữ Liệu PostgreSQL & Bộ Quy Tắc Few-Shots Siêu Độ Phủ của AetherPC ERP
 * Cung cấp cho LLM Gemini để sinh câu truy vấn SELECT SQL chính xác 100%
 */
const ERP_DATABASE_SCHEMA_PROMPT = `
BẠN LÀ CHUYÊN GIA BIẾN CÂU HỎI TIẾNG VIỆT THÀNH TRUY VẤN SQL CHO HỆ THỐNG AETHERPC ERP (PostgreSQL).

==================================================
PHẦN 0. NGUYÊN TẮC BẢO MẬT & BẤT BIẾN
==================================================
1. Chỉ sinh đúng MỘT câu SELECT duy nhất. TUYỆT ĐỐI CẤM INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, EXEC.
2. Chỉ dùng bảng và cột có thật trong PHẦN 1. Không tự bịa tên cột. Nếu dữ liệu không tồn tại trong schema, trả status "UNSUPPORTED".
3. Luôn có LIMIT. Mặc định LIMIT 20. Nếu câu hỏi yêu cầu "top N" thì LIMIT N (tối đa 100). Với câu lệnh tổng hợp (COUNT, SUM, AVG) chỉ ra 1 dòng thì không cần LIMIT.
4. CẤM SELECT *. Chỉ chọn đúng các cột cần thiết cho câu trả lời.
5. Tìm kiếm chuỗi/văn bản luôn dùng ILIKE '%...%'. Giá trị trạng thái/enum luôn so sánh bằng với key chuẩn IN HOA.
6. TUYỆT ĐỐI KHÔNG xuất mật khẩu (password_hash), token, khóa bảo mật. Nếu câu hỏi chạm vào thông tin này, trả status "FORBIDDEN".
7. Tiền tệ là VND (numeric), không chia thập phân khi SUM/AVG trừ phi tính tỷ lệ %.
8. Định dạng đầu ra DUY NHẤT LÀ JSON theo PHẦN 6. Không thêm bất kỳ lời dẫn nào ngoài JSON.

==================================================
PHẦN 1. SCHEMA CHI TIẾT ĐẦY ĐỦ CỦA AETHERPC ERP
==================================================
1. customers(customer_id, name, phone, email, loyalty_points, tier, city, status, created_at)
   - tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'REGULAR'
   - status: 'ACTIVE' | 'INACTIVE'

2. customer_addresses(id, customer_id, recipient_name, recipient_phone, address_line, ward, district, city, is_default)

3. products(product_id, sku, name, brand_id, category_id, price, average_cost, stock_quantity, warranty_months, status, available)
   - status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'
   - available: true/false

4. categories(id, name, slug)
   - Danh mục: CPU, VGA, Mainboard, RAM, Ổ cứng / SSD, Nguồn / PSU, Case, Tản nhiệt, Màn hình, Bàn phím, Chuột...

5. brands(id, name)
   - Thương hiệu: ASUS, MSI, GIGABYTE, INTEL, AMD, NVIDIA, CORSAIR, KINGSTON, SAMSUNG, VIEWSONIC, LOGITECH...

6. orders(order_id, customer_id, status, payment_method, payment_status, total_amount, subtotal, discount, shipping_fee, shipping_address, shipping_city, channel, assigned_shipper_id, sold_by_id, created_at, delivered_at)
   - status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'AWAITING_STOCK' | 'READY_TO_SHIP' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'FAILED_DELIVERY' | 'RETURNING_TO_WAREHOUSE'
   - payment_method: 'COD' | 'VIETQR' | 'BANK_TRANSFER' | 'MOMO' | 'CASH'
   - payment_status: 'PENDING' | 'PAID' | 'REFUNDED' | 'PARTIAL'
   - channel: 'ONLINE' | 'POS'

7. order_items(id, order_id, product_id, quantity, price, total)

8. purchase_orders(id, po_number, supplier_code, status, total_amount, created_at, expected_date)
   - status: 'RFQ' | 'QUOTED' | 'APPROVED' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'DELIVERED' | 'CANCELLED'

9. purchase_order_items(id, po_id, product_id, quantity, unit_cost, total_cost)

10. suppliers(code, name, phone, email, address, status)

11. return_requests(id, rma_code, order_id, customer_id, type, reason, status, refund_amount, created_at)
    - type: 'EXCHANGE' | 'REFUND' | 'WARRANTY'
    - status: 'PENDING' | 'RETURN_APPROVED' | 'DELIVERED_TO_WAREHOUSE' | 'QC_PASSED' | 'COMPLETED' | 'REJECTED'

12. complaints(id, ticket_code, customer_id, order_id, subject, description, priority, status, created_at)
    - priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    - status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

13. promotions(id, code, title, discount_type, discount_value, min_spend, status, expires_at)
    - discount_type: 'PERCENT' | 'FIXED'
    - status: 'ACTIVE' | 'INACTIVE'

14. product_reviews(id, product_id, customer_id, rating, comment, created_at)
    - rating: từ 1 đến 5 sao

15. employees(id, employee_code, full_name, role, department, phone, email, status, created_at)
    - role: 'CEO' | 'ADMIN' | 'SALES' | 'SALES_MANAGER' | 'WAREHOUSE' | 'WAREHOUSE_MANAGER' | 'DELIVERY' | 'ACCOUNTANT' | 'HR'

16. company_bank_accounts(id, bank_code, bank_name, account_number, account_holder, current_balance, is_default_qr, status)

Quan hệ chính:
orders.customer_id = customers.customer_id
order_items.order_id = orders.order_id
order_items.product_id = products.product_id
products.brand_id = brands.id
products.category_id = categories.id
purchase_orders.supplier_code = suppliers.code
orders.assigned_shipper_id = employees.id
return_requests.order_id = orders.order_id

==================================================
PHẦN 2. BỘ TỪ ĐIỂN ÁNH XẠ TIẾNG VIỆT SIÊU ĐỘ PHỦ
==================================================
2.1 Trạng thái đơn (orders.status):
- Mới/vừa đặt/chưa duyệt: 'PENDING'
- Đã duyệt/xác nhận/chốt đơn: 'CONFIRMED'
- Đang đóng gói/soạn hàng/xử lý: 'PROCESSING'
- Thiếu hàng/chờ đồ/hết linh kiện: 'AWAITING_STOCK'
- Đã đóng xong/chờ shipper/chờ lấy: 'READY_TO_SHIP'
- Đang giao/trên đường/shipper cầm: 'SHIPPED'
- Đã giao/thành công/hoàn tất/khách nhận: ('DELIVERED', 'COMPLETED')
- Bom hàng/khách không nhận/giao xịt: 'FAILED_DELIVERY'
- Chuyển hoàn/hoàn hàng/trả về kho: 'RETURNING_TO_WAREHOUSE'
- Hủy/đã hủy: 'CANCELLED'

2.2 Thanh toán & Phương thức:
- Tiền mặt: 'CASH'
- COD / trả khi nhận: 'COD'
- Chuyển khoản / quét qr / vietqr / tài khoản ngân hàng: ('VIETQR', 'BANK_TRANSFER')
- Ví điện tử: 'MOMO'
- Đã trả/đã thanh toán/thu xong: payment_status = 'PAID'
- Chưa trả/nợ tiền/chưa thanh toán: payment_status = 'PENDING'

2.3 Lóng công nghệ & Thương hiệu (brands & categories):
- "đội đỏ", "ryzen", "radeon": brand AMD
- "đội xanh dương", "core i", "core ultra": brand INTEL
- "đội xanh lá", "geforce", "rtx", "gtx": brand NVIDIA
- "rog", "tuf", "strix": brand ASUS
- "aorus": brand GIGABYTE
- "dragon": brand MSI
- "cpu", "chip", "vi xử lý": category '%CPU%'
- "vga", "card màn hình", "card đồ họa", "gpu": category '%VGA%'
- "ram", "bộ nhớ trong", "thanh ram": category '%RAM%'
- "ssd", "hdd", "nvme", "ổ win", "ổ cứng": category '%SSD%' hoặc '%Ổ cứng%'
- "main", "bo mạch chủ", "mainboard": category '%Mainboard%'
- "psu", "nguồn", "nguồn công suất thực": category '%Nguồn%'
- "case", "vỏ case", "thùng máy": category '%Case%'
- "tản nhiệt", "tản khí", "tản nước", "aio", "fan": category '%Tản nhiệt%'
- "màn hình", "màn 144hz", "màn 2k", "monitor": category '%Màn hình%'

2.4 Mốc thời gian (UTC+7 Việt Nam):
- Hôm nay: created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
- Hôm qua: created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 day' AND created_at < date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
- Tuần này: created_at >= date_trunc('week', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
- Tuần trước: created_at >= date_trunc('week', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 week' AND created_at < date_trunc('week', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
- Tháng này: created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
- Tháng trước: created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 month' AND created_at < date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
- Quý này: created_at >= date_trunc('quarter', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
- Năm nay: created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
- 7 ngày qua: created_at >= now() - INTERVAL '7 days'
- 30 ngày qua: created_at >= now() - INTERVAL '30 days'

2.5 Nhận diện số tiền tiếng Việt:
- "500k" = 500000, "1tr" / "1 triệu" = 1000000, "15 củ" = 15000000, "1 tỷ" = 1000000000.

==================================================
PHẦN 3. BẢNG MẪU SQL MỞ RỘNG (FEW-SHOTS MỌI NGHIỆP VỤ)
==================================================

--- NHÓM 1: ĐÁNH GIÁ & PHẢN HỒI SẢN PHẨM (REVIEWS) ---
User: "Sản phẩm nào bị đánh giá tệ nhất"
SQL: SELECT p.product_id, p.name, ROUND(AVG(pr.rating), 1) AS diem_tb, COUNT(pr.id) AS so_danh_gia FROM product_reviews pr JOIN products p ON p.product_id = pr.product_id GROUP BY p.product_id, p.name HAVING COUNT(pr.id) >= 3 ORDER BY diem_tb ASC LIMIT 10;

User: "Khách hàng chê gì về đơn hàng gần đây"
SQL: SELECT customer_id, rating, comment, created_at FROM product_reviews WHERE rating <= 2 ORDER BY created_at DESC LIMIT 20;

--- NHÓM 2: KHIẾU NẠI & CHĂM SÓC KHÁCH HÀNG (COMPLAINTS) ---
User: "Có khiếu nại nào khẩn cấp chưa xử lý không"
SQL: SELECT ticket_code, order_id, subject, priority, status, created_at FROM complaints WHERE priority IN ('HIGH', 'URGENT') AND status NOT IN ('RESOLVED', 'CLOSED') ORDER BY created_at ASC LIMIT 20;

--- NHÓM 3: KHUYẾN MÃI & MÃ GIẢM GIÁ (PROMOTIONS) ---
User: "Có mã giảm giá nào còn hạn dùng không"
SQL: SELECT code, title, discount_type, discount_value, min_spend, expires_at FROM promotions WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now()) ORDER BY expires_at ASC LIMIT 20;

--- NHÓM 4: HIỆU SUẤT GIAO HÀNG CỦA SHIPPER ---
User: "Shipper nào giao thành công nhiều đơn nhất tháng này"
SQL: SELECT e.id, e.full_name, COUNT(o.order_id) AS so_don_thanh_cong FROM orders o JOIN employees e ON e.id = o.assigned_shipper_id WHERE o.status IN ('DELIVERED', 'COMPLETED') AND o.delivered_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY e.id, e.full_name ORDER BY so_don_thanh_cong DESC LIMIT 10;

--- NHÓM 5: TÀI KHOẢN NGÂN HÀNG & QUỸ TIỀN CÔNG TY ---
User: "Tài khoản công ty hiện có bao nhiêu tiền"
SQL: SELECT bank_name, account_number, account_holder, current_balance FROM company_bank_accounts WHERE status = 'ACTIVE' ORDER BY current_balance DESC;

--- NHÓM 6: DOANH THU & LỢI NHUẬN NÂNG CAO ---
User: "Doanh thu theo từng danh mục tháng này"
SQL: SELECT c.name AS danh_muc, SUM(oi.total) AS doanh_thu FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id JOIN categories c ON c.id = p.category_id WHERE o.status IN ('DELIVERED', 'COMPLETED') AND o.created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY c.name ORDER BY doanh_thu DESC LIMIT 20;

User: "Sản phẩm nào mang lại nhiều lợi nhuận nhất năm nay"
SQL: SELECT p.product_id, p.name, SUM(oi.total - oi.quantity * p.average_cost) AS tong_loi_nhuan FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status IN ('DELIVERED', 'COMPLETED') AND o.created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY p.product_id, p.name ORDER BY tong_loi_nhuan DESC LIMIT 10;

--- NHÓM 7: BẢO HÀNH & ĐỔI TRẢ (RMA) ---
User: "Các yêu cầu bảo hành đang chờ duyệt"
SQL: SELECT rma_code, order_id, customer_id, reason, status, created_at FROM return_requests WHERE type = 'WARRANTY' AND status = 'PENDING' ORDER BY created_at ASC LIMIT 20;

--- NHÓM 8: KHÁCH HÀNG & TỒN KHO CƠ BẢN ---
User: "Top 5 khách hàng VIP nhất"
SQL: SELECT customer_id, name, phone, loyalty_points, tier FROM customers ORDER BY loyalty_points DESC LIMIT 5;

User: "Card đồ họa đội xanh lá giá dưới 15 triệu"
SQL: SELECT p.product_id, p.name, p.price, p.stock_quantity FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id WHERE b.name ILIKE '%NVIDIA%' AND c.name ILIKE '%VGA%' AND p.price < 15000000 AND p.status = 'ACTIVE' ORDER BY p.price DESC LIMIT 20;

User: "Hàng nào sắp hết tồn kho"
SQL: SELECT product_id, sku, name, stock_quantity FROM products WHERE stock_quantity <= 5 AND status = 'ACTIVE' ORDER BY stock_quantity ASC LIMIT 20;

==================================================
PHẦN 4. XỬ LÝ CÂU HỎI MƠ HỒ HOẶC VIẾT TẮT
==================================================
1. Người dùng chỉ gõ tên linh kiện/mã (VD: "i5 13400", "rtx 4070") -> Tự động tìm trong bảng products theo tên hoặc sku còn hàng và ACTIVE.
2. Thiếu thời gian ("doanh thu") -> Mặc định tháng hiện tại, ghi chú vào "assumption".
3. Câu hỏi so sánh hai kênh ("online vs quầy") -> GROUP BY o.channel.

==================================================
PHẦN 5. QUY TẮC TỪ CHỐI
==================================================
1. Trả "FORBIDDEN": Khi người dùng yêu cầu xem password, mã hash, thông tin bảo mật nhân sự, hoặc yêu cầu thực hiện hành động ghi (INSERT/UPDATE/DELETE).
2. Trả "UNSUPPORTED": Khi câu hỏi nằm ngoài phạm vi hoạt động của ERP máy tính (hỏi thời tiết, tin tức bóng đá...).

==================================================
PHẦN 6. ĐỊNH DẠNG ĐẦU RA JSON BẮT BUỘC
==================================================
{
  "status": "OK" | "NEED_CLARIFICATION" | "UNSUPPORTED" | "FORBIDDEN",
  "sql": "câu SELECT hoặc chuỗi rỗng",
  "assumption": "giả định đã dùng, nếu có",
  "clarification": "câu hỏi làm rõ, nếu status là NEED_CLARIFICATION"
}
`;

/**
 * Kiểm tra tính an toàn của câu lệnh SQL (Chỉ cho phép READ-ONLY SELECT)
 */
const isSafeSqlQuery = (sql) => {
  if (!sql || typeof sql !== 'string') return false;
  const clean = sql.trim().toLowerCase();

  // Bắt buộc bắt đầu bằng SELECT hoặc WITH (Common Table Expressions)
  if (!clean.startsWith('select') && !clean.startsWith('with')) {
    return false;
  }

  // Tuyệt đối chặn các từ khóa ghi, sửa, xóa, DDL
  const dangerousKeywords = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|execute|exec|call|set|comment|vacuum|reindex)\b/i;
  if (dangerousKeywords.test(clean)) {
    return false;
  }

  // Chặn truy cập trường mật khẩu và token bảo mật
  const sensitiveFields = /\b(password_hash|password|secret|token|hash)\b/i;
  if (sensitiveFields.test(clean)) {
    return false;
  }

  return true;
};

/**
 * Bộ sinh truy vấn SQL theo ngữ nghĩa (Semantic Rule-based NL2SQL)
 * Hoạt động 100% offline không cần API key nếu Gemini tạm thời chưa cấu hình
 */
const generateSqlBySemanticPattern = (userPrompt, userRole) => {
  const lower = userPrompt.toLowerCase();

  // 0. Doanh thu & Dòng tiền theo mốc thời gian (Năm nay, Tháng này, Quý này, Hôm nay, Hôm qua, Từng tháng...)
  if (/(doanh thu|doanh số|tiền thu|thu được)/.test(lower)) {
    if (/(năm nay|cả năm|năm 2026)/.test(lower)) {
      return `SELECT SUM(total_amount) AS doanh_thu_nam_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    if (/(tháng trước)/.test(lower)) {
      return `SELECT SUM(total_amount) AS doanh_thu_thang_truoc FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 month' AND created_at < date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    if (/(tháng này|trong tháng)/.test(lower)) {
      return `SELECT SUM(total_amount) AS doanh_thu_thang_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    if (/(quý này|quý)/.test(lower)) {
      return `SELECT SUM(total_amount) AS doanh_thu_quy_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('quarter', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    if (/(hôm qua)/.test(lower)) {
      return `SELECT SUM(total_amount) AS doanh_thu_hom_qua FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '1 day' AND created_at < date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    if (/(hôm nay|trong ngày)/.test(lower)) {
      return `SELECT SUM(total_amount) AS doanh_thu_hom_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
    }
    if (/(từng tháng|mỗi tháng)/.test(lower)) {
      return `SELECT to_char(created_at, 'YYYY-MM') AS thang, COUNT(*) AS so_don, SUM(total_amount) AS doanh_thu FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY thang ORDER BY thang ASC;`;
    }
    // Mặc định doanh thu năm nay nếu không nói rõ
    return `SELECT SUM(total_amount) AS doanh_thu_nam_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`;
  }

  // 1. Sản phẩm hết hàng / tồn kho bằng 0
  if (/(hết hàng|tồn.*bằng 0|tồn.*=.*0|hết tồn)/.test(lower)) {
    return `SELECT product_id, name, price, stock_quantity, status FROM products WHERE stock_quantity = 0 AND status = 'ACTIVE' LIMIT 15;`;
  }

  // 2. Sản phẩm sắp hết hàng (tồn kho dưới 5)
  if (/(sắp hết hàng|tồn kho thấp|cảnh báo tồn|tồn.*dưới)/.test(lower)) {
    return `SELECT product_id, name, price, stock_quantity FROM products WHERE stock_quantity < 5 AND status = 'ACTIVE' ORDER BY stock_quantity ASC LIMIT 15;`;
  }

  // 3. Thống kê đơn hàng theo trạng thái
  if (/(thống kê|tổng số|bao nhiêu đơn).*(trạng thái|status)/.test(lower) || /(từng trạng thái|mỗi trạng thái)/.test(lower)) {
    return `SELECT status, COUNT(*) AS so_luong, SUM(total_amount) AS tong_gia_tri FROM orders GROUP BY status ORDER BY so_luong DESC;`;
  }

  // 4. Top/Danh sách đơn hàng giá trị cao nhất (Đọc số lượng động: 6 đơn hàng, top 2, top 3, 10 đơn...)
  if (/đơn/.test(lower) && (/(giá trị cao|tiền to|nhiều tiền|cao nhất|lớn nhất)/.test(lower) || (/top/.test(lower) && /\d+/.test(lower)))) {
    const numMatch = lower.match(/top\s*(\d+)|(\d+)\s*đơn|(\d+)/);
    const limitNum = numMatch ? Math.min(parseInt(numMatch[1] || numMatch[2] || numMatch[3], 10), 25) : 5;
    return `SELECT order_id, total_amount, payment_method, status, created_at FROM orders ORDER BY total_amount DESC LIMIT ${limitNum};`;
  }

  // 5. Đơn hàng đang giao (SHIPPED)
  if (/(đang giao|đang ship|shipped|trên đường giao)/.test(lower)) {
    if (userRole === 'DELIVERY') {
      return `SELECT order_id, total_amount, shipping_address, status, created_at FROM orders WHERE status = 'SHIPPED' AND assigned_shipper_id = :userId ORDER BY created_at DESC LIMIT 15;`;
    }
    return `SELECT order_id, total_amount, shipping_address, status, created_at FROM orders WHERE status = 'SHIPPED' ORDER BY created_at DESC LIMIT 15;`;
  }

  // 6. Đơn hàng chờ giao (READY_TO_SHIP)
  if (/(chờ giao|chờ ship|chờ lấy hàng|ready to ship)/.test(lower)) {
    return `SELECT order_id, total_amount, shipping_address, status, created_at FROM orders WHERE status = 'READY_TO_SHIP' ORDER BY created_at ASC LIMIT 15;`;
  }

  // 7. Đơn hàng đã giao thành công / hoàn tất
  if (/(đã giao|giao thành công|hoàn tất|completed|delivered)/.test(lower) && /đơn/.test(lower)) {
    return `SELECT order_id, total_amount, status, created_at FROM orders WHERE status IN ('COMPLETED', 'DELIVERED') ORDER BY created_at DESC LIMIT 10;`;
  }

  // 6. Đơn hàng bị hủy
  if (/(đơn.*bị hủy|đơn.*hủy|cancelled)/.test(lower)) {
    return `SELECT order_id, total_amount, status, created_at FROM orders WHERE status = 'CANCELLED' ORDER BY created_at DESC LIMIT 10;`;
  }

  // 7. Khách hàng VIP / mua nhiều nhất
  if (/(khách hàng vip|khách vip|mua nhiều nhất|điểm cao nhất|hạng kim cương|hạng vàng)/.test(lower)) {
    return `SELECT customer_id, name, phone, city, tier, loyalty_points FROM customers ORDER BY loyalty_points DESC LIMIT 10;`;
  }

  // 8. Phiếu đổi trả RMA
  if (/(đổi trả|rma|bảo hành.*đang chờ|return_requests)/.test(lower)) {
    return `SELECT rma_code, order_id, type, reason, status, refund_amount, created_at FROM return_requests ORDER BY created_at DESC LIMIT 10;`;
  }

  // 9. Khiếu nại / Ticket CSKH
  if (/(khiếu nại|ticket|phàn nàn|urgency|khẩn cấp)/.test(lower)) {
    return `SELECT ticket_code, subject, priority, status, created_at FROM complaints ORDER BY created_at DESC LIMIT 10;`;
  }

  // 10. Danh sách nhà cung cấp
  if (/(nhà cung cấp|ncc|supplier)/.test(lower)) {
    return `SELECT code, name, phone, email, status FROM suppliers WHERE status = 'ACTIVE' LIMIT 15;`;
  }

  // 11. Phiếu mua hàng PO đang chờ duyệt
  if (/(nhập hàng|mua hàng|purchase order|po).*(chờ duyệt|chờ|rfq|quoted)/.test(lower)) {
    return `SELECT po_number, supplier_code, total_amount, status, created_at FROM purchase_orders ORDER BY created_at DESC LIMIT 10;`;
  }

  // 12. Doanh thu theo phương thức thanh toán (COD vs VietQR)
  if (/(phương thức thanh toán|vietqr.*cod|hình thức thanh toán)/.test(lower)) {
    return `SELECT payment_method, COUNT(*) AS so_don, SUM(total_amount) AS tong_tien FROM orders WHERE status != 'CANCELLED' GROUP BY payment_method;`;
  }

  // 13. Danh sách sản phẩm của một thương hiệu cụ thể (vd ASUS, MSI, INTEL...)
  const brandMatch = lower.match(/(asus|msi|gigabyte|intel|amd|corsair|kingston|samsung)/i);
  if (brandMatch) {
    const brandName = brandMatch[1].toUpperCase();
    return `SELECT p.product_id, p.name, p.price, p.stock_quantity FROM products p JOIN brands b ON p.brand_id = b.id WHERE b.name ILIKE '%${brandName}%' AND p.status = 'ACTIVE' LIMIT 10;`;
  }

  return null;
};

/**
 * Sinh câu lệnh SQL từ ngôn ngữ tự nhiên bằng LLM (Có fallback sang Semantic Pattern)
 */
const generateSqlFromQuestion = async (userPrompt, userRole) => {
  // 1. Bước 1: Mô hình AI tự huấn luyện (Local NLU & NER) bóc tách Slot/Thực thể trước
  let nluResult = null;
  try {
    const { extractSlotsAndGenerateSql } = require('./localNlp.service');
    nluResult = await extractSlotsAndGenerateSql(userPrompt);
  } catch (nlpErr) {
    console.warn('[UniversalData] Local NLU extraction bypass:', nlpErr.message);
  }

  // 2. Bước 2: Nếu có Gemini AI, kết hợp Thực thể tự train + Trí tuệ Gemini (Hybrid AI)
  const aiClient = getAiClient();
  if (aiClient) {
    try {
      const slotHints = nluResult?.slots ? `\n[Gợi ý thực thể trích xuất từ Mô hình AI tự train nội bộ: ${JSON.stringify(nluResult.slots)}]` : '';

      // Tải các kỹ năng SQL do Admin huấn luyện trực tiếp trên giao diện
      let adminTrainedFewShots = '';
      const fs = require('fs');
      const path = require('path');
      const dynamicPath = path.join(__dirname, 'dynamic_few_shots.json');
      if (fs.existsSync(dynamicPath)) {
        try {
          const dynamicSkills = JSON.parse(fs.readFileSync(dynamicPath, 'utf8'));
          if (Array.isArray(dynamicSkills) && dynamicSkills.length > 0) {
            adminTrainedFewShots = `\n\n==================================================\nPHẦN 3.B: CÁC KỸ NĂNG SQL DO ADMIN HUẤN LUYỆN TRỰC TIẾP (ƯU TIÊN CAO NHẤT)\n==================================================\n` +
              dynamicSkills.slice(0, 10).map(s => `User: "${s.question}"\nSQL: ${s.sql}`).join('\n\n');
          }
        } catch (e) {}
      }

      const prompt = `${ERP_DATABASE_SCHEMA_PROMPT}${adminTrainedFewShots}

NGUYÊN TẮC BẮT BUỘC:
1. Bạn CHỈ ĐƯỢC sinh ra ĐÚNG 1 câu lệnh SQL "SELECT" duy nhất, thuần túy, KHÔNG markdown (không \`\`\`sql), KHÔNG giải thích.
2. Tuyệt đối không dùng INSERT, UPDATE, DELETE, DROP, ALTER.
3. Luôn dùng LIMIT tối đa 20 dòng trừ khi câu hỏi yêu cầu đếm (COUNT) hoặc tổng hợp (SUM, AVG).
4. Phân quyền RBAC: Nếu người hỏi là vai trò thông thường (SALES, WAREHOUSE, DELIVERY), KHÔNG truy vấn bảng ledger_entries hay lương thưởng của người khác.
5. Khi so sánh chuỗi tiếng Việt hoặc tên, hãy dùng ILIKE '%...%' để tìm kiếm linh hoạt không phân biệt hoa thường.

Câu hỏi của người dùng: "${userPrompt}"${slotHints}
Vai trò người hỏi: ${userRole}
SQL Query:`;

      const result = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.05, maxOutputTokens: 500 }
      });

      let rawResponse = result.text?.trim() || '';
      let sql = '';

      // Trường hợp 1: Gemini trả về JSON theo chuẩn PHẦN 6
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.status === 'OK' && parsed.sql) {
            sql = parsed.sql.trim();
          } else if (parsed.status === 'FORBIDDEN' || parsed.status === 'UNSUPPORTED') {
            console.log(`[UniversalData] Gemini từ chối truy vấn: status=${parsed.status}`);
            return null;
          }
        } catch (e) {}
      }

      // Trường hợp 2: Gemini trả về chuỗi SQL thô hoặc bọc markdown
      if (!sql) {
        sql = rawResponse.replace(/```sql/gi, '').replace(/```/g, '').trim();
      }

      if (sql && isSafeSqlQuery(sql)) {
        return sql;
      }
    } catch (err) {
      console.warn('[UniversalData] Lỗi sinh SQL từ LLM, chuyển sang Semantic Pattern:', err.message);
    }
  }

  // 3. Fallback khi Gemini offline: Sử dụng trực tiếp SQL do Mô hình Tự Train sinh ra
  if (nluResult && nluResult.sql) {
    console.log(`[UniversalData] Mô hình NLU tự train nhận diện Slots → sinh SQL: "${nluResult.sql}"`);
    return nluResult.sql;
  }

  // 3. Fallback sang Bộ quy tắc ngữ nghĩa mở rộng
  return generateSqlBySemanticPattern(userPrompt, userRole);
};

/**
 * Hàm điều phối thực thi câu hỏi dữ liệu toàn năng (Universal Live Data Query)
 * @param {string} promptText - Câu hỏi người dùng
 * @param {Object} user - Người dùng đang đăng nhập
 * @returns {Promise<{success: boolean, finalResponse: string, sqlUsed: string, rowCount: number}|null>}
 */
const executeUniversalDataQuery = async (promptText, user) => {
  const userRole = user?.role || 'SALES';

  // 1. Sinh câu lệnh SQL tối ưu từ câu hỏi tự nhiên
  const generatedSql = await generateSqlFromQuestion(promptText, userRole);
  if (!generatedSql) {
    return null;
  }

  // 2. Kiểm duyệt an toàn (Security Guardrail)
  if (!isSafeSqlQuery(generatedSql)) {
    console.warn('[UniversalData] Cảnh báo an ninh: Câu SQL bị chặn do không an toàn:', generatedSql);
    return {
      success: false,
      finalResponse: '⚠️ Yêu cầu dữ liệu này bị từ chối do vi phạm quy tắc an toàn bảo mật cơ sở dữ liệu (Chỉ hỗ trợ truy vấn đọc dữ liệu hợp lệ).',
      sqlUsed: null,
      rowCount: 0
    };
  }

  // Thay thế :userId nếu có (lọc theo người dùng hiện tại)
  const currentUserId = Number(user?.id) || 0;
  const finalExecutableSql = generatedSql.replace(/:userId/g, currentUserId.toString());

  console.log(`[UniversalData] Thực thi SQL an toàn: "${finalExecutableSql}"`);

  // 3. Thực thi truy vấn đọc dữ liệu trên PostgreSQL
  let rawData = [];
  try {
    rawData = await prisma.$queryRawUnsafe(finalExecutableSql);
  } catch (dbErr) {
    console.warn('[UniversalData] Lỗi thực thi SQL trên database:', dbErr.message);
    return null;
  }

  // 4. Định dạng dữ liệu an toàn & tổng hợp câu trả lời tự nhiên
  // Format lại các kiểu dữ liệu BigInt / Decimal / Date sang dạng JSON serialize được
  const cleanData = JSON.parse(JSON.stringify(rawData, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));

  const rowCount = cleanData.length;

  if (rowCount === 0) {
    return {
      success: true,
      finalResponse: `🔍 **Kết quả truy vấn dữ liệu thời gian thực:**\n\nKhông tìm thấy bản ghi dữ liệu nào trong hệ thống AetherPC khớp với yêu cầu: *"${promptText}"*.`,
      sqlUsed: generatedSql,
      rowCount: 0
    };
  }

  // 5. Cho Gemini đọc kết quả thô từ Database và trình bày dạng bảng / tóm tắt chuyên nghiệp
  let finalAiResponse = '';
  const aiClientSummary = getAiClient();
  if (aiClientSummary) {
    try {
      const summaryPrompt = `Bạn là trợ lý AetherCopilot của hệ thống AetherPC ERP.
Dữ liệu thực tế trích xuất trực tiếp từ Cơ sở dữ liệu PostgreSQL (${rowCount} bản ghi):
\`\`\`json
${JSON.stringify(cleanData.slice(0, 15), null, 2)}
\`\`\`

Câu hỏi của người dùng: "${promptText}"
Vai trò người hỏi: ${userRole}

Nhiệm vụ:
- Trả lời trực tiếp, tự nhiên và chuẩn xác vào câu hỏi.
- Nếu là câu hỏi tổng hợp doanh thu/số lượng: Nêu rõ con số cụ thể kèm định dạng tiền tệ VND (ví dụ: "Tổng doanh thu năm nay của AetherPC là **10.718.796.960 VNĐ**...").
- Nếu là danh sách đơn/sản phẩm: Liệt kê rõ ràng dạng Markdown (gạch đầu dòng hoặc bảng).
- Định dạng Markdown đẹp mắt, chuyên nghiệp.`;

      const aiGen = await aiClientSummary.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
        config: { temperature: 0.2, maxOutputTokens: 1500 }
      });

      if (aiGen.text && aiGen.text.length > 50) {
        finalAiResponse = aiGen.text;
      }
    } catch (e) {
      console.warn('[UniversalData] Lỗi tổng hợp phản hồi từ Gemini:', e.message);
    }
  }

  // Fallback định dạng danh sách thẻ nếu Gemini tạm thời offline
  if (!finalAiResponse) {
    const keys = Object.keys(cleanData[0] || {});
    // Trình bày theo dạng danh sách thẻ rõ ràng, trực quan, thân thiện với bubble chat
    const formattedCards = cleanData.map((row, idx) => {
      const details = keys.map(k => {
        let label = k.replace(/_/g, ' ').toUpperCase();
        let val = row[k];
        if (val === null || val === undefined) val = '—';
        const isMoneyField = k.includes('amount') || k.includes('price') || k.includes('gia') || k.includes('tien');
        if (isMoneyField && !isNaN(Number(val)) && val !== '') {
          val = Number(val).toLocaleString('vi-VN') + ' đ';
        } else if (k.includes('created_at') && typeof val === 'string') {
          try { val = new Date(val).toLocaleString('vi-VN'); } catch (_) {}
        }
        return `  • **${label}:** ${val}`;
      }).join('\n');
      return `**#${idx + 1}. ${row.order_id || row.name || row.po_number || row.ticket_code || 'Bản ghi'}**\n${details}`;
    }).join('\n\n');

    finalAiResponse = `📊 **Kết quả trích xuất dữ liệu thời gian thực (${rowCount} bản ghi):**\n\n` +
      `${formattedCards}\n\n` +
      `*(Dữ liệu được truy vấn trực tiếp từ cơ sở dữ liệu AetherPC ERP theo chuẩn phân quyền)*`;
  }

  return {
    success: true,
    finalResponse: finalAiResponse,
    sqlUsed: generatedSql,
    rowCount
  };
};

module.exports = {
  executeUniversalDataQuery,
  isSafeSqlQuery,
  generateSqlFromQuestion
};
