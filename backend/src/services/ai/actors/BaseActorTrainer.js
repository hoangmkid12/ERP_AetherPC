/**
 * BASE ACTOR TRAINER - LỚP CƠ SỞ CHUẨN HÓA CHO MỌI ACTOR TRONG ERP AETHERPC
 * Giúp mở rộng, thêm tình huống (train thêm) cực kỳ nhanh chóng và bài bản:
 * - Khai báo tình huống bằng danh sách câu hỏi mẫu (examples) & từ khóa (keywords)
 * - Tự động đối soát và sinh câu lệnh SQL hoặc trích xuất tri thức SOP
 * - Tự động xuất Few-Shots chuẩn cho Gemini / Mô hình AI
 * - Cho phép thêm kỹ năng mới chỉ bằng cách gọi .addSkill({ ... })
 */

class BaseActorTrainer {
  /**
   * @param {Object} options
   * @param {string} options.role - Mã vai trò: DELIVERY, WAREHOUSE, ACCOUNTANT, SALES, ADMIN_CEO
   * @param {string} options.name - Tên hiển thị tiếng Việt của vai trò
   * @param {string} options.systemPrompt - Persona và chỉ thị phong cách trả lời
   */
  constructor({ role, name, systemPrompt }) {
    this.role = role;
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.skills = []; // Danh sách toàn bộ kỹ năng đã train cho Actor
  }

  /**
   * Đăng ký thêm 1 tình huống / kỹ năng mới cho Actor
   * @param {Object} skill
   * @param {string} skill.id - Mã kỹ năng (vd: DELIVERY_ORDERS_TODAY)
   * @param {string} skill.title - Tiêu đề ngắn gọn của tình huống
   * @param {string} skill.description - Mô tả mục đích
   * @param {'LIVE_SQL' | 'KNOWLEDGE_SOP'} skill.type - Loại xử lý: Dữ liệu SQL hay Quy chế văn bản SOP
   * @param {string[]} skill.examples - Danh sách câu hỏi mẫu của người dùng (Thêm tùy ý bao nhiêu câu cũng được)
   * @param {RegExp|RegExp[]} [skill.patterns] - Biểu thức regex nhận diện nhanh
   * @param {string[]} [skill.keywords] - Mảng từ khóa cốt lõi
   * @param {string|Function} [skill.sql] - Câu lệnh SQL (hoặc hàm sinh SQL)
   * @param {string} [skill.sop] - Nội dung quy chuẩn / văn bản SOP
   * @param {Function} [skill.formatter] - Hàm format kết quả chuyên biệt cho vai trò
   */
  addSkill(skill) {
    if (!skill.id || !skill.title) {
      throw new Error(`Kỹ năng của Actor ${this.role} phải có id và title.`);
    }

    const normalizedSkill = {
      id: skill.id,
      title: skill.title,
      description: skill.description || skill.title,
      type: skill.type || 'LIVE_SQL',
      examples: Array.isArray(skill.examples) ? skill.examples : [],
      patterns: Array.isArray(skill.patterns) ? skill.patterns : (skill.patterns ? [skill.patterns] : []),
      keywords: Array.isArray(skill.keywords) ? skill.keywords : [],
      sql: skill.sql || '',
      sop: skill.sop || '',
      formatter: typeof skill.formatter === 'function' ? skill.formatter : null
    };

    this.skills.push(normalizedSkill);
    return this; // Hỗ trợ chain gọi method liên tục
  }

