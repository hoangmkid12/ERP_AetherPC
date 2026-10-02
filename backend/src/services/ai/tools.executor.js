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

    case 'get_my_delivery_tasks':
      return await executeGetMyDeliveryTasks(user, userRole);

    case 'get_my_profile_and_tasks':
      return await executeGetMyProfileAndTasks(params, user);

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

// 1. Tra cứu kho tài liệu tri thức (Knowledge Base) với Semantic Query Expansion
const executeLookupKnowledgeBase = async (params, userRole) => {
  const { query, category, expandedKeywords = [], semanticTopic = null } = params || {};
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

  // Chuẩn hóa danh sách từ khóa mở rộng (Semantic Expansion Tokens)
  let expansionTokens = [];
  if (Array.isArray(expandedKeywords)) {
    expansionTokens = expandedKeywords.map(k => String(k).trim().toLowerCase()).filter(Boolean);
  } else if (typeof expandedKeywords === 'string' && expandedKeywords.trim()) {
    expansionTokens = expandedKeywords.split(/[,;\s]+/).map(k => k.trim().toLowerCase()).filter(k => k.length >= 2);
  }

  // Tách các từ khóa có nghĩa từ câu hỏi gốc
  const queryTokens = q
    .toLowerCase()
    .replace(/[?,.!;:()]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !['trong', 'nhiêu', 'ngày', 'như', 'thế', 'nào', 'được', 'cho', 'của', 'với', 'các', 'những', 'một', 'mình', 'muốn', 'khách', 'hôm', 'nay', 'phải', 'không', 'làm', 'sao'].includes(w));

  const allSearchKeywords = Array.from(new Set([...queryTokens, ...expansionTokens]));

  const orConditions = [
    { title: { contains: q, mode: 'insensitive' } },
    { summary: { contains: q, mode: 'insensitive' } },
    { content: { contains: q, mode: 'insensitive' } }
  ];

  // Nạp thêm từ khóa mở rộng vào điều kiện tìm kiếm đa trường
  for (const kw of allSearchKeywords) {
    if (kw.length >= 2) {
      orConditions.push({ title: { contains: kw, mode: 'insensitive' } });
      orConditions.push({ summary: { contains: kw, mode: 'insensitive' } });
      orConditions.push({ tags: { has: kw } });
    }
  }

  // Nạp Slug và Tags từ Từ điển Ngữ nghĩa nếu có
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
    take: 8,
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

  // Thuật toán chấm điểm và xếp hạng liên quan (Weighted Relevance Ranking)
  const qLower = q.toLowerCase();

  documents.sort((a, b) => {
    let aScore = 0;
    let bScore = 0;

    // 1. Trùng khớp Slug Thesaurus (+100 điểm)
    if (matchedThesaurus) {
      if (a.slug === matchedThesaurus.slug) aScore += 100;
      if (b.slug === matchedThesaurus.slug) bScore += 100;
    }

    // 2. Trùng khớp nguyên cụm câu hỏi (+50 điểm)
    if (a.title.toLowerCase().includes(qLower)) aScore += 50;
    if (b.title.toLowerCase().includes(qLower)) bScore += 50;
    if ((a.summary || '').toLowerCase().includes(qLower)) aScore += 30;
    if ((b.summary || '').toLowerCase().includes(qLower)) bScore += 30;

    // 3. Trùng khớp với từng từ khóa mở rộng (Expansion Tokens)
    for (const token of allSearchKeywords) {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aTags = (a.tags || []).map(t => t.toLowerCase());
      const bTags = (b.tags || []).map(t => t.toLowerCase());
      const aContent = a.content.toLowerCase();
      const bContent = b.content.toLowerCase();

      if (aTitle.includes(token)) aScore += 25;
      if (bTitle.includes(token)) bScore += 25;

      if (aTags.includes(token)) aScore += 20;
      if (bTags.includes(token)) bScore += 20;

      if (aContent.includes(token)) aScore += 10;
      if (bContent.includes(token)) bScore += 10;
    }

    return bScore - aScore;
  });

  // Thuật toán trích xuất đoạn điều khoản liên quan nhất (Dynamic Section Window)
  const extractRelevantSection = (content, query, keywordsList) => {
    if (!content) return '';
    const targetTokens = Array.from(new Set([...keywordsList, ...(matchedThesaurus?.semanticTokens || [])]));

    // Tách tài liệu theo các section (##, ĐIỀU, ###)
    const sections = content.split(/(?=\n## |\nĐIỀU |\n### )/g);
    if (sections.length <= 1) {
      return content.slice(0, 1200);
    }

    let bestSection = sections[0];
    let maxScore = -1;

    for (const sec of sections) {
      const secLower = sec.toLowerCase();
      let score = 0;
      for (const token of targetTokens) {
        if (secLower.includes(token)) score += 5;
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
    documents: documents.slice(0, 3).map(d => ({
      title: d.title,
      slug: d.slug,
      category: d.category,
      summary: d.summary,
      relevantSection: extractRelevantSection(d.content, q, allSearchKeywords),
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

  // Tách từ khóa tìm kiếm: loại bỏ các từ dư thừa câu hỏi để lấy đúng tên linh kiện
  const cleanKeyword = keyword
    .replace(/kiểm tra|tra cứu|tồn kho|còn hàng|giá bao nhiêu|còn mấy|giá|báo giá|cho xem|card|con|bộ|chiếc|sản phẩm|linh kiện|và|với|của|cho|hỏi|ạ|shop|bên mình/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  const searchTerms = [];
  if (cleanKeyword && cleanKeyword.length >= 2) searchTerms.push(cleanKeyword);
  searchTerms.push(keyword.trim());

  let products = [];
  for (const term of searchTerms) {
    products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { handle: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } }
        ]
      },
      take: 5,
      select: {
        productId: true,
        name: true,
        sku: true,
        price: true,
        stockQuantity: true,
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true } },
        inventories: {
          select: {
            quantityOnHand: true,
            quantityReserved: true,
            warehouse: { select: { name: true } },
            location: { select: { zone: true, shelf: true, bin: true } }
          }
        }
      }
    });

    if (products.length > 0) break;
  }

  if (products.length === 0) {
    return { success: true, found: false, message: `Không tìm thấy linh kiện nào có tên "${cleanKeyword || keyword}" trong hệ thống.` };
  }

  return {
    success: true,
    found: true,
    products: products.map(p => {
      const invStock = (p.inventories || []).reduce((sum, inv) => sum + (inv.quantityOnHand - (inv.quantityReserved || 0)), 0);
      const totalStock = invStock > 0 ? invStock : (p.stockQuantity || 0);
      const locationNames = (p.inventories || [])
        .filter(i => (i.quantityOnHand - (i.quantityReserved || 0)) > 0)
        .map(i => `${i.warehouse?.name || 'Kho'}${i.location?.shelf ? ` (Kệ ${i.location.shelf}${i.location.bin ? `-${i.location.bin}` : ''})` : ''}: còn ${i.quantityOnHand - i.quantityReserved}`)
        .join(', ');

      return {
        id: p.productId,
        name: p.name,
        sku: p.sku,
        retailPrice: Number(p.price),
        retailPriceFormatted: `${Number(p.price).toLocaleString('vi-VN')} đ`,
        category: p.category?.name,
        brand: p.brand?.name,
        availableStock: Math.max(0, totalStock),
        stockLocations: locationNames || (totalStock > 0 ? 'Kho chính AetherPC' : 'Tạm hết hàng')
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
  const codeMatch = queryClean.match(/ORD-[\w-]+|DH-[\w-]+|\b0\d{9,10}\b/i)?.[0];
  const searchTerm = codeMatch || queryClean;

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderId: { equals: searchTerm, mode: 'insensitive' } },
        { customer: { phone: searchTerm } }
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
          name: true,
          quantity: true,
          price: true
        }
      }
    }
  });

  if (!order) {
    return { success: true, found: false, message: `Không tìm thấy đơn hàng nào với thông tin "${searchTerm}".` };
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
      itemNames: order.items?.map(i => `${i.name} (x${i.quantity})`).slice(0, 3).join(', ')
    }
  };
};

