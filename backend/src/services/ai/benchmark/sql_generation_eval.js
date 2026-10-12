/**
 * ĐÁNH GIÁ KHẢ NĂNG SINH SQL ĐÚNG TỪ CÂU HỎI TIẾNG VIỆT (Gemini + mô tả DB)
 *
 *   node -r dotenv/config src/services/ai/benchmark/sql_generation_eval.js              # pipeline hiện tại
 *   node -r dotenv/config src/services/ai/benchmark/sql_generation_eval.js --baseline   # pipeline cũ (không tự sửa)
 *   node -r dotenv/config src/services/ai/benchmark/sql_generation_eval.js --check-refs # chỉ chạy SQL đáp án
 *
 * Cần DATABASE_URL (chỉ ĐỌC — mọi SQL chạy qua safeSqlExecutor, giao dịch READ ONLY) và
 * GEMINI_API_KEY. Mỗi câu hỏi có SQL ĐÁP ÁN viết tay; câu trả lời được tính ĐÚNG khi SQL
 * do hệ thống sinh ra chạy được và cho cùng kết quả với đáp án:
 *   - scalar: giá trị số đầu tiên của dòng đầu khớp đáp án
 *   - set:    có một cột trong kết quả trùng (không phân biệt thứ tự) với một cột của đáp án
 */
const prisma = require('../../../config/database');
const { executeSafeAiSql } = require('../safeSqlExecutor');
const uds = require('../universalData.service');

const CASES = [
  ['CEO', 'đếm số đơn hàng đã bị hủy', `SELECT COUNT(*) AS n FROM orders WHERE status = 'CANCELLED'`, 'scalar'],
  ['CEO', 'có bao nhiêu đơn hàng thanh toán bằng chuyển khoản', `SELECT COUNT(*) AS n FROM orders WHERE payment_method = 'BANK_TRANSFER'`, 'scalar'],
  ['CEO', 'tổng số lượng sản phẩm trong tất cả các dòng đơn hàng', `SELECT SUM(quantity) AS n FROM order_items`, 'scalar'],
  ['CEO', 'tổng thành tiền của tất cả các dòng hàng trong đơn hàng', `SELECT SUM(total_price) AS n FROM order_items`, 'scalar'],
  ['CEO', 'liệt kê 5 đơn mua hàng có ngày giao dự kiến sớm nhất', `SELECT id, po_number FROM purchase_orders WHERE expected_delivery_date IS NOT NULL ORDER BY expected_delivery_date ASC LIMIT 5`, 'set'],
  ['CEO', 'có bao nhiêu yêu cầu đổi trả thuộc loại đổi hàng', `SELECT COUNT(*) AS n FROM return_requests WHERE type = 'EXCHANGE'`, 'scalar'],
  ['CEO', 'có bao nhiêu khiếu nại đang ở trạng thái mở', `SELECT COUNT(*) AS n FROM complaints WHERE status = 'OPEN'`, 'scalar'],
  ['ACCOUNTANT', 'tổng số tiền của các giao dịch thanh toán bằng tiền mặt', `SELECT SUM(amount) AS n FROM order_payments WHERE method = 'CASH'`, 'scalar'],
  ['ACCOUNTANT', 'tổng các khoản chi trong sổ cái', `SELECT SUM(amount) AS n FROM ledger_entries WHERE type = 'EXPENSE'`, 'scalar'],
  ['ACCOUNTANT', 'tổng số dư tất cả tài khoản ngân hàng của công ty', `SELECT SUM(current_balance) AS n FROM company_bank_accounts`, 'scalar'],
  ['WAREHOUSE', 'có bao nhiêu số serial còn khả dụng', `SELECT COUNT(*) AS n FROM serial_numbers WHERE status = 'AVAILABLE'`, 'scalar'],
  ['WAREHOUSE', 'có bao nhiêu sản phẩm đã hết hàng', `SELECT COUNT(*) AS n FROM products WHERE stock_quantity = 0`, 'scalar'],
  ['WAREHOUSE', 'đếm số lượt nhập kho trong lịch sử di chuyển kho', `SELECT COUNT(*) AS n FROM stock_movements WHERE type = 'IN'`, 'scalar'],
  ['WAREHOUSE', 'số lượng tồn kho lớn nhất của một sản phẩm là bao nhiêu', `SELECT MAX(stock_quantity) AS n FROM products`, 'scalar'],
  ['WAREHOUSE', 'nhà cung cấp nào có nhiều đơn mua hàng nhất', `SELECT supplier_code FROM purchase_orders GROUP BY supplier_code ORDER BY COUNT(*) DESC LIMIT 1`, 'top1'],
  ['CEO', 'có bao nhiêu đơn xin nghỉ phép đang chờ duyệt', `SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'PENDING'`, 'scalar'],
  ['CEO', 'công ty có bao nhiêu nhân viên giao hàng', `SELECT COUNT(*) AS n FROM employees WHERE role = 'DELIVERY'`, 'scalar'],
];

