/**
 * ACCOUNTANT TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO PHÒNG KẾ TOÁN & THU NGÂN
 * Thiết kế chuẩn hóa theo Giai đoạn 1: Intent Catalog + Parameterized Prisma Handlers
 */

const BaseActorTrainer = require('./BaseActorTrainer');
const { getStartOfDay, getStartOfMonth, getStartOfLastMonth, getEndOfLastMonth, getStartOfYear, formatVND, formatDateVN } = require('../utils/dateHelper');

const accountantTrainer = new BaseActorTrainer({
  role: 'ACCOUNTANT',
  name: 'Phòng Kế toán & Dòng tiền',
  systemPrompt: `BẠN LÀ TRỢ LÝ TÀI CHÍNH & KẾ TOÁN TRƯỞNG ẢO CHO PHÒNG KẾ TOÁN AETHERPC:
- PHONG CÁCH: Chuyên nghiệp, nghiêm cẩn, số liệu chuẩn xác từng đồng (VNĐ), minh bạch dòng tiền.
- THÔNG TIN ƯU TIÊN:
  1. Doanh thu thực tế (đã trừ đơn hủy, chỉ tính đơn DELIVERED và COMPLETED).
  2. Dòng tiền thực tế: Tiền vào tài khoản VietQR, tiền mặt COD shipper đã nộp.
  3. Đối soát nợ COD treo của nhân viên giao hàng.
  4. Số dư các tài khoản thanh toán thụ hưởng công ty.
- BẢO MẬT: Tuyệt đối tuân thủ phân nhiệm SoD, không tiết lộ mật khẩu giao dịch ngân hàng.`
});

// ============================================================================
// 1. NHÓM KỸ NĂNG TRUY VẤN DỮ LIỆU PRISMA (TYPE-SAFE HANDLERS)
// ============================================================================

// Kỹ năng 1: Doanh thu năm nay
accountantTrainer.addSkill({
  id: 'ANNUAL_REVENUE',
  title: 'Báo cáo tổng doanh thu công ty năm nay',
  description: 'Tổng doanh thu thực thu lũy kế từ đầu năm đến thời điểm hiện tại',
  type: 'PRISMA_QUERY',
  examples: [
    'báo cáo tổng doanh thu công ty năm nay là bao nhiêu?',
    'báo cáo tổng doanh thu công ty năm nay là bao nhiêu',
    'doanh thu năm nay của công ty',
    'tổng thu cả năm 2026',
    'cho tôi biết doanh thu năm nay',
    'doanh thu năm nay',
    'tổng kết dòng tiền bán hàng năm nay',
    'doanh số lũy kế từ đầu năm đến nay'
  ],
  patterns: [
    /(doanh thu|thực thu|tiền thu).*(năm nay|cả năm|năm 2026|lũy kế)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const res = await prisma.order.aggregate({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        createdAt: { gte: getStartOfYear() }
      },
      _sum: { totalAmount: true },
      _count: { orderId: true }
    });
    return {
      revenue: Number(res._sum.totalAmount || 0),
      orderCount: res._count.orderId || 0
    };
  },
  template: (data) => {
    return `💰 **BÁO CÁO DOANH THU TOÀN CÔNG TY LŨY KẾ NĂM NAY:**\n\n` +
           `- 📈 Tổng doanh thu thực thu: **${formatVND(data.revenue)}**\n` +
           `- 📦 Tổng số đơn hoàn tất: **${data.orderCount} đơn hàng**\n` +
           `- 📊 Giá trị trung bình/đơn: **${data.orderCount ? formatVND(data.revenue / data.orderCount) : '0 ₫'}**`;
  },
  sql: () => `SELECT SUM(total_amount) AS doanh_thu_nam_nay, COUNT(order_id) AS tong_so_don FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`
});

// Kỹ năng 2: Doanh thu hôm nay
accountantTrainer.addSkill({
  id: 'TODAY_REVENUE',
  title: 'Báo cáo doanh thu thực tế hôm nay',
  description: 'Tính tổng doanh thu bán hàng thực thu trong ngày',
  type: 'PRISMA_QUERY',
  examples: [
    'doanh thu thực tế hôm nay của công ty là bao nhiêu',
    'hôm nay thu được bao nhiêu tiền',
    'báo cáo doanh thu ngày hôm nay',
    'doanh thu hôm nay',
    'bữa nay bán được bao nhiêu tiền',
    'tổng kết thu tiền hôm nay'
  ],
  patterns: [
    /(doanh thu|thực thu|tiền thu).*(hôm nay|trong ngày|bữa nay)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const res = await prisma.order.aggregate({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        createdAt: { gte: getStartOfDay() }
      },
      _sum: { totalAmount: true },
      _count: { orderId: true }
    });
    return {
      revenueToday: Number(res._sum.totalAmount || 0),
      orderCountToday: res._count.orderId || 0
    };
  },
  template: (data) => {
    return `💵 **DOANH THU THỰC TẾ TRONG NGÀY HÔM NAY:**\n\n` +
           `- Doanh thu ghi nhận: **${formatVND(data.revenueToday)}**\n` +
           `- Số đơn hoàn tất: **${data.orderCountToday} đơn**`;
  },
  sql: () => `SELECT COALESCE(SUM(total_amount), 0) AS doanh_thu_hom_nay, COUNT(order_id) AS so_don_hom_nay FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`
});

