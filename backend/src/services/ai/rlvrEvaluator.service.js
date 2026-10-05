/**
 * REINFORCEMENT LEARNING WITH VERIFIABLE REWARDS (RLVR) EVALUATOR SERVICE
 * 
 * Hàm lượng khoa học & Kỹ thuật KLTN:
 * - Ứng dụng kỹ thuật RLVR (kiểm chứng phần thưởng tự động) tương tự các mô hình suy luận hiện đại.
 * - Thay vì đánh giá cảm tính, Database PostgreSQL và AST Parser đóng vai trò là "Môi trường thẩm định kiểm chứng"
 *   (Verifiable Environment Sandbox).
 * - Tự động chấm điểm (Reward Score: 0 -> 100) theo 4 trục:
 *   1. Safety & Security Policy (30 pts)
 *   2. Schema Compliance & AST Healing (20 pts)
 *   3. Sandbox Execution Verification (30 pts)
 *   4. Data Quality & Sanity Check (20 pts)
 */

const prisma = require('../../config/database');
const { isSafeSqlQuery, sanitizeAndHealSql } = require('./universalData.service');

// Các bảng hợp lệ đã được xác minh trong hệ thống AetherPC ERP
const KNOWN_TABLES = [
  'orders', 'order_items', 'products', 'categories', 'brands',
  'customers', 'customer_addresses', 'warehouses', 'inventory',
  'stock_movements', 'suppliers', 'purchase_orders', 'purchase_order_items',
  'employees', 'attendance', 'leave_requests', 'payrolls',
  'company_bank_accounts', 'order_payments', 'return_requests', 'complaints'
];

/**
 * Thẩm định và chấm điểm phần thưởng kiểm chứng (Verifiable Reward Evaluation)
 * @param {string} rawSql Câu lệnh SQL cần kiểm chứng
 * @param {string} [question] Câu hỏi của người dùng
 * @param {object} [user] Người dùng thực thi
 * @returns {Promise<{
 *   rewardScore: number,
 *   grade: 'VERIFIED_EXCELLENT'|'VERIFIED_GOOD'|'NEEDS_ATTENTION'|'REJECTED',
 *   healedSql: string,
 *   breakdown: { safety: number, schema: number, execution: number, data: number },
 *   executionTimeMs: number,
 *   rowCount: number,
 *   previewRows: Array<object>,
 *   feedback: Array<string>
 * }>}
 */