const firstNumber = (rows) => {
  const row = rows?.[0];
  if (!row) return null;
  for (const v of Object.values(row)) {
    const n = Number(v);
    if (v !== null && v !== '' && !Number.isNaN(n)) return n;
  }
  return null;
};
const columnSets = (rows) => {
  const cols = {};
  for (const r of rows || []) for (const [k, v] of Object.entries(r)) (cols[k] = cols[k] || []).push(String(v));
  return Object.values(cols).map(vals => [...vals].sort().join('|'));
};
const sameResult = (mode, ref, got) => {
  // top1: dòng ĐẦU của kết quả chứa giá trị đáp án (chấp nhận liệt kê top N, miễn xếp đúng hạng 1)
  if (mode === 'top1') {
    const want = String(Object.values(ref?.[0] || {})[0]);
    return Boolean(got?.[0]) && Object.values(got[0]).some(v => String(v) === want);
  }
  if (mode === 'scalar') {
    const a = firstNumber(ref), b = firstNumber(got);
    return a !== null && b !== null && Math.abs(a - b) < 0.01;
  }
  const refSets = columnSets(ref), gotSets = columnSets(got);
  return refSets.some(s => gotSets.includes(s));
};

const userFor = (role) => ({ id: 1, role, name: 'Eval' });

// Pipeline CŨ: sinh SQL → "chữa" tên cột → chạy, không tự sửa khi lỗi
const baselinePipeline = async (question, user) => {
  let sql = await uds.generateSqlFromQuestion(question, user.role, user.id);
  if (!sql) return { sql: null, error: 'Không sinh được SQL', attempts: 1 };
  sql = uds.sanitizeAndHealSql(sql);
  try {
    const r = await executeSafeAiSql(sql, user);
    return { sql, rows: r.rows, attempts: 1 };
  } catch (e) {
    return { sql, error: e.message, attempts: 1 };
  }
};

// Pipeline MỚI: generateValidatedSql (mô tả DB tự sinh + vòng tự sửa lỗi)
const currentPipeline = async (question, user) => {
  if (typeof uds.generateValidatedSql !== 'function') return baselinePipeline(question, user);
  return uds.generateValidatedSql(question, user);
};

(async () => {
  const args = process.argv.slice(2);
  const log = console.log;
  console.log = () => {}; console.warn = () => {};

  if (args.includes('--check-refs')) {
    for (const [role, q, ref] of CASES) {
      try {
        const r = await executeSafeAiSql(ref, userFor(role));
        log(`✅ ${q} → ${JSON.stringify(r.rows.slice(0, 5))}`);
      } catch (e) { log(`❌ ${q} → ${e.message.split('\n').pop()}`); }
    }
    await prisma.$disconnect(); process.exit(0);
  }

  const pipeline = args.includes('--baseline') ? baselinePipeline : currentPipeline;
  log(`Pipeline: ${args.includes('--baseline') ? 'CŨ (không tự sửa)' : 'HIỆN TẠI'} | model: ${require('../geminiConfig').GEMINI_MODEL}`);
  let ok = 0, ran = 0, repaired = 0;
  for (const [role, q, refSql, mode] of CASES) {
    const user = userFor(role);
    const ref = (await executeSafeAiSql(refSql, userFor('CEO'))).rows;
    const t = Date.now();
    let res;
    try { res = await pipeline(q, user); } catch (e) { res = { error: e.message }; }
    const good = !res.error && res.rows && sameResult(mode, ref, res.rows);
    if (!res.error && res.rows) ran++;
    if (good) ok++;
    if ((res.attempts || 1) > 1 && good) repaired++;
    log(`${good ? '✅' : '❌'} [${role}] ${q}  (${Date.now() - t}ms, ${res.attempts || 1} lần thử)`);
    if (!good) {
      log(`     SQL: ${String(res.sql || '—').replace(/\s+/g, ' ').slice(0, 220)}`);
      log(`     ${res.error ? 'Lỗi: ' + String(res.error).split('\n').pop().slice(0, 160) : 'Kết quả: ' + JSON.stringify((res.rows || []).slice(0, 3)).slice(0, 160) + ' | đáp án: ' + JSON.stringify(ref.slice(0, 3)).slice(0, 120)}`);
    }
  }
  log(`\nKết quả: đúng ${ok}/${CASES.length} | chạy được ${ran}/${CASES.length}${repaired ? ` | ${repaired} câu đúng nhờ tự sửa lỗi` : ''}`);
  await prisma.$disconnect();
  process.exit(0);
})();
