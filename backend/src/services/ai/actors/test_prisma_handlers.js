/**
 * TEST PRISMA HANDLERS - KIỂM THỬ TOÀN DIỆN GIAI ĐOẠN 1
 * Kiểm tra các tính năng cốt lõi:
 * 1. Khớp ý định & thực thi hàm truy vấn Prisma ORM
 * 2. Điền kết quả vào Template tiếng Việt
 * 3. Kiểm soát phân quyền RBAC (Role-Based Access Control)
 * 4. Phát hiện thiếu tham số bắt buộc (Required Params Check)
 */

const prisma = require('../../../config/database');
const { executeActorIntent, normalizeActorRole } = require('./index');

const runTests = async () => {
  console.log('================ BẮT ĐẦU KIỂM THỬ PRISMA HANDLERS (STAGE 1) ================\n');

  let passed = 0;
  let total = 0;

  // Test 1: Shipper tra cứu đơn hôm nay (DELIVERY)
  total++;
  console.log(`[Test 1] Shipper tra cứu đơn giao hôm nay:`);
  try {
    const res = await executeActorIntent(
      'hôm nay tôi có bao nhiêu đơn cần giao?',
      'DELIVERY',
      prisma,
      { id: 9, role: 'DELIVERY', fullName: 'Shipper Demo' }
    );
    console.log(`-> Trạng thái: ${res?.status} | Intent: ${res?.intent}`);
    console.log(`-> Câu trả lời mẫu:\n${res?.text}\n`);
    if (res && res.status === 'SUCCESS' && res.text) passed++;
  } catch (err) {
    console.error('❌ Lỗi Test 1:', err);
  }

  // Test 2: Kho kiểm tra linh kiện sắp hết hàng (WAREHOUSE)
  total++;
  console.log(`[Test 2] Thủ kho kiểm tra linh kiện tồn kho thấp:`);
  try {
    const res = await executeActorIntent(
      'những sản phẩm nào sắp hết hàng?',
      'WAREHOUSE',
      prisma,
      { id: 5, role: 'WAREHOUSE', fullName: 'Thủ kho Aether' }
    );
    console.log(`-> Trạng thái: ${res?.status} | Intent: ${res?.intent}`);
    console.log(`-> Câu trả lời mẫu:\n${res?.text}\n`);
    if (res && res.status === 'SUCCESS' && res.text) passed++;
  } catch (err) {
    console.error('❌ Lỗi Test 2:', err);
  }

  // Test 3: Kế toán kiểm tra số dư ngân hàng (ACCOUNTANT)
  total++;
  console.log(`[Test 3] Kế toán xem số dư tài khoản ngân hàng:`);
  try {
    const res = await executeActorIntent(
      'số dư hiện tại trong các tài khoản ngân hàng?',
      'ACCOUNTANT',
      prisma,
      { id: 3, role: 'ACCOUNTANT', fullName: 'Kế toán trưởng' }
    );
    console.log(`-> Trạng thái: ${res?.status} | Intent: ${res?.intent}`);
    console.log(`-> Câu trả lời mẫu:\n${res?.text}\n`);
    if (res && res.status === 'SUCCESS' && res.text) passed++;
  } catch (err) {
    console.error('❌ Lỗi Test 3:', err);
  }

  // Test 4: Bán hàng tra giá RTX 4070 (SALES)
  total++;
  console.log(`[Test 4] Nhân viên Sales tra cứu giá card RTX 4070:`);
  try {
    const res = await executeActorIntent(
      'card rtx 4070 còn hàng không và giá bao nhiêu?',
      'SALES',
      prisma,
      { id: 7, role: 'SALES', fullName: 'Tư vấn viên Nam' },
      { productName: '4070' }
    );
    console.log(`-> Trạng thái: ${res?.status} | Intent: ${res?.intent}`);
    console.log(`-> Câu trả lời mẫu:\n${res?.text}\n`);
    if (res && res.status === 'SUCCESS' && res.text) passed++;
  } catch (err) {
    console.error('❌ Lỗi Test 4:', err);
  }

  // Test 5: Ban giám đốc xem báo cáo doanh thu năm nay (ADMIN_CEO)
  total++;
  console.log(`[Test 5] CEO xem báo cáo tổng quan kinh doanh năm nay:`);
  try {
    const res = await executeActorIntent(
      'báo cáo tổng quan tình hình kinh doanh toàn công ty năm nay',
      'CEO',
      prisma,
      { id: 1, role: 'CEO', fullName: 'Tổng Giám Đốc' }
    );
    console.log(`-> Trạng thái: ${res?.status} | Intent: ${res?.intent}`);
    console.log(`-> Câu trả lời mẫu:\n${res?.text}\n`);
    if (res && res.status === 'SUCCESS' && res.text) passed++;
  } catch (err) {
    console.error('❌ Lỗi Test 5:', err);
  }

  // Test 6: Kiểm tra kiểm soát phân quyền RBAC (Shipper cố tình hỏi nhân sự của CEO)
  total++;
  console.log(`[Test 6] Kiểm tra RBAC: Shipper cố tình hỏi danh sách cơ cấu nhân sự:`);
  try {
    const res = await executeActorIntent(
      'thống kê số lượng nhân sự theo từng phòng ban?',
      'ADMIN_CEO',
      prisma,
      { id: 9, role: 'DELIVERY', fullName: 'Shipper Demo' }
    );
    console.log(`-> Trạng thái phản hồi: ${res?.status} (Kỳ vọng: FORBIDDEN)`);
    console.log(`-> Thông điệp chặn quyền: "${res?.message}"\n`);
    if (res && res.status === 'FORBIDDEN') passed++;
  } catch (err) {
    console.error('❌ Lỗi Test 6:', err);
  }

  // Test 7: Tra cứu văn bản quy chế SOP
  total++;
  console.log(`[Test 7] Tra cứu quy định chụp ảnh bằng chứng giao hàng (POD):`);
  try {
    const res = await executeActorIntent(
      'quy định chụp ảnh pod như thế nào',
      'DELIVERY',
      prisma,
      { id: 9, role: 'DELIVERY', fullName: 'Shipper Demo' }
    );
    console.log(`-> Trạng thái: ${res?.status} | Loại: ${res?.type}`);
    console.log(`-> Tiêu đề SOP: ${res?.title}`);
    console.log(`-> Nội dung SOP:\n${res?.text}\n`);
    if (res && res.status === 'SUCCESS' && res.type === 'KNOWLEDGE_SOP') passed++;
  } catch (err) {
    console.error('❌ Lỗi Test 7:', err);
  }

  console.log('================ KẾT QUẢ KIỂM THỬ GIAI ĐOẠN 1 ================');
  console.log(`🎯 Vượt qua: ${passed}/${total} bài kiểm tra (${((passed / total) * 100).toFixed(0)}%)!`);

  await prisma.$disconnect();

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
};

runTests();
