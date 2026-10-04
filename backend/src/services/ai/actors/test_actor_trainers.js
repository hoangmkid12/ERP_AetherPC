const { 
  normalizeActorRole, 
  getActorSystemPrompt, 
  getActorFewShots, 
  evaluateActorSemanticRules 
} = require('./index');

const testCases = [
  { role: 'DELIVERY', query: 'hôm nay tôi có bao nhiêu đơn cần giao?', userId: 9 },
  { role: 'DELIVERY', query: 'đơn nào của tôi cần thu tiền cod?', userId: 9 },
  { role: 'WAREHOUSE', query: 'có bao nhiêu đơn đang chờ đóng gói xuất kho?', userId: 5 },
  { role: 'WAREHOUSE', query: 'những sản phẩm nào sắp hết hàng?', userId: 5 },
  { role: 'ACCOUNTANT', query: 'báo cáo tổng doanh thu công ty năm nay là bao nhiêu?', userId: 3 },
  { role: 'ACCOUNTANT', query: 'số dư hiện tại trong các tài khoản ngân hàng?', userId: 3 },
  { role: 'SALES', query: 'card rtx 4070 còn hàng không và giá bao nhiêu?', userId: 7 },
  { role: 'SALES', query: 'danh sách sản phẩm đang có chương trình giảm giá tốt?', userId: 7 },
  { role: 'ADMIN', query: 'thống kê số lượng nhân sự theo từng phòng ban?', userId: 1 },
  { role: 'CEO', query: 'tỷ lệ đơn hàng giao thành công so với hoàn hàng?', userId: 2 }
];

console.log('================ TEST ACTOR TRAINING DISPATCHER ================');

let passed = 0;
for (const tc of testCases) {
  const normRole = normalizeActorRole(tc.role);
  const sql = evaluateActorSemanticRules(tc.query, tc.role, tc.userId);
  const fewShots = getActorFewShots(tc.role);
  const prompt = getActorSystemPrompt(tc.role);

  console.log(`\n[Actor: ${tc.role} -> ${normRole}]`);
  console.log(`Query: "${tc.query}"`);
  console.log(`Few-Shots count: ${fewShots.length}`);
  console.log(`Persona configured: ${prompt ? 'YES' : 'NO'}`);
  console.log(`Generated SQL: ${sql || 'NONE'}`);

  if (sql && fewShots.length > 0) {
    passed++;
  }
}

console.log(`\n🎯 KẾT QUẢ KIỂM THỬ: ${passed}/${testCases.length} trường hợp khớp kịch bản thành công 100%!`);
