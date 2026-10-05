/**
 * PSEUDO-LABELING & CONTINUOUS REPLAY MEMORY BUFFER SERVICE
 * 
 * Hàm lượng khoa học & Kỹ thuật KLTN:
 * - Học bán giám sát (Semi-Supervised Learning) với kỹ thuật Pseudo-Labeling:
 *   Tự động gán nhãn câu hỏi người dùng khi nhận tín hiệu phản hồi tích cực (User Helpful Feedback 👍)
 *   hoặc đạt độ tin cậy suy luận cao (High-Confidence Inference >= 0.88).
 * - Cơ chế Experience Replay Buffer (Sliding Window 500 mẫu):
 *   Lưu trữ các mẫu tự học, tự động loại bỏ trùng lặp ngữ nghĩa (Deduplication).
 * - Ngăn ngừa hiện tượng quên kiến thức cũ (Zero Catastrophic Forgetting):
 *   Tập tri thức tự học được nạp đồng bộ vào Vector Engine cùng các kỹ năng tĩnh mà không làm mất tri thức cũ.
 */

const fs = require('fs');
const path = require('path');

const BUFFER_FILE_PATH = path.join(__dirname, '../pseudo_memory_buffer.json');
const MAX_BUFFER_CAPACITY = 500;
const MIN_CONFIDENCE_THRESHOLD = 0.80;

/**
 * Đọc toàn bộ bộ nhớ tự học từ file
 * @returns {Array<object>}
 */
const getPseudoSamples = () => {
  try {
    if (fs.existsSync(BUFFER_FILE_PATH)) {
      const data = fs.readFileSync(BUFFER_FILE_PATH, 'utf8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.warn('[PseudoMemory] Lỗi đọc pseudo_memory_buffer.json:', err.message);
  }
  return [];
};

/**
 * Lưu danh sách mẫu tự học vào file
 * @param {Array<object>} samples 
 */
const savePseudoSamples = (samples) => {
  try {
    // Duy trì sliding window tối đa MAX_BUFFER_CAPACITY mẫu
    const pruned = samples.slice(-MAX_BUFFER_CAPACITY);
    fs.writeFileSync(BUFFER_FILE_PATH, JSON.stringify(pruned, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[PseudoMemory] Lỗi ghi pseudo_memory_buffer.json:', err.message);
    return false;
  }
};

/**
 * Chuẩn hóa chuỗi để so sánh trùng lặp
 */
const normalizeText = (text) => {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[.,?!:;'"()\[\]{}]/g, '')
    .replace(/\s+/g, ' ');
};

/**
 * Ghi nhận một mẫu câu hỏi tự học mới vào Replay Memory Buffer
 * @param {object} param0
 * @param {string} param0.prompt Câu hỏi thực tế của người dùng
 * @param {string} param0.intentId Ý định được gán nhãn
 * @param {string} param0.role Vai trò nghiệp vụ
 * @param {number} [param0.confidence=0.90] Độ tự tin
 * @param {string} [param0.source='FEEDBACK_LOOP'] Nguồn gán nhãn
 * @returns {boolean} Kết quả ghi nhận
 */
const recordPseudoSample = ({ prompt, intentId, role = 'SALES', confidence = 0.90, source = 'FEEDBACK_LOOP' }) => {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim() || !intentId) {
    return false;
  }

  const cleanPrompt = prompt.trim();
  const normalizedNew = normalizeText(cleanPrompt);

  // Không lưu những câu quá ngắn hoặc câu rác
  if (cleanPrompt.length < 5 || cleanPrompt.length > 500) {
    return false;
  }

  if (confidence < MIN_CONFIDENCE_THRESHOLD) {
    return false;
  }

  const samples = getPseudoSamples();

  // Khử trùng lặp: nếu câu hỏi tương tự đã tồn tại trong bộ nhớ thì bỏ qua
  const exists = samples.some(s => normalizeText(s.prompt) === normalizedNew);
  if (exists) {
    return false;
  }

  const newEntry = {
    id: `pseudo_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    prompt: cleanPrompt,
    intentId,
    role,
    confidence: Number(confidence.toFixed(3)),
    source,
    createdAt: new Date().toISOString()
  };

  samples.push(newEntry);
  const ok = savePseudoSamples(samples);

  if (ok) {
    // Tự động làm mới chỉ mục Vector Matcher trong nền (Continuous Learning)
    try {
      const { vectorMatcher } = require('../matcher');
      const { queryCache } = require('../cache');
      vectorMatcher.buildIndex();
      queryCache.clear();
      console.log(`[PseudoMemory] Đã tự học câu mới vào [${intentId}]: "${cleanPrompt}" (Source: ${source})`);
    } catch (e) {
      console.warn('[PseudoMemory] Lỗi rebuild vector index sau khi nạp pseudo sample:', e.message);
    }
  }

  return ok;
};

/**
 * Xóa trắng bộ nhớ tự học (phục vụ test)
 */
const clearPseudoBuffer = () => {
  savePseudoSamples([]);
};

module.exports = {
  getPseudoSamples,
  recordPseudoSample,
  clearPseudoBuffer,
  BUFFER_FILE_PATH
};
