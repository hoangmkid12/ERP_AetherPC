/**
 * BỘ THỰC THI SQL AN TOÀN CHO AI (dùng chung cho mọi nơi chạy SQL do AI / Admin sinh ra)
 *
 * Trước đây SQL do Gemini sinh ra được chạy thẳng bằng prisma.$queryRawUnsafe với
 * user DB của ứng dụng (superuser), chỉ được "bảo vệ" bởi một danh sách từ khoá
 * và lời dặn RBAC trong prompt — prompt injection hoặc một câu SQL sai là đọc
 * được toàn bộ DB (dữ liệu khách hàng, lương, hàm hệ thống pg_read_file...).
 *
 * Giờ mọi câu SQL phải qua 4 lớp, lớp sau không tin lớp trước:
 *   1. Kiểm tra văn bản: đúng 1 câu SELECT/WITH, chặn hàm hệ thống, comment,
 *      dollar-quote, SELECT INTO, FOR UPDATE, schema hệ thống...
 *   2. Giao dịch READ ONLY + statement_timeout: Postgres tự từ chối mọi thao tác ghi.
 *   3. EXPLAIN (VERBOSE, FORMAT JSON): hỏi chính Postgres xem câu SQL đọc những
 *      BẢNG nào, CỘT nào (kể cả trong subquery/CTE/view) rồi đối chiếu với danh
 *      sách được phép theo vai trò — không tự đoán tên bảng bằng regex.
 *   4. Cột nhạy cảm: mật khẩu, khuôn mặt, tài khoản ngân hàng/MST nhân viên bị chặn
 *      với mọi vai trò; lương chỉ HR/Kế toán/Ban giám đốc; SĐT/email/địa chỉ khách
 *      hàng chỉ Sales/CSKH/Kế toán/Ban giám đốc.
 *
 * Nếu cấu hình DATABASE_URL_AI_READONLY (user Postgres chỉ có quyền SELECT, xem
 * prisma/sql/create-ai-readonly-role.sql) thì truy vấn chạy bằng user đó — lớp
 * phòng thủ thứ 5 ở mức cơ sở dữ liệu.
 */
const prisma = require('../../config/database');

// ---------------------------------------------------------------------------
// Phân quyền bảng theo nhóm vai trò
// ---------------------------------------------------------------------------
const CATALOG = ['categories', 'brands', 'products', 'product_variants', 'product_images', 'promotions', 'product_reviews', 'warehouses', 'holidays'];
const SALES_OPS = ['orders', 'order_items', 'order_status_history', 'customers', 'customer_addresses', 'customer_segments', 'return_requests', 'complaints', 'serial_numbers'];
const WAREHOUSE_OPS = [
  'orders', 'order_items', 'order_status_history', 'inventory', 'stock_movements', 'warehouse_locations',
  'purchase_requests', 'stock_intake_requests', 'suppliers', 'supplier_contacts', 'supplier_evaluations',
  'purchase_orders', 'purchase_order_items', 'purchase_order_status_history', 'goods_receipts',
  'assembly_jobs', 'assembly_logs', 'boms', 'bom_items', 'work_orders', 'serial_numbers', 'return_requests', 'qc_inspections'
];
const FINANCE = [
  'orders', 'order_items', 'order_payments', 'ledger_entries', 'company_bank_accounts', 'vendor_bills', 'vendor_payments',
  'purchase_orders', 'purchase_order_items', 'suppliers', 'customers', 'return_requests', 'payrolls', 'employees'
];
const HR = ['employees', 'attendances', 'leave_requests', 'payrolls', 'holidays'];
const QC = ['qc_inspections', 'goods_receipts', 'purchase_orders', 'purchase_order_items', 'return_requests', 'serial_numbers', 'suppliers', 'supplier_evaluations', 'assembly_jobs', 'assembly_logs'];

// Bảng không bao giờ cho AI đọc, kể cả Ban giám đốc: cấu hình/khoá tích hợp,
// dữ liệu nhị phân lớn.
const NEVER_TABLES = new Set(['company_settings', 'product_image_blobs', 'chat_attachments', '_prisma_migrations']);

const ACCESS_GROUPS = {
  EXEC: null, // null = mọi bảng public trừ NEVER_TABLES
  ACCOUNTANT: [...CATALOG, ...FINANCE],
  SALES: [...CATALOG, ...SALES_OPS],
  WAREHOUSE: [...CATALOG, ...WAREHOUSE_OPS],
  QC: [...CATALOG, ...QC],
  HR: [...CATALOG, ...HR],
  BASIC: [...CATALOG] // Shipper, nhân viên chung: chỉ danh mục sản phẩm. Dữ liệu đơn
                      // của chính shipper đi qua kỹ năng offline đã lọc theo người dùng.
};

