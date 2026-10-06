/**
 * VECTOR MATCHER - GIAI ĐOẠN 3: SO KHỚP Ý ĐỊNH BẰNG VECTOR & COSINE SIMILARITY
 * - Lập chỉ mục Vector Embedding toàn bộ 79+ kỹ năng và 401+ câu hỏi mẫu
 * - Tìm kiếm ý định có độ tương đồng Cosine cao nhất
 * - Hỗ trợ Ngưỡng tin cậy (Confidence Threshold = 0.65):
 *   + Nếu score >= 0.65: Khớp ý định thành công
 *   + Nếu score < 0.65: Báo 'UNCERTAIN' kèm Top 3 gợi ý gần nhất
 */

const VectorEngine = require('./vectorEngine');
const accountantTrainer = require('../actors/accountant.trainer');
const salesTrainer = require('../actors/sales.trainer');
const adminCeoTrainer = require('../actors/admin_ceo.trainer');
const warehouseTrainer = require('../actors/warehouse.trainer');
const deliveryTrainer = require('../actors/delivery.trainer');
const qcTrainer = require('../actors/qc.trainer');

const TRAINERS = {
  ACCOUNTANT: accountantTrainer,
  SALES: salesTrainer,
  ADMIN_CEO: adminCeoTrainer,
  WAREHOUSE: warehouseTrainer,
  DELIVERY: deliveryTrainer
};

class VectorMatcher {
  constructor(options = {}) {
    this.engine = new VectorEngine();
    this.confidenceThreshold = options.confidenceThreshold || 0.38;
    this.isIndexed = false;
    this.skillLookup = new Map(); // key: `${role}_${intentId}` -> skill object
  }

