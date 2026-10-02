const prisma = require('../config/database');
const { logAudit } = require('../utils/auditLog');

const KNOWLEDGE_CATEGORIES = [
  { code: 'WARRANTY_RMA', label: 'Bảo Hành & Đổi Trả RMA' },
  { code: 'SALES_POLICY', label: 'Quy Chế Bán Hàng & Chiết Khấu' },
  { code: 'WAREHOUSE_LOGISTICS', label: 'Kho Vận & Giao Hàng' },
  { code: 'TECHNICAL_SOP', label: 'Tiêu Chuẩn Lắp Ráp & Benchmark' },
  { code: 'ERP_MANUAL', label: 'Hướng Dẫn Vận Hành ERP' },
  { code: 'GENERAL', label: 'Chính Sách & Quy Định Chung' }
];

// Helper: chuyển chuỗi tiếng Việt thành slug
const slugify = (text) => {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// 6 Tài liệu SOP khởi tạo mẫu thực tế của doanh nghiệp AetherPC
const SAMPLE_KNOWLEDGE_DOCS = [
  {
    title: 'Chính sách Bảo hành phần cứng & Đổi trả linh kiện 1 đổi 1',
    slug: 'chinh-sach-bao-hanh-doi-tra-linh-kien-1-doi-1',
    category: 'WARRANTY_RMA',
    summary: 'Quy định chi tiết về thời hạn bảo hành, điều kiện 1 đổi 1 trong 30 ngày đầu, các trường hợp từ chối bảo hành (cháy nổ, móp méo, rách tem).',
    content: `## 1. PHẠM VI & ĐIỀU KIỆN ÁP DỤNG
- **Chính sách 1 đổi 1 trong 30 ngày:** Áp dụng cho tất cả linh kiện phần cứng (CPU, Mainboard, RAM, SSD, VGA, Nguồn) phát sinh lỗi kỹ thuật do Nhà sản xuất (NSX).
- **Yêu cầu ngoại quan:** Sản phẩm còn đầy đủ hộp (box), phụ kiện đi kèm, hóa đơn mua hàng và tem bảo hành AetherPC nguyên vẹn, không có dấu hiệu rách dán đè.

## 2. TRƯỜNG HỢP TỪ CHỐI BẢO HÀNH (LOẠI TRỪ)
1. Sản phẩm có dấu hiệu hư hỏng vật lý: Móp méo, nứt vỡ, cong chân socket CPU, cháy rỉ do ẩm nước, có côn trùng xâm nhập.
2. Sản phẩm bị can thiệp BIOS/Firmware trái phép hoặc đào tiền ảo (Crypto mining) khiến GPU bị suy giảm hiệu năng nghiêm trọng.
3. Tem bảo hành bị cạo sửa, bong tróc hoặc số Serial Number không trùng khớp với hệ thống ERP.

## 3. THỜI GIAN XỬ LÝ RMA
- Thẩm định ngoại quan & test sơ bộ tại quầy: Tối đa 30 phút.
- Đổi mới ngay lập tức nếu kho còn hàng tương đương. Trường hợp hết hàng đổi, khách hàng được hoàn tiền 100% hoặc bù trừ nâng cấp linh kiện mới.`,
    tags: ['bảo hành', 'đổi trả', '1 đổi 1', 'rma', 'lỗi kỹ thuật', 'tem vỡ'],
    allowedRoles: ['ALL'],
    status: 'PUBLISHED'
  },
  {
    title: 'Quy chế Chiết khấu bán lẻ & Chính sách ưu đãi khách hàng VIP',
    slug: 'quy-che-chiet-khau-ban-le-chinh-sach-khach-hang-vip',
    category: 'SALES_POLICY',
    summary: 'Mức tỷ lệ chiết khấu cho đơn hàng PC trọn bộ, điều kiện duyệt giảm giá của Quản lý bán hàng và quyền lợi theo hạng thành viên Bronze/Silver/Gold/Diamond.',
    content: `## 1. NGUYÊN TẮC DUYỆT CHIẾT KHẤU
- **Nhân viên Sales:** Được chủ động giảm giá tối đa **2%** trên tổng giá trị đơn hàng linh kiện lẻ hoặc trọn bộ PC.
- **Trưởng phòng Kinh doanh (Sales Manager):** Thẩm quyền duyệt chiết khấu từ **2.1% đến 5%** đối với đơn hàng dự án hoặc đơn PC Gaming trên 50.000.000đ.
- **Ban Giám Đốc (CEO):** Duyệt mức chiết khấu trên **5%** hoặc các hợp đồng cung cấp phòng Net / Doanh nghiệp B2B.

## 2. ƯU ĐÃI THEO HẠNG KHÁCH HÀNG (TIER)
- **Hạng Bạc (Silver - Tích lũy > 20 triệu):** Giảm thêm 1% linh kiện, tặng voucher 200k cho lần mua sau.
- **Hạng Vàng (Gold - Tích lũy > 50 triệu):** Giảm thêm 2% linh kiện, miễn phí giao hàng hỏa tốc trong bán kính 20km.
- **Hạng Kim Cương (Diamond - Tích lũy > 100 triệu):** Giảm thêm 3% tổng hóa đơn, hỗ trợ bảo hành tận nơi trọn đời máy.`,
    tags: ['chiết khấu', 'giảm giá', 'khách vip', 'bán hàng', 'sales policy', 'hoa hồng'],
    allowedRoles: ['ALL'],
    status: 'PUBLISHED'
  },
  {
    title: 'Tiêu chuẩn Kỹ thuật Lắp ráp PC & Quy trình Test Benchmark QA/QC',
    slug: 'tieu-chuan-ky-thuat-lap-rap-pc-quy-trinh-test-benchmark',
    category: 'TECHNICAL_SOP',
    summary: 'Hướng dẫn chuẩn lắp ráp PC, quản lý dây nguồn (cable management), quy trình kiểm thử độ ổn định CPU/GPU qua phần mềm chuyên dụng trước khi xuất kho.',
    content: `## 1. TIÊU CHUẨN LẮP RÁP PHẦN CỨNG
1. **Keo tản nhiệt:** Bắt buộc tra keo tản nhiệt tiêu chuẩn (Thermal Grizzly hoặc Arctic MX-4), bôi chấm tâm hoặc hạt đậu đều bề mặt IHS CPU.
2. **Quản lý dây cáp:** Bó gọn gàng mặt sau thùng máy bằng dây rút nylon chuyên dụng, không để dây nguồn cọ xát vào cánh quạt tản nhiệt.
3. **Chống xệ VGA:** Các card màn hình 3 quạt nặng (RTX 4070 Ti, 4080, 4090) bắt buộc phải lắp chân chống VGA (GPU Holder) đi kèm.

## 2. BÀI TEST CHẤT LƯỢNG BẮT BUỘC (BENCHMARK QA)
- **Cinebench R23 (CPU):** Chạy liên tục 10 phút, nhiệt độ CPU không được vượt quá 88°C đối với tản nhiệt nước AIO 360mm.
- **FurMark (VGA):** Chạy bài test Full HD 15 phút, nhiệt độ Hotspot không quá 85°C, không xảy ra hiện tượng chớp tắt màn hình hoặc sập nguồn.
- **MemTest64 (RAM):** Chạy 3 vòng lặp để đảm bảo cấu hình bật XMP / EXPO hoạt động ổn định 100% không báo lỗi màn hình xanh (BSOD).`,
    tags: ['lắp ráp pc', 'benchmark', 'furmark', 'cinebench', 'nhiệt độ', 'qa qc', 'xmp'],
    allowedRoles: ['ALL'],
    status: 'PUBLISHED'
  },
  {
    title: 'Quy trình Giao nhận hàng & Đối soát tiền mặt COD Shipper',
    slug: 'quy-trinh-giao-nhan-hang-doi-soat-tien-mat-cod-shipper',
    category: 'WAREHOUSE_LOGISTICS',
    summary: 'Quy chuẩn đóng gói thùng xốp bảo vệ case PC, quy định chụp ảnh minh chứng nhận hàng (POD), nguyên tắc nộp tiền COD về quỹ kế toán trong ngày.',
    content: `## 1. QUY CHUẨN BÀN GIAO & VẬN CHUYỂN
- Mọi dàn PC nguyên bộ khi vận chuyển đều phải chèn túi khí bọt biển (Instapak) chống rung lắc gãy chân khe cắm PCIe card màn hình.
- Shipper kiểm tra niêm phong thùng carton, biên bản giao hàng và các phiếu bảo hành đi kèm trước khi rời kho.

## 2. CHỤP ẢNH MINH CHỨNG GIAO HÀNG (POD)
- Shipper bắt buộc chụp ảnh khách hàng nhận dàn máy hoặc chụp rõ ràng sản phẩm đặt tại địa chỉ giao hàng với góc nhìn đầy đủ thùng máy.
- Ghi nhận chính xác phương thức thanh toán: **Tiền mặt (CASH)** hoặc **Quét VietQR Napas 247**.

## 3. ĐỐI SOÁT TIỀN MẶT COD VỚI PHÒNG KẾ TOÁN
- Shipper có trách nhiệm nộp toàn bộ số tiền mặt COD thu được trong ca làm việc về cho Kế toán trước 18:00 hàng ngày.
- Kế toán kiểm đếm tiền mặt, bấm "Xác nhận đối soát" trên hệ thống ERP để đóng nợ cho Shipper và tự động ghi sổ cái dòng tiền.`,
    tags: ['giao hàng', 'shipper', 'pod', 'tiền mặt', 'cod', 'đối soát', 'đóng gói'],
    allowedRoles: ['ALL'],
    status: 'PUBLISHED'
  },
  {
    title: 'Quy định Quản lý Tài khoản Ngân hàng Doanh nghiệp & VietQR',
    slug: 'quy-dinh-quan-ly-tai-khoan-ngan-hang-doanh-nghiep-vietqr',
    category: 'GENERAL',
    summary: 'Chính sách Kiểm soát nội bộ & Phân nhiệm (SoD): Chỉ Ban Giám Đốc (CEO) và Quản Trị Hệ Thống (ADMIN) mới có thẩm quyền đổi tài khoản nhận tiền và mã VietQR.',
    content: `## 1. NGUYÊN TẮC PHÂN NHIỆM KIỂM SOÁT NỘI BỘ (SOD)
- Nhằm phòng chống rủi ro gian lận tài chính, quyền Thêm, Sửa, Xóa và cấu hình **VietQR Mặc Định** của công ty được giao ĐỘC QUYỀN cho **Ban Giám Đốc (CEO)** và **Quản Trị Hệ Thống (ADMIN)**.
- Phòng Kế toán và Shipper chỉ được quyền tra cứu các tài khoản đang hoạt động để đối soát và cung cấp mã QR cho khách quét tiền.

## 2. TIÊU CHUẨN MÃ VIETQR NAPAS 247 ĐỘNG
- Mã QR thanh toán sinh ra trên ứng dụng của Shipper và Website phải mang đúng mã số tài khoản mặc định đang hoạt động của công ty (MBBank / Vietcombank).
- Tên chủ tài khoản thụ hưởng bắt buộc phải là pháp nhân doanh nghiệp: **CÔNG TY TNHH AETHERPC**. Tuyệt đối nghiêm cấm việc nhân viên dùng tài khoản cá nhân để nhận tiền hàng của công ty.`,
    tags: ['ngân hàng', 'vietqr', 'sod', 'tài chính', 'chuyển khoản', 'kiểm soát nội bộ'],
    allowedRoles: ['ALL'],
    status: 'PUBLISHED'
  },
  {
    title: 'Quy chế Thưởng KPI & Chi trả lương hàng tháng cho Nhân sự',
    slug: 'quy-che-thuong-kpi-chi-tra-luong-hang-thang-cho-nhan-su',
    category: 'GENERAL',
    summary: 'Chính sách tính hoa hồng doanh số bán hàng, thưởng lắp ráp PC kỹ thuật, quy trình lập bảng lương HR và phê duyệt của CEO trước khi giải ngân.',
    content: `## 1. CƠ CẤU HOA HỒNG & THƯỞNG NĂNG SUẤT
- **Nhân viên Kinh doanh (Sales):** Được hưởng mức hoa hồng cố định 1.250.000đ/kỳ lương khi hoàn thành chỉ tiêu doanh số tối thiểu.
- **Kỹ thuật viên Lắp ráp (Assembly):** Được hưởng thưởng năng suất 750.000đ/kỳ lương cho việc lắp ráp và hoàn tất kiểm thử benchmark đúng thời hạn.

## 2. QUY TRÌNH PHÊ DUYỆT & GIẢI NGÂN LƯƠNG
1. **Phòng Nhân sự (HR):** Tổng hợp dữ liệu chấm công vân tay, tính thưởng/phạt và lập Bảng lương hoàn chỉnh vào ngày 28 hàng tháng.
2. **Ban Giám Đốc (CEO):** Kiểm tra tổng quỹ lương toàn doanh nghiệp và ký duyệt điện tử trên phần mềm ERP.
3. **Phòng Kế toán:** Nhận bảng lương đã duyệt từ CEO và tiến hành giải ngân qua chuyển khoản ngân hàng trong ngày mùng 5 của tháng tiếp theo.`,
    tags: ['lương thưởng', 'kpi', 'hoa hồng', 'nhân sự', 'duyệt lương', 'ceo'],
    allowedRoles: ['ADMIN', 'CEO', 'HR', 'ACCOUNTANT'],
    status: 'PUBLISHED'
  }
];

// GET /api/v1/knowledge
const getKnowledgeDocuments = async (req, res, next) => {
  try {
    const { category, search, status } = req.query;
    const userRole = req.user?.role || 'ALL';
    const isSuperAdmin = ['ADMIN', 'CEO'].includes(userRole);

    const where = {};

    // Phân quyền xem tài liệu: Nếu không phải Admin/CEO thì chỉ xem tài liệu PUBLISHED và role cho phép
    if (!isSuperAdmin) {
      where.status = 'PUBLISHED';
      where.OR = [
        { allowedRoles: { has: 'ALL' } },
        { allowedRoles: { has: userRole } }
      ];
    } else if (status && status !== 'ALL') {
      where.status = status;
    }

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { summary: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
            { tags: { has: q.toLowerCase() } }
          ]
        }
      ];
    }

    const documents = await prisma.knowledgeDocument.findMany({
      where,
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      success: true,
      data: documents,
      categories: KNOWLEDGE_CATEGORIES
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/knowledge/:idOrSlug
const getKnowledgeDocument = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const userRole = req.user?.role || 'ALL';
    const isSuperAdmin = ['ADMIN', 'CEO'].includes(userRole);

    const doc = await prisma.knowledgeDocument.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug }
        ]
      }
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu tri thức này.' });
    }

    // Kiểm tra quyền xem
    if (!isSuperAdmin) {
      if (doc.status !== 'PUBLISHED') {
        return res.status(404).json({ success: false, message: 'Tài liệu này hiện không khả dụng.' });
      }
      const hasPermission = doc.allowedRoles.includes('ALL') || doc.allowedRoles.includes(userRole);
      if (!hasPermission) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập tài liệu nội bộ này.' });
      }
    }

    // Tăng view count ngầm
    await prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: { viewCount: { increment: 1 } }
    }).catch(() => {});

    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/knowledge
