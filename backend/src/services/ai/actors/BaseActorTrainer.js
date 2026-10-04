/**
 * BASE ACTOR TRAINER - LỚP CƠ SỞ CHUẨN HÓA CHO MỌI ACTOR TRONG ERP AETHERPC
 * Thiết kế theo kiến trúc: Intent Catalog + Parameterized Prisma Handlers (Giai đoạn 1)
 *
 * 1. Khai báo danh mục ý định (Intent Catalog) gồm mã, câu hỏi mẫu, tham số bắt buộc.
 * 2. Gắn kết trực tiếp hàm truy vấn an toàn bằng Prisma ORM (Type-Safe Handlers).
 * 3. Điền kết quả vào mẫu trả lời (Template Formatter) hoặc trả về khối dữ liệu cấu trúc.
 * 4. Kiểm soát phân quyền người dùng (RBAC) trước khi thực thi hàm.
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
    this.skills = []; // Danh sách toàn bộ kỹ năng / ý định đã train cho Actor
  }

  /**
   * Đăng ký thêm 1 tình huống / kỹ năng mới cho Actor
   * @param {Object} skill
   * @param {string} skill.id - Mã định danh ý định (vd: ASSIGNED_ORDERS_TODAY)
   * @param {string} skill.title - Tiêu đề ngắn gọn của tình huống
   * @param {string} skill.description - Mô tả mục đích
   * @param {'PRISMA_QUERY' | 'LIVE_SQL' | 'KNOWLEDGE_SOP'} [skill.type='PRISMA_QUERY'] - Loại xử lý
   * @param {string[]} skill.examples - Danh sách câu hỏi mẫu của người dùng
   * @param {RegExp|RegExp[]} [skill.patterns] - Biểu thức regex nhận diện nhanh
   * @param {string[]} [skill.keywords] - Mảng từ khóa cốt lõi
   * @param {string[]} [skill.requiredParams] - Danh sách tham số bắt buộc (vd: ['productName'])
   * @param {string[]} [skill.allowedRoles] - Danh sách vai trò được phép thực thi
   * @param {Function} [skill.handler] - Hàm truy vấn Prisma: async (prisma, params, user) => data
   * @param {string|Function} [skill.template] - Mẫu định dạng câu trả lời (Template Formatter)
   * @param {string|Function} [skill.sql] - Câu lệnh SQL dự phòng (nếu cần đối soát)
   * @param {string} [skill.sop] - Nội dung quy chuẩn / văn bản SOP
   */
  addSkill(skill) {
    if (!skill.id || !skill.title) {
      throw new Error(`Kỹ năng của Actor ${this.role} phải có id và title.`);
    }

    const normalizedSkill = {
      id: skill.id,
      title: skill.title,
      description: skill.description || skill.title,
      type: skill.type || (skill.sop ? 'KNOWLEDGE_SOP' : 'PRISMA_QUERY'),
      examples: Array.isArray(skill.examples) ? skill.examples : [],
      patterns: Array.isArray(skill.patterns) ? skill.patterns : (skill.patterns ? [skill.patterns] : []),
      keywords: Array.isArray(skill.keywords) ? skill.keywords : [],
      requiredParams: Array.isArray(skill.requiredParams) ? skill.requiredParams : [],
      allowedRoles: Array.isArray(skill.allowedRoles) ? skill.allowedRoles : [this.role, 'ADMIN_CEO', 'ADMIN'],
      handler: typeof skill.handler === 'function' ? skill.handler : null,
      template: skill.template || null,
      sql: skill.sql || '',
      sop: skill.sop || '',
      formatter: typeof skill.formatter === 'function' ? skill.formatter : null
    };

    this.skills.push(normalizedSkill);
    return this;
  }

  /**
   * So khớp câu hỏi của người dùng với danh mục ý định
   * @param {string} userPrompt - Câu hỏi của người dùng
   * @param {number|string} [userId] - ID của người dùng
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
          score += 1000;
          break;
        } else if (cleanPrompt.includes(cleanEx) && cleanEx.length >= 8) {
          score = Math.max(score, 500 + cleanEx.length);
        } else if (cleanEx.includes(cleanPrompt) && cleanPrompt.length >= 12) {
          score = Math.max(score, 350 + cleanPrompt.length);
        }
      }

      // 2. So khớp biểu thức regex (patterns)
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
    if (bestSkill.sql) {
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
   * Thực thi trực tiếp ý định thông qua Prisma Client an toàn (Type-safe Handler Execution)
   * @param {Object} skill - Kỹ năng / ý định đã khớp
   * @param {Object} prisma - Prisma Client instance
   * @param {Object} params - Các tham số đã trích xuất (tên sản phẩm, thời gian, số lượng...)
   * @param {Object} user - Người dùng đang đăng nhập ({ id, role, fullName })
   */
  async execute(skill, prisma, params = {}, user = {}) {
    if (!skill) {
      return { status: 'ERROR', message: 'Không tìm thấy ý định xử lý' };
    }

    // 1. Kiểm tra quyền hạn (RBAC)
    const userRole = (user.role || '').toUpperCase();
    const isAllowed = skill.allowedRoles.some(r => r.toUpperCase() === userRole || userRole === 'ADMIN' || userRole === 'CEO');
    if (!isAllowed) {
      return {
        status: 'FORBIDDEN',
        message: `Bạn với vai trò [${user.role || 'GUEST'}] không có quyền thực hiện thao tác: ${skill.title}`
      };
    }

    // 2. Kiểm tra tham số bắt buộc (Missing required parameters)
    const missingParams = skill.requiredParams.filter(p => !params[p] && params[p] !== 0);
    if (missingParams.length > 0) {
      return {
        status: 'MISSING_PARAMS',
        intent: skill.id,
        missing: missingParams,
        message: `Vui lòng cung cấp thêm thông tin: ${missingParams.join(', ')}`
      };
    }

    // 3. Nếu là tài liệu quy chuẩn SOP
    if (skill.type === 'KNOWLEDGE_SOP' && skill.sop) {
      return {
        status: 'SUCCESS',
        intent: skill.id,
        type: 'KNOWLEDGE_SOP',
        title: skill.title,
        text: skill.sop,
        data: null
      };
    }

    // 4. Nếu là hàm xử lý dữ liệu Prisma
    if (typeof skill.handler === 'function') {
      try {
        const rawResult = await skill.handler(prisma, params, user);
        let formattedText = '';

        if (typeof skill.template === 'function') {
          formattedText = skill.template(rawResult, params, user);
        } else if (typeof skill.template === 'string') {
          formattedText = this.fillStringTemplate(skill.template, rawResult);
        } else if (typeof skill.formatter === 'function') {
          formattedText = skill.formatter(rawResult);
        } else {
          formattedText = JSON.stringify(rawResult, null, 2);
        }

        return {
          status: 'SUCCESS',
          intent: skill.id,
          type: 'PRISMA_QUERY',
          title: skill.title,
          data: rawResult,
          text: formattedText
        };
      } catch (err) {
        console.error(`[BaseActorTrainer] Lỗi khi chạy Prisma Handler cho intent [${skill.id}]:`, err);
        return {
          status: 'ERROR',
          intent: skill.id,
          message: `Lỗi truy vấn dữ liệu: ${err.message}`
        };
      }
    }

    return {
      status: 'NOT_IMPLEMENTED',
      intent: skill.id,
      message: `Ý định ${skill.title} chưa được cấu hình hàm xử lý Prisma.`
    };
  }

  /**
   * Tiện ích điền giá trị vào chuỗi template mẫu {key}
   */
  fillStringTemplate(template, data) {
    if (!template || typeof template !== 'string') return '';
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data && data[key] !== undefined ? data[key] : match;
    });
  }

  /**
   * Lấy danh sách toàn bộ kỹ năng của Actor
   */
  getSkills() {
    return this.skills;
  }

  /**
   * Xuất danh sách Few-Shots mẫu
   */
  getFewShots() {
    return this.skills
      .filter(s => s.sql)
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
   * Xuất danh sách các văn bản tri thức SOP
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
   * Xuất dữ liệu huấn luyện NLP
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
