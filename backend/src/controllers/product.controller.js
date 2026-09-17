const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');
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
      return res.status(404).json({ success: false, message: 'Product not found' });
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
      return res.status(404).json({ success: false, message: 'Product not found' });
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
    const { name, category, brand, stockQuantity, threshold, price, sku, description, descriptionText, available, supplierCode } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tên sản phẩm là bắt buộc' });

    if (supplierCode !== undefined && supplierCode !== null && String(supplierCode).trim() !== '') {
      const supplierExists = await prisma.supplier.findUnique({ where: { code: String(supplierCode).trim() } });
      if (!supplierExists) {
        return res.status(400).json({ success: false, message: `Không tìm thấy Nhà Cung Cấp với mã ${supplierCode}` });
      }
    }

    // Resolve to the real seeded Category (see PRODUCT_CODE_TO_CATEGORY_SLUG above) —
    // only fall back to creating a brand-new category when the code isn't one of Kho's
    // known ones, same "find or create" safety net as before for that edge case.
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
    const coverFile = req.files?.image?.[0];
    const galleryFiles = req.files?.images || [];

    // Also create the matching Inventory row (default warehouse 1, same fallback
    // adjustInventory already uses) in the same transaction — without this, a brand-new
    // Product has zero Inventory rows and would be invisible in Kho's own product table
    // (GET /warehouse/inventory joins off Inventory, not Product), i.e. the very screen
    // this was just added from. locationId is left null, same as adjustInventory today —
    // structured zone/shelf/bin assignment isn't wired up anywhere yet.
    // `images` (ProductImage rows) never include the cover shot — Product.primaryImage
    // already carries it, and ProductDetail.jsx:280-281 separately prepends
    // product.image ahead of imageUrls, so duplicating it into ProductImage would show
    // the cover photo twice in the storefront gallery.
    const [createdProduct] = await prisma.$transaction([
      prisma.product.create({
        data: {
          productId,
          handle,
          sku: sku || `SKU-${Date.now()}`,
          name,
          categoryId: categoryRecord.id,
          brandId: brandRecord.id,
          price: parseFloat(price) || 0,
          originalPrice: parseFloat(price) || 0,
          stockQuantity: qty,
          descriptionText: descriptionText || description || '',
          available: available !== undefined ? parseBoolField(available) : true,
          ...(coverFile && { primaryImage: `/api/uploads/products/${coverFile.filename}` }),
          ...(supplierCode !== undefined && String(supplierCode).trim() !== '' && { defaultSupplierCode: String(supplierCode).trim() })
        },
        include: { category: true, defaultSupplier: { select: { code: true, name: true } }, images: { orderBy: { sortOrder: 'asc' } } }
      }),
      prisma.inventory.create({
        data: {
          productId,
          warehouseId: 1,
          quantityOnHand: qty,
          reorderPoint: parseInt(threshold, 10) || 5
        }
      }),
      ...(galleryFiles.length > 0 ? [prisma.productImage.createMany({
        data: galleryFiles.map((file, idx) => ({
          productId,
          url: `/api/uploads/products/${file.filename}`,
          sortOrder: idx
        }))
      })] : [])
    ]);

    // createdProduct.images is always [] here — the ProductImage rows above are
    // inserted as a LATER step in the same transaction array, so the `images` include
    // captured on product.create() ran before they existed. Re-fetch once the
    // transaction has committed so the response actually reflects the saved gallery.
    const newProduct = galleryFiles.length > 0
      ? await prisma.product.findUnique({
          where: { productId },
          include: { category: true, defaultSupplier: { select: { code: true, name: true } }, images: { orderBy: { sortOrder: 'asc' } } }
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
    const { name, price, stockQuantity, stock, available, description, descriptionText, supplierCode } = req.body;

    const qty = stockQuantity !== undefined ? parseInt(stockQuantity, 10) : (stock !== undefined ? parseInt(stock, 10) : undefined);
    const targetPrice = price !== undefined ? parseFloat(price) : undefined;
    const targetDesc = description || descriptionText;

    const strId = String(id);
    // Find product by productId or sku
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

    // Kho's product-edit form assigns the manufacturer/distributor via this field —
    // validate against the real Supplier table so a stale/mistyped code can't silently
    // stick a product with a NCC that doesn't exist (findFirst below returns
    // undefined -> "Chưa rõ" everywhere the code is displayed).
    if (supplierCode !== undefined && supplierCode !== null && String(supplierCode).trim() !== '') {
      const supplierExists = await prisma.supplier.findUnique({ where: { code: String(supplierCode).trim() } });
      if (!supplierExists) {
        return res.status(400).json({ success: false, message: `Không tìm thấy Nhà Cung Cấp với mã ${supplierCode}` });
      }
    }

    const coverFile = req.files?.image?.[0];
    const galleryFiles = req.files?.images || [];

    const updated = await prisma.product.update({
      where: { productId: target.productId },
      data: {
        ...(name && { name }),
        ...(targetPrice !== undefined && !isNaN(targetPrice) && { price: targetPrice }),
        ...(qty !== undefined && !isNaN(qty) && { stockQuantity: qty }),
        ...(available !== undefined && { available: parseBoolField(available) }),
        ...(targetDesc && { descriptionText: targetDesc }),
        ...(coverFile && { primaryImage: `/api/uploads/products/${coverFile.filename}` }),
        ...(supplierCode !== undefined && String(supplierCode).trim() !== '' && { defaultSupplierCode: String(supplierCode).trim() })
      },
      include: { defaultSupplier: { select: { code: true, name: true } } }
    });

    // Best-effort cleanup of the replaced cover photo — only ever a file this endpoint
    // itself saved (local /api/uploads/products/... path), never one of the scraper's
    // external hstatic.net URLs, and never allowed to fail the request if it can't be removed.
    if (coverFile && target.primaryImage && target.primaryImage.startsWith('/api/uploads/products/')) {
      const oldFilePath = path.join(UPLOAD_DIR, path.basename(target.primaryImage));
      fs.unlink(oldFilePath, () => {});
    }

    // New gallery photos are appended after whatever's already saved — deleting an
    // existing gallery photo is a separate action (DELETE .../images/:imageId below),
    // this endpoint never removes ProductImage rows on its own.
    if (galleryFiles.length > 0) {
      // Deleting a gallery photo (DELETE .../images/:imageId) leaves a gap in sortOrder
      // rather than renumbering the rest — using count() here would collide with
      // whatever sortOrder value survived the gap (e.g. delete #1 of [0,1,2], count()
      // says 2, next new photo gets sortOrder 2 too, same as the surviving photo).
      // max()+1 always lands strictly after every remaining photo.
      const { _max } = await prisma.productImage.aggregate({ where: { productId: target.productId }, _max: { sortOrder: true } });
      const nextSortOrder = (_max.sortOrder ?? -1) + 1;
      await prisma.productImage.createMany({
        data: galleryFiles.map((file, idx) => ({
          productId: target.productId,
          url: `/api/uploads/products/${file.filename}`,
          sortOrder: nextSortOrder + idx
        }))
      });
    }

    const responseProduct = galleryFiles.length > 0
      ? await prisma.product.findUnique({
          where: { productId: target.productId },
          include: { defaultSupplier: { select: { code: true, name: true } }, images: { orderBy: { sortOrder: 'asc' } } }
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
