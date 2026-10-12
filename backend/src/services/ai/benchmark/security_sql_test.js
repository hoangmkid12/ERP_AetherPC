/**
 * Kiểm thử bảo mật cho safeSqlExecutor (SQL do AI sinh ra).
 *
 *   node src/services/ai/benchmark/security_sql_test.js
 *
 * Chạy trên DB đang cấu hình nhưng CHỈ ĐỌC: câu tấn công bị chặn ở lớp kiểm tra
 * văn bản hoặc ở bước EXPLAIN (không thực thi); câu hợp lệ chạy trong giao dịch
 * READ ONLY. Không có câu nào ghi dữ liệu.
 */
const prisma = require('../../../config/database');
const { executeSafeAiSql } = require('../safeSqlExecutor');

const U = (role, id = 1) => ({ role, id });

// [mô tả, user, sql, 'ALLOW' | 'DENY']
const CASES = [
  // --- Phải CHO PHÉP ---
  ['Sales xem giá sản phẩm', U('SALES'), "SELECT product_id, name, price, stock_quantity FROM products WHERE status = 'ACTIVE' LIMIT 5", 'ALLOW'],
  ['Sales tìm sản phẩm theo chuỗi tiếng Việt có chữ "do"', U('SALES'), "SELECT name FROM products WHERE name ILIKE '%lý do%' LIMIT 5", 'ALLOW'],
  ['Sales xem SĐT khách', U('SALES'), 'SELECT name, phone FROM customers LIMIT 3', 'ALLOW'],
  ['Sales xem đánh giá (cột comment)', U('SALES'), 'SELECT rating, comment FROM product_reviews LIMIT 3', 'ALLOW'],
  ['Kế toán xem sổ cái', U('ACCOUNTANT'), 'SELECT type, SUM(amount) AS tong FROM ledger_entries GROUP BY type', 'ALLOW'],
  ['Kế toán xem lương', U('ACCOUNTANT'), 'SELECT employee_id, net_salary FROM payrolls LIMIT 3', 'ALLOW'],
  ['Kho xem nhà cung cấp', U('WAREHOUSE'), 'SELECT code, name, phone FROM suppliers LIMIT 3', 'ALLOW'],
  ['HR xem lương nhân viên', U('HR'), 'SELECT full_name, base_salary FROM employees LIMIT 3', 'ALLOW'],
  ['CEO xem tổng hợp qua CTE', U('CEO'), 'WITH t AS (SELECT status, COUNT(*) c FROM orders GROUP BY status) SELECT * FROM t', 'ALLOW'],
  ['Shipper xem danh mục sản phẩm', U('DELIVERY'), 'SELECT name, price FROM products LIMIT 3', 'ALLOW'],

  // --- Phải CHẶN: vai trò / bảng ---
  ['Khách hàng chạy SQL', U('CUSTOMER'), 'SELECT name FROM products LIMIT 1', 'DENY'],
  ['Nhà cung cấp chạy SQL', U('SUPPLIER'), 'SELECT name FROM products LIMIT 1', 'DENY'],
  ['Shipper xem nhà cung cấp', U('DELIVERY'), 'SELECT code, name, phone, email FROM suppliers LIMIT 15', 'DENY'],
  ['Shipper xem đơn của mọi khách', U('DELIVERY'), 'SELECT order_id, total_amount FROM orders LIMIT 5', 'DENY'],
  ['Shipper xem doanh thu', U('DELIVERY'), "SELECT SUM(total_amount) FROM orders WHERE status = 'DELIVERED'", 'DENY'],
  ['Sales xem sổ cái', U('SALES'), 'SELECT * FROM ledger_entries LIMIT 5', 'DENY'],
  ['Sales xem số dư ngân hàng', U('SALES'), 'SELECT bank_name, current_balance FROM company_bank_accounts', 'DENY'],
  ['Sales xem lương qua subquery', U('SALES'), 'SELECT name FROM products WHERE price > (SELECT MAX(base_salary) FROM employees)', 'DENY'],
  ['Sales giấu bảng trong CTE', U('SALES'), 'WITH x AS (SELECT full_name FROM employees) SELECT * FROM x', 'DENY'],
  ['Kho xem SĐT khách hàng', U('WAREHOUSE'), 'SELECT o.order_id, c.phone FROM orders o JOIN customers c ON c.customer_id = o.customer_id LIMIT 3', 'DENY'],
  ['Kế toán xem bảng chat', U('ACCOUNTANT'), 'SELECT * FROM chat_messages LIMIT 3', 'DENY'],
  ['CEO đọc cấu hình công ty', U('CEO'), 'SELECT * FROM company_settings', 'DENY'],
  ['CEO đọc bảng migrations', U('CEO'), 'SELECT * FROM _prisma_migrations', 'DENY'],

  // --- Phải CHẶN: cột bảo mật ---
  ['CEO đọc mật khẩu nhân viên', U('CEO'), 'SELECT email, password_hash FROM employees LIMIT 3', 'DENY'],
  ['CEO đọc mật khẩu qua alias', U('CEO'), 'SELECT e.password_hash AS x FROM employees e LIMIT 1', 'DENY'],
  ['CEO SELECT * khách hàng (có password_hash)', U('CEO'), 'SELECT * FROM customers LIMIT 1', 'DENY'],
  ['CEO đọc dữ liệu khuôn mặt', U('CEO'), 'SELECT full_name, face_descriptor FROM employees LIMIT 1', 'DENY'],
  ['HR đọc tài khoản ngân hàng nhân viên', U('HR'), 'SELECT full_name, bank_account FROM employees LIMIT 1', 'DENY'],
  ['Mật khẩu lọt qua điều kiện WHERE', U('CEO'), "SELECT email FROM employees WHERE password_hash LIKE '$2%' LIMIT 1", 'DENY'],
  ['Lấy cả dòng qua row_to_json', U('CEO'), 'SELECT row_to_json(e) FROM employees e LIMIT 1', 'DENY'],
  ['Lấy cả dòng qua e.*', U('HR'), 'SELECT e.* FROM employees e LIMIT 1', 'DENY'],
  ['Lấy cả dòng ép kiểu text', U('CEO'), 'SELECT c::text FROM customers c LIMIT 1', 'DENY'],
  ['Kế toán xem lương qua JOIN nhiều bảng', U('ACCOUNTANT'), 'SELECT o.order_id, e.base_salary FROM orders o JOIN employees e ON e.id = o.assigned_shipper_id LIMIT 1', 'ALLOW'],
  ['Sales lọc khách theo SĐT trong WHERE', U('SALES'), "SELECT name FROM customers WHERE phone LIKE '09%' LIMIT 1", 'ALLOW'],
  ['Shipper đọc SĐT khách qua bảng complaints', U('DELIVERY'), 'SELECT phone FROM complaints LIMIT 1', 'DENY'],
  ['Cả dòng bảng không nhạy cảm vẫn được', U('SALES'), 'SELECT p.* FROM products p LIMIT 1', 'ALLOW'],

  // --- Phải CHẶN: ghi dữ liệu / hệ thống ---
  ['Nhiều câu lệnh', U('CEO'), 'SELECT 1; DELETE FROM orders', 'DENY'],
  ['CTE xoá dữ liệu', U('CEO'), 'WITH d AS (DELETE FROM orders RETURNING *) SELECT * FROM d', 'DENY'],
  ['SELECT INTO tạo bảng', U('CEO'), 'SELECT * INTO hack FROM products', 'DENY'],
  ['Khoá dòng FOR UPDATE', U('CEO'), 'SELECT * FROM products FOR UPDATE', 'DENY'],
  ['Đọc file hệ thống', U('CEO'), "SELECT pg_read_file('/etc/passwd')", 'DENY'],
  ['Ngủ treo DB', U('CEO'), 'SELECT pg_sleep(30)', 'DENY'],
  ['Đọc catalog hệ thống', U('CEO'), 'SELECT * FROM information_schema.tables', 'DENY'],
  ['Đọc pg_shadow qua schema', U('CEO'), 'SELECT usename, passwd FROM pg_catalog.pg_shadow', 'DENY'],
  ['Đọc biến cấu hình', U('CEO'), "SELECT current_setting('data_directory')", 'DENY'],
  ['Comment che giấu', U('CEO'), 'SELECT name FROM products /* ; drop */ LIMIT 1', 'DENY'],
  ['Dollar-quote', U('CEO'), 'SELECT $$x$$', 'DENY'],
  ['Không phải SELECT', U('CEO'), 'UPDATE products SET price = 0', 'DENY'],
  ['Unicode-escape định danh', U('CEO'), 'SELECT U&"\\0070g_sleep"(1)', 'DENY'],
  ['Gọi hàm ghi setval (sequence có thật)', U('CEO'), "SELECT setval('employees_id_seq', 1)", 'DENY'],
  ['Gọi hàm ghi nextval', U('CEO'), "SELECT nextval('employees_id_seq')", 'DENY'],
];

