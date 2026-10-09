// Chữ ký HMAC cho đường dẫn công khai gửi qua email (ảnh xác nhận giao hàng): ứng dụng email tải ảnh
// không có cookie đăng nhập, nên đường dẫn mang chữ ký theo mã đơn — người khác dò mã đơn không xem được.
const crypto = require('crypto');

const secret = () => process.env.LINK_SIGNING_SECRET || process.env.JWT_SECRET || '';

const signOrderLink = (orderId, purpose = 'proof') =>
  crypto.createHmac('sha256', secret()).update(`${purpose}:${orderId}`).digest('hex').slice(0, 32);

const verifyOrderLink = (orderId, sig, purpose = 'proof') => {
  if (!sig || !secret()) return false;
  const expected = Buffer.from(signOrderLink(orderId, purpose));
  const given = Buffer.from(String(sig));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

module.exports = { signOrderLink, verifyOrderLink };