const evaluateSqlReward = async (rawSql, question = '', user = {}) => {
  const startTime = Date.now();
  const feedback = [];
  const breakdown = {
    safety: 0,
    schema: 0,
    execution: 0,
    data: 0
  };

  if (!rawSql || typeof rawSql !== 'string' || !rawSql.trim()) {
    return {
      rewardScore: 0,
      grade: 'REJECTED',
      healedSql: '',
      breakdown,
      executionTimeMs: 0,
      rowCount: 0,
      previewRows: [],
      feedback: ['Câu lệnh SQL trống hoặc không đúng định dạng chuỗi.']
    };
  }

  // BƯỚC 1: KIỂM TRA BẢO MẬT & CHÍNH SÁCH AN TOÀN (30 ĐIỂM)
  const healedSql = sanitizeAndHealSql(rawSql.trim());
  const isSafe = isSafeSqlQuery(healedSql);

  if (!isSafe) {
    feedback.push('❌ Vi phạm an toàn bảo mật: Câu lệnh chứa từ khóa nguy hiểm (DDL/DML) hoặc truy cập trường cấm.');
    return {
      rewardScore: 0,
      grade: 'REJECTED',
      healedSql,
      breakdown,
      executionTimeMs: Date.now() - startTime,
      rowCount: 0,
      previewRows: [],
      feedback
    };
  }

  breakdown.safety = 30;
  feedback.push('✅ An toàn: Đạt chuẩn truy vấn chỉ đọc (Read-only SELECT/WITH), không chứa mã độc.');

  // BƯỚC 2: KIỂM TRA TUÂN THỦ SCHEMA & TỐI ƯU CÚ PHÁP (20 ĐIỂM)
  let schemaScore = 0;
  const lowerSql = healedSql.toLowerCase();

  // Kiểm tra có chứa bảng hợp lệ
  const detectedTables = KNOWN_TABLES.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(lowerSql));
  if (detectedTables.length > 0) {
    schemaScore += 10;
    feedback.push(`✅ Schema: Khớp với bảng cơ sở dữ liệu hợp lệ (${detectedTables.join(', ')}).`);
  } else {
    feedback.push('⚠️ Schema: Chưa xác định rõ bảng mục tiêu trong danh mục ERP.');
  }

  // Kiểm tra giới hạn an toàn LIMIT
  if (/\blimit\s+\d+\b/i.test(healedSql) || /\b(count|sum|avg|max|min)\s*\(/i.test(healedSql)) {
    schemaScore += 10;
    feedback.push('✅ Tối ưu: Đã có mệnh đề LIMIT hoặc hàm tổng hợp bảo vệ hiệu năng.');
  } else {
    feedback.push('⚠️ Tối ưu: Thiếu mệnh đề LIMIT, có thể gây tải bộ nhớ khi quét bảng lớn.');
  }
  breakdown.schema = schemaScore;

  // BƯỚC 3: THỰC THI KIỂM CHỨNG TRONG MÔI TRƯỜNG SANDBOX POSTGRESQL (30 ĐIỂM)
  let executionSuccess = false;
  let rawData = [];
  const currentUserId = Number(user.id) || 1;
  const executableSql = healedSql.replace(/:userId/g, currentUserId.toString());

  try {
    const execStart = Date.now();
    // Thực thi trực tiếp trên PostgreSQL Client
    rawData = await prisma.$queryRawUnsafe(executableSql);
    const execLatency = Date.now() - execStart;

    executionSuccess = true;
    breakdown.execution = 30;
    feedback.push(`✅ Thực thi Sandbox: Thành công 100% không phát sinh lỗi SQL (Độ trễ: ${execLatency}ms).`);
  } catch (dbErr) {
    feedback.push(`❌ Lỗi thực thi Sandbox: ${dbErr.message}`);
    breakdown.execution = 0;
  }

  // BƯỚC 4: KIỂM ĐỊNH CHẤT LƯỢNG DỮ LIỆU ĐẦU RA (20 ĐIỂM)
  let dataScore = 0;
  let cleanRows = [];

  if (executionSuccess && Array.isArray(rawData)) {
    cleanRows = JSON.parse(JSON.stringify(rawData, (k, v) =>
      typeof v === 'bigint' ? v.toString() : v
    ));

    // Dữ liệu có cấu trúc cột hợp lệ
    if (cleanRows.length > 0 && Object.keys(cleanRows[0]).length > 0) {
      dataScore += 10;
      feedback.push(`✅ Cấu trúc: Đầu ra trả về ${Object.keys(cleanRows[0]).length} cột dữ liệu nghiệp vụ.`);
    }

    // Dữ liệu có ít nhất 1 dòng kết quả thực tế
    if (cleanRows.length > 0) {
      dataScore += 10;
      feedback.push(`✅ Thực tế: Truy vấn trích xuất được ${cleanRows.length} bản ghi thời gian thực.`);
    } else {
      dataScore += 5; // Vẫn chấp nhận nếu bảng hiện tại chưa có dữ liệu tương ứng
      feedback.push('ℹ️ Dữ liệu: Truy vấn hợp lệ nhưng hiện tại trả về 0 bản ghi (tập rỗng).');
    }
  }
  breakdown.data = dataScore;

  // TỔNG ĐIỂM REWARD
  const rewardScore = breakdown.safety + breakdown.schema + breakdown.execution + breakdown.data;

  let grade = 'REJECTED';
  if (rewardScore >= 90) {
    grade = 'VERIFIED_EXCELLENT'; // Đạt chuẩn tự động phê duyệt
  } else if (rewardScore >= 70) {
    grade = 'VERIFIED_GOOD';      // Hợp lệ, chấp nhận được
  } else if (rewardScore >= 40) {
    grade = 'NEEDS_ATTENTION';   // Cần chỉnh sửa thêm
  }

  return {
    rewardScore,
    grade,
    isDeployable: rewardScore >= 90,
    healedSql,
    breakdown,
    executionTimeMs: Date.now() - startTime,
    rowCount: cleanRows.length,
    previewRows: cleanRows.slice(0, 10),
    feedback
  };
};

module.exports = {
  evaluateSqlReward
};
