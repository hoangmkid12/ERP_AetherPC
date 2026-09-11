// Vietnamese labels for the @unique fields Prisma's P2002 can name in err.meta.target.
// Extend this map (not the code below it) whenever a new @unique field is added.
const UNIQUE_FIELD_LABELS_VI = {
  email: 'Email',
  username: 'Tên đăng nhập',
  phone: 'Số điện thoại',
  sku: 'Mã SKU',
  handle: 'Đường dẫn (handle)'
};

const errorMiddleware = (err, req, res, next) => {
  console.error('API Error:', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Prisma unique-constraint violation (P2002) otherwise leaks its raw,
  // multi-line "Invalid `prisma.x.create()` invocation..." message straight
  // to the client — translate it into the same kind of friendly Vietnamese
  // message individual controllers already return for a pre-checked conflict.
  if (err.code === 'P2002') {
    statusCode = 409;
    const target = Array.isArray(err.meta?.target) ? err.meta.target : (err.meta?.target ? [err.meta.target] : []);
    const fields = target.map((f) => UNIQUE_FIELD_LABELS_VI[f] || f).join(', ');
    message = fields ? `${fields} đã được sử dụng, vui lòng dùng giá trị khác` : 'Dữ liệu bị trùng với bản ghi đã tồn tại';
  }

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = { errorMiddleware };
