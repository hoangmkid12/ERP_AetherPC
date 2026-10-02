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

// Từ điển ngữ nghĩa chuyên ngành Máy tính, Phần cứng & Quy chế ERP AetherPC
// Ánh xạ ngôn ngữ giao tiếp đời thường của khách hàng/nhân viên vào văn bản quy chế chính thức
const SEMANTIC_DOMAIN_THESAURUS = [
  {
    topic: 'WARRANTY_RMA',
    slug: 'chinh-sach-bao-hanh-doi-tra-linh-kien-1-doi-1',
    tags: ['bảo hành', 'đổi trả', '1 đổi 1', 'rma', 'lỗi kỹ thuật', 'linh kiện'],
    patterns: [
      /không lên hình|màn hình đen|không nhận|chập cháy|cháy nổ|quạt không quay/i,
      /đơ máy|treo máy|màn hình xanh|bsod|đột tử|không boot|không nhận ram/i,
      /đổi con mới|đổi mới|đòi đổi|trả lại|hoàn tiền|1 đổi 1|30 ngày/i,
      /cong chân|gãy chân|rách tem|tem vỡ|vào nước|ẩm mốc|rơi vỡ/i,
      /bảo hành|đổi trả|rma|thẩm định kỹ thuật|lỗi kỹ thuật|bị hư hỏng|hư hỏng/i
    ],
    semanticTokens: ['đổi', 'mới', 'lỗi', 'không lên', 'kỹ thuật', '1 đổi 1', '30 ngày', 'bảo hành', 'phần cứng', 'từ chối']
  },
  {
    topic: 'SALES_DISCOUNT',
    slug: 'quy-che-chiet-khau-ban-le-chinh-sach-khach-hang-vip',
    tags: ['chiết khấu', 'giảm giá', 'khách vip', 'sales policy', 'bán lẻ'],
    patterns: [
      /bớt giá|giảm giá|xin bớt|giảm thêm|kỳ kèo|mặc cả|giảm bớt/i,
      /mua nhiều|đơn to|khách vip|hạng bạc|hạng vàng|kim cương|silver|gold|diamond/i,
      /tự giảm|thẩm quyền|trưởng phòng duyệt|hoa hồng|chiết khấu|phần trăm/i
    ],
    semanticTokens: ['chiết khấu', 'vip', 'giảm', 'tối đa', 'thẩm quyền', 'trưởng phòng', 'bạc', 'vàng', 'kim cương', '50 triệu']
  },
  {
    topic: 'TECHNICAL_QA',
    slug: 'tieu-chuan-ky-thuat-lap-rap-pc-quy-trinh-test-benchmark',
    tags: ['lắp ráp pc', 'benchmark', 'furmark', 'cinebench', 'nhiệt độ', 'qa qc'],
    patterns: [
      /lắp ráp|keo tản|tra keo|dây nhợ|bó dây|đi dây|chống xệ/i,
      /nóng quá|nhiệt độ|độ c|test máy|chạy thử|stress test|benchmark|furmark|cinebench|memtest/i,
      /xmp|expo|ram bus|tiêu chuẩn lắp|kỹ thuật viên/i
    ],
    semanticTokens: ['furmark', 'cinebench', 'nhiệt độ', 'benchmark', 'keo tản nhiệt', 'đi dây', 'tiêu chuẩn', 'test máy', '80 độ']
  },
  {
    topic: 'LOGISTICS_PACKING',
    slug: 'quy-trinh-giao-nhan-hang-doi-soat-tien-mat-cod-shipper',
    tags: ['giao hàng', 'shipper', 'pod', 'tiền mặt', 'cod', 'đối soát', 'đóng gói'],
    patterns: [
      /đóng gói|bọc hàng|bọc xốp|thùng xốp|túi khí|bọt biển|instapak|niêm phong|băng keo/i,
      /giao hàng|chở hàng|shipper|pod|chụp ảnh|móp hộp|khách từ chối/i,
      /tiền mặt|thu tiền|cod|nộp tiền|đối soát|két sắt|18h|mấy giờ/i
    ],
    semanticTokens: ['đóng gói', 'bọt biển', 'thùng xốp', 'instapak', 'shipper', 'pod', 'chụp ảnh', 'cod', 'tiền mặt', '18h', 'đối soát']
  },
  {
    topic: 'SECURITY_DATA',
    slug: 'chinh-sach-bao-mat',
    tags: ['bảo mật', 'an toàn thông tin', 'dữ liệu khách hàng', 'mật khẩu', 'rò rỉ dữ liệu', 'sa thải', 'nghỉ việc'],
    patterns: [
      /bảo mật|an toàn thông tin|dữ liệu khách hàng|rò rỉ|lộ thông tin|lộ dữ liệu/i,
      /mật khẩu|password|pass|khóa máy|windows l|rời bàn làm việc/i,
      /sa thải|nghỉ việc|bàn giao tài khoản|thu hồi quyền/i
    ],
    semanticTokens: ['mật khẩu', 'bảo mật', 'dữ liệu', 'khóa màn hình', 'sa thải', 'vi phạm', 'quy tắc', 'tiết lộ']
  },
  {
    topic: 'FINANCE_BANKING',
    slug: 'quy-dinh-quan-ly-tai-khoan-ngan-hang-doanh-nghiep-vietqr',
    tags: ['ngân hàng', 'vietqr', 'sod', 'tài chính', 'chuyển khoản', 'kế toán'],
    patterns: [
      /ngân hàng|tài khoản công ty|tài khoản doanh nghiệp|vietqr|mbbank|vietcombank|vcb/i,
      /sod|phân nhiệm|kế toán trưởng duyệt|két sắt|tiền về/i,
      /quét qr|chuyển khoản|tài khoản mặc định/i
    ],
    semanticTokens: ['ngân hàng', 'vietqr', 'tài khoản', 'mbbank', 'vietcombank', 'sod', 'phân nhiệm', 'kế toán trưởng']
  },
  {
    topic: 'HR_PAYROLL',
    slug: 'quy-che-thuong-kpi-chi-tra-luong-hang-thang-cho-nhan-su',
    tags: ['lương thưởng', 'kpi', 'hoa hồng', 'nhân sự', 'duyệt lương'],
    patterns: [
      /lương|bảng lương|thưởng|kpi|hoa hồng|ngày lĩnh lương|ngày nhận lương/i,
      /ngày 5|ngày 10|chấm công|nghỉ phép|duyệt lương|quy chế lương/i
    ],
    semanticTokens: ['lương', 'thưởng', 'kpi', 'hoa hồng', 'ngày 5', 'ngày 10', 'nhân sự', 'chi trả']
  }
];

