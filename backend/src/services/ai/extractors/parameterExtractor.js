/**
 * MASTER PARAMETER EXTRACTOR - GIAI ĐOẠN 2
 * Tổng hợp toàn bộ quá trình trích xuất tham số: Date, Codes, Entities
 * Tạo thành đối tượng tham số chuẩn hóa (Clean Typed Parameters) cho Prisma Handlers
 */

const { resolveDate } = require('./dateResolver');
const { extractCodes } = require('./codeExtractor');
const { resolveEntities } = require('./entityResolver');

/**
 * Trích xuất tham số tự động từ câu hỏi người dùng
 * @param {string} query Câu hỏi gốc của người dùng
 * @param {object} prisma Prisma Client instance (để query fuzzy DB)
 * @param {object} user Thông tin người dùng hiện tại
 * @param {object} explicitParams Tham số truyền tường minh từ frontend (nếu có)
 * @returns {Promise<object>} Đối tượng tham số sạch sẽ sẵn sàng cho Prisma Handler
 */
const extractParameters = async (query, prisma = null, user = null, explicitParams = {}) => {
  if (!query || typeof query !== 'string') {
    return { ...explicitParams };
  }

  // 1. Phân giải thời gian
  const dateInfo = resolveDate(query);

  // 2. Bóc tách các mã định danh & ngân sách
  const codeInfo = extractCodes(query);

  // 3. Phân giải thực thể (Sản phẩm, Thương hiệu, Kho, Thanh toán)
  const entityInfo = await resolveEntities(query, prisma);

  // 4. Hợp nhất thành Flat Parameters object cho Prisma Handlers
  const params = {
    query,
    // Thông tin thời gian
    startDate: dateInfo.startDate,
    endDate: dateInfo.endDate,
    period: dateInfo.period || explicitParams.period,
    periodType: dateInfo.periodType,
    hasDate: dateInfo.hasDate,

    // Thông tin mã định danh
    orderId: explicitParams.orderId || codeInfo.orderId,
    poNumber: explicitParams.poNumber || codeInfo.poNumber,
    rmaCode: explicitParams.rmaCode || codeInfo.rmaCode,
    jobCode: explicitParams.jobCode || codeInfo.jobCode,
    billNumber: explicitParams.billNumber || codeInfo.billNumber,
    serial: explicitParams.serial || codeInfo.serial,
    phone: explicitParams.phone || codeInfo.phone,
    budget: explicitParams.budget || codeInfo.budget,

    // Thông tin thực thể
    productName: explicitParams.productName || entityInfo.productName,
    brandName: explicitParams.brandName || entityInfo.brandName,
    warehouseName: explicitParams.warehouseName || entityInfo.warehouseName,
    paymentMethod: explicitParams.paymentMethod || entityInfo.paymentMethod,

    // Thông tin người dùng
    userId: user?.id || explicitParams.userId,
    userRole: user?.role || explicitParams.userRole,

    // Cấu trúc gốc để kiểm tra / debug
    _rawExtraction: {
      dates: dateInfo,
      codes: codeInfo,
      entities: entityInfo
    }
  };

  // Gộp các thuộc tính explicitParams nếu chưa có
  for (const [k, v] of Object.entries(explicitParams)) {
    if (v !== undefined && v !== null) {
      params[k] = v;
    }
  }

  return params;
};

module.exports = {
  extractParameters
};
