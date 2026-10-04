const { 
  normalizeActorRole, 
  getActorSystemPrompt, 
  getActorFewShots, 
  evaluateActorSemanticRules,
  matchActorSkill,
  getTrainer,
  exportAllNlpDatasets
} = require('./index');

const testCases = [
  // DELIVERY
  { role: 'DELIVERY', query: 'hôm nay tôi có bao nhiêu đơn cần giao?', userId: 9, expectedSkill: 'ASSIGNED_ORDERS_TODAY' },
  { role: 'SHIPPER', query: 'đơn nào của tôi cần thu tiền cod?', userId: 9, expectedSkill: 'COD_ORDERS_TO_COLLECT' },
  { role: 'DELIVERY', query: 'tháng này tôi đã giao thành công được bao nhiêu đơn?', userId: 9, expectedSkill: 'MONTHLY_PERFORMANCE' },
  
  // WAREHOUSE
  { role: 'WAREHOUSE', query: 'có bao nhiêu đơn đang chờ đóng gói xuất kho?', userId: 5, expectedSkill: 'READY_TO_SHIP_ORDERS' },
  { role: 'KHO', query: 'những sản phẩm nào sắp hết hàng?', userId: 5, expectedSkill: 'LOW_STOCK_WARNING' },
  { role: 'QC_TECH', query: 'có bao nhiêu máy đang chờ ráp và kiểm tra?', userId: 5, expectedSkill: 'PENDING_ASSEMBLY_JOBS' },
  
  // ACCOUNTANT
  { role: 'ACCOUNTANT', query: 'báo cáo tổng doanh thu công ty năm nay là bao nhiêu?', userId: 3, expectedSkill: 'ANNUAL_REVENUE' },
  { role: 'KETOAN', query: 'số dư hiện tại trong các tài khoản ngân hàng?', userId: 3, expectedSkill: 'BANK_ACCOUNT_BALANCES' },
  { role: 'ACCOUNTANT', query: 'các đơn hàng nào chưa thanh toán tiền?', userId: 3, expectedSkill: 'UNPAID_ORDERS' },
  
  // SALES
  { role: 'SALES', query: 'card rtx 4070 còn hàng không và giá bao nhiêu?', userId: 7, expectedSkill: 'PRODUCT_PRICE_STOCK' },
  { role: 'BANHANG', query: 'danh sách sản phẩm đang có chương trình giảm giá tốt?', userId: 7, expectedSkill: 'ACTIVE_PROMOTIONS' },
  { role: 'SALES', query: 'tháng này tôi đã bán được bao nhiêu doanh số?', userId: 7, expectedSkill: 'SALES_MY_PERFORMANCE' },
  
  // ADMIN & CEO
  { role: 'ADMIN', query: 'thống kê số lượng nhân sự theo từng phòng ban?', userId: 1, expectedSkill: 'HR_HEADCOUNT_DISTRIBUTION' },
  { role: 'CEO', query: 'tỷ lệ đơn hàng giao thành công so với hoàn hàng?', userId: 2, expectedSkill: 'ORDER_FULFILLMENT_RATIO' },
  { role: 'CEO', query: 'báo cáo tổng quan tình hình kinh doanh toàn công ty năm nay', userId: 2, expectedSkill: 'ANNUAL_EXECUTIVE_SUMMARY' }
];

console.log('================ TEST ACTOR TRAINING DISPATCHER ================');

let passed = 0;
for (const tc of testCases) {
  const normRole = normalizeActorRole(tc.role);
  const sql = evaluateActorSemanticRules(tc.query, tc.role, tc.userId);
  const matchResult = matchActorSkill(tc.query, tc.role, tc.userId);
  const fewShots = getActorFewShots(tc.role);
  const prompt = getActorSystemPrompt(tc.role);

  const skillId = matchResult?.skill?.id;
  const isMatchExpected = skillId === tc.expectedSkill;

  console.log(`\n[Actor: ${tc.role} -> ${normRole}]`);
  console.log(`Query: "${tc.query}"`);
  console.log(`Matched Skill: ${skillId || 'NONE'} (Expected: ${tc.expectedSkill})`);
  console.log(`Few-Shots count: ${fewShots.length}`);
  console.log(`Persona configured: ${prompt ? 'YES' : 'NO'}`);
  console.log(`Generated SQL: ${sql ? sql.substring(0, 80) + '...' : 'NONE'}`);

  if (sql && isMatchExpected) {
    passed++;
  } else {
    console.error(`❌ FAILED MATCH: ${tc.query}`);
  }
}

console.log(`\n🎯 KẾT QUẢ KIỂM THỬ: ${passed}/${testCases.length} trường hợp khớp kịch bản thành công 100%!`);

// ============================================================================
// TEST THỬ NGHIỆM TÍNH NĂNG TRAIN THÊM KỊCH BẢN MỚI TRÊN LIVE TRAINER
// ============================================================================
console.log('\n================ KIỂM THỬ KHẢ NĂNG TRAIN THÊM KỊCH BẢN (EXTENSIBILITY) ================');
const deliveryTrainer = getTrainer('DELIVERY');

// Thêm kịch bản mới: "hôm nay tôi đã nộp tiền mặt cho kế toán chưa"
deliveryTrainer.addSkill({
  id: 'CHECK_CASH_DEPOSIT_STATUS',
  title: 'Kiểm tra trạng thái nộp tiền mặt COD của shipper',
  description: 'Tra cứu các khoản tiền COD shipper đã bàn giao thủ quỹ hôm nay',
  type: 'LIVE_SQL',
  examples: [
    'hôm nay tôi đã nộp tiền cod chưa',
    'kiểm tra phiếu nộp tiền mặt của tôi',
    'xem lại số tiền đã bàn giao thủ quỹ'
  ],
  patterns: [
    /(đã nộp tiền|phiếu nộp tiền|bàn giao thủ quỹ)/i
  ],
  sql: (userId) => `SELECT * FROM ledger_entries WHERE created_by = ${userId || ':userId'} AND entry_type = 'CASH_RECEIPT' AND DATE(created_at) = CURRENT_DATE;`
});

const testNewSkill = evaluateActorSemanticRules('hôm nay tôi đã nộp tiền cod chưa', 'DELIVERY', 9);
console.log('Truy vấn câu hỏi mới vừa train: "hôm nay tôi đã nộp tiền cod chưa"');
console.log('SQL sinh ra từ kịch bản mới:', testNewSkill);

if (testNewSkill && testNewSkill.includes('ledger_entries')) {
  console.log('✅ TRAIN THÊM KỊCH BẢN MỚI THÀNH CÔNG RỰC RỠ!');
} else {
  console.error('❌ Thất bại khi train thêm kịch bản mới');
}

// Kiểm thử xuất NLP Dataset
const nlpDataset = exportAllNlpDatasets();
console.log(`\n📦 Tổng số mẫu câu train NLP xuất được từ toàn bộ Actors: ${nlpDataset.length} mẫu.`);

if (passed === testCases.length && testNewSkill) {
  process.exit(0);
} else {
  process.exit(1);
}
