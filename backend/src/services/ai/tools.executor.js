const prisma = require('../../config/database');

/**
 * Bộ thực thi công cụ nghiệp vụ (Tool Executors) với kiểm soát phân quyền (RBAC)
 * và làm sạch dữ liệu nhạy cảm (Data Masking).
 */

const executeToolCall = async (toolName, params, user) => {
  const userRole = user?.role || 'ALL';

  switch (toolName) {
    case 'lookup_knowledge_base':
      return await executeLookupKnowledgeBase(params, userRole);

    case 'lookup_products':
      return await executeLookupProducts(params, userRole);

    case 'check_pc_compatibility':
      return executeCheckPcCompatibility(params);

    case 'lookup_order_status':
      return await executeLookupOrderStatus(params, userRole);

    case 'get_finance_kpi':
      return await executeGetFinanceKpi(params, userRole);

    default:
      return { success: false, error: `Công cụ không xác định: ${toolName}` };
  }
};

// 1. Tra cứu kho tài liệu tri thức (Knowledge Base)
const executeLookupKnowledgeBase = async (params, userRole) => {
  const { query, category } = params || {};
  if (!query || !query.trim()) {
    return { success: false, message: 'Vui lòng cung cấp từ khóa cần tra cứu.' };
  }

  const isSuperAdmin = ['ADMIN', 'CEO'].includes(userRole);
  const where = { status: 'PUBLISHED' };

  // Phân quyền theo dòng: Nhân viên thường chỉ xem tài liệu ALL hoặc đúng role của mình
  if (!isSuperAdmin) {
    where.OR = [
      { allowedRoles: { has: 'ALL' } },
      { allowedRoles: { has: userRole } }
    ];
  }

  if (category && category !== 'ALL') {
    where.category = category;
  }

  const q = query.trim();
  // Tách các từ khóa có nghĩa để tìm kiếm linh hoạt (tránh câu dài không khớp nguyên văn)
  const keywords = q
    .toLowerCase()
    .replace(/[?,.!;:()]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !['trong', 'nhiêu', 'ngày', 'như', 'thế', 'nào', 'được', 'cho', 'của', 'với', 'các', 'những', 'một', 'mình', 'muốn', 'khách'].includes(w));

  const orConditions = [
    { title: { contains: q, mode: 'insensitive' } },
    { summary: { contains: q, mode: 'insensitive' } },
    { content: { contains: q, mode: 'insensitive' } }
  ];

  for (const kw of keywords) {
    orConditions.push({ title: { contains: kw, mode: 'insensitive' } });
    orConditions.push({ summary: { contains: kw, mode: 'insensitive' } });
    orConditions.push({ tags: { has: kw } });
  }

  const searchFilter = { OR: orConditions };

  if (where.OR) {
    where.AND = [searchFilter];
  } else {
    Object.assign(where, searchFilter);
  }

  const documents = await prisma.knowledgeDocument.findMany({
    where,
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      summary: true,
      content: true,
      updatedAt: true
    }
  });

  if (documents.length === 0) {
    return {
      success: true,
      found: false,
      message: 'Không tìm thấy tài liệu quy chuẩn hoặc chính sách nào khớp với yêu cầu này.',
      documents: []
    };
  }

  return {
    success: true,
    found: true,
    count: documents.length,
    documents: documents.map(d => ({
      title: d.title,
      slug: d.slug,
      category: d.category,
      summary: d.summary,
      contentSnippet: d.content.slice(0, 1500), // Trích đoạn ngắn gọn để vừa token LLM
      updatedAt: d.updatedAt
    }))
  };
};