  /**
   * Lập chỉ mục Vector từ toàn bộ các Actor Trainers
   */
  buildIndex() {
    const docs = [];
    this.skillLookup.clear();

    let docIdCounter = 1;
    for (const [role, trainer] of Object.entries(TRAINERS)) {
      const skills = trainer.getSkills ? trainer.getSkills() : (trainer.skills || []);

      for (const skill of skills) {
        const lookupKey = `${role}_${skill.id}`;
        this.skillLookup.set(lookupKey, { role, skill });

        // Nạp từng câu ví dụ của kỹ năng vào tập huấn luyện Vector
        const examples = skill.examples || [];
        for (const ex of examples) {
          docs.push({
            id: `doc_${docIdCounter++}`,
            text: ex,
            metadata: {
              role,
              intentId: skill.id,
              title: skill.title,
              type: skill.type
            }
          });
        }

        // Nạp thêm tiêu đề và mô tả của kỹ năng để tăng cường ngữ nghĩa
        if (skill.title) {
          docs.push({
            id: `doc_${docIdCounter++}`,
            text: skill.title,
            metadata: {
              role,
              intentId: skill.id,
              title: skill.title,
              type: skill.type
            }
          });
        }
      }
    }

    // Nạp các kịch bản SQL do Quản trị viên huấn luyện trực tiếp (Active Learning & User Feedback Loop)
    const fs = require('fs');
    const path = require('path');
    const dynamicSkillsPath = path.join(__dirname, '../dynamic_few_shots.json');
    if (fs.existsSync(dynamicSkillsPath)) {
      try {
        const dynamicSkills = JSON.parse(fs.readFileSync(dynamicSkillsPath, 'utf8'));
        if (Array.isArray(dynamicSkills)) {
          for (const dSkill of dynamicSkills) {
            if (!dSkill.question || !dSkill.sql) continue;
            const allowedRoles = dSkill.targetRole && dSkill.targetRole !== 'ALL'
              ? [dSkill.targetRole, 'ADMIN', 'CEO', 'ADMIN_CEO', 'ALL']
              : ['ADMIN', 'CEO', 'ADMIN_CEO', 'SALES', 'WAREHOUSE', 'ACCOUNTANT', 'DELIVERY', 'ALL'];

            const dynamicSkillObj = {
              id: skillId,
              title: dSkill.description || dSkill.question,
              description: dSkill.description || 'Kỹ năng do Admin phê duyệt qua Active Learning',
              type: 'DYNAMIC_SQL',
              sql: dSkill.sql,
              examples: [dSkill.question],
              responseTemplate: dSkill.responseTemplate || null,
              targetRole: dSkill.targetRole || 'ALL',
              followUps: Array.isArray(dSkill.followUps) ? dSkill.followUps : [],
              allowedRoles,
              isDynamic: true
            };

            // Lưu vào lookup với các role để có thể truy vấn mọi nơi
            this.skillLookup.set(`ADMIN_CEO_${skillId}`, { role: 'ADMIN_CEO', skill: dynamicSkillObj });
            this.skillLookup.set(`ALL_${skillId}`, { role: 'ALL', skill: dynamicSkillObj });
            if (dSkill.targetRole && dSkill.targetRole !== 'ALL') {
              this.skillLookup.set(`${dSkill.targetRole}_${skillId}`, { role: dSkill.targetRole, skill: dynamicSkillObj });
            }

            docs.push({
              id: `doc_${docIdCounter++}`,
              text: dSkill.question,
              metadata: {
                role: 'ALL',
                intentId: skillId,
                title: dynamicSkillObj.title,
                type: 'DYNAMIC_SQL',
                isDynamic: true
              }
            });
          }
        }
      } catch (err) {
        console.warn('[VectorMatcher] Không thể nạp dynamic_few_shots.json:', err.message);
      }
    }

    // Nạp dữ liệu huấn luyện mở rộng tự động (Synthetic Data Augmentation cho 13 danh mục & thương hiệu)
    try {
      const { generateSyntheticDataset } = require('./syntheticDataGenerator');
      const syntheticDocs = generateSyntheticDataset();
      for (const sDoc of syntheticDocs) {
        docs.push(sDoc);
      }
    } catch (synthErr) {
      console.warn('[VectorMatcher] Không thể nạp dữ liệu Synthetic:', synthErr.message);
    }

    // Nạp các mẫu tri thức tự học (Pseudo-Labeling & Continuous Replay Memory Buffer)
    try {
      const { getPseudoSamples } = require('../memory/pseudoMemoryBuffer.service');
      const pseudoSamples = getPseudoSamples();
      for (const p of pseudoSamples) {
        // Đảm bảo kỹ năng tự học luôn liên kết với handler nghiệp vụ trong skillLookup
        let skillRef = null;
        for (const [k, v] of this.skillLookup.entries()) {
          if (k.endsWith(`_${p.intentId}`) || k === p.intentId) {
            skillRef = v;
            break;
          }
        }
        if (skillRef) {
          this.skillLookup.set(`${p.role}_${p.intentId}`, skillRef);
        }

        docs.push({
          id: p.id || `pseudo_${docIdCounter++}`,
          text: p.prompt,
          metadata: {
            role: skillRef ? skillRef.role : p.role,
            intentId: p.intentId,
            title: `Tri thức tự học [${p.intentId}]`,
            isPseudo: true,
            confidence: p.confidence
          }
        });
      }
    } catch (pseudoErr) {
      console.warn('[VectorMatcher] Không thể nạp Pseudo Memory:', pseudoErr.message);
    }

    // Huấn luyện mô hình Vector Hybrid (BM25 + Cosine + Levenshtein)
    this.engine.fit(docs);
    this.isIndexed = true;
    return docs.length;
  }

