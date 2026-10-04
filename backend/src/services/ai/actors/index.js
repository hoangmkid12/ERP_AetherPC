/**
 * ACTOR KNOWLEDGE & INTENT DISPATCHER (BỘ ĐIỀU PHỐI HUẤN LUYỆN THEO ACTOR)
 * Nạp chính xác tập tri thức, kịch bản nghiệp vụ và câu lệnh SQL theo từng vai trò:
 * - DELIVERY: Nhân viên giao hàng (Shipper)
 * - WAREHOUSE / WAREHOUSE_MANAGER: Kho & Kỹ thuật lắp ráp
 * - ACCOUNTANT: Kế toán & Dòng tiền
 * - SALES / SALES_MANAGER: Tư vấn bán hàng & Báo giá
 * - ADMIN / CEO: Ban Giám Đốc & Quản trị hệ thống
 */

const deliveryTrainer = require('./delivery.trainer');
const warehouseTrainer = require('./warehouse.trainer');
const accountantTrainer = require('./accountant.trainer');
const salesTrainer = require('./sales.trainer');
const adminCeoTrainer = require('./admin_ceo.trainer');

/**
 * Chuẩn hóa vai trò người dùng về 5 nhóm Actor chính
 */
const normalizeActorRole = (role) => {
  const r = (role || '').toUpperCase();
  if (r === 'DELIVERY' || r.includes('SHIPPER')) return 'DELIVERY';
  if (r.includes('WAREHOUSE') || r.includes('KHO') || r.includes('QC') || r.includes('TECH')) return 'WAREHOUSE';
  if (r.includes('ACCOUNT') || r.includes('KETOAN') || r.includes('CASHIER')) return 'ACCOUNTANT';
  if (r.includes('SALES') || r.includes('BANHANG')) return 'SALES';
  if (r.includes('ADMIN') || r === 'CEO' || r.includes('MANAGER') || r.includes('DIRECTOR')) return 'ADMIN_CEO';
  return 'SALES'; // Mặc định chế độ tư vấn nếu không xác định
};

/**
 * Lấy System Instruction chuyên môn hóa theo vai trò
 */
const getActorSystemPrompt = (role) => {
  const actor = normalizeActorRole(role);
  switch (actor) {
    case 'DELIVERY':
      return deliveryTrainer.DELIVERY_SYSTEM_PROMPT;
    case 'WAREHOUSE':
      return warehouseTrainer.WAREHOUSE_SYSTEM_PROMPT;
    case 'ACCOUNTANT':
      return accountantTrainer.ACCOUNTANT_SYSTEM_PROMPT;
    case 'SALES':
      return salesTrainer.SALES_SYSTEM_PROMPT;
    case 'ADMIN_CEO':
      return adminCeoTrainer.ADMIN_CEO_SYSTEM_PROMPT;
    default:
      return salesTrainer.SALES_SYSTEM_PROMPT;
  }
};

/**
 * Lấy danh sách Few-Shots SQL mẫu đặc thù của vai trò
 */
const getActorFewShots = (role) => {
  const actor = normalizeActorRole(role);
  switch (actor) {
    case 'DELIVERY':
      return deliveryTrainer.DELIVERY_FEW_SHOTS;
    case 'WAREHOUSE':
      return warehouseTrainer.WAREHOUSE_FEW_SHOTS;
    case 'ACCOUNTANT':
      return accountantTrainer.ACCOUNTANT_FEW_SHOTS;
    case 'SALES':
      return salesTrainer.SALES_FEW_SHOTS;
    case 'ADMIN_CEO':
      return adminCeoTrainer.ADMIN_CEO_FEW_SHOTS;
    default:
      return salesTrainer.SALES_FEW_SHOTS;
  }
};

/**
 * Chạy quy tắc nhận diện câu hỏi nhanh theo vai trò (Semantic Rule Matching)
 */
const evaluateActorSemanticRules = (userPrompt, role, userId) => {
  const lower = (userPrompt || '').toLowerCase();
  const actor = normalizeActorRole(role);

  switch (actor) {
    case 'DELIVERY':
      return deliveryTrainer.DELIVERY_SEMANTIC_RULES(lower, userId);
    case 'WAREHOUSE':
      return warehouseTrainer.WAREHOUSE_SEMANTIC_RULES(lower);
    case 'ACCOUNTANT':
      return accountantTrainer.ACCOUNTANT_SEMANTIC_RULES(lower);
    case 'SALES':
      return salesTrainer.SALES_SEMANTIC_RULES(lower);
    case 'ADMIN_CEO':
      return adminCeoTrainer.ADMIN_CEO_SEMANTIC_RULES(lower);
    default:
      return null;
  }
};

/**
 * Lấy tài liệu quy chuẩn SOP đặc thù cho vai trò
 */
const getActorKnowledgeSOP = (role) => {
  const actor = normalizeActorRole(role);
  switch (actor) {
    case 'DELIVERY':
      return deliveryTrainer.DELIVERY_KNOWLEDGE_SOP;
    case 'WAREHOUSE':
      return warehouseTrainer.WAREHOUSE_KNOWLEDGE_SOP;
    case 'ACCOUNTANT':
      return accountantTrainer.ACCOUNTANT_KNOWLEDGE_SOP;
    case 'SALES':
      return salesTrainer.SALES_KNOWLEDGE_SOP;
    case 'ADMIN_CEO':
      return adminCeoTrainer.ADMIN_CEO_KNOWLEDGE_SOP;
    default:
      return salesTrainer.SALES_KNOWLEDGE_SOP;
  }
};

module.exports = {
  normalizeActorRole,
  getActorSystemPrompt,
  getActorFewShots,
  evaluateActorSemanticRules,
  getActorKnowledgeSOP
};