// 2. Tra cứu linh kiện & tồn kho (ẩn giá vốn để bảo mật)
const executeLookupProducts = async (params) => {
  const { keyword } = params || {};
  if (!keyword || !keyword.trim()) {
    return { success: false, message: 'Vui lòng cung cấp tên linh kiện cần tra cứu.' };
  }

  const q = keyword.trim();
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { handle: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } }
      ]
    },
    take: 5,
    select: {
      productId: true,
      name: true,
      sku: true,
      price: true,
      category: { select: { name: true, slug: true } },
      brand: { select: { name: true } },
      inventory: {
        select: {
          quantity: true,
          reservedQuantity: true,
          location: { select: { name: true, code: true } }
        }
      }
    }
  });

  if (products.length === 0) {
    return { success: true, found: false, message: `Không tìm thấy linh kiện nào có tên "${q}" trong hệ thống.` };
  }

  return {
    success: true,
    found: true,
    products: products.map(p => {
      const totalStock = (p.inventory || []).reduce((sum, inv) => sum + (inv.quantity - (inv.reservedQuantity || 0)), 0);
      return {
        id: p.productId,
        name: p.name,
        sku: p.sku,
        retailPrice: Number(p.price),
        retailPriceFormatted: `${Number(p.price).toLocaleString('vi-VN')} đ`,
        category: p.category?.name,
        brand: p.brand?.name,
        availableStock: Math.max(0, totalStock),
        stockLocations: (p.inventory || []).map(i => `${i.location?.name}: còn ${i.quantity - i.reservedQuantity}`).join(', ')
      };
    })
  };
};

// 3. Kiểm tra tính tương thích linh kiện PC (Heuristic Compatibility Engine)
const executeCheckPcCompatibility = (params) => {
  const { cpuName = '', mainboardName = '', ramType = '', gpuName = '', psuWattage = 0 } = params || {};

  const issues = [];
  const notes = [];

  const cpuLower = cpuName.toLowerCase();
  const mbLower = mainboardName.toLowerCase();
  const ramLower = ramType.toLowerCase();

  // Socket Rules
  const isIntel12to14 = /12\d{2}|13\d{2}|14\d{2}|i[3579]-1[234]/.test(cpuLower);
  const isLGA1700Board = /h610|b660|b760|z690|z790/.test(mbLower);
  const isAmdAM5 = /7\d{3}|8\d{3}|9\d{3}|ryzen.*[789]\d{3}/.test(cpuLower);
  const isAM5Board = /a620|b650|x670|b850|x870/.test(mbLower);

  if (isIntel12to14 && mbLower && !isLGA1700Board) {
    issues.push(`CPU Intel Gen 12/13/14 (${cpuName}) dùng socket LGA1700, KHÔNG tương thích với bo mạch chủ ${mainboardName}. Vui lòng đổi sang Mainboard B760 hoặc Z790.`);
  }
  if (isAmdAM5 && mbLower && !isAM5Board) {
    issues.push(`CPU AMD Ryzen 7000/8000/9000 (${cpuName}) dùng socket AM5, KHÔNG tương thích với bo mạch chủ ${mainboardName}. Cần dùng Mainboard dòng B650, X670 hoặc A620.`);
  }

  // RAM Rules
  if (isAmdAM5 && ramLower.includes('ddr4')) {
    issues.push(`Nền tảng AMD Socket AM5 bắt buộc phải sử dụng RAM DDR5, KHÔNG hỗ trợ RAM DDR4.`);
  }

  // PSU Estimation
  let estimatedWattage = 200; // Base system (Main, Fan, SSD, RAM)
  if (/i9|ryzen 9/.test(cpuLower)) estimatedWattage += 250;
  else if (/i7|ryzen 7/.test(cpuLower)) estimatedWattage += 180;
  else estimatedWattage += 100;

  const gpuLower = gpuName.toLowerCase();
  if (/4090|3090/.test(gpuLower)) estimatedWattage += 450;
  else if (/4080|3080|7900/.test(gpuLower)) estimatedWattage += 320;
  else if (/4070|3070|7800/.test(gpuLower)) estimatedWattage += 220;
  else if (/4060|3060|6700/.test(gpuLower)) estimatedWattage += 150;
  else if (gpuLower) estimatedWattage += 120;

  const recommendedPsu = Math.ceil((estimatedWattage * 1.3) / 50) * 50; // Dự phòng 30% công suất đỉnh

  if (psuWattage > 0) {
    if (psuWattage < recommendedPsu) {
      issues.push(`Nguồn ${psuWattage}W có thể quá tải khi hệ thống tải nặng (Gaming/Render). Cấu hình này khuyến nghị tối thiểu nguồn công suất thực từ **${recommendedPsu}W** trở lên.`);
    } else {
      notes.push(`Công suất nguồn ${psuWattage}W hoàn toàn đáp ứng tốt cấu hình (mức khuyến nghị tối thiểu là ${recommendedPsu}W).`);
    }
  } else {
    notes.push(`Mức nguồn PSU khuyến nghị tối thiểu cho cấu hình này: **${recommendedPsu}W**.`);
  }

  return {
    success: true,
    isCompatible: issues.length === 0,
    issues,
    notes,
    summary: issues.length === 0 
      ? 'Cấu hình hoàn toàn tương thích và cân đối về mặt kỹ thuật phần cứng!' 
      : 'Phát hiện vấn đề xung đột phần cứng cần điều chỉnh.'
  };
};

