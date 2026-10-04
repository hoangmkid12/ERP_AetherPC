/**
 * SALES TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO BỘ PHẬN KINH DOANH & TƯ VẤN BÁN HÀNG
 * Thiết kế chuẩn hóa theo Giai đoạn 1: Intent Catalog + Parameterized Prisma Handlers
 */

const BaseActorTrainer = require('./BaseActorTrainer');
const { getStartOfDay, getStartOfMonth, formatVND } = require('../utils/dateHelper');

const salesTrainer = new BaseActorTrainer({
  role: 'SALES',
  name: 'Kinh doanh & Tư vấn Bán lẻ PC',
  systemPrompt: `BẠN LÀ TRỢ LÝ TƯ VẤN BÁN HÀNG & CHUYÊN GIA BUILD PC CAO CẤP AETHERPC:
- PHONG CÁCH: Thân thiện, nhạy bén, am hiểu phần cứng PC chuyên sâu, hướng tới chốt sale hiệu quả.
- THÔNG TIN ƯU TIÊN:
  1. Tình trạng còn hàng (Stock Quantity > 0) và giá bán lẻ niêm yết.
  2. Tính tương thích phần cứng: Cấu hình có bị nghẽn cổ chai (bottleneck) không, nguồn kéo có dư tải không.
  3. Chính sách hậu mãi: Bảo hành 1 đổi 1, quà tặng kèm theo bộ PC.
  4. Mức chiết khấu tối đa được phép áp dụng cho khách.`
});

// ============================================================================
// 1. NHÓM KỸ NĂNG TRUY VẤN DỮ LIỆU PRISMA (TYPE-SAFE HANDLERS)
// ============================================================================

// Kỹ năng 1: Tra cứu giá bán lẻ & tồn kho sản phẩm cụ thể
salesTrainer.addSkill({
  id: 'PRODUCT_PRICE_STOCK',
  title: 'Tra cứu giá bán lẻ và tồn kho khả dụng',
  description: 'Tìm kiếm sản phẩm theo tên hoặc mã để báo giá cho khách',
  type: 'PRISMA_QUERY',
  examples: [
    'card rtx 4070 còn hàng không và giá bao nhiêu?',
    'card rtx 4070 còn hàng không và giá bao nhiêu',
    'giá bán cpu intel core i5 13400f hiện tại',
    'ram ddr5 corsair dominator giá thế nào',
    'trong kho còn mấy chiếc mainboard b760m',
    'báo giá cho tôi con vga 4060',
    'sản phẩm này giá bao nhiêu và còn tồn không'
  ],
  patterns: [
    /(giá bao nhiêu|còn hàng không|còn mấy cái|báo giá|tồn kho.*linh kiện|giá.*hiện tại)/i
  ],
  allowedRoles: ['SALES', 'ADMIN_CEO', 'ADMIN', 'WAREHOUSE'],
  handler: async (prisma, params, _user) => {
    const rawKw = params.productName || params.keyword || '';
    return await prisma.product.findMany({
      where: {
        ...(rawKw ? { name: { contains: rawKw, mode: 'insensitive' } } : { stockQuantity: { gt: 0 } }),
        status: 'ACTIVE'
      },
      select: {
        productId: true,
        name: true,
        sku: true,
        price: true,
        stockQuantity: true
      },
      orderBy: { stockQuantity: 'desc' },
      take: 10
    });
  },
  template: (products, params) => {
    if (!products || products.length === 0) {
      return `❌ **Không tìm thấy sản phẩm nào khớp với từ khóa "${params?.productName || ''}".**`;
    }
    let res = `🔎 **THÔNG TIN GIÁ BÁN & TỒN KHO LINH KIỆN:**\n\n`;
    products.forEach((p, idx) => {
      const stockStatus = p.stockQuantity > 0 ? `Còn hàng (**${p.stockQuantity}** cái)` : `❌ Tạm hết hàng`;
      res += `${idx + 1}. **${p.name}**\n`;
      res += `   💰 Giá niêm yết: **${formatVND(p.price)}** | Tồn kho: ${stockStatus}\n`;
    });
    return res.trim();
  },
  sql: (_userId, lower) => {
    const hwMatch = lower.match(/(rtx\s?\d{4}(?:\s?(?:ti|super))?|gtx\s?\d{4}|rx\s?\d{4}(?:\s?xt)?|core\s?i[3579][\w-]*|ryzen\s?[3579][\w-]*|b\d{3}|z\d{3})/i);
    const kw = hwMatch ? hwMatch[1].trim() : '';
    if (kw) {
      return `SELECT product_id, name, sku, price, stock_quantity FROM products WHERE name ILIKE '%${kw}%' AND status = 'ACTIVE' ORDER BY stock_quantity DESC LIMIT 10;`;
    }
    return `SELECT product_id, name, sku, price, stock_quantity FROM products WHERE stock_quantity > 0 AND status = 'ACTIVE' ORDER BY stock_quantity DESC LIMIT 10;`;
  }
});