(async () => {
  let pass = 0;
  const fails = [];
  for (const [desc, user, sql, expect] of CASES) {
    let outcome;
    let detail = '';
    try {
      const r = await executeSafeAiSql(sql, user);
      outcome = 'ALLOW';
      detail = `${r.rows.length} dòng, bảng: ${r.tables.join(',') || '-'}`;
    } catch (e) {
      outcome = 'DENY';
      detail = (e.isDenied ? '' : '[lỗi SQL] ') + e.message.split('\n').slice(-1)[0].slice(0, 110);
    }
    const ok = outcome === expect;
    if (ok) pass++; else fails.push(desc);
    console.log(`${ok ? '✅' : '❌'} [${expect}] ${desc} → ${outcome}: ${detail}`);
  }
  console.log(`\nKết quả lớp ứng dụng: ${pass}/${CASES.length} đúng${fails.length ? ' — SAI: ' + fails.join(' | ') : ''}`);

  // --- Lớp cơ sở dữ liệu: dùng THẲNG user chỉ-đọc, cố tình đi vòng qua
  // safeSqlExecutor, để chứng minh lớp này tự đứng vững. Câu ghi có WHERE false
  // nên không thể đổi dữ liệu kể cả nếu (lỗi) có quyền ghi.
  let dbFails = 0;
  if (process.env.DATABASE_URL_AI_READONLY) {
    const { PrismaClient } = require('@prisma/client');
    const ro = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_AI_READONLY } } });
    const DB_CASES = [
      ['User AI đọc bảng nghiệp vụ', 'SELECT name FROM products LIMIT 1', 'ALLOW'],
      ['User AI đọc cột không bí mật của employees', 'SELECT full_name FROM employees LIMIT 1', 'ALLOW'],
      ['User AI ghi dữ liệu (UPDATE ... WHERE false)', 'UPDATE products SET price = price WHERE false', 'DENY'],
      ['User AI xoá dữ liệu (DELETE ... WHERE false)', 'DELETE FROM orders WHERE false', 'DENY'],
      ['User AI đọc mật khẩu', 'SELECT password_hash FROM employees LIMIT 0', 'DENY'],
      ['User AI đọc khuôn mặt', 'SELECT face_descriptor FROM employees LIMIT 0', 'DENY'],
      ['User AI đọc cấu hình công ty', 'SELECT 1 FROM company_settings LIMIT 0', 'DENY'],
      ['User AI đọc file hệ thống', "SELECT pg_read_file('/etc/hostname')", 'DENY'],
      ['User AI tạo bảng', 'CREATE TABLE ai_hack (id int)', 'DENY'],
    ];
    console.log('\n--- Lớp cơ sở dữ liệu (user aether_ai_readonly) ---');
    for (const [desc, sql, expect] of DB_CASES) {
      let outcome, detail = '';
      try {
        if (/^select/i.test(sql)) await ro.$queryRawUnsafe(sql); else await ro.$executeRawUnsafe(sql);
        outcome = 'ALLOW';
      } catch (e) {
        outcome = 'DENY';
        detail = (e.message.match(/Message: `([^`]+)`/) || [])[1] || e.message.split('\n').pop();
      }
      const ok = outcome === expect;
      if (!ok) dbFails++;
      console.log(`${ok ? '✅' : '❌'} [${expect}] ${desc} → ${outcome}${detail ? ': ' + detail.slice(0, 90) : ''}`);
    }
    await ro.$disconnect();
    console.log(`Kết quả lớp DB: ${DB_CASES.length - dbFails}/${DB_CASES.length} đúng`);
  } else {
    console.log('\n(Bỏ qua lớp DB: chưa cấu hình DATABASE_URL_AI_READONLY)');
  }

  await prisma.$disconnect();
  process.exit(fails.length || dbFails ? 1 : 0);
})();
