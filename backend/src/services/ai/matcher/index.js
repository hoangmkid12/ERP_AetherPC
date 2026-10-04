/**
 * GIAI ĐOẠN 3: BỘ SO KHỚP Ý ĐỊNH BẰNG VECTOR EMBEDDING & COSINE SIMILARITY
 */

const VectorEngine = require('./vectorEngine');
const { VectorMatcher, vectorMatcher } = require('./vectorMatcher');
const { matchHybridIntent } = require('./hybridMatcher');

module.exports = {
  VectorEngine,
  VectorMatcher,
  vectorMatcher,
  matchHybridIntent
};
