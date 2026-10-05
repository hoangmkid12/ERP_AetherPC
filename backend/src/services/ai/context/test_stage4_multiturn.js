/**
 * TEST SUITE: GIAI ĐOẠN 4 - MULTI-TURN CONTEXT MANAGEMENT & CONVERSATIONAL MEMORY
 * Kiểm thử toàn diện:
 * 1. Kế thừa thực thể qua các lượt (Entity Backfill: productName, orderId, poNumber).
 * 2. Khử đại từ hồi chỉ (Anaphora Resolution: "con này", "nó", "đơn đó").
 * 3. Xử lý câu hỏi tỉnh lược (Elliptical Queries: "giá bao nhiêu?", "ai đang giao?").
 * 4. Xử lý câu hỏi nối tiếp thời gian (Follow-up Date Queries: "thế còn hôm qua?").
 * 5. Prompt làm rõ khi thiếu tham số bắt buộc (Clarification Prompting).
 * 6. Cách ly ngữ cảnh giữa các phiên (Session Isolation).
 */

const { executeActorIntent } = require('../actors');
const { conversationContext, ConversationContextService } = require('./conversationContext.service');

// Giả lập Prisma Client với các mock data phục vụ kiểm thử
const createMockPrisma = () => {
  return {
    product: {
      findMany: async (args) => {
        const kw = (args?.where?.name?.contains || '').toLowerCase();
        const allProducts = [
          { productId: 1, name: 'Card màn hình ASUS TUF Gaming RTX 4070 Super 12GB', sku: 'VGA-RTX4070S-ASUS', price: 18500000, stockQuantity: 8 },
          { productId: 2, name: 'CPU Intel Core i5-13400F Box Chính Hãng', sku: 'CPU-INTEL-I513400F', price: 4690000, stockQuantity: 15 },
          { productId: 3, name: 'Bộ nhớ RAM Corsair Vengeance DDR5 32GB 5600MHz', sku: 'RAM-COR-D5-32G', price: 2950000, stockQuantity: 20 }
        ];
        if (!kw) return allProducts;
        return allProducts.filter(p => p.name.toLowerCase().includes(kw));
      },
      findFirst: async () => null,
      count: async () => 3
    },
    order: {
      findUnique: async (args) => {
        const id = args.where.orderId;
        if (id === 1002 || id === '1002') {
          return {
            orderId: 1002,
            trackingNumber: 'DH-1002',
            deliveryStatus: 'SHIPPING',
            shippingAddress: '123 Nguyễn Thị Minh Khai, Q1, TP.HCM',
            customerName: 'Trần Văn A',
            customerPhone: '0901234567',
            paymentStatus: 'UNPAID',
            totalAmount: 25000000,
            assignedShipper: {
              fullName: 'Nguyễn Văn Giao',
              phone: '0988776655'
            }
          };
        }
        return null;
      },
      findFirst: async (args) => {
        return {
          orderId: 'DH-1002',
          trackingNumber: 'DH-1002',
          status: 'SHIPPING',
          shippingAddress: '123 Nguyễn Thị Minh Khai, Q1, TP.HCM',
          customerName: 'Trần Văn A',
          customerPhone: '0901234567',
          paymentStatus: 'UNPAID',
          totalAmount: 25000000,
          assignedShipper: {
            fullName: 'Nguyễn Văn Giao',
            phone: '0988776655'
          }
        };
      },
      findMany: async () => [],
      count: async () => 1,
      aggregate: async () => ({
        _sum: { totalAmount: 45000000 },
        _count: { orderId: 12 }
      })
    },
    companyBankAccount: {
      findMany: async () => [{ bankCode: 'MB', accountNumber: '99998888', accountHolder: 'AETHERPC CO', isDefaultQr: true }]
    }
  };
};

