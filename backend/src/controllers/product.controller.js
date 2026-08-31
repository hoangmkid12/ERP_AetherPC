const prisma = require('../config/database');

const getProducts = async (req, res, next) => {
  try {
    const { category, brand, min_price, max_price, search } = req.query;
    const pageNum = req.query.page ? parseInt(req.query.page) : null;
    const limitNum = req.query.limit ? parseInt(req.query.limit) : null;
    
    const query = { where: {} };

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
        include: {
          images: {
            orderBy: { sortOrder: 'asc' }
          },
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

// AI Recommender mock matching specs
const getAIRecommendations = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get current product details
    const product = await prisma.product.findUnique({
      where: { productId: id }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Retrieve other products in the same category
    const similarProducts = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        productId: { not: product.productId },
        available: true
      },
      take: 5
    });

    res.json({
      success: true,
      algorithm: 'Content-Based Filtering (JSONB specs matching)',
      data: similarProducts
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

module.exports = { getProducts, getProductById, getAIRecommendations, getProductReviews, addProductReview };

// ======================
// Admin Product CRUD
// ======================

const createProduct = async (req, res, next) => {
  try {
    const { name, category, stockQuantity, price, supplier, sku, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tên sản phẩm là bắt buộc' });

    // Find or create category slug
    let categoryRecord = await prisma.category.findFirst({ where: { slug: (category || 'OTHER').toLowerCase() } });
    if (!categoryRecord) {
      categoryRecord = await prisma.category.create({
        data: { name: category || 'OTHER', slug: (category || 'OTHER').toLowerCase() }
      });
    }

    const newProduct = await prisma.product.create({
      data: {
        sku: sku || `SKU-${Date.now()}`,
        name,
        categoryId: categoryRecord.id,
        price: parseFloat(price) || 0,
        originalPrice: parseFloat(price) || 0,
        stockQuantity: parseInt(stockQuantity) || 0,
        description: description || '',
        available: true
      }
    });

    res.status(201).json({ success: true, data: newProduct });
  } catch (err) {
    next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, price, stockQuantity, stock, available, description, descriptionText } = req.body;

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

    const updated = await prisma.product.update({
      where: { productId: target.productId },
      data: {
        ...(name && { name }),
        ...(targetPrice !== undefined && !isNaN(targetPrice) && { price: targetPrice }),
        ...(qty !== undefined && !isNaN(qty) && { stockQuantity: qty }),
        ...(available !== undefined && { available: Boolean(available) }),
        ...(targetDesc && { descriptionText: targetDesc })
      }
    });

    res.json({ success: true, data: updated, message: 'Đã lưu thay đổi vào cơ sở dữ liệu thành công' });
  } catch (err) {
    console.error('Lỗi khi cập nhật sản phẩm vào CSDL:', err);
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

Object.assign(module.exports, { createProduct, updateProduct, deleteProduct });
