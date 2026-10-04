/**
 * ADMIN & CEO TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO BAN GIÁM ĐỐC & QUẢN TRỊ VIÊN
 * Thiết kế chuẩn hóa theo Giai đoạn 1: Intent Catalog + Parameterized Prisma Handlers
 */

const BaseActorTrainer = require('./BaseActorTrainer');
const { getStartOfYear, formatVND, formatDateVN } = require('../utils/dateHelper');

const adminCeoTrainer = new BaseActorTrainer({
  role: 'ADMIN_CEO',
  name: 'Ban Giám Đốc & Quản trị viên (Admin / CEO)',
  systemPrompt: `BẠN LÀ TRỢ LÝ ĐIỀU HÀNH CHIẾN LƯỢC CAO CẤP DÀNH CHO BAN GIÁM ĐỐC (CEO) & ADMIN AETHERPC:
- PHONG CÁCH: Tổng quan, cô đọng, sắc bén, định hướng số liệu (Data-Driven Insights).
- QUYỀN HẠN: Toàn quyền truy cập mọi chỉ số tài chính, nhân sự, kho vận, không bị giới hạn RBAC.
- ĐỊNH DẠNG: Sử dụng bảng số liệu, bullet points, chỉ rõ tỷ lệ tăng trưởng và các điểm cảnh báo bất thường.`
});

// ============================================================================
// 1. NHÓM KỸ NĂNG TRUY VẤN DỮ LIỆU PRISMA (TYPE-SAFE HANDLERS)
// ============================================================================

// Kỹ năng 1: Báo cáo tổng quan tình hình kinh doanh năm nay
adminCeoTrainer.addSkill({
  id: 'ANNUAL_EXECUTIVE_SUMMARY',
  title: 'Báo cáo tổng quan tình hình kinh doanh năm nay',
  description: 'Tổng hợp các chỉ số KPI doanh thu và đơn hàng chủ chốt từ đầu năm đến nay',
  type: 'PRISMA_QUERY',
  examples: [
    'báo cáo tổng quan tình hình kinh doanh toàn công ty năm nay',
    'tổng quan doanh thu năm nay',
    'tổng kết kinh doanh từ đầu năm',
    'tình hình kinh doanh năm nay thế nào',
    'doanh số và đơn hàng năm nay của công ty',
    'báo cáo kết quả kinh doanh năm nay',
    'kpi doanh thu toàn hệ thống năm nay'
  ],
  patterns: [
    /(tổng quan|tổng kết|kết quả).*(kinh doanh|doanh thu).*năm nay/i,
    /(kinh doanh|doanh thu|doanh số).*năm nay/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const res = await prisma.order.aggregate({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        createdAt: { gte: getStartOfYear() }
      },
      _count: { orderId: true },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true }
    });
    return {
      totalOrders: res._count?.orderId || 0,
      totalRevenue: Number(res._sum?.totalAmount || 0),
      avgOrderValue: Math.round(Number(res._avg?.totalAmount || 0))
    };
  },
  template: (data) => {
    return `👑 **BÁO CÁO ĐIỀU HÀNH TỔNG QUAN DOANH NGHIỆP (YTD 2026):**\n\n` +
           `- 📈 Tổng doanh thu hoàn tất: **${formatVND(data.totalRevenue)}**\n` +
           `- 📦 Tổng số đơn giao thành công: **${data.totalOrders} đơn**\n` +
           `- 🏷️ Giá trị trung bình/đơn (AOV): **${formatVND(data.avgOrderValue)}**\n\n` +
           `Hệ thống vận hành ổn định, dòng tiền kinh doanh duy trì tốc độ tăng trưởng dương.`;
  },
  sql: () => `SELECT COUNT(order_id) AS tong_don_hang, SUM(total_amount) AS tong_doanh_thu, ROUND(AVG(total_amount), 0) AS gia_tri_tb_don FROM orders WHERE status IN ('DELIVERED', 'COMPLETED') AND created_at >= date_trunc('year', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`
});

