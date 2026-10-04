/**
 * HYBRID SEMANTIC MATCHER - GIAI ĐOẠN 3: BỘ SO KHỚP Ý ĐỊNH LAI GHÉP
 * Kết hợp 3 tầng đánh giá:
 * 1. Rule & Regex Patterns (Tầng 1 - Nhanh, chuẩn xác 100% nếu khớp từ khóa)
 * 2. Vector Subword Cosine Similarity (Tầng 2 - Kháng lỗi chính tả, nhận diện ngữ nghĩa sâu)
 * 3. Local Neural NLP Manager (Tầng 3 - Mô hình phân loại nơ-ron cục bộ)
 */

const { vectorMatcher } = require('./vectorMatcher');
const { classifyIntentLocal } = require('../localNlp.service');

const matchHybridIntent = async (query, role = null, trainer = null) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return null;
  }

  // TẦNG 1: Regex Pattern Match từ Trainer nếu được truyền vào
  if (trainer) {
    const patternMatch = trainer.match(query);
    if (patternMatch && patternMatch.score >= 0.8) {
      return {
        source: 'PATTERN_RULE',
        intent: patternMatch.skill.id,
        role: trainer.role,
        score: patternMatch.score,
        skill: patternMatch.skill,
        status: 'MATCHED'
      };
    }
  }

  // TẦNG 2: Vector Subword Cosine Similarity (Trọng số 0.6)
  const vectorRes = vectorMatcher.match(query, role);

  // TẦNG 3: Phân loại bằng Local Neural NLP (Trọng số 0.4)
  let nlpRes = null;
  try {
    nlpRes = await classifyIntentLocal(query);
  } catch {
    // Bỏ qua nếu NLP chưa sẵn sàng
  }

  // Nếu cả 2 mô hình đều có kết quả và đồng thuận về Intent
  if (vectorRes && nlpRes && vectorRes.intent === nlpRes.intent) {
    const combinedScore = Number(((vectorRes.score * 0.6) + (nlpRes.confidence * 0.4)).toFixed(4));
    return {
      source: 'HYBRID_ENSEMBLE',
      intent: vectorRes.intent,
      role: vectorRes.role,
      score: combinedScore,
      skill: vectorRes.skill,
      status: combinedScore >= 0.20 ? 'MATCHED' : 'UNCERTAIN',
      suggestions: vectorRes.suggestions || []
    };
  }

  // Nếu Vector Matcher có kết quả vượt ngưỡng tin cậy
  if (vectorRes && vectorRes.status === 'MATCHED') {
    return {
      source: 'VECTOR_COSINE',
      intent: vectorRes.intent,
      role: vectorRes.role,
      score: vectorRes.score,
      skill: vectorRes.skill,
      status: 'MATCHED',
      matchedSample: vectorRes.matchedSample
    };
  }

  // Nếu điểm ở mức nghi vấn (UNCERTAIN)
  if (vectorRes && vectorRes.status === 'UNCERTAIN') {
    return {
      source: 'VECTOR_COSINE_UNCERTAIN',
      intent: vectorRes.intent,
      role: vectorRes.role,
      score: vectorRes.score,
      skill: vectorRes.skill,
      status: 'UNCERTAIN',
      suggestions: vectorRes.suggestions || [],
      message: vectorRes.message
    };
  }

  return null;
};

module.exports = {
  matchHybridIntent
};
