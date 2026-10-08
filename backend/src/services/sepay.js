// Thanh toán chuyển khoản VietQR qua SePay (https://sepay.vn).
//
// Luồng: khách đặt đơn BANK_TRANSFER → đơn ở WAITING_PAYMENT → trang thanh toán hiện mã QR do
// qr.sepay.vn sinh (đã điền sẵn số tiền và nội dung "AETHERPC <mã đơn>") → khách quét và chuyển
// khoản → SePay thấy giao dịch tiền vào tài khoản và gọi webhook POST /api/v1/payments/sepay/webhook
// → máy chủ khớp mã đơn trong nội dung, đủ tiền thì đánh dấu đã thanh toán và duyệt đơn.
//
// Cấu hình (backend/.env):
//   SEPAY_WEBHOOK_API_KEY  API Key đặt ở mục Webhook của SePay (kiểu chứng thực "API Key").
//                          Bắt buộc — thiếu thì webhook từ chối mọi yêu cầu.
//   SEPAY_ACCOUNT_NUMBER   Số tài khoản nhận tiền đã liên kết với SePay. Bỏ trống → dùng tài khoản
//   SEPAY_BANK             "VietQR mặc định" trong phân hệ Kế toán (CompanyBankAccount.isDefaultQr).
//   SEPAY_ACCOUNT_NAME     Tên chủ tài khoản hiển thị cho khách (không bắt buộc).
const crypto = require('crypto');
const prisma = require('../config/database');

const CONTENT_PREFIX = 'AETHERPC';

// Mã ngân hàng nội bộ (CompanyBankAccount.bankCode) → tên viết tắt mà qr.sepay.vn nhận
const SEPAY_BANK_NAME = {
  MB: 'MBBank', MBB: 'MBBank', VCB: 'Vietcombank', TCB: 'Techcombank', ACB: 'ACB', ICB: 'VietinBank',
  CTG: 'VietinBank', VPB: 'VPBank', BIDV: 'BIDV', TPB: 'TPBank', VIB: 'VIB', STB: 'Sacombank',
  OCB: 'OCB', MSB: 'MSB', SHB: 'SHB', HDB: 'HDBank', VBA: 'Agribank', SEAB: 'SeABank', LPB: 'LPBank',
  EIB: 'Eximbank', NAB: 'NamABank', ABB: 'ABBANK', BVB: 'BaoVietBank', KLB: 'KienLongBank', PGB: 'PGBank',
};

// Tài khoản nhận tiền: ưu tiên cấu hình môi trường, sau đó là tài khoản VietQR mặc định của công ty
async function getReceivingAccount() {
  if (process.env.SEPAY_ACCOUNT_NUMBER && process.env.SEPAY_BANK) {
    const local = await prisma.companyBankAccount.findUnique({ where: { accountNumber: process.env.SEPAY_ACCOUNT_NUMBER } }).catch(() => null);
    return {
      accountNumber: process.env.SEPAY_ACCOUNT_NUMBER,
      bank: SEPAY_BANK_NAME[process.env.SEPAY_BANK.toUpperCase()] || process.env.SEPAY_BANK,
      bankName: local?.bankName || process.env.SEPAY_BANK,
      accountHolder: process.env.SEPAY_ACCOUNT_NAME || local?.accountHolder || '',
      bankAccountId: local?.id || null,
    };
  }
  const acc = await prisma.companyBankAccount.findFirst({ where: { isDefaultQr: true, status: 'ACTIVE' } });
  if (!acc) return null;
  return {
    accountNumber: acc.accountNumber,
    bank: SEPAY_BANK_NAME[String(acc.bankCode).toUpperCase()] || acc.bankCode,
    bankName: acc.bankName,
    accountHolder: process.env.SEPAY_ACCOUNT_NAME || acc.accountHolder,
    bankAccountId: acc.id,
  };
}

// Mã thanh toán của đơn: chỉ chữ và số (ngân hàng hay bỏ dấu gạch / ký tự đặc biệt trong nội dung)
const paymentCodeOf = (orderId) => String(orderId).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const transferContentOf = (orderId) => `${CONTENT_PREFIX} ${paymentCodeOf(orderId)}`;

function buildQrUrl(account, amount, content) {
  const q = new URLSearchParams({ acc: account.accountNumber, bank: account.bank, amount: String(Math.round(Number(amount) || 0)), des: content, template: 'compact' });
  return `https://qr.sepay.vn/img?${q.toString()}`;
}

// Tìm đơn hàng từ nội dung chuyển khoản. Thử trường `code` (SePay tự nhận diện nếu đã cấu hình tiền
// tố mã thanh toán) rồi tới `content`; so khớp bỏ qua dấu gạch và chữ hoa/thường.
async function findOrderByTransfer({ code, content, description }) {
  const texts = [code, content, description].filter(Boolean).map(t => String(t).toUpperCase());
  const candidates = new Set();
  for (const t of texts) {
    const compact = t.replace(/[^A-Z0-9]/g, '');
    // ORD-YYMMDD-XXXX (máy chủ sinh) hoặc ORD-XXXXXX (giỏ hàng sinh) — thử dạng dài trước
    for (const m of compact.matchAll(/ORD(\d{6})(\d{4})?/g)) {
      if (m[2]) candidates.add(`ORD${m[1]}${m[2]}`);
      candidates.add(`ORD${m[1]}`);
    }
  }
  for (const c of candidates) {
    const rows = await prisma.$queryRaw`
      SELECT order_id FROM orders
      WHERE upper(regexp_replace(order_id, '[^A-Za-z0-9]', '', 'g')) = ${c}
      LIMIT 1`;
    if (rows.length) return rows[0].order_id;
  }
  return null;
}

// So sánh API Key theo thời gian hằng định (tránh dò khóa qua thời gian phản hồi)
function verifyWebhookAuth(req) {
  const expected = process.env.SEPAY_WEBHOOK_API_KEY;
  if (!expected) return { ok: false, status: 503, message: 'Chưa cấu hình SEPAY_WEBHOOK_API_KEY trên máy chủ.' };
  const header = String(req.headers.authorization || '');
  const given = header.replace(/^Apikey\s+/i, '').trim();
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (!/^Apikey\s+/i.test(header) || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 401, message: 'API Key không hợp lệ.' };
  }
  return { ok: true };
}

module.exports = {
  CONTENT_PREFIX, getReceivingAccount, paymentCodeOf, transferContentOf, buildQrUrl,
  findOrderByTransfer, verifyWebhookAuth,
};
