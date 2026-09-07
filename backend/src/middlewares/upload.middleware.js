const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Product photos uploaded from Kho's Add/Edit Product form. Stored on disk under
// backend/uploads/products/ — that directory is bind-mounted into the container
// (see docker-compose.yml: ./backend:/app), so files survive a container restart.
// Served back out at /api/uploads/products/<filename> (app.js), which rides the
// frontend's existing /api Vite proxy — no separate proxy rule needed.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'products');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ALLOWED_MIME_TYPES.includes(file.mimetype) ? ext : '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Chỉ chấp nhận file ảnh (JPEG, PNG, WEBP, GIF).'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// `image` = cover photo (Product.primaryImage, at most 1). `images` = additional gallery
// photos (ProductImage rows, up to 8 per save — matches the storefront's own gallery,
// see ProductDetail.jsx's imageUrls strip). multer reports errors (wrong type, too
// large, too many files) via its callback rather than throwing — left unwrapped, those
// would fall through to Express's default handler instead of this API's JSON error shape.
const uploadProductImages = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 8 }
]);

const uploadProductImage = (req, res, next) => {
  uploadProductImages(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Ảnh vượt quá dung lượng cho phép (tối đa 5MB).' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: 'Chỉ được chọn tối đa 8 ảnh phụ mỗi lần lưu.' });
      }
    }
    return res.status(400).json({ success: false, message: err.message || 'Không thể tải ảnh lên.' });
  });
};

module.exports = { uploadProductImage, UPLOAD_DIR };