  /**
   * So khớp câu hỏi với các ý định trong hệ thống bằng Cosine Similarity
   * @param {string} query Câu hỏi của người dùng
   * @param {string} [filterRole] Vai trò chỉ định (nếu có, ví dụ 'SALES' hoặc null để tìm toàn bộ)
   * @returns {object} Kết quả phân loại ý định
   */
  match(query, filterRole = null) {
    if (!this.isIndexed) {
      this.buildIndex();
    }

    if (!query || typeof query !== 'string' || !query.trim()) {
      return { status: 'NO_QUERY', score: 0 };
    }

    // Lọc theo vai trò nếu được chỉ định
    // ĐẶC BIỆT: ADMIN và CEO là vai trò quản trị tối cao, có quyền tra cứu toàn bộ kỹ năng ERP (Sales, Kho, Kế toán, Delivery)
    // Các kỹ năng động có role 'ALL' được truy cập bởi mọi vai trò
    const isAdminCeo = filterRole === 'ADMIN_CEO' || filterRole === 'ADMIN' || filterRole === 'CEO';
    const filterFn = (filterRole && filterRole !== 'ALL' && !isAdminCeo)
      ? (doc) => doc.metadata.role === filterRole || doc.metadata.role === 'ALL'
      : null;

    // Tìm kiếm top 10 câu mẫu tương đồng nhất
    const searchResults = this.engine.search(query, 10, filterFn);

    if (searchResults.length === 0) {
      return {
        status: 'NO_MATCH',
        score: 0,
        query,
        suggestions: []
      };
    }

    // Gom nhóm điểm theo từng Intent (lấy điểm cao nhất của từng Intent)
    const intentScores = new Map();
    for (const res of searchResults) {
      const key = `${res.metadata.role}_${res.metadata.intentId}`;
      if (!intentScores.has(key) || res.score > intentScores.get(key).score) {
        intentScores.set(key, {
          role: res.metadata.role,
          intentId: res.metadata.intentId,
          title: res.metadata.title,
          type: res.metadata.type,
          matchedSample: res.text,
          score: res.score
        });
      }
    }

    // Sắp xếp các Intent theo điểm giảm dần
    const sortedIntents = Array.from(intentScores.values()).sort((a, b) => b.score - a.score);
    const bestIntent = sortedIntents[0];

    // Lấy thông tin chi tiết kỹ năng từ lookup
    const lookupKey = `${bestIntent.role}_${bestIntent.intentId}`;
    let skillInfo = this.skillLookup.get(lookupKey) || this.skillLookup.get(`ALL_${bestIntent.intentId}`) || this.skillLookup.get(`ADMIN_CEO_${bestIntent.intentId}`);
    
    // Nếu lookup theo vai trò không thấy (ví dụ câu tự học do Admin hỏi nhưng thuộc Sales): quét tìm skill theo intentId
    if (!skillInfo) {
      for (const [key, val] of this.skillLookup.entries()) {
        if (key.endsWith(`_${bestIntent.intentId}`) || key === bestIntent.intentId) {
          skillInfo = val;
          if (val && val.role) {
            bestIntent.role = val.role;
          }
          break;
        }
      }
    }

    // Kiểm tra với ngưỡng tin cậy
    const isConfident = bestIntent.score >= this.confidenceThreshold;

    if (isConfident) {
      return {
        status: 'MATCHED',
        intent: bestIntent.intentId,
        role: bestIntent.role,
        score: bestIntent.score,
        skill: skillInfo ? skillInfo.skill : null,
        matchedSample: bestIntent.matchedSample,
        confidenceThreshold: this.confidenceThreshold
      };
    }

    // Nếu điểm thấp hơn ngưỡng: Trả về trạng thái UNCERTAIN kèm Top 3 gợi ý
    const suggestions = sortedIntents.slice(0, 3).map(i => ({
      intent: i.intentId,
      role: i.role,
      title: i.title,
      score: i.score
    }));

    return {
      status: 'UNCERTAIN',
      intent: bestIntent.intentId,
      role: bestIntent.role,
      score: bestIntent.score,
      skill: skillInfo ? skillInfo.skill : null,
      suggestions,
      message: 'Tôi chưa hoàn toàn chắc chắn về ý định của bạn. Bạn có thể tham khảo các chủ đề gợi ý dưới đây:'
    };
  }
}

// Singleton instance
const vectorMatcher = new VectorMatcher();
vectorMatcher.buildIndex();

module.exports = {
  VectorMatcher,
  vectorMatcher
};
