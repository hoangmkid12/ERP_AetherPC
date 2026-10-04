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
const { conversationContext } = require('../context');
const { queryCache } = require('../cache');

/**
 * Tự động sinh ra 2 - 3 câu hỏi gợi ý F1 / F2 (Proactive Follow-up Chips)
 * Giúp người dùng đào sâu hoặc mở rộng nghiệp vụ mà không cần tự nghĩ câu hỏi
 */
const generateFollowUpSuggestions = (skill, userPrompt = '', params = {}) => {
  if (!skill) return [];

  // Nếu skill đã có cấu hình followUps cố định
  if (skill.followUps && Array.isArray(skill.followUps) && skill.followUps.length > 0) {
    return skill.followUps;
  }

  const sid = (skill.id || '').toUpperCase();

  // 1. Nhóm Doanh thu & Bán hàng (Revenue & Sales)
  if (sid.includes('REVENUE') || sid.includes('SALES_SUMMARY') || sid.includes('ANNUAL_EXECUTIVE') || sid.includes('TODAY_REVENUE')) {
    return [
      'So với tháng trước thì tăng hay giảm bao nhiêu %?',
      'Những đơn trên 10 triệu mà chưa thanh toán',
      'Hôm nay có vẻ ế nhỉ, từ sáng giờ nổ được mấy đơn rồi'
    ];
  }

  // 2. Nhóm Sản phẩm & Linh kiện phần cứng (Hardware & PC)
  if (sid.includes('PRODUCT') || sid.includes('PRICE') || sid.includes('STOCK')) {
    const prodName = params.productName || 'con này';
    return [
      `${prodName} giá bao nhiêu tiền?`,
      `${prodName} cần nguồn bao nhiêu watt?`,
      'Chính sách bảo hành 1 đổi 1 thế nào?'
    ];
  }

  // 3. Nhóm Khiếu nại CSKH & Ticket
  if (sid.includes('COMPLAINT') || sid.includes('TICKET') || sid.includes('CSKH')) {
    if (sid.includes('RESOLVED')) {
      return [
        'Có bao nhiêu khiếu nại đang chờ xử lý?',
        'Khiếu nại nào gấp nhất?',
        'Tổng đơn hàng đổi trả trong năm nay'
      ];
    }
    return [
      'Khiếu nại nào gấp nhất?',
      'Cho xem danh sách cụ thể',
      'Đã xử lí được mấy cái rồi?'
    ];
  }

  // 4. Nhóm Đổi trả & Bảo hành RMA
  if (sid.includes('RETURN') || sid.includes('RMA') || sid.includes('WARRANTY')) {
    return [
      'Khiếu nại nào gấp nhất?',
      'Có bao nhiêu khiếu nại đang chờ xử lý?',
      'Quy trình đổi trả sản phẩm lỗi của công ty'
    ];
  }

  // 5. Nhóm Nhân sự (HR)
  if (sid.includes('HR') || sid.includes('HEADCOUNT') || sid.includes('STAFF')) {
    return [
      'Có bao nhiêu nhân viên shipper?',
      'Thống kê tình hình nhân sự nghỉ phép',
      'Chính sách kỷ luật nhân viên vi phạm'
    ];
  }

  // 6. Nhóm Giao vận (Delivery / Shipper)
  if (sid.includes('DELIVERY') || sid.includes('SHIPPER') || sid.includes('COD')) {
    return [
      'Đơn nào của tôi cần thu tiền cod?',
      'Lý do mấy đơn bị boom hàng không nhận',
      'Tháng này tôi đã giao thành công được bao nhiêu đơn?'
    ];
  }

  // 7. Nhóm Kho vận & Lắp ráp (Warehouse)
  if (sid.includes('WAREHOUSE') || sid.includes('ASSEMBLY') || sid.includes('LOW_STOCK')) {
    return [
      'Những sản phẩm nào sắp hết hàng trong kho?',
      'Có bao nhiêu máy đang chờ ráp và kiểm tra?',
      'Phiếu nhập hàng gần nhất đã về kho chưa?'
    ];
  }

  // Mặc định cho các kịch bản khác
  return [
    'Báo cáo doanh thu bán hàng hôm nay',
    'Card RTX 4070 còn hàng không?',
    'Chính sách bảo mật hệ thống'
  ];
};

