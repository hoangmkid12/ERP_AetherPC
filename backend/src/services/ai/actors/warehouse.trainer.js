/**
 * WAREHOUSE TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO THỦ KHO & KỸ THUẬT LẮP RÁP PC
 * Thiết kế chuẩn hóa theo Giai đoạn 1: Intent Catalog + Parameterized Prisma Handlers
 */

const BaseActorTrainer = require('./BaseActorTrainer');
const { formatVND, formatDateVN } = require('../utils/dateHelper');

const warehouseTrainer = new BaseActorTrainer({
  role: 'WAREHOUSE',
  name: 'Thủ kho & Kỹ thuật viên Lắp ráp PC',
  systemPrompt: `BẠN LÀ TRỢ LÝ ĐỒNG HÀNH CHUYÊN BIỆT CHO THỦ KHO & KỸ THUẬT VIÊN LẮP RÁP PC AETHERPC:
- PHONG CÁCH: Chính xác, kỹ thuật cao, chú trọng an toàn linh kiện và tiêu chuẩn vận hành.
- THÔNG TIN ƯU TIÊN:
  1. Mã linh kiện (SKU / Part Number), số lượng tồn thực tế.
  2. Trạng thái đơn hàng: Chờ đóng gói (READY_TO_SHIP), Chờ lấy hàng.
  3. Tiêu chuẩn phần cứng: Công suất nguồn khuyến nghị, độ tương thích socket, nhiệt độ test benchmark.
- NGUYÊN TẮC: Luôn nhắc nhở an toàn tĩnh điện (ESD) và bọc túi khí chống bể vỡ kính case PC.`
});

// ============================================================================
// 1. NHÓM KỸ NĂNG TRUY VẤN DỮ LIỆU PRISMA (TYPE-SAFE HANDLERS)
// ============================================================================

