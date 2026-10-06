// QC, QA, và QUALITY_CONTROL là 3 giá trị role tương đương nhau cho cùng một
// chức năng kiểm định chất lượng (xem CLAUDE.md). Trước đây mỗi route tự gõ tay
// mảng role riêng nên QUALITY_CONTROL bị bỏ sót ở hầu hết route nghiệp vụ thật —
// dùng hằng số dùng chung này ở mọi nơi để tránh lặp lại lỗi đó.
const QC_ROLES = ['QC', 'QA', 'QUALITY_CONTROL'];

// Chuẩn hoá 1 role QC-tương-đương về 'QC' để tra cứu các bảng phân quyền nội bộ
// (vd. allowedTransitionsByRole trong purchase.controller.js) chỉ cần khai 1 lần.
// Vai trò thật (req.user.role) vẫn được dùng nguyên khi ghi lịch sử/audit.
const normalizeQcRole = (role) => (QC_ROLES.includes(role) ? 'QC' : role);

// Mọi tài khoản nhân viên nội bộ — dùng cho các chức năng tự phục vụ (chấm công,
// nghỉ phép, phiếu lương, hồ sơ cá nhân). EMPLOYEE là tài khoản nhân viên chung
// (văn phòng/hành chính) không thuộc phòng ban nghiệp vụ nào: chỉ có quyền tự phục vụ.
const STAFF_ROLES = [
  'CEO', 'ADMIN', 'HR', 'SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER',
  'ASSEMBLY', 'ACCOUNTANT', 'PURCHASING', 'CSKH', 'DELIVERY', 'EMPLOYEE', ...QC_ROLES
];

// Người được xem/sửa dữ liệu nhân sự của người khác.
const HR_MANAGER_ROLES = ['HR', 'CEO', 'ADMIN'];

module.exports = { QC_ROLES, normalizeQcRole, STAFF_ROLES, HR_MANAGER_ROLES };
