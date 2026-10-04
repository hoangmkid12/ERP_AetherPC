/**
 * ENTITY & HARDWARE RESOLVER - GIAI ĐOẠN 2: BÓC TÁCH THỰC THỂ & FUZZY MATCHING
 * - Bảng ánh xạ từ viết tắt phần cứng PC chuyên sâu (Jargon / Shorthands)
 * - Thuật toán Trigram Fuzzy Similarity (n-gram) chuẩn hóa tên sản phẩm
 * - Nhận diện thương hiệu (Brand), kho xuất (Warehouse), phương thức thanh toán
 */

/**
 * Thuật toán tính độ tương đồng Trigram (3-gram Dice Coefficient) giữa 2 chuỗi
 * Chạy 100% nội bộ, cực nhanh (O(N)), không phụ thuộc mạng
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Điểm tương đồng từ 0.0 đến 1.0
 */
const calculateTrigramSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().replace(/\s+/g, ' ').trim();
  const s2 = str2.toLowerCase().replace(/\s+/g, ' ').trim();

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const getTrigrams = (str) => {
    const trigrams = new Map();
    const padded = `  ${str} `;
    for (let i = 0; i < padded.length - 2; i++) {
      const tri = padded.slice(i, i + 3);
      trigrams.set(tri, (trigrams.get(tri) || 0) + 1);
    }
    return trigrams;
  };

  const t1 = getTrigrams(s1);
  const t2 = getTrigrams(s2);

  let intersection = 0;
  for (const [tri, count1] of t1.entries()) {
    if (t2.has(tri)) {
      intersection += Math.min(count1, t2.get(tri));
    }
  }

  const total = (s1.length + 1) + (s2.length + 1);
  return total > 0 ? (2.0 * intersection) / total : 0;
};

/**
 * Bảng từ điển viết tắt phần cứng máy tính (Hardware Shorthand Dictionary)
 * Ánh xạ từ lóng / viết tắt của game thủ & kỹ thuật viên sang mã chuẩn
 */
const HARDWARE_ALIASES = [
  // VGA NVIDIA RTX 40 Series
  { patterns: [/\b4090\b/i, /\brtx\s*4090\b/i], canonical: 'RTX 4090' },
  { patterns: [/\b4080\s*super\b/i, /\b4080s\b/i], canonical: 'RTX 4080 Super' },
  { patterns: [/\b4080\b/i, /\brtx\s*4080\b/i], canonical: 'RTX 4080' },
  { patterns: [/\b4070\s*ti\s*super\b/i, /\b4070tis\b/i], canonical: 'RTX 4070 Ti Super' },
  { patterns: [/\b4070\s*ti\b/i], canonical: 'RTX 4070 Ti' },
  { patterns: [/\b4070\s*super\b/i, /\b4070s\b/i], canonical: 'RTX 4070 Super' },
  { patterns: [/\b4070\b/i, /\brtx\s*4070\b/i], canonical: 'RTX 4070' },
  { patterns: [/\b4060\s*ti\b/i], canonical: 'RTX 4060 Ti' },
  { patterns: [/\b4060\b/i, /\brtx\s*4060\b/i], canonical: 'RTX 4060' },

  // VGA NVIDIA RTX 30 & GTX Series
  { patterns: [/\b3060\b/i, /\brtx\s*3060\b/i], canonical: 'RTX 3060' },
  { patterns: [/\b3050\b/i, /\brtx\s*3050\b/i], canonical: 'RTX 3050' },
  { patterns: [/\b1660\s*super\b/i, /\b1660s\b/i], canonical: 'GTX 1660 Super' },
  { patterns: [/\b1650\b/i, /\bgtx\s*1650\b/i], canonical: 'GTX 1650' },

  // CPU Intel
  { patterns: [/\bi9\s*14900k\b/i, /\b14900k\b/i], canonical: 'Core i9-14900K' },
  { patterns: [/\bi7\s*(?:đời\s*14|gen\s*14|14700k?)\b/i, /\b14700k\b/i, /\b14700\b/i], canonical: 'Core i7-14700K' },
  { patterns: [/\bi5\s*(?:đời\s*14|gen\s*14|14400f?)\b/i, /\b14400f?\b/i], canonical: 'Core i5-14400F' },
  { patterns: [/\bi5\s*(?:đời\s*13|gen\s*13|13400f?)\b/i, /\b13400f?\b/i], canonical: 'Core i5-13400F' },
  { patterns: [/\bi5\s*(?:đời\s*12|gen\s*12|12400f?)\b/i, /\b12400f?\b/i], canonical: 'Core i5-12400F' },
  { patterns: [/\bi3\s*(?:đời\s*12|gen\s*12|12100f?)\b/i, /\b12100f?\b/i], canonical: 'Core i3-12100F' },

  // CPU AMD Ryzen
  { patterns: [/\b7800x3d\b/i, /\bryzen\s*7\s*7800x3d\b/i], canonical: 'Ryzen 7 7800X3D' },
  { patterns: [/\b7600x?\b/i, /\bryzen\s*5\s*7600x?\b/i], canonical: 'Ryzen 5 7600' },
  { patterns: [/\b5600x?\b/i, /\bryzen\s*5\s*5600x?\b/i], canonical: 'Ryzen 5 5600' },
  { patterns: [/\b5700x?\b/i, /\bryzen\s*7\s*5700x?\b/i], canonical: 'Ryzen 7 5700X' },

  // Mainboard Chipsets
  { patterns: [/\bz790\b/i, /\bmain(?:board)?\s*z790\b/i], canonical: 'Z790' },
  { patterns: [/\bb760m?\b/i, /\bmain(?:board)?\s*b760m?\b/i], canonical: 'B760M' },
  { patterns: [/\bh610m?\b/i, /\bmain(?:board)?\s*h610m?\b/i], canonical: 'H610M' },
  { patterns: [/\bb650m?\b/i, /\bmain(?:board)?\s*b650m?\b/i], canonical: 'B650M' },
  { patterns: [/\bx670e?\b/i], canonical: 'X670' },

  // RAM & SSD
  { patterns: [/\bddr5\b/i], canonical: 'DDR5' },
  { patterns: [/\bddr4\b/i], canonical: 'DDR4' },
  { patterns: [/\bnvme\s*(?:gen\s*4|4\.0)?\b/i, /\bm\.2\s*nvme\b/i], canonical: 'NVMe Gen4' }
];