// Kỹ năng 1: Đơn hàng chờ đóng gói xuất kho
warehouseTrainer.addSkill({
  id: 'READY_TO_SHIP_ORDERS',
  title: 'Tra cứu các đơn hàng cần đóng gói xuất kho',
  description: 'Danh sách đơn hàng đã xác nhận sẵn sàng đóng gói giao shipper',
  type: 'PRISMA_QUERY',
  examples: [
    'có bao nhiêu đơn đang chờ đóng gói xuất kho?',
    'có bao nhiêu đơn đang chờ đóng gói xuất kho',
    'danh sách đơn chờ xuất kho',
    'những đơn hàng cần đóng gói hôm nay',
    'đơn sẵn sàng bàn giao shipper',
    'danh sách hàng chờ đóng hộp xuất kho',
    'các đơn đã duyệt chờ thủ kho lấy hàng'
  ],
  patterns: [
    /(chờ đóng gói|xuất kho|đóng gói xuất kho|sẵn sàng giao|ready_to_ship|chờ lấy hàng)/i
  ],
  allowedRoles: ['WAREHOUSE', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.order.findMany({
      where: { status: 'READY_TO_SHIP' },
      select: {
        orderId: true,
        totalAmount: true,
        shippingAddress: true,
        shippingCity: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' },
      take: 20
    });
  },
  template: (orders) => {
    if (!orders || orders.length === 0) {
      return '📦 **Hiện tại kho không có đơn nào đang chờ đóng gói.** Tất cả đơn đã được xuất cho shipper!';
    }
    let res = `📦 **DANH SÁCH ${orders.length} ĐƠN HÀNG ĐANG CHỜ ĐÓNG GÓI XUẤT KHO:**\n\n`;
    orders.forEach((o, idx) => {
      res += `${idx + 1}. **Đơn #${o.orderId}** - Trị giá: ${formatVND(o.totalAmount)}\n`;
      res += `   📍 Nơi giao: ${o.shippingAddress} (${o.shippingCity || 'Nội thành'})\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT order_id, total_amount, shipping_address, status, created_at FROM orders WHERE status = 'READY_TO_SHIP' ORDER BY created_at ASC LIMIT 20;`
});

// Kỹ năng 2: Cảnh báo linh kiện hết hàng hoàn toàn
warehouseTrainer.addSkill({
  id: 'OUT_OF_STOCK_PRODUCTS',
  title: 'Cảnh báo linh kiện hết hàng trong kho',
  description: 'Lọc các sản phẩm có tồn kho bằng 0 để lên kế hoạch nhập hàng',
  type: 'PRISMA_QUERY',
  examples: [
    'linh kiện nào trong kho đang bị hết hàng hoàn toàn',
    'sản phẩm nào tồn kho bằng 0',
    'kho còn hàng nào bị cháy hàng không',
    'danh sách hàng hết tồn',
    'mặt hàng nào đã cạn kiệt trong kho'
  ],
  patterns: [
    /(hết hàng hoàn toàn|tồn.*bằng 0|tồn.*=.*0|cháy hàng|hết tồn|cạn kiệt)/i
  ],
  allowedRoles: ['WAREHOUSE', 'ADMIN_CEO', 'ADMIN', 'SALES'],
  handler: async (prisma) => {
    return await prisma.product.findMany({
      where: {
        stockQuantity: 0,
        status: 'ACTIVE'
      },
      select: {
        productId: true,
        name: true,
        sku: true,
        price: true
      },
      take: 20
    });
  },
  template: (products) => {
    if (!products || products.length === 0) {
      return '✅ **Kho hàng đang duy trì mức an toàn, không có mã linh kiện nào bị hết hàng hoàn toàn!**';
    }
    let res = `🚨 **CẢNH BÁO: CÓ ${products.length} MẶT HÀNG TỒN KHO = 0 CẦN LẬP PHIẾU NHẬP HÀNG (PO):**\n\n`;
    products.forEach((p, idx) => {
      res += `${idx + 1}. **${p.name}**\n`;
      res += `   SKU: \`${p.sku}\` | Giá bán: ${formatVND(p.price)}\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT product_id, name, sku, stock_quantity, price FROM products WHERE stock_quantity = 0 AND status = 'ACTIVE' LIMIT 20;`
});

// Kỹ năng 3: Sản phẩm tồn kho thấp sắp hết
warehouseTrainer.addSkill({
  id: 'LOW_STOCK_WARNING',
  title: 'Cảnh báo linh kiện sắp hết hàng (tồn kho dưới 5)',
  description: 'Lọc các sản phẩm còn dưới hoặc bằng 5 chiếc',
  type: 'PRISMA_QUERY',
  examples: [
    'những sản phẩm nào sắp hết hàng?',
    'những sản phẩm nào sắp hết hàng',
    'những sản phẩm nào sắp hết hàng cần cảnh báo',
    'linh kiện nào tồn kho thấp',
    'sản phẩm nào còn dưới 5 cái',
    'cảnh báo tồn kho linh kiện',
    'hàng nào sắp cạn cần đặt thêm'
  ],
  patterns: [
    /(sắp hết hàng|tồn kho thấp|cảnh báo tồn|sắp hết|dưới 5|sắp cạn)/i
  ],
  allowedRoles: ['WAREHOUSE', 'ADMIN_CEO', 'ADMIN', 'SALES'],
  handler: async (prisma) => {
    return await prisma.product.findMany({
      where: {
        stockQuantity: { gt: 0, lte: 5 },
        status: 'ACTIVE'
      },
      select: {
        productId: true,
        name: true,
        sku: true,
        stockQuantity: true,
        price: true
      },
      orderBy: { stockQuantity: 'asc' },
      take: 20
    });
  },
  template: (products) => {
    if (!products || products.length === 0) {
      return '✅ **Tất cả các sản phẩm đang có số lượng tồn kho trên mức cảnh báo (> 5 sản phẩm).**';
    }
    let res = `⚠️ **DANH SÁCH ${products.length} LINH KIỆN SẮP HẾT HÀNG (TỒN KHO $\\le$ 5):**\n\n`;
    products.forEach((p, idx) => {
      res += `${idx + 1}. **${p.name}**\n`;
      res += `   👉 Tồn kho còn lại: **${p.stockQuantity}** chiếc | SKU: \`${p.sku}\`\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT product_id, name, sku, stock_quantity, price FROM products WHERE stock_quantity > 0 AND stock_quantity <= 5 AND status = 'ACTIVE' ORDER BY stock_quantity ASC LIMIT 20;`
});

// Kỹ năng 4: Tồn kho nhóm Card đồ họa VGA
warehouseTrainer.addSkill({
  id: 'VGA_STOCK_LOOKUP',
  title: 'Kiểm tra tồn kho Card đồ họa VGA',
  description: 'Tra cứu số lượng tồn kho các dòng card màn hình trong kho',
  type: 'PRISMA_QUERY',
  examples: [
    'kiểm tra tồn kho linh kiện card màn hình vga hiện tại',
    'trong kho còn những card đồ họa nào',
    'card vga còn nhiều không',
    'tồn kho card đồ họa rtx',
    'danh sách các mã vga đang có sẵn trong kho'
  ],
  patterns: [
    /(tồn kho.*(vga|card màn hình|card đồ họa)|(vga|card đồ họa).*còn hàng)/i
  ],
  allowedRoles: ['WAREHOUSE', 'ADMIN_CEO', 'ADMIN', 'SALES'],
  handler: async (prisma) => {
    return await prisma.product.findMany({
      where: {
        category: {
          OR: [
            { slug: { contains: 'vga', mode: 'insensitive' } },
            { slug: { contains: 'card', mode: 'insensitive' } },
            { name: { contains: 'card', mode: 'insensitive' } }
          ]
        },
        status: 'ACTIVE'
      },
      select: {
        productId: true,
        name: true,
        sku: true,
        stockQuantity: true,
        price: true
      },
      orderBy: { stockQuantity: 'desc' },
      take: 20
    });
  },
  template: (vgas) => {
    if (!vgas || vgas.length === 0) {
      return '⚠️ **Hiện không tìm thấy dòng Card đồ họa VGA nào đang kinh doanh trong danh mục.**';
    }
    let res = `🎮 **TỒN KHO CÁC DÒNG CARD ĐỒ HỌA (VGA) TRONG KHO:**\n\n`;
    vgas.forEach((v, idx) => {
      res += `${idx + 1}. **${v.name}**\n`;
      res += `   Số lượng tồn: **${v.stockQuantity}** chiếc | Giá bán: ${formatVND(v.price)}\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT p.product_id, p.name, p.sku, p.stock_quantity, p.price FROM products p JOIN categories c ON c.id = p.category_id WHERE (c.slug ILIKE '%vga%' OR c.slug ILIKE '%card%' OR c.name ILIKE '%card%') AND p.status = 'ACTIVE' ORDER BY p.stock_quantity DESC LIMIT 20;`
});

// Kỹ năng 5: Kiểm tra tồn kho theo hãng sản xuất (ASUS, MSI, GIGABYTE, Corsair)
warehouseTrainer.addSkill({
  id: 'CHECK_STOCK_BY_BRAND',
  title: 'Kiểm tra tồn kho linh kiện theo hãng sản xuất',
  description: 'Tra cứu tồn kho các sản phẩm theo thương hiệu cụ thể',
  type: 'PRISMA_QUERY',
  examples: [
    'trong kho còn những linh kiện nào của asus?',
    'trong kho còn những linh kiện nào của asus',
    'kiểm tra tồn kho hàng msi',
    'kho còn bao nhiêu món của gigabyte',
    'hàng corsair trong kho còn nhiều không',
    'tra cứu linh kiện theo thương hiệu'
  ],
  patterns: [
    /(tồn kho.*(asus|msi|gigabyte|corsair|kingston|intel|amd)|hàng.*(asus|msi|gigabyte|corsair))/i
  ],
  allowedRoles: ['WAREHOUSE', 'ADMIN_CEO', 'ADMIN', 'SALES'],
  handler: async (prisma, params, _user) => {
    const rawPrompt = (params.keyword || params.brandName || '').toLowerCase();
    let brand = 'asus';
    if (rawPrompt.includes('msi')) brand = 'msi';
    else if (rawPrompt.includes('gigabyte')) brand = 'gigabyte';
    else if (rawPrompt.includes('corsair')) brand = 'corsair';
    else if (rawPrompt.includes('kingston')) brand = 'kingston';
    else if (rawPrompt.includes('intel')) brand = 'intel';
    else if (rawPrompt.includes('amd')) brand = 'amd';

    return await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: brand, mode: 'insensitive' } },
          { brand: { name: { contains: brand, mode: 'insensitive' } } }
        ],
        stockQuantity: { gt: 0 },
        status: 'ACTIVE'
      },
      select: {
        productId: true,
        name: true,
        sku: true,
        stockQuantity: true,
        price: true
      },
      orderBy: { stockQuantity: 'desc' },
      take: 10
    });
  },
  template: (products) => {
    if (!products || products.length === 0) {
      return 'Không tìm thấy linh kiện nào của hãng này đang còn tồn kho.';
    }
    let res = `🏷️ **DANH SÁCH LINH KIỆN CÒN TỒN KHO THEO HÃNG:**\n\n`;
    products.forEach((p, idx) => {
      res += `${idx + 1}. **${p.name}**\n`;
      res += `   Tồn: **${p.stockQuantity}** chiếc | Giá: ${formatVND(p.price)}\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 6: Lịch sử nhập xuất kho gần đây (Stock Movement)
warehouseTrainer.addSkill({
  id: 'RECENT_STOCK_MOVEMENTS',
  title: 'Lịch sử nhập xuất kho linh kiện gần đây',
  description: 'Tra cứu 10 giao dịch xuất / nhập kho mới nhất trong hệ thống',
  type: 'PRISMA_QUERY',
  examples: [
    'lịch sử nhập xuất kho gần đây',
    'hôm nay có phiếu xuất nhập nào mới không',
    'xem các biến động kho gần nhất',
    'nhật ký dịch chuyển kho',
    'lịch sử điều chuyển kho hàng'
  ],
  patterns: [
    /(lịch sử nhập xuất|biến động kho|dịch chuyển kho|xuất nhập gần đây|nhật ký kho)/i
  ],
  allowedRoles: ['WAREHOUSE', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.stockMovement.findMany({
      select: {
        id: true,
        type: true,
        quantity: true,
        note: true,
        createdAt: true,
        product: {
          select: { name: true, sku: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
  },
  template: (movements) => {
    if (!movements || movements.length === 0) return 'Chưa ghi nhận biến động kho nào gần đây.';
    let res = `🔄 **10 GIAO DỊCH DỊCH CHUYỂN KHO GẦN ĐÂY NHẤT:**\n\n`;
    movements.forEach((m, idx) => {
      const typeLabel = m.type === 'IN' || m.type === 'IMPORT' ? '📥 [NHẬP]' : '📤 [XUẤT]';
      res += `${idx + 1}. ${typeLabel} **${m.product ? m.product.name : 'Sản phẩm'}**\n`;
      res += `   Số lượng: **${m.quantity}** cái | Lúc: ${formatDateVN(m.createdAt)}\n`;
    });
    return res.trim();
  }
});

// Kỹ năng 7: Phiếu nhập hàng PO đang chờ
warehouseTrainer.addSkill({
  id: 'PENDING_PURCHASE_ORDERS',
  title: 'Phiếu mua hàng PO đang chờ nhập kho',
  description: 'Danh sách các đơn mua hàng từ nhà cung cấp đang chờ kho kiểm đếm',
  type: 'PRISMA_QUERY',
  examples: [
    'có phiếu yêu cầu nhập hàng po nào đang chờ kho nhập không',
    'danh sách po đang chờ duyệt nhập hàng',
    'hôm nay có nhà cung cấp nào giao hàng tới không'
  ],
  patterns: [
    /(nhập hàng|phiếu nhập|purchase order|po)/i
  ],
  allowedRoles: ['WAREHOUSE', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.purchaseOrder.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING', 'ORDERED'] }
      },
      select: {
        poNumber: true,
        supplierCode: true,
        totalAmount: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' },
      take: 15
    });
  },
  template: (pos) => {
    if (!pos || pos.length === 0) {
      return '✅ **Không có đơn mua hàng (PO) nào đang chờ kho tiếp nhận hôm nay.**';
    }
    let res = `📋 **DANH SÁCH ${pos.length} PHIẾU NHẬP HÀNG (PO) ĐANG CHỜ XỬ LÝ:**\n\n`;
    pos.forEach((p, idx) => {
      res += `${idx + 1}. **PO #${p.poNumber}** (NCC: \`${p.supplierCode}\`)\n`;
      res += `   Trị giá: ${formatVND(p.totalAmount)} | Trạng thái: \`${p.status}\`\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT po_number, supplier_code, total_amount, status, created_at FROM purchase_orders WHERE status IN ('APPROVED', 'PENDING', 'ORDERED') ORDER BY created_at ASC LIMIT 15;`
});

// Kỹ năng 8: Máy tính đang chờ ráp và kiểm tra (Assembly Jobs cho Kỹ thuật viên)
warehouseTrainer.addSkill({
  id: 'PENDING_ASSEMBLY_JOBS',
  title: 'Máy tính đang chờ ráp và kiểm tra (Assembly Jobs)',
  description: 'Danh sách các bộ PC đang chờ kỹ thuật viên lắp ráp và test benchmark',
  type: 'PRISMA_QUERY',
  examples: [
    'có bao nhiêu máy đang chờ ráp và kiểm tra?',
    'có bao nhiêu máy đang chờ ráp và kiểm tra',
    'danh sách pc đang chờ lắp ráp',
    'các máy cần test kiểm tra hôm nay',
    'công việc lắp ráp máy tính đang chờ',
    'hôm nay kỹ thuật phải ráp mấy bộ pc'
  ],
  patterns: [
    /(chờ ráp|lắp ráp|chờ lắp|test máy|benchmark|kiểm tra.*máy|ráp mấy bộ)/i
  ],
  allowedRoles: ['WAREHOUSE', 'ADMIN_CEO', 'ADMIN'],
  handler: async (prisma) => {
    return await prisma.assemblyJob.findMany({
      where: {
        status: { in: ['ASSIGNED', 'IN_PROGRESS', 'TESTING'] }
      },
      select: {
        jobCode: true,
        orderId: true,
        status: true,
        createdBy: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
  },
  template: (jobs) => {
    if (!jobs || jobs.length === 0) {
      return '🎉 **Tuyệt vời! Hiện không còn bộ máy PC nào đang chờ lắp ráp hoặc test benchmark.**';
    }
    let res = `🛠️ **HIỆN CÓ ${jobs.length} BỘ MÁY ĐANG TRONG TIẾN TRÌNH LẮP RÁP / KIỂM ĐỊNH:**\n\n`;
    jobs.forEach((j, idx) => {
      res += `${idx + 1}. **Mã ráp #${j.jobCode}** (Đơn hàng: #${j.orderId})\n`;
      res += `   Trạng thái: \`${j.status}\` | Kỹ thuật viên phụ trách: NV #${j.createdBy || 'Chưa gán'}\n`;
    });
    return res.trim();
  },
  sql: () => `SELECT job_number, order_id, status, assigned_to, created_at FROM assembly_jobs WHERE status IN ('ASSIGNED', 'IN_PROGRESS', 'TESTING') ORDER BY created_at ASC;`
});

// Kỹ năng 9: Danh sách các nhà cung cấp linh kiện PC đang hợp tác
warehouseTrainer.addSkill({
  id: 'SUPPLIER_LIST_LOOKUP',
  title: 'Danh sách các nhà cung cấp linh kiện PC đang hợp tác',
  description: 'Tra cứu danh bạ nhà phân phối linh kiện (ASUS, MSI, Synnex FPT...)',
  type: 'PRISMA_QUERY',
  examples: [
    'danh sách các nhà cung cấp linh kiện của công ty',
    'công ty đang nhập hàng từ những nhà cung cấp nào',
    'thông tin liên hệ các nhà cung cấp',
    'danh sách đối tác cung ứng'
  ],
  patterns: [
    /(nhà cung cấp|đối tác cung ứng|danh sách supplier|thông tin ncc)/i
  ],
  allowedRoles: ['WAREHOUSE', 'ADMIN_CEO', 'ADMIN', 'ACCOUNTANT'],
  handler: async (prisma) => {
    return await prisma.supplier.findMany({
      where: { status: 'ACTIVE' },
      select: { code: true, name: true, phone: true, email: true },
      take: 10
    });
  },
  template: (suppliers) => {
    if (!suppliers || suppliers.length === 0) return 'Chưa có thông tin nhà cung cấp.';
    let res = `🏭 **DANH SÁCH NHÀ CUNG CẤP / ĐỐI TÁC CUNG ỨNG LINH KIỆN:**\n\n`;
    suppliers.forEach((s, idx) => {
      res += `${idx + 1}. **${s.name}** (Mã: \`${s.code}\`)\n`;
      res += `   📞 Hotline: ${s.phone || 'Chưa có SĐT'} | Email: ${s.email || 'N/A'}\n`;
    });
    return res.trim();
  }
});

// ============================================================================
// 2. NHÓM KỸ NĂNG QUY TRÌNH & TRI THỨC VĂN BẢN (KNOWLEDGE SOP)
// ============================================================================

// Kỹ năng 10: Tiêu chuẩn an toàn tĩnh điện (ESD)
warehouseTrainer.addSkill({
  id: 'SOP_STATIC_ELECTRICITY_ESD',
  title: 'Tiêu chuẩn bảo hộ chống tĩnh điện (ESD) khi thao tác linh kiện',
  description: 'Quy định đeo vòng tay ESD và thảm khử tĩnh điện khi lắp ráp',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy định đeo vòng chống tĩnh điện esd',
    'an toàn tĩnh điện khi lắp ráp mainboard và vga',
    'tiêu chuẩn esd tại bàn kỹ thuật'
  ],
  patterns: [
    /(chống tĩnh điện|vòng esd|an toàn esd|tĩnh điện)/i
  ],
  sop: `⚡ **QUY TẮC AN TOÀN CHỐNG TĨNH ĐIỆN (ESD PROTECTION):**
1. **Trang bị bắt buộc:** Kỹ thuật viên bắt buộc đeo vòng tay chống tĩnh điện (kẹp nối đất) và trải thảm cao su ESD tại bàn ráp máy.
2. **Cầm nắm linh kiện:** Tuyệt đối KHÔNG chạm tay trực tiếp vào chân socket CPU, tụ điện trên bo mạch chủ hoặc chân mạ vàng PCIe của Card màn hình.
3. **Bao bì:** Chỉ khui linh kiện ra khỏi túi bạc tĩnh điện (Antistatic Bag) ngay trước khi đặt vào case máy tính.`
});

// Kỹ năng 11: Quy chuẩn đóng gói thùng xốp PC Gaming
warehouseTrainer.addSkill({
  id: 'SOP_PACKING_PC',
  title: 'Quy chuẩn đóng gói thùng xốp & bọc kính case PC',
  description: 'Tiêu chuẩn chèn túi khí Instapak và bảo vệ mặt kính cường lực',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy chuẩn đóng gói thùng xốp và chèn túi khí pc',
    'làm sao để không vỡ kính khi ship pc đi xa',
    'tiêu chuẩn bọc bọt biển instapak khi xuất kho',
    'cách đóng gói thùng máy tính gaming an toàn'
  ],
  patterns: [
    /(đóng gói thùng xốp|chèn túi khí|instapak|vỡ kính|bọc bọt biển)/i
  ],
  sop: `📦 **TIÊU CHUẨN ĐÓNG GÓI THÙNG MÁY PC GAMING:**
1. **Khoang bên trong:** Bắt buộc chèn túi khí bọt biển Instapak ôm sát Card đồ họa (VGA) và Tản nhiệt tháp để chống rung lắc, gãy chân cắm PCIe khi vận chuyển xa.
2. **Kính cường lực:** Dán màng PE chống trầy xước, chèn xốp góc định hình dày tối thiểu 20mm ở cả 4 góc thùng máy.
3. **Phụ kiện:** Dây nguồn, ốc vít thừa, sách hướng dẫn gom vào túi zip phụ đặt trong khoang xốp nóc thùng.
4. **Tem cảnh báo:** Dán tem niêm phong "HÀNG DỄ VỠ - XIN NHẸ TAY" và tem mũi tên chỉ chiều đứng bắt buộc.`
});

// Kỹ năng 12: Quy trình kiểm thử chạy rà Benchmark PC
warehouseTrainer.addSkill({
  id: 'SOP_BENCHMARK_QC',
  title: 'Quy trình kiểm thử chạy rà Benchmark PC trước khi xuất xưởng',
  description: 'Quy chuẩn thời gian test Furmark và Cinebench cho máy nguyên bộ',
  type: 'KNOWLEDGE_SOP',
  examples: [
    'quy trình test benchmark máy tính trước khi giao',
    'tiêu chuẩn nhiệt độ cpu và vga khi chạy furmark',
    'máy ráp xong cần test những phần mềm gì'
  ],
  patterns: [
    /(test benchmark|furmark|cinebench|chạy rà|nhiệt độ cpu)/i
  ],
  sop: `⚙️ **QUY TRÌNH KIỂM THỬ QC & BENCHMARK PC:**
1. **Stress-test CPU:** Chạy Cinebench R23 tối thiểu 10 phút, nhiệt độ CPU không được vượt quá 85°C đối với tản nước hoặc 90°C đối với tản khí.
2. **Stress-test GPU:** Chạy Furmark độ phân giải 1080p Preset trong 15 phút, nhiệt độ GPU Hotspot không quá 82°C.
3. **Kiểm tra cổng kết nối:** Cắm thử đủ các cổng USB trước/sau, cổng DisplayPort/HDMI và jack tai nghe 3.5mm.
4. **Biên bản bàn giao:** Ký xác nhận vào tem dán sau case máy tính trước khi chuyển kho xuất hàng.`
});

module.exports = warehouseTrainer;