// Kỹ năng 3: Doanh thu tháng này
accountantTrainer.addSkill({
  id: 'MONTHLY_REVENUE',
  title: 'Báo cáo doanh thu tháng này',
  description: 'Tổng hợp doanh thu trong tháng hiện tại',
  type: 'PRISMA_QUERY',
  examples: [
    'doanh thu tháng này của công ty',
    'tổng kết doanh thu tháng này',
    'doanh thu theo từng tháng trong năm nay',
    'tháng này bán được bao nhiêu doanh số'
  ],
  patterns: [
    /(doanh thu|thực thu).*(tháng này|từng tháng|mỗi tháng)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const res = await prisma.order.aggregate({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        createdAt: { gte: getStartOfMonth() }
      },
      _sum: { totalAmount: true },
      _count: { orderId: true }
    });
    return {
      monthlyRevenue: Number(res._sum.totalAmount || 0),
      monthlyOrders: res._count.orderId || 0
    };
  },
  template: (data) => {
    return `📊 **DOANH THU THỰC THU THÁNG NÀY:**\n\n` +
           `- Tổng tiền thu: **${formatVND(data.monthlyRevenue)}**\n` +
           `- Số đơn hàng: **${data.monthlyOrders} đơn**`;
  },
  sql: () => `SELECT to_char(created_at, 'YYYY-MM') AS thang, COUNT(order_id) AS so_don, SUM(total_amount) AS doanh_thu FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY thang ORDER BY thang ASC;`
});