// Kỹ năng 2: Thống kê số lượng nhân sự theo từng phòng ban và vai trò
adminCeoTrainer.addSkill({
  id: 'HR_HEADCOUNT_DISTRIBUTION',
  title: 'Thống kê số lượng nhân sự theo từng phòng ban và vai trò',
  description: 'Cơ cấu nhân sự đang làm việc tại các bộ phận trong công ty',
  type: 'PRISMA_QUERY',
  examples: [
    'thống kê số lượng nhân sự theo từng phòng ban và vai trò',
    'thống kê số lượng nhân sự theo từng phòng ban?',
    'công ty có bao nhiêu nhân sự',
    'công ty hiện có bao nhiêu nhân viên',
    'cơ cấu nhân sự các bộ phận',
    'thống kê nhân viên theo vai trò',
    'tổng số nhân sự đang hoạt động',
    'báo cáo định biên nhân sự các phòng ban'
  ],
  patterns: [
    /(nhân sự|nhân viên|cơ cấu nhân sự|định biên)/i
  ],
  keywords: ['nhân sự'],
  allowedRoles: ['ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const counts = await prisma.employee.groupBy({
      by: ['role'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });
    return counts.map(c => ({ role: c.role, count: c._count.id }));
  },
  template: (data) => {
    if (!data || data.length === 0) return 'Hiện chưa có nhân sự nào được phân bổ trong hệ thống.';
    const totalStaff = data.reduce((sum, d) => sum + d.count, 0);
    let res = `👥 **CƠ CẤU NHÂN SỰ TOÀN HỆ THỐNG (TỔNG CỘNG: ${totalStaff} NHÂN VIÊN):**\n\n`;
    data.forEach((d, idx) => {
      res += `${idx + 1}. Bộ phận \`${d.role}\`: **${d.count}** nhân sự\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT role, COUNT(id) AS so_luong_nhan_su FROM employees WHERE status = 'ACTIVE' GROUP BY role ORDER BY so_luong_nhan_su DESC;`
});

// Kỹ năng 3: Các khiếu nại khách hàng chưa được giải quyết
adminCeoTrainer.addSkill({
  id: 'PENDING_COMPLAINTS',
  title: 'Các khiếu nại khách hàng chưa được giải quyết',
  description: 'Theo dõi rủi ro chất lượng dịch vụ và mức độ hài lòng khách hàng',
  type: 'PRISMA_QUERY',
  examples: [
    'có bao nhiêu khiếu nại khách hàng chưa được giải quyết?',
    'có bao nhiêu khiếu nại khách hàng chưa được giải quyết',
    'khiếu nại đang chờ xử lý',
    'danh sách khiếu nại cskh',
    'tình hình phàn nàn của khách',
    'khiếu nại tồn đọng chưa xong'
  ],
  patterns: [
    /(khiếu nại|ticket|phàn nàn)/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const complaints = await prisma.complaint.groupBy({
      by: ['priority'],
      where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });
    return complaints.map(c => ({ priority: c.priority, count: c._count.id }));
  },
  template: (data) => {
    if (!data || data.length === 0) {
      return '🎉 **Tuyệt vời! Không có khiếu nại nào của khách hàng đang bị tồn đọng.**';
    }
    const totalComplaints = data.reduce((sum, d) => sum + d.count, 0);
    let res = `⚠️ **BÁO CÁO CSKH: CÓ ${totalComplaints} KHIẾU NẠI ĐANG CHỜ XỬ LÝ:**\n\n`;
    data.forEach((d, idx) => {
      res += `${idx + 1}. Mức độ ưu tiên [${d.priority}]: **${d.count}** trường hợp\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT priority, COUNT(id) AS so_luong FROM complaints WHERE status NOT IN ('RESOLVED', 'CLOSED') GROUP BY priority ORDER BY so_luong DESC;`
});

// Kỹ năng 4: Top 5 sản phẩm mang lại doanh thu cao nhất cho công ty
adminCeoTrainer.addSkill({
  id: 'TOP_REVENUE_PRODUCTS',
  title: 'Top 5 sản phẩm mang lại doanh thu cao nhất cho công ty',
  description: 'Xếp hạng các sản phẩm chủ lực đóng góp doanh thu lớn nhất',
  type: 'PRISMA_QUERY',
  examples: [
    'top 5 sản phẩm mang lại doanh thu cao nhất cho công ty',
    'sản phẩm nào bán chạy nhất',
    'top sản phẩm doanh thu cao nhất',
    'mặt hàng sinh lời nhiều nhất',
    'những linh kiện đem lại doanh thu cao',
    'sản phẩm đóng góp doanh số chủ lực'
  ],
  patterns: [
    /(top.*sản phẩm|sản phẩm.*doanh thu cao|mặt hàng bán chạy|sinh lời cao nhất|chủ lực)/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const topItems = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { status: { in: ['DELIVERED', 'COMPLETED'] } }
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5
    });

    const productIds = topItems.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, name: true }
    });
    const productMap = Object.fromEntries(products.map(p => [p.productId, p.name]));

    return topItems.map(i => ({
      name: productMap[i.productId] || `SP #${i.productId}`,
      quantity: i._sum.quantity || 0,
      revenue: Number(i._sum.total || 0)
    }));
  },
  template: (items) => {
    if (!items || items.length === 0) return 'Chưa đủ dữ liệu bán hàng để xếp hạng.';
    let res = `🏆 **TOP 5 SẢN PHẨM ĐÓNG GÓP DOANH THU LỚN NHẤT:**\n\n`;
    items.forEach((it, idx) => {
      res += `${idx + 1}. **${it.name}**\n`;
      res += `   Doanh số: **${formatVND(it.revenue)}** (${it.quantity} sản phẩm đã bán)\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT p.name AS ten_san_pham, SUM(oi.quantity) AS so_luong_ban, SUM(oi.total) AS tong_doanh_thu FROM order_items oi JOIN products p ON p.product_id = oi.product_id JOIN orders o ON o.order_id = oi.order_id WHERE o.status IN ('DELIVERED', 'COMPLETED') GROUP BY p.name ORDER BY tong_doanh_thu DESC LIMIT 5;`
});

// Kỹ năng 5: Tỷ lệ đơn hàng giao thành công so với đơn bị hủy hoặc hoàn hàng
adminCeoTrainer.addSkill({
  id: 'ORDER_FULFILLMENT_RATIO',
  title: 'Tỷ lệ đơn hàng giao thành công so với đơn bị hủy hoặc hoàn hàng',
  description: 'Đánh giá tỷ lệ hoàn tất đơn hàng và tỷ lệ rủi ro giao vận',
  type: 'PRISMA_QUERY',
  examples: [
    'tỷ lệ đơn hàng giao thành công so với hoàn hàng?',
    'tỷ lệ đơn hàng giao thành công so với đơn bị hủy hoặc hoàn hàng',
    'tỷ lệ giao thành công toàn công ty',
    'thống kê tỷ lệ hoàn đơn',
    'tỷ lệ hoàn tất đơn hàng và hủy đơn',
    'hiệu quả giao vận toàn hệ thống'
  ],
  patterns: [
    /(tỷ lệ.*(giao|hủy|hoàn|thành công)|thống kê đơn hàng|hiệu quả giao vận|tổng quan đơn)/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const total = await prisma.order.count();
    const byStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: { orderId: true },
      orderBy: { _count: { orderId: 'desc' } }
    });
    return byStatus.map(s => ({
      status: s.status,
      count: s._count.orderId,
      percent: total > 0 ? Number(((s._count.orderId / total) * 100).toFixed(1)) : 0
    }));
  },
  template: (ratios) => {
    if (!ratios || ratios.length === 0) return 'Hệ thống chưa có đơn hàng nào.';
    let res = `📊 **TỶ LỆ HOÀN TẤT & PHÂN BỔ ĐƠN HÀNG HỆ THỐNG:**\n\n`;
    ratios.forEach((r, idx) => {
      res += `${idx + 1}. Trạng thái \`${r.status}\`: **${r.count} đơn** (${r.percent}%)\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT status, COUNT(*) AS so_luong, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 1) AS ty_le_phan_tram FROM orders GROUP BY status ORDER BY so_luong DESC;`
});

// Kỹ năng 6: Nhật ký các thao tác nhạy cảm gần đây trong hệ thống (Audit Logs)
adminCeoTrainer.addSkill({
  id: 'AUDIT_LOGS_SUSPICIOUS_ACTIONS',
  title: 'Nhật ký các thao tác nhạy cảm gần đây trong hệ thống',
  description: 'Truy vết các hành động xóa dữ liệu, chỉnh sửa giá, phân quyền (Audit Trail)',
  type: 'PRISMA_QUERY',
  examples: [
    'gần đây có nhân viên nào xóa đơn hoặc đổi giá không',
    'xem nhật ký thao tác kiểm toán hệ thống',
    'nhật ký audit logs gần nhất',
    'ai vừa sửa thông tin hệ thống',
    'nhật ký bảo mật và truy vết hoạt động'
  ],
  patterns: [
    /(nhật ký.*(thao tác|kiểm toán|audit)|xóa đơn|đổi giá|sửa thông tin|truy vết)/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.auditLog.findMany({
      select: {
        actorName: true,
        actorRole: true,
        action: true,
        module: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 8
    });
  },
  template: (logs) => {
    if (!logs || logs.length === 0) return 'Chưa ghi nhận thao tác nhạy cảm nào trong hệ thống.';
    let res = `🛡️ **NHẬT KÝ KIỂM TOÁN HOẠT ĐỘNG (AUDIT TRAIL GẦN NHẤT):**\n\n`;
    logs.forEach((l, idx) => {
      res += `${idx + 1}. **${l.actorName || 'Hệ thống'}** (\`${l.actorRole || 'SYSTEM'}\`)\n`;
      res += `   Hành động: \`${l.action}\` trên phân hệ [${l.module}] lúc ${formatDateVN(l.createdAt)}\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 7: Ước tính lợi nhuận gộp kinh doanh (Gross Profit Margin)
adminCeoTrainer.addSkill({
  id: 'ESTIMATED_GROSS_PROFIT',
  title: 'Ước tính lợi nhuận gộp toàn công ty (Gross Profit & Margin)',
  description: 'Tổng hợp doanh thu thuần trừ đi giá vốn mua hàng nhà cung cấp (COGS)',
  type: 'PRISMA_QUERY',
  examples: [
    'ước tính lợi nhuận gộp toàn công ty năm nay',
    'lợi nhuận gộp kinh doanh là bao nhiêu',
    'ước tính lãi gộp bán hàng',
    'doanh thu trừ chi phí vốn còn bao nhiêu',
    'tỷ suất lợi nhuận gộp năm nay'
  ],
  patterns: [
    /(lợi nhuận gộp|lãi gộp|doanh thu trừ chi phí|gross profit|tỷ suất lợi nhuận)/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    // 1. Doanh thu đơn DELIVERED / COMPLETED năm nay
    const revRes = await prisma.order.aggregate({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        createdAt: { gte: getStartOfYear() }
      },
      _sum: { totalAmount: true }
    });
    const totalRev = Number(revRes._sum.totalAmount || 0);

    // 2. Chi phí mua hàng từ NCC (Vendor Bills)
    const costRes = await prisma.vendorBill.aggregate({
      where: {
        status: { not: 'CANCELLED' }
      },
      _sum: { amountTotal: true }
    });
    const totalCost = Number(costRes._sum.amountTotal || 0);

    const grossProfit = totalRev - totalCost;
    const grossMargin = totalRev > 0 ? Number(((grossProfit / totalRev) * 100).toFixed(1)) : 0;

    return {
      revenue: totalRev,
      cogs: totalCost,
      grossProfit,
      grossMargin
    };
  },
  template: (data) => {
    return `💎 **BÁO CÁO LỢI NHUẬN GỘP KINH DOANH LŨY KẾ (YTD 2026):**\n\n` +
           `- 📈 Tổng doanh thu bán hàng: **${formatVND(data.revenue)}**\n` +
           `- 📦 Tổng giá vốn mua hàng (COGS): **${formatVND(data.cogs)}**\n` +
           `- 💰 **Lợi nhuận gộp (Gross Profit): ${formatVND(data.grossProfit)}**\n` +
           `- 📊 Biên lợi nhuận gộp (Gross Margin): **${data.grossMargin}%**\n\n` +
           `Chỉ số biên lợi nhuận trên 15% là mức an toàn cao đối với mô hình bán lẻ linh kiện PC.`;
  }
});

// Kỹ năng 8: Xếp hạng nhân viên Sales xuất sắc nhất (Top Performers)
adminCeoTrainer.addSkill({
  id: 'TOP_SALES_REPRESENTATIVES',
  title: 'Bảng xếp hạng nhân viên kinh doanh (Sales) xuất sắc nhất',
  description: 'Thống kê top nhân viên mang về doanh số bán hàng cao nhất toàn công ty',
  type: 'PRISMA_QUERY',
  examples: [
    'nhân viên sales nào bán được nhiều nhất',
    'bảng xếp hạng nhân viên kinh doanh xuất sắc',
    'top nhân viên sales năm nay',
    'ai là nhân viên bán hàng tốt nhất',
    'thống kê doanh số theo từng nhân viên sales'
  ],
  patterns: [
    /(nhân viên sales nào|xếp hạng.*kinh doanh|top nhân viên sales|bán hàng tốt nhất|doanh số.*từng nhân viên)/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    const topSales = await prisma.order.groupBy({
      by: ['soldById'],
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        soldById: { not: null }
      },
      _count: { orderId: true },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5
    });

    const sellerIds = topSales.map(s => s.soldById);
    const sellers = await prisma.employee.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, fullName: true, phone: true }
    });
    const sellerMap = Object.fromEntries(sellers.map(s => [s.id, s]));

    return topSales.map(ts => ({
      name: sellerMap[ts.soldById]?.fullName || `NV #${ts.soldById}`,
      phone: sellerMap[ts.soldById]?.phone || '',
      orderCount: ts._count.orderId,
      revenue: Number(ts._sum.totalAmount || 0)
    }));
  },
  template: (sellers) => {
    if (!sellers || sellers.length === 0) return 'Chưa có đủ số liệu kinh doanh của nhân viên.';
    let res = `🌟 **BẢNG XẾP HẠNG TOP NHÂN VIÊN KINH DOANH XUẤT SẮC:**\n\n`;
    sellers.forEach((s, idx) => {
      res += `${idx + 1}. **${s.name}**\n`;
      res += `   - Doanh số: **${formatVND(s.revenue)}** (${s.orderCount} đơn chốt thành công)\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 9: Danh sách các đơn hàng có giá trị khủng nhất (Top High-Value Orders)
adminCeoTrainer.addSkill({
  id: 'TOP_HIGH_VALUE_ORDERS',
  title: 'Danh sách các đơn hàng có giá trị lớn nhất từ trước đến nay',
  description: 'Tra cứu các hợp đồng dự án, dàn PC Workstation siêu khủng',
  type: 'PRISMA_QUERY',
  examples: [
    'các đơn hàng có giá trị lớn nhất công ty',
    'top những đơn hàng khủng nhất',
    'đơn hàng doanh số cao kỷ lục',
    'những đơn hàng giá trị cao nhất từng bán',
    'danh sách đơn hàng vip giá trị lớn'
  ],
  patterns: [
    /(đơn hàng.*giá trị lớn|đơn hàng khủng|kỷ lục|giá trị cao nhất)/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.order.findMany({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED', 'CONFIRMED', 'PROCESSING'] }
      },
      select: {
        orderId: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } }
      },
      orderBy: { totalAmount: 'desc' },
      take: 5
    });
  },
  template: (orders) => {
    if (!orders || orders.length === 0) return 'Chưa có đơn hàng nào được ghi nhận.';
    let res = `🏆 **TOP 5 ĐƠN HÀNG CÓ GIÁ TRỊ CAO NHẤT HỆ THỐNG:**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}** - Trị giá: **${formatVND(o.totalAmount)}**\n`;
      res += `   Khách: **${o.customer?.name || 'Khách vãng lai'}** | Trạng thái: \`${o.status}\` (${formatDateVN(o.createdAt)})\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 10: Thống kê nhân viên đang nghỉ phép / vắng mặt (Leave Requests)
adminCeoTrainer.addSkill({
  id: 'LEAVE_REQUESTS_SUMMARY',
  title: 'Thống kê tình hình nhân sự nghỉ phép và vắng mặt',
  description: 'Xem số lượng nhân viên đang nghỉ ốm, nghỉ phép năm hoặc đơn đang chờ duyệt',
  type: 'PRISMA_QUERY',
  examples: [
    'hôm nay có những nhân viên nào nghỉ phép',
    'tình hình nhân sự xin nghỉ phép tuần này',
    'ai đang vắng mặt nghỉ ốm',
    'danh sách đơn xin nghỉ phép gần đây',
    'nhân sự nào đang nghỉ phép'
  ],
  patterns: [
    /(nhân viên.*nghỉ phép|ai đang nghỉ|vắng mặt|đơn xin nghỉ phép|tình hình nghỉ phép)/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.leaveRequest.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING'] }
      },
      select: {
        id: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        reason: true,
        employee: { select: { fullName: true, role: true } }
      },
      orderBy: { startDate: 'desc' },
      take: 6
    });
  },
  template: (leaves) => {
    if (!leaves || leaves.length === 0) {
      return '🟢 **Hiện không có nhân viên nào đang nghỉ phép hoặc có đơn xin nghỉ phép tồn đọng.** Toàn bộ quân số đi làm đầy đủ!';
    }
    let res = `📋 **TÌNH HÌNH NHÂN SỰ NGHỈ PHÉP / ĐƠN CHỜ DUYỆT GẦN ĐÂY:**\n\n`;
    leaves.forEach((l, idx) => {
      res += `${idx + 1}. **${l.employee.fullName}** (\`${l.employee.role}\`) - Loại: \`${l.type}\`\n`;
      res += `   Thời gian: ${formatDateVN(l.startDate)} $\\rightarrow$ ${formatDateVN(l.endDate)} | TT: \`${l.status}\`\n`;
      if (l.reason) res += `   Lý do: "${l.reason}"\n`;
    });
    return res.trim();
  }
});

// ============================================================================
// 2. NHÓM KỸ NĂNG QUY TRÌNH & TRI THỨC VĂN BẢN (KNOWLEDGE SOP)
// ============================================================================

// Kỹ năng 11: Chính sách an toàn thông tin & kiểm toán hệ thống
adminCeoTrainer.addSkill({
  id: 'SOP_INTERNAL_SECURITY',
  title: 'Chính sách an toàn thông tin & kiểm toán hệ thống',
  description: 'Quy tắc an toàn dữ liệu, phân quyền và ghi log kiểm toán',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'chính sách an toàn thông tin nội bộ',
    'quy định bảo mật và kiểm toán hệ thống',
    'quy tắc kiểm soát dữ liệu khách hàng',
    'nhân viên nghỉ việc xử lý tài khoản thế nào'
  ],
  patterns: [
    /(an toàn thông tin|bảo mật|kiểm toán|zero-trust|khóa tài khoản)/i
  ],
  sop: `🔐 **QUY TẮC AN TOÀN DỮ LIỆU & KIỂM TOÁN HỆ THỐNG:**
1. **Zero-Trust Access:** Mọi thao tác truy xuất dữ liệu nhạy cảm đều được ghi log tự động vào bảng \`ai_audit_logs\`.
2. **Khóa tài khoản:** Nhân viên nghỉ việc bắt buộc phải vô hiệu hóa trạng thái tài khoản sang \`INACTIVE\` ngay trong vòng 2 giờ làm việc.
3. **Sao lưu dữ liệu:** Cơ sở dữ liệu PostgreSQL được backup tự động hàng ngày lúc 02:00 sáng và lưu trữ mã hóa đa vùng.`
});

// Kỹ năng 12: Quy trình ứng phó khẩn cấp và phục hồi thảm họa
adminCeoTrainer.addSkill({
  id: 'SOP_DISASTER_RECOVERY',
  title: 'Quy trình ứng phó khẩn cấp và phục hồi thảm họa',
  description: 'Các bước xử lý khẩn cấp khi gặp sự cố máy chủ hoặc rò rỉ dữ liệu',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy trình xử lý sự cố rò rỉ dữ liệu',
    'khi hệ thống sập thì báo cáo thế nào',
    'kịch bản ứng phó sự cố máy chủ',
    'phục hồi thảm họa dữ liệu'
  ],
  patterns: [
    /(rò rỉ dữ liệu|sập hệ thống|sự cố máy chủ|ứng phó sự cố|phục hồi thảm họa)/i
  ],
  sop: `🚨 **QUY TRÌNH ỨNG PHÓ KHẨN CẤP (DISASTER RECOVERY):**
1. **Cô lập:** Ngắt ngay quyền truy cập IP bất thường và chuyển hệ thống sang chế độ bảo trì (Maintenance Mode).
2. **Báo cáo:** Trưởng bộ phận IT thông báo ngay cho CEO và CTO trong vòng 15 phút.
3. **Phục hồi:** Khôi phục điểm snapshot gần nhất từ máy chủ sao lưu dự phòng (DR Site).`
});

// Kỹ năng 13: Quy chế xử lý vi phạm kỷ luật và bồi thường thiệt hại hàng hóa
adminCeoTrainer.addSkill({
  id: 'SOP_INTERNAL_DISCIPLINE_POLICY',
  title: 'Quy chế xử lý vi phạm kỷ luật và bồi thường thiệt hại',
  description: 'Quy tắc chế tài xử lý khi làm vỡ hỏng linh kiện hoặc thất thoát hàng hóa',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy chế xử lý kỷ luật nhân viên',
    'quy định bồi thường khi làm vỡ hỏng linh kiện',
    'xử lý thế nào khi nhân viên vi phạm kỷ luật nội bộ',
    'chế tài xử phạt thất thoát linh kiện trong kho'
  ],
  patterns: [
    /(kỷ luật nhân viên|bồi thường.*hư hỏng|thất thoát linh kiện|chế tài xử phạt)/i
  ],
  sop: `⚖️ **QUY CHẾ XỬ LÝ KỶ LUẬT & BỒI THƯỜNG THIỆT HẠI HÀNG HÓA:**
1. **Lỗi vô ý làm hỏng (Rơi vỡ khi lắp ráp/vận chuyển):** Nhân viên bồi thường 30% giá vốn nhập hàng, công ty hỗ trợ 70% còn lại.
2. **Làm mất/thất thoát không có lý do:** Bồi thường 100% giá bán lẻ niêm yết và trừ trực tiếp vào quỹ lương tháng.
3. **Vi phạm cố ý tráo đổi linh kiện hoặc biển thủ công nợ:** Sa thải ngay lập tức, chuyển hồ sơ cho cơ quan chức năng xử lý theo Pháp luật.`
});

// Kỹ năng 14: Quy chế thẩm quyền phê duyệt chi tiêu và đầu tư tài sản
adminCeoTrainer.addSkill({
  id: 'SOP_EXECUTIVE_DECISION_FRAMEWORK',
  title: 'Quy chế thẩm quyền phê duyệt đầu tư và chi tiêu ngân sách',
  description: 'Phân cấp quyền phê duyệt mua sắm trang thiết bị và ký hợp đồng thương mại',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'thẩm quyền phê duyệt chi tiêu của ban giám đốc',
    'khoản chi bao nhiêu tiền thì cần ceo duyệt',
    'quy chế phê duyệt ngân sách mua sắm tài sản',
    'hạn mức ký duyệt hợp đồng kinh tế'
  ],
  patterns: [
    /(thẩm quyền phê duyệt|hạn mức ký duyệt|cần ceo duyệt|phê duyệt chi tiêu)/i
  ],
  sop: `🏛️ **QUY CHẾ THẨM QUYỀN PHÊ DUYỆT CHI TIÊU & ĐẦU TƯ:**
1. **Dưới 20.000.000 VNĐ:** Trưởng các phòng ban (Kế toán trưởng, Giám đốc kho) được quyền tự ký duyệt trong hạn mức ngân sách tháng đã phê duyệt.
2. **Từ 20.000.000 - 100.000.000 VNĐ:** Bắt buộc có chữ ký duyệt điện tử của Phó Giám đốc vận hành (COO) hoặc Giám đốc Điều hành (CEO).
3. **Trên 100.000.000 VNĐ hoặc hợp đồng thuê mặt bằng/đầu tư xe vận tải:** Phải thông qua Hội đồng Quản trị và CEO phê chuẩn bằng văn bản.`
});