/**
 * Danh sách thương hiệu phổ biến
 */
const KNOWN_BRANDS = [
  'asus', 'gigabyte', 'msi', 'corsair', 'kingston', 'intel', 'amd',
  'samsung', 'deepcool', 'nzxt', 'lian li', 'thermalright', 'logitech',
  'razer', 'aoc', 'lg', 'viewsonic', 'dell', 'gskill', 'colorful'
];

/**
 * Danh sách kho hàng trung tâm
 */
const KNOWN_WAREHOUSES = [
  { match: /(kho chính|kho tổng|kho trung tâm|kho aetherpc)/i, name: 'Kho Trung Tâm AetherPC' },
  { match: /(kho hcm|kho sài gòn|kho quận 1|kho q1)/i, name: 'Kho Hồ Chí Minh' },
  { match: /(kho hà nội|kho hn|kho miền bắc)/i, name: 'Kho Hà Nội' },
  { match: /(kho bảo hành|kho rma)/i, name: 'Kho Bảo Hành & RMA' }
];

/**
 * Phương thức thanh toán
 */
const PAYMENT_METHODS = [
  { match: /(vietqr|quét mã qr|chuyển khoản qr)/i, code: 'VIETQR' },
  { match: /(chuyển khoản|ngân hàng|banking|mbbank|vietcombank)/i, code: 'BANK_TRANSFER' },
  { match: /(tiền mặt|cod|thu hộ|giao hàng thu tiền)/i, code: 'COD' },
  { match: /(trả góp|mpos|thẻ tín dụng)/i, code: 'INSTALLMENT' }
];

/**
 * Bóc tách và chuẩn hóa tên thực thể từ câu hỏi
 * @param {string} text 
 * @param {object} prisma (tùy chọn để query DB)
 * @returns {Promise<object>}
 */
const resolveEntities = async (text, prisma = null) => {
  if (!text || typeof text !== 'string') {
    return {
      productName: null,
      canonicalHardware: null,
      brandName: null,
      warehouseName: null,
      paymentMethod: null,
      dbMatchedProduct: null
    };
  }

  const lower = text.toLowerCase().trim();

  // 1. Nhận diện phần cứng theo Alias Dictionary
  let canonicalHardware = null;
  for (const alias of HARDWARE_ALIASES) {
    for (const pat of alias.patterns) {
      if (pat.test(lower)) {
        canonicalHardware = alias.canonical;
        break;
      }
    }
    if (canonicalHardware) break;
  }

  // 2. Nhận diện thương hiệu (Brand)
  let brandName = null;
  for (const b of KNOWN_BRANDS) {
    const brandRegex = new RegExp(`\\b${b}\\b`, 'i');
    if (brandRegex.test(lower)) {
      brandName = b.toUpperCase();
      break;
    }
  }

  // 3. Nhận diện Kho (Warehouse)
  let warehouseName = null;
  for (const w of KNOWN_WAREHOUSES) {
    if (w.match.test(lower)) {
      warehouseName = w.name;
      break;
    }
  }

  // 4. Nhận diện Phương thức thanh toán (Payment Method)
  let paymentMethod = null;
  for (const pm of PAYMENT_METHODS) {
    if (pm.match.test(lower)) {
      paymentMethod = pm.code;
      break;
    }
  }

  // 5. Tìm kiếm Fuzzy trong CSDL nếu có Prisma instance
  let dbMatchedProduct = null;
  let productName = canonicalHardware;

  if (prisma && (canonicalHardware || brandName)) {
    try {
      const searchKw = canonicalHardware || brandName;
      const candidates = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          name: { contains: searchKw, mode: 'insensitive' }
        },
        select: { productId: true, name: true, price: true, stockQuantity: true },
        take: 5
      });

      if (candidates && candidates.length > 0) {
        // Áp dụng Trigram Similarity để chọn sản phẩm sát nhất
        let bestScore = -1;
        let bestCandidate = candidates[0];

        for (const cand of candidates) {
          const score = calculateTrigramSimilarity(text, cand.name);
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = cand;
          }
        }

        dbMatchedProduct = bestCandidate;
        if (!productName) {
          productName = bestCandidate.name;
        }
      }
    } catch {
      // Fallback êm nếu DB tạm thời không phản hồi
    }
  }

  return {
    productName: productName || canonicalHardware,
    canonicalHardware,
    brandName,
    warehouseName,
    paymentMethod,
    dbMatchedProduct
  };
};

module.exports = {
  calculateTrigramSimilarity,
  resolveEntities,
  HARDWARE_ALIASES,
  KNOWN_BRANDS
};
