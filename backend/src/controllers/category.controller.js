const prisma = require('../config/database');
const { logAudit } = require('../utils/auditLog');

const slugify = (name) => String(name)
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip Vietnamese diacritics
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// GET /api/v1/categories — danh mục thật kèm số sản phẩm & tổng giá trị tồn
// thật (qua categoryId thật, không phải so khớp tên hiển thị bằng regex như
// tab "Danh Mục Sản Phẩm" (Warehouse.jsx) làm trước đây — dẫn tới đếm sai/0
// cho các danh mục có tên hiển thị không chứa đúng từ khóa alias, ví dụ GPU
// vs "VGA", SSD vs "STORAGE").
const listCategories = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });

    const products = await prisma.product.findMany({
      select: { categoryId: true, price: true, stockQuantity: true }
    });
    const valueByCategory = {};
    for (const p of products) {
      valueByCategory[p.categoryId] = (valueByCategory[p.categoryId] || 0) + Number(p.price || 0) * Number(p.stockQuantity || 0);
    }

    res.json({
      success: true,
      data: categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: c._count.products,
        totalInventoryValue: valueByCategory[c.id] || 0
      }))
    });
  } catch (err) { next(err); }
};

// POST /api/v1/categories — Quản Lý Kho tạo danh mục thật (trước đây nút
// "+ Thêm Danh Mục Mới" chỉ hiện toast thành công, không lưu gì cả)
const createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên danh mục.' });
    }
    const trimmedName = String(name).trim();
    const slug = slugify(trimmedName);
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Tên danh mục không hợp lệ.' });
    }

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ success: false, message: `Danh mục "${existing.name}" đã tồn tại (trùng slug: ${slug}).` });
    }

    const category = await prisma.category.create({ data: { name: trimmedName, slug } });
    logAudit({ req, action: 'CREATE_CATEGORY', module: 'Kho Hàng', targetId: category.id, note: category.name });
    res.status(201).json({ success: true, data: { ...category, productCount: 0, totalInventoryValue: 0 } });
  } catch (err) { next(err); }
};

// PUT /api/v1/categories/:id — đổi tên danh mục (slug giữ nguyên để không phá
// các đường dẫn/bộ lọc storefront đang tham chiếu theo slug cũ)
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên danh mục.' });
    }
    const existing = await prisma.category.findUnique({ where: { id: parseInt(id, 10) } });
    if (!existing) return res.status(404).json({ success: false, message: `Không tìm thấy danh mục: ${id}` });

    const category = await prisma.category.update({ where: { id: existing.id }, data: { name: String(name).trim() } });
    logAudit({ req, action: 'UPDATE_CATEGORY', module: 'Kho Hàng', targetId: category.id, note: category.name });
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
};

// DELETE /api/v1/categories/:id — chỉ xóa được khi không còn sản phẩm nào gán vào
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.category.findUnique({
      where: { id: parseInt(id, 10) },
      include: { _count: { select: { products: true } } }
    });
    if (!existing) return res.status(404).json({ success: false, message: `Không tìm thấy danh mục: ${id}` });
    if (existing._count.products > 0) {
      return res.status(400).json({ success: false, message: `Danh mục "${existing.name}" đang có ${existing._count.products} sản phẩm — hãy chuyển sản phẩm sang danh mục khác trước khi xóa.` });
    }

    await prisma.category.delete({ where: { id: existing.id } });
    logAudit({ req, action: 'DELETE_CATEGORY', module: 'Kho Hàng', targetId: existing.id, note: existing.name });
    res.json({ success: true, message: `Đã xóa danh mục "${existing.name}".` });
  } catch (err) { next(err); }
};

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
