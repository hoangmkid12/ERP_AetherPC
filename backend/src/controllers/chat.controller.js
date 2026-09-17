const fs = require('fs');
const path = require('path');
const { NlpManager } = require('node-nlp');
const prisma = require('../config/database');
const { findBestKnowledgeMatch } = require('../utils/chatKnowledgeBase');

const formatVnd = (val) => new Intl.NumberFormat('vi-VN').format(parseFloat(val) || 0) + '₫';

// Nhãn tiếng Việt cho Order.status — bản rút gọn của ORDER_STATUS ở
// frontend/src/utils/statusLabels.js, chỉ giữ phần label vì chatbot chỉ cần
// hiển thị chữ, không cần màu badge.
const ORDER_STATUS_VI = {
  PENDING: 'Chờ Xác Nhận',
  WAITING_PAYMENT: 'Chờ Thanh Toán',
  CONFIRMED: 'Đã Xác Nhận',
  PACKED: 'Đã Đóng Gói',
  PROCESSING: 'Đang Chuẩn Bị Hàng',
  AWAITING_STOCK: 'Chờ Nhập Hàng',
  READY_TO_SHIP: 'Sẵn Sàng Giao',
  SHIPPED: 'Đang Giao Hàng',
  DELIVERED: 'Đã Giao Hàng',
  COMPLETED: 'Hoàn Tất',
  CANCELLED: 'Đã Hủy',
  FAILED_DELIVERY: 'Giao Thất Bại',
  SHIPPING_FAILED: 'Giao Thất Bại - Hẹn Lại',
  RETURNING_TO_WAREHOUSE: 'Đang Hoàn Về Kho',
  RETURN_REQUESTED: 'Yêu Cầu Trả Hàng',
  RETURN_APPROVED: 'Đã Duyệt Trả Hàng',
  RETURNING: 'Đang Trả Hàng',
  RETURNED: 'Đã Trả Hàng',
  REFUNDED: 'Đã Hoàn Tiền'
};

const TIER_LABEL_VI = {
  REGULAR: 'Thường',
  BRONZE: 'Đồng',
  SILVER: 'Bạc',
  GOLD: 'Vàng',
  PLATINUM: 'Bạch Kim',
  DIAMOND: 'Kim Cương'
};

// Chọn ngẫu nhiên 1 trong nhiều cách diễn đạt cho cùng 1 ý — tránh bot trả
// lời y hệt từng từ mỗi lần, cảm giác tự nhiên/"thông minh" hơn hẳn so với
// 1 câu cố định lặp lại mãi.
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Cache for Categories and Brands to keep entities extraction fast and dynamic
let categoriesCache = [];
let brandsCache = [];

const loadCache = async () => {
  if (categoriesCache.length > 0 && brandsCache.length > 0) return;
  try {
    categoriesCache = await prisma.category.findMany({
      select: { id: true, name: true, slug: true }
    });
    brandsCache = await prisma.brand.findMany({
      select: { id: true, name: true }
    });
    console.log(`[Chatbot] Loaded ${categoriesCache.length} categories and ${brandsCache.length} brands into cache.`);
  } catch (err) {
    console.error('[Chatbot] Failed to load categories/brands cache:', err);
  }
};

// NLP.js Manager Instance
let managerInstance = null;

const initNlpManager = async () => {
  if (managerInstance) return managerInstance;

  const manager = new NlpManager({ languages: ['vi'], forceNER: true });
  const modelPath = path.join(__dirname, '../config/model.nlp');
  const trainingDataPath = path.join(__dirname, '../config/training_data.json');

  console.log('[Chatbot] Retraining NLP model from training_data.json...');
  if (fs.existsSync(trainingDataPath)) {
    const data = JSON.parse(fs.readFileSync(trainingDataPath, 'utf8'));
    for (const item of data.intents) {
      for (const utterance of item.utterances) {
        manager.addDocument('vi', utterance, item.intent);
      }
    }
    await manager.train();
    try { await manager.save(modelPath); } catch (e) {}
    console.log('[Chatbot] NLP model trained and saved to:', modelPath);
  }

  managerInstance = manager;
  return manager;
};

