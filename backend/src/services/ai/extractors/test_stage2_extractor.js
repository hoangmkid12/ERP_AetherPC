/**
 * TEST STAGE 2: BỘ KIỂM THỬ TRÍCH XUẤT THỰC THỂ & CHUẨN HÓA THAM SỐ
 * Kiểm tra DateResolver, CodeExtractor, EntityResolver (Trigram), và Master ParameterExtractor
 */

const prisma = require('../../../config/database');
const {
  resolveDate,
  extractCodes,
  resolveEntities,
  calculateTrigramSimilarity,
  extractParameters
} = require('./index');
const { executeActorIntent } = require('../actors');

const runStage2Tests = async () => {
  console.log('================ BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 2: ENTITY EXTRACTION & FUZZY MATCHING ================\n');

  let passed = 0;
  let total = 0;

  // 1. KIỂM THỬ DATE RESOLVER
  console.log('--- 1. KIỂM THỬ PHÂN GIẢI THỜI GIAN (DATE RESOLVER) ---');
  const dateCases = [
    { text: 'doanh thu hôm nay của công ty', expectedType: 'DAY', expectedPeriod: 'hôm nay' },
    { text: 'hôm qua bán được bao nhiêu tiền', expectedType: 'DAY', expectedPeriod: 'hôm qua' },
    { text: 'báo cáo kinh doanh tuần này', expectedType: 'WEEK', expectedPeriod: 'tuần này' },
    { text: 'doanh số tháng này là bao nhiêu', expectedType: 'MONTH', expectedPeriod: 'tháng này' },
    { text: 'tổng tiền thu được tháng trước', expectedType: 'MONTH', expectedPeriod: 'tháng trước' },
    { text: 'kết quả bán hàng năm nay', expectedType: 'YEAR', expectedPeriod: 'năm nay' },
    { text: 'thống kê 7 ngày qua', expectedType: 'ROLLING_DAYS', expectedPeriod: '7 ngày qua' },
    { text: 'từ ngày 01/10/2026 đến ngày 15/10/2026', expectedType: 'RANGE', expectedPeriod: 'khoảng ngày chỉ định' }
  ];

  for (const tc of dateCases) {
    total++;
    const res = resolveDate(tc.text);
    if (res.periodType === tc.expectedType && res.period === tc.expectedPeriod && res.startDate && res.endDate) {
      console.log(`✅ [Date] "${tc.text}" -> ${res.periodType} [${res.label}] (Khớp 100%)`);
      passed++;
    } else {
      console.error(`❌ [Date] "${tc.text}" -> Expected ${tc.expectedType}/${tc.expectedPeriod}, got ${res.periodType}/${res.period}`);
    }
  }

  // 2. KIỂM THỬ CODE & IDENTIFIER EXTRACTOR
  console.log('\n--- 2. KIỂM THỬ BÓC TÁCH MÃ & SỐ TIỀN (CODE EXTRACTOR) ---');
  const codeCases = [
    { text: 'kiểm tra tình trạng đơn #ORD-2024-001', check: (r) => r.orderId === 'ORD-2024-001' },
    { text: 'tra cứu thông tin đơn hàng số 502', check: (r) => r.orderId === '502' },
    { text: 'phiếu nhập PO-0042 đã về kho chưa', check: (r) => r.poNumber === 'PO-0042' },
    { text: 'xem yêu cầu đổi trả RMA-999', check: (r) => r.rmaCode === 'RMA-999' },
    { text: 'lệnh ráp máy JOB-101', check: (r) => r.jobCode === 'JOB-101' },
    { text: 'kiểm tra số serial SN987654321', check: (r) => r.serial === 'SN987654321' },
    { text: 'khách hàng số điện thoại 0987654321 có tích điểm gì không', check: (r) => r.phone === '0987654321' },
    { text: 'tư vấn cấu hình máy tính tầm 25 triệu', check: (r) => r.budget === 25000000 },
    { text: 'mua linh kiện khoảng 500k', check: (r) => r.budget === 500000 }
  ];

  for (const tc of codeCases) {
    total++;
    const res = extractCodes(tc.text);
    if (tc.check(res)) {
      console.log(`✅ [Code] "${tc.text}" -> Trích xuất thành công!`);
      passed++;
    } else {
      console.error(`❌ [Code] "${tc.text}" -> Trích xuất thất bại:`, res);
    }
  }

  // 3. KIỂM THỬ ENTITY RESOLVER & HARDWARE ALIASES
  console.log('\n--- 3. KIỂM THỬ TỪ ĐIỂN PHẦN CỨNG & THỰC THỂ (ENTITY RESOLVER) ---');
  const entityCases = [
    { text: 'card 4070 ti super còn hàng không', check: (r) => r.canonicalHardware === 'RTX 4070 Ti Super' },
    { text: 'báo giá con 4070s', check: (r) => r.canonicalHardware === 'RTX 4070 Super' },
    { text: 'con i5 đời 13 lắp được với main nào', check: (r) => r.canonicalHardware === 'Core i5-13400F' },
    { text: 'ryzen 7 7800x3d có sẵn hàng không', check: (r) => r.canonicalHardware === 'Ryzen 7 7800X3D' },
    { text: 'main b760m của asus giá bao nhiêu', check: (r) => r.canonicalHardware === 'B760M' && r.brandName === 'ASUS' },
    { text: 'kho chính công ty ở địa chỉ nào', check: (r) => r.warehouseName === 'Kho Trung Tâm AetherPC' },
    { text: 'khách vừa quét vietqr thành công', check: (r) => r.paymentMethod === 'VIETQR' }
  ];

  for (const tc of entityCases) {
    total++;
    const res = await resolveEntities(tc.text, prisma);
    if (tc.check(res)) {
      console.log(`✅ [Entity] "${tc.text}" -> [Hardware: ${res.canonicalHardware || 'N/A'}, Brand: ${res.brandName || 'N/A'}]`);
      passed++;
    } else {
      console.error(`❌ [Entity] "${tc.text}" -> Khớp sai:`, res);
    }
  }

  // 4. KIỂM THỬ THUẬT TOÁN TRIGRAM FUZZY SIMILARITY
  console.log('\n--- 4. KIỂM THỬ THUẬT TOÁN TRIGRAM SIMILARITY ---');
  const trigramPairs = [
    { s1: 'card rtx 4070', s2: 'Card Màn Hình ASUS TUF RTX 4070 O12G GAMING', expectGt: 0.2 },
    { s1: 'i5 13400f', s2: 'CPU Intel Core i5 13400F Tray', expectGt: 0.3 }
  ];

  for (const tp of trigramPairs) {
    total++;
    const score = calculateTrigramSimilarity(tp.s1, tp.s2);
    if (score >= tp.expectGt) {
      console.log(`✅ [Trigram] "${tp.s1}" vs "${tp.s2}" -> Score: ${score.toFixed(3)} (>= ${tp.expectGt})`);
      passed++;
    } else {
      console.error(`❌ [Trigram] Score quá thấp: ${score} (< ${tp.expectGt})`);
    }
  }

  // 5. KIỂM THỬ TỰ ĐỘNG END-TO-END VỚI EXECUTE_ACTOR_INTENT
  console.log('\n--- 5. KIỂM THỬ TÍCH HỢP TỰ ĐỘNG EXTRACT VÀO EXECUTE_ACTOR_INTENT ---');
  total++;
  try {
    // Không truyền params thủ công! Stage 2 phải tự bóc tách ra productName: 'RTX 4070'
    const autoRes = await executeActorIntent(
      'card 4070 còn hàng không và giá bao nhiêu?',
      'SALES',
      prisma,
      { id: 7, role: 'SALES' },
      {} // Không truyền params!
    );

    if (autoRes?.status === 'SUCCESS' && autoRes.extractedParams?.productName) {
      console.log(`✅ [E2E Auto Extraction] Tự động trích xuất: productName="${autoRes.extractedParams.productName}"`);
      console.log(`   Kết quả trả lời: Khớp intent [${autoRes.intent}] & truy vấn thành công!`);
      passed++;
    } else {
      console.error(`❌ [E2E Auto Extraction] Không tự động bóc tách được:`, autoRes);
    }
  } catch (err) {
    console.error(`❌ [E2E Auto Extraction] Lỗi:`, err.message);
  }

  console.log('\n================ TỔNG KẾT KIỂM THỬ GIAI ĐOẠN 2 ================');
  console.log(`🎯 Kết quả: ${passed}/${total} kịch bản bóc tách thực thể vượt qua 100%!`);

  await prisma.$disconnect();

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
};

runStage2Tests();