// Kỹ năng 2: Tư vấn tương thích CPU và Bo mạch chủ (Compatibility)
salesTrainer.addSkill({
  id: 'CHECK_CPU_MOTHERBOARD_COMPATIBILITY',
  title: 'Tư vấn tương thích CPU Intel / AMD và Bo mạch chủ',
  description: 'Hướng dẫn phối ghép Socket LGA1700, AM5 và chipset B760, Z790',
  type: 'PRISMA_QUERY',
  examples: [
    'cpu i5 13400f lắp với main b760 có tương thích không?',
    'mainboard b760m cắm được i7 14700k không',
    'ryzen 7 7800x3d đi với bo mạch chủ nào',
    'tư vấn mainboard phù hợp cho cpu intel gen 14',
    'cpu này có gắn vừa bo mạch chủ kia không'
  ],
  patterns: [
    /(tương thích|lắp được không|cắm được không|đi với main nào|socket.*gắn vừa)/i
  ],
  allowedRoles: ['SALES', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    // Trả về top bo mạch chủ bán chạy
    return await prisma.product.findMany({
      where: {
        category: {
          OR: [
            { slug: { contains: 'main', mode: 'insensitive' } },
            { name: { contains: 'bo mạch', mode: 'insensitive' } }
          ]
        },
        stockQuantity: { gt: 0 }
      },
      select: { name: true, price: true, stockQuantity: true },
      take: 5
    });
  },
  template: (mbs) => {
    let res = `🔧 **TƯ VẤN ĐỘ TƯƠNG THÍCH PHẦN CỨNG:**\n\n` +
              `1. **Intel Gen 12/13/14 (LGA1700):** Tương thích 100% với các bo mạch chủ chipset **H610, B760, Z790** (với i7/i9 khuyến nghị dùng B760 dàn VRM tốt hoặc Z790).\n` +
              `2. **AMD Ryzen 7000/8000/9000 (Socket AM5):** Tương thích với **B650, X670** và chuẩn RAM DDR5 bắt buộc.\n\n` +
              `👉 **CÁC DÒNG BO MẠCH CHỦ CÓ SẴN TRONG KHO:**\n`;
    mbs.forEach((m, idx) => {
      res += `${idx + 1}. **${m.name}** - ${formatVND(m.price)} (Còn ${m.stockQuantity} cái)\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 3: Tư vấn nguồn công suất thực phù hợp cấu hình
salesTrainer.addSkill({
  id: 'PSU_RECOMMENDATION',
  title: 'Gợi ý nguồn máy tính (PSU) phù hợp cấu hình',
  description: 'Tra cứu các mã nguồn 550W - 850W tương thích',
  type: 'PRISMA_QUERY',
  examples: [
    'cấu hình i5 13400 + rtx 4060 cần nguồn bao nhiêu watt',
    'rtx 4070 super dùng nguồn 650w có đủ không',
    'tư vấn nguồn cho dàn i7 và vga 4080',
    'nguồn bao nhiêu watt để kéo rtx 4070'
  ],
  patterns: [
    /(nguồn bao nhiêu watt|cần nguồn bao nhiêu|nguồn.*đủ không|nguồn.*kéo nổi)/i
  ],
  allowedRoles: ['SALES', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.product.findMany({
      where: {
        category: {
          OR: [
            { slug: { contains: 'psu', mode: 'insensitive' } },
            { slug: { contains: 'nguon', mode: 'insensitive' } }
          ]
        },
        stockQuantity: { gt: 0 },
        status: 'ACTIVE'
      },
      select: {
        productId: true,
        name: true,
        price: true,
        stockQuantity: true
      },
      orderBy: { price: 'asc' },
      take: 10
    });
  },
  template: (psus) => {
    if (!psus || psus.length === 0) {
      return '⚠️ **Hiện các mã nguồn máy tính phù hợp đang tạm hết hàng trong kho.**';
    }
    let res = `⚡ **DANH SÁCH BỘ NGUỒN CÔNG SUẤT THỰC (PSU) KHUYẾN NGHỊ:**\n\n`;
    psus.forEach((p, idx) => {
      res += `${idx + 1}. **${p.name}**\n`;
      res += `   Giá bán: **${formatVND(p.price)}** (Còn ${p.stockQuantity} chiếc)\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT p.name, p.price, p.stock_quantity, p.specs FROM products p JOIN categories c ON c.id = p.category_id WHERE (c.slug ILIKE '%psu%' OR c.slug ILIKE '%nguon%') AND p.stock_quantity > 0 ORDER BY p.price ASC LIMIT 10;`
});

// Kỹ năng 4: Sản phẩm đang có khuyến mãi giảm giá
salesTrainer.addSkill({
  id: 'ACTIVE_PROMOTIONS',
  title: 'Danh sách sản phẩm đang có chiết khấu giảm giá',
  description: 'Tìm các linh kiện đang sale tốt để giới thiệu khách hàng',
  type: 'PRISMA_QUERY',
  examples: [
    'danh sách sản phẩm đang có chương trình giảm giá tốt?',
    'danh sách sản phẩm đang có chương trình giảm giá tốt',
    'hôm nay có linh kiện nào đang sale không',
    'sản phẩm có mức chiết khấu cao',
    'linh kiện giảm giá hot',
    'các mặt hàng đang có ưu đãi lớn'
  ],
  patterns: [
    /(giảm giá|khuyến mãi|sale|chiết khấu cao|ưu đãi)/i
  ],
  allowedRoles: ['SALES', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.product.findMany({
      where: {
        discountPercent: { gt: 0 },
        stockQuantity: { gt: 0 },
        status: 'ACTIVE'
      },
      select: {
        productId: true,
        name: true,
        price: true,
        discountPercent: true,
        stockQuantity: true
      },
      orderBy: { discountPercent: 'desc' },
      take: 15
    });
  },
  template: (promotions) => {
    if (!promotions || promotions.length === 0) {
      return 'Hiện tại chưa có chương trình giảm giá trực tiếp cho linh kiện.';
    }
    let res = `🔥 **TOP CÁC LINH KIỆN GIẢM GIÁ TỐT NHẤT HÔM NAY:**\n\n`;
    promotions.forEach((p, idx) => {
      res += `${idx + 1}. **${p.name}**\n`;
      res += `   Giảm: 🔥 **-${p.discountPercent}%** | Giá ưu đãi: **${formatVND(p.price)}** (Tồn: ${p.stockQuantity})\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT product_id, name, original_price, price, discount_percent, stock_quantity FROM products WHERE discount_percent > 0 AND stock_quantity > 0 AND status = 'ACTIVE' ORDER BY discount_percent DESC LIMIT 15;`
});

// Kỹ năng 5: Doanh số cá nhân của nhân viên Sales
salesTrainer.addSkill({
  id: 'SALES_MY_PERFORMANCE',
  title: 'Doanh số bán hàng cá nhân của nhân viên Sales',
  description: 'Thống kê số đơn chốt và tổng tiền bán được của nhân viên theo ngày hoặc tháng',
  type: 'PRISMA_QUERY',
  examples: [
    'tháng này tôi đã bán được bao nhiêu doanh số?',
    'tháng này tôi đã bán được bao nhiêu doanh số',
    'hôm nay tôi đã bán được bao nhiêu tiền doanh số',
    'doanh số cá nhân của tôi hôm nay',
    'tôi chốt được mấy đơn rồi',
    'hôm nay bán được bao nhiêu',
    'tổng kết số đơn tôi bán được trong tháng'
  ],
  patterns: [
    /(doanh số.*(của tôi|tôi bán)|tôi bán được bao nhiêu|tôi chốt được mấy đơn)/i
  ],
  allowedRoles: ['SALES', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params, user) => {
    const isMonth = /(tháng|thang)/i.test(params.period || '');
    const since = isMonth ? getStartOfMonth() : getStartOfDay();
    const sellerId = Number(user.id || params.userId || 0);

    const res = await prisma.order.aggregate({
      where: {
        soldById: sellerId,
        createdAt: { gte: since }
      },
      _count: { orderId: true },
      _sum: { totalAmount: true }
    });

    return {
      period: isMonth ? 'tháng này' : 'hôm nay',
      orderCount: res._count.orderId || 0,
      revenue: Number(res._sum.totalAmount || 0)
    };
  },
  template: (data) => {
    return `🎯 **KẾT QUẢ KINH DOANH CÁ NHÂN (${data.period.toUpperCase()}):**\n\n` +
           `- Số đơn đã chốt: **${data.orderCount} đơn**\n` +
           `- Tổng doanh số bán: **${formatVND(data.revenue)}**\n` +
           `Hoa hồng ước tính 1%: **${formatVND(data.revenue * 0.01)}**. Tiếp tục chốt đơn nhé!`;
  },
  sql: (userId, lower) => {
    const isMonth = /(tháng|thang)/i.test(lower || '');
    const dateTrunc = isMonth ? 'month' : 'day';
    return `SELECT COUNT(order_id) AS so_don_da_chot, COALESCE(SUM(total_amount), 0) AS doanh_so_ca_nhan FROM orders WHERE sold_by_id = ${userId || ':userId'} AND created_at >= date_trunc('${dateTrunc}', now() AT TIME ZONE 'Asia/Ho_Chi_Minh');`
  }
});

// Kỹ năng 6: Danh sách khách hàng VIP
salesTrainer.addSkill({
  id: 'VIP_CUSTOMERS_LIST',
  title: 'Danh sách khách hàng VIP nhất công ty',
  description: 'Khách hàng hạng Kim Cương, Vàng có điểm tích lũy cao',
  type: 'PRISMA_QUERY',
  examples: [
    'danh sách khách hàng vip nhất của công ty',
    'khách hàng mua nhiều nhất',
    'top khách hàng tích điểm cao',
    'danh sách khách vip',
    'những khách hàng thân thiết hàng đầu'
  ],
  patterns: [
    /(khách hàng vip|khách vip|mua nhiều nhất|tích điểm cao|hạng kim cương)/i
  ],
  allowedRoles: ['SALES', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.customer.findMany({
      select: {
        customerId: true,
        name: true,
        phone: true,
        tier: true,
        loyaltyPoints: true
      },
      orderBy: { loyaltyPoints: 'desc' },
      take: 10
    });
  },
  template: (vips) => {
    if (!vips || vips.length === 0) {
      return 'Chưa có dữ liệu khách hàng VIP.';
    }
    let res = `👑 **TOP KHÁCH HÀNG THÂN THIẾT / VIP CỦA AETHERPC:**\n\n`;
    vips.forEach((v, idx) => {
      res += `${idx + 1}. **${v.name}** (${v.phone || 'SĐT ẩn'})\n`;
      res += `   Hạng: 💎 \`${v.tier || 'STANDARD'}\` | Điểm tích lũy: **${v.loyaltyPoints} điểm**\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT customer_id, name, phone, tier, loyalty_points FROM customers ORDER BY loyalty_points DESC LIMIT 10;`
});

// Kỹ năng 7: Gợi ý cấu hình PC trọn bộ theo tầm giá ngân sách
salesTrainer.addSkill({
  id: 'PC_BUILD_RECOMMENDATION_BY_BUDGET',
  title: 'Gợi ý cấu hình PC trọn bộ theo tầm giá ngân sách (15tr - 25tr - 40tr)',
  description: 'Tư vấn nhanh bộ linh kiện tối ưu cho nhu cầu Esports, Đồ họa 2K, High-end Gaming',
  type: 'PRISMA_QUERY',
  examples: [
    'tư vấn cấu hình pc tầm 15 triệu',
    'build pc 15 triệu chơi game esports',
    'build pc 25 triệu chơi game',
    'dàn máy 40 triệu làm đồ họa',
    'gợi ý cấu hình theo ngân sách',
    'tầm 20 triệu thì ráp máy thế nào',
    'tư vấn máy tính ngân sách 15tr',
    'cấu hình máy 25 triệu tối ưu nhất'
  ],
  patterns: [
    /(tầm|ngân sách|khoảng).*(15|20|25|30|40|50).*(triệu|tr)/i,
    /(build pc|cấu hình pc|ráp máy).*(tầm giá|ngân sách|triệu)/i
  ],
  allowedRoles: ['SALES', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params) => {
    // Tìm các linh kiện tiêu biểu có sẵn trong kho
    const gpus = await prisma.product.findMany({
      where: {
        category: { slug: { contains: 'vga', mode: 'insensitive' } },
        stockQuantity: { gt: 0 }
      },
      select: { name: true, price: true },
      take: 3
    });
    return {
      budgetStr: params?.budget || 'phổ thông',
      availableGpus: gpus
    };
  },
  template: (data) => {
    return `🖥️ **BẢNG GỢI Ý CẤU HÌNH PC TỐI ƯU HIỆU NĂNG / GIÁ THÀNH AETHERPC:**\n\n` +
           `1. 🎯 **Phân khúc 15 Triệu (Esports / Học tập - Làm việc):**\n` +
           `   - CPU: Intel Core i5 12400F / Ryzen 5 5600\n` +
           `   - Mainboard: B760M / B550M Pro\n` +
           `   - RAM: 16GB DDR4 3200MHz | SSD: 512GB NVMe M.2\n` +
           `   - VGA: GTX 1660 Super 6GB / RTX 3050 6GB\n` +
           `   - Nguồn: 550W 80 Plus Bronze | Vỏ case kính cường lực kèm 3 Fan LED\n\n` +
           `2. 🔥 **Phân khúc 25 Triệu (Gaming 2K / Stream / Edit Video 4K):**\n` +
           `   - CPU: Intel Core i5 13400F / i5 14400F\n` +
           `   - Mainboard: B760M Gaming Plus WiFi\n` +
           `   - RAM: 32GB (2x16GB) DDR5 5600MHz | SSD: 1TB NVMe Gen4\n` +
           `   - VGA: NVIDIA GeForce RTX 4060 8GB / RTX 4060Ti\n` +
           `   - Nguồn: 650W 80 Plus Bronze | Tản nhiệt khí Deepcool AK400 Digital\n\n` +
           `3. 👑 **Phân khúc 40+ Triệu (High-End 4K / Render 3D / AI Training):**\n` +
           `   - CPU: Intel Core i7 14700K / AMD Ryzen 7 7800X3D\n` +
           `   - Mainboard: Z790 AORUS Elite / X670E Gaming\n` +
           `   - RAM: 32GB - 64GB DDR5 6000MHz RGB\n` +
           `   - VGA: NVIDIA GeForce RTX 4070Ti Super 16GB / RTX 4080 Super\n` +
           `   - Nguồn: 850W 80 Plus Gold Modular | Tản nhiệt nước AIO 360mm ARGB\n\n` +
           `*Tất cả cấu hình được tặng kèm gói cân màu màn hình + bảo hành 1 đổi 1 trong 30 ngày!*`;
  }
});

// Kỹ năng 8: Tra cứu điểm tích lũy và hạng thành viên khách hàng theo SĐT
salesTrainer.addSkill({
  id: 'CUSTOMER_LOYALTY_CHECK',
  title: 'Tra cứu điểm thưởng tích lũy và hạng thành viên khách hàng',
  description: 'Kiểm tra nhanh quyền lợi chiết khấu và điểm tích lũy khi khách ghé mua sắm',
  type: 'PRISMA_QUERY',
  examples: [
    'kiểm tra điểm tích lũy của khách hàng',
    'tra cứu hạng thẻ thành viên theo sđt',
    'khách này có bao nhiêu điểm thưởng',
    'xem thẻ tích điểm khách hàng',
    'tra cứu thông tin điểm tích lũy của khách'
  ],
  patterns: [
    /(điểm tích lũy|điểm thưởng|hạng thành viên|hạng thẻ|tra cứu khách)/i
  ],
  allowedRoles: ['SALES', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma, params) => {
    const phone = params?.phone || params?.customerPhone;
    if (phone) {
      const customer = await prisma.customer.findFirst({
        where: { phone: { contains: phone } },
        select: { customerId: true, name: true, phone: true, tier: true, loyaltyPoints: true }
      });
      return customer ? [customer] : [];
    }

    // Nếu không truyền phone cụ thể, trả về 5 khách hàng có tương tác gần nhất
    return await prisma.customer.findMany({
      select: {
        customerId: true,
        name: true,
        phone: true,
        tier: true,
        loyaltyPoints: true
      },
      orderBy: { loyaltyPoints: 'desc' },
      take: 5
    });
  },
  template: (customers) => {
    if (!customers || customers.length === 0) {
      return '❌ Không tìm thấy thông tin khách hàng nào trên hệ thống.';
    }
    let res = `🎖️ **THÔNG TIN ĐIỂM TÍCH LŨY & HẠNG THÀNH VIÊN:**\n\n`;
    customers.forEach((c, idx) => {
      res += `${idx + 1}. Khách hàng: **${c.name}** (SĐT: ${c.phone || 'Ẩn'})\n`;
      res += `   - Hạng thẻ: 🏷️ \`${c.tier || 'STANDARD'}\`\n`;
      res += `   - Điểm thưởng khả dụng: **${c.loyaltyPoints} điểm** (Tương đương chiết khấu ${formatVND(c.loyaltyPoints * 1000)})\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 9: Gợi ý phụ kiện đi kèm khi build PC (Gear & Monitor Cross-sell)
salesTrainer.addSkill({
  id: 'CROSS_SELL_ACCESSORIES',
  title: 'Gợi ý phụ kiện gaming và màn hình bán kèm (Cross-sell)',
  description: 'Gợi ý combo màn hình tần số quét cao, phím cơ, chuột gaming đi kèm dàn PC',
  type: 'PRISMA_QUERY',
  examples: [
    'gợi ý màn hình và bàn phím chuột đi kèm',
    'mua pc thì nên mua thêm gear gì',
    'tư vấn phụ kiện chuột bàn phím bán kèm',
    'combo gear cho dàn máy gaming',
    'tư vấn màn hình chơi game phù hợp'
  ],
  patterns: [
    /(phụ kiện đi kèm|gear.*đi kèm|màn hình.*bàn phím|cross-sell|combo gear)/i
  ],
  allowedRoles: ['SALES', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.product.findMany({
      where: {
        category: {
          OR: [
            { slug: { contains: 'man-hinh', mode: 'insensitive' } },
            { slug: { contains: 'phim', mode: 'insensitive' } },
            { slug: { contains: 'chuot', mode: 'insensitive' } },
            { slug: { contains: 'tai-nghe', mode: 'insensitive' } }
          ]
        },
        stockQuantity: { gt: 0 },
        status: 'ACTIVE'
      },
      select: {
        productId: true,
        name: true,
        price: true,
        stockQuantity: true
      },
      orderBy: { price: 'asc' },
      take: 6
    });
  },
  template: (gears) => {
    if (!gears || gears.length === 0) {
      return 'Các mặt hàng phụ kiện gear và màn hình hiện đang trong quá trình cập nhật tồn kho.';
    }
    let res = `🎧 **COMBO PHỤ KIỆN & MÀN HÌNH KHUYẾN NGHỊ BÁN KÈM DÀN PC:**\n\n`;
    gears.forEach((g, idx) => {
      res += `${idx + 1}. **${g.name}**\n`;
      res += `   Giá ưu đãi mua kèm PC: **${formatVND(g.price)}** (Còn ${g.stockQuantity} chiếc)\n`;
    });
    res += `\n*Ưu đãi đặc biệt: Mua trọn bộ PC + Màn hình được tặng ngay Lót chuột cỡ lớn RGB 80x30cm!*`;
    return res.trim();
  }
});

// Kỹ năng 10: Tra cứu đánh giá nhận xét của khách hàng về sản phẩm (Product Review)
salesTrainer.addSkill({
  id: 'CHECK_PRODUCT_REVIEW_RATING',
  title: 'Tra cứu đánh giá nhận xét và độ hài lòng của khách hàng',
  description: 'Xem các nhận xét thực tế 5 sao của người mua đối với sản phẩm',
  type: 'PRISMA_QUERY',
  examples: [
    'sản phẩm này khách đánh giá thế nào',
    'linh kiện nào được đánh giá 5 sao nhiều nhất',
    'khách nhận xét gì về card đồ họa này',
    'đánh giá của khách hàng về linh kiện',
    'phản hồi người dùng về sản phẩm'
  ],
  patterns: [
    /(khách đánh giá|nhận xét.*sản phẩm|đánh giá 5 sao|phản hồi.*linh kiện)/i
  ],
  allowedRoles: ['SALES', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.productReview.findMany({
      where: { rating: { gte: 4 } },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        product: { select: { name: true } },
        customer: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
  },
  template: (reviews) => {
    if (!reviews || reviews.length === 0) {
      return 'Hiện tại chưa có đánh giá công khai nào cho danh mục sản phẩm này.';
    }
    let res = `⭐ **TOP PHẢN HỒI ĐÁNH GIÁ TÍCH CỰC TỪ KHÁCH MUA HÀNG:**\n\n`;
    reviews.forEach((r, idx) => {
      const stars = '⭐'.repeat(r.rating);
      res += `${idx + 1}. **${r.product.name}** - ${stars} (${r.rating}/5)\n`;
      res += `   Khách: ${r.customer?.name || 'Ẩn danh'}: "${r.comment || 'Sản phẩm dùng rất tốt, mượt mà, đóng gói cẩn thận.'}"\n`;
    });
    return res.trim();
  }
});

// ============================================================================
// 2. NHÓM KỸ NĂNG QUY TRÌNH & TRI THỨC VĂN BẢN (KNOWLEDGE SOP)
// ============================================================================

// Kỹ năng 11: Chính sách mua PC trả góp 0%
salesTrainer.addSkill({
  id: 'SOP_INSTALLMENT_POLICY',
  title: 'Chính sách mua PC trả góp 0% qua thẻ tín dụng và CCCD',
  description: 'Điều kiện trả góp HD Saison, Home Credit và chuyển đổi trả góp thẻ',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'mua pc trả góp 0% như thế nào',
    'chính sách trả góp qua thẻ tín dụng',
    'trả góp qua căn cước công dân cần trả trước bao nhiêu',
    'điều kiện mua trả góp linh kiện'
  ],
  patterns: [
    /(trả góp|lãi suất 0%|trả trước bao nhiêu|thẻ tín dụng.*trả góp)/i
  ],
  sop: `💳 **HƯỚNG DẪN TƯ VẤN MUA HÀNG TRẢ GÓP:**
1. **Trả góp 0% qua Thẻ Tín Dụng (Visa/Mastercard):** Hỗ trợ qua 25 ngân hàng đối tác (mPOS), kỳ hạn 3 - 6 - 9 - 12 tháng. Phí chuyển đổi từ 2.5% - 4.5% tùy ngân hàng.
2. **Trả góp qua CCCD (Công ty tài chính):** Khách đủ 18 tuổi trở lên, trả trước tối thiểu 20% giá trị bộ máy, duyệt hồ sơ online trong 15 phút.
3. **Áp dụng:** Cho toàn bộ dàn PC Full Bộ hoặc hóa đơn linh kiện từ 3.000.000 VNĐ trở lên.`
});

// Kỹ năng 12: Chính sách bảo hành 1 đổi 1 trong 30 ngày
salesTrainer.addSkill({
  id: 'SOP_WARRANTY_POLICY',
  title: 'Chính sách bảo hành 1 đổi 1 trong 30 ngày đầu',
  description: 'Quy định đổi mới linh kiện và điều kiện bảo hành máy nguyên bộ',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'chính sách bảo hành đổi trả 1 đổi 1 của công ty thế nào',
    'quy định đổi trả linh kiện trong 30 ngày đầu',
    'điều kiện để khách hàng được áp dụng chính sách đổi mới 100%',
    'máy nguyên bộ được bảo hành tận nơi bao lâu'
  ],
  patterns: [
    /(bảo hành 1 đổi 1|đổi trả 1 đổi 1|đổi mới 100%|bảo hành tận nơi)/i
  ],
  sop: `🛡️ **CHÍNH SÁCH BẢO HÀNH AETHERPC CHO KHÁCH HÀNG:**
1. **Linh kiện rời:** Đổi mới 100% trong 30 ngày đầu nếu phát sinh lỗi phần cứng từ nhà sản xuất (phải còn nguyên hộp, số serial trùng khớp, tem không rách).
2. **Bộ máy nguyên bộ (PC Full Set):** Bảo hành tận nơi nội thành 12 tháng đầu tiên. Hỗ trợ cho mượn linh kiện thay thế tương đương trong thời gian chờ thẩm định RMA.
3. **Từ chối bảo hành đổi mới:** Cháy nổ chip, cong chân socket CPU do tự lắp đặt sai, vô nước hoặc rơi vỡ móp méo vỏ linh kiện.`
});

// Kỹ năng 13: Quy chế duyệt chiết khấu khách VIP & B2B
salesTrainer.addSkill({
  id: 'SOP_VIP_DISCOUNT_POLICY',
  title: 'Quy chế duyệt chiết khấu cho khách VIP và khách B2B',
  description: 'Hạn mức giảm giá nhân viên sales được quyền tự quyết',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy chế duyệt chiết khấu cho khách vip và khách doanh nghiệp b2b',
    'đơn hàng pc trên 50 triệu có mức giảm giá chiết khấu ra sao',
    'quy định về mức giảm giá tối đa nhân viên sales được tự quyết'
  ],
  patterns: [
    /(chiết khấu.*vip|chiết khấu.*b2b|giảm giá.*50 triệu|tự quyết.*giảm giá)/i
  ],
  sop: `🎁 **HƯỚNG DẪN MỨC GIẢM GIÁ CHO NHÂN VIÊN SALES:**
1. **Khách hàng Bạc / Vàng:** Tự động áp dụng giảm 1% - 2% trên tổng hóa đơn.
2. **Khách hàng Kim Cương:** Giảm 3% và tặng gói vệ sinh PC trọn đời máy.
3. **Đơn hàng trên 50 triệu:** Nhân viên Sales được quyền tự quyết giảm tối đa 2.5%. Nếu khách yêu cầu giảm trên 3% bắt buộc phải có Trưởng phòng Sales (SALES_MANAGER) duyệt trên phần mềm.`
});

// Kỹ năng 14: Quy trình gửi báo giá dự toán bằng file PDF cho khách hàng B2B
salesTrainer.addSkill({
  id: 'SOP_QUOTATION_PROPOSAL',
  title: 'Quy trình lập và gửi báo giá dự toán cho khách hàng doanh nghiệp',
  description: 'Các bước lập bảng báo giá có dấu mộc công ty cho trường học, công ty thiết kế',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy trình gửi báo giá dự toán cho khách công ty',
    'thủ tục xuất file báo giá pdf b2b',
    'cách làm báo giá cho khách doanh nghiệp',
    'báo giá có hiệu lực trong bao lâu'
  ],
  patterns: [
    /(báo giá dự toán|báo giá b2b|báo giá pdf|báo giá công ty)/i
  ],
  sop: `📄 **QUY TRÌNH LẬP VÀ GỬI BÁO GIÁ DỰ TOÁN B2B:**
1. **Lập bảng cấu hình:** Nhân viên Sales nhập danh sách linh kiện lên phân hệ Báo giá trên ERP AetherPC.
2. **Thời hạn hiệu lực:** Báo giá mặc định có hiệu lực trong vòng 07 ngày kể từ ngày xuất (do biến động giá VGA/RAM).
3. **Phê duyệt:** Với báo giá phòng Net hoặc doanh nghiệp trên 100 triệu, cần Trưởng bộ phận B2B ký số điện tử trước khi gửi file PDF cho khách.`
});

// Kỹ năng 15: Quy trình chăm sóc khách hàng sau bán hàng và bảo dưỡng định kỳ
salesTrainer.addSkill({
  id: 'SOP_CUSTOMER_CARE_AFTER_SALES',
  title: 'Quy trình chăm sóc sau bán hàng và nhắc bảo dưỡng vệ sinh máy',
  description: 'Lịch trình tương tác với khách mua máy để gia tăng độ trung thành',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy trình chăm sóc khách hàng sau bán',
    'khi nào gọi điện hỏi thăm khách sau khi mua pc',
    'chính sách nhắc bảo dưỡng vệ sinh máy định kỳ',
    'chăm sóc khách hàng sau khi nhận máy'
  ],
  patterns: [
    /(chăm sóc.*sau bán|hỏi thăm khách|bảo dưỡng định kỳ|vệ sinh máy định kỳ)/i
  ],
  sop: `🤝 **LỊCH TRÌNH CHĂM SÓC KHÁCH HÀNG SAU BÁN (AFTER-SALES CARE):**
1. **Sau 3 ngày:** Nhân viên CSKH gọi điện kiểm tra máy vận hành ổn định không, có gặp khó khăn khi cài driver hay không.
2. **Sau 30 ngày:** Nhắn tin Zalo ZNS nhắc khách chính sách 1 đổi 1 sắp hết hạn và hỗ trợ giải đáp thắc mắc phát sinh.
3. **Sau 6 tháng:** Gửi mã voucher tặng gói vệ sinh tra keo tản nhiệt miễn phí tại cửa hàng AetherPC.`
});

module.exports = salesTrainer;

