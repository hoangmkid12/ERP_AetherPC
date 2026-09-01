// QC, QA, và QUALITY_CONTROL là 3 giá trị role tương đương nhau cho cùng một
// chức năng kiểm định chất lượng (xem CLAUDE.md). Trước đây mỗi route tự gõ tay
// mảng role riêng nên QUALITY_CONTROL bị bỏ sót ở hầu hết route nghiệp vụ thật —
// dùng hằng số dùng chung này ở mọi nơi để tránh lặp lại lỗi đó.
const QC_ROLES = ['QC', 'QA', 'QUALITY_CONTROL'];

// Chuẩn hoá 1 role QC-tương-đương về 'QC' để tra cứu các bảng phân quyền nội bộ
// (vd. allowedTransitionsByRole trong purchase.controller.js) chỉ cần khai 1 lần.
// Vai trò thật (req.user.role) vẫn được dùng nguyên khi ghi lịch sử/audit.
const normalizeQcRole = (role) => (QC_ROLES.includes(role) ? 'QC' : role);

module.exports = { QC_ROLES, normalizeQcRole };