const createKnowledgeDocument = async (req, res, next) => {
  try {
    const { title, category, summary, content, tags, allowedRoles, status } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Tiêu đề tài liệu không được để trống.' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung tài liệu không được để trống.' });
    }

    let slug = slugify(title);
    // Kiểm tra trùng slug
    const existing = await prisma.knowledgeDocument.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const doc = await prisma.knowledgeDocument.create({
      data: {
        title: title.trim(),
        slug,
        category: category || 'GENERAL',
        summary: summary ? summary.trim() : null,
        content: content.trim(),
        tags: Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [],
        allowedRoles: Array.isArray(allowedRoles) && allowedRoles.length > 0 ? allowedRoles : ['ALL'],
        status: status || 'PUBLISHED',
        authorId: req.user?.id || null,
        authorName: req.user?.fullName || req.user?.name || req.user?.email || 'Quản trị viên'
      }
    });

    logAudit({
      req,
      action: 'CREATE_KNOWLEDGE_DOCUMENT',
      module: 'Quản Trị Tri Thức',
      targetId: doc.id,
      note: `Tạo tài liệu: "${doc.title}" (${doc.category})`
    });

    res.status(201).json({ success: true, data: doc, message: 'Tạo tài liệu tri thức thành công.' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/knowledge/:id
const updateKnowledgeDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, category, summary, content, tags, allowedRoles, status } = req.body;

    const existing = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu cần cập nhật.' });
    }

    let newSlug = existing.slug;
    if (title && title.trim() !== existing.title) {
      newSlug = slugify(title);
      const duplicateSlug = await prisma.knowledgeDocument.findFirst({
        where: { slug: newSlug, id: { not: id } }
      });
      if (duplicateSlug) {
        newSlug = `${newSlug}-${Date.now().toString().slice(-4)}`;
      }
    }

    const updated = await prisma.knowledgeDocument.update({
      where: { id },
      data: {
        ...(title ? { title: title.trim(), slug: newSlug } : {}),
        ...(category ? { category } : {}),
        ...(summary !== undefined ? { summary: summary ? summary.trim() : null } : {}),
        ...(content ? { content: content.trim() } : {}),
        ...(tags !== undefined ? { tags: Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [] } : {}),
        ...(allowedRoles !== undefined ? { allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : ['ALL'] } : {}),
        ...(status ? { status } : {})
      }
    });

    logAudit({
      req,
      action: 'UPDATE_KNOWLEDGE_DOCUMENT',
      module: 'Quản Trị Tri Thức',
      targetId: updated.id,
      note: `Cập nhật tài liệu: "${updated.title}"`
    });

    res.json({ success: true, data: updated, message: 'Cập nhật tài liệu thành công.' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/knowledge/:id
const deleteKnowledgeDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu cần xóa.' });
    }

    await prisma.knowledgeDocument.delete({ where: { id } });

    logAudit({
      req,
      action: 'DELETE_KNOWLEDGE_DOCUMENT',
      module: 'Quản Trị Tri Thức',
      targetId: id,
      note: `Xóa tài liệu: "${existing.title}"`
    });

    res.json({ success: true, message: `Đã xóa tài liệu "${existing.title}".` });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/knowledge/seed-samples
const seedSampleKnowledge = async (req, res, next) => {
  try {
    let createdCount = 0;
    for (const item of SAMPLE_KNOWLEDGE_DOCS) {
      const exists = await prisma.knowledgeDocument.findUnique({ where: { slug: item.slug } });
      if (!exists) {
        await prisma.knowledgeDocument.create({
          data: {
            ...item,
            authorName: 'Hội Đồng Quản Trị AetherPC'
          }
        });
        createdCount++;
      }
    }

    res.json({
      success: true,
      message: `Đã khởi tạo thành công ${createdCount} tài liệu quy chuẩn doanh nghiệp.`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  KNOWLEDGE_CATEGORIES,
  getKnowledgeDocuments,
  getKnowledgeDocument,
  createKnowledgeDocument,
  updateKnowledgeDocument,
  deleteKnowledgeDocument,
  seedSampleKnowledge
};
