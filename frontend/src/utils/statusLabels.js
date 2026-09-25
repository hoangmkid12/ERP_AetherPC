// Nguồn nhãn trạng thái (status) DUY NHẤT cho toàn hệ thống — mọi nơi hiển thị
// một field `.status`/`.paymentStatus` phải tra cứu qua đây thay vì tự định
// nghĩa lại, để tránh rò rỉ tiếng Anh thô hoặc dịch sai khi thiếu case.
//
// Cách dùng:
//   import { ORDER_STATUS, getStatusLabel, getStatusInfo } from '../../utils/statusLabels';
//   getStatusLabel(ORDER_STATUS, order.status)   // chỉ lấy text
//   getStatusInfo(ORDER_STATUS, order.status)    // lấy { label, color, bg, border }

// Mã trạng thái trong CSDL vẫn giữ dạng UPPER_SNAKE tiếng Anh vì mọi logic chuyển trạng
// thái/phân quyền so sánh trên các mã này — CHỈ phần hiển thị được dịch qua file này.
//
// Tra cứu: bảng được truyền vào → bảng dự phòng dùng chung (GENERIC_STATUS, cho mã phổ
// biến bị dùng nhầm bảng) → "Chưa xác định". Không bao giờ hiện mã tiếng Anh thô.
const UNKNOWN_STYLE = { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };

const STATUS_CODE_RE = /^[A-Z][A-Z0-9_]*$/;

export const getStatusInfo = (dictionary, status) => {
  if (dictionary && dictionary[status]) return dictionary[status];
  if (status && GENERIC_STATUS[status]) return GENERIC_STATUS[status];
  if (!status) return { label: 'Không có', ...UNKNOWN_STYLE };
  // Chuỗi không phải mã (vd dữ liệu cũ đã lưu sẵn nhãn tiếng Việt) → giữ nguyên để hiển thị;
  // chỉ mã UPPER_SNAKE lạ mới bị che thành "Chưa xác định".
  return { label: STATUS_CODE_RE.test(String(status)) ? 'Chưa xác định' : String(status), ...UNKNOWN_STYLE };
};

export const getStatusLabel = (dictionary, status) => getStatusInfo(dictionary, status).label;