const accessGroupOf = (role) => {
  const r = String(role || '').toUpperCase();
  if (r === 'CEO' || r === 'ADMIN') return 'EXEC';
  if (r === 'ACCOUNTANT') return 'ACCOUNTANT';
  if (['SALES', 'SALES_MANAGER', 'CSKH'].includes(r)) return 'SALES';
  if (['WAREHOUSE', 'WAREHOUSE_MANAGER', 'PURCHASING', 'ASSEMBLY'].includes(r)) return 'WAREHOUSE';
  if (['QC', 'QA', 'QUALITY_CONTROL'].includes(r)) return 'QC';
  if (r === 'HR') return 'HR';
  if (['DELIVERY', 'EMPLOYEE'].includes(r)) return 'BASIC';
  return null; // CUSTOMER, SUPPLIER, vai trò lạ: không được chạy SQL
};

// ---------------------------------------------------------------------------
// Cột nhạy cảm
// ---------------------------------------------------------------------------
// Chặn với mọi vai trò (khớp theo tên cột, bất kể bảng)
const NEVER_COLUMN_PATTERN = /^(password_hash|password|face_descriptor|face_image|personal_tax_code|bank_account|bank_account_no|bank_account_name)$|token|secret|api_?key|otp/;

const SALARY_COLUMNS = {
  employees: ['base_salary', 'responsibility_allowance', 'allowance'],
  payrolls: ['base_salary', 'allowances', 'net_salary', 'contract_salary', 'gross_salary', 'insurance_salary']
};
const CUSTOMER_PII_COLUMNS = {
  customers: ['email', 'phone', 'address'],
  customer_addresses: ['recipient_name', 'recipient_phone', 'address_line'],
  complaints: ['phone', 'email'],
  return_requests: ['phone', 'address']
};
const SALARY_GROUPS = new Set(['EXEC', 'HR', 'ACCOUNTANT']);
const CUSTOMER_PII_GROUPS = new Set(['EXEC', 'SALES', 'ACCOUNTANT']);