// Custom parser to extract budget, category, brands and technical specs from message
const extractEntities = (text, categoriesList, brandsList) => {
  const cleanText = text.toLowerCase();
  const entities = {
    budget: 0,
    category: null,
    brand: null,
    specs: []
  };

  // 1. Budget extraction (e.g. "15 triệu", "15tr", "15 trieu", "500k", "500.000", "500000")
  const trMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(triệu|trieu|tr)\b/);
  if (trMatch) {
    const num = parseFloat(trMatch[1]);
    if (!isNaN(num) && num >= 1 && num <= 500) entities.budget = num * 1000000;
  }
  
  if (entities.budget === 0) {
    const kMatch = cleanText.match(/(\d+)\s*(k|nghìn|nghin)\b/);
    if (kMatch) {
      const num = parseInt(kMatch[1]);
      if (!isNaN(num) && num >= 1 && num <= 10000) entities.budget = num * 1000;
    }
  }

  if (entities.budget === 0) {
    const dotNum = cleanText.match(/(\d{1,3}(?:\.\d{3}){1,})/);
    if (dotNum) {
      const val = parseInt(dotNum[1].replace(/\./g, ''));
      if (!isNaN(val) && val >= 500000 && val <= 500000000) entities.budget = val;
    }
  }

  if (entities.budget === 0) {
    const rawNum = cleanText.match(/\b(\d{7,10})\b/);
    if (rawNum) {
      const val = parseInt(rawNum[1]);
      if (!isNaN(val) && val >= 500000 && val <= 500000000) entities.budget = val;
    }
  }

  // 2. Category extraction mapping common synonyms to DB categories.
  // QUAN TRỌNG: các key dưới đây phải khớp ĐÚNG slug thật trong DB (category
  // Prisma) — bản cũ dùng slug tiếng Anh tự đặt (vd 'cpu', 'vga', 'ram') mà
  // DB thật lại lưu slug tiếng Việt có dấu-gạch-ngang (vd 'bo-vi-xu-ly',
  // 'card-man-hinh', 'ram-pc'/'ram-laptop' tách riêng 2 danh mục) nên
  // `categoriesList.find(c => c.slug === slug)` KHÔNG BAO GIỜ khớp — suốt
  // thời gian qua chatbot chưa từng thực sự lọc được theo danh mục, chỉ âm
  // thầm rơi về tìm kiếm chuỗi con kém chính xác hơn nhiều. Thứ tự khai báo
  // có ý nghĩa: cụm cụ thể hơn (vd "ram laptop", "hdd") phải đứng TRƯỚC cụm
  // chung chung hơn (vd "ram", "ssd") để không bị match nhầm.
  const categorySynonyms = {
    'bo-vi-xu-ly': ['cpu', 'bộ vi xử lý', 'vi xử lý', 'chip', 'ryzen', 'core i3', 'core i5', 'core i7', 'core i9'],
    'card-man-hinh': ['vga', 'card màn hình', 'card man hinh', 'card đồ họa', 'card do hoa', 'gpu', 'geforce', 'radeon', 'rtx', 'gtx'],
    'ram-laptop': ['ram laptop', 'ram cho laptop'],
    'ram-pc': ['ram', 'bộ nhớ trong', 'bo nho trong'],
    'o-cung-hdd': ['hdd', 'ổ cứng hdd', 'o cung hdd'],
    'o-cung-ssd': ['ssd', 'nvme', 'm2 sata', 'm2 nvme', 'ổ cứng', 'o cung'],
    'bo-mach-chu': ['mainboard', 'main', 'bo mạch chủ', 'bo mach chu'],
    'nguon-may-tinh': ['nguồn', 'nguon', 'psu', 'nguồn máy tính'],
    'vo-may-tinh': ['case', 'vỏ case', 'vỏ máy', 'vo case', 'vo may', 'thùng máy'],
    'tan-nhiet': ['tản nhiệt', 'tan nhiet', 'cooler', 'quạt tản nhiệt', 'tản nước', 'tản khí'],
    'ban-phim': ['bàn phím', 'ban phim', 'keyboard'],
    'chuot-may-tinh': ['chuột', 'chuot', 'mouse'],
    'man-hinh': ['màn hình', 'man hinh', 'monitor', 'hiển thị']
  };

  for (const [slug, synonyms] of Object.entries(categorySynonyms)) {
    if (synonyms.some(syn => cleanText.includes(syn))) {
      const matchedCat = categoriesList.find(c => c.slug.toLowerCase() === slug);
      if (matchedCat) {
        entities.category = matchedCat;
        break;
      }
    }
  }

  // 3. Brand extraction
  for (const brand of brandsList) {
    const brandName = brand.name.toLowerCase();
    if (cleanText.includes(brandName)) {
      entities.brand = brand;
      break;
    }
  }

  // 4. Specs keywords extraction
  // Hz
  const hzMatch = cleanText.match(/(\d+)\s*hz/);
  if (hzMatch) entities.specs.push({ type: 'hz', value: parseInt(hzMatch[1]), raw: hzMatch[0] });

  // Resolution
  if (cleanText.includes('4k') || cleanText.includes('2160p')) entities.specs.push({ type: 'resolution', value: '4K', raw: '4K' });
  if (cleanText.includes('2k') || cleanText.includes('1440p')) entities.specs.push({ type: 'resolution', value: '2K', raw: '2K' });
  if (cleanText.includes('1080p') || cleanText.includes('full hd') || cleanText.includes('fullhd')) entities.specs.push({ type: 'resolution', value: 'FHD', raw: 'Full HD' });

  // Size (inches)
  const inchMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:inch|"|'')/);
  if (inchMatch) entities.specs.push({ type: 'size', value: parseFloat(inchMatch[1]), raw: inchMatch[0] });

  // GB capacity
  const gbMatch = cleanText.match(/(\d+)\s*gb/);
  if (gbMatch) entities.specs.push({ type: 'capacity', value: parseInt(gbMatch[1]), raw: gbMatch[0] });

  // TB capacity
  const tbMatch = cleanText.match(/(\d+)\s*tb/);
  if (tbMatch) entities.specs.push({ type: 'capacity_tb', value: parseInt(tbMatch[1]), raw: tbMatch[0] });

  // Models
  const modelPatterns = [
    /rtx\s*\d{4}/i, /gtx\s*\d{4}/i, /rx\s*\d{4}/i,
    /ryzen\s*\d/i, /core\s*i\d/i, /i\d[-\s]\d{4,5}/i,
    /ddr[45]/i
  ];
  for (const pat of modelPatterns) {
    const m = cleanText.match(pat);
    if (m) entities.specs.push({ type: 'model', value: m[0].trim(), raw: m[0].trim() });
  }

  return entities;
};