/**
 * THỰC THI TRỰC TIẾP Ý ĐỊNH BẰNG PRISMA HANDLER (KIẾN TRÚC TOÀN DIỆN GIAI ĐOẠN 1, 2, 3, 4 & 5)
 * Pipeline hoàn chỉnh:
 * 0. Query Cache Hit: Phản hồi tức thì < 1ms cho các câu hỏi phổ biến (Stage 5)
 * 1. Phân tích ngữ cảnh & hồi chỉ từ các lượt trước (Stage 4)
 * 2. So khớp ý định bằng Vector Cosine & Hybrid Matcher (Stage 3)
 * 3. Tự động bóc tách thực thể & kế thừa tham số qua ngữ cảnh (Stage 2 & 4)
 * 4. Kiểm tra điều kiện cần làm rõ (Clarification Prompting)
 * 5. Kiểm tra RBAC & thực thi Prisma Handler an toàn (Stage 1)
 * 6. Lưu ngữ cảnh lượt trò chuyện vào Session Store (Stage 4)
 * 7. Ghi nhớ kết quả vào Query Cache (Stage 5)
 * 
 * @param {string} userPrompt - Câu hỏi của người dùng
 * @param {string} role - Vai trò của người dùng (DELIVERY, WAREHOUSE, ACCOUNTANT, SALES, ADMIN_CEO)
 * @param {Object} prisma - Prisma Client instance
 * @param {Object} [user={}] - Thông tin user { id, role, fullName }
 * @param {Object} [params={}] - Các tham số đã trích xuất hoặc options { sessionId, conversationHistory, skipCache }
 */
