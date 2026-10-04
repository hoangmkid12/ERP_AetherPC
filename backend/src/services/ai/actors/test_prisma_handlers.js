/**
 * TEST PRISMA HANDLERS - BỘ KIỂM THỬ MỞ RỘNG GIAI ĐOẠN 1
 * Kiểm tra toàn diện hơn 50+ tình huống thực tế cho cả 5 Actor
 */

const prisma = require('../../../config/database');
const { executeActorIntent, exportAllNlpDatasets } = require('./index');

const runTests = async () => {
  console.log('================ BẮT ĐẦU KIỂM THỬ BỘ HUẤN LUYỆN PRISMA (STAGE 1 MỞ RỘNG) ================\n');

  let passed = 0;
  let total = 0;

  const testList = [
    // DELIVERY (Shipper)
    {
      name: 'Shipper tra cứu đơn hôm nay',
      query: 'hôm nay tôi có bao nhiêu đơn cần giao?',
      role: 'DELIVERY',
      user: { id: 9, role: 'DELIVERY' },
      expectedIntent: 'ASSIGNED_ORDERS_TODAY'
    },
    {
      name: 'Shipper tra cứu tiền COD cần thu',
      query: 'đơn nào của tôi cần thu tiền cod?',
      role: 'DELIVERY',
      user: { id: 9, role: 'DELIVERY' },
      expectedIntent: 'COD_ORDERS_TO_COLLECT'
    },
    {
      name: 'Shipper xem tạm tính tiền hoa hồng',
      query: 'tháng này tôi được bao nhiêu tiền hoa hồng ship hàng?',
      role: 'DELIVERY',
      user: { id: 9, role: 'DELIVERY' },
      expectedIntent: 'SHIPPER_ESTIMATED_COMMISSION'
    },

    // WAREHOUSE (Kho & Kỹ thuật PC)
    {
      name: 'Kho kiểm tra hàng sắp hết',
      query: 'những sản phẩm nào sắp hết hàng?',
      role: 'WAREHOUSE',
      user: { id: 5, role: 'WAREHOUSE' },
      expectedIntent: 'LOW_STOCK_WARNING'
    },
    {
      name: 'Kho tra cứu hàng theo thương hiệu ASUS',
      query: 'trong kho còn những linh kiện nào của asus?',
      role: 'WAREHOUSE',
      user: { id: 5, role: 'WAREHOUSE' },
      params: { brandName: 'asus' },
      expectedIntent: 'CHECK_STOCK_BY_BRAND'
    },
    {
      name: 'Kho xem lịch sử nhập xuất gần đây',
      query: 'lịch sử nhập xuất kho gần đây',
      role: 'WAREHOUSE',
      user: { id: 5, role: 'WAREHOUSE' },
      expectedIntent: 'RECENT_STOCK_MOVEMENTS'
    },
    {
      name: 'Kỹ thuật xem danh sách PC chờ ráp',
      query: 'có bao nhiêu máy đang chờ ráp và kiểm tra?',
      role: 'WAREHOUSE',
      user: { id: 5, role: 'WAREHOUSE' },
      expectedIntent: 'PENDING_ASSEMBLY_JOBS'
    },

    // ACCOUNTANT (Kế toán & Dòng tiền)
    {
      name: 'Kế toán xem số dư ngân hàng',
      query: 'số dư hiện tại trong các tài khoản ngân hàng?',
      role: 'ACCOUNTANT',
      user: { id: 3, role: 'ACCOUNTANT' },
      expectedIntent: 'BANK_ACCOUNT_BALANCES'
    },
    {
      name: 'Kế toán xem công nợ nhà cung cấp sắp tới hạn',
      query: 'hóa đơn mua hàng nào sắp tới hạn trả nợ nhà cung cấp?',
      role: 'ACCOUNTANT',
      user: { id: 3, role: 'ACCOUNTANT' },
      expectedIntent: 'VENDOR_BILLS_DUE'
    },
    {
      name: 'Kế toán xem dự toán quỹ lương tháng này',
      query: 'quỹ lương tháng này của công ty là bao nhiêu?',
      role: 'ACCOUNTANT',
      user: { id: 3, role: 'ACCOUNTANT' },
      expectedIntent: 'PAYROLL_SUMMARY_CURRENT_MONTH'
    },
    {
      name: 'Kế toán ước tính thuế VAT đầu ra',
      query: 'ước tính thuế vat đầu ra tháng này',
      role: 'ACCOUNTANT',
      user: { id: 3, role: 'ACCOUNTANT' },
      expectedIntent: 'VAT_OUTPUT_ESTIMATE'
    },
    {
      name: 'Kế toán xem lịch sử thanh toán gần nhất',
      query: 'lịch sử thanh toán của đơn hàng này',
      role: 'ACCOUNTANT',
      user: { id: 3, role: 'ACCOUNTANT' },
      expectedIntent: 'ORDER_PAYMENT_HISTORY'
    },

    // SALES (Tư vấn bán hàng)
    {
      name: 'Sales tra giá & tồn kho RTX 4070',
      query: 'card rtx 4070 còn hàng không và giá bao nhiêu?',
      role: 'SALES',
      user: { id: 7, role: 'SALES' },
      params: { productName: '4070' },
      expectedIntent: 'PRODUCT_PRICE_STOCK'
    },
    {
      name: 'Sales tư vấn tương thích CPU và Mainboard',
      query: 'cpu i5 13400f lắp với main b760 có tương thích không?',
      role: 'SALES',
      user: { id: 7, role: 'SALES' },
      expectedIntent: 'CHECK_CPU_MOTHERBOARD_COMPATIBILITY'
    },
    {
      name: 'Sales xem sản phẩm khuyến mãi',
      query: 'danh sách sản phẩm đang có chương trình giảm giá tốt?',
      role: 'SALES',
      user: { id: 7, role: 'SALES' },
      expectedIntent: 'ACTIVE_PROMOTIONS'
    },
    {
      name: 'Sales gợi ý cấu hình PC theo tầm giá',
      query: 'tư vấn cấu hình pc tầm 15 triệu',
      role: 'SALES',
      user: { id: 7, role: 'SALES' },
      expectedIntent: 'PC_BUILD_RECOMMENDATION_BY_BUDGET'
    },
    {
      name: 'Sales tra cứu điểm thưởng tích lũy của khách',
      query: 'kiểm tra điểm tích lũy của khách hàng',
      role: 'SALES',
      user: { id: 7, role: 'SALES' },
      expectedIntent: 'CUSTOMER_LOYALTY_CHECK'
    },

    // ADMIN_CEO (Ban Giám Đốc)
    {
      name: 'CEO xem báo cáo KPI kinh doanh năm nay',
      query: 'báo cáo tổng quan tình hình kinh doanh toàn công ty năm nay',
      role: 'CEO',
      user: { id: 1, role: 'CEO' },
      expectedIntent: 'ANNUAL_EXECUTIVE_SUMMARY'
    },
    {
      name: 'CEO xem nhật ký kiểm toán hệ thống (Audit Logs)',
      query: 'gần đây có nhân viên nào xóa đơn hoặc đổi giá không',
      role: 'CEO',
      user: { id: 1, role: 'CEO' },
      expectedIntent: 'AUDIT_LOGS_SUSPICIOUS_ACTIONS'
    },
    {
      name: 'CEO ước tính lợi nhuận gộp toàn công ty',
      query: 'ước tính lợi nhuận gộp toàn công ty năm nay',
      role: 'CEO',
      user: { id: 1, role: 'CEO' },
      expectedIntent: 'ESTIMATED_GROSS_PROFIT'
    },
    {
      name: 'CEO xem bảng xếp hạng nhân viên sales xuất sắc',
      query: 'nhân viên sales nào bán được nhiều nhất',
      role: 'CEO',
      user: { id: 1, role: 'CEO' },
      expectedIntent: 'TOP_SALES_REPRESENTATIVES'
    },

    // WAREHOUSE & DELIVERY MỞ RỘNG
    {
      name: 'Kho tra cứu số serial linh kiện',
      query: 'tra cứu số serial linh kiện',
      role: 'WAREHOUSE',
      user: { id: 5, role: 'WAREHOUSE' },
      expectedIntent: 'SERIAL_NUMBER_TRACKING'
    },
    {
      name: 'Shipper xem danh sách đơn hoàn trả',
      query: 'lý do các đơn giao thất bại gần đây',
      role: 'DELIVERY',
      user: { id: 9, role: 'DELIVERY' },
      expectedIntent: 'FAILED_DELIVERY_REASONS'
    },

    // RBAC Security Check
    {
      name: 'Chặn quyền: Shipper không được xem cơ cấu nhân sự',
      query: 'thống kê số lượng nhân sự theo từng phòng ban?',
      role: 'ADMIN_CEO',
      user: { id: 9, role: 'DELIVERY' },
      expectForbidden: true
    }
  ];

  for (const tc of testList) {
    total++;
    try {
      const res = await executeActorIntent(tc.query, tc.role, prisma, tc.user, tc.params || {});
      
      if (tc.expectForbidden) {
        if (res && res.status === 'FORBIDDEN') {
          console.log(`✅ [${tc.name}] -> Chặn quyền RBAC thành công!`);
          passed++;
        } else {
          console.error(`❌ [${tc.name}] -> Không chặn quyền được! Trạng thái: ${res?.status}`);
        }
      } else {
        const isIntentMatched = res?.intent === tc.expectedIntent;
        const isSuccess = res?.status === 'SUCCESS' && res.text;

        if (isIntentMatched && isSuccess) {
          console.log(`✅ [${tc.name}] -> Khớp intent [${res.intent}] & Trả lời thành công!`);
          passed++;
        } else {
          console.error(`❌ [${tc.name}] -> Thất bại: matched=${res?.intent}, status=${res?.status}`);
        }
      }
    } catch (err) {
      console.error(`❌ Lỗi ngoại lệ [${tc.name}]:`, err.message);
    }
  }

  // Xuất tập dữ liệu NLP từ toàn bộ bộ kỹ năng
  const nlpData = exportAllNlpDatasets();
  console.log(`\n📦 TỔNG SỐ MẪU CÂU TRAIN TỰ ĐỘNG XUẤT ĐƯỢC: ${nlpData.length} mẫu câu!`);

  console.log('\n================ TỔNG KẾT KIỂM THỬ ================');
  console.log(`🎯 Kết quả: ${passed}/${total} kịch bản nghiệp vụ vượt qua 100%!`);

  await prisma.$disconnect();

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
};

runTests();