// ─── Order.status (đơn hàng bán, 19 giá trị — order.controller.js VALID_STATUSES) ───
export const ORDER_STATUS = {
  PENDING: { label: 'Chờ Xác Nhận', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  WAITING_PAYMENT: { label: 'Chờ Thanh Toán', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  CONFIRMED: { label: 'Đã Xác Nhận', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  PACKED: { label: 'Đã Đóng Gói', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  PROCESSING: { label: 'Đang Chuẩn Bị Hàng', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  AWAITING_STOCK: { label: 'Chờ Nhập Hàng', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  READY_TO_SHIP: { label: 'Sẵn Sàng Giao', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
  SHIPPED: { label: 'Đang Giao Hàng', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
  DELIVERED: { label: 'Đã Giao Hàng', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  COMPLETED: { label: 'Hoàn Tất', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  CANCELLED: { label: 'Đã Hủy', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  FAILED_DELIVERY: { label: 'Giao Thất Bại', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  SHIPPING_FAILED: { label: 'Giao Thất Bại - Hẹn Lại', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  RETURNING_TO_WAREHOUSE: { label: 'Đang Hoàn Về Kho', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  RETURN_REQUESTED: { label: 'Yêu Cầu Trả Hàng', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  RETURN_APPROVED: { label: 'Đã Duyệt Trả Hàng', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  RETURNING: { label: 'Đang Trả Hàng', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  RETURNED: { label: 'Đã Trả Hàng', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  REFUNDED: { label: 'Đã Hoàn Tiền', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  // Trạng thái do luồng đổi trả ghi lên đơn hàng gốc (confirmReturnWarehouse, qcInspectReturn...)
  DELIVERED_TO_WAREHOUSE: { label: 'Đã Về Kho - Chờ QC', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  QC_PASSED: { label: 'QC Thẩm Định Đạt', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  RESTOCKED: { label: 'Đã Nhập Lại Kho', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  EXCHANGED: { label: 'Đã Đổi Mới 1-1', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  VENDOR_WARRANTY: { label: 'Đã Chuyển Gửi Hãng Bảo Hành', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  INSPECTED_SCRAP: { label: 'Phế Phẩm / Kho Lỗi', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  RETURNING_TO_CUSTOMER: { label: 'Đang Giao Trả Khách', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  RETURNED_TO_CUSTOMER: { label: 'Đã Trả Lại Khách', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  REJECTED: { label: 'Từ Chối Đổi Trả', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── Order.paymentMethod / OrderPayment.method ───
export const PAYMENT_METHOD = {
  COD: { label: 'Thanh Toán Khi Nhận Hàng (COD)', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  CASH: { label: 'Tiền Mặt', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  BANK_TRANSFER: { label: 'Chuyển Khoản', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  ONLINE_GATEWAY: { label: 'Cổng Thanh Toán Online', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  EXCHANGE_1TO1: { label: 'Đổi Mới 1-1 (0đ)', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' }
};

// ─── Order.paymentStatus ───
export const PAYMENT_STATUS = {
  PENDING: { label: 'Chưa Thanh Toán', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  PAID: { label: 'Đã Thanh Toán', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  REFUNDED: { label: 'Đã Hoàn Tiền', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' }
};

// ─── PurchaseOrder.status (RFQ→PO→QA→GRN, 19 giá trị) ───
export const PO_STATUS = {
  DRAFT: { label: 'Bản Nháp', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  RFQ: { label: 'Yêu Cầu Báo Giá', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  RFQ_SENT: { label: 'Đã Gửi Báo Giá', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  QUOTED: { label: 'NCC Đã Báo Giá', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  PENDING_PO_DRAFT: { label: 'Đã Duyệt — Chờ Lập Phiếu', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  CONVERTED: { label: 'Đã Lập Phiếu Mua Hàng', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  QUOTED_PENDING_CEO: { label: 'Chờ CEO Duyệt', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  APPROVED: { label: 'Đã Phê Duyệt', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  APPROVED_BY_CEO: { label: 'CEO Đã Duyệt', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  PO: { label: 'Đơn Mua Hàng (PO)', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  CONFIRMED: { label: 'Đã Xác Nhận', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  CONFIRMED_BY_SUPPLIER: { label: 'NCC Đã Nhận Đơn', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  SENT: { label: 'Đã Gửi Đơn PO', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  SHIPPED: { label: 'Đang Vận Chuyển', color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd' },
  DELIVERED: { label: 'Đã Giao Tới Kho', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  PENDING_QA: { label: 'Chờ Kiểm Tra QC', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  QA_PASSED: { label: 'Đạt Chuẩn QC', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  QA_PARTIAL: { label: 'QC: Nhập Một Phần', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  QA_REJECTED: { label: 'Từ Chối QC', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  RECEIVED: { label: 'Đã Nhận Hàng', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  DONE: { label: 'Hoàn Tất', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  COMPLETED: { label: 'Hoàn Tất', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  CANCELLED: { label: 'Đã Hủy', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── ReturnRequest.status (đổi/trả/RMA, 13 giá trị) ───
export const RETURN_STATUS = {
  PENDING: { label: 'Chờ Xử Lý', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  RETURN_APPROVED: { label: 'Đồng Ý Thu Hồi (Giao Shipper)', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  RETURNING_TO_WAREHOUSE: { label: 'Shipper Đang Lấy Về Kho', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  DELIVERED_TO_WAREHOUSE: { label: 'Đã Về Kho - Chờ QC Thẩm Định', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  QC_PASSED: { label: 'QC Thẩm Định Đạt', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  QC_REJECTED: { label: 'QC Từ Chối', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  RESTOCKED: { label: 'Đã Nhập Lại Kho', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  EXCHANGED: { label: 'Đã Đổi Mới 1-1', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  VENDOR_WARRANTY: { label: 'Đã Chuyển Gửi Hãng Bảo Hành', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  INSPECTED_SCRAP: { label: 'Phế Phẩm / Kho Lỗi', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  REFUNDED: { label: 'Đã Hoàn Tiền', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  COMPLETED: { label: 'Hoàn Tất', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  REJECTED: { label: 'Đã Từ Chối', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  RETURNING_TO_CUSTOMER: { label: 'Đang Giao Trả Khách', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  RETURNED_TO_CUSTOMER: { label: 'Đã Trả Lại Khách', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
};

// ─── ReturnRequest.type / qcDecision ───
export const RETURN_TYPE = {
  EXCHANGE: { label: 'Đổi Mới 1-1', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  REFUND: { label: 'Hoàn Tiền', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  EXCHANGE_NEW: { label: 'Đổi Mới 1-1', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  RESTOCK_WAREHOUSE: { label: 'Nhập Lại Kho', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  APPROVE_REFUND: { label: 'Duyệt Hoàn Tiền', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  APPROVE_EXCHANGE: { label: 'Duyệt Đổi Mới', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' }
};

// ─── PurchaseRequest.status (phiếu yêu cầu mua hàng của kho) ───
export const PURCHASE_REQUEST_STATUS = {
  PENDING: { label: 'Chờ Quản Lý Kho Duyệt', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  APPROVED: { label: 'Quản Lý Kho Đã Duyệt', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  REJECTED: { label: 'Từ Chối', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  RFQ_CREATED: { label: 'Đã Lập RFQ', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' }
};

// ─── GoodsReceipt.status (phiếu nhập kho) ───
export const GOODS_RECEIPT_STATUS = {
  READY: { label: 'Chờ Nhận Hàng', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  DONE: { label: 'Đã Nhập Kho', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  CANCELLED: { label: 'Đã Hủy', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── Complaint.status (khiếu nại CSKH, 4 giá trị) ───
export const COMPLAINT_STATUS = {
  OPEN: { label: 'Mới Tiếp Nhận', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  IN_PROGRESS: { label: 'Đang Xử Lý', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  RESOLVED: { label: 'Đã Giải Quyết', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  CLOSED: { label: 'Đã Đóng', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
};

// ─── Complaint.priority ───
export const COMPLAINT_PRIORITY = {
  LOW: { label: 'Thấp', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  MEDIUM: { label: 'Trung Bình', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  HIGH: { label: 'Cao', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  URGENT: { label: 'Khẩn Cấp', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── QcInspection.status (biên bản kiểm định) ───
export const QC_STATUS = {
  PASSED: { label: 'Đạt Chuẩn 100%', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  CONDITIONAL: { label: 'Nhập Một Phần', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  FAILED: { label: 'Từ Chối Lô Hàng', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── VendorBill.status (công nợ nhà cung cấp) ───
export const VENDOR_BILL_STATUS = {
  DRAFT: { label: 'Nháp', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  POSTED: { label: 'Đã Ghi Nhận', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  PAID: { label: 'Đã Thanh Toán', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' }
};

// ─── LeaveRequest.status (nghỉ phép) ───
export const LEAVE_STATUS = {
  PENDING: { label: 'Chờ Duyệt', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  APPROVED: { label: 'Đã Duyệt', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  REJECTED: { label: 'Từ Chối', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── Payroll.status (bảng lương) ───
export const PAYROLL_STATUS = {
  DRAFT: { label: 'Dự Thảo', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  UNPAID: { label: 'Chưa Chi Trả', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  SUBMITTED_TO_CEO: { label: 'Đã Trình CEO Duyệt', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  APPROVED_BY_CEO: { label: 'CEO Đã Duyệt - Chờ Giải Ngân', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  // Bảng lương HR vừa lập — bước kế tiếp là Ban Giám Đốc duyệt (hr.routes.js approve-ceo),
  // KHÔNG phải kế toán duyệt chi như nhãn cũ.
  SUBMITTED_TO_ACCOUNTING: { label: 'Chờ Ban Giám Đốc Duyệt', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  DISBURSED: { label: 'Đã Chi Trả Lương', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  COMPLETED: { label: 'Đã Chi Trả Lương', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  PAID: { label: 'Đã Chi Trả Lương', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' }
};

// ─── Attendance.status (chấm công) ───
export const ATTENDANCE_STATUS = {
  PRESENT: { label: 'Có Mặt', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  LATE: { label: 'Đi Muộn', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  ABSENT: { label: 'Vắng Mặt', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── AssemblyJob.status (frontend-only, stores/utilityStore.js) ───
export const ASSEMBLY_STATUS = {
  PENDING: { label: 'Chờ Tiếp Nhận', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  ASSEMBLING: { label: 'Đang Lắp Ráp', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  COMPLETED: { label: 'Đã Hoàn Tất - Chờ Xuất Kho', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  CANCELLED: { label: 'Đã Hủy', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── Nhật ký kiểm toán hệ thống (SystemAdmin) ───
export const AUDIT_LOG_STATUS = {
  SUCCESS: { label: 'Thành Công', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  FAILED: { label: 'Thất Bại', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── Employee.status ───
export const EMPLOYEE_STATUS = {
  ACTIVE: { label: 'Đang Làm Việc', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  INACTIVE: { label: 'Ngừng Làm Việc', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  TERMINATED: { label: 'Đã Nghỉ Việc', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── Product.status ───
export const PRODUCT_STATUS = {
  ACTIVE: { label: 'Đang Kinh Doanh', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  DISCONTINUED: { label: 'Ngừng Kinh Doanh', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
};

// ─── SerialNumber.status ───
export const SERIAL_STATUS = {
  AVAILABLE: { label: 'Sẵn Có', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  USED: { label: 'Đã Sử Dụng', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  DEFECTIVE: { label: 'Lỗi', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  WARRANTY: { label: 'Đang Bảo Hành', color: '#b45309', bg: '#fffbeb', border: '#fde68a' }
};

// ─── ChatSession.status ───
export const CHAT_SESSION_STATUS = {
  ONLINE: { label: 'Đang Hoạt Động', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  OFFLINE: { label: 'Ngoại Tuyến', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  CLOSED: { label: 'Đã Đóng', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
};

// ─── Supplier.status / Customer.status ───
export const SUPPLIER_STATUS = {
  ACTIVE: { label: 'Đang Hợp Tác', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  INACTIVE: { label: 'Ngừng Hợp Tác', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
};
export const CUSTOMER_STATUS = {
  ACTIVE: { label: 'Đang Hoạt Động', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  INACTIVE: { label: 'Đã Khóa', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── Customer.tier (hạng thành viên) — khớp TIER_VI ở backend/src/constants/statusLabels.js ───
export const CUSTOMER_TIER = {
  REGULAR: { label: 'Khách Thường', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  BRONZE: { label: 'Hạng Đồng', color: '#9a3412', bg: '#fff7ed', border: '#fed7aa' },
  SILVER: { label: 'Hạng Bạc', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  GOLD: { label: 'Hạng Vàng', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  PLATINUM: { label: 'Hạng Bạch Kim', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  DIAMOND: { label: 'Hạng Kim Cương', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  B2B: { label: 'Doanh Nghiệp (B2B)', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' }
};

// ─── LedgerEntry.type / StockMovement.type ───
export const LEDGER_ENTRY_TYPE = {
  INCOME: { label: 'Thu', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  EXPENSE: { label: 'Chi', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  REFUND: { label: 'Hoàn Tiền', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' }
};
export const STOCK_MOVEMENT_TYPE = {
  IN: { label: 'Nhập Kho', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  OUT: { label: 'Xuất Kho', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
};

// ─── Dự phòng dùng chung: mã phổ biến khi trang tra nhầm bảng hoặc bảng thiếu mã ───
// Gộp từ các bảng trên (bảng đứng trước ưu tiên hơn), rồi phủ nhãn trung tính cho các mã
// mang nghĩa khác nhau tuỳ ngữ cảnh (PENDING, APPROVED...).
const GENERIC_STATUS = Object.assign(
  {},
  STOCK_MOVEMENT_TYPE, LEDGER_ENTRY_TYPE, CUSTOMER_TIER, COMPLAINT_PRIORITY, RETURN_TYPE, PURCHASE_REQUEST_STATUS,
  ATTENDANCE_STATUS, CHAT_SESSION_STATUS, SERIAL_STATUS, PRODUCT_STATUS, EMPLOYEE_STATUS,
  AUDIT_LOG_STATUS, ASSEMBLY_STATUS, PAYROLL_STATUS, LEAVE_STATUS, VENDOR_BILL_STATUS, QC_STATUS,
  COMPLAINT_STATUS, GOODS_RECEIPT_STATUS, RETURN_STATUS, PO_STATUS, PAYMENT_METHOD, PAYMENT_STATUS,
  ORDER_STATUS,
  {
    PENDING: { label: 'Đang Chờ Xử Lý', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    APPROVED: { label: 'Đã Duyệt', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
    REJECTED: { label: 'Từ Chối', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
    PAID: { label: 'Đã Thanh Toán', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
    UNPAID: { label: 'Chưa Thanh Toán', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    ACTIVE: { label: 'Đang Hoạt Động', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
    INACTIVE: { label: 'Ngừng Hoạt Động', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' }
  }
);

/**
 * Định dạng mã RMA chuẩn nghiệp vụ ngắn gọn, chuyên nghiệp (ví dụ #RMA-260917-4821 hoặc #RMA-A9B168)
 * Tuyệt đối không hiển thị chuỗi UUID 36 ký tự thô ra giao diện người dùng.
 */
export const formatRmaCode = (ret, fallbackIndex) => {
  if (!ret) return '';
  const rawCode = typeof ret === 'string' ? ret : (ret.rmaCode || ret.rmaNumber || ret.code);
  if (rawCode) {
    const trimmed = String(rawCode).trim();
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }
  const idStr = ret && ret.id ? String(ret.id).replace(/[^a-zA-Z0-9]/g, '') : '';
  if (idStr) {
    return `#RMA-${idStr.slice(-6).toUpperCase()}`;
  }
  const idx = fallbackIndex != null ? String(fallbackIndex).padStart(4, '0') : '0001';
  return `#RMA-${idx}`;
};
