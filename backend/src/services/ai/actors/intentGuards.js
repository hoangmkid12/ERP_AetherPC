/**
 * INTENT GUARDS — QUY TẮC ĐỊNH TUYẾN THEO TÍN HIỆU RÕ RÀNG
 *
 * Bổ sung cho tầng Regex/Vector để giảm loại lỗi nguy hiểm nhất: TRẢ LỜI SAI MÀ
 * VẪN TỰ TIN (hiện ra một con số / danh sách không đúng câu hỏi). Mỗi quy tắc dựa
 * trên một tín hiệu ngôn ngữ / thực thể rõ ràng, không dựa vào câu mẫu cụ thể:
 *
 *  1. Có mã đơn (ORD-..., DH-...)          → tra cứu đơn đó (trừ khi hỏi quy trình)
 *  2. Hỏi tương thích linh kiện            → tư vấn tương thích (thay vì liệt kê danh mục)
 *  3. Hỏi nên dùng nguồn bao nhiêu W       → gợi ý nguồn PSU
 *  4. Hỏi mức giảm giá / chiết khấu cho VIP → quy chế chiết khấu (không phải danh sách khách VIP)
 *  5. Câu hỏi QUY TRÌNH ("thế nào", "làm sao", "quy trình"...) → ưu tiên tài liệu SOP
 *     tương ứng thay vì kỹ năng tra dữ liệu có từ khoá trùng
 *  6. Kỳ thời gian trong câu hỏi phải khớp kỳ cố định của kỹ năng doanh thu
 *     ("doanh thu trong tháng" không được trả doanh thu cả năm) — sai kỳ thì chuyển
 *     sang kỹ năng đúng kỳ, không có kỹ năng phù hợp thì không trả lời ở tầng này.
 *
 * Quyền hạn KHÔNG được nới lỏng ở đây: kỹ năng được chọn vẫn đi qua kiểm tra
 * allowedRoles trong BaseActorTrainer.execute như mọi kỹ năng khác.
 */

const ORDER_CODE = /\b(?:ORD|DH)-[A-Z0-9][A-Z0-9-]*\b/i;
const PROCEDURAL = /(như thế nào|thế nào|làm sao|làm thế nào|quy trình|quy định|chính sách|hướng dẫn|các bước|cách (?:nào|để|làm))/i;
const COMPAT = /(tương thích|lắp (?:được|vừa|chung)|chạy (?:được|chung)|đi (?:được )?với|hợp với|có hợp|cắm (?:được|vừa)|dùng chung|ăn với|(?:lắp|gắn|cắm|chạy|dùng|xài)\s[^?]{0,40}?\s(?:được|vừa)\s*(?:không|ko|chứ|hả|hông)\b)/i;
// Lưu ý: \b của JavaScript chỉ hiểu chữ ASCII — không có "ranh giới từ" trước các
// chữ có dấu như "đ", nên dùng \s thay cho \b trước từ tiếng Việt.
const HARDWARE = /(cpu|chip|intel|amd|ryzen|core i\d|i[3579][\s-]?\d{4,5}|\d{4,5}[kf]{0,2}\b|main|mainboard|bo mạch|ram|ddr\d|vga|card|rtx|gtx|rx\s?\d{4}|nguồn|psu|ssd|tản)/i;
const PSU_TOPIC = /(nguồn|psu|công suất|\bwatt\b|\d+\s*w\b)/i;
const SIZING = /(bao nhiêu|mấy|cần|nên|xài|dùng|đủ)/i;
const DISCOUNT = /(giảm giá|giảm tối đa|được giảm|chiết khấu|ưu đãi|discount)/i;
const VIP_OR_B2B = /(vip|b2b|khách doanh nghiệp|khách sỉ)/i;
const PAYMENT_WORDS = /(thanh toán|trả tiền|đã trả|chuyển khoản|tiền mặt)/i;

// Họ kỹ năng doanh thu có kỳ cố định
const REVENUE_BY_PERIOD = { DAY: 'TODAY_REVENUE', YESTERDAY: 'YESTERDAY_REVENUE', MONTH: 'MONTHLY_REVENUE', YEAR: 'ANNUAL_REVENUE' };
const REVENUE_SKILLS = new Set(Object.values(REVENUE_BY_PERIOD));

// Bỏ dấu tiếng Việt để nhận cả kiểu gõ không dấu ("doanh thu thang nay")
const stripVi = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

// Thiếu hoặc thừa ĐÚNG 1 ký tự ("thag" ~ "thang"). Không chấp nhận THAY 1 ký tự:
// "thanh" (thanh toán) chỉ khác "thang" đúng 1 ký tự thay thế — sẽ nhận nhầm kỳ.
const oneInsertOrDelete = (a, b) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  for (let i = 0; i < long.length; i++) {
    if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  }
  return false;
};

// Biến thể gõ nhầm phổ biến được liệt kê tường minh (thay ký tự thì không suy ra tự động)
const WORD_VARIANTS = { doanh: ['doanh', 'doang', 'doan'] };

// Từ dài (>= 4 ký tự) cho phép thiếu/thừa 1 ký tự; từ ngắn phải khớp đúng (tránh nhầm)
const tokensOf = (s) => stripVi(s).split(/[^a-z0-9]+/).filter(Boolean);
const tokenIs = (t, word) => (WORD_VARIANTS[word] ? WORD_VARIANTS[word].includes(t) : word.length >= 4 ? oneInsertOrDelete(t, word) : t === word);
const hasWord = (tokens, word) => tokens.some(t => tokenIs(t, word));
const hasPhrase = (tokens, a, b) => tokens.some((t, i) => tokenIs(t, a) && tokens[i + 1] !== undefined && tokenIs(tokens[i + 1], b));

