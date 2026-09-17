const fs = require('fs');
const path = require('path');

// Kho tri thức FAQ tự xây (không gọi LLM ngoài nào) — mỗi mục có sẵn 1 danh
// sách từ khóa/cụm từ đặc trưng. Khi NLP.js không phân loại được ý định nào
// đủ tin cậy (câu hỏi mới lạ, không nằm trong training_data.json), tra cứu
// kho này bằng cách chấm điểm số từ khóa khớp trực tiếp trong câu hỏi — cụm
// từ càng dài/đặc trưng thì trọng số càng cao. Đây là lớp "trả lời linh hoạt"
// thay thế cho việc phải liệt kê if/else vô hạn theo từng câu hỏi cụ thể.
let kbCache = null;

const loadKnowledgeBase = () => {
  if (kbCache) return kbCache;
  try {
    const kbPath = path.join(__dirname, '../config/knowledge_base.json');
    const data = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    kbCache = data.entries || [];
  } catch (err) {
    console.error('[Chatbot] Failed to load knowledge_base.json:', err);
    kbCache = [];
  }
  return kbCache;
};

const scoreEntry = (cleanText, entry) => {
  let score = 0;
  for (const kw of entry.keywords) {
    const kwLower = kw.toLowerCase();
    if (cleanText.includes(kwLower)) {
      // Cụm nhiều từ khớp chính xác đáng tin hơn 1 từ đơn lẻ dễ trùng ngẫu nhiên.
      score += kwLower.split(/\s+/).length;
    }
  }
  return score;
};

/**
 * Tìm mục FAQ khớp nhất với câu hỏi của khách — trả về null nếu không mục
 * nào đạt ngưỡng tin cậy tối thiểu (tránh trả lời bừa 1 câu không liên quan).
 * @param {string} message - câu hỏi gốc của khách (chưa lowercase)
 * @param {number} threshold - điểm tối thiểu để chấp nhận 1 kết quả khớp
 * @returns {{id: string, answer: string, score: number}|null}
 */
const findBestKnowledgeMatch = (message, threshold = 2) => {
  const cleanText = String(message || '').toLowerCase();
  const entries = loadKnowledgeBase();

  let best = null;
  let bestScore = 0;
  for (const entry of entries) {
    const score = scoreEntry(cleanText, entry);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore >= threshold ? { ...best, score: bestScore } : null;
};

module.exports = { findBestKnowledgeMatch, loadKnowledgeBase };
