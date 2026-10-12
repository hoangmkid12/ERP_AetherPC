/**
 * Lớp gọi Gemini dùng chung cho AetherCopilot.
 *
 * - Một client duy nhất (trước đây mỗi lượt chat tạo mới GoogleGenAI vài lần).
 * - Tự thử lại khi Gemini quá tải / vượt hạn mức (429, 5xx) và chuyển sang model dự phòng
 *   GEMINI_FALLBACK_MODEL nếu có cấu hình.
 * - System prompt có ngữ cảnh thật của phiên: ngày giờ hiện tại, tên + vai trò người hỏi,
 *   bản đồ menu ERP — để câu trả lời cụ thể, đúng người, đúng lúc thay vì chung chung.
 * - polishGroundedAnswer: viết lại câu trả lời dạng "khuôn mẫu" của tầng offline cho tự nhiên,
 *   đa dạng hơn, nhưng KIỂM TRA không được làm sai/bịa số liệu; sai thì giữ nguyên bản gốc.
 */
const { GEMINI_MODEL } = require('./geminiConfig');

let GoogleGenAI = null;
try {
  ({ GoogleGenAI } = require('@google/genai'));
} catch (e) {
  // @google/genai là tuỳ chọn — không có thì trợ lý chạy chế độ offline
}

let cachedClient = null;
let cachedKey = null;
const getClient = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !GoogleGenAI) return null;
  if (!cachedClient || cachedKey !== key) {
    cachedClient = new GoogleGenAI({ apiKey: key });
    cachedKey = key;
  }
  return cachedClient;
};

const isAvailable = () => Boolean(getClient());

const RETRYABLE = /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|quota|deadline/i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Gọi Gemini và trả về text (hoặc '' nếu lỗi / không có client).
 * @param {{ contents: any[], system?: string, temperature?: number, maxOutputTokens?: number, topP?: number }} opts
 */
const generate = async ({ contents, system, temperature = 0.4, maxOutputTokens, topP }) => {
  const client = getClient();
  if (!client) return '';
  const models = [GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL].filter((m, i, a) => m && a.indexOf(m) === i);
  const config = { temperature };
  if (system) config.systemInstruction = system;
  if (maxOutputTokens) config.maxOutputTokens = maxOutputTokens;
  if (topP) config.topP = topP;

  let lastErr = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await client.models.generateContent({ model, contents, config });
        return (res.text || '').trim();
      } catch (err) {
        lastErr = err;
        if (!RETRYABLE.test(String(err?.message || err?.status || ''))) break; // lỗi khác (key sai, prompt bị chặn...) thì thử lại vô ích
        if (attempt === 0) await sleep(600);
      }
    }
  }
  if (lastErr) console.warn('[Gemini] Gọi model thất bại:', lastErr.message);
  return '';
};

/**
 * Lịch sử chat từ client ({ role: 'user'|'assistant', content }) → định dạng contents của Gemini.
 * Gemini yêu cầu lượt đầu là 'user' và các lượt xen kẽ — bỏ lời chào mở đầu của bot,
 * gộp các lượt liền nhau cùng vai.
 */