// Kỹ năng 15: Thống kê yêu cầu đổi trả và bảo hành sản phẩm (RMA)
adminCeoTrainer.addSkill({
  id: 'RETURN_REQUESTS_SUMMARY',
  title: 'Thống kê yêu cầu đổi trả và bảo hành sản phẩm (RMA)',
  description: 'Tổng hợp số lượng và tiến độ xử lý các ca đổi trả, bảo hành hàng hóa',
  type: 'PRISMA_QUERY',
  examples: [
    'Tổng đơn hàng đổi trả trong năm nay',
    'tổng đơn hàng đổi trả trong năm nay',
    'có bao nhiêu đơn đổi trả',
    'thống kê đơn hàng đổi trả',
    'danh sách yêu cầu đổi trả rma',
    'tình hình đổi trả hàng năm nay',
    'các ca bảo hành đổi trả của khách'
  ],
  patterns: [
    /(đổi trả|đơn.*đổi trả|yêu cầu đổi trả|rma|trả hàng|bảo hành đổi trả)/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN', 'WAREHOUSE', 'QC_TECH', 'CSKH'],
  handler: async (prisma, params) => {
    const where = params && params.startDate ? { createdAt: { gte: params.startDate } } : {};
    return await prisma.returnRequest.findMany({
      where,
      select: {
        rmaCode: true,
        orderId: true,
        customerName: true,
        status: true,
        reason: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
  },
  template: (data) => {
    if (!data || data.length === 0) {
      return '🎉 **Tuyệt vời! Không ghi nhận yêu cầu đổi trả hoặc bảo hành nào trong thời gian này.**';
    }
    let res = `🔄 **BÁO CÁO TỔNG HỢP YÊU CẦU ĐỔI TRẢ & BẢO HÀNH (RMA):**\n\n` +
              `- Tổng số ca ghi nhận: **${data.length} trường hợp**\n\n`;
    data.forEach((r, idx) => {
      const dateStr = formatDateVN(r.createdAt);
      res += `${idx + 1}. **[${r.rmaCode}]** - Đơn hàng: **#${r.orderId}**\n` +
             `   Khách hàng: **${r.customerName || 'N/A'}** | Trạng thái: \`${r.status}\`\n` +
             `   Lý do: *${r.reason || 'Lỗi linh kiện'}* (${dateStr})\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 16: Thống kê khiếu nại CSKH và ticket đã xử lý xong
adminCeoTrainer.addSkill({
  id: 'RESOLVED_COMPLAINTS_TICKETS',
  title: 'Thống kê khiếu nại CSKH và ticket đã xử lý xong',
  description: 'Báo cáo chi tiết các ticket hoặc khiếu nại khách hàng đã giải quyết thành công',
  type: 'PRISMA_QUERY',
  examples: [
    'đã xử lí được mấy cái rồi',
    'đã xử lý được mấy cái rồi',
    'đã xử lý được bao nhiêu khiếu nại',
    'bao nhiêu ticket đã giải quyết xong',
    'số khiếu nại đã hoàn tất',
    'các ticket đã xử lý xong',
    'khiếu nại đã đóng'
  ],
  patterns: [
    /(đã xử l[íy]|đã giải quyết|hoàn tất).*(ticket|khiếu nại|phàn nàn|cái|trường hợp)/i,
    /(đã xử l[íy] được mấy cái|xử l[íy] được bao nhiêu cái)/i,
    /(ticket|khiếu nại).*(đã xong|đã đóng|đã giải quyết|thành công)/i
  ],
  allowedRoles: ['ADMIN_CEO', 'ADMIN', 'CSKH'],
  handler: async (prisma) => {
    return await prisma.complaint.findMany({
      where: { status: { in: ['RESOLVED', 'CLOSED'] } },
      select: {
        id: true,
        orderId: true,
        customerName: true,
        subject: true,
        status: true,
        resolutionNote: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });
  },
  template: (data) => {
    if (!data || data.length === 0) {
      return 'ℹ️ **Hiện chưa có khiếu nại nào được đóng trạng thái HOÀN TẤT (RESOLVED / CLOSED).**';
    }
    let res = `✅ **TIẾN ĐỘ XỬ LÝ KHIẾU NẠI & TICKET CSKH:**\n\n` +
              `- Số ca đã xử lý hoàn tất: **${data.length} trường hợp**\n\n`;
    data.forEach((c, idx) => {
      res += `${idx + 1}. **${c.customerName || 'Khách hàng'}** (Đơn #${c.orderId || 'N/A'})\n` +
             `   Vấn đề: *${c.subject || 'Khiếu nại sản phẩm'}*\n` +
             `   Kết quả xử lý: **${c.resolutionNote || 'Đã hướng dẫn và hỗ trợ khách thành công.'}**\n`;
    });
    return res.trim();
  }
});

module.exports = adminCeoTrainer;

