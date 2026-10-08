const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');
const { deductInventory, restockInventory } = require('../services/stockSync');
const { UPLOAD_DIR } = require('../middlewares/upload.middleware');

// multipart/form-data (used when the Add/Edit Product form includes an image file)
// arrives with every field as a string, unlike a plain JSON body where `available` is
// a real boolean — Boolean('false') is true, so a naive Boolean(available) silently
// flips "ẩn" back to "hiện" whenever the request happens to include a file upload.
const parseBoolField = (v) => v === true || v === 'true';

// Kho's Add/Edit Product forms (Warehouse.jsx) use short category CODEs (CPU/VGA/RAM/...),
// not the real Category.slug values seeded from the scraper's category_slug (gpu, not vga;
// ssd/hdd, not storage — see the mirror table CATEGORY_SLUG_TO_CODE in
// frontend/src/stores/inventoryStore.js). createProduct must resolve a CODE to the SAME
// existing Category row the other 1500+ scraped products already use, not create a
// near-duplicate category by lowercasing the code directly.
const PRODUCT_CODE_TO_CATEGORY_SLUG = {
  CPU: 'cpu',
  VGA: 'gpu',
  RAM: 'ram',
  STORAGE: 'ssd', // Warehouse's form doesn't distinguish SSD/HDD — SSD is the common case.
  MAINBOARD: 'mainboard',
  PSU: 'psu',
  CASE: 'case',
  COOLER: 'cooler',
  MONITOR: 'monitor',
  KEYBOARD: 'keyboard',
  MOUSE: 'mouse'
};

const getProducts = async (req, res, next) => {
  try {
    const { category, brand, min_price, max_price, search } = req.query;
    const pageNum = req.query.page ? parseInt(req.query.page) : null;
    const limitNum = req.query.limit ? parseInt(req.query.limit) : null;

    // Public storefront listing (Home/Products/FlashSale/PCBuilder/ProductDetail all read
    // this same endpoint) — a product Kho marked available=false must not show up here,
    // this was previously unfiltered so "ẩn" never actually hid anything.
    const query = { where: { available: true } };

    // Search filter
    if (search) {
      query.where.name = { contains: search, mode: 'insensitive' };
    }

    // Category filter
    if (category) {
      query.where.category = { slug: category };
    }

    // Brand filter
    if (brand) {
      query.where.brand = { name: brand };
    }

    // Price range filters
    if (min_price || max_price) {
      query.where.price = {};
      if (min_price) query.where.price.gte = parseFloat(min_price);
      if (max_price) query.where.price.lte = parseFloat(max_price);
    }

    // Pagination
    const skip = pageNum && limitNum ? (pageNum - 1) * limitNum : undefined;
    const take = limitNum ? limitNum : undefined;

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        ...query,
        // No `images` here on purpose — this is the LISTING query (Home/Products/
        // FlashSale/PCBuilder), which only ever renders one cover thumbnail per card
        // (primaryImage, a plain scalar field, already included). Pulling every
        // gallery photo (some products carry 30+) for all ~1538 rows on every list
        // load was needlessly bloating this response; getProductById below still
        // includes the full gallery for the one-product detail page that actually
        // needs it.
        include: {
          brand: true,
          category: true
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where: query.where })
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: pageNum || 1,
        limit: limitNum || total,
        pages: limitNum ? Math.ceil(total / limitNum) : 1
      }
    });
  } catch (err) {
    next(err);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { productId: id },
      include: {
        category: true,
        brand: true,
        images: true,
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
};

// Đơn hàng bị hủy/hoàn không phản ánh nhu cầu mua thật — loại khỏi mọi phép
// tính "hành vi mua sắm" (bán chạy, mua cùng, gợi ý cá nhân hóa) bên dưới.
const VALID_SALE_ORDER_STATUSES_EXCLUDE = ['CANCELLED', 'RETURNED', 'REFUNDED'];

const PRODUCT_RELATIONS_INCLUDE = {
  category: { select: { name: true, slug: true } },
  brand: { select: { name: true } },
  images: { take: 1, orderBy: { sortOrder: 'asc' } }
};

/**
 * Tính "bán chạy nhất" từ số lượng thật đã bán trong OrderItem — thay cho
 * cách cũ dùng p.id % 11 sinh số rating/review giả ở frontend (Home.jsx),
 * không phản ánh chút hành vi mua sắm thật nào của khách hàng.
 * @param {number} limit
 * @param {string[]} excludeIds - productId cần loại trừ (vd khách đã mua rồi)
 */
const computeBestSellers = async (limit = 8, excludeIds = []) => {
  const salesAgg = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: { status: { notIn: VALID_SALE_ORDER_STATUSES_EXCLUDE } },
      productId: { notIn: excludeIds }
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit * 3 // đệm dư phòng vài sản phẩm đã ngừng bán (available=false)
  });

  if (salesAgg.length === 0) return [];

  const productIds = salesAgg.map(s => s.productId);
  const products = await prisma.product.findMany({
    where: { productId: { in: productIds }, available: true },
    include: PRODUCT_RELATIONS_INCLUDE
  });
  const productMap = new Map(products.map(p => [p.productId, p]));

  return salesAgg
    .map(s => {
      const p = productMap.get(s.productId);
      return p ? { ...p, soldQuantity: s._sum.quantity || 0 } : null;
    })
    .filter(Boolean)
    .slice(0, limit);
};

