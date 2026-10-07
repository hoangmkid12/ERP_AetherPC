const prisma = require('../config/database');

// Quyền dùng một phiên chat CSKH. Trước đây máy chủ tin mã phiên do trình duyệt gửi lên, mà mã phiên
// đoán được (khách vãng lai: 4 chữ số; khách đăng nhập: suy từ tên hiển thị; shipper: mã nhân viên),
// nên ai đoán đúng mã là đọc được hội thoại của người khác. Quy tắc mới:
//  - session_guest_<32 ký tự hex ngẫu nhiên>: khách vãng lai — mã không đoán được, ai giữ mã là chủ phiên.
//  - session_cust_<mã khách hàng>: chỉ đúng khách hàng đó (xác thực bằng token đăng nhập).
//  - session_shipper_<mã nhân viên>, SHIPPER-ESCALATE-...: chỉ nhân viên giao hàng (đúng người với phiên riêng).
//  - Nhân viên CSKH, quản lý bán hàng, Ban Giám đốc, quản trị viên: mọi phiên.
const STAFF_ROLES = ['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN'];
const GUEST_RE = /^session_guest_[a-f0-9]{32}$/;
const ESCALATE_RE = /^SHIPPER-ESCALATE-[A-Za-z0-9_-]{1,80}$/;

const slug = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
const customerSessionId = (customerId) => `session_cust_${slug(customerId)}`;
const shipperSessionId = (employeeId) => `session_shipper_${slug(employeeId)}`;

const isStaffUser = (user) => Boolean(user && STAFF_ROLES.includes(user.role));
const isGuestSession = (sessionId) => GUEST_RE.test(String(sessionId || ''));

// user: { id, role } lấy từ token đã xác thực (req.user hoặc thông tin gắn vào kết nối WebSocket); null nếu chưa đăng nhập.
const canUseSession = (user, sessionId) => {
  const sid = String(sessionId || '');
  if (!sid) return false;
  if (isStaffUser(user)) return true;
  if (GUEST_RE.test(sid)) return true;
  if (user && user.id != null) {
    if (user.role === 'CUSTOMER' && sid === customerSessionId(user.id)) return true;
    if (user.role === 'DELIVERY' && (sid === shipperSessionId(user.id) || ESCALATE_RE.test(sid))) return true;
  }
  return false;
};

// Khách đăng nhập trước đây dùng mã phiên session_user_<tên>. Lần đầu khách mở phiên mới session_cust_<mã>,
// chuyển lịch sử từ phiên cũ sang (chỉ phiên cũ chưa gắn khách nào hoặc đã gắn đúng khách này) để không mất hội thoại.
const migrateLegacyCustomerSession = async (customerId, newSessionId) => {
  try {
    const exists = await prisma.chatSession.findUnique({ where: { sessionId: newSessionId }, select: { id: true } });
    if (exists) return;
    const customer = await prisma.customer.findUnique({ where: { customerId: String(customerId) }, select: { name: true, username: true, email: true } });
    if (!customer) return;
    const legacyIds = [...new Set([customer.name, customer.username, customer.email && customer.email.split('@')[0]]
      .filter(Boolean).map(v => `session_user_${slug(v)}`))];
    const legacy = await prisma.chatSession.findMany({
      where: { sessionId: { in: legacyIds }, OR: [{ customerId: null }, { customerId: String(customerId) }] },
      orderBy: { startedAt: 'asc' }
    });
    if (!legacy.length) return;
    await prisma.$transaction(async (tx) => {
      await tx.chatSession.create({
        data: {
          sessionId: newSessionId, customerId: String(customerId), customerName: legacy[0].customerName,
          status: 'OFFLINE', startedAt: legacy[0].startedAt, notes: legacy[0].notes
        }
      });
      for (const old of legacy) {
        await tx.chatMessage.updateMany({ where: { sessionId: old.sessionId }, data: { sessionId: newSessionId } });
        await tx.chatAttachment.updateMany({ where: { sessionId: old.sessionId }, data: { sessionId: newSessionId } });
        await tx.chatSession.delete({ where: { sessionId: old.sessionId } });
      }
    });
  } catch (err) {
    console.error('[ChatAccess] Không chuyển được lịch sử chat cũ:', err.message);
  }
};

module.exports = { canUseSession, isStaffUser, isGuestSession, customerSessionId, shipperSessionId, migrateLegacyCustomerSession, STAFF_ROLES };