const historyToContents = (history = [], limit = 8) => {
  const turns = [];
  for (const h of history.slice(-limit)) {
    const text = String(h?.content || h?.text || '').trim();
    if (!text) continue;
    const role = (h.role === 'user' || h.sender === 'USER') ? 'user' : 'model';
    if (!turns.length && role === 'model') continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n\n${text}`;
    else turns.push({ role, parts: [{ text }] });
  }
  if (turns.length && turns[turns.length - 1].role === 'user') turns.pop(); // lượt user hiện tại được thêm riêng
  return turns;
};

const ROLE_LABELS = {
  CEO: 'Giám đốc điều hành', ADMIN: 'Quản trị hệ thống', SALES: 'Nhân viên bán hàng',
  SALES_MANAGER: 'Quản lý bán hàng', WAREHOUSE: 'Nhân viên kho', WAREHOUSE_MANAGER: 'Quản lý kho',
  ACCOUNTANT: 'Kế toán', DELIVERY: 'Nhân viên giao hàng', QC: 'Nhân viên QA/QC', QA: 'Nhân viên QA/QC',
  QUALITY_CONTROL: 'Nhân viên QA/QC', HR: 'Nhân sự', CSKH: 'Chăm sóc khách hàng', PURCHASING: 'Mua hàng',
  ASSEMBLY: 'Kỹ thuật viên lắp ráp', EMPLOYEE: 'Nhân viên'
};

const nowInVietnam = () => new Date().toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

const BASE_PERSONA = `Bạn là AetherCopilot — trợ lý AI nội bộ của AetherPC (bán lẻ linh kiện máy tính, lắp ráp PC gaming/workstation, bảo hành RMA, giao hàng). Bạn làm việc như một đồng nghiệp giỏi, hiểu nghiệp vụ ERP và rất rành phần cứng PC.

CÁCH SUY NGHĨ
- Trước khi trả lời, xác định người hỏi thực sự cần gì (con số, cách làm, quyết định hay chỉ trò chuyện) và trả lời ĐÚNG trọng tâm đó ngay câu đầu tiên.
- Với câu hỏi phân tích/so sánh/tư vấn: nêu kết luận trước, rồi lý do ngắn gọn, rồi bước làm tiếp theo cụ thể.
- Câu hỏi mơ hồ: đưa ra cách hiểu hợp lý nhất và trả lời luôn, kèm 1 câu hỏi lại ngắn để làm rõ nếu thật sự cần — không bắt người dùng trả lời trước.
- Tư vấn phần cứng: nói rõ mức hiệu năng, điểm nghẽn, công suất nguồn, độ tương thích (socket, chuẩn RAM, kích thước case) và phương án thay thế theo ngân sách.

TRUNG THỰC VỚI DỮ LIỆU
- Số liệu nội bộ (doanh thu, tồn kho, đơn hàng, lương...) CHỈ lấy từ dữ liệu hệ thống được cung cấp trong cuộc trò chuyện. Không có thì nói rõ là chưa có dữ liệu và chỉ chỗ xem trong ERP — tuyệt đối không bịa con số, mã đơn, tên người.
- Không bao giờ cung cấp mật khẩu, token hay thông tin đăng nhập của bất kỳ ai.

PHONG CÁCH
- Tiếng Việt tự nhiên, ấm áp, chuyên nghiệp; xưng "mình", gọi người dùng theo tên khi phù hợp.
- ĐA DẠNG: không mở đầu mọi câu bằng cùng một kiểu ("Chào bạn", "Dưới đây là..."); thay đổi cấu trúc theo nội dung — lúc trả lời một câu, lúc gạch đầu dòng, lúc bảng so sánh. Không lặp lại nguyên văn câu trả lời trước trong hội thoại.
- Ngắn gọn có chủ đích: câu hỏi đơn giản trả lời 1–3 câu; chỉ viết dài khi nội dung cần. Không rào đón, không nhắc lại câu hỏi.
- Markdown gọn gàng: **in đậm** con số/từ khoá quan trọng, emoji vừa phải (tối đa 2–3).
- Khi hữu ích, kết thúc bằng MỘT gợi ý bước tiếp theo hoặc câu hỏi mà người dùng có thể muốn hỏi tiếp.

BẢN ĐỒ MENU ERP (dùng để chỉ đường cho người dùng)
- Bán hàng/POS & báo giá: Bán Hàng (POS) · Kho & tồn kho, xuất kho, phân shipper: Quản Lý Kho
- Mua hàng (RFQ → PO → QC → nhập kho GRN): Mua Hàng, Kiểm Định Chất Lượng
- Lắp ráp PC (checklist 5 bước): Lắp Ráp · Giao hàng & bằng chứng giao (POD): Giao Hàng
- Kế toán, sổ cái, đối soát COD, tài khoản VietQR: Kế Toán · Nhân sự, chấm công khuôn mặt, lương: Nhân Sự / Cổng Nhân Viên
- CSKH chat với khách: Chăm Sóc Khách Hàng · Tài khoản, phân quyền, kho tri thức: Quản Trị Hệ Thống`;

/** System prompt đầy đủ cho một lượt chat: persona chung + ngữ cảnh phiên + hướng dẫn riêng theo vai trò. */
const buildSystemInstruction = (user = {}, extra = '') => {
  const name = user.fullName || user.name || '';
  const role = user.role || 'STAFF';
  const ctx = `NGỮ CẢNH PHIÊN LÀM VIỆC
- Thời điểm hiện tại: ${nowInVietnam()} (giờ Việt Nam)
- Người đang trò chuyện: ${name ? `${name} — ` : ''}${ROLE_LABELS[role] || role} (mã vai trò ${role}). Ưu tiên ví dụ, quy trình và quyền hạn đúng với vai trò này; không hướng dẫn thao tác mà vai trò này không có quyền.`;
  return [BASE_PERSONA, ctx, extra].filter(Boolean).join('\n\n');
};

// ---------------------------------------------------------------------------
// Viết lại câu trả lời có dữ liệu cho tự nhiên mà vẫn giữ đúng 100% số liệu
// ---------------------------------------------------------------------------

// Lấy các "con số" có nghĩa (≥ 2 chữ số, bỏ dấu phân cách) để so khớp trước/sau khi viết lại.
const extractNumbers = (text) => (String(text).match(/\d[\d.,]*\d|\d/g) || [])
  .map(n => n.replace(/[.,]/g, ''))
  .filter(n => n.length >= 2);

const numbersPreserved = (draft, rewritten) => {
  const after = new Set(extractNumbers(rewritten));
  const before = new Set(extractNumbers(draft));
  for (const n of before) if (!after.has(n)) return false;
  // Không được thêm số liệu mới (≥ 3 chữ số) ngoài bản gốc — trừ năm hiện tại/ngày giờ hôm nay.
  const year = String(new Date().getFullYear());
  for (const n of after) if (n.length >= 3 && !before.has(n) && n !== year) return false;
  return true;
};

/**
 * Viết lại câu trả lời dữ liệu (khuôn mẫu cố định) thành lời tự nhiên, hợp ngữ cảnh hội thoại.
 * Trả về bản gốc nếu: tắt bằng AI_POLISH=false, không có Gemini, bản gốc quá dài, hoặc bản
 * viết lại làm mất/sai/thêm số liệu.
 */
const polishGroundedAnswer = async ({ draft, question, user, history = [] }) => {
  if (!draft || process.env.AI_POLISH === 'false' || !isAvailable()) return draft;
  if (draft.length > 3500) return draft;
  const prompt = `Câu hỏi hiện tại của người dùng: "${question}"

BẢN NHÁP CÂU TRẢ LỜI (đã chứa dữ liệu thật lấy từ ERP):
"""
${draft}
"""

Hãy viết lại bản nháp thành câu trả lời hay hơn:
- Trả lời thẳng vào câu hỏi ngay câu đầu; giọng văn tự nhiên, phù hợp với mạch hội thoại trước đó, không lặp cách mở đầu của các câu trả lời trước.
- GIỮ NGUYÊN CHÍNH XÁC mọi con số, số tiền, mã đơn/mã SKU/mã nhân viên, tên sản phẩm, tên người, ngày giờ và đường dẫn/link có trong bản nháp. Không thêm bất kỳ số liệu nào không có trong bản nháp.
- Có thể sắp xếp lại, gom ý, thêm 1 nhận xét ngắn (VD: hàng sắp hết, đơn đang chậm) nếu suy ra trực tiếp từ dữ liệu, và 1 gợi ý bước tiếp theo.
- Giữ các dòng trích dẫn "Căn cứ văn bản" nếu có. Chỉ trả về nội dung câu trả lời, không giải thích việc viết lại.`;
  const text = await generate({
    contents: [...historyToContents(history, 6), { role: 'user', parts: [{ text: prompt }] }],
    system: buildSystemInstruction(user),
    temperature: 0.75,
    topP: 0.95,
    maxOutputTokens: 1400
  });
  if (!text || text.length < 20) return draft;
  if (!numbersPreserved(draft, text)) {
    console.warn('[Gemini] Bỏ bản viết lại vì lệch số liệu so với dữ liệu gốc.');
    return draft;
  }
  return text;
};

module.exports = {
  getClient,
  isAvailable,
  generate,
  historyToContents,
  buildSystemInstruction,
  polishGroundedAnswer,
  numbersPreserved
};