  /**
   * Khớp câu hỏi của người dùng với kỹ năng đã được huấn luyện bằng thuật toán tính điểm ưu tiên (Score-based Matching)
   * Đảm bảo: Khớp chính xác câu hỏi mẫu luôn thắng điểm, Regex cụ thể thắng Regex chung, Từ khóa phụ trợ hỗ trợ phân loại.
   * @param {string} userPrompt - Câu hỏi của người dùng
   * @param {number|string} [userId] - ID của người dùng (nếu có)
   * @returns {{matched: boolean, skill: Object, score: number, executableSql?: string, sopContent?: string}|null}
   */
  match(userPrompt, userId) {
    if (!userPrompt || typeof userPrompt !== 'string') return null;

    const rawLower = userPrompt.toLowerCase().trim();
    const cleanPrompt = rawLower.replace(/[?!.,;:()]/g, ' ').replace(/\s+/g, ' ').trim();

    let bestSkill = null;
    let highestScore = 0;

    for (const skill of this.skills) {
      let score = 0;

      // 1. So khớp câu hỏi mẫu (examples)
      for (const ex of skill.examples) {
        const rawEx = ex.toLowerCase().trim();
        const cleanEx = rawEx.replace(/[?!.,;:()]/g, ' ').replace(/\s+/g, ' ').trim();

        if (cleanPrompt === cleanEx || rawLower === rawEx) {
          score += 1000; // Khớp chính xác hoàn toàn câu hỏi đã được train
          break;
        } else if (cleanPrompt.includes(cleanEx) && cleanEx.length >= 8) {
          score = Math.max(score, 500 + cleanEx.length);
        } else if (cleanEx.includes(cleanPrompt) && cleanPrompt.length >= 12) {
          score = Math.max(score, 350 + cleanPrompt.length);
        }
      }

      // 2. So khớp biểu thức chính quy (patterns)
      if (skill.patterns && skill.patterns.length > 0) {
        for (const pattern of skill.patterns) {
          if (pattern.test(rawLower) || pattern.test(cleanPrompt)) {
            score += 180;
          }
        }
      }

      // 3. So khớp bộ từ khóa (keywords)
      if (skill.keywords && skill.keywords.length > 0) {
        const allKeywordsPresent = skill.keywords.every(kw => 
          cleanPrompt.includes(kw.toLowerCase()) || rawLower.includes(kw.toLowerCase())
        );
        if (allKeywordsPresent) {
          score += 120 * skill.keywords.length;
        }
      }

      if (score > highestScore && score >= 120) {
        highestScore = score;
        bestSkill = skill;
      }
    }

    if (!bestSkill) return null;

    let executableSql = '';
    if (bestSkill.type === 'LIVE_SQL') {
      if (typeof bestSkill.sql === 'function') {
        executableSql = bestSkill.sql(userId, rawLower);
      } else if (typeof bestSkill.sql === 'string') {
        executableSql = bestSkill.sql.replace(/:userId/g, (userId || 0).toString());
      }
    }

    return {
      matched: true,
      skill: bestSkill,
      score: highestScore,
      executableSql,
      sopContent: bestSkill.sop || ''
    };
  }

  /**
   * Xuất danh sách Few-Shots SQL mẫu cho mô hình Gemini / LLM Prompt
   */
  getFewShots() {
    return this.skills
      .filter(s => s.type === 'LIVE_SQL' && s.sql)
      .map(s => {
        const sampleQuestion = s.examples[0] || s.title;
        const rawSql = typeof s.sql === 'function' ? s.sql(':userId', sampleQuestion) : s.sql;
        return {
          question: sampleQuestion,
          sql: rawSql,
          description: s.description
        };
      });
  }

  /**
   * Xuất danh sách các văn bản tri thức SOP của Actor
   */
  getKnowledgeSOP() {
    const sops = {};
    this.skills
      .filter(s => s.type === 'KNOWLEDGE_SOP' && s.sop)
      .forEach(s => {
        sops[s.id] = {
          title: s.title,
          content: s.sop
        };
      });
    return sops;
  }

  /**
   * Xuất dữ liệu huấn luyện tương thích cho mô hình NLP cục bộ (dataset_intent.json)
   */
  exportNlpDataset() {
    const dataset = [];
    this.skills.forEach(s => {
      s.examples.forEach(text => {
        dataset.push({
          text,
          intent: `${this.role}_${s.id}`,
          role: this.role
        });
      });
    });
    return dataset;
  }
}

module.exports = BaseActorTrainer;