// Kỹ năng 4: Số dư tài khoản ngân hàng & VietQR
accountantTrainer.addSkill({
  id: 'BANK_ACCOUNT_BALANCES',
  title: 'Số dư hiện tại trong các tài khoản ngân hàng',
  description: 'Tra cứu số dư thực tế trong tất cả tài khoản ngân hàng MBBank, VCB',
  type: 'PRISMA_QUERY',
  examples: [
    'số dư hiện tại trong các tài khoản ngân hàng?',
    'số dư hiện tại trong các tài khoản ngân hàng của công ty',
    'tài khoản ngân hàng mbbank và vietcombank còn bao nhiêu tiền',
    'tài khoản nào đang bật vietqr tự động',
    'số dư quỹ tiền ngân hàng',
    'tổng số tiền hiện có trong ngân hàng'
  ],
  patterns: [
    /(số dư|tài khoản ngân hàng|mbbank|vietcombank|ngân hàng|quỹ tiền|vietqr.*mặc định)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.companyBankAccount.findMany({
      where: { status: 'ACTIVE' },
      select: {
        bankName: true,
        accountNumber: true,
        accountHolder: true,
        currentBalance: true,
        isDefaultQr: true
      },
      orderBy: { currentBalance: 'desc' }
    });
  },
  template: (accounts) => {
    if (!accounts || accounts.length === 0) {
      return '⚠️ **Chưa cấu hình tài khoản ngân hàng nào trong hệ thống.**';
    }
    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
    let res = `🏦 **SỐ DƯ CÁC TÀI KHOẢN NGÂN HÀNG DOANH NGHIỆP (TỔNG: ${formatVND(totalBalance)}):**\n\n`;
    accounts.forEach((a, idx) => {
      res += `${idx + 1}. **${a.bankName}** (${a.accountNumber}) ${a.isDefaultQr ? '⭐ [Mặc định VietQR]' : ''}\n`;
      res += `   Chủ TK: ${a.accountHolder} | Số dư: **${formatVND(a.currentBalance)}**\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT bank_name, account_number, account_holder, current_balance, is_default_qr FROM company_bank_accounts WHERE status = 'ACTIVE' ORDER BY current_balance DESC;`
});

// Kỹ năng 5: Các đơn hàng chưa thanh toán tiền (Công nợ phải thu)
accountantTrainer.addSkill({
  id: 'UNPAID_ORDERS',
  title: 'Các đơn hàng chưa thanh toán tiền',
  description: 'Danh sách đơn hàng chưa hoàn tất thanh toán hoặc công nợ khách chưa thu',
  type: 'PRISMA_QUERY',
  examples: [
    'các đơn hàng nào chưa thanh toán tiền?',
    'các đơn hàng nào chưa thanh toán tiền',
    'danh sách đơn chưa thanh toán',
    'đơn hàng công nợ chưa thu',
    'những đơn khách chưa trả tiền',
    'danh sách nợ đọng tiền hàng'
  ],
  patterns: [
    /(chưa thanh toán|chưa trả tiền|nợ tiền|công nợ khách|nợ đọng)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.order.findMany({
      where: {
        paymentStatus: { not: 'PAID' },
        status: { notIn: ['CANCELLED', 'RETURNED'] }
      },
      select: {
        orderId: true,
        customerId: true,
        totalAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  },
  template: (orders) => {
    if (!orders || orders.length === 0) {
      return '🎉 **Tuyệt vời! Hiện không có đơn hàng nào bị đọng công nợ chưa thanh toán.**';
    }
    const totalDebt = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    let res = `⏳ **DANH SÁCH ${orders.length} ĐƠN HÀNG CHƯA THANH TOÁN (TỔNG CÔNG NỢ: ${formatVND(totalDebt)}):**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}** - ${formatVND(o.totalAmount)}\n`;
      res += `   Phương thức: ${o.paymentMethod} | Trạng thái TT: \`${o.paymentStatus}\`\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT order_id, customer_id, total_amount, payment_status, payment_method, created_at FROM orders WHERE payment_status != 'PAID' AND status NOT IN ('CANCELLED', 'RETURNED') ORDER BY created_at DESC LIMIT 20;`
});

// Kỹ năng 6: Đối soát COD shipper
accountantTrainer.addSkill({
  id: 'UNRECONCILED_COD_ORDERS',
  title: 'Đối soát các đơn COD chưa nộp tiền',
  description: 'Danh sách đơn hàng đã giao thành công nhưng chưa xác nhận thanh toán COD',
  type: 'PRISMA_QUERY',
  examples: [
    'có đơn hàng cod nào đã giao nhưng chưa nộp tiền về kế toán không',
    'shipper nào chưa nộp tiền cod',
    'danh sách đơn cod còn treo tiền',
    'đối soát nợ tiền cod shipper',
    'tiền cod shipper đang giữ chưa bàn giao'
  ],
  patterns: [
    /(đối soát|nợ cod|treo tiền|chưa nộp tiền|chưa đối soát|chưa bàn giao.*cod)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.order.findMany({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        paymentMethod: 'COD',
        paymentStatus: 'PENDING'
      },
      select: {
        orderId: true,
        totalAmount: true,
        deliveredAt: true,
        assignedShipper: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: { deliveredAt: 'asc' }
    });
  },
  template: (orders) => {
    if (!orders || orders.length === 0) {
      return '✅ **Tất cả các đơn COD đã giao thành công đều đã được đối soát nộp tiền vào quỹ!**';
    }
    const totalCod = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    let res = `⚠️ **CÓ ${orders.length} ĐƠN COD ĐÃ GIAO NHƯNG CHƯA NỘP TIỀN (TREO: ${formatVND(totalCod)}):**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}**: ${formatVND(o.totalAmount)}\n`;
      res += `   Shipper phụ trách: **${o.assignedShipper ? o.assignedShipper.fullName : 'Chưa phân bổ'}**\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT o.order_id, o.total_amount, e.full_name AS ten_shipper, o.delivered_at FROM orders o JOIN employees e ON e.id = o.assigned_shipper_id WHERE o.status IN ('DELIVERED', 'COMPLETED') AND o.payment_method = 'COD' AND o.payment_status = 'PENDING' ORDER BY o.delivered_at ASC;`
});

// Kỹ năng 7: Công nợ phải trả nhà cung cấp sắp tới hạn (Vendor Bills)
accountantTrainer.addSkill({
  id: 'VENDOR_BILLS_DUE',
  title: 'Công nợ phải trả nhà cung cấp sắp tới hạn (Vendor Bills)',
  description: 'Danh sách các hóa đơn mua hàng từ NCC sắp tới hạn thanh toán',
  type: 'PRISMA_QUERY',
  examples: [
    'hóa đơn mua hàng nào sắp tới hạn trả nợ nhà cung cấp?',
    'danh sách công nợ phải trả nhà cung cấp',
    'tiền nợ nhà phân phối sắp tới hạn',
    'các khoản phải trả sắp đến hạn',
    'hóa đơn ncc chưa trả tiền'
  ],
  patterns: [
    /(phải trả nhà cung cấp|công nợ ncc|nợ nhà cung cấp|tới hạn trả nợ|hóa đơn ncc)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.vendorBill.findMany({
      where: {
        status: { in: ['OPEN', 'PARTIAL', 'PENDING'] }
      },
      select: {
        billNumber: true,
        supplierCode: true,
        amountTotal: true,
        amountDue: true,
        dueDate: true,
        status: true
      },
      orderBy: { dueDate: 'asc' },
      take: 10
    });
  },
  template: (bills) => {
    if (!bills || bills.length === 0) {
      return '🎉 **Tuyệt vời! Công ty không còn khoản công nợ tồn đọng nào cần trả nhà cung cấp.**';
    }
    const totalDue = bills.reduce((sum, b) => sum + Number(b.amountDue || b.amountTotal || 0), 0);
    let res = `📋 **DANH SÁCH ${bills.length} HÓA ĐƠN NCC SẮP TỚI HẠN (TỔNG NỢ: ${formatVND(totalDue)}):**\n\n`;
    bills.forEach((b, idx) => {
      res += `${idx + 1}. **Hóa đơn #${b.billNumber}** (NCC: \`${b.supplierCode}\`)\n`;
      res += `   Còn phải trả: **${formatVND(b.amountDue || b.amountTotal)}** | Hạn trả: ${formatDateVN(b.dueDate)}\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 8: Báo cáo quỹ lương dự kiến trong tháng (Payroll Summary)
accountantTrainer.addSkill({
  id: 'PAYROLL_SUMMARY_CURRENT_MONTH',
  title: 'Báo cáo quỹ lương dự kiến trong tháng',
  description: 'Tổng tiền lương thực nhận dự toán cần chi trả cho nhân sự',
  type: 'PRISMA_QUERY',
  examples: [
    'quỹ lương tháng này của công ty là bao nhiêu?',
    'tổng tiền lương phải chi trong tháng',
    'báo cáo bảng lương tháng này',
    'chi phí lương nhân viên',
    'tháng này cần chuẩn bị bao nhiêu tiền trả lương'
  ],
  patterns: [
    /(quỹ lương|bảng lương|chi phí lương|tiền lương.*tháng|trả lương)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const res = await prisma.payroll.aggregate({
      _sum: { netSalary: true },
      _count: { id: true }
    });
    return {
      headcount: res._count.id || 0,
      totalPayroll: Number(res._sum.netSalary || 0)
    };
  },
  template: (data) => {
    return `💼 **DỰ TOÁN QUỸ LƯƠNG NHÂN SỰ TOÀN HỆ THỐNG:**\n\n` +
           `- Số lượng bảng lương tính toán: **${data.headcount} nhân sự**\n` +
           `- 💵 **Tổng quỹ lương thực nhận (Net Salary): ${formatVND(data.totalPayroll)}**\n\n` +
           `Kế toán cần đảm bảo số dư thanh khoản ngân hàng trước ngày 05 hàng tháng để chi lương.`;
  }
});

// Kỹ năng 9: Tỷ trọng phương thức thanh toán
accountantTrainer.addSkill({
  id: 'PAYMENT_METHODS_BREAKDOWN',
  title: 'Tỷ trọng doanh thu theo từng phương thức thanh toán',
  description: 'Phân tích cơ cấu dòng tiền qua VietQR, COD, Tiền mặt, Thẻ',
  type: 'PRISMA_QUERY',
  examples: [
    'tỷ trọng doanh thu theo từng phương thức thanh toán tháng này',
    'khách thanh toán vietqr nhiều hơn hay cod nhiều hơn',
    'tổng tiền thu qua vietqr hôm nay'
  ],
  patterns: [
    /(phương thức thanh toán|vietqr.*cod|hình thức thanh toán)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const res = await prisma.order.groupBy({
      by: ['paymentMethod'],
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        createdAt: { gte: getStartOfMonth() }
      },
      _count: { orderId: true },
      _sum: { totalAmount: true }
    });
    return res.map(r => ({
      method: r.paymentMethod,
      count: r._count.orderId,
      amount: Number(r._sum.totalAmount || 0)
    }));
  },
  template: (breakdown) => {
    if (!breakdown || breakdown.length === 0) {
      return 'Tháng này chưa ghi nhận đơn hàng thành công nào.';
    }
    let res = `💳 **CƠ CẤU PHƯƠNG THỨC THANH TOÁN TRONG THÁNG:**\n\n`;
    breakdown.forEach((b, idx) => {
      res += `${idx + 1}. **${b.method}**: ${formatVND(b.amount)} (${b.count} đơn)\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT payment_method, COUNT(*) AS so_don, SUM(total_amount) AS tong_tien FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') GROUP BY payment_method ORDER BY tong_tien DESC;`
});

// Kỹ năng 10: Ước tính nghĩa vụ thuế VAT đầu ra (10%)
accountantTrainer.addSkill({
  id: 'VAT_OUTPUT_ESTIMATE',
  title: 'Ước tính thuế VAT đầu ra phát sinh từ các đơn hàng hoàn tất',
  description: 'Tính toán nghĩa vụ thuế Giá trị Gia tăng (VAT 10%) dự kiến phải nộp ngân sách',
  type: 'PRISMA_QUERY',
  examples: [
    'ước tính thuế vat đầu ra tháng này',
    'ước tính thuế vat đầu ra năm nay',
    'thuế giá trị gia tăng phải nộp tháng này là bao nhiêu',
    'báo cáo vat đầu ra',
    'tổng tiền thuế vat bán hàng',
    'dự toán nghĩa vụ thuế vat'
  ],
  patterns: [
    /(thuế vat|vat đầu ra|thuế giá trị gia tăng|nghĩa vụ thuế)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params) => {
    const isYear = /(năm|nam)/i.test(params?.period || '');
    const since = isYear ? getStartOfYear() : getStartOfMonth();

    const res = await prisma.order.aggregate({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        createdAt: { gte: since }
      },
      _sum: { totalAmount: true },
      _count: { orderId: true }
    });

    const revenue = Number(res._sum.totalAmount || 0);
    // Giả định thuế VAT 10% tính trên doanh thu bán hàng bao gồm VAT: VAT = DoanhThu / 1.1 * 0.1
    const netRevenue = Math.round(revenue / 1.1);
    const estimatedVat = revenue - netRevenue;

    return {
      period: isYear ? 'năm nay (YTD)' : 'tháng này',
      revenue,
      netRevenue,
      estimatedVat,
      orderCount: res._count.orderId || 0
    };
  },
  template: (data) => {
    return `🏛️ **ƯỚC TÍNH NGHĨA VỤ THUẾ VAT ĐẦU RA (${data.period.toUpperCase()}):**\n\n` +
           `- 📈 Tổng doanh thu bán hàng (đã gồm VAT): **${formatVND(data.revenue)}** (${data.orderCount} đơn)\n` +
           `- 📦 Doanh thu thuần trước thuế (Net): **${formatVND(data.netRevenue)}**\n` +
           `- 🧾 **Thuế GTGT (VAT 10%) ước tính phải nộp: ${formatVND(data.estimatedVat)}**\n\n` +
           `*Lưu ý: Số thuế thực tế được khấu trừ thêm với thuế VAT đầu vào từ các hóa đơn mua hàng (Vendor Bills) hợp lệ.*`;
  }
});

// Kỹ năng 11: Lịch sử thanh toán chi tiết của đơn hàng
accountantTrainer.addSkill({
  id: 'ORDER_PAYMENT_HISTORY',
  title: 'Tra cứu lịch sử thanh toán chi tiết của đơn hàng',
  description: 'Xem các lần khách thanh toán, đặt cọc hoặc chuyển khoản của đơn hàng',
  type: 'PRISMA_QUERY',
  examples: [
    'lịch sử thanh toán của đơn hàng này',
    'giao dịch thanh toán gần nhất của các đơn hàng',
    'tra cứu phiếu thu thanh toán của đơn hàng',
    'khách đã trả những lần nào cho đơn hàng',
    'các đợt nộp tiền của đơn hàng'
  ],
  patterns: [
    /(lịch sử thanh toán|phiếu thu thanh toán|các lần trả tiền|các đợt nộp tiền)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params) => {
    const orderId = params?.orderId;
    return await prisma.orderPayment.findMany({
      where: {
        ...(orderId ? { orderId } : {})
      },
      select: {
        id: true,
        orderId: true,
        method: true,
        amount: true,
        transactionId: true,
        status: true,
        settledAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 6
    });
  },
  template: (payments) => {
    if (!payments || payments.length === 0) {
      return 'Chưa ghi nhận giao dịch thanh toán nào được ghi vào sổ thanh toán đơn hàng.';
    }
    let res = `💳 **LỊCH SỬ CÁC GIAO DỊCH THANH TOÁN GẦN NHẤT:**\n\n`;
    payments.forEach((p, idx) => {
      const settleStatus = p.settledAt ? `(Đã đối soát: ${formatDateVN(p.settledAt)})` : `(Chưa đối soát)`;
      res += `${idx + 1}. **Đơn #${p.orderId}** - Số tiền: **${formatVND(p.amount)}**\n`;
      res += `   Phương thức: \`${p.method}\` | GD: \`${p.transactionId || 'TIEN_MAT'}\` | TT: \`${p.status}\` ${settleStatus}\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 12: Tổng kết chi phí ghi nhận trong sổ cái thu chi (Ledger Entries)
accountantTrainer.addSkill({
  id: 'LEDGER_EXPENSES_SUMMARY',
  title: 'Tổng kết chi phí thực tế ghi nhận trong sổ cái thu chi',
  description: 'Tổng hợp các khoản chi phí vận hành, giao hàng, hoàn tiền trong tháng',
  type: 'PRISMA_QUERY',
  examples: [
    'tổng chi phí tháng này trong sổ cái',
    'báo cáo chi phí hoạt động tháng này',
    'sổ cái thu chi tháng này thế nào',
    'các khoản chi phí lớn nhất tháng',
    'tổng tiền đã chi ra trong tháng'
  ],
  patterns: [
    /(chi phí.*sổ cái|sổ cái thu chi|khoản chi phí|tiền đã chi)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const expenses = await prisma.ledgerEntry.groupBy({
      by: ['type'],
      where: {
        date: { gte: getStartOfMonth() }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    return expenses.map(e => ({
      type: e.type,
      count: e._count.id,
      amount: Number(e._sum.amount || 0)
    }));
  },
  template: (entries) => {
    if (!entries || entries.length === 0) {
      return 'Chưa có khoản thu chi nào được ghi nhận trong sổ cái thu chi tháng này.';
    }
    const totalExp = entries
      .filter(e => ['EXPENSE', 'SHIPPING', 'REFUND', 'EXPENSE_PROJECTED'].includes(e.type))
      .reduce((sum, e) => sum + e.amount, 0);

    let res = `📒 **TỔNG HỢP SỔ CÁI THU CHI THÁNG NÀY (TỔNG CHI: ${formatVND(totalExp)}):**\n\n`;
    entries.forEach((e, idx) => {
      res += `${idx + 1}. Phân loại \`${e.type}\`: **${formatVND(e.amount)}** (${e.count} giao dịch)\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 13: Báo cáo công nợ COD chi tiết theo từng shipper
accountantTrainer.addSkill({
  id: 'OUTSTANDING_COD_BY_SHIPPER',
  title: 'Báo cáo công nợ tiền COD chi tiết theo từng shipper',
  description: 'Xác định nhân viên giao hàng nào đang giữ tiền COD chưa nộp',
  type: 'PRISMA_QUERY',
  examples: [
    'shipper nào đang giữ nhiều tiền cod nhất',
    'báo cáo công nợ cod theo từng shipper',
    'chi tiết nợ cod của từng người giao hàng',
    'danh sách shipper chưa nộp tiền thu hộ'
  ],
  patterns: [
    /(shipper nào.*tiền cod|công nợ cod.*từng shipper|nợ cod.*người giao hàng)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const codOrders = await prisma.order.findMany({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        assignedShipperId: { not: null }
      },
      select: {
        orderId: true,
        totalAmount: true,
        assignedShipperId: true,
        assignedShipper: {
          select: { fullName: true, phone: true }
        }
      }
    });

    const shipperMap = {};
    codOrders.forEach(o => {
      const sId = o.assignedShipperId;
      const sName = o.assignedShipper?.fullName || `Shipper #${sId}`;
      const sPhone = o.assignedShipper?.phone || '';
      if (!shipperMap[sId]) {
        shipperMap[sId] = { id: sId, name: sName, phone: sPhone, totalCod: 0, orderCount: 0 };
      }
      shipperMap[sId].totalCod += Number(o.totalAmount);
      shipperMap[sId].orderCount += 1;
    });

    return Object.values(shipperMap).sort((a, b) => b.totalCod - a.totalCod);
  },
  template: (shippers) => {
    if (!shippers || shippers.length === 0) {
      return '🎉 **Tuyệt vời! Toàn bộ shipper đã bàn giao và nộp đầy đủ tiền COD về thủ quỹ kế toán.**';
    }
    let res = `🛵 **BÁO CÁO CÔNG NỢ COD THEO NHÂN VIÊN GIAO HÀNG:**\n\n`;
    shippers.forEach((s, idx) => {
      res += `${idx + 1}. **${s.name}** (${s.phone || 'SĐT ẩn'})\n`;
      res += `   - Tiền COD đang giữ: **${formatVND(s.totalCod)}** (${s.orderCount} đơn chưa nộp)\n`;
    });
    return res.trim();
  }
});

// ============================================================================
// 2. NHÓM KỸ NĂNG QUY TRÌNH & TRI THỨC VĂN BẢN (KNOWLEDGE SOP)
// ============================================================================

// Kỹ năng 14: Quy định chi tiêu quỹ tiền mặt nhỏ khẩn cấp
accountantTrainer.addSkill({
  id: 'SOP_PETTY_CASH_EXPENSE',
  title: 'Quy định chi tiêu quỹ tiền mặt nhỏ khẩn cấp dưới 2 triệu',
  description: 'Thủ tục chi tạm ứng mua văn phòng phẩm và nước uống',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy định chi quỹ tiền mặt khẩn cấp',
    'chi tiền mặt dưới 2 triệu cần những giấy tờ gì',
    'thủ tục thanh toán chi phí tiếp khách văn phòng'
  ],
  patterns: [
    /(quỹ tiền mặt|chi khẩn cấp|dưới 2 triệu|tiếp khách|mua văn phòng phẩm)/i
  ],
  sop: `💵 **QUY CHẾ QUẢN LÝ QUỸ TIỀN MẶT NHỎ (PETTY CASH):**
1. **Hạn mức:** Chỉ áp dụng cho các khoản mua sắm khẩn cấp phát sinh dưới 2.000.000 VNĐ (nước uống, văn phòng phẩm, tiền gửi xe giao hàng).
2. **Chứng từ bắt buộc:** Hóa đơn bán lẻ hoặc phiếu thu có chữ ký người nhận tiền $\rightarrow$ Kèm giấy đề nghị thanh toán có chữ ký Trưởng bộ phận.
3. **Hoàn ứng:** Thời hạn quyết toán hoàn ứng tối đa 48 giờ làm việc kể từ thời điểm nhận tiền tạm ứng.`
});

// Kỹ năng 15: Nguyên tắc phân nhiệm SoD
accountantTrainer.addSkill({
  id: 'SOP_SOD_INTERNAL_CONTROL',
  title: 'Nguyên tắc phân nhiệm SoD (Segregation of Duties) trong kế toán',
  description: 'Quy định bảo mật kiểm soát dòng tiền và phân chia quyền hạn',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'nguyên tắc phân nhiệm sod trong kế toán thế nào',
    'quy định bảo mật duyệt chi và đối soát tài khoản',
    'người tạo phiếu thu có được tự duyệt không'
  ],
  patterns: [
    /(phân nhiệm sod|nguyên tắc sod|kiểm soát dòng tiền|tự duyệt phiếu)/i
  ],
  sop: `🔒 **QUY ĐỊNH PHÂN NHIỆM KIỂM SOÁT NỘI BỘ (SOD):**
1. **Tách biệt vai trò:** Kế toán viên lập phiếu thu/chi (MAKER) KHÔNG ĐƯỢC trùng với người bấm duyệt xuất tiền trên tài khoản ngân hàng (CHECKER / APPROVER).
2. **Hạn mức duyệt:** Phiếu chi dưới 20 triệu: Kế toán trưởng phê duyệt. Phiếu chi trên 20 triệu: Bắt buộc Giám đốc (CEO) duyệt online trên ERP.
3. **Mã PIN/OTP:** Nghiêm cấm chia sẻ mã OTP ngân hàng doanh nghiệp hoặc đăng nhập chéo tài khoản của nhau.`
});

// Kỹ năng 16: Quy chuẩn đối soát VietQR tự động
accountantTrainer.addSkill({
  id: 'SOP_VIETQR_RECONCILIATION',
  title: 'Quy chuẩn đối soát VietQR và webhook ngân hàng',
  description: 'Hướng dẫn xử lý các giao dịch lệch tiền hoặc chậm webhook',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'xử lý khi khách quét vietqr nhưng đơn chưa tự động cập nhật',
    'tiền vào tài khoản nhưng hệ thống báo pending thì làm sao',
    'cách đối soát giao dịch vietqr lệch tiền'
  ],
  patterns: [
    /(chậm webhook|quét vietqr.*chưa cập nhật|lệch tiền vietqr)/i
  ],
  sop: `💳 **QUY CHUẨN ĐỐI SOÁT VIETQR TỰ ĐỘNG:**
1. **Kiểm tra mã tham chiếu:** Tra cứu mã tham chiếu ngân hàng (Bank Reference Code) trên app Ngân hàng MBBank/VCB đối chiếu với trường \`bank_ref_code\` trong đơn hàng.
2. **Khớp nội dung:** Nếu nội dung chuyển khoản thiếu mã đơn: Vào mục **[Kế toán $\rightarrow$ Đối soát VietQR thủ công]** $\rightarrow$ Chọn đơn tương ứng $\rightarrow$ Bấm [Khớp Giao Dịch].
3. **Lệch số tiền:** Nếu khách chuyển thiếu tiền: Hệ thống tự động ghi nhận là "Đã cọc một phần" (PARTIAL_PAID), nhân viên liên hệ khách để bổ sung.`
});

// Kỹ năng 17: Quy trình xuất hóa đơn đỏ điện tử (e-Invoice)
accountantTrainer.addSkill({
  id: 'SOP_E_INVOICE_ISSUANCE',
  title: 'Quy trình xuất hóa đơn điện tử VAT (Hóa đơn đỏ)',
  description: 'Thủ tục lập và phát hành hóa đơn giá trị gia tăng điện tử cho khách hàng',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy trình xuất hóa đơn đỏ vat điện tử',
    'thủ tục xuất hóa đơn công ty cho khách',
    'khách đòi hóa đơn vat thì làm thế nào',
    'quy định xuất hóa đơn điện tử trong ngày'
  ],
  patterns: [
    /(xuất hóa đơn đỏ|hóa đơn vat|hóa đơn điện tử|e-invoice|thông tin xuất vat)/i
  ],
  sop: `🧾 **QUY TRÌNH XUẤT HÓA ĐƠN ĐIỆN TỬ VAT (E-INVOICE):**
1. **Thông tin bắt buộc:** Tên công ty, Mã số thuế (MST), Địa chỉ đăng ký kinh doanh và Email nhận hóa đơn của người mua.
2. **Thời điểm xuất:** Hóa đơn điện tử phải được xuất trong vòng 24 giờ sau khi đơn hàng chuyển sang trạng thái \`DELIVERED\` hoặc \`COMPLETED\`.
3. **Đơn hàng cá nhân không lấy hóa đơn:** Kế toán tập hợp vào bảng kê xuất hóa đơn gộp cuối ngày "Người mua không lấy hóa đơn" theo đúng quy định Thuế.`
});

// Kỹ năng 18: Quy trình đối chiếu sổ phụ ngân hàng định kỳ cuối tháng
accountantTrainer.addSkill({
  id: 'SOP_BANK_STATEMENT_RECONCILIATION',
  title: 'Quy trình đối chiếu sổ phụ ngân hàng định kỳ cuối tháng',
  description: 'Hướng dẫn chốt số dư và đối chiếu giao dịch ngân hàng với sổ sách ERP',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy trình đối chiếu sổ phụ ngân hàng',
    'thủ tục chốt số dư ngân hàng cuối tháng',
    'hướng dẫn đối soát sao kê tài khoản công ty'
  ],
  patterns: [
    /(sổ phụ ngân hàng|chốt số dư ngân hàng|đối chiếu sao kê)/i
  ],
  sop: `📑 **QUY TRÌNH ĐỐI CHIẾU SỔ PHỤ NGÂN HÀNG (BANK RECONCILIATION):**
1. **Thời điểm thực hiện:** Vào ngày cuối cùng của tháng tài chính (chậm nhất ngày 02 tháng tiếp theo).
2. **Thu thập tài liệu:** Tải file sao kê chi tiết (Excel/PDF) từ Internet Banking Vietcombank & MBBank.
3. **Đối chiếu số dư:** Khớp số dư đầu kỳ, tổng phát sinh Nợ/Có và số dư cuối kỳ với báo cáo tài khoản ngân hàng trên ERP AetherPC.
4. **Xử lý chênh lệch:** Nếu có chênh lệch do phí ngân hàng hoặc giao dịch treo, lập phiếu điều chỉnh ghi sổ kèm chữ ký Kế toán trưởng.`
});

// Kỹ năng 19: Phân tích tăng trưởng và so sánh doanh thu với kỳ trước (F1)
accountantTrainer.addSkill({
  id: 'COMPARATIVE_REVENUE_GROWTH',
  title: 'Phân tích tăng trưởng và đối chiếu doanh thu với kỳ trước',
  description: 'So sánh doanh thu thực tế hiện tại với kỳ trước (tháng trước, kỳ trước) và tính biến động %',
  type: 'PRISMA_QUERY',
  examples: [
    'so với tháng trước thì tăng hay giảm bao nhiêu %',
    'so với tháng trước',
    'so sánh doanh thu với tháng trước',
    'tăng hay giảm bao nhiêu so với tháng trước',
    'tăng trưởng doanh thu tháng này',
    'so với kỳ trước thì thế nào',
    'tỷ lệ tăng trưởng so với tháng trước'
  ],
  patterns: [
    /(so với.*(tháng trước|kỳ trước)|tăng hay giảm bao nhiêu|tăng trưởng.*tháng trước|so sánh.*tháng trước)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN', 'SALES'],
  handler: async (prisma) => {
    const curStart = getStartOfMonth();
    const prevStart = getStartOfLastMonth();
    const prevEnd = getEndOfLastMonth();

    const [curRes, prevRes] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: { in: ['DELIVERED', 'COMPLETED'] },
          createdAt: { gte: curStart }
        },
        _sum: { totalAmount: true },
        _count: { orderId: true }
      }),
      prisma.order.aggregate({
        where: {
          status: { in: ['DELIVERED', 'COMPLETED'] },
          createdAt: { gte: prevStart, lte: prevEnd }
        },
        _sum: { totalAmount: true },
        _count: { orderId: true }
      })
    ]);

    const curRev = Number(curRes._sum?.totalAmount || 0);
    const prevRev = Number(prevRes._sum?.totalAmount || 0);
    const curCount = curRes._count?.orderId || 0;
    const prevCount = prevRes._count?.orderId || 0;
    const diff = curRev - prevRev;
    const pct = prevRev > 0 ? Number(((diff / prevRev) * 100).toFixed(1)) : (curRev > 0 ? 100 : 0);

    return { curRev, prevRev, curCount, prevCount, diff, pct };
  },
  template: (data) => {
    const isUp = data.pct >= 0;
    const icon = isUp ? '📈' : '📉';
    const directionWord = isUp ? 'Tăng trưởng' : 'Giảm';
    return `${icon} **PHÂN TÍCH TĂNG TRƯỞNG & ĐỐI CHIẾU DOANH THU (SO VỚI THÁNG TRƯỚC):**\n\n` +
           `- 💵 Doanh thu tháng này: **${formatVND(data.curRev)}** (Tổng cộng: **${data.curCount} đơn hoàn tất**)\n` +
           `- 📅 Doanh thu tháng trước: **${formatVND(data.prevRev)}** (Tổng cộng: **${data.prevCount} đơn hoàn tất**)\n` +
           `- 📊 Biến động doanh thu: **${isUp ? '+' : ''}${data.pct}%** (${directionWord} **${formatVND(Math.abs(data.diff))}**)\n\n` +
           `💡 *Nhận định:* ${isUp ? 'Đà kinh doanh đang duy trì tốc độ phát triển ổn định.' : 'Doanh thu tháng này có sự chững lại so với tháng trước, đề xuất thúc đẩy thêm các chương trình khuyến mãi và quà tặng kèm PC.'}`;
  }
});

// Kỹ năng 20: Lọc đơn hàng giá trị cao chưa thanh toán (F1)
accountantTrainer.addSkill({
  id: 'HIGH_VALUE_UNPAID_ORDERS',
  title: 'Lọc danh sách đơn hàng giá trị cao chưa thanh toán',
  description: 'Truy vấn các đơn hàng có giá trị lớn (trên 10M / 20M) nhưng thanh toán chưa hoàn tất',
  type: 'PRISMA_QUERY',
  examples: [
    'những đơn trên 10 triệu mà chưa thanh toán',
    'lọc các đơn chưa thanh toán trên 20 triệu',
    'đơn hàng giá trị cao chưa trả tiền',
    'những đơn lớn chưa thanh toán tiền',
    'đơn chưa thanh toán trên 10tr',
    'các đơn tiền lớn chưa thu được'
  ],
  patterns: [
    /(đơn.*(trên|hơn).*(triệu|tr).*chưa.*(thanh toán|trả tiền)|chưa thanh toán.*(trên|hơn).*(triệu|tr)|đơn lớn chưa thanh toán)/i
  ],
  allowedRoles: ['ACCOUNTANT', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params, _user) => {
    const rawPrompt = (params && params.keyword) || '';
    let minAmount = 10000000;
    if (/20\s*(triệu|tr)/i.test(rawPrompt)) minAmount = 20000000;
    if (/50\s*(triệu|tr)/i.test(rawPrompt)) minAmount = 50000000;

    const orders = await prisma.order.findMany({
      where: {
        totalAmount: { gte: minAmount },
        paymentStatus: { in: ['UNPAID', 'PENDING', 'PARTIAL'] }
      },
      select: {
        orderId: true,
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
        createdAt: true
      },
      orderBy: { totalAmount: 'desc' },
      take: 8
    });

    return { orders, minAmount };
  },
  template: (data) => {
    if (!data.orders || data.orders.length === 0) {
      return `🎉 **Tuyệt vời! Không có đơn hàng nào trên ${formatVND(data.minAmount)} bị treo trạng thái chưa thanh toán.**`;
    }
    let res = `⚠️ **DANH SÁCH ĐƠN HÀNG GIÁ TRỊ CAO (>= ${formatVND(data.minAmount)}) CHƯA THANH TOÁN:**\n\n`;
    data.orders.forEach((o, idx) => {
      const dateStr = formatDateVN(o.createdAt);
      res += `${idx + 1}. **#${o.orderId}** - Trị giá: **${formatVND(o.totalAmount)}**\n` +
             `   Khách: **${o.customerName || 'N/A'}** (${o.customerPhone || 'SĐT N/A'}) | Phương thức: \`${o.paymentMethod}\`\n` +
             `   Trạng thái đơn: \`${o.status}\` | Thanh toán: \`${o.paymentStatus}\` (${dateStr})\n`;
    });
    return res.trim();
  }
});

module.exports = accountantTrainer;

