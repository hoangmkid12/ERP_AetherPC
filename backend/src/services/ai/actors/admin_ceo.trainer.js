/**
 * ADMIN & CEO TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO BAN GIÁM ĐỐC & QUẢN TRỊ VIÊN
 * Thiết kế chuẩn hóa theo Giai đoạn 1: Intent Catalog + Parameterized Prisma Handlers
 */

const BaseActorTrainer = require('./BaseActorTrainer');
const { getStartOfYear, formatVND } = require('../utils/dateHelper');

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
    'báo cáo kết quả kinh doanh năm nay'
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
      totalOrders: res._count.orderId || 0,
      totalRevenue: Number(res._sum.totalAmount || 0),
      avgOrderValue: Math.round(Number(res._avg.totalAmount || 0))
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
    'tổng số nhân sự đang hoạt động'
  ],
  patterns: [
    /(nhân sự|nhân viên|cơ cấu nhân sự)/i
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
    'những linh kiện đem lại doanh thu cao'
  ],
  patterns: [
    /(top.*sản phẩm|sản phẩm.*doanh thu cao|mặt hàng bán chạy|sinh lời cao nhất)/i
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

// ============================================================================
// 2. NHÓM KỸ NĂNG QUY TRÌNH & TRI THỨC VĂN BẢN (KNOWLEDGE SOP)
// ============================================================================

// Kỹ năng 6: Chính sách an toàn thông tin & kiểm toán hệ thống
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

// Kỹ năng 7: Quy trình ứng phó khẩn cấp và phục hồi thảm họa
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

module.exports = adminCeoTrainer;
