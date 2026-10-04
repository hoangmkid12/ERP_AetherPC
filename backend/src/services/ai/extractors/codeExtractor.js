/**
 * CODE & IDENTIFIER EXTRACTOR - GIAI ĐOẠN 2: BÓC TÁCH MÃ ĐỊNH DANH & SỐ LIỆU
 * Trích xuất chuẩn xác mã đơn hàng, mã PO, mã RMA, mã Job ráp máy, Serial, SĐT và ngân sách
 */

/**
 * Chuẩn hóa số tiền tiếng Việt thành số nguyên (VNĐ)
 * Ví dụ: "15 triệu" -> 15000000, "2.5tr" -> 2500000, "500k" -> 500000
 */
const parseVietnameseMoney = (text) => {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // Dạng 1: "15.000.000" hoặc "15,000,000"
  const plainFormattedMatch = lower.match(/(?:^|\s)(\d{1,3}(?:[.,]\d{3})+)(?:\s*(?:đ|vnd|đồng))?/i);
  if (plainFormattedMatch) {
    const cleanNum = plainFormattedMatch[1].replace(/[.,]/g, '');
    const val = parseInt(cleanNum, 10);
    if (!isNaN(val) && val >= 1000) return val;
  }

  // Dạng 2: "15 triệu", "15 tr", "15 củ", "2.5 triệu"
  const millionMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:triệu|trieu|tr|củ|cu)\b/i);
  if (millionMatch) {
    const num = parseFloat(millionMatch[1].replace(',', '.'));
    if (!isNaN(num)) return Math.round(num * 1000000);
  }

  // Dạng 3: "500k", "500 nghìn", "500 ngàn"
  const thousandMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|nghin|ngàn|ngan)\b/i);
  if (thousandMatch) {
    const num = parseFloat(thousandMatch[1].replace(',', '.'));
    if (!isNaN(num)) return Math.round(num * 1000);
  }

  return null;
};

/**
 * Trích xuất toàn bộ các loại mã và thông số từ câu hỏi
 * @param {string} text 
 * @returns {object}
 */
const extractCodes = (text) => {
  if (!text || typeof text !== 'string') {
    return {
      orderId: null,
      poNumber: null,
      rmaCode: null,
      jobCode: null,
      billNumber: null,
      serial: null,
      phone: null,
      budget: null
    };
  }

  const str = text.trim();
  const lower = str.toLowerCase();

  // 1. MÃ ĐƠN HÀNG (Order ID)
  // Ưu tiên khớp dạng: #ORD-2024-001, ORD-1234, ORD1234, DH1234, #1234
  let orderId = null;
  const explicitOrderMatch = str.match(/#?((?:ORD|DH|HD)[-_A-Za-z0-9]+)/i);
  if (explicitOrderMatch) {
    orderId = explicitOrderMatch[1].toUpperCase();
  } else {
    // Tìm dạng #1234 hoặc "đơn hàng số 502", "đơn 123"
    const hashMatch = str.match(/#(\d+)\b/);
    if (hashMatch) {
      orderId = hashMatch[1];
    } else {
      const naturalOrderMatch = lower.match(/(?:đơn\s*hàng|mã\s*đơn|đơn|order)(?:\s+(?:số|mã))?\s+([A-Za-z0-9_-]+)/i);
      if (naturalOrderMatch && !/^(hàng|nào|gần đây|hôm nay|cần|chưa|đã|mới|này|kia)$/i.test(naturalOrderMatch[1])) {
        orderId = naturalOrderMatch[1].toUpperCase();
      }
    }
  }

  // 2. MÃ PHIẾU NHẬP / PURCHASE ORDER (PO Number)
  let poNumber = null;
  const poMatch = str.match(/\b(PO[-_]?[A-Za-z0-9]+)\b/i);
  if (poMatch) {
    poNumber = poMatch[1].toUpperCase();
  }

  // 3. MÃ RMA ĐỔI TRẢ (Return Request / RMA)
  let rmaCode = null;
  const rmaMatch = str.match(/\b(RMA[-_]?[A-Za-z0-9]+|TH[-_]?[A-Za-z0-9]+)\b/i);
  if (rmaMatch) {
    rmaCode = rmaMatch[1].toUpperCase();
  }

  // 4. MÃ CÔNG VIỆC RÁP MÁY (Assembly Job Code)
  let jobCode = null;
  const jobMatch = str.match(/\b(JOB[-_]?[A-Za-z0-9]+)\b/i);
  if (jobMatch) {
    jobCode = jobMatch[1].toUpperCase();
  }

  // 5. MÃ HÓA ĐƠN NCC (Vendor Bill)
  let billNumber = null;
  const billMatch = str.match(/\b(BILL[-_]?[A-Za-z0-9]+|VB[-_]?[A-Za-z0-9]+)\b/i);
  if (billMatch) {
    billNumber = billMatch[1].toUpperCase();
  }

  // 6. SỐ SERIAL NUMBER LINH KIỆN
  let serial = null;
  const explicitSerialMatch = str.match(/(?:serial|số serial|mã serial|sn)[:\s]+([A-Za-z0-9_-]+)/i);
  if (explicitSerialMatch) {
    serial = explicitSerialMatch[1].toUpperCase();
  } else {
    // Khớp định dạng serial chuẩn (bắt đầu bằng SN hoặc chuỗi alphanumeric dài từ 8 ký tự)
    const snMatch = str.match(/\b(SN[A-Za-z0-9]{5,})\b/i);
    if (snMatch) {
      serial = snMatch[1].toUpperCase();
    }
  }

  // 7. SỐ ĐIỆN THOẠI KHÁCH HÀNG (Phone)
  let phone = null;
  const phoneMatch = str.match(/(?:^|\D)(0[3|5|7|8|9]\d{8}|\+84[3|5|7|8|9]\d{8})(?:\D|$)/);
  if (phoneMatch) {
    phone = phoneMatch[1];
  }

  // 8. NGÂN SÁCH / KHOẢNG TIỀN (Budget)
  const budget = parseVietnameseMoney(str);

  return {
    orderId,
    poNumber,
    rmaCode,
    jobCode,
    billNumber,
    serial,
    phone,
    budget
  };
};

module.exports = {
  extractCodes,
  parseVietnameseMoney
};
