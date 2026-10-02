const prisma = require('../config/database');
const { getToolsForRole } = require('../services/ai/tools.definition');
const { executeToolCall, identifySemanticTopic } = require('../services/ai/tools.executor');
const { classifyIntentLocal } = require('../services/ai/localNlp.service');
const { executeUniversalDataQuery } = require('../services/ai/universalData.service');

// Khởi tạo Gemini client nếu có GEMINI_API_KEY
let GoogleGenAI = null;
try {
  const genaiPkg = require('@google/genai');
  GoogleGenAI = genaiPkg.GoogleGenAI;
} catch (e) {
  // @google/genai optional fallback
}

const getAiClient = () => {
  if (process.env.GEMINI_API_KEY && GoogleGenAI) {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return null;
};

// Prompt hệ thống thông minh, thân thiện, linh hoạt như các trợ lý AI hàng đầu hiện nay
const SYSTEM_INSTRUCTION = `Bạn là AetherCopilot - Trợ lý AI Thông Minh và Đồng Nghiệp Số của hệ thống AetherPC ERP.

PHONG CÁCH VÀ TÍNH CÁCH TRÒ CHUYỆN:
1. TỰ NHIÊN & THÂN THIỆN: Trò chuyện gần gũi, ấm áp, nhạy bén và thông minh như một đồng nghiệp xuất sắc (tương tự ChatGPT/Claude). Biết chào hỏi, cảm ơn, hỏi thăm và thấu hiểu tâm trạng của người dùng.
2. ĐA NĂNG & HIỂU BIẾT RỘNG:
   - Khi người dùng hỏi chuyện xã giao, công nghệ, cuộc sống, lập trình, viết lách, học tập, hay tâm sự: Hãy trò chuyện cởi mở, sinh động, truyền cảm hứng và cuốn hút.
   - Khi người dùng hỏi về ERP, công việc, linh kiện máy tính, đơn hàng, chính sách, tài chính: Hãy chuyển sang phong thái chuyên nghiệp, cung cấp số liệu chính xác và phân tích chuyên sâu.
3. NGỮ CẢNH & TRÍ NHỚ HỘI THOẠI: Luôn theo sát dòng suy nghĩ và các câu hỏi trước đó trong cuộc hội thoại để phản hồi liền mạch, không hỏi lại những gì người dùng đã nói.
4. NGUYÊN TẮC BẢO MẬT & TRUNG THỰC: 
   - Với dữ liệu nội bộ ERP (đơn hàng, tiền nong, tồn kho): Luôn dựa trên dữ liệu thực tế từ hệ thống, không tự bịa đặt số liệu.
   - Tuyệt đối không cung cấp mật khẩu cá nhân của nhân viên khác.
5. ĐỊNH DẠNG: Trình bày Markdown tinh tế, gãy gọn, có ngắt đoạn rõ ràng, dùng bullet point và icon hợp lý để tạo cảm giác dễ đọc.`;

// Danh sách câu hỏi gợi ý nhanh theo vai trò (Prompt Chips)
const ROLE_PROMPT_CHIPS = {
  SALES: [
    'Chính sách bảo hành và đổi trả 1 đổi 1 của công ty thế nào?',
    'Đơn hàng PC trên 50 triệu có mức chiết khấu gì?',
    'Kiểm tra tồn kho và giá card RTX 4070',
    'Cấu hình i5 13400 + RTX 4060 cần nguồn bao nhiêu Watt?'
  ],
  SALES_MANAGER: [
    'Quy chế duyệt chiết khấu cho khách VIP và B2B?',
    'Kiểm tra tồn kho linh kiện CPU và VGA hiện tại',
    'Chính sách bảo hành phần cứng trong 30 ngày đầu?',
    'Kiểm tra tiến độ đơn hàng gần nhất'
  ],
  WAREHOUSE: [
    'Quy chuẩn đóng gói thùng xốp và chèn túi khí PC khi xuất kho?',
    'Quy trình nộp và đối soát tiền mặt COD với kế toán?',
    'Kiểm tra tồn kho card đồ họa RTX 4070',
    'Tiêu chuẩn kiểm đếm linh kiện khi nhập kho'
  ],
  WAREHOUSE_MANAGER: [
    'Quy trình đối soát tiền COD của shipper với kế toán?',
    'Chính sách lưu kho và đóng gói an toàn linh kiện PC',
    'Kiểm tra tồn kho khả dụng các dòng card đồ họa',
    'Quy chuẩn bàn giao đơn hàng cho shipper'
  ],
  DELIVERY: [
    'Hôm nay tôi có bao nhiêu đơn cần giao?',
    'Quy định chụp ảnh POD khi giao hàng cho khách?',
    'Quy trình nộp tiền mặt COD về kế toán trước mấy giờ?',
    'Khách quét VietQR chuyển khoản thì dùng tài khoản nào?',
    'Xử lý thế nào khi khách từ chối nhận hàng do móp hộp?'
  ],
  ACCOUNTANT: [
    'Báo cáo doanh thu thực tế hôm nay và số dư các tài khoản?',
    'Tài khoản VietQR mặc định của công ty hiện tại là tài khoản nào?',
    'Quy định phân nhiệm kiểm soát nội bộ (SoD) về tài khoản ngân hàng?',
    'Quy trình đối soát thu tiền COD từ shipper'
  ],
  CEO: [
    'Báo cáo nhanh doanh thu hôm nay và số dư ngân hàng',
    'Quy chế thưởng KPI và chi trả bảng lương hàng tháng?',
    'Chính sách bảo hành và thẩm định đổi trả RMA 1 đổi 1',
    'Nguyên tắc phân nhiệm SoD đối với tài khoản công ty'
  ],
  ADMIN: [
    'Quy định quản lý tài khoản ngân hàng doanh nghiệp và VietQR?',
    'Báo cáo tổng quan tài chính và doanh thu hôm nay',
    'Chính sách chiết khấu và duyệt giảm giá bán lẻ',
    'Tiêu chuẩn kỹ thuật lắp ráp và test benchmark PC'
  ]
};

// GET /api/v1/ai/prompt-chips
const getPromptChips = (req, res) => {
  const role = req.user?.role || 'SALES';
  const chips = ROLE_PROMPT_CHIPS[role] || ROLE_PROMPT_CHIPS.SALES;
  res.json({ success: true, role, chips });
};

// ============================================================================
// AI-POWERED INTENT CLASSIFIER (Phân loại ý định bằng Gemini AI)
// Giải quyết triệt để mọi trường hợp AI hiểu sai mục đích câu hỏi:
//   - Câu hỏi dài, phức tạp, không có keyword rõ ràng
//   - Câu hỏi có ngữ cảnh vai trò ("của quản lý bán hàng")
//   - Câu hỏi bị nhầm intent do chứa keyword chung (vd: "đóng gói" → order vs SOP)
// ============================================================================
const INTENT_CLASSIFIER_PROMPT = `Bạn là hệ thống phân tích ý định (Intent & Semantic Analyzer) cho trợ lý ERP AetherPC - chuyên bán lẻ linh kiện máy tính, lắp ráp PC Gaming/Workstation, bảo hành RMA, và giao vận.

Phân tích câu hỏi và trả về ĐÚNG MỘT JSON object (không markdown, không giải thích):

{
  "intent": "<INTENT_CODE>",
  "subIntent": "<mô tả ngắn gọn ý định cụ thể bằng tiếng Việt>",
  "entities": {
    "orderId": null,
    "phoneNumber": null,
    "productKeyword": null,
    "cpuName": null,
    "gpuName": null,
    "mainboardName": null,
    "psuWattage": null,
    "targetRole": null,
    "timePeriod": null,
    "sopTopic": null,
    "expandedKeywords": []
  },
  "confidence": 0.0
}

DANH SÁCH INTENT_CODE (chỉ dùng đúng các giá trị này):
- SECURITY_BLOCK: Yêu cầu/hỏi mật khẩu, thông tin đăng nhập của nhân viên khác
- HR_STAFF_COUNT: Thống kê số lượng nhân sự toàn công ty, danh sách tài khoản nhân viên
- MY_PROFILE_TASKS: Hỏi thông tin về CHÍNH BẢN THÂN người hỏi (tôi là ai, thông tin/hồ sơ của tôi, ca làm việc, phòng ban của tôi, hôm nay tôi bán được bao nhiêu, doanh số của tôi, hoa hồng của tôi, công việc/nhiệm vụ của tôi)
- MY_DELIVERY_TASKS: Hỏi số đơn giao hàng đang được phân công cho chính shipper hỏi
- ORDER_LOOKUP: Tra cứu đơn hàng CỤ THỂ (phải có mã đơn DH-xxx/ORD-xxx hoặc số điện thoại 10 chữ số)
- PRODUCT_LOOKUP: Tra cứu linh kiện, giá bán, tồn kho sản phẩm cụ thể
- PC_COMPATIBILITY: Kiểm tra tương thích phần cứng PC, hỏi nguồn bao nhiêu watt cho cấu hình
- FINANCE_REPORT: Báo cáo tổng thể doanh thu, tài chính công ty, số dư ngân hàng, tài khoản VietQR
- KNOWLEDGE_SOP: Hỏi quy trình, chính sách, quy chuẩn, SOP nội bộ công ty, hướng dẫn nghiệp vụ, bảo hành, đổi trả, chiết khấu, KPI, lương thưởng, đóng gói, giao nhận, bảo mật dữ liệu
- GENERAL_CHAT: Kiến thức IT/phần cứng chung, chào hỏi, trò chuyện, hoặc không thuộc các nhóm trên

QUY TẮC PHÂN LOẠI & MỞ RỘNG TỪ KHÓA BẮT BUỘC:
1. Hỏi về BẢN THÂN người hỏi ("tôi", "em", "mình", "của tôi", "bản thân tôi"):
   - "tôi là ai", "thông tin của tôi", "hồ sơ nhân sự của tôi", "tôi vào làm từ khi nào", "phòng ban của tôi" → MY_PROFILE_TASKS
   - "hôm nay tôi bán được bao nhiêu tiền?", "doanh số của tôi tháng này", "tôi bán được mấy đơn rồi" → MY_PROFILE_TASKS (timePeriod="TODAY" hoặc "THIS_MONTH")
   - "hôm nay tôi có bao nhiêu đơn cần giao?" → MY_DELIVERY_TASKS hoặc MY_PROFILE_TASKS
   - "công việc hôm nay của tôi là gì?", "nhiệm vụ của tôi" → MY_PROFILE_TASKS
   => KHÔNG bao giờ nhầm câu hỏi về bản thân sang FINANCE_REPORT (báo cáo công ty) hay GENERAL_CHAT.
2. Mở rộng truy vấn (expandedKeywords) cho KNOWLEDGE_SOP:
   - Hãy suy luận và sinh ra 3-6 từ khóa/thuật ngữ đồng nghĩa tiếng Việt liên quan mật thiết vào "expandedKeywords" để tìm tài liệu chính xác dù người dùng không dùng đúng từ gốc.
   - Vd: "làm sao để không vỡ kính khi ship" → expandedKeywords=["đóng gói", "vận chuyển", "thùng xốp", "túi khí", "chèn xốp", "bể vỡ", "kính cường lực"]
   - Vd: "card bị cháy nổ có được đổi mới không" → expandedKeywords=["bảo hành", "1 đổi 1", "cháy nổ", "từ chối", "vga", "linh kiện"]
3. "quy chuẩn đóng gói", "tiêu chuẩn đóng gói", "cách đóng gói" → KNOWLEDGE_SOP + sopTopic="LOGISTICS_PACKING"
4. "chính sách bảo hành", "quy trình đổi trả", "1 đổi 1" → KNOWLEDGE_SOP + sopTopic="WARRANTY_RMA"
5. Chỉ xếp ORDER_LOOKUP khi có mã đơn (DH-1002, ORD-xxx) hoặc SĐT cụ thể (0912345678)
6. "Báo cáo doanh thu hôm nay của quản lý bán hàng" → FINANCE_REPORT + targetRole="SALES_MANAGER"
7. "RTX 4070 còn hàng không?" → PRODUCT_LOOKUP + productKeyword="RTX 4070"
8. "i5 13400 + RTX 4060 cần nguồn bao nhiêu?" → PC_COMPATIBILITY`;

/**
 * Phân loại ý định bằng Gemini AI (Primary Classifier)
 * @param {string} promptText - Câu hỏi của người dùng
 * @param {string} userRole - Vai trò RBAC của người hỏi
 * @returns {Object|null} - { intent, subIntent, entities, confidence } hoặc null nếu lỗi
 */
const classifyIntent = async (promptText, userRole) => {
  const aiClient = getAiClient();
  if (!aiClient || !process.env.GEMINI_API_KEY) return null;

  try {
    const aiResult = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `${INTENT_CLASSIFIER_PROMPT}\n\n---\nCâu hỏi cần phân loại: "${promptText}"\nVai trò người hỏi: ${userRole}`
        }]
      }],
      config: { temperature: 0.05, maxOutputTokens: 450 }
    });

    const text = aiResult.text?.trim();
    if (!text) return null;

    // Trích xuất JSON từ phản hồi (hỗ trợ cả raw JSON và markdown-wrapped)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validIntents = [
        'SECURITY_BLOCK', 'HR_STAFF_COUNT', 'MY_PROFILE_TASKS', 'MY_DELIVERY_TASKS',
        'ORDER_LOOKUP', 'PRODUCT_LOOKUP', 'PC_COMPATIBILITY', 'FINANCE_REPORT',
        'KNOWLEDGE_SOP', 'GENERAL_CHAT'
      ];
      if (validIntents.includes(parsed.intent)) {
        console.log(`[IntentClassifier] AI: "${promptText.slice(0, 60)}..." → ${parsed.intent} (conf=${parsed.confidence}) | sub: ${parsed.subIntent}`);
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[IntentClassifier] AI classification error:', e.message);
  }
  return null;
};

