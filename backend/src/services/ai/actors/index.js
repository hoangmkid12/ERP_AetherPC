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

/**
 * THỰC THI TRỰC TIẾP Ý ĐỊNH BẰNG PRISMA HANDLER (KIẾN TRÚC GIAI ĐOẠN 1)
 * Pipeline hoàn chỉnh: So khớp ý định -> Kiểm tra RBAC -> Chạy Prisma Handler -> Điền kết quả vào Template
 * @param {string} userPrompt - Câu hỏi của người dùng
 * @param {string} role - Vai trò của người dùng (DELIVERY, WAREHOUSE, ACCOUNTANT, SALES, ADMIN_CEO)
 * @param {Object} prisma - Prisma Client instance
 * @param {Object} [user={}] - Thông tin user { id, role, fullName }
 * @param {Object} [params={}] - Các tham số đã trích xuất (tên sản phẩm, mốc thời gian...)
 */
const executeActorIntent = async (userPrompt, role, prisma, user = {}, params = {}) => {
  const trainer = getTrainer(role);
  if (!trainer) {
    return { status: 'NOT_FOUND', message: `Không tìm thấy bộ huấn luyện cho vai trò ${role}` };
  }

  const matchResult = trainer.match(userPrompt, user.id);
  if (!matchResult) {
    return null; // Không khớp ý định đã định nghĩa
  }

  const execResult = await trainer.execute(matchResult.skill, prisma, params, user);
  return {
    ...execResult,
    matchScore: matchResult.score,
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
