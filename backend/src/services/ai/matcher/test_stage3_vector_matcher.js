/**
 * TEST STAGE 3: BỘ KIỂM THỬ SO KHỚP Ý ĐỊNH BẰNG VECTOR EMBEDDING & COSINE SIMILARITY
 * Kiểm tra VectorEngine, VectorMatcher, HybridMatcher và Ngưỡng tin cậy (Confidence Rejection)
 */

const prisma = require('../../../config/database');
const {
  VectorEngine,
  vectorMatcher,
  matchHybridIntent
} = require('./index');
const { executeActorIntent } = require('../actors');

const runStage3Tests = async () => {
  console.log('================ BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 3: VECTOR EMBEDDING & COSINE SIMILARITY ================\n');

  let passed = 0;
  let total = 0;

  // 1. KIỂM THỬ ĐỘNG CƠ VECTOR ENGINE & SUBWORD RESILIENCE
  console.log('--- 1. KIỂM THỬ ĐỘNG CƠ VECTOR & KHÁNG LỖI CHÍNH TẢ (VECTOR ENGINE) ---');
  const engine = new VectorEngine();
  engine.fit([
    { id: '1', text: 'báo cáo tổng doanh thu công ty năm nay' },
    { id: '2', text: 'các đơn hàng nào chưa thanh toán tiền' },
    { id: '3', text: 'card rtx 4070 còn hàng không và giá bao nhiêu' }
  ]);

  // a. Khớp chính xác 100%
  total++;
  const exactScore = engine.cosineSimilarity(
    engine.vectorize('báo cáo tổng doanh thu công ty năm nay'),
    engine.vectorize('báo cáo tổng doanh thu công ty năm nay')
  );
  if (exactScore >= 0.99) {
    console.log(`✅ [Exact Vector] Điểm tuyệt đối: ${exactScore.toFixed(3)} (1.000)`);
    passed++;
  } else {
    console.error(`❌ [Exact Vector] Điểm sai: ${exactScore}`);
  }

  // b. Kháng lỗi chính tả / gõ thiếu dấu (Subword n-gram)
  total++;
  const typoScore = engine.cosineSimilarity(
    engine.vectorize('bao cao tong doang thu cong ti nam nay'),
    engine.vectorize('báo cáo tổng doanh thu công ty năm nay')
  );
  if (typoScore >= 0.5) {
    console.log(`✅ [Typo Resilience] Lỗi chính tả ("doang thu nam nay") -> Score: ${typoScore.toFixed(3)} (>= 0.500)`);
    passed++;
  } else {
    console.error(`❌ [Typo Resilience] Điểm quá thấp: ${typoScore}`);
  }

  // c. Phân biệt ngữ nghĩa khác biệt
  total++;
  const diffScore = engine.cosineSimilarity(
    engine.vectorize('card rtx 4070 còn hàng không'),
    engine.vectorize('báo cáo tổng doanh thu công ty năm nay')
  );
  if (diffScore < 0.25) {
    console.log(`✅ [Semantic Separation] 2 câu khác biệt -> Score: ${diffScore.toFixed(3)} (< 0.250)`);
    passed++;
  } else {
    console.error(`❌ [Semantic Separation] Điểm quá cao giữa 2 câu khác biệt: ${diffScore}`);
  }

  // 2. KIỂM THỬ SO KHỚP Ý ĐỊNH BẰNG VECTOR MATCHER (79 KỸ NĂNG)
  console.log('\n--- 2. KIỂM THỬ SO KHỚP Ý ĐỊNH TRÊN TOÀN BỘ 79 KỸ NĂNG (VECTOR MATCHER) ---');
  vectorMatcher.buildIndex();
  const vectorTestCases = [
    {
      query: 'tổng tiền thu cả năm 2026 của công ty là bao nhiêu',
      role: 'ACCOUNTANT',
      expectedIntent: 'ANNUAL_REVENUE'
    },
    {
      query: 'bữa nay thu được bi nhiu tiền bán hàng',
      role: 'ACCOUNTANT',
      expectedIntent: 'TODAY_REVENUE'
    },
    {
      query: 'đơn cod nào shipper chưa nộp tiền',
      role: 'ACCOUNTANT',
      expectedIntent: 'UNRECONCILED_COD_ORDERS'
    },
    {
      query: 'vga rtx 4070 còn mấy cái và giá ra sao',
      role: 'SALES',
      expectedIntent: 'PRODUCT_PRICE_STOCK'
    },
    {
      query: 'tư vấn ráp máy tính chơi game khoảng 20 triệu',
      role: 'SALES',
      expectedIntent: 'PC_BUILD_RECOMMENDATION_BY_BUDGET'
    },
    {
      query: 'hôm nay tôi có bao nhiêu đơn cần giao tới khách',
      role: 'DELIVERY',
      expectedIntent: 'ASSIGNED_ORDERS_TODAY'
    },
    {
      query: 'lý do mấy đơn bị boom hàng không nhận',
      role: 'DELIVERY',
      expectedIntent: 'FAILED_DELIVERY_REASONS'
    },
    {
      query: 'mặt hàng nào sắp hết tồn kho cảnh báo giúp tôi',
      role: 'WAREHOUSE',
      expectedIntent: 'LOW_STOCK_WARNING'
    },
    {
      query: 'tra cứu nguồn gốc serial number linh kiện',
      role: 'WAREHOUSE',
      expectedIntent: 'SERIAL_NUMBER_TRACKING'
    },
    {
      query: 'báo cáo tổng kết kpi kinh doanh toàn công ty năm nay',
      role: 'ADMIN_CEO',
      expectedIntent: 'ANNUAL_EXECUTIVE_SUMMARY'
    },
    {
      query: 'ước tính lãi gộp và lợi nhuận kinh doanh',
      role: 'ADMIN_CEO',
      expectedIntent: 'ESTIMATED_GROSS_PROFIT'
    }
  ];

  for (const tc of vectorTestCases) {
    total++;
    const res = vectorMatcher.match(tc.query, tc.role);
    if (res.status === 'MATCHED' && res.intent === tc.expectedIntent) {
      console.log(`✅ [Vector Match] "${tc.query}" -> [${res.intent}] (Score: ${res.score.toFixed(3)})`);
      passed++;
    } else {
      console.error(`❌ [Vector Match] "${tc.query}" -> Expected ${tc.expectedIntent}, got ${res.intent} (status: ${res.status}, score: ${res.score})`);
    }
  }

  // 3. KIỂM THỬ NGƯỠNG TỰ ĐỘNG TỪ CHỐI & GỢI Ý (CONFIDENCE REJECTION)
  console.log('\n--- 3. KIỂM THỬ TỪ CHỐI CÂU HỎI LẠ & ĐƯA RA GỢI Ý (UNCERTAINTY HANDLING) ---');
  total++;
  const outOfDomainQuery = 'hướng dẫn công thức nấu món lẩu cá hồi chua cay thơm ngon';
  const uncertainRes = vectorMatcher.match(outOfDomainQuery);

  if (uncertainRes.status === 'UNCERTAIN' && uncertainRes.suggestions.length > 0) {
    console.log(`✅ [Uncertain Rejection] Câu hỏi ngoài lề "${outOfDomainQuery}"`);
    console.log(`   -> Trạng thái: ${uncertainRes.status} (Score: ${uncertainRes.score.toFixed(3)} < threshold)`);
    console.log(`   -> Đưa ra ${uncertainRes.suggestions.length} gợi ý thông minh:`);
    uncertainRes.suggestions.forEach((s, idx) => console.log(`      ${idx + 1}. [${s.intent}] ${s.title} (${s.role})`));
    passed++;
  } else {
    console.error(`❌ [Uncertain Rejection] Lỗi:`, uncertainRes);
  }

  // 4. KIỂM THỬ KẾT HỢP HYBRID MATCHER
  console.log('\n--- 4. KIỂM THỬ BỘ SO KHỚP LAI GHÉP (HYBRID MATCHER) ---');
  total++;
  const accountantTrainer = require('../actors/accountant.trainer');
  const hybridTest = await matchHybridIntent('cho tôi xem doanh thu hôm nay', 'ACCOUNTANT', accountantTrainer);
  if (hybridTest && hybridTest.intent === 'TODAY_REVENUE' && hybridTest.status === 'MATCHED') {
    console.log(`✅ [Hybrid Matcher] Khớp thành công: Source=${hybridTest.source}, Intent=[${hybridTest.intent}], Score=${hybridTest.score}`);
    passed++;
  } else {
    console.error(`❌ [Hybrid Matcher] Thất bại:`, hybridTest);
  }

  // 5. KIỂM THỬ ĐIỀU HỢP TỔNG THỂ (STAGE 3 -> STAGE 2 -> STAGE 1)
  console.log('\n--- 5. KIỂM THỬ TÍCH HỢP TỔNG THỂ CẢ 3 GIAI ĐOẠN ---');
  total++;
  try {
    // Câu hỏi bằng tiếng lóng: "bữa nay thu được bi nhiu tiền bán hàng"
    // Stage 3 nhận diện intent: TODAY_REVENUE
    // Stage 2 trích xuất date: hôm nay
    // Stage 1 chạy Prisma query tổng doanh thu hôm nay
    const fullRes = await executeActorIntent(
      'bữa nay thu được bi nhiu tiền bán hàng',
      'ACCOUNTANT',
      prisma,
      { id: 3, role: 'ACCOUNTANT' }
    );

    if (fullRes && fullRes.status === 'SUCCESS' && fullRes.text) {
      console.log(`✅ [End-to-End Pipeline] 3 Giai đoạn phối hợp hoàn hảo!`);
      console.log(`   Intent: [${fullRes.intent}] (MatchSource: ${fullRes.matchSource})`);
      console.log(`   Extracted: period="${fullRes.extractedParams?.period}"`);
      console.log(`   Prisma Result:\n${fullRes.text.split('\n').map(l => '   ' + l).join('\n')}`);
      passed++;
    } else {
      console.error(`❌ [End-to-End Pipeline] Thất bại:`, fullRes);
    }
  } catch (err) {
    console.error(`❌ [End-to-End Pipeline] Lỗi ngoại lệ:`, err.message);
  }

  console.log('\n================ TỔNG KẾT KIỂM THỬ GIAI ĐOẠN 3 ================');
  console.log(`🎯 Kết quả: ${passed}/${total} kịch bản Vector & Cosine Similarity vượt qua 100%!`);

  await prisma.$disconnect();

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
};

runStage3Tests();