// ---------------------------------------------------------------------------
// Lớp 1: kiểm tra văn bản SQL
// ---------------------------------------------------------------------------
// Kiểm tra trên bản đã bỏ nội dung chuỗi '...' (nội dung chuỗi không thực thi
// được, và tiếng Việt trong ILIKE '%lý do%' không được làm chặn nhầm). Câu lệnh
// bắt buộc mở đầu bằng SELECT/WITH và chỉ có 1 câu, nên DDL/lệnh khác chỉ có thể
// lọt vào qua CTE ghi dữ liệu (WITH x AS (DELETE ...)) — đó là các từ khoá cần chặn;
// mọi thao tác ghi khác còn bị giao dịch READ ONLY chặn ở lớp 2.
const LEXICAL_DENY = [
  [/;/, 'chỉ được 1 câu lệnh'],
  [/--|\/\*/, 'không cho phép comment trong SQL'],
  [/\$[a-z_0-9]*\$/i, 'không cho phép dollar-quote'],
  [/\b(insert|update|delete|merge|truncate)\b/i, 'chỉ được phép đọc dữ liệu'],
  [/\binto\b/i, 'không cho phép SELECT INTO'],
  [/\bfor\s+(update|share|no\s+key|key)\b/i, 'không cho phép khoá dòng'],
  [/\b(pg_\w+|information_schema|lo_\w+|dblink\w*|current_setting|set_config|txid_\w+|query_to_\w+|table_to_\w+|schema_to_\w+|database_to_\w+|cursor_to_\w+|xpath\w*|inet_server_\w+|inet_client_\w+)\b/i, 'không cho phép truy cập hàm/bảng hệ thống'],
  [/\bversion\s*\(|\bcurrent_(user|role|schema|database|catalog)\b|\bsession_user\b|\buser\s*\(/i, 'không cho phép đọc thông tin hệ thống / phiên DB'],
  [/\b(nextval|setval|currval|lastval)\s*\(/i, 'không cho phép thao tác sequence'],
];

const stripStringLiterals = (sql) => sql.replace(/'(?:[^']|'')*'/g, "''");

const assertLexicallySafe = (sql) => {
  if (!sql || typeof sql !== 'string') throw denial('Câu truy vấn rỗng.');
  const clean = sql.trim().replace(/;\s*$/, '').trim();
  if (clean.length > 4000) throw denial('Câu truy vấn quá dài.');
  if (/\bu&['"]/i.test(clean)) throw denial('Truy vấn bị chặn: không cho phép chuỗi unicode-escape.');
  if ((clean.match(/'/g) || []).length % 2 !== 0) throw denial('Truy vấn bị chặn: chuỗi ký tự không đóng.');
  const code = stripStringLiterals(clean);
  if (!/^(select|with)\b/i.test(code)) throw denial('Chỉ được phép truy vấn đọc (SELECT).');
  for (const [re, reason] of LEXICAL_DENY) {
    if (re.test(code)) throw denial(`Truy vấn bị chặn: ${reason}.`);
  }
  return clean;
};

// ---------------------------------------------------------------------------
// Lớp 3 & 4: phân tích kế hoạch thực thi
// ---------------------------------------------------------------------------
// Các trường biểu thức của nút quét bảng (cột đọc ra / điều kiện lọc). Không lấy
// các trường siêu dữ liệu ("Relation Name", "Alias"...) — tên bảng ở đó sẽ bị hiểu
// nhầm thành tham chiếu cả dòng.
const SCAN_EXPRESSION_FIELDS = ['Output', 'Filter', 'Index Cond', 'Recheck Cond', 'TID Cond', 'Order By', 'Sort Key', 'Group Key'];

function collectScans(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (node['Relation Name']) {
    out.push({
      relation: node['Relation Name'],
      schema: node.Schema,
      alias: node.Alias || node['Relation Name'],
      texts: SCAN_EXPRESSION_FIELDS.flatMap(f => (node[f] == null ? [] : [].concat(node[f]))).filter(v => typeof v === 'string')
    });
  }
  for (const child of node.Plans || []) collectScans(child, out);
  return out;
}

// Các cột 1 nút quét bảng đọc ra. Trong EXPLAIN VERBOSE, truy vấn 1 bảng in tên
// cột KHÔNG kèm tiền tố ("password_hash"), truy vấn nhiều bảng in kèm alias
// ("e.password_hash") — xử lý cả hai. Tham chiếu cả dòng ("e.*", row_to_json(e))
// trả về MỌI cột nên được đánh dấu bằng '*'. Trong nút quét của 1 bảng, mọi định
// danh trần đều thuộc bảng đó, nên coi mọi định danh là ứng viên tên cột (thừa
// còn hơn sót: định danh không phải cột không trùng tên cột nhạy cảm).
function columnsReadFrom(scan) {
  const cols = new Set();
  const alias = scan.alias.toLowerCase();
  const tokenRe = /"?([a-z_][a-z0-9_$]*)"?(?:\s*\.\s*(?:"?([a-z_][a-z0-9_$]*)"?|(\*)))?/gi;
  for (const t of scan.texts) {
    const code = String(t).replace(/'(?:[^']|'')*'/g, "''").toLowerCase();
    let m;
    while ((m = tokenRe.exec(code)) !== null) {
      const [, first, second, star] = m;
      if (star) {
        if (first === alias) cols.add('*');
      } else if (second) {
        if (first === alias) cols.add(second);
      } else if (first === alias) {
        cols.add('*'); // tham chiếu cả dòng: row_to_json(e), e::text...
      } else {
        cols.add(first);
      }
    }
  }
  return cols;
}

// Bảng có cột bí mật tuyệt đối — không được đọc cả dòng (SELECT e.*, row_to_json(e))
const TABLES_WITH_SECRET_COLUMNS = new Set(['employees', 'customers', 'suppliers', 'return_requests']);

const checkPlan = (planJson, group) => {
  const plan = Array.isArray(planJson) ? planJson[0]?.Plan : planJson?.Plan;
  if (!plan) throw denial('Không phân tích được truy vấn.');

  // Hàm hệ thống có thể chỉ lộ ra trong kế hoạch (VD qua view)
  const planText = JSON.stringify(planJson).toLowerCase();
  if (/\bpg_(read|ls|stat_file|terminate|cancel|sleep|reload|rotate|file)|\blo_(import|export|get)|\bdblink/.test(planText)) {
    throw denial('Truy vấn bị chặn: gọi hàm hệ thống.');
  }

  const allowed = ACCESS_GROUPS[group];
  const scans = collectScans(plan);
  for (const scan of scans) {
    const table = String(scan.relation).toLowerCase();
    if (scan.schema && scan.schema !== 'public') throw denial(`Không được truy cập schema "${scan.schema}".`);
    if (NEVER_TABLES.has(table)) throw denial(`Bảng "${table}" không mở cho trợ lý AI.`);
    if (allowed && !allowed.includes(table)) throw denial(`Vai trò của bạn không được xem dữ liệu bảng "${table}".`);

    const cols = columnsReadFrom(scan);
    if (cols.has('*')) {
      const restricted = TABLES_WITH_SECRET_COLUMNS.has(table) ||
        (SALARY_COLUMNS[table] && !SALARY_GROUPS.has(group)) ||
        (CUSTOMER_PII_COLUMNS[table] && !CUSTOMER_PII_GROUPS.has(group));
      if (restricted) throw denial(`Không được lấy toàn bộ dòng của bảng "${table}" — hãy chọn rõ từng cột cần xem.`);
    }
    for (const col of cols) {
      if (NEVER_COLUMN_PATTERN.test(col)) throw denial(`Cột "${table}.${col}" là dữ liệu bảo mật, trợ lý AI không được đọc.`);
      if ((SALARY_COLUMNS[table] || []).includes(col) && !SALARY_GROUPS.has(group)) {
        throw denial('Vai trò của bạn không được xem thông tin lương.');
      }
      if ((CUSTOMER_PII_COLUMNS[table] || []).includes(col) && !CUSTOMER_PII_GROUPS.has(group)) {
        throw denial('Vai trò của bạn không được xem thông tin liên hệ của khách hàng.');
      }
    }
  }
  return scans.map(s => String(s.relation).toLowerCase());
};

// ---------------------------------------------------------------------------
// Thực thi
// ---------------------------------------------------------------------------
class AiSqlDeniedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiSqlDeniedError';
    this.isDenied = true;
  }
}
function denial(message) { return new AiSqlDeniedError(message); }

let readonlyClient = null;
const getClient = () => {
  if (!process.env.DATABASE_URL_AI_READONLY) return prisma;
  if (!readonlyClient) {
    const { PrismaClient } = require('@prisma/client');
    readonlyClient = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_AI_READONLY } } });
  }
  return readonlyClient;
};

