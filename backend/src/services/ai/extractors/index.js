/**
 * GIAI ĐOẠN 2: BỘ TRÍCH XUẤT THỰC THỂ & THAM SỐ (ENTITY & PARAMETER EXTRACTORS)
 * Xuất khẩu toàn bộ các hàm phân giải thời gian, bóc tách mã, và chuẩn hóa thực thể
 */

const { resolveDate, getWeekRange, getMonthRange, getQuarterRange } = require('./dateResolver');
const { extractCodes, parseVietnameseMoney } = require('./codeExtractor');
const { resolveEntities, calculateTrigramSimilarity, HARDWARE_ALIASES, KNOWN_BRANDS } = require('./entityResolver');
const { extractParameters } = require('./parameterExtractor');

module.exports = {
  // Master entry
  extractParameters,

  // Sub-modules
  resolveDate,
  getWeekRange,
  getMonthRange,
  getQuarterRange,

  extractCodes,
  parseVietnameseMoney,

  resolveEntities,
  calculateTrigramSimilarity,
  HARDWARE_ALIASES,
  KNOWN_BRANDS
};