const executeActorIntent = async (userPrompt, role, prisma, user = {}, params = {}) => {
  const trainer = getTrainer(role);
  if (!trainer) {
    return { status: 'NOT_FOUND', message: `Không tìm thấy bộ huấn luyện cho vai trò ${role}` };
  }

  // GIAI ĐOẠN 5: Tối ưu hiệu năng - Kiểm tra Query Cache phản hồi < 1ms
  // Chỉ sử dụng Cache cho các câu hỏi độc lập (không phụ thuộc hồi chỉ / ngữ cảnh phiên)
  const isPersonalQuery = /(của tôi|của em|của mình|cá nhân tôi|cá nhân em|doanh số của tôi|nhiệm vụ của tôi)/i.test(userPrompt);
  const anaphoraInfo = conversationContext.detectAnaphora(userPrompt);
  const isElliptical = Boolean(conversationContext.detectEllipticalType(userPrompt));
  const isContextDependent = anaphoraInfo.isProductAnaphora || anaphoraInfo.isOrderAnaphora || anaphoraInfo.isPoAnaphora || anaphoraInfo.isDateFollowUp || isElliptical;

  const cacheKey = queryCache.generateKey(userPrompt, role, user.id, isPersonalQuery);
  const cachedResponse = queryCache.get(cacheKey);
  if (cachedResponse && !params.skipCache && !isContextDependent) {
    return cachedResponse;
  }

  const sessionId = params.sessionId || user.id || 'default_session';
  const isAdminCeo = trainer.role === 'ADMIN_CEO' || user.role === 'ADMIN' || user.role === 'CEO';

  // 1. Tầng 1: So khớp bằng Regex Patterns nhanh
  let matchResult = trainer.match(userPrompt, user.id);
  let executingTrainer = trainer;

  // Nếu là ADMIN / CEO và chưa khớp kịch bản của ADMIN, thử khớp với các Actor nghiệp vụ khác
  if (!matchResult && isAdminCeo) {
    const otherTrainers = [salesTrainer, warehouseTrainer, accountantTrainer, deliveryTrainer];
    for (const ot of otherTrainers) {
      const res = ot.match(userPrompt, user.id);
      if (res && res.score >= 120) {
        matchResult = res;
        executingTrainer = ot;
        break;
      }
    }
  }

  let matchedSkill = matchResult ? matchResult.skill : null;
  let matchScore = matchResult ? matchResult.score : 0;
  let matchSource = 'PATTERN_RULE';

  // 1.1 Kiểm tra xem có phải câu hỏi tiếp nối theo thời gian (Follow-up Date Query) không
  if (!matchedSkill) {
    const anaphoraCheck = conversationContext.detectAnaphora(userPrompt);
    if (anaphoraCheck.isDateFollowUp) {
      const recentTurns = conversationContext.getRecentTurns(sessionId, 3);
      if (recentTurns.length > 0 && recentTurns[0].skillId) {
        const prevSkill = executingTrainer.getSkill(recentTurns[0].skillId) || trainer.getSkill(recentTurns[0].skillId);
        if (prevSkill) {
          matchedSkill = prevSkill;
          matchScore = 0.95;
          matchSource = 'CONTEXT_FOLLOW_UP';
        }
      }
    }
  }

  // 2. Tầng 2 & 3: Nếu Regex không khớp hoặc điểm thấp -> Kích hoạt Vector Embedding & Cosine Similarity (Stage 3)
  if (!matchedSkill) {
    const searchRole = isAdminCeo ? null : trainer.role;
    const hybridMatch = await matchHybridIntent(userPrompt, searchRole, trainer);
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
          role: executingTrainer.role,
          suggestions: hybridMatch.suggestions,
          text: `🤔 **Hệ thống chưa hoàn toàn chắc chắn về câu hỏi của bạn** (Độ tương đồng: ${(hybridMatch.score * 100).toFixed(1)}%).${suggestionText}\n\nBạn có thể thử diễn đạt lại câu hỏi rõ hơn nhé!`
        };
      }

      matchedSkill = hybridMatch.skill;
      matchScore = hybridMatch.score;
      matchSource = hybridMatch.source;
      if (hybridMatch.role && TRAINERS[hybridMatch.role]) {
        executingTrainer = TRAINERS[hybridMatch.role];
      }
    }
  }

  // 2.1 Nếu vẫn chưa có skill, kiểm tra xem có phải câu hỏi tỉnh lược (Elliptical Query) dựa vào context không
  if (!matchedSkill) {
    const ellipticalType = conversationContext.detectEllipticalType(userPrompt);
    const recentTurns = conversationContext.getRecentTurns(sessionId, 3);
    if (ellipticalType && recentTurns.length > 0) {
      if (ellipticalType === 'PRODUCT') {
        executingTrainer = salesTrainer;
        matchedSkill = salesTrainer.getSkill('PRODUCT_PRICE_STOCK');
        matchScore = 0.90;
        matchSource = 'ELLIPTICAL_CONTEXT';
      } else if (ellipticalType === 'ORDER') {
        executingTrainer = deliveryTrainer;
        matchedSkill = deliveryTrainer.getSkill('DELIVERY_TRACK_ORDER') || deliveryTrainer.getSkill('ORDER_DETAIL_LOOKUP');
        matchScore = 0.90;
        matchSource = 'ELLIPTICAL_CONTEXT';
      } else if (ellipticalType === 'COMPLAINT_TICKET') {
        executingTrainer = adminCeoTrainer;
        matchedSkill = adminCeoTrainer.getSkill('RESOLVED_COMPLAINTS_TICKETS');
        matchScore = 0.95;
        matchSource = 'ELLIPTICAL_CONTEXT';
      } else if (ellipticalType === 'RMA') {
        executingTrainer = adminCeoTrainer;
        matchedSkill = adminCeoTrainer.getSkill('RETURN_REQUESTS_SUMMARY');
        matchScore = 0.95;
        matchSource = 'ELLIPTICAL_CONTEXT';
      }
    }
  }

  if (!matchedSkill) {
    return null; // Không nhận diện được ý định nào phù hợp
  }

  // GIAI ĐOẠN 2: Tự động bóc tách thực thể, ngày tháng, mã phiếu, ngân sách từ câu hỏi
  const initialParams = await extractParameters(userPrompt, prisma, user, params);

  // GIAI ĐOẠN 4: Kế thừa thực thể qua ngữ cảnh nhiều lượt (Anaphora & Context Backfilling)
  const { resolvedParams, inherited } = conversationContext.resolveContextAndBackfill(
    userPrompt,
    initialParams,
    sessionId
  );

  // GIAI ĐOẠN 4: Kiểm tra xem có thiếu tham số bắt buộc cần người dùng làm rõ không
  const clarification = conversationContext.checkClarificationNeeded(matchedSkill, resolvedParams, userPrompt);
  if (clarification) {
    return {
      status: 'CLARIFICATION_REQUIRED',
      skillId: matchedSkill.id,
      missingParam: clarification.missingParam,
      text: clarification.message,
      matchScore,
      matchSource,
      role: executingTrainer.role
    };
  }

  // GIAI ĐOẠN 1: Chạy Prisma Handler và kiểm tra bảo mật RBAC
  const execResult = await executingTrainer.execute(matchedSkill, prisma, resolvedParams, user);

  // GIAI ĐOẠN 4: Ghi lại lượt hội thoại vào Session Context
  conversationContext.recordTurn(sessionId, {
    userPrompt,
    role: executingTrainer.role,
    intent: matchedSkill.id,
    skillId: matchedSkill.id,
    extractedParams: resolvedParams,
    response: execResult.text,
    status: execResult.status
  });

  const followUps = generateFollowUpSuggestions(matchedSkill, userPrompt, resolvedParams);

  const responseObj = {
    ...execResult,
    extractedParams: resolvedParams,
    inheritedParams: inherited,
    matchScore,
    matchSource,
    role: executingTrainer.role,
    followUps
  };

  // GIAI ĐOẠN 5: Lưu kết quả vào Query Cache với TTL tối ưu
  // Chỉ cache các câu hỏi độc lập (không phụ thuộc vào tham số kế thừa từ ngữ cảnh của phiên)
  const hasInherited = inherited && Object.keys(inherited).length > 0;
  if (execResult.status === 'SUCCESS' && !isContextDependent && !hasInherited) {
    const ttl = queryCache.getTtlForSkill(matchedSkill.type, matchedSkill.id);
    queryCache.set(cacheKey, responseObj, ttl);
  }

  return responseObj;
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