// 4. Tra cứu đơn hàng & giao vận
const executeLookupOrderStatus = async (params) => {
  const { orderIdOrPhone } = params || {};
  if (!orderIdOrPhone) {
    return { success: false, message: 'Vui lòng cung cấp Mã đơn hàng hoặc Số điện thoại.' };
  }

  const queryClean = String(orderIdOrPhone).trim();

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderId: queryClean },
        { customer: { phone: queryClean } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    select: {
      orderId: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      shippingAddress: true,
      customer: { select: { name: true, phone: true } },
      assignedShipper: { select: { fullName: true, phone: true } },
      payments: { select: { method: true, amount: true, status: true } },
      items: {
        select: {
          productName: true,
          quantity: true,
          unitPrice: true
        }
      }
    }
  });

  if (!order) {
    return { success: true, found: false, message: `Không tìm thấy đơn hàng nào với thông tin "${queryClean}".` };
  }

  return {
    success: true,
    found: true,
    order: {
      orderId: order.orderId,
      status: order.status,
      customerName: order.customer?.name,
      customerPhone: order.customer?.phone ? `${order.customer.phone.slice(0, 3)}****${order.customer.phone.slice(-3)}` : '—',
      createdAt: order.createdAt,
      totalAmount: Number(order.totalAmount).toLocaleString('vi-VN') + ' đ',
      shipper: order.assignedShipper ? `${order.assignedShipper.fullName} (${order.assignedShipper.phone || 'SĐT nội bộ'})` : 'Chưa phân công shipper',
      paymentSummary: order.payments?.map(p => `${p.method}: ${Number(p.amount).toLocaleString('vi-VN')} đ (${p.status})`).join('; ') || 'Chưa thanh toán',
      itemsCount: order.items?.length || 0,
      itemNames: order.items?.map(i => `${i.productName} (x${i.quantity})`).slice(0, 3).join(', ')
    }
  };
};

// 5. Tra cứu tài chính (Kiểm tra quyền nghiêm ngặt - RBAC)
const executeGetFinanceKpi = async (params, userRole) => {
  const ALLOWED_ROLES = ['CEO', 'ADMIN', 'ACCOUNTANT'];
  if (!ALLOWED_ROLES.includes(userRole)) {
    return {
      success: false,
      error: 'PERMISSION_DENIED',
      message: 'Bạn không có quyền truy cập dữ liệu tài chính của doanh nghiệp.'
    };
  }

  // 1. Tính doanh thu hôm nay
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayIncome = await prisma.ledgerEntry.aggregate({
    where: {
      type: 'INCOME',
      date: { gte: startOfToday }
    },
    _sum: { amount: true }
  });

  // 2. Lấy danh sách tài khoản ngân hàng công ty
  const bankAccounts = await prisma.companyBankAccount.findMany({
    where: { status: 'ACTIVE' },
    select: {
      bankCode: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      isDefaultQr: true,
      purpose: true
    }
  });

  const defaultQrAcc = bankAccounts.find(b => b.isDefaultQr) || bankAccounts[0];

  return {
    success: true,
    data: {
      todayRevenue: Number(todayIncome._sum.amount || 0).toLocaleString('vi-VN') + ' đ',
      activeBankCount: bankAccounts.length,
      defaultQrAccount: defaultQrAcc ? `${defaultQrAcc.bankCode} - ${defaultQrAcc.accountNumber} (${defaultQrAcc.accountHolder})` : 'Chưa cấu hình',
      activeBanks: bankAccounts.map(b => `${b.bankCode}: ${b.accountNumber} - ${b.accountHolder} ${b.isDefaultQr ? '★ VietQR Mặc Định' : ''}`)
    }
  };
};

module.exports = {
  executeToolCall
};