async function runStage4Tests() {
  console.log('========================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 4: MULTI-TURN CONTEXT & CONVERSATIONAL MEMORY');
  console.log('========================================================================\n');

  const prisma = createMockPrisma();
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
  // TEST CASE 1: Kế thừa thực thể sản phẩm qua câu hỏi tỉnh lược (Elliptical Query)
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Hội thoại nhiều lượt về sản phẩm (Hardware Anaphora) ---');
  const session1 = 'session_test_hardware_01';

  // Lượt 1: Hỏi về RTX 4070
  const turn1 = await executeActorIntent(
    'card rtx 4070 còn hàng không',
    'SALES',
    prisma,
    { id: 101, role: 'SALES', name: 'Salesman A' },
    { sessionId: session1 }
  );

  assert(turn1 && turn1.status === 'SUCCESS', 'Lượt 1: Tra cứu RTX 4070 thành công');
  assert(turn1.extractedParams?.productName?.includes('4070'), 'Lượt 1: Bóc tách đúng productName = RTX 4070');

  // Lượt 2: Hỏi tỉnh lược "giá bao nhiêu?" (Không nhắc lại tên sản phẩm)
  const turn2 = await executeActorIntent(
    'giá bao nhiêu?',
    'SALES',
    prisma,
    { id: 101, role: 'SALES', name: 'Salesman A' },
    { sessionId: session1 }
  );

  assert(turn2 && turn2.status === 'SUCCESS', 'Lượt 2: Xử lý thành công câu hỏi tỉnh lược "giá bao nhiêu?"');
  assert(turn2.extractedParams?.productName?.includes('4070'), 'Lượt 2: Tự động kế thừa productName = RTX 4070 từ Lượt 1');
  assert(turn2.inheritedParams?.productName?.includes('4070'), 'Lượt 2: Ghi nhận nguồn kế thừa inheritedParams.productName');

  // Lượt 3: Hỏi bằng đại từ hồi chỉ "con này còn mấy cái?"
  const turn3 = await executeActorIntent(
    'con này còn mấy chiếc trong kho?',
    'SALES',
    prisma,
    { id: 101, role: 'SALES', name: 'Salesman A' },
    { sessionId: session1 }
  );

  assert(turn3 && turn3.status === 'SUCCESS', 'Lượt 3: Xử lý thành công câu hỏi chứa đại từ hồi chỉ "con này"');
  assert(turn3.extractedParams?.productName?.includes('4070'), 'Lượt 3: Tự động gắn "con này" với RTX 4070');

  // --------------------------------------------------------------------------
  // TEST CASE 2: Kế thừa thực thể đơn hàng qua nhiều lượt (Order & Delivery Context)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Hội thoại nhiều lượt về đơn giao hàng (Order Context) ---');
  const session2 = 'session_test_order_02';

  // Lượt 1: Tra cứu đơn hàng DH-1002
  const orderTurn1 = await executeActorIntent(
    'kiểm tra tiến độ đơn hàng DH-1002',
    'DELIVERY',
    prisma,
    { id: 202, role: 'DELIVERY', name: 'Shipper Tuấn' },
    { sessionId: session2 }
  );

  assert(orderTurn1 && orderTurn1.status === 'SUCCESS', 'Lượt 1: Tra cứu đơn hàng DH-1002 thành công');
  assert(String(orderTurn1.extractedParams?.orderId).includes('1002'), 'Lượt 1: Bóc tách chính xác orderId chứa 1002');

  // Lượt 2: Hỏi shipper "ai đang đi giao đơn này?"
  const orderTurn2 = await executeActorIntent(
    'ai đang đi giao đơn này?',
    'DELIVERY',
    prisma,
    { id: 202, role: 'DELIVERY', name: 'Shipper Tuấn' },
    { sessionId: session2 }
  );

  assert(orderTurn2 && orderTurn2.status === 'SUCCESS', 'Lượt 2: Tra cứu shipper giao đơn thành công');
  assert(String(orderTurn2.extractedParams?.orderId).includes('1002'), 'Lượt 2: Kế thừa orderId chứa 1002 cho câu hỏi "ai đang giao"');

  // Lượt 3: Hỏi tiền thanh toán "khách đã trả tiền chưa?"
  const orderTurn3 = await executeActorIntent(
    'khách đã trả tiền chưa?',
    'DELIVERY',
    prisma,
    { id: 202, role: 'DELIVERY', name: 'Shipper Tuấn' },
    { sessionId: session2 }
  );

  assert(orderTurn3 && orderTurn3.status === 'SUCCESS', 'Lượt 3: Tra cứu thanh toán đơn hàng thành công');
  assert(String(orderTurn3.extractedParams?.orderId).includes('1002'), 'Lượt 3: Kế thừa orderId chứa 1002 cho câu hỏi "khách đã trả tiền chưa"');

  // --------------------------------------------------------------------------
  // TEST CASE 3: Hỏi tiếp nối theo thời gian (Follow-up Date Continuity)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Tiếp nối thời gian (Follow-up Date Continuity) ---');
  const session3 = 'session_test_date_03';

  // Lượt 1: Hỏi doanh thu hôm nay
  const dateTurn1 = await executeActorIntent(
    'doanh thu thực tế hôm nay thế nào',
    'ACCOUNTANT',
    prisma,
    { id: 303, role: 'ACCOUNTANT', name: 'Kế toán Mai' },
    { sessionId: session3 }
  );

  assert(dateTurn1 && dateTurn1.status === 'SUCCESS', 'Lượt 1: Báo cáo doanh thu hôm nay thành công');

  // Lượt 2: Hỏi nối tiếp "thế còn hôm qua?"
  const dateTurn2 = await executeActorIntent(
    'thế còn hôm qua?',
    'ACCOUNTANT',
    prisma,
    { id: 303, role: 'ACCOUNTANT', name: 'Kế toán Mai' },
    { sessionId: session3 }
  );

  assert(dateTurn2 && dateTurn2.status === 'SUCCESS', 'Lượt 2: Nhận diện câu hỏi nối tiếp "thế còn hôm qua?"');
  assert(dateTurn2.matchSource === 'CONTEXT_FOLLOW_UP', 'Lượt 2: Nguồn khớp là CONTEXT_FOLLOW_UP');

  // --------------------------------------------------------------------------
  // TEST CASE 4: Prompt làm rõ khi thiếu tham số bắt buộc (Clarification Prompting)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Yêu cầu làm rõ khi thiếu tham số bắt buộc ---');
  const freshSession = 'session_fresh_unknown_99';

  // Người dùng mới vào phiên hỏi cộc lốc "giá bao nhiêu?" mà không có ngữ cảnh trước đó
  const clarifyTurn = await executeActorIntent(
    'giá bao nhiêu?',
    'SALES',
    prisma,
    { id: 404, role: 'SALES', name: 'Salesman B' },
    { sessionId: freshSession }
  );

  assert(clarifyTurn && clarifyTurn.status === 'CLARIFICATION_REQUIRED', 'Hỏi cộc lốc không context -> Trả về CLARIFICATION_REQUIRED');
  assert(clarifyTurn.missingParam === 'productName', 'Xác định đúng tham số còn thiếu: productName');
  assert(clarifyTurn.text && clarifyTurn.text.includes('Bạn muốn tra cứu giá hoặc tồn kho'), 'Lời nhắc làm rõ lịch sự, hướng dẫn nhập sản phẩm mẫu');

  // --------------------------------------------------------------------------
  // TEST CASE 5: Cách ly ngữ cảnh giữa các phiên (Session Isolation)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Đảm bảo cách ly ngữ cảnh độc lập giữa 2 Session ---');
  const sessionAlpha = 'session_alpha';
  const sessionBeta = 'session_beta';

  // Session Alpha hỏi về RTX 4070
  await executeActorIntent('kiểm tra giá card rtx 4070', 'SALES', prisma, { id: 1 }, { sessionId: sessionAlpha });

  // Session Beta hỏi về CPU i5 13400
  await executeActorIntent('kiểm tra giá cpu intel i5 13400', 'SALES', prisma, { id: 2 }, { sessionId: sessionBeta });

  // Session Alpha hỏi tiếp "con này còn hàng không?"
  const checkAlpha = await executeActorIntent('con này còn hàng không?', 'SALES', prisma, { id: 1 }, { sessionId: sessionAlpha });

  // Session Beta hỏi tiếp "nó còn hàng không?"
  const checkBeta = await executeActorIntent('nó còn hàng không?', 'SALES', prisma, { id: 2 }, { sessionId: sessionBeta });

  assert(checkAlpha.extractedParams?.productName?.includes('4070'), 'Session Alpha kế thừa độc lập RTX 4070');
  assert(checkBeta.extractedParams?.productName?.includes('13400'), 'Session Beta kế thừa độc lập i5 13400');

  // --------------------------------------------------------------------------
  // TỔNG KẾT
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`📊 TỔNG KẾT GIAI ĐOẠN 4: ĐẠT ${passedTests}/${totalTests} KIỂM THỬ (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 TẤT CẢ KIỂM THỬ GIAI ĐOẠN 4 ĐÃ VƯỢT QUA XUẤT SẮC! HỆ THỐNG ĐÃ CÓ TRÍ NHỚ ĐA LƯỢT!');
    process.exit(0);
  } else {
    console.error('⚠️ Có kiểm thử thất bại trong Giai đoạn 4.');
    process.exit(1);
  }
}

runStage4Tests().catch(err => {
  console.error('Lỗi thực thi kiểm thử Stage 4:', err);
  process.exit(1);
});
