const { PrismaClient } = require('@prisma/client');

// Ngay sau khi đăng nhập, trang quản trị tải song song nhiều danh sách lớn (đơn hàng, tồn kho, sổ cái, lương...).
// Với mặc định của Prisma (số kết nối = 2 × CPU + 1, chờ 10 giây) các truy vấn nhỏ như kiểm tra phiên /auth/me
// phải xếp hàng sau các truy vấn lớn và bị lỗi "Timed out fetching a new connection", khiến người dùng bị
// đẩy về trang đăng nhập. Nới giới hạn khi DATABASE_URL chưa tự khai báo; có thể ghi đè bằng biến môi trường.
function withPoolDefaults(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '30');
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '30');
    return u.toString();
  } catch {
    return url;
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: withPoolDefaults(process.env.DATABASE_URL) } },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

module.exports = prisma;
