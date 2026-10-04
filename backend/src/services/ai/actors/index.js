/**
 * ACTOR KNOWLEDGE & INTENT DISPATCHER (BỘ ĐIỀU PHỐI HUẤN LUYỆN THEO ACTOR)
 * Quản lý và điều phối 5 mô hình huấn luyện chuyên biệt theo Actor:
 * - DELIVERY: Nhân viên giao hàng (Shipper)
 * - WAREHOUSE: Thủ kho & Kỹ thuật viên lắp ráp PC
 * - ACCOUNTANT: Kế toán & Dòng tiền
 * - SALES: Chuyên viên tư vấn & Bán lẻ
 * - ADMIN_CEO: Ban Giám Đốc & Quản trị hệ thống
 *
 * Hỗ trợ đồng thời 2 cơ chế:
 * 1. Cơ chế mới (Giai đoạn 1): Intent Catalog + Parameterized Prisma Handlers (An toàn, Offline, Type-safe)
 * 2. Cơ chế cũ (Legacy NL2SQL): Semantic SQL Rule Matching & Few-Shots
 */

const BaseActorTrainer = require('./BaseActorTrainer');
const deliveryTrainer = require('./delivery.trainer');
const warehouseTrainer = require('./warehouse.trainer');
const accountantTrainer = require('./accountant.trainer');
const salesTrainer = require('./sales.trainer');
const adminCeoTrainer = require('./admin_ceo.trainer');

/**
 * Bảng ánh xạ Trainer theo chuẩn hóa vai trò
 */
const TRAINERS = {
  DELIVERY: deliveryTrainer,
  WAREHOUSE: warehouseTrainer,
  ACCOUNTANT: accountantTrainer,
  SALES: salesTrainer,
  ADMIN_CEO: adminCeoTrainer
};

/**
 * Chuẩn hóa vai trò người dùng về 5 nhóm Actor chính
 */
const normalizeActorRole = (role) => {
  const r = (role || '').toUpperCase();
  if (r === 'DELIVERY' || r.includes('SHIPPER')) return 'DELIVERY';
  if (r.includes('WAREHOUSE') || r.includes('KHO') || r.includes('QC') || r.includes('TECH') || r.includes('ASSEMBLY')) return 'WAREHOUSE';
  if (r.includes('ACCOUNT') || r.includes('KETOAN') || r.includes('CASHIER')) return 'ACCOUNTANT';
  if (r.includes('SALES') || r.includes('BANHANG')) return 'SALES';
  if (r.includes('ADMIN') || r === 'CEO' || r.includes('MANAGER') || r.includes('DIRECTOR')) return 'ADMIN_CEO';
  return 'SALES'; // Mặc định chế độ tư vấn nếu không xác định
};

/**
 * Lấy Trainer instance theo vai trò
 * @param {string} role
 * @returns {BaseActorTrainer}
 */
const getTrainer = (role) => {
  const actor = normalizeActorRole(role);
  return TRAINERS[actor] || salesTrainer;
};

/**
 * Lấy toàn bộ danh sách Trainers trong hệ thống
 */
const getAllTrainers = () => TRAINERS;

/**
 * Lấy System Instruction chuyên môn hóa theo vai trò
 */
const getActorSystemPrompt = (role) => {
  const trainer = getTrainer(role);
  return trainer ? trainer.systemPrompt : salesTrainer.systemPrompt;
};

/**
 * Lấy danh sách Few-Shots SQL mẫu đặc thù của vai trò
 */
const getActorFewShots = (role) => {
  const trainer = getTrainer(role);
  return trainer ? trainer.getFewShots() : salesTrainer.getFewShots();
};

/**
 * Chạy quy tắc nhận diện câu hỏi nhanh theo vai trò (Semantic Rule Matching)
 * Trả về câu lệnh SQL thực thi trực tiếp nếu câu hỏi khớp kịch bản dữ liệu
 */
const evaluateActorSemanticRules = (userPrompt, role, userId) => {
  const trainer = getTrainer(role);
  if (!trainer) return null;

  const matchResult = trainer.match(userPrompt, userId);
  return matchResult && matchResult.executableSql ? matchResult.executableSql : null;
};

/**
 * Khớp kỹ năng tổng quát theo vai trò (hỗ trợ cả SQL và SOP tài liệu)
 */
const matchActorSkill = (userPrompt, role, userId) => {
  const trainer = getTrainer(role);
  if (!trainer) return null;
  return trainer.match(userPrompt, userId);
};

const { extractParameters } = require('../extractors');
const { matchHybridIntent } = require('../matcher');