// GET /api/v1/products/best-sellers — Top sản phẩm bán chạy THẬT, thay cho
// "Sản Phẩm Bán Chạy Nhất" trên Home.jsx trước đây tính bằng công thức giả.
const getBestSellers = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 8;
    const data = await computeBestSellers(limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/products/personalized — Gợi ý theo lịch sử mua hàng thật của
// CHÍNH khách đang đăng nhập: xem họ hay mua danh mục/hãng nào, đề xuất thêm
// sản phẩm CÙNG danh mục/hãng đó mà họ CHƯA mua. Khách vãng lai hoặc khách
// mới chưa có đơn nào thì trả về bán chạy nhất toàn shop (personalized:false)
// để frontend biết hiển thị tiêu đề phù hợp thay vì giả vờ đã cá nhân hóa.
const getPersonalizedRecommendations = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 8;

    if (!req.user || req.user.role !== 'CUSTOMER') {
      return res.json({ success: true, personalized: false, data: await computeBestSellers(limit) });
    }

    const pastItems = await prisma.orderItem.findMany({
      where: {
        order: { customerId: req.user.id, status: { notIn: VALID_SALE_ORDER_STATUSES_EXCLUDE } }
      },
      select: { productId: true }
    });

    if (pastItems.length === 0) {
      return res.json({ success: true, personalized: false, data: await computeBestSellers(limit) });
    }

    const purchasedIds = [...new Set(pastItems.map(i => i.productId))];
    const purchasedProducts = await prisma.product.findMany({
      where: { productId: { in: purchasedIds } },
      select: { categoryId: true, brandId: true }
    });

    // Tần suất danh mục/hãng khách đã mua — đại diện cho "gu" mua sắm của họ.
    const categoryFreq = {};
    const brandFreq = {};
    purchasedProducts.forEach(p => {
      categoryFreq[p.categoryId] = (categoryFreq[p.categoryId] || 0) + 1;
      brandFreq[p.brandId] = (brandFreq[p.brandId] || 0) + 1;
    });
    const topCategoryIds = Object.entries(categoryFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([catId]) => parseInt(catId, 10));

    const candidates = await prisma.product.findMany({
      where: {
        categoryId: { in: topCategoryIds },
        productId: { notIn: purchasedIds }, // không gợi ý lại thứ đã mua
        available: true
      },
      include: PRODUCT_RELATIONS_INCLUDE,
      take: 40
    });

    if (candidates.length === 0) {
      return res.json({ success: true, personalized: false, data: await computeBestSellers(limit, purchasedIds) });
    }

    const scored = candidates
      .map(p => ({
        ...p,
        _score: (brandFreq[p.brandId] || 0) * 2 + (categoryFreq[p.categoryId] || 0)
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);

    res.json({ success: true, personalized: true, data: scored });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/products/:id/recommendations — trước đây chỉ lấy đại 5 sản
// phẩm "cùng danh mục" (không include category/brand/images nên frontend
// hiện brand rỗng, không ảnh) dù tự gắn nhãn "AI/Content-Based Filtering".
// Giờ có 2 tầng thật:
//   1. "Khách mua sản phẩm này cũng thường mua" — lọc cộng tác (collaborative
//      filtering) thật từ OrderItem: những đơn có sản phẩm này còn có sản
//      phẩm nào khác đi kèm, xếp theo tần suất.
//   2. Lấp đầy bằng gợi ý theo nội dung (cùng danh mục, ưu tiên cùng hãng và
//      mức giá gần nhau) khi chưa đủ dữ liệu mua cùng (sản phẩm mới/ít bán).
const getAIRecommendations = async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit, 10) || 8;

    const product = await prisma.product.findUnique({ where: { productId: id } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }

    const coOrders = await prisma.orderItem.findMany({
      where: { productId: id, order: { status: { notIn: VALID_SALE_ORDER_STATUSES_EXCLUDE } } },
      select: { orderId: true }
    });
    const orderIds = [...new Set(coOrders.map(i => i.orderId))];

    let togetherProducts = [];
    if (orderIds.length > 0) {
      const togetherAgg = await prisma.orderItem.groupBy({
        by: ['productId'],
        where: { orderId: { in: orderIds }, productId: { not: id } },
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: limit
      });
      const togetherIds = togetherAgg.map(t => t.productId);
      if (togetherIds.length > 0) {
        const found = await prisma.product.findMany({
          where: { productId: { in: togetherIds }, available: true },
          include: PRODUCT_RELATIONS_INCLUDE
        });
        const foundMap = new Map(found.map(p => [p.productId, p]));
        // Giữ đúng thứ tự xếp hạng theo tần suất mua cùng, không theo thứ tự trả về của findMany.
        togetherProducts = togetherIds.map(pid => foundMap.get(pid)).filter(Boolean);
      }
    }

    const usedAlgorithms = [];
    if (togetherProducts.length > 0) usedAlgorithms.push('Collaborative Filtering (mua cùng đơn hàng)');

    let combined = togetherProducts;
    if (combined.length < limit) {
      const excludeIds = [product.productId, ...combined.map(p => p.productId)];
      const sameCategory = await prisma.product.findMany({
        where: { categoryId: product.categoryId, productId: { notIn: excludeIds }, available: true },
        include: PRODUCT_RELATIONS_INCLUDE,
        take: 30
      });
      const currentPrice = parseFloat(product.price) || 0;
      const contentScored = sameCategory
        .map(p => {
          let score = 0;
          if (p.brandId === product.brandId) score += 2;
          const priceDiffRatio = currentPrice > 0 ? Math.abs(parseFloat(p.price) - currentPrice) / currentPrice : 1;
          if (priceDiffRatio <= 0.3) score += 1;
          return { ...p, _score: score };
        })
        .sort((a, b) => b._score - a._score);

      if (contentScored.length > 0) usedAlgorithms.push('Content-Based Filtering (cùng danh mục/hãng/mức giá)');
      combined = [...combined, ...contentScored].slice(0, limit);
    }

    res.json({
      success: true,
      algorithm: usedAlgorithms.join(' + ') || 'Content-Based Filtering',
      data: combined
    });
  } catch (err) {
    next(err);
  }
};


// Get all reviews for a product
const getProductReviews = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reviews = await prisma.productReview.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true, tier: true } }
      }
    });

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      success: true,
      data: reviews,
      meta: { total: reviews.length, avgRating: Math.round(avgRating * 10) / 10 }
    });
  } catch (err) {
    next(err);
  }
};

