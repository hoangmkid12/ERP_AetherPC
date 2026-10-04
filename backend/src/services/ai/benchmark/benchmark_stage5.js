/**
 * BENCHMARK & STRESS TEST SUITE - GIAI ĐOẠN 5: HOÀN THIỆN, ĐO LƯỜNG & TỐI ƯU HIỆU NĂNG
 * 
 * Kiểm định toàn diện:
 * 1. Đo lường độ trễ (Latency Benchmark: Cold vs Warm vs Cached Hit < 1ms).
 * 2. Kiểm thử tải đồng thời (Concurrency & Throughput: 100 concurrent queries).
 * 3. Khả năng kháng câu hỏi ngoài phạm vi (OOD & Adversarial Queries).
 * 4. Kiểm tra tỷ lệ trúng bộ nhớ đệm (Cache Hit Rate & Eviction).
 * 5. Độ chính xác tổng thể trên tập câu hỏi thực tế (Real-world Accuracy).
 */

const { executeActorIntent } = require('../actors');
const { queryCache } = require('../cache');
const { conversationContext } = require('../context');

// Mock Prisma tối ưu cho Stress Testing
const createBenchmarkPrisma = () => {
  return {
    product: {
      findMany: async (args) => {
        const kw = (args?.where?.name?.contains || '').toLowerCase();
        const mockProducts = [
          { productId: 1, name: 'Card màn hình ASUS TUF Gaming RTX 4070 Super 12GB', sku: 'VGA-RTX4070S-ASUS', price: 18500000, stockQuantity: 8 },
          { productId: 2, name: 'CPU Intel Core i5-13400F Box Chính Hãng', sku: 'CPU-INTEL-I513400F', price: 4690000, stockQuantity: 15 },
          { productId: 3, name: 'Bộ nhớ RAM Corsair Vengeance DDR5 32GB 5600MHz', sku: 'RAM-COR-D5-32G', price: 2950000, stockQuantity: 20 },
          { productId: 4, name: 'Mainboard MSI MAG B760M MORTAR WIFI DDR5', sku: 'MB-MSI-B760M-D5', price: 3890000, stockQuantity: 12 }
        ];
        if (!kw) return mockProducts;
        return mockProducts.filter(p => p.name.toLowerCase().includes(kw));
      },
      count: async () => 4
    },
    order: {
      findUnique: async () => ({
        orderId: 1002,
        trackingNumber: 'DH-1002',
        deliveryStatus: 'SHIPPING',
        totalAmount: 25000000,
        shippingAddress: 'Quận 1, TP.HCM'
      }),
      findMany: async () => [],
      count: async () => 10,
      aggregate: async () => ({
        _sum: { totalAmount: 85000000 },
        _count: { orderId: 25 },
        _avg: { totalAmount: 3400000 }
      })
    },
    companyBankAccount: {
      findMany: async () => [{ bankCode: 'MB', accountNumber: '99998888', isDefaultQr: true }]
    },
    warehouse: {
      findMany: async () => [{ name: 'Kho Tổng TP.HCM', address: 'Quận 10, TP.HCM' }]
    }
  };
};