const executeGetMyDeliveryTasks = async (user, userRole) => {
  if (userRole !== 'DELIVERY') {
    return {
      success: false,
      error: 'PERMISSION_DENIED',
      message: 'Chỉ shipper mới có thể tra cứu danh sách đơn giao được phân công.'
    };
  }

  const employeeId = Number(user?.id);
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
    return {
      success: false,
      error: 'INVALID_EMPLOYEE',
      message: 'Không xác định được tài khoản nhân viên đang đăng nhập.'
    };
  }

  const pendingStatuses = ['READY_TO_SHIP', 'SHIPPED'];
  const orders = await prisma.order.findMany({
    where: {
      assignedShipperId: employeeId,
      status: { in: pendingStatuses }
    },
    orderBy: { createdAt: 'asc' },
    select: {
      orderId: true,
      status: true
    }
  });

  return {
    success: true,
    count: orders.length,
    orders,
    note: 'Hệ thống chưa lưu ngày giao dự kiến; số liệu là các đơn chưa hoàn tất đang được phân công cho bạn.'
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

// 6. Tra cứu hồ sơ & nhiệm vụ/chỉ số của chính nhân viên đang đăng nhập (Self Context Grounding)
const executeGetMyProfileAndTasks = async (params, user) => {
  const { period = 'TODAY' } = params || {};
  const employeeId = Number(user?.id);
  const employeeEmail = user?.email;

  if ((!employeeId || isNaN(employeeId)) && !employeeEmail) {
    return {
      success: false,
      error: 'INVALID_EMPLOYEE',
      message: 'Không xác định được danh tính nhân viên từ phiên đăng nhập hiện tại.'
    };
  }

  // 1. Tìm thông tin nhân sự trong bảng Employee
  let employee = null;
  if (employeeId && Number.isSafeInteger(employeeId)) {
    employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });
  }
  if (!employee && employeeEmail) {
    employee = await prisma.employee.findUnique({
      where: { email: employeeEmail }
    });
  }

  if (!employee) {
    // Kiểm tra nếu là Nhà Cung Cấp (Supplier)
    const supplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { email: employeeEmail || '' },
          { code: user?.code || '' }
        ]
      }
    });
    if (supplier) {
      return {
        success: true,
        userType: 'SUPPLIER',
        profile: {
          code: supplier.code,
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone || '—',
          role: 'Nhà cung cấp đối tác AetherPC'
        }
      };
    }

    return {
      success: false,
      error: 'NOT_FOUND',
      message: 'Không tìm thấy hồ sơ nhân sự trong cơ sở dữ liệu.'
    };
  }

  // 2. Mốc thời gian thống kê
  let dateFilter = {};
  const now = new Date();
  if (period === 'TODAY') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    dateFilter = { gte: startOfToday };
  } else if (period === 'THIS_MONTH') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    dateFilter = { gte: startOfMonth };
  }

  // 3. Khai thác dữ liệu theo vai trò nhân sự
  let metrics = {};

  // Với nhân viên Bán hàng (Sales, Sales Manager, Admin, CEO)
  if (['SALES', 'SALES_MANAGER', 'ADMIN', 'CEO'].includes(employee.role)) {
    const whereSold = { soldById: employee.id };
    if (dateFilter.gte) whereSold.createdAt = dateFilter;

    const [soldCount, soldSum, recentSoldOrders] = await Promise.all([
      prisma.order.count({ where: whereSold }).catch(() => 0),
      prisma.order.aggregate({
        where: whereSold,
        _sum: { totalAmount: true }
      }).catch(() => ({ _sum: { totalAmount: 0 } })),
      prisma.order.findMany({
        where: { soldById: employee.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          orderId: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          customer: { select: { name: true } }
        }
      }).catch(() => [])
    ]);

    metrics.sales = {
      period,
      soldOrdersCount: soldCount,
      totalRevenue: Number(soldSum._sum.totalAmount || 0).toLocaleString('vi-VN') + ' đ',
      recentOrders: recentSoldOrders.map(o => ({
        orderId: o.orderId,
        customer: o.customer?.name || 'Khách lẻ',
        total: Number(o.totalAmount).toLocaleString('vi-VN') + ' đ',
        status: o.status
      }))
    };
  }

  // Với nhân viên Giao hàng (Delivery / Shipper)
  if (['DELIVERY', 'ADMIN'].includes(employee.role)) {
    const [assignedOrders, deliveredCount] = await Promise.all([
      prisma.order.findMany({
        where: {
          assignedShipperId: employee.id,
          status: { in: ['READY_TO_SHIP', 'SHIPPED'] }
        },
        orderBy: { createdAt: 'asc' },
        select: {
          orderId: true,
          status: true,
          totalAmount: true,
          shippingAddress: true,
          customer: { select: { name: true, phone: true } }
        }
      }).catch(() => []),
      prisma.order.count({
        where: {
          assignedShipperId: employee.id,
          status: 'DELIVERED',
          ...(dateFilter.gte ? { deliveredAt: dateFilter } : {})
        }
      }).catch(() => 0)
    ]);

    metrics.delivery = {
      pendingOrdersCount: assignedOrders.length,
      pendingOrders: assignedOrders.map(o => ({
        orderId: o.orderId,
        status: o.status,
        address: o.shippingAddress,
        customer: o.customer?.name
      })),
      deliveredCount
    };
  }

  // Với nhân viên Kho / Kỹ thuật
  if (['WAREHOUSE', 'WAREHOUSE_MANAGER', 'ADMIN'].includes(employee.role)) {
    const [assignedWorkOrders, qcCount] = await Promise.all([
      prisma.workOrder.count({
        where: {
          employeeId: employee.id,
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      }).catch(() => 0),
      prisma.qcInspection.count({
        where: {
          inspectorId: employee.id
        }
      }).catch(() => 0)
    ]);

    metrics.warehouse = {
      assignedWorkOrders,
      qcInspectionsCount: qcCount
    };
  }

  return {
    success: true,
    userType: 'EMPLOYEE',
    profile: {
      id: employee.id,
      code: employee.employeeCode,
      name: employee.fullName,
      email: employee.email,
      phone: employee.phone || 'Chưa cập nhật',
      department: employee.department,
      role: employee.role,
      status: employee.status || 'ACTIVE',
      deliveryRegion: employee.deliveryRegion || null,
      joinedAt: employee.createdAt ? new Date(employee.createdAt).toLocaleDateString('vi-VN') : '—'
    },
    metrics
  };
};

module.exports = {
  executeToolCall,
  identifySemanticTopic,
  SEMANTIC_DOMAIN_THESAURUS
};