const MAX_ROWS = 200;
const STATEMENT_TIMEOUT_MS = 5000;

/**
 * Chạy 1 câu SELECT do AI/Admin sinh ra với quyền của người dùng hiện tại.
 * @returns {Promise<{ rows: object[], tables: string[], truncated: boolean }>}
 * @throws {AiSqlDeniedError} khi bị chặn vì quyền / an toàn (err.isDenied = true)
 * @throws {Error} lỗi cú pháp / thực thi SQL thông thường
 */
const executeSafeAiSql = async (sql, user) => {
  const group = accessGroupOf(user?.role);
  if (!group) throw denial('Tài khoản của bạn không được dùng chức năng truy vấn dữ liệu của trợ lý AI.');

  let clean = assertLexicallySafe(sql);
  const userId = Number(user?.id);
  clean = clean.replace(/:userId\b/g, Number.isInteger(userId) ? String(userId) : '0');

  const client = getClient();
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await tx.$executeRawUnsafe('SET LOCAL lock_timeout = 2000');

    const explained = await tx.$queryRawUnsafe(`EXPLAIN (VERBOSE, FORMAT JSON) ${clean}`);
    const planJson = explained?.[0]?.['QUERY PLAN'];
    const tables = checkPlan(planJson, group);

    const raw = await tx.$queryRawUnsafe(clean);
    const rows = JSON.parse(JSON.stringify(raw, (k, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return { rows: rows.slice(0, MAX_ROWS), tables, truncated: rows.length > MAX_ROWS };
  }, { maxWait: 5000, timeout: STATEMENT_TIMEOUT_MS * 2 + 2000 });
};

/**
 * Vai trò (nhóm quyền) có được đọc bảng / cột này không — dùng để mô tả DB cho AI chỉ
 * liệt kê đúng những gì vai trò được đọc (khớp với các lớp chặn ở trên).
 */
const isTableReadable = (table, group) => {
  if (!group || NEVER_TABLES.has(table)) return false;
  const allowed = ACCESS_GROUPS[group];
  return allowed === null || allowed.includes(table);
};
const isColumnReadable = (table, col, group) => {
  if (!isTableReadable(table, group)) return false;
  if (NEVER_COLUMN_PATTERN.test(col)) return false;
  if ((SALARY_COLUMNS[table] || []).includes(col) && !SALARY_GROUPS.has(group)) return false;
  if ((CUSTOMER_PII_COLUMNS[table] || []).includes(col) && !CUSTOMER_PII_GROUPS.has(group)) return false;
  return true;
};

module.exports = {
  executeSafeAiSql,
  isTableReadable,
  isColumnReadable,
  accessGroupOf,
  assertLexicallySafe,
  checkPlan,
  AiSqlDeniedError,
  ACCESS_GROUPS
};
