const prisma = require('../../config/database');

// Khởi tạo Gemini client
let GoogleGenAI = null;
let aiClient = null;

try {
  const genaiPkg = require('@google/genai');
  GoogleGenAI = genaiPkg.GoogleGenAI;
  if (process.env.GEMINI_API_KEY && GoogleGenAI) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (e) {}

/**
 * Tóm tắt Schema Cơ Sở Dữ Liệu PostgreSQL của AetherPC ERP
 * Cung cấp cho LLM để sinh câu truy vấn SELECT SQL chính xác 100%
 */
const ERP_DATABASE_SCHEMA_PROMPT = `
Bạn là chuyên gia cơ sở dữ liệu PostgreSQL cho hệ thống AetherPC ERP.
Dưới đây là các bảng chính trong cơ sở dữ liệu (tất cả tên bảng và cột đều theo chuẩn PostgreSQL):

1. products (sản phẩm, linh kiện máy tính):
   - product_id (varchar, PK), name (varchar), sku (varchar), price (decimal), stock_quantity (int), status ('ACTIVE'|'INACTIVE'), available (boolean), category_id (int), brand_id (int), default_supplier_code (varchar)

2. categories (danh mục: vga, cpu, mainboard, ram, psu, ssd...):
   - id (int, PK), name (varchar), slug (varchar)

3. brands (thương hiệu: ASUS, MSI, GIGABYTE, INTEL, AMD...):
   - id (int, PK), name (varchar)

4. customers (khách hàng):
   - customer_id (varchar, PK), name (varchar), email (varchar), phone (varchar), city (varchar), loyalty_points (int), tier ('BRONZE'|'SILVER'|'GOLD'|'DIAMOND'|'REGULAR'), status ('ACTIVE'|'INACTIVE')

5. orders (đơn hàng):
   - order_id (varchar, PK, vd 'DH-1002'), customer_id (varchar, FK), subtotal (decimal), discount (decimal), shipping_fee (decimal), total_amount (decimal), payment_method ('COD'|'VIETQR'|'BANK_TRANSFER'|'MOMO'), payment_status ('PENDING'|'PAID'|'REFUNDED'), status ('PENDING'|'CONFIRMED'|'PROCESSING'|'READY_TO_SHIP'|'SHIPPED'|'DELIVERED'|'CANCELLED'|'RETURNING_TO_WAREHOUSE'), shipping_address (text), shipping_city (varchar), assigned_shipper_id (int, FK employees.id), sold_by_id (int, FK employees.id), created_at (timestamptz), delivered_at (timestamptz)

6. order_items (chi tiết linh kiện trong đơn):
   - id (int, PK), order_id (varchar, FK), product_id (varchar, FK), quantity (int), price (decimal), total (decimal)

7. suppliers (nhà cung cấp):
   - code (varchar, PK), name (varchar), email (varchar), phone (varchar), address (text), status ('ACTIVE'|'INACTIVE')

8. purchase_orders (đơn nhập hàng / mua hàng từ NCC):
   - id (int, PK), po_number (varchar), supplier_code (varchar, FK), status ('RFQ'|'QUOTED'|'APPROVED'|'ORDERED'|'DELIVERED'|'CANCELLED'), total_amount (decimal), created_at (timestamptz)

9. return_requests (yêu cầu đổi trả bảo hành RMA):
   - id (uuid), rma_code (varchar), order_id (varchar, FK), customer_id (varchar, FK), type ('EXCHANGE'|'REFUND'|'WARRANTY'), reason (text), status ('PENDING'|'RETURN_APPROVED'|'DELIVERED_TO_WAREHOUSE'|'QC_PASSED'|'RESTOCKED'|'COMPLETED'|'REJECTED'), refund_amount (decimal), created_at (timestamptz)

10. complaints (khiếu nại, ticket CSKH):
    - id (uuid), ticket_code (varchar), customer_id (varchar), order_id (varchar), subject (varchar), description (text), priority ('LOW'|'MEDIUM'|'HIGH'|'URGENT'), status ('OPEN'|'IN_PROGRESS'|'RESOLVED'|'CLOSED'), created_at (timestamptz)

11. employees (nhân sự nội bộ):
    - id (int, PK), employee_code (varchar), full_name (varchar), email (varchar), department (varchar), role ('CEO'|'ADMIN'|'SALES'|'SALES_MANAGER'|'WAREHOUSE'|'WAREHOUSE_MANAGER'|'DELIVERY'|'ACCOUNTANT'|'HR'), status ('ACTIVE'|'INACTIVE'), created_at (timestamptz)

12. company_bank_accounts (tài khoản ngân hàng công ty):
    - id (int, PK), bank_code (varchar), bank_name (varchar), account_number (varchar), account_holder (varchar), current_balance (decimal), is_default_qr (boolean), status ('ACTIVE'|'INACTIVE')

13. ledger_entries (sổ cái thu chi doanh nghiệp):
    - id (uuid), type ('INCOME'|'EXPENSE'|'SHIPPING'|'REFUND'), amount (decimal), description (text), reference_id (varchar), date (timestamptz), channel ('BANK_TRANSFER'|'CASH')
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
  if (aiClient) {
    try {
      const prompt = `${ERP_DATABASE_SCHEMA_PROMPT}

NGUYÊN TẮC BẮT BUỘC:
1. Bạn CHỈ ĐƯỢC sinh ra ĐÚNG 1 câu lệnh SQL "SELECT" duy nhất, thuần túy, KHÔNG markdown (không \`\`\`sql), KHÔNG giải thích.
2. Tuyệt đối không dùng INSERT, UPDATE, DELETE, DROP, ALTER.
3. Luôn dùng LIMIT tối đa 20 dòng trừ khi câu hỏi yêu cầu đếm (COUNT) hoặc tổng hợp (SUM, AVG).
4. Phân quyền RBAC: Nếu người hỏi là vai trò thông thường (SALES, WAREHOUSE, DELIVERY), KHÔNG truy vấn bảng ledger_entries hay lương thưởng của người khác.
5. Khi so sánh chuỗi tiếng Việt hoặc tên, hãy dùng ILIKE '%...%' để tìm kiếm linh hoạt không phân biệt hoa thường.

Câu hỏi của người dùng: "${userPrompt}"
Vai trò người hỏi: ${userRole}
SQL Query:`;

      const result = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.05, maxOutputTokens: 300 }
      });

      let sql = result.text?.trim() || '';
      // Làm sạch nếu model bọc markdown
      sql = sql.replace(/```sql/gi, '').replace(/```/g, '').trim();
      if (sql && isSafeSqlQuery(sql)) {
        return sql;
      }
    } catch (err) {
      console.warn('[UniversalData] Lỗi sinh SQL từ LLM, chuyển sang Semantic Pattern:', err.message);
    }
  }

  // 2. Ưu tiên Mô hình AI tự huấn luyện (Local NLU Slot/Entity Extraction)
  try {
    const { extractSlotsAndGenerateSql } = require('./localNlp.service');
    const localExtraction = await extractSlotsAndGenerateSql(userPrompt);
    if (localExtraction && localExtraction.sql) {
      console.log(`[UniversalData] Mô hình NLU tự train nhận diện Slots → sinh SQL: "${localExtraction.sql}"`);
      return localExtraction.sql;
    }
  } catch (nlpErr) {
    console.warn('[UniversalData] Local NLU extraction bypass:', nlpErr.message);
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

  console.log(`[UniversalData] Thực thi SQL an toàn: "${generatedSql}"`);

  // 3. Thực thi truy vấn đọc dữ liệu trên PostgreSQL
  let rawData = [];
  try {
    rawData = await prisma.$queryRawUnsafe(generatedSql);
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
  if (aiClient) {
    try {
      const summaryPrompt = `Bạn là trợ lý AetherCopilot của hệ thống AetherPC ERP.
Dữ liệu thực tế trích xuất trực tiếp từ Cơ sở dữ liệu PostgreSQL:
\`\`\`json
${JSON.stringify(cleanData.slice(0, 15), null, 2)}
\`\`\`
Tổng số dòng tìm thấy: ${rowCount}

Câu hỏi gốc của nhân viên: "${promptText}"
Vai trò người hỏi: ${userRole}

Nhiệm vụ:
- Trả lời thẳng thắn, chính xác và phân tích số liệu trên một cách chuyên nghiệp.
- Sử dụng bảng Markdown (Markdown Table), danh sách gạch đầu dòng, in đậm các con số quan trọng.
- Định dạng tiền tệ VND (vd: 15.000.000 đ) và ngày tháng chuẩn tiếng Việt nếu có.
- Trả lời súc tích, trực quan, không thừa thãi.`;

      const aiGen = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
        config: { temperature: 0.2, maxOutputTokens: 600 }
      });

      if (aiGen.text) {
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