/**
 * Phân loại ý định bằng Regex (Fallback khi Gemini AI không khả dụng)
 * @param {string} promptText - Câu hỏi của người dùng
 * @returns {Object} - { intent, subIntent, entities, confidence }
 */
const classifyIntentByRegex = (promptText) => {
  const lower = promptText.toLowerCase();

  // 1. Chặn bảo mật (mật khẩu, thông tin đăng nhập của người khác)
  if (/(mật khẩu|pass|password).*(của|cho|là gì|nhân viên|shipper|admin|sales|kế toán|tài khoản người khác)|(cho|xin|lấy|xem|biết).*(mật khẩu|pass|password)/.test(lower)) {
    return { intent: 'SECURITY_BLOCK', subIntent: 'Yêu cầu mật khẩu', entities: {}, confidence: 0.95 };
  }

  // 2. Tra cứu thông tin BẢN THÂN (Self Context Grounding)
  // Chỉ kích hoạt khi thực sự hỏi về cá nhân: "tôi là ai", "hồ sơ của tôi", "doanh số của tôi", "hoa hồng của tôi"
  // TUYỆT ĐỐI KHÔNG bắt nhầm câu hỏi bắt đầu bằng "cho tôi biết...", "cho tôi xem..." về doanh thu công ty
  const isAskingCompanyData = /(cho tôi|tôi muốn).*(doanh thu|đơn hàng|sản phẩm|tồn kho|báo cáo|tài chính|tiến độ|khách hàng)/i.test(lower);
  if (!isAskingCompanyData) {
    if (/(tôi là ai|tên tôi là|tôi tên gì|thông tin.*(của tôi|của mình|cá nhân)|hồ sơ.*(của tôi|của mình|cá nhân)|tài khoản của tôi|tôi thuộc phòng nào|chức vụ của tôi|tôi vào làm|lương của tôi)/.test(lower) ||
        (/(của tôi|của mình).*(bán được|doanh số|doanh thu|hoa hồng|mấy đơn|nhiệm vụ|công việc)/.test(lower)) ||
        (/(doanh số|hoa hồng|nhiệm vụ|công việc).*(của tôi|của mình)/.test(lower))) {
      const isToday = /hôm nay|ngày nay/.test(lower);
      const isMonth = /tháng này|tháng/.test(lower);
      return {
        intent: 'MY_PROFILE_TASKS',
        subIntent: 'Tra cứu hồ sơ, nhiệm vụ hoặc doanh số của chính nhân viên',
        entities: {
          timePeriod: isToday ? 'TODAY' : isMonth ? 'THIS_MONTH' : 'TODAY',
          expandedKeywords: []
        },
        confidence: 0.95
      };
    }
  }

  // 3. Tra cứu đơn giao của chính shipper
  if (/(đơn hàng|đơn).*(giao|ship)|(giao|ship).*(đơn hàng|đơn)/.test(lower) &&
      /(tôi|mình|của tôi|của mình)/.test(lower) &&
      /(hôm nay|bao nhiêu|số lượng|đơn nào|danh sách)/.test(lower)) {
    return { intent: 'MY_DELIVERY_TASKS', subIntent: 'Tra cứu đơn giao được phân công cho chính tôi', entities: {}, confidence: 0.98 };
  }

  // 4. Thống kê nhân sự toàn công ty
  if (/(bao nhiêu|số lượng|thống kê|tổng số|danh sách).*(nhân viên|tài khoản|nhân sự)|(nhân viên|tài khoản nhân sự|nhân sự).*(bao nhiêu|số lượng|tổng số)/.test(lower)) {
    return { intent: 'HR_STAFF_COUNT', subIntent: 'Thống kê nhân sự', entities: {}, confidence: 0.9 };
  }

  // 5. Tra cứu đơn hàng (cần có mã đơn hoặc SĐT cụ thể)
  const orderIdMatch = promptText.match(/(?:DH|ORD)-[\w-]+/i);
  const phoneMatch = promptText.match(/\b0\d{9,10}\b/);
  if (orderIdMatch || phoneMatch) {
    return { intent: 'ORDER_LOOKUP', subIntent: 'Tra cứu đơn hàng cụ thể', entities: { orderId: orderIdMatch?.[0] || null, phoneNumber: phoneMatch?.[0] || null }, confidence: 0.95 };
  }
  if (/đơn hàng|tiến độ đơn/.test(lower) && !/đóng gói|bọc hàng|thùng xốp|quy chuẩn|chính sách|quy trình|tiêu chuẩn|vỡ kính|bảo quản/.test(lower)) {
    return { intent: 'ORDER_LOOKUP', subIntent: 'Tra cứu đơn hàng chung', entities: {}, confidence: 0.7 };
  }

  // 6. Tra cứu linh kiện & tồn kho (Chỉ kích hoạt khi hỏi về giá, tồn kho, mua bán)
  const isAskingInventoryOrPrice = /tồn kho|còn hàng|giá bao nhiêu|còn mấy cái|tra giá|báo giá|bao nhiêu tiền|mua|bán lẻ|xuất kho/i.test(lower);
  const containsHwKeyword = /rtx|gtx|rx\s?\d{4}|core\s?i\d|ryzen\s?\d|ddr4|ddr5|mainboard|ssd\s?\d/i.test(lower);
  if (isAskingInventoryOrPrice && containsHwKeyword && !/tương thích|nguồn.*watt|socket/i.test(lower)) {
    return { intent: 'PRODUCT_LOOKUP', subIntent: 'Tra cứu sản phẩm/tồn kho', entities: { productKeyword: promptText }, confidence: 0.85 };
  }

  // 7. Tương thích PC
  if (/tương thích|socket|lắp vừa|nguồn bao nhiêu|nguồn.*watt|có đi cùng|lắp chung/.test(lower)) {
    return { intent: 'PC_COMPATIBILITY', subIntent: 'Kiểm tra tương thích phần cứng', entities: {}, confidence: 0.8 };
  }

  // 8. Tài chính (ưu tiên KNOWLEDGE_SOP nếu hỏi quy trình tài chính)
  if (/doanh thu|tài chính|số dư|ngân hàng|mbbank|vcb|vietcombank|quỹ tiền|hôm nay kiếm được/.test(lower)) {
    if (/quy trình|quy định|chính sách|quy chế|sod|phân nhiệm/.test(lower)) {
      return { intent: 'KNOWLEDGE_SOP', subIntent: 'Quy trình/quy định tài chính', entities: { sopTopic: 'FINANCE_BANKING' }, confidence: 0.85 };
    }
    return { intent: 'FINANCE_REPORT', subIntent: 'Báo cáo tài chính', entities: { timePeriod: 'TODAY' }, confidence: 0.8 };
  }

  // 9. Knowledge Base / SOP (quy trình, chính sách, quy chuẩn)
  const semanticTopic = identifySemanticTopic(promptText);
  if (semanticTopic || /bảo mật|an ninh|an toàn|rò rỉ|bảo hành|đổi trả|1 đổi 1|chính sách|quy chế|chiết khấu|quy trình|tiêu chuẩn|quy chuẩn|đóng gói|hướng dẫn|thưởng|kpi|nộp tiền|đối soát|vietqr|sod|lắp ráp|benchmark|furmark|nghỉ việc|sa thải|vỡ kính|bể kính|va đập|chèn xốp|túi khí|bọc hàng|vận chuyển|bảo quản/.test(lower)) {
    return { intent: 'KNOWLEDGE_SOP', subIntent: 'Tra cứu quy trình/chính sách', entities: { sopTopic: semanticTopic?.topic || null }, confidence: 0.75 };
  }

  // 10. Mặc định: hội thoại chung
  return { intent: 'GENERAL_CHAT', subIntent: 'Câu hỏi chung', entities: {}, confidence: 0.5 };
};