// Main Chat Handler
const handleChat = async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Load DB Caches
    await loadCache();

    // Init NLP Manager
    const manager = await initNlpManager();

    // Classify user intent
    const result = await manager.process('vi', message);
    // node-nlp trả intent 'None' (không phải null/undefined) khi không phân
    // loại được câu nào đủ tin cậy — trước đây `|| 'general'` không bắt được
    // trường hợp này nên mọi câu lạ đều lọt qua nhánh product_search/hardcode
    // fallback cứng nhắc, chưa từng thử tra kho tri thức FAQ.
    //
    // Bộ phân loại bag-of-words của node-nlp với ~150 câu mẫu không thực sự
    // hiểu ngữ nghĩa — 1 câu hoàn toàn lạ (vd "shop có tuyển nhân viên
    // không") vẫn có thể bị gán nhầm vào 1 intent đã huấn luyện với điểm tin
    // cậy khá cao do trùng từ ngẫu nhiên. Đặt ngưỡng tin cậy tối thiểu để
    // những câu mơ hồ hơn được nhường lại cho kho tri thức FAQ (tra theo từ
    // khóa, ít nhất còn bám đúng chủ đề) thay vì trả lời sai chủ đề nhưng
    // "tự tin".
    const INTENT_CONFIDENCE_THRESHOLD = 0.8;
    const intent = (result.intent && result.intent !== 'None' && result.score >= INTENT_CONFIDENCE_THRESHOLD)
      ? result.intent
      : 'general';

    // Parse entities
    let entities = extractEntities(message, categoriesCache, brandsCache);

    // Kế thừa ngữ cảnh câu hỏi TRƯỚC nếu câu hiện tại là 1 câu nối tiếp ngắn
    // không tự nêu lại ngân sách/danh mục (vd "còn màu khác không", "rẻ hơn
    // được không") — tránh bot "quên" ngay sau câu đầu tiên, đúng tinh thần
    // "trả lời linh hoạt" thay vì chỉ xử lý từng câu độc lập.
    if (Array.isArray(history) && history.length > 0 && !entities.category && !entities.brand && entities.budget === 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i]?.sender === 'user' && typeof history[i].text === 'string') {
          const prevEntities = extractEntities(history[i].text, categoriesCache, brandsCache);
          if (prevEntities.category || prevEntities.brand || prevEntities.budget > 0) {
            entities = {
              category: entities.category || prevEntities.category,
              brand: entities.brand || prevEntities.brand,
              budget: entities.budget || prevEntities.budget,
              specs: entities.specs.length > 0 ? entities.specs : prevEntities.specs
            };
          }
          break;
        }
      }
    }
    let reply = '';
    let replyIntent = 'general';
    let matchedProducts = [];

    // Intent Routing
    if (intent === 'greeting') {
      reply = pick([
        'Xin chào bạn! 👋 Tôi là Trợ lý AI của AetherPC. Tôi có thể tư vấn cấu hình PC theo đúng ngân sách, tìm kiếm linh kiện chuẩn 100% tương thích, tra cứu đơn hàng/khuyến mãi và giải đáp chính sách cửa hàng cho bạn.',
        'Chào bạn! 😊 Mình là Trợ lý AI AetherPC đây. Bạn cần tư vấn cấu hình PC, tìm linh kiện, kiểm tra đơn hàng hay hỏi về chính sách shop, cứ nhắn mình nhé!'
      ]);
      replyIntent = 'general';
    } else if (intent === 'goodbye') {
      reply = pick([
        'Cảm ơn bạn đã liên hệ AetherPC! 👋 Hẹn gặp lại bạn sớm. Chúc bạn một ngày tốt lành!',
        'Dạ vâng, hẹn gặp lại bạn nhé! Nếu cần hỗ trợ thêm cứ quay lại nhắn mình bất cứ lúc nào ạ. 👋'
      ]);
      replyIntent = 'general';
    } else if (intent === 'thanks') {
      reply = 'Dạ không có gì ạ! 😊 Rất vui được hỗ trợ bạn. Bạn cần tư vấn thêm về cấu hình hay linh kiện nào cứ nhắn tôi nhé!';
      replyIntent = 'general';
    } else if (intent === 'hardware_advice') {
      reply = '**Tư vấn kỹ thuật phần cứng từ Chuyên gia AetherPC:**\n- **CPU**: **Intel Core** xung đơn nhân cao mượt game & QuickSync render video; **AMD Ryzen** nhiều nhân luồng đa nhiệm & L3 cache khủng.\n- **VGA**: **NVIDIA RTX** tối ưu CUDA cho 3D Blender, AI & Ray Tracing; **AMD Radeon** giá/p/p chơi game E-Sports cực ngon.\n- **RAM**: Khuyên dùng tối thiểu **16GB** cho Gaming 2026; **32GB+** cho đồ họa nặng, 3D & giả lập.';
      replyIntent = 'general';
    } else if (intent === 'policy_warranty') {
      reply = '**Chính sách bảo hành tại AetherPC:**\n- **Bảo hành chính hãng 100%** từ 24 - 36 tháng tùy linh kiện.\n- **Đổi mới 1-đổi-1** trong 7 ngày đầu nếu có lỗi nhà sản xuất.\n- Tiếp nhận kiểm tra kỹ thuật hỏa tốc trong 24h.';
      replyIntent = 'policy';
    } else if (intent === 'policy_delivery') {
      reply = '**Chính sách giao hàng AetherPC:**\n- **FREESHIP 0đ** nội thành TP.HCM & Hà Nội.\n- **Đồng giá 30.000đ** các tỉnh thành khác toàn quốc.\n- Hỗ trợ giao hỏa tốc 1-2h và kiểm tra hàng trước khi thanh toán (COD).';
      replyIntent = 'policy';
    } else if (intent === 'policy_payment') {
      reply = '**Thanh toán & Trả góp:**\n- **Trả góp 0%** qua thẻ tín dụng liên kết 25 ngân hàng.\n- **Chuyển khoản QR**: Chiết khấu trực tiếp **0.5%** tổng bill.\n- Hỗ trợ COD, MoMo, ZaloPay, VNPay.';
      replyIntent = 'policy';
    } else if (intent === 'policy_contact') {
      reply = '**Thông tin liên hệ AetherPC:**\n- 📍 **Địa chỉ**: 123 Nguyễn Văn Linh, Quận 7, TP.HCM.\n- 📞 **Hotline**: 1900 6789 (8:00 - 21:00).\n- 💬 **Live Chat**: Bấm nút **"Gặp NV CSKH"** để trao đổi 1-1 với nhân viên.';
      replyIntent = 'policy';
    } else if (intent === 'game_advice') {
      replyIntent = 'pc_build';
      const cleanLower = message.toLowerCase();
      let targetBudget = entities.budget || 15000000;
      if (cleanLower.includes('valorant') || cleanLower.includes('fo4') || cleanLower.includes('lol') || cleanLower.includes('liên minh')) {
        targetBudget = entities.budget || 12000000;
      } else if (cleanLower.includes('gta') || cleanLower.includes('pubg') || cleanLower.includes('genshin')) {
        targetBudget = entities.budget || 18000000;
      } else if (cleanLower.includes('3d') || cleanLower.includes('premiere') || cleanLower.includes('render')) {
        targetBudget = entities.budget || 25000000;
      }

      // Query database for recommended setup
      try {
        const keyProducts = await prisma.product.findMany({
          where: { available: true },
          include: { category: true, brand: true, images: { take: 1 } },
          take: 50
        });

        const budgetStr = new Intl.NumberFormat('vi-VN').format(targetBudget) + '₫';
        reply = `💡 **Gợi ý cấu hình PC phù hợp nhu cầu của bạn (Tầm giá ~${budgetStr}):**\n\n`;
        
        // Pick best matching parts from store inventory. Slug phải khớp DÚNG
        // slug thật trong DB (xem chú thích ở extractEntities/categorySynonyms
        // phía trên) — bản cũ dùng slug tự đặt 'cpu'/'vga'/'ram'/'storage'
        // không khớp gì cả, nên gợi ý cấu hình trước đây luôn chọn đại 4 sản
        // phẩm đầu tiên trong danh sách thay vì thật sự là CPU/VGA/RAM/Ổ cứng.
        const cpus = keyProducts.filter(p => p.category?.slug === 'bo-vi-xu-ly');
        const vgas = keyProducts.filter(p => p.category?.slug === 'card-man-hinh');
        const rams = keyProducts.filter(p => p.category?.slug === 'ram-pc');
        const storages = keyProducts.filter(p => p.category?.slug === 'o-cung-ssd');

        const pickedCpu = cpus[0];
        const pickedVga = vgas[0];
        const pickedRam = rams[0];
        const pickedStorage = storages[0];

        if (pickedCpu) reply += `- **CPU**: ${pickedCpu.name}\n`;
        if (pickedVga) reply += `- **VGA**: ${pickedVga.name}\n`;
        if (pickedRam) reply += `- **RAM**: ${pickedRam.name}\n`;
        if (pickedStorage) reply += `- **Ổ cứng**: ${pickedStorage.name}\n`;
        reply += `- **Nguồn & Case**: Nguồn 650W 80 Plus & Vỏ case Tản nhiệt thoáng khí\n\n`;
        reply += `👉 Bộ linh kiện bên dưới được tự động lọc sẵn từ kho AetherPC theo tiêu chuẩn mượt mà nhất. Bạn có thể nhấn **"Thêm vào giỏ"** để sở hữu ngay!`;

        matchedProducts = [pickedCpu, pickedVga, pickedRam, pickedStorage].filter(Boolean).slice(0, 4);
      } catch (err) {
        reply = 'Dạ, để chơi mượt mà các tựa game bạn yêu cầu, bạn có thể tham khảo các dòng cấu hình PC Gaming từ 12tr - 18tr tại AetherPC!';
      }
    } else if (intent === 'pc_build') {
      replyIntent = 'pc_build';
      const targetBudget = entities.budget || 15000000;
      const budgetStr = new Intl.NumberFormat('vi-VN').format(targetBudget) + '₫';

      try {
        const dbProducts = await prisma.product.findMany({
          where: { available: true, price: { lte: targetBudget } },
          include: { category: true, brand: true, images: { take: 1 } },
          orderBy: { price: 'desc' },
          take: 30
        });

        reply = `🖥️ **AetherPC - Cấu hình PC đề xuất tối ưu theo ngân sách ~${budgetStr}:**\n\n`;
        const cpus = dbProducts.filter(p => p.category?.slug === 'bo-vi-xu-ly');
        const vgas = dbProducts.filter(p => p.category?.slug === 'card-man-hinh');
        const rams = dbProducts.filter(p => p.category?.slug === 'ram-pc');
        const storages = dbProducts.filter(p => p.category?.slug === 'o-cung-ssd');

        const chosenCpu = cpus[0] || dbProducts[0];
        const chosenVga = vgas[0] || dbProducts[1];
        const chosenRam = rams[0] || dbProducts[2];
        const chosenStorage = storages[0] || dbProducts[3];

        matchedProducts = [chosenCpu, chosenVga, chosenRam, chosenStorage].filter(Boolean).slice(0, 4);

        matchedProducts.forEach((p, idx) => {
          const pPriceStr = new Intl.NumberFormat('vi-VN').format(parseFloat(p.price)) + '₫';
          reply += `${idx + 1}. **${p.name}** - ${pPriceStr}\n`;
        });
        reply += `\n✨ Tất cả linh kiện đều sẵn hàng tại showroom, bảo hành chính hãng 36 tháng. Bấm **"Thêm vào giỏ"** để đặt hàng ngay!`;
      } catch (err) {
        reply = `Dạ, tôi đã ghi nhận ngân sách khoảng **${budgetStr}**. Vui lòng tham khảo các cấu hình gợi ý bên dưới hoặc bấm nút **"Gặp NV CSKH"** để nhân viên hỗ trợ tùy chỉnh theo ý muốn!`;
      }
    } else if (intent === 'product_search' || intent === 'product_compare' || entities.category || entities.brand || entities.specs.length > 0) {
      replyIntent = 'product_search';
      const isCompareRequest = intent === 'product_compare';

      // Build database query filters
      const whereClause = { available: true };
      if (entities.category) {
        whereClause.categoryId = entities.category.id;
      }
      if (entities.brand) {
        whereClause.brandId = entities.brand.id;
      }
      if (entities.budget > 0) {
        whereClause.price = { lte: entities.budget * 1.3 };
      }

      let dbProducts = [];
      try {
        dbProducts = await prisma.product.findMany({
          where: whereClause,
          include: {
            category: { select: { name: true, slug: true } },
            brand: { select: { name: true } },
            images: { take: 1, orderBy: { sortOrder: 'asc' } }
          }
        });
      } catch (err) {
        console.error('[Chatbot] Database query error:', err);
      }

      // Fallback search if strict filter returned nothing
      if (dbProducts.length === 0) {
        try {
          const searchTokens = message.toLowerCase().split(/\s+/).filter(t => t.length > 2);
          dbProducts = await prisma.product.findMany({
            where: {
              available: true,
              OR: searchTokens.map(tok => ({ name: { contains: tok, mode: 'insensitive' } }))
            },
            include: {
              category: { select: { name: true, slug: true } },
              brand: { select: { name: true } },
              images: { take: 1, orderBy: { sortOrder: 'asc' } }
            },
            take: 10
          });
        } catch (e) {}
      }

      if (dbProducts.length > 0) {
        // Score products based on spec matches
        const scored = dbProducts.map(p => {
          let score = 0;
          const pName = p.name.toLowerCase();
          const pSpecs = JSON.stringify(p.specs || {}).toLowerCase();
          const pPrice = parseFloat(p.price);

          for (const kw of entities.specs) {
            switch (kw.type) {
              case 'hz':
                if (pName.includes(`${kw.value}hz`) || pSpecs.includes(`${kw.value}hz`) || pSpecs.includes(`${kw.value} hz`)) score += 30;
                break;
              case 'resolution':
                if (pName.includes(kw.value.toLowerCase()) || pSpecs.includes(kw.value.toLowerCase())) score += 25;
                break;
              case 'size':
                if (pName.includes(`${kw.value}`) || pName.includes(`${Math.round(kw.value)}`)) score += 20;
                break;
              case 'capacity':
                if (pName.includes(`${kw.value}gb`) || pSpecs.includes(`${kw.value}gb`) || pSpecs.includes(`${kw.value} gb`)) score += 25;
                break;
              case 'capacity_tb':
                if (pName.includes(`${kw.value}tb`) || pSpecs.includes(`${kw.value}tb`)) score += 25;
                break;
              case 'model':
                if (pName.includes(kw.value) || pSpecs.includes(kw.value)) score += 35;
                break;
            }
          }

          if (entities.budget > 0) {
            const ratio = pPrice / entities.budget;
            if (ratio >= 0.6 && ratio <= 1.0) {
              score += 20 - Math.abs(ratio - 0.9) * 15;
            } else if (ratio > 1.0 && ratio <= 1.2) {
              score += 5;
            }
          }

          return { ...p, _score: score };
        });

        scored.sort((a, b) => (b._score !== a._score ? b._score - a._score : parseFloat(a.price) - parseFloat(b.price)));
        matchedProducts = scored.slice(0, 4);

        let desc = '';
        if (isCompareRequest) {
          desc += `Dạ, để so sánh bạn xem chi tiết ${matchedProducts.length} sản phẩm phù hợp nhất bên dưới nhé (giá, thương hiệu, thông số đầy đủ):\n\n`;
        } else if (entities.category) {
          desc += `Dạ, tôi tìm thấy **${dbProducts.length} mẫu ${entities.category.name}** phù hợp. `;
        } else {
          desc += `Dạ, tôi tìm thấy linh kiện phù hợp theo yêu cầu của bạn. `;
        }
        if (!isCompareRequest && entities.budget > 0) {
          const budgetStr = new Intl.NumberFormat('vi-VN').format(entities.budget) + '₫';
          desc += `ở tầm giá dưới **${budgetStr}** `;
        }
        if (!isCompareRequest) desc += 'tại cửa hàng:\n\n';

        matchedProducts.forEach((p, index) => {
          const priceStr = new Intl.NumberFormat('vi-VN').format(parseFloat(p.price)) + '₫';
          desc += `${index + 1}. **${p.name}**\n   - Hãng: ${p.brand.name} | Giá: **${priceStr}**\n`;
        });
        desc += isCompareRequest
          ? '\nBạn có thể xem đầy đủ thông số kỹ thuật của từng sản phẩm bên dưới để đối chiếu trực tiếp nhé!'
          : '\nBạn xem thông số các sản phẩm này bên dưới và nhấn **"Thêm vào giỏ"** nếu ưng ý nhé!';
        reply = desc;
      } else {
        reply = 'Xin lỗi bạn, hiện tại dòng sản phẩm này ở tầm giá bạn yêu cầu đang tạm hết hàng hoặc chưa có sẵn tại AetherPC. Bạn có thể thử tìm từ khóa khác hoặc bấm nút **"Gặp NV CSKH"** để nhân viên hỗ trợ ngay nhé!';
      }
    } else if (intent === 'order_status') {
      replyIntent = 'order_status';
      const orderCodeMatch = message.toUpperCase().match(/ORD[-_]?\d+/);

      try {
        if (orderCodeMatch) {
          const orderId = orderCodeMatch[0].replace('_', '-');
          const order = await prisma.order.findFirst({ where: { orderId: { equals: orderId, mode: 'insensitive' } } });
          // Chỉ cho xem đơn của CHÍNH khách đó nếu đang đăng nhập bằng vai trò
          // CUSTOMER — tránh 1 khách gõ đại mã đơn để dò thông tin đơn người khác.
          const ownedByRequester = order && (req.user?.role !== 'CUSTOMER' || order.customerId === req.user.id);
          if (order && ownedByRequester) {
            reply = `📦 **Đơn hàng ${order.orderId}**\n- Trạng thái: **${ORDER_STATUS_VI[order.status] || order.status}**\n- Tổng tiền: **${formatVnd(order.totalAmount)}**\n- Ngày đặt: ${new Date(order.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}\n\nXem chi tiết đầy đủ (lịch sử xử lý, vị trí giao hàng) tại mục **"Đơn Mua Của Tôi"** nhé!`;
          } else {
            reply = `Xin lỗi, tôi không tìm thấy đơn hàng **${orderId}** khớp với tài khoản của bạn. Bạn kiểm tra lại mã đơn hoặc bấm **"Gặp NV CSKH"** để được hỗ trợ tra cứu trực tiếp nhé.`;
          }
        } else if (req.user?.role === 'CUSTOMER') {
          const recentOrders = await prisma.order.findMany({
            where: { customerId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 3
          });
          if (recentOrders.length > 0) {
            reply = `**Các đơn hàng gần đây của bạn:**\n\n` +
              recentOrders.map(o => `- Đơn **${o.orderId}**: ${ORDER_STATUS_VI[o.status] || o.status} — ${formatVnd(o.totalAmount)}`).join('\n') +
              `\n\nXem đầy đủ chi tiết & theo dõi vị trí giao hàng tại mục **"Đơn Mua Của Tôi"** nhé!`;
          } else {
            reply = 'Bạn chưa có đơn hàng nào tại AetherPC. Khám phá ngay các sản phẩm hot tại cửa hàng nhé!';
          }
        } else {
          reply = 'Để tra cứu đơn hàng, bạn vui lòng **đăng nhập tài khoản** hoặc cho tôi biết **mã đơn hàng** (ví dụ: ORD-576569) để tôi kiểm tra giúp bạn nhé!';
        }
      } catch (err) {
        console.error('[Chatbot] Order lookup error:', err);
        reply = 'Xin lỗi, hệ thống đang gặp sự cố khi tra cứu đơn hàng. Bạn vui lòng bấm **"Gặp NV CSKH"** để được hỗ trợ trực tiếp.';
      }
    } else if (intent === 'promotion_inquiry') {
      replyIntent = 'promotion';
      try {
        const promos = await prisma.promotion.findMany({
          where: {
            status: 'ACTIVE',
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }]
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        if (promos.length > 0) {
          reply = `🎁 **Chương trình khuyến mãi đang áp dụng tại AetherPC:**\n\n` +
            promos.map(p => {
              const discountStr = p.discountType === 'PERCENT' ? `giảm **${parseFloat(p.discountValue)}%**` : `giảm **${formatVnd(p.discountValue)}**`;
              const minSpendStr = parseFloat(p.minSpend) > 0 ? ` cho đơn từ ${formatVnd(p.minSpend)}` : '';
              return `- **${p.title}** (mã \`${p.code}\`): ${discountStr}${minSpendStr}`;
            }).join('\n') +
            `\n\nNhập mã tương ứng ở bước thanh toán để được áp dụng nhé!`;
        } else {
          reply = 'Hiện tại chưa có chương trình khuyến mãi nào đang áp dụng, nhưng shop luôn có giá tốt sẵn trên từng sản phẩm. Theo dõi trang **Khuyến Mãi** để cập nhật sớm nhất nhé!';
        }
      } catch (err) {
        console.error('[Chatbot] Promotion lookup error:', err);
        reply = 'Bạn xem các chương trình khuyến mãi mới nhất tại trang **Khuyến Mãi** trên website nhé!';
      }
    } else if (intent === 'member_tier') {
      replyIntent = 'general';
      if (req.user?.role === 'CUSTOMER') {
        try {
          const customer = await prisma.customer.findUnique({
            where: { customerId: req.user.id },
            select: { loyaltyPoints: true, tier: true }
          });
          if (customer) {
            reply = `Bạn hiện đang ở hạng **${TIER_LABEL_VI[customer.tier] || customer.tier}** với **${customer.loyaltyPoints.toLocaleString('vi-VN')} điểm** tích lũy.\n\n📊 Mốc thăng hạng: Bạc (1.000 điểm), Vàng (5.000 điểm), Bạch Kim (15.000 điểm). Cứ mỗi **10.000đ thanh toán = 1 điểm** cơ bản, nhân thêm theo % hạng hiện tại. Xem chi tiết đầy đủ tại trang **Hạng Thành Viên**.`;
          }
        } catch (err) {
          console.error('[Chatbot] Member tier lookup error:', err);
        }
      }
      if (!reply) {
        reply = '**Chính sách hạng thành viên AetherPC:**\n- Cứ **10.000đ thanh toán = 1 điểm** tích lũy (nhân thêm theo % hạng).\n- Mốc thăng hạng: **Bạc** (1.000 điểm), **Vàng** (5.000 điểm), **Bạch Kim** (15.000 điểm), **Kim Cương** (cao nhất).\n- Hạng càng cao, % tích điểm, freeship và ưu đãi dịch vụ càng lớn.\n\nĐăng nhập tài khoản để xem điểm và hạng hiện tại của bạn tại trang **Hạng Thành Viên**.';
      }
    } else {
      // Không khớp bất kỳ intent đã huấn luyện nào — tra kho tri thức FAQ tự
      // xây (chấm điểm từ khóa) trước khi rơi về câu giới thiệu chung chung,
      // để bot vẫn trả lời được đúng trọng tâm với các câu hỏi mới lạ.
      const kbMatch = findBestKnowledgeMatch(message);
      if (kbMatch) {
        reply = kbMatch.answer;
        replyIntent = 'general';
      } else {
        reply = 'Tôi là Trợ lý AI của AetherPC. Tôi có thể hỗ trợ bạn:\n- **Tư vấn cấu hình PC**: "Build PC chơi game 15 triệu", "Chơi Valorant cần máy bao nhiêu"...\n- **Tìm kiếm linh kiện**: "Tìm màn hình 144Hz dưới 4 triệu", "RAM 16GB"...\n- **Tra cứu đơn hàng & khuyến mãi**: "Đơn hàng của tôi tới đâu rồi", "Có mã giảm giá không"...\n- **Thông tin dịch vụ**: "Chính sách bảo hành thế nào?", "Shop có trả góp không?"...';
        replyIntent = 'general';
      }
    }

    res.json({
      success: true,
      intent: replyIntent,
      reply: reply,
      products: matchedProducts.map(p => ({
        productId: p.productId,
        name: p.name,
        brand: p.brand.name,
        price: parseFloat(p.price),
        originalPrice: parseFloat(p.originalPrice),
        image: p.primaryImage || (p.images?.[0]?.url) || '',
        categorySlug: p.category.slug,
        specs: p.specs
      }))
    });

  } catch (err) {
    console.error('[Chatbot] Handle chat error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const { getSessions, addCustomerMessage, addStaffMessage } = require('../services/websocketService');

const getCskhSessions = async (req, res) => {
  try {
    const sessions = await getSessions();
    res.json({ success: true, sessions });
  } catch (err) {
    console.error('[Chat] Error getting sessions:', err);
    res.status(500).json({ success: false, message: 'Failed to get sessions' });
  }
};

const sendCskhCustomerMessage = async (req, res) => {
  try {
    const { sessionId = 'session_default', text, customerName, time } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text is required' });

    const session = await addCustomerMessage({ sessionId, text, customerName, time });
    res.json({ success: true, session });
  } catch (err) {
    console.error('[Chat] Error sending customer message:', err);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

const sendCskhStaffMessage = async (req, res) => {
  try {
    const { sessionId = 'session_default', text, time } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text is required' });

    const session = await addStaffMessage({ sessionId, text, time });
    res.json({ success: true, session });
  } catch (err) {
    console.error('[Chat] Error sending staff message:', err);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

module.exports = { 
  handleChat,
  getCskhSessions,
  sendCskhCustomerMessage,
  sendCskhStaffMessage
};