// Add a new review (authenticated customer)
const addProductReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customerId = req.user.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating phải từ 1 đến 5' });
    }

    // Check product exists
    const product = await prisma.product.findUnique({ where: { productId: id } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại' });
    }

    // Check if customer has already reviewed this product
    const existing = await prisma.productReview.findFirst({
      where: { productId: id, customerId }
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Bạn đã đánh giá sản phẩm này rồi' });
    }

    const review = await prisma.productReview.create({
      data: {
        productId: id,
        customerId,
        rating: parseInt(rating),
        comment: comment || null
      },
      include: {
        customer: { select: { name: true, tier: true } }
      }
    });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProducts, getProductById, getAIRecommendations, getBestSellers, getPersonalizedRecommendations, getProductReviews, addProductReview };

// ======================
// Admin Product CRUD
// ======================

const slugifyHandle = (text) => (text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const createProduct = async (req, res, next) => {
  try {
    const {
      name, category, brand, stockQuantity, threshold, price, originalPrice, sku,
      description, descriptionText, available, supplierCode, warranty, specs, imageUrl, galleryUrls
    } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tên sản phẩm là bắt buộc' });

    if (supplierCode !== undefined && supplierCode !== null && String(supplierCode).trim() !== '') {
      const supplierExists = await prisma.supplier.findUnique({ where: { code: String(supplierCode).trim() } });
      if (!supplierExists) {
        return res.status(400).json({ success: false, message: `Không tìm thấy Nhà Cung Cấp với mã ${supplierCode}` });
      }
    }

    // Resolve category
    const categorySlug = PRODUCT_CODE_TO_CATEGORY_SLUG[(category || '').toUpperCase()] || (category || 'other').toLowerCase();
    let categoryRecord = await prisma.category.findFirst({ where: { slug: categorySlug } });
    if (!categoryRecord) {
      categoryRecord = await prisma.category.create({
        data: { name: category || 'OTHER', slug: categorySlug }
      });
    }

    // Find or create brand by name
    const brandName = brand || 'Khác';
    let brandRecord = await prisma.brand.findFirst({ where: { name: brandName } });
    if (!brandRecord) {
      brandRecord = await prisma.brand.create({ data: { name: brandName } });
    }

    const productId = `PROD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const handle = `${slugifyHandle(name)}-${Date.now()}`;
    const qty = parseInt(stockQuantity, 10) || 0;

    const numPrice = parseFloat(price) || 0;
    const numOrigPrice = (originalPrice !== undefined && originalPrice !== '' && !isNaN(parseFloat(originalPrice)))
      ? parseFloat(originalPrice)
      : numPrice;
    let discountPercent = 0;
    if (numOrigPrice > numPrice && numOrigPrice > 0) {
      discountPercent = Math.round(((numOrigPrice - numPrice) / numOrigPrice) * 100);
    }

    let parsedSpecs = {};
    if (specs) {
      if (typeof specs === 'string') {
        try { parsedSpecs = JSON.parse(specs); } catch (_) { parsedSpecs = {}; }
      } else if (typeof specs === 'object' && specs !== null) {
        parsedSpecs = specs;
      }
    }
    const warrantyStr = warranty ? String(warranty).trim() : '36 tháng';
    if (!parsedSpecs['Bảo hành'] && !parsedSpecs['bảo_hành'] && warrantyStr) {
      parsedSpecs['Bảo hành'] = warrantyStr;
    }

    const coverFile = req.files?.image?.[0];
    const directCover = (imageUrl || req.body.primaryImage) ? String(imageUrl || req.body.primaryImage).trim() : null;
    const resolvedCover = coverFile ? `/api/uploads/products/${coverFile.filename}` : directCover;

    const galleryFiles = req.files?.images || [];
    let parsedGalleryUrls = [];
    if (Array.isArray(galleryUrls)) {
      parsedGalleryUrls = galleryUrls.map(u => String(u).trim()).filter(Boolean);
    } else if (typeof galleryUrls === 'string' && galleryUrls.trim()) {
      try {
        const arr = JSON.parse(galleryUrls);
        if (Array.isArray(arr)) parsedGalleryUrls = arr.map(u => String(u).trim()).filter(Boolean);
        else parsedGalleryUrls = galleryUrls.split(',').map(u => u.trim()).filter(Boolean);
      } catch (_) {
        parsedGalleryUrls = galleryUrls.split(',').map(u => u.trim()).filter(Boolean);
      }
    }
    const allGalleryItems = [
      ...galleryFiles.map(file => `/api/uploads/products/${file.filename}`),
      ...parsedGalleryUrls
    ];

    const [createdProduct] = await prisma.$transaction([
      prisma.product.create({
        data: {
          productId,
          handle,
          sku: sku || `SKU-${Date.now()}`,
          name,
          categoryId: categoryRecord.id,
          brandId: brandRecord.id,
          price: numPrice,
          originalPrice: numOrigPrice,
          discountPercent,
          warranty: warrantyStr,
          specs: parsedSpecs,
          stockQuantity: qty,
          descriptionText: descriptionText || description || '',
          available: available !== undefined ? parseBoolField(available) : true,
          ...(resolvedCover && { primaryImage: resolvedCover }),
          ...(supplierCode !== undefined && String(supplierCode).trim() !== '' && { defaultSupplierCode: String(supplierCode).trim() })
        },
        include: { category: true, brand: true, defaultSupplier: { select: { code: true, name: true } }, images: { orderBy: { sortOrder: 'asc' } } }
      }),
      prisma.inventory.create({
        data: {
          productId,
          warehouseId: 1,
          quantityOnHand: qty,
          reorderPoint: parseInt(threshold, 10) || 5
        }
      }),
      ...(allGalleryItems.length > 0 ? [prisma.productImage.createMany({
        data: allGalleryItems.map((url, idx) => ({
          productId,
          url,
          sortOrder: idx
        }))
      })] : [])
    ]);

    const newProduct = allGalleryItems.length > 0
      ? await prisma.product.findUnique({
          where: { productId },
          include: { category: true, brand: true, defaultSupplier: { select: { code: true, name: true } }, images: { orderBy: { sortOrder: 'asc' } } }
        })
      : createdProduct;

    res.status(201).json({ success: true, data: newProduct });
  } catch (err) {
    next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name, category, brand, price, originalPrice, stockQuantity, stock, available,
      description, descriptionText, supplierCode, warranty, specs, imageUrl, galleryUrls
    } = req.body;

    const qty = stockQuantity !== undefined ? parseInt(stockQuantity, 10) : (stock !== undefined ? parseInt(stock, 10) : undefined);
    const targetPrice = price !== undefined && price !== '' ? parseFloat(price) : undefined;
    const targetOrigPrice = originalPrice !== undefined && originalPrice !== '' && !isNaN(parseFloat(originalPrice))
      ? parseFloat(originalPrice)
      : undefined;
    const targetDesc = description || descriptionText;

    const strId = String(id);
    let target = await prisma.product.findUnique({ where: { productId: strId } });
    if (!target) {
      target = await prisma.product.findFirst({
        where: {
          OR: [
            { productId: strId },
            { sku: strId },
            { gearvnId: strId }
          ]
        }
      });
    }

    if (!target) {
      return res.status(404).json({ success: false, message: `Không tìm thấy sản phẩm với ID ${id} trong CSDL` });
    }

    if (supplierCode !== undefined && supplierCode !== null && String(supplierCode).trim() !== '') {
      const supplierExists = await prisma.supplier.findUnique({ where: { code: String(supplierCode).trim() } });
      if (!supplierExists) {
        return res.status(400).json({ success: false, message: `Không tìm thấy Nhà Cung Cấp với mã ${supplierCode}` });
      }
    }

    // Resolve brand if specified
    let brandIdToSet = undefined;
    if (brand && String(brand).trim()) {
      const brandName = String(brand).trim();
      let brandRecord = await prisma.brand.findFirst({ where: { name: brandName } });
      if (!brandRecord) {
        brandRecord = await prisma.brand.create({ data: { name: brandName } });
      }
      brandIdToSet = brandRecord.id;
    }

    // Resolve category if specified
    let categoryIdToSet = undefined;
    if (category && String(category).trim()) {
      const categorySlug = PRODUCT_CODE_TO_CATEGORY_SLUG[(category || '').toUpperCase()] || (category || 'other').toLowerCase();
      let categoryRecord = await prisma.category.findFirst({ where: { slug: categorySlug } });
      if (!categoryRecord) {
        categoryRecord = await prisma.category.create({
          data: { name: category || 'OTHER', slug: categorySlug }
        });
      }
      categoryIdToSet = categoryRecord.id;
    }

    // Calculate discountPercent
    let calculatedDiscount = undefined;
    const effectivePrice = targetPrice !== undefined ? targetPrice : parseFloat(target.price);
    const effectiveOrigPrice = targetOrigPrice !== undefined ? targetOrigPrice : parseFloat(target.originalPrice || target.price);
    if (effectiveOrigPrice > effectivePrice && effectiveOrigPrice > 0) {
      calculatedDiscount = Math.round(((effectiveOrigPrice - effectivePrice) / effectiveOrigPrice) * 100);
    } else if (effectiveOrigPrice <= effectivePrice) {
      calculatedDiscount = 0;
    }

    // Parse specs & warranty
    let parsedSpecs = undefined;
    if (specs !== undefined) {
      if (typeof specs === 'string') {
        try { parsedSpecs = JSON.parse(specs); } catch (_) { parsedSpecs = {}; }
      } else if (typeof specs === 'object' && specs !== null) {
        parsedSpecs = specs;
      }
    }
    const targetWarranty = warranty !== undefined ? String(warranty).trim() : undefined;
    if (parsedSpecs && targetWarranty && !parsedSpecs['Bảo hành'] && !parsedSpecs['bảo_hành']) {
      parsedSpecs['Bảo hành'] = targetWarranty;
    }

    // Cover image
    const coverFile = req.files?.image?.[0];
    const directCover = (imageUrl || req.body.primaryImage) ? String(imageUrl || req.body.primaryImage).trim() : undefined;
    const resolvedCover = coverFile ? `/api/uploads/products/${coverFile.filename}` : directCover;

    // Gallery images
    const galleryFiles = req.files?.images || [];
    let parsedGalleryUrls = [];
    if (Array.isArray(galleryUrls)) {
      parsedGalleryUrls = galleryUrls.map(u => String(u).trim()).filter(Boolean);
    } else if (typeof galleryUrls === 'string' && galleryUrls.trim()) {
      try {
        const arr = JSON.parse(galleryUrls);
        if (Array.isArray(arr)) parsedGalleryUrls = arr.map(u => String(u).trim()).filter(Boolean);
        else parsedGalleryUrls = galleryUrls.split(',').map(u => u.trim()).filter(Boolean);
      } catch (_) {
        parsedGalleryUrls = galleryUrls.split(',').map(u => u.trim()).filter(Boolean);
      }
    }
    const allNewGalleryItems = [
      ...galleryFiles.map(file => `/api/uploads/products/${file.filename}`),
      ...parsedGalleryUrls
    ];

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.product.update({
        where: { productId: target.productId },
        data: {
          ...(name && { name }),
          ...(categoryIdToSet && { categoryId: categoryIdToSet }),
          ...(brandIdToSet && { brandId: brandIdToSet }),
          ...(targetPrice !== undefined && !isNaN(targetPrice) && { price: targetPrice }),
          ...(targetOrigPrice !== undefined && !isNaN(targetOrigPrice) && { originalPrice: targetOrigPrice }),
          ...(calculatedDiscount !== undefined && { discountPercent: calculatedDiscount }),
          ...(targetWarranty !== undefined && { warranty: targetWarranty }),
          ...(parsedSpecs !== undefined && { specs: parsedSpecs }),
          ...(qty !== undefined && !isNaN(qty) && { stockQuantity: qty }),
          ...(available !== undefined && { available: parseBoolField(available) }),
          ...(targetDesc !== undefined && { descriptionText: targetDesc }),
          ...(resolvedCover && { primaryImage: resolvedCover }),
          ...(supplierCode !== undefined && String(supplierCode).trim() !== '' && { defaultSupplierCode: String(supplierCode).trim() })
        },
        include: { category: true, brand: true, defaultSupplier: { select: { code: true, name: true } }, images: { orderBy: { sortOrder: 'asc' } } }
      });

      if (qty !== undefined && !isNaN(qty) && qty !== target.stockQuantity) {
        const delta = qty - target.stockQuantity;
        const opts = {
          referenceId: `ADJ-${target.productId}`.slice(0, 50),
          note: `Điều chỉnh tồn kho khi sửa sản phẩm (${target.stockQuantity} → ${qty})`,
          createdBy: req.user?.username || req.user?.name || null
        };
        if (delta > 0) await restockInventory(tx, target.productId, delta, opts);
        else await deductInventory(tx, target.productId, -delta, opts);
      }
      return u;
    });

    if (coverFile && target.primaryImage && target.primaryImage.startsWith('/api/uploads/products/')) {
      const oldFilePath = path.join(UPLOAD_DIR, path.basename(target.primaryImage));
      fs.unlink(oldFilePath, () => {});
    }

    if (allNewGalleryItems.length > 0) {
      const { _max } = await prisma.productImage.aggregate({ where: { productId: target.productId }, _max: { sortOrder: true } });
      const nextSortOrder = (_max.sortOrder ?? -1) + 1;
      await prisma.productImage.createMany({
        data: allNewGalleryItems.map((url, idx) => ({
          productId: target.productId,
          url,
          sortOrder: nextSortOrder + idx
        }))
      });
    }

    const responseProduct = allNewGalleryItems.length > 0
      ? await prisma.product.findUnique({
          where: { productId: target.productId },
          include: { category: true, brand: true, defaultSupplier: { select: { code: true, name: true } }, images: { orderBy: { sortOrder: 'asc' } } }
        })
      : updated;

    res.json({ success: true, data: responseProduct, message: 'Đã lưu thay đổi vào cơ sở dữ liệu thành công' });
  } catch (err) {
    console.error('Lỗi khi cập nhật sản phẩm vào CSDL:', err);
    next(err);
  }
};

// PATCH /api/v1/products/admin/:id/visibility — deliberately narrow: only flips
// `available` (storefront show/hide), unlike the full updateProduct above (name/price/
// stock/supplier). Lets SALES_MANAGER toggle what's listed on the storefront without
// granting them the wider product-edit rights that route restricts to Kho/CEO/ADMIN.
const updateProductVisibility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { available } = req.body;
    if (available === undefined || typeof available !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Thiếu hoặc sai định dạng trường available (boolean).' });
    }

    const strId = String(id);
    let target = await prisma.product.findUnique({ where: { productId: strId } });
    if (!target) {
      target = await prisma.product.findFirst({
        where: { OR: [{ productId: strId }, { sku: strId }, { gearvnId: strId }] }
      });
    }
    if (!target) {
      return res.status(404).json({ success: false, message: `Không tìm thấy sản phẩm với ID ${id} trong CSDL` });
    }

    const updated = await prisma.product.update({
      where: { productId: target.productId },
      data: { available }
    });

    res.json({ success: true, data: updated, message: available ? 'Đã hiển thị sản phẩm trên trang bán hàng.' : 'Đã ẩn sản phẩm khỏi trang bán hàng.' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/products/admin/:id/images/:imageId — removes one gallery (ProductImage)
// photo. Separate from updateProduct's "append new gallery photos" behavior above so a
// single save action never has to describe "keep these, drop those, add these" at once.
const deleteProductImage = async (req, res, next) => {
  try {
    const { id, imageId } = req.params;
    const image = await prisma.productImage.findUnique({ where: { id: parseInt(imageId, 10) } });
    if (!image || image.productId !== String(id)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh này cho sản phẩm.' });
    }

    await prisma.productImage.delete({ where: { id: image.id } });

    // Best-effort: only ever removes a file this API itself saved (local upload path),
    // never an external hstatic.net URL from the scraped catalog.
    if (image.url && image.url.startsWith('/api/uploads/products/')) {
      fs.unlink(path.join(UPLOAD_DIR, path.basename(image.url)), () => {});
    }

    res.json({ success: true, message: 'Đã xoá ảnh.' });
  } catch (err) {
    next(err);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.product.update({
      where: { productId: id },
      data: { available: false }
    });
    res.json({ success: true, message: `Đã ngừng kinh doanh sản phẩm ID ${id}` });
  } catch (err) {
    next(err);
  }
};

Object.assign(module.exports, { createProduct, updateProduct, updateProductVisibility, deleteProductImage, deleteProduct });