/**
 * THỰC THI TRỰC TIẾP Ý ĐỊNH BẰNG PRISMA HANDLER (KIẾN TRÚC TOÀN DIỆN GIAI ĐOẠN 1, 2 & 3)
 * Pipeline hoàn chỉnh:
 * 1. So khớp ý định bằng Vector Cosine & Hybrid Matcher (Stage 3)
 * 2. Tự động bóc tách thực thể & chuẩn hóa tham số (Stage 2)
 * 3. Kiểm tra RBAC & thực thi Prisma Handler an toàn (Stage 1)
 * 4. Điền kết quả vào Template giao diện người dùng
 * 
 * @param {string} userPrompt - Câu hỏi của người dùng
 * @param {string} role - Vai trò của người dùng (DELIVERY, WAREHOUSE, ACCOUNTANT, SALES, ADMIN_CEO)
 * @param {Object} prisma - Prisma Client instance
 * @param {Object} [user={}] - Thông tin user { id, role, fullName }
 * @param {Object} [params={}] - Các tham số đã trích xuất hoặc tham số bổ sung
 */
const executeActorIntent = async (userPrompt, role, prisma, user = {}, params = {}) => {
  const trainer = getTrainer(role);
  if (!trainer) {
    return { status: 'NOT_FOUND', message: `Không tìm thấy bộ huấn luyện cho vai trò ${role}` };
  }

  // 1. Tầng 1: So khớp bằng Regex Patterns nhanh
  let matchResult = trainer.match(userPrompt, user.id);
  let matchedSkill = matchResult ? matchResult.skill : null;
  let matchScore = matchResult ? matchResult.score : 0;
  let matchSource = 'PATTERN_RULE';

  // 2. Tầng 2 & 3: Nếu Regex không khớp hoặc điểm thấp -> Kích hoạt Vector Embedding & Cosine Similarity (Stage 3)
  if (!matchedSkill) {
    const hybridMatch = await matchHybridIntent(userPrompt, trainer.role, trainer);
    if (hybridMatch && hybridMatch.skill) {
      if (hybridMatch.status === 'UNCERTAIN') {
        const suggestionText = hybridMatch.suggestions && hybridMatch.suggestions.length > 0
          ? '\n\n💡 **GỢI Ý CÁC CHỦ ĐỀ LIÊN QUAN:**\n' +
            hybridMatch.suggestions.map((s, idx) => `${idx + 1}. **${s.title}**`).join('\n')
          : '';

        return {
          status: 'UNCERTAIN',
          intent: hybridMatch.intent,
          matchScore: hybridMatch.score,
          role: trainer.role,
          suggestions: hybridMatch.suggestions,
          text: `🤔 **Hệ thống chưa hoàn toàn chắc chắn về câu hỏi của bạn** (Độ tương đồng: ${(hybridMatch.score * 100).toFixed(1)}%).${suggestionText}\n\nBạn có thể thử diễn đạt lại câu hỏi rõ hơn nhé!`
        };
      }

      matchedSkill = hybridMatch.skill;
      matchScore = hybridMatch.score;
      matchSource = hybridMatch.source;
    }
  }

  if (!matchedSkill) {
    return null; // Không nhận diện được ý định nào phù hợp
  }

  // GIAI ĐOẠN 2: Tự động bóc tách thực thể, ngày tháng, mã phiếu, ngân sách từ câu hỏi
  const resolvedParams = await extractParameters(userPrompt, prisma, user, params);

  // GIAI ĐOẠN 1: Chạy Prisma Handler và kiểm tra bảo mật RBAC
  const execResult = await trainer.execute(matchedSkill, prisma, resolvedParams, user);
  return {
    ...execResult,
    extractedParams: resolvedParams,
    matchScore,
    matchSource,
    role: trainer.role
  };
};

/**
 * Lấy tài liệu quy chuẩn SOP đặc thù cho vai trò
 */
const getActorKnowledgeSOP = (role) => {
  const trainer = getTrainer(role);
  return trainer ? trainer.getKnowledgeSOP() : salesTrainer.getKnowledgeSOP();
};

/**
 * Xuất toàn bộ bộ dữ liệu NLP từ tất cả Actors để huấn luyện mô hình phân loại cục bộ
 */
const exportAllNlpDatasets = () => {
  let combinedDataset = [];
  Object.values(TRAINERS).forEach(trainer => {
    combinedDataset = combinedDataset.concat(trainer.exportNlpDataset());
  });
  return combinedDataset;
};

module.exports = {
  BaseActorTrainer,
  normalizeActorRole,
  getTrainer,
  getAllTrainers,
  getActorSystemPrompt,
  getActorFewShots,
  evaluateActorSemanticRules,
  matchActorSkill,
  executeActorIntent,
  getActorKnowledgeSOP,
  exportAllNlpDatasets,
  deliveryTrainer,
  warehouseTrainer,
  accountantTrainer,
  salesTrainer,
  adminCeoTrainer
};