// ============================================================================
// POST /api/v1/ai/chat - Hàm xử lý chat chính
// Flow: AI Intent Classification → Route to Handler → Synthesize Response
// ============================================================================
const chatWithAi = async (req, res, next) => {
  const startTime = Date.now();
  const { message, conversationHistory = [] } = req.body;
  const user = req.user || { role: 'SALES', name: 'Nhân viên' };

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Nội dung câu hỏi không được để trống.' });
  }

  const promptText = message.trim();
  const aiClient = getAiClient();
  let toolCallsExecuted = [];
  let finalAiResponse = '';
  let citations = [];

  try {
    // ========================================================================
    // BƯỚC 1: PHÂN LOẠI Ý ĐỊNH BẰNG MÔ HÌNH AI TỰ HUẤN LUYỆN (SELF-TRAINED AI)
    // ========================================================================
    let classified = null;

    // 1. Ưu tiên Mô hình AI NLP tự huấn luyện cục bộ (Self-Trained Model Inference)
    const localNlpResult = await classifyIntentLocal(promptText);
    if (localNlpResult && localNlpResult.confidence >= 0.70) {
      console.log(`[SelfTrainedAI] Mô hình tự train → ${localNlpResult.intent} (conf=${(localNlpResult.confidence * 100).toFixed(1)}%)`);
      classified = {
        intent: localNlpResult.intent,
        subIntent: 'Phân loại bởi Mô hình AI tự huấn luyện (Local NLU Model)',
        entities: { expandedKeywords: [] },
        confidence: localNlpResult.confidence
      };
    }

    // 2. Nếu mô hình tự train chưa đủ tự tin (< 70%), kích hoạt Gemini AI / Regex Classifier
    if (!classified) {
      const regexMatch = classifyIntentByRegex(promptText);
      const isDirectRegexIntent = ['MY_DELIVERY_TASKS', 'MY_PROFILE_TASKS', 'SECURITY_BLOCK'].includes(regexMatch.intent);
      classified = isDirectRegexIntent
        ? regexMatch
        : await classifyIntent(promptText, user.role);

      if (!classified) {
        classified = regexMatch;
        console.log(`[IntentRouter] Regex fallback → ${classified.intent} (conf=${classified.confidence})`);
      } else if (classified.intent === 'GENERAL_CHAT' && (classified.confidence || 0) < 0.75) {
        if (regexMatch.intent !== 'GENERAL_CHAT') {
          console.log(`[IntentRouter] AI uncertain (${classified.confidence}), regex override → ${regexMatch.intent}`);
          classified = regexMatch;
        }
      }
    }

    const intent = classified.intent;
    const entities = classified.entities || {};
    const subIntent = classified.subIntent || '';

    console.log(`[IntentRouter] FINAL: intent=${intent} | sub="${subIntent}" | entities=${JSON.stringify(entities)}`);

    // ========================================================================
    // BƯỚC 2: THỰC THI THEO Ý ĐỊNH ĐÃ PHÂN LOẠI
    // ========================================================================
    switch (intent) {

      // -----------------------------------------------------------------------
      // MY PROFILE & TASKS: Tra cứu hồ sơ, doanh số, nhiệm vụ của chính nhân viên
      // -----------------------------------------------------------------------
      case 'MY_PROFILE_TASKS': {
        const period = entities.timePeriod || 'TODAY';
        const profileResult = await executeToolCall('get_my_profile_and_tasks', { period }, user);
        toolCallsExecuted.push({ tool: 'get_my_profile_and_tasks', params: { period }, result: profileResult });

        if (!profileResult.success) {
          finalAiResponse = profileResult.message || 'Không thể tra cứu thông tin nhân sự của bạn vào lúc này.';
        } else {
          // Tổng hợp câu trả lời tự nhiên, thân thiện bằng Gemini AI
          let synthesized = false;
          if (process.env.GEMINI_API_KEY && aiClient) {
            try {
              const profileContext = `Dữ liệu hồ sơ & hiệu suất cá nhân từ hệ thống ERP:
Hồ sơ nhân viên:
- Họ tên: ${profileResult.profile.name} (Mã NV: ${profileResult.profile.code})
- Chức danh/Vai trò: ${profileResult.profile.role}
- Phòng ban: ${profileResult.profile.department}
- Email: ${profileResult.profile.email} | SĐT: ${profileResult.profile.phone}
- Trạng thái: ${profileResult.profile.status}
- Ngày gia nhập: ${profileResult.profile.joinedAt}
${profileResult.profile.deliveryRegion ? `- Khu vực giao hàng phụ trách: ${profileResult.profile.deliveryRegion}` : ''}

Dữ liệu hoạt động/hiệu suất (${period}):
${JSON.stringify(profileResult.metrics, null, 2)}

Câu hỏi gốc của nhân viên: "${promptText}"
Ý định cụ thể: ${subIntent || 'Hỏi thông tin bản thân/hiệu suất'}

Hãy trả lời trực tiếp, thân thiện, rõ ràng và chuẩn xác dựa trên dữ liệu trên. Định dạng Markdown đẹp.`;

              const aiGen = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: profileContext }] }],
                config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 }
              });
              if (aiGen.text) {
                finalAiResponse = aiGen.text;
                synthesized = true;
              }
            } catch (e) {
              console.warn('[AetherCopilot] Gemini self profile synthesis error:', e.message);
            }
          }

          if (!synthesized) {
            const p = profileResult.profile;
            const m = profileResult.metrics;
            let metricText = '';
            if (m.sales) {
              metricText = `\n- **Doanh số bán hàng (${period === 'TODAY' ? 'Hôm nay' : 'Tháng này'}):** **${m.sales.totalRevenue}** (${m.sales.soldOrdersCount} đơn hàng)`;
              if (m.sales.recentOrders?.length > 0) {
                metricText += `\n- **Đơn gần nhất:** ` + m.sales.recentOrders.map(o => `#${o.orderId} (${o.total})`).join(', ');
              }
            }
            if (m.delivery) {
              metricText = `\n- **Đơn giao đang xử lý:** **${m.delivery.pendingOrdersCount} đơn** | Đã hoàn thành: ${m.delivery.deliveredCount} đơn`;
            }
            if (m.warehouse) {
              metricText = `\n- **Lệnh lắp ráp đang xử lý:** **${m.warehouse.assignedWorkOrders} lệnh** | Phiếu QC: ${m.warehouse.qcInspectionsCount}`;
            }

            finalAiResponse = `👤 **Thông tin Nhân sự & Hoạt động của bạn:**\n\n` +
              `- **Họ và tên:** **${p.name}** (\`${p.code}\`)\n` +
              `- **Vị trí / Chức danh:** **${p.role}** - Phòng ban: **${p.department}**\n` +
              `- **Email:** ${p.email} | **SĐT:** ${p.phone}\n` +
              `- **Ngày vào làm:** ${p.joinedAt} (Trạng thái: *${p.status}*)${metricText}`;
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // SECURITY BLOCK: Chặn yêu cầu mật khẩu (Zero-Trust)
      // -----------------------------------------------------------------------
      case 'SECURITY_BLOCK': {
        finalAiResponse = `🔒 **Cảnh Báo Bảo Mật & An Toàn Thông Tin (Zero-Trust Security):**\n\n` +
          `- Hệ thống AetherCopilot **tuyệt đối không lưu trữ, không tra cứu và không thể cung cấp mật khẩu** của bất kỳ nhân sự hoặc tài khoản nào trong hệ thống.\n` +
          `- Toàn bộ mật khẩu của nhân viên (kể cả nhân viên giao hàng / Shipper) đều được mã hóa một chiều (Bcrypt Salted Hash) theo tiêu chuẩn an ninh dữ liệu.\n` +
          `- **Quy trình cấp lại:** Nếu nhân sự quên mật khẩu hoặc cần cấp mới, Quản trị viên (Admin) có thể thực hiện tại menu: **Quản Trị Hệ Thống > Tài Khoản & Người Dùng** (nút *Đổi Mật Khẩu*).\n\n` +
          `📄 *Căn cứ: Điều 2 - Quy tắc bảo mật tài khoản & đăng nhập (Chính sách Bảo Mật AetherPC)*`;
        citations.push({ title: 'Chính sách bảo mật', slug: 'chinh-sach-bao-mat', category: 'POLICY' });
        break;
      }

      // -----------------------------------------------------------------------
      // HR STAFF COUNT: Thống kê nhân sự (kiểm soát RBAC)
      // -----------------------------------------------------------------------
      case 'HR_STAFF_COUNT': {
        if (!['ADMIN', 'CEO', 'HR'].includes(user.role)) {
          finalAiResponse = `⚠️ **Từ chối truy cập:** Vai trò của bạn (**${user.role}**) không có thẩm quyền tra cứu dữ liệu nhân sự của công ty. Vui lòng liên hệ Quản trị viên (Admin) hoặc phòng Nhân sự.`;
        } else {
          const empCount = await prisma.employee.count({ where: { status: 'ACTIVE' } }).catch(() => 0);
          const totalEmp = await prisma.employee.count().catch(() => 0);
          const rolesGroup = await prisma.employee.groupBy({ by: ['role'], _count: { id: true } }).catch(() => []);

          finalAiResponse = `👥 **Thống kê Tài Khoản & Nhân Sự AetherPC:**\n\n` +
            `- **Tổng số tài khoản nhân viên:** **${totalEmp} tài khoản** (${empCount} nhân sự đang hoạt động ACTIVE)\n` +
            `- **Phân bổ theo vai trò chức năng:**\n` +
            rolesGroup.map(r => `  • **${r.role}:** ${r._count.id} nhân sự`).join('\n') +
            `\n\n*Ghi chú: Bạn có thể xem và quản lý chi tiết danh sách tại menu **Quản Trị Hệ Thống > Tài Khoản & Người Dùng**.*`;
        }
        break;
      }

      // -----------------------------------------------------------------------
      // ORDER LOOKUP: Tra cứu tiến độ đơn hàng (Live Database)
      // -----------------------------------------------------------------------
      case 'ORDER_LOOKUP': {
        // Ưu tiên entity đã trích xuất từ AI classifier, fallback sang regex
        const orderQuery = entities.orderId || entities.phoneNumber || promptText.match(/(?:DH|ORD)-[\w-]+|0\d{9,10}/i)?.[0] || promptText;
        const orderResult = await executeToolCall('lookup_order_status', { orderIdOrPhone: orderQuery }, user);
        toolCallsExecuted.push({ tool: 'lookup_order_status', params: { orderIdOrPhone: orderQuery }, result: orderResult });

        if (orderResult.found && orderResult.order) {
          const o = orderResult.order;
          finalAiResponse = `📦 **Thông tin Đơn hàng #${o.orderId}:**\n\n` +
            `- **Trạng thái:** **${o.status}**\n` +
            `- **Khách hàng:** ${o.customerName} (${o.customerPhone})\n` +
            `- **Tổng giá trị:** ${o.totalAmount}\n` +
            `- **Thanh toán:** ${o.paymentSummary}\n` +
            `- **Shipper phụ trách:** ${o.shipper}\n` +
            `- **Linh kiện trong đơn:** ${o.itemNames || 'Chi tiết đơn lẻ'}`;
        } else {
          // Thử tra cứu qua Universal ERP Live Data Engine (cho các câu hỏi tổng hợp: thống kê trạng thái, top đơn, v.v.)
          const universalResult = await executeUniversalDataQuery(promptText, user).catch(() => null);
          if (universalResult && universalResult.success && universalResult.rowCount > 0) {
            finalAiResponse = universalResult.finalResponse;
            toolCallsExecuted.push({
              tool: 'universal_live_data_query',
              params: { query: promptText, sql: universalResult.sqlUsed },
              result: { rowCount: universalResult.rowCount }
            });
          } else {
            // Cơ chế Khai vấn Thông minh (Intelligent Clarification & Next Best Action)
            let clarificationGiven = false;
            if (aiClient) {
              try {
                const clarifyPrompt = `Người dùng vừa hỏi: "${promptText}".
Hệ thống ERP vừa tra cứu nhưng không tìm thấy dữ liệu trực tiếp nào khớp.
Hãy phân tích câu hỏi trên và đưa ra phản hồi lịch sự, thân thiện:
1. Thông báo ngắn gọn là chưa tìm thấy dữ liệu khớp hoàn toàn.
2. Đặt câu hỏi: "💡 Có phải bạn đang muốn tìm kiếm một trong các mục sau không?"
3. Đưa ra 2-3 hướng gợi ý cụ thể liên quan đến các nghiệp vụ ERP (tra cứu theo mã đơn, tra cứu đơn theo khu vực/trạng thái, hoặc xem tồn kho/chính sách).
4. Hướng dẫn người dùng cung cấp thông tin chuẩn để hệ thống hỗ trợ tốt nhất.
Định dạng Markdown đẹp, gãy gọn, tinh tế.`;

                const aiGen = await aiClient.models.generateContent({
                  model: 'gemini-2.5-flash',
                  contents: [{ role: 'user', parts: [{ text: clarifyPrompt }] }],
                  config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 }
                });
                if (aiGen.text) {
                  finalAiResponse = aiGen.text;
                  clarificationGiven = true;
                }
              } catch (e) {
                console.warn('[AetherCopilot] Gemini clarification error:', e.message);
              }
            }

            if (!clarificationGiven) {
              finalAiResponse = `Mình vừa tra cứu nhưng chưa tìm thấy đơn hàng nào khớp với thông tin "${orderQuery}".\n\n💡 **Có phải bạn đang muốn:**\n- 📦 Tra cứu theo **Mã đơn hàng** (ví dụ: \`ORD-260408-0006\`, \`DH-1002\`)?\n- 📱 Tra cứu các đơn hàng đã đặt theo **Số điện thoại** người nhận?\n- 🚚 Kiểm tra danh sách các đơn hàng **đang giao** hoặc **chờ giao**?\n\nBạn có thể cung cấp thêm chi tiết để mình hỗ trợ ngay nhé!`;
            }
          }
        }
        break;
      }

      case 'MY_DELIVERY_TASKS': {
        const result = await executeToolCall('get_my_delivery_tasks', {}, user);
        toolCallsExecuted.push({ tool: 'get_my_delivery_tasks', result });

        if (result.error === 'PERMISSION_DENIED') {
          finalAiResponse = 'Tính năng này chỉ dành cho tài khoản nhân viên giao hàng.';
        } else if (result.error === 'INVALID_EMPLOYEE') {
          finalAiResponse = 'Không xác định được tài khoản nhân viên của bạn để tra cứu đơn được phân công.';
        } else if (result.success) {
          const orderLines = result.orders.map(order => `- **${order.orderId}** (${order.status})`).join('\n');
          finalAiResponse = `Hôm nay bạn đang được phân công **${result.count} đơn chưa hoàn tất**${result.count ? `:\n\n${orderLines}` : '.'}\n\n*${result.note}*`;
        }
        break;
      }

      // -----------------------------------------------------------------------
      // PRODUCT LOOKUP: Tra cứu linh kiện & tồn kho (Live Database)
      // -----------------------------------------------------------------------
      case 'PRODUCT_LOOKUP': {
        // Dùng productKeyword từ AI classifier nếu có (đã được AI làm sạch)
        const keyword = entities.productKeyword || promptText;
        const productResult = await executeToolCall('lookup_products', { keyword }, user);
        toolCallsExecuted.push({ tool: 'lookup_products', params: { keyword }, result: productResult });

        if (productResult.found && productResult.products?.length > 0) {
          finalAiResponse = `🔍 **Tìm thấy ${productResult.products.length} linh kiện phù hợp trong kho AetherPC:**\n\n` +
            productResult.products.map(p =>
              `- **${p.name}**\n  • Giá bán lẻ: **${p.retailPriceFormatted}**\n  • Tồn kho khả dụng: **${p.availableStock} sản phẩm** (${p.stockLocations || 'Kho chính'})\n  • Mã SKU: \`${p.sku || 'N/A'}\``
            ).join('\n\n');
        } else {
          finalAiResponse = `Hiện tại kho của AetherPC không tìm thấy linh kiện nào có tên "${keyword}". Bạn có thể kiểm tra danh mục trên trang Kho hoặc tạo Phiếu yêu cầu nhập hàng (PR).`;
        }
        break;
      }

      // -----------------------------------------------------------------------
      // PC COMPATIBILITY: Kiểm tra tương thích phần cứng PC
      // -----------------------------------------------------------------------
      case 'PC_COMPATIBILITY': {
        // Ưu tiên entity từ AI classifier, fallback sang regex extraction
        let cpuMatch = entities.cpuName || promptText.match(/i[3579]-?\d{4,5}[A-Z]?|ryzen\s?[3579]\s?\d{4}[A-Z]?/i)?.[0] || 'Intel Core i5-13400F';
        let mbMatch = entities.mainboardName || promptText.match(/[hbz]\d{3}[A-Z]?|a620|b650|x670/i)?.[0] || 'B760M';
        let gpuMatch = entities.gpuName || promptText.match(/rtx\s?\d{4}[A-Z\s]*|gtx\s?\d{4}|rx\s?\d{4}[A-Z]*/i)?.[0] || 'RTX 4060';
        let psuMatch = entities.psuWattage || parseInt(promptText.match(/(\d{3})\s?w/i)?.[1] || '0', 10);

        const compResult = executeToolCall('check_pc_compatibility', {
          cpuName: cpuMatch, mainboardName: mbMatch, gpuName: gpuMatch, psuWattage: psuMatch
        });
        toolCallsExecuted.push({ tool: 'check_pc_compatibility', result: compResult });

        finalAiResponse = `🔧 **Kết quả thẩm định tương thích linh kiện PC:**\n\n` +
          `- **Cấu hình kiểm tra:** CPU ${cpuMatch} + Mainboard ${mbMatch} + Card ${gpuMatch} ${psuMatch > 0 ? `(Nguồn ${psuMatch}W)` : ''}\n` +
          `- **Đánh giá:** **${compResult.summary}**\n\n` +
          (compResult.issues.length > 0 ? `⚠️ **Vấn đề cảnh báo:**\n${compResult.issues.map(i => `- ${i}`).join('\n')}\n\n` : '') +
          compResult.notes.map(n => `✅ ${n}`).join('\n');
        break;
      }

      // -----------------------------------------------------------------------
      // FINANCE REPORT: Tra cứu tài chính, doanh thu, tài khoản ngân hàng SoD
      // Hỗ trợ ngữ cảnh: targetRole, timePeriod, subIntent
      // -----------------------------------------------------------------------
      case 'FINANCE_REPORT': {
        // Nếu người dùng hỏi doanh thu cụ thể theo thời gian (năm nay, tháng này, quý này, từng tháng, top sản phẩm, kênh online...)
        // hãy ưu tiên Universal Live Data Engine để query đúng 100% số liệu thực từ database
        const isTimePeriodRevenue = /(năm nay|tháng này|tháng trước|hôm qua|tuần này|từng tháng|chi tiết|bao nhiêu|kênh|danh mục|quý)/i.test(promptText);
        if (isTimePeriodRevenue) {
          const universalResult = await executeUniversalDataQuery(promptText, user).catch(() => null);
          if (universalResult && universalResult.success) {
            finalAiResponse = universalResult.finalResponse;
            toolCallsExecuted.push({
              tool: 'universal_live_data_query',
              params: { query: promptText, sql: universalResult.sqlUsed },
              result: { rowCount: universalResult.rowCount }
            });
            break;
          }
        }

        const toolResult = await executeToolCall('get_finance_kpi', { period: entities.timePeriod || 'TODAY' }, user);
        toolCallsExecuted.push({ tool: 'get_finance_kpi', params: { period: entities.timePeriod || 'TODAY' }, result: toolResult });

        if (!toolResult.success && toolResult.error === 'PERMISSION_DENIED') {
          finalAiResponse = `⚠️ **Từ chối truy cập:** Vai trò của bạn (**${user.role}**) không có thẩm quyền tra cứu dữ liệu tài chính của doanh nghiệp. Vui lòng liên hệ Ban Giám Đốc (CEO) hoặc Kế Toán Trưởng.`;
        } else if (toolResult.data) {
          // Thử tra cứu thêm qua Universal SQL để trả lời chính xác số liệu
          const universalResult = await executeUniversalDataQuery(promptText, user).catch(() => null);
          if (universalResult && universalResult.success) {
            finalAiResponse = universalResult.finalResponse;
            toolCallsExecuted.push({
              tool: 'universal_live_data_query',
              params: { query: promptText, sql: universalResult.sqlUsed },
              result: { rowCount: universalResult.rowCount }
            });
            break;
          }

          // Nếu câu hỏi có ngữ cảnh đặc biệt (targetRole, subIntent cụ thể), dùng Gemini tổng hợp phản hồi phù hợp ngữ cảnh
          const hasContext = entities.targetRole || (subIntent && subIntent !== 'Báo cáo tài chính');
          if (hasContext && aiClient) {
            try {
              const contextPrompt = `Dữ liệu tài chính AetherPC:
- Doanh thu thực thu trong ngày: ${toolResult.data.todayRevenue}
- Tài khoản VietQR nhận tiền mặc định: ${toolResult.data.defaultQrAccount}
- Số lượng tài khoản ngân hàng hoạt động: ${toolResult.data.activeBankCount}
- Chi tiết tài khoản: ${(toolResult.data.activeBanks || []).join('; ')}

Câu hỏi gốc của nhân viên: "${promptText}"
${entities.targetRole ? `Vai trò/bộ phận được nhắc đến: ${entities.targetRole}` : ''}
${subIntent ? `Ý định cụ thể: ${subIntent}` : ''}
Vai trò người hỏi: ${user.role}

Hãy trả lời chính xác dựa trên dữ liệu trên. Dùng Markdown đẹp, chuyên nghiệp.`;

              const aiGen = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: contextPrompt }] }],
                config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 }
              });
              if (aiGen.text) finalAiResponse = aiGen.text;
            } catch (e) {
              console.warn('[AetherCopilot] Contextualized finance response error:', e.message);
            }
          }

          // Fallback template nếu Gemini synthesis thất bại hoặc không có context đặc biệt
          if (!finalAiResponse) {
            finalAiResponse = `📊 **Báo cáo Dòng Tiền & Tài Khoản Doanh Nghiệp (Hôm nay):**\n\n` +
              `- **Doanh thu thực thu trong ngày:** **${toolResult.data.todayRevenue}**\n` +
              `- **Tài khoản VietQR nhận tiền mặc định:** **${toolResult.data.defaultQrAccount}**\n` +
              `- **Số lượng tài khoản hoạt động:** ${toolResult.data.activeBankCount} tài khoản.\n\n` +
              `*Lưu ý: Dữ liệu được trích xuất từ Sổ cái kế toán thời gian thực theo chuẩn phân nhiệm SoD.*`;
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // KNOWLEDGE SOP: Tra cứu quy trình, chính sách, SOP nội bộ
      // -----------------------------------------------------------------------
      case 'KNOWLEDGE_SOP': {
        const lookupParams = {
          query: promptText,
          expandedKeywords: entities.expandedKeywords || [],
          semanticTopic: entities.sopTopic || null
        };
        const toolResult = await executeToolCall('lookup_knowledge_base', lookupParams, user);
        toolCallsExecuted.push({ tool: 'lookup_knowledge_base', params: lookupParams, result: toolResult });

        if (toolResult.found && toolResult.documents?.length > 0) {
          const doc = toolResult.documents[0];
          citations.push({ title: doc.title, slug: doc.slug, category: doc.category });
          const excerpt = (doc.relevantSection || doc.contentSnippet || '').trim();

          let synthesized = false;
          if (process.env.GEMINI_API_KEY && aiClient) {
            try {
              const aiGen = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{
                  role: 'user',
                  parts: [{
                    text: `Bạn là trợ lý ERP AetherPC. Dựa trên trích đoạn tài liệu quy chế sau đây:\n"""\n${excerpt}\n"""\nHãy trả lời trực tiếp, rõ ràng, thực tế và gãy gọn cho câu hỏi của nhân viên: "${promptText}".\n${subIntent ? `Ý định cụ thể: ${subIntent}` : ''}\n${entities.sopTopic ? `Chủ đề SOP: ${entities.sopTopic}` : ''}\nNêu rõ phương án xử lý theo quy định, không sao chép thừa thãi.`
                  }]
                }],
                config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.2 }
              });
              if (aiGen.text) {
                finalAiResponse = `${aiGen.text}\n\n📄 *Căn cứ văn bản: [${doc.title}](/admin/system?tab=knowledge&doc=${doc.slug})*`;
                synthesized = true;
              }
            } catch (e) {
              console.warn('[AetherCopilot] Gemini SOP synthesis error, falling back to local format:', e.message);
            }
          }

          if (!synthesized) {
            finalAiResponse = `📋 **Quy định xử lý theo văn bản AetherPC:**\n\n${excerpt}\n\n📄 *Căn cứ văn bản: [${doc.title}](/admin/system?tab=knowledge&doc=${doc.slug})*`;
          }
        } else {
          // Khi tài liệu không có sẵn trong Knowledge Base, nhờ Gemini giải thích theo nghiệp vụ ERP chung
          if (process.env.GEMINI_API_KEY && aiClient) {
            try {
              const aiGen = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{
                  role: 'user',
                  parts: [{
                    text: `Nhân viên AetherPC hỏi: "${promptText}".\nHệ thống Knowledge Base nội bộ hiện chưa có văn bản quy chế ban hành riêng cho chủ đề này. Hãy giải thích ngắn gọn, chuẩn mực, khách quan theo thực tiễn linh kiện máy tính / ERP và khuyên nhân viên tham khảo ý kiến Trưởng bộ phận nếu cần phê duyệt đặc biệt.`
                  }]
                }],
                config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 }
              });
              if (aiGen.text) {
                finalAiResponse = aiGen.text;
              }
            } catch (e) {
              console.warn('[AetherCopilot] Gemini SOP fallback answer error:', e.message);
            }
          }
        }
        break;
      }

      // -----------------------------------------------------------------------
      // UNIVERSAL ERP LIVE DATA & GENERAL CHAT
      // -----------------------------------------------------------------------
      case 'UNIVERSAL_DATA_QUERY':
      case 'GENERAL_CHAT':
      default: {
        const isGreeting = /^(chào|xin chào|hi|hello|hey|bạn là ai|alo|cảm ơn|thank)/i.test(promptText);

        // Chỉ chạy qua Universal SQL khi câu hỏi thực sự hỏi về dữ liệu hoặc thống kê ERP
        if (!isGreeting) {
          try {
            const universalResult = await executeUniversalDataQuery(promptText, user);
            if (universalResult && universalResult.success && universalResult.finalResponse) {
              finalAiResponse = universalResult.finalResponse;
              toolCallsExecuted.push({
                tool: 'universal_live_data_query',
                params: { query: promptText, sql: universalResult.sqlUsed },
                result: { rowCount: universalResult.rowCount }
              });
              break;
            }
          } catch (uErr) {
            console.warn('[AetherCopilot] Universal live data engine bypass:', uErr.message);
          }
        }

        if (process.env.GEMINI_API_KEY && aiClient) {
          try {
            const aiGen = await aiClient.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                ...conversationHistory.slice(-8).map(h => ({
                  role: (h.sender === 'USER' || h.role === 'user') ? 'user' : 'model',
                  parts: [{ text: h.content || h.text || '' }]
                })),
                { role: 'user', parts: [{ text: promptText }] }
              ],
              config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.7 }
            });
            if (aiGen.text) {
              finalAiResponse = aiGen.text;
            }
          } catch (e) {
            console.warn('[AetherCopilot] Gemini general response error:', e.message);
          }
        }
        break;
      }
    }

    // ========================================================================
    // BƯỚC 3: FALLBACK CUỐI CÙNG - Menu trợ lý điều hướng ERP
    // ========================================================================
    if (!finalAiResponse) {
      finalAiResponse = `Xin chào **${user.name || 'bạn'}**! Tôi là **AetherCopilot** - Trợ lý Doanh nghiệp AetherPC ERP.\n\nTôi có thể hỗ trợ bạn trực tiếp các tác vụ:\n- 🔍 **Tra cứu tồn kho & Giá:** *"Kiểm tra tồn kho card RTX 4070"*, *"Giá CPU i5 13400"*\n- 📦 **Kiểm tra tiến độ đơn hàng:** *"Tra cứu đơn hàng DH-1002"*, *"Đơn hàng theo SĐT 0912345678"*\n- ⚙️ **Thẩm định tương thích PC:** *"i5 13400 + RTX 4060 cần nguồn bao nhiêu Watt?"*\n- 📖 **Tra cứu quy trình & chính sách:** *"Chính sách bảo hành 1 đổi 1"*, *"Quy chuẩn đóng gói thùng xốp"*\n${['CEO', 'ADMIN', 'ACCOUNTANT'].includes(user.role) ? '- 💰 **Báo cáo tài chính:** *"Báo cáo doanh thu hôm nay và tài khoản VietQR"*\n' : ''}\nBạn cần tôi hỗ trợ việc gì ngay bây giờ?`;
    }

    const latencyMs = Date.now() - startTime;

    // Ghi vết vào bảng AiAuditLog để phục vụ kiểm toán an toàn thông tin
    const auditLog = await prisma.aiAuditLog.create({
      data: {
        userId: user.id || null,
        userEmail: user.email || 'internal@aetherpc.com',
        userName: user.fullName || user.name || 'Nhân viên ERP',
        userRole: user.role || 'SALES',
        userPrompt: promptText,
        toolCalls: toolCallsExecuted.length > 0 ? toolCallsExecuted : null,
        aiResponse: finalAiResponse,
        latencyMs,
        status: 'SUCCESS'
      }
    }).catch(err => {
      console.warn('[AetherCopilot] Ghi Audit Log thất bại:', err.message);
      return null;
    });

    res.json({
      success: true,
      data: {
        reply: finalAiResponse,
        response: finalAiResponse,
        citations,
        toolCalls: toolCallsExecuted.map(t => t.tool),
        latencyMs,
        auditLogId: auditLog?.id || null
      }
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;

    await prisma.aiAuditLog.create({
      data: {
        userId: user.id || null,
        userEmail: user.email || null,
        userName: user.fullName || user.name || null,
        userRole: user.role || null,
        userPrompt: promptText,
        toolCalls: null,
        aiResponse: null,
        latencyMs,
        status: 'ERROR',
        errorMessage: err.message
      }
    }).catch(() => {});

    if (typeof next === 'function') {
      next(err);
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

// GET /api/v1/ai/audit-logs (Chỉ Admin / CEO)
const getAiAuditLogs = async (req, res, next) => {
  try {
    const logs = await prisma.aiAuditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  chatWithAi,
  getPromptChips,
  getAiAuditLogs,
  classifyIntent,
  classifyIntentByRegex
};
