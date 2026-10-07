const multer = require('multer');

// Ảnh/video khách gửi trong chat CSKH. Giữ trong bộ nhớ rồi ghi vào CSDL (bảng chat_attachments).
const MAX_CHAT_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image',
  'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video'
};

// Không tin vào MIME do trình duyệt khai báo: đối chiếu chữ ký byte đầu tệp để chặn tệp đổi đuôi.
const sniff = (buf) => {
  if (!buf || buf.length < 12) return null;
  const hex = buf.subarray(0, 12).toString('hex');
  const ascii = buf.subarray(0, 12).toString('latin1');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return 'image/gif';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (hex.startsWith('1a45dfa3')) return 'video/webm';
  if (ascii.slice(4, 8) === 'ftyp') return ascii.slice(8, 10) === 'qt' ? 'video/quicktime' : 'video/mp4';
  return null;
};

const upload = multer({
  storage: multer.memoryStorage(),
  // multer báo lỗi ngay khi chạm ngưỡng nên đặt cao hơn 1 byte, rồi tự kiểm tra '> 10MB' để tệp đúng 10MB vẫn hợp lệ.
  limits: { fileSize: MAX_CHAT_FILE_SIZE + 1, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new Error('Chỉ gửi được tệp ảnh hoặc video.'));
    cb(null, true);
  }
}).single('file');

const uploadChatFile = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Tệp vượt quá dung lượng cho phép (10MB).' });
    }
    if (err) return res.status(400).json({ success: false, message: err.message || 'Không thể tải tệp lên.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Chưa chọn tệp.' });
    if (req.file.size > MAX_CHAT_FILE_SIZE) {
      return res.status(413).json({ success: false, message: 'Tệp vượt quá dung lượng cho phép (10MB).' });
    }
    const real = sniff(req.file.buffer);
    if (!real || !ALLOWED[real]) {
      return res.status(400).json({ success: false, message: 'Tệp không phải ảnh hoặc video hợp lệ.' });
    }
    req.file.mimetype = real;
    req.file.kind = ALLOWED[real];
    next();
  });
};

module.exports = { uploadChatFile, MAX_CHAT_FILE_SIZE };