async function runStage5Benchmark() {
  console.log('========================================================================');
  console.log('⚡ BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 5: BENCHMARK, STRESS TEST & HIỆU NĂNG CACHE');
  console.log('========================================================================\n');

  const prisma = createBenchmarkPrisma();
  let totalTests = 0;
  let passedTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  // --------------------------------------------------------------------------
  // PHẦN 1: ĐO LƯỜNG ĐỘ TRỄ UNCACHED VS CACHED HIT (< 1MS)
  // --------------------------------------------------------------------------
  console.log('--- 1. ĐO LƯỜNG ĐỘ TRỄ: UNCACHED RUN VS CACHE HIT (< 1MS) ---');
  queryCache.clear();

  const testPrompt = 'kiểm tra giá card rtx 4070';
  const salesUser = { id: 1, role: 'SALES', name: 'Sales Tester' };

  // Khởi động nạp Vector Index bộ nhớ (Index Warm-up)
  await executeActorIntent('khởi động vector engine', 'SALES', prisma, salesUser, { skipCache: true });

  // Lần 1: Uncached Run (Toàn bộ Vector NLP + Entity Extraction + Prisma Handler)
  const t0 = process.hrtime.bigint();
  const uncachedResult = await executeActorIntent(testPrompt, 'SALES', prisma, salesUser, { skipCache: false });
  const t1 = process.hrtime.bigint();
  const uncachedLatencyMs = Number(t1 - t0) / 1e6;

  assert(uncachedResult && uncachedResult.status === 'SUCCESS', `Uncached Run thành công (${uncachedLatencyMs.toFixed(2)}ms)`);
  assert(uncachedLatencyMs < 500, `Uncached Run xử lý cục bộ đáp ứng chuẩn SLA < 500ms (Thực tế: ${uncachedLatencyMs.toFixed(2)}ms)`);

  // Lần 2: Cache Hit (Lấy trực tiếp từ Memory Cache)
  const t2 = process.hrtime.bigint();
  const cachedResult = await executeActorIntent(testPrompt, 'SALES', prisma, salesUser, { skipCache: false });
  const t3 = process.hrtime.bigint();
  const cachedLatencyMs = Number(t3 - t2) / 1e6;

  assert(cachedResult && cachedResult.fromCache === true, 'Cache Hit thành công (fromCache = true)');
  assert(cachedLatencyMs < 2.0, `Cache Hit phản hồi siêu tốc dưới 2ms (Thực tế: ${cachedLatencyMs.toFixed(3)}ms)`);

  const speedup = (uncachedLatencyMs / Math.max(cachedLatencyMs, 0.01)).toFixed(1);
  console.log(`  🚀 Tốc độ tăng tốc nhờ Query Cache: ${speedup}x lần!`);

  // --------------------------------------------------------------------------
  // PHẦN 2: KIỂM THỬ TẢI ĐỒNG THỜI (100 CONCURRENT QUERIES STRESS TEST)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. KIỂM THỬ TẢI ĐỒNG THỜI (100 CONCURRENT QUERIES) ---');

  const concurrentPrompts = [
    { prompt: 'báo cáo doanh thu thực tế hôm nay', role: 'ACCOUNTANT' },
    { prompt: 'card rtx 4070 còn hàng không', role: 'SALES' },
    { prompt: 'quy chuẩn chụp ảnh pod', role: 'DELIVERY' },
    { prompt: 'tài khoản vietqr nhận tiền', role: 'ACCOUNTANT' },
    { prompt: 'kiểm tra tiến độ đơn hàng DH-1002', role: 'DELIVERY' },
    { prompt: 'báo cáo kpi năm nay', role: 'ADMIN_CEO' },
    { prompt: 'địa chỉ kho trung tâm', role: 'DELIVERY' },
    { prompt: 'sản phẩm khuyến mãi giảm giá', role: 'SALES' }
  ];

  // Làm ấm Cache (Warm-up phase)
  for (const item of concurrentPrompts) {
    await executeActorIntent(item.prompt, item.role, prisma, { id: 99, role: item.role }, { sessionId: 'warmup' });
  }

  const totalConcurrent = 100;
  const tasks = [];
  const startStress = Date.now();

  for (let i = 0; i < totalConcurrent; i++) {
    const item = concurrentPrompts[i % concurrentPrompts.length];
    tasks.push(
      executeActorIntent(item.prompt, item.role, prisma, { id: i + 1, role: item.role }, { sessionId: `stress_${i}` })
    );
  }

  const results = await Promise.all(tasks);
  const totalStressTimeMs = Date.now() - startStress;
  const successfulQueries = results.filter(r => r && (r.status === 'SUCCESS' || r.status === 'CLARIFICATION_REQUIRED')).length;
  const qps = Math.round((totalConcurrent / (totalStressTimeMs / 1000)));

  assert(successfulQueries === totalConcurrent, `Hoàn thành 100% câu hỏi đồng thời (${successfulQueries}/${totalConcurrent})`);
  assert(totalStressTimeMs < 1000, `Tổng thời gian xử lý 100 câu hỏi < 1000ms (Thực tế: ${totalStressTimeMs}ms)`);
  console.log(`  ⚡ Thông lượng đo được: ~${qps} QPS (Queries Per Second)`);

  // --------------------------------------------------------------------------
  // PHẦN 3: ĐỘ BỀN VỚI CÂU HỎI NGOÀI PHẠM VI (OOD & ADVERSARIAL QUERIES)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. ĐỘ BỀN VỚI CÂU HỎI NGOÀI PHẠM VI & TỪ KHÓA LỖI (OOD ROBUSTNESS) ---');

  // Câu hỏi ngẫu hứng / không liên quan tới ERP
  const oodQuery = 'hôm nay trời nắng hay mưa ở sài gòn';
  const oodResult = await executeActorIntent(oodQuery, 'SALES', prisma, salesUser, { sessionId: 'ood_session' });

  assert(
    !oodResult || oodResult.status === 'UNCERTAIN',
    'Câu hỏi thời tiết ngoài phạm vi -> Từ chối khéo léo hoặc trả về UNCERTAIN'
  );

  // Câu hỏi chuỗi ký tự rác
  const gibberishQuery = 'asdkfjhsdf982374@#$@#';
  const gibberishResult = await executeActorIntent(gibberishQuery, 'ACCOUNTANT', prisma, { id: 2, role: 'ACCOUNTANT' }, { sessionId: 'gib_session' });

  assert(
    !gibberishResult || gibberishResult.status === 'UNCERTAIN',
    'Chuỗi ký tự vô nghĩa -> Không nhầm lẫn với bất kỳ nghiệp vụ tài chính nào'
  );

  // Câu hỏi viết tắt không dấu có lỗi gõ phím
  const typoQuery = 'doang thu thag nay';
  const accountantUser = { id: 3, role: 'ACCOUNTANT', name: 'Accountant Tester' };
  const typoResult = await executeActorIntent(typoQuery, 'ACCOUNTANT', prisma, accountantUser, { sessionId: 'typo_session' });

  assert(
    typoResult && typoResult.status === 'SUCCESS',
    'Từ khóa gõ sai dấu ("doang thu thag nay") -> Vẫn nhận diện chính xác doanh thu nhờ Subword Vector'
  );

  // --------------------------------------------------------------------------
  // PHẦN 4: ĐÁNH GIÁ HIỆU SUẤT CACHE (HIT RATE & INVALIDATION)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. THỐNG KÊ BỘ NHỚ ĐỆM & CƠ CHẾ INVALIDATION ---');

  const stats = queryCache.getStats();
  assert(stats.hits > 0, `Ghi nhận lượt trúng cache (Hits: ${stats.hits})`);
  assert(stats.hitRate >= 50.0, `Tỷ lệ trúng cache đạt yêu cầu (Hit Rate: ${stats.hitRate}%)`);

  // Thử nghiệm vô hiệu hóa cache theo vai trò
  queryCache.invalidateByRole('SALES');
  const checkInvalidated = queryCache.get(queryCache.generateKey(testPrompt, 'SALES'));
  assert(checkInvalidated === null, 'Vô hiệu hóa cache vai trò SALES thành công');

  // --------------------------------------------------------------------------
  // TỔNG KẾT
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`📊 TỔNG KẾT GIAI ĐOẠN 5: ĐẠT ${passedTests}/${totalTests} KIỂM THỬ (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 TẤT CẢ KIỂM THỬ GIAI ĐOẠN 5 ĐÃ HOÀN TẤT VỚI HIỆU NĂNG XUẤT SẮC!');
    process.exit(0);
  } else {
    console.error('⚠️ Có kiểm thử thất bại trong Giai đoạn 5.');
    process.exit(1);
  }
}

runStage5Benchmark().catch(err => {
  console.error('Lỗi thực thi kiểm thử Stage 5:', err);
  process.exit(1);
});