const identifySemanticTopic = (query) => {
  if (!query || typeof query !== 'string') return null;
  const qLower = query.toLowerCase();
  
  let bestTopic = null;
  let maxScore = 0;

  for (const item of SEMANTIC_DOMAIN_THESAURUS) {
    let score = 0;
    for (const pat of item.patterns) {
      if (pat.test(qLower)) {
        score += 20;
      }
    }
    // Điểm thưởng cho từ khóa chuyên biệt
    for (const token of item.semanticTokens) {
      if (qLower.includes(token)) {
        score += 5;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestTopic = item;
    }
  }

  return maxScore >= 15 ? bestTopic : null;
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
  const matchedThesaurus = identifySemanticTopic(q);

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

  // Nạp thêm từ khóa tách dòng
  for (const kw of keywords) {
    orConditions.push({ title: { contains: kw, mode: 'insensitive' } });
    orConditions.push({ summary: { contains: kw, mode: 'insensitive' } });
    orConditions.push({ tags: { has: kw } });
  }

  // TIER 2: Nếu câu hỏi tự nhiên khớp với Từ điển Ngữ nghĩa PC/ERP, tiêm trực tiếp Slug và Tags vào OR
  if (matchedThesaurus) {
    orConditions.push({ slug: matchedThesaurus.slug });
    for (const tag of matchedThesaurus.tags) {
      orConditions.push({ tags: { has: tag } });
    }
  }

  const searchFilter = { OR: orConditions };

  if (where.OR) {
    where.AND = [searchFilter];
  } else {
    Object.assign(where, searchFilter);
  }

  const documents = await prisma.knowledgeDocument.findMany({
    where,
    take: 5,
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      summary: true,
      content: true,
      tags: true,
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

  // Sắp xếp theo độ liên quan cao nhất: ưu tiên từ khóa chủ đề cốt lõi và Thesaurus
  const qLower = q.toLowerCase();
  const coreKeywords = [
    'mật khẩu', 'password', 'pass', 'bảo mật', 'an toàn', 'an ninh', 
    'bảo hành', 'đổi trả', '1 đổi 1', 'chiết khấu', 'vip', 'giảm giá',
    'benchmark', 'furmark', 'cinebench', 'nhiệt độ', 'xmp', 
    'sod', 'vietqr', 'tài khoản ngân hàng', 'lương', 'thưởng', 'kpi', 
    'đóng gói', 'bọt biển', 'instapak', 'pod', 'cod', 'đối soát', 'thu tiền'
  ];
  const matchedCoreKeywords = coreKeywords.filter(k => qLower.includes(k));

  documents.sort((a, b) => {
    let aScore = 0;
    let bScore = 0;

    // Trọng số vượt trội nếu trùng khớp Slug hoặc Tag trong Semantic Thesaurus
    if (matchedThesaurus) {
      if (a.slug === matchedThesaurus.slug) aScore += 120;
      if (b.slug === matchedThesaurus.slug) bScore += 120;

      for (const t of matchedThesaurus.tags) {
        if ((a.tags || []).includes(t)) aScore += 25;
        if ((b.tags || []).includes(t)) bScore += 25;
      }
    }

    for (const ck of matchedCoreKeywords) {
      if (a.title.toLowerCase().includes(ck) || (a.tags || []).some(t => t.toLowerCase().includes(ck))) aScore += 50;
      else if (a.content.toLowerCase().includes(ck)) aScore += 20;

      if (b.title.toLowerCase().includes(ck) || (b.tags || []).some(t => t.toLowerCase().includes(ck))) bScore += 50;
      else if (b.content.toLowerCase().includes(ck)) bScore += 20;
    }

    if (a.title.toLowerCase().includes(qLower)) aScore += 30;
    if (b.title.toLowerCase().includes(qLower)) bScore += 30;

    const aTagMatch = (a.tags || []).some(t => qLower.includes(t.toLowerCase())) ? 10 : 0;
    const bTagMatch = (b.tags || []).some(t => qLower.includes(t.toLowerCase())) ? 10 : 0;
    aScore += aTagMatch;
    bScore += bTagMatch;

    return bScore - aScore;
  });

  // Nếu câu hỏi có từ khóa chủ đề cốt lõi nhưng tài liệu đứng đầu lại không hề chứa từ khóa đó (và không match thesaurus), coi như không tìm thấy
  if (matchedCoreKeywords.length > 0 && !matchedThesaurus) {
    const topDoc = documents[0];
    const topHasCore = matchedCoreKeywords.some(ck => 
      topDoc.title.toLowerCase().includes(ck) || 
      (topDoc.tags || []).some(t => t.toLowerCase().includes(ck)) ||
      topDoc.content.toLowerCase().includes(ck)
    );
    if (!topHasCore) {
      return {
        success: true,
        found: false,
        message: 'Không tìm thấy tài liệu quy chuẩn hoặc chính sách nào khớp với yêu cầu này.',
        documents: []
      };
    }
  }

  const extractRelevantSection = (content, query) => {
    if (!content) return '';
    const qTokens = query.toLowerCase()
      .replace(/[?,.!;:()]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !['trong', 'nhiêu', 'ngày', 'như', 'thế', 'nào', 'được', 'cho', 'của', 'với', 'các', 'những', 'một', 'mình', 'muốn', 'khách'].includes(w));
    
    // Nếu có semanticTokens từ Thesaurus, thêm vào để tăng độ tập trung trích xuất điều khoản
    if (matchedThesaurus?.semanticTokens) {
      for (const st of matchedThesaurus.semanticTokens) {
        if (!qTokens.includes(st)) qTokens.push(st);
      }
    }

    // Tách tài liệu theo các section (##, ĐIỀU, ###)
    const sections = content.split(/(?=\n## |\nĐIỀU |\n### )/g);
    if (sections.length <= 1) {
      return content.slice(0, 1000);
    }

    let bestSection = sections[0];
    let maxScore = -1;

    for (const sec of sections) {
      const secLower = sec.toLowerCase();
      let score = 0;
      for (const token of qTokens) {
        if (secLower.includes(token)) score += 3;
      }
      if (score > maxScore) {
        maxScore = score;
        bestSection = sec;
      }
    }

    return bestSection.trim();
  };

  return {
    success: true,
    found: true,
    count: documents.length,
    documents: documents.map(d => ({
      title: d.title,
      slug: d.slug,
      category: d.category,
      summary: d.summary,
      relevantSection: extractRelevantSection(d.content, q),
      contentSnippet: d.content.slice(0, 1500),
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
  executeToolCall,
  identifySemanticTopic,
  SEMANTIC_DOMAIN_THESAURUS
};