/** Kỳ thời gian người dùng nói tới (null nếu không nói rõ). Nhận cả không dấu / gõ sai 1 ký tự. */
const detectPeriod = (text) => {
  const tk = tokensOf(text);
  if (hasPhrase(tk, 'hom', 'qua')) return 'YESTERDAY';
  if (hasPhrase(tk, 'thang', 'truoc') || hasPhrase(tk, 'nam', 'ngoai') || hasPhrase(tk, 'nam', 'truoc') ||
      hasPhrase(tk, 'quy', 'truoc') || hasPhrase(tk, 'tuan', 'truoc') || hasPhrase(tk, 'ky', 'truoc')) return 'PREVIOUS';
  // "quý" chỉ tính khi có từ chỉ kỳ đi kèm — bản không dấu "quy" trùng với "quy trình"
  if (/quý/i.test(text) || hasPhrase(tk, 'quy', 'nay') || tk.some((t, i) => t === 'quy' && /^\d$/.test(tk[i + 1] || ''))) return 'QUARTER';
  if (hasWord(tk, 'tuan')) return 'WEEK';
  if (hasPhrase(tk, 'hom', 'nay') || hasPhrase(tk, 'trong', 'ngay') || tk.includes('today')) return 'DAY';
  if (hasWord(tk, 'thang')) return 'MONTH';
  if (tk.includes('nam')) return 'YEAR';
  return null;
};

/** Câu hỏi nói về doanh thu / tiền bán được (nhận cả không dấu / gõ sai 1 ký tự). */
const mentionsRevenue = (text) => {
  const tk = tokensOf(text);
  return hasPhrase(tk, 'doanh', 'thu') || hasPhrase(tk, 'doanh', 'so') || hasPhrase(tk, 'thu', 've') ||
    hasPhrase(tk, 'ban', 'duoc') || hasPhrase(tk, 'tien', 'thu');
};

/**
 * Định tuyến TRƯỚC tầng regex/vector theo tín hiệu mạnh.
 * @returns {string|null} skillId
 */
const preRoute = (prompt, role) => {
  const isProcedural = PROCEDURAL.test(prompt);

  if (ORDER_CODE.test(prompt) && !isProcedural) {
    if (String(role).toUpperCase() === 'ACCOUNTANT' && PAYMENT_WORDS.test(prompt)) return 'ORDER_PAYMENT_HISTORY';
    return 'DELIVERY_TRACK_ORDER';
  }
  if (PSU_TOPIC.test(prompt) && SIZING.test(prompt) && HARDWARE.test(prompt.replace(PSU_TOPIC, ''))) {
    return 'PSU_RECOMMENDATION';
  }
  if (COMPAT.test(prompt) && HARDWARE.test(prompt)) {
    return 'CHECK_CPU_MOTHERBOARD_COMPATIBILITY';
  }
  if (DISCOUNT.test(prompt) && VIP_OR_B2B.test(prompt)) {
    return 'SOP_VIP_DISCOUNT_POLICY';
  }
  return null;
};

/**
 * Hiệu chỉnh SAU khi đã chọn kỹ năng.
 * @param {string} prompt
 * @param {Object} skill - kỹ năng đã chọn
 * @param {Function} searchSop - (prompt) => { skillId, score } | null : tìm SOP gần nhất
 * @returns {{ skillId: string, reason: string } | { abstain: true, reason: string } | null}
 */
const postAdjust = (prompt, skill, searchSop) => {
  if (!skill) return null;

  // Câu hỏi quy trình nhưng lại khớp kỹ năng tra dữ liệu → ưu tiên SOP gần nhất
  if (PROCEDURAL.test(prompt) && skill.type !== 'KNOWLEDGE_SOP') {
    const sop = searchSop(prompt);
    if (sop && sop.score >= 0.35) return { skillId: sop.skillId, reason: 'PROCEDURAL_SOP' };
  }

  // Kỳ thời gian không khớp kỹ năng doanh thu
  if (REVENUE_SKILLS.has(skill.id)) {
    const period = detectPeriod(prompt);
    if (period) {
      const target = REVENUE_BY_PERIOD[period];
      if (!target) return { abstain: true, reason: `PERIOD_${period}_UNSUPPORTED` };
      if (target !== skill.id) return { skillId: target, reason: `PERIOD_${period}` };
    }
  }
  return null;
};

/**
 * Khi tầng vector chưa chắc chắn và các ứng viên là những kỹ năng doanh thu khác
 * kỳ (ngày / tháng / năm — câu mẫu rất giống nhau nên khoảng cách điểm nhỏ), kỳ
 * thời gian người dùng nói rõ chính là thông tin phân định.
 * @param {string} prompt
 * @param {string[]} candidateIds - id các ứng viên (top gợi ý)
 * @returns {string|null} skillId
 */
const resolveAmbiguousRevenue = (prompt, candidateIds = []) => {
  if (!candidateIds.some(id => REVENUE_SKILLS.has(id))) return null;
  if (!mentionsRevenue(prompt)) return null;
  const period = detectPeriod(prompt);
  return (period && REVENUE_BY_PERIOD[period]) || null;
};

module.exports = { preRoute, postAdjust, detectPeriod, resolveAmbiguousRevenue };
