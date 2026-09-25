// Nhãn tiếng Việt cho các mã trạng thái — nguồn DUY NHẤT phía backend (email, chatbot,
// thông báo trả về cho frontend). Bản đầy đủ có màu badge nằm ở
// frontend/src/utils/statusLabels.js; hai file phải giữ cùng nhãn.
//
// Mã trạng thái trong CSDL vẫn giữ dạng UPPER_SNAKE tiếng Anh (PENDING, PAID...) vì toàn
// bộ logic chuyển trạng thái/phân quyền so sánh trên các mã này — chỉ phần HIỂN THỊ được
// dịch, qua labelOf().

const ORDER_STATUS_VI = {
  PENDING: 'Chờ Xác Nhận',
  WAITING_PAYMENT: 'Chờ Thanh Toán',
  CONFIRMED: 'Đã Xác Nhận',
  PACKED: 'Đã Đóng Gói',
  PROCESSING: 'Đang Chuẩn Bị Hàng',
  AWAITING_STOCK: 'Chờ Nhập Hàng',
  READY_TO_SHIP: 'Sẵn Sàng Giao',
  SHIPPED: 'Đang Giao Hàng',
  DELIVERED: 'Đã Giao Hàng',
  COMPLETED: 'Hoàn Tất',
  CANCELLED: 'Đã Hủy',
  FAILED_DELIVERY: 'Giao Thất Bại',
  SHIPPING_FAILED: 'Giao Thất Bại - Hẹn Lại',
  RETURNING_TO_WAREHOUSE: 'Đang Hoàn Về Kho',
  RETURN_REQUESTED: 'Yêu Cầu Trả Hàng',
  RETURN_APPROVED: 'Đã Duyệt Trả Hàng',
  RETURNING: 'Đang Trả Hàng',
  RETURNED: 'Đã Trả Hàng',
  REFUNDED: 'Đã Hoàn Tiền',
  // Trạng thái do luồng đổi trả ghi lên đơn hàng gốc
  DELIVERED_TO_WAREHOUSE: 'Đã Về Kho - Chờ QC',
  QC_PASSED: 'QC Thẩm Định Đạt',
  RESTOCKED: 'Đã Nhập Lại Kho',
  EXCHANGED: 'Đã Đổi Mới 1-1',
  VENDOR_WARRANTY: 'Đã Chuyển Gửi Hãng Bảo Hành',
  INSPECTED_SCRAP: 'Phế Phẩm / Kho Lỗi',
  RETURNING_TO_CUSTOMER: 'Đang Giao Trả Khách',
  RETURNED_TO_CUSTOMER: 'Đã Trả Lại Khách',
  REJECTED: 'Từ Chối Đổi Trả'
};

const PO_STATUS_VI = {
  DRAFT: 'Bản Nháp',
  RFQ: 'Yêu Cầu Báo Giá',
  RFQ_SENT: 'Đã Gửi Yêu Cầu Báo Giá',
  SENT: 'Đã Gửi Yêu Cầu Báo Giá',
  QUOTED: 'Nhà Cung Cấp Đã Báo Giá',
  PENDING_PO_DRAFT: 'Đã Chọn Báo Giá - Chờ Lập Phiếu',
  CONVERTED: 'Đã Lập Phiếu Mua Hàng',
  QUOTED_PENDING_CEO: 'Chờ Ban Giám Đốc Duyệt',
  PO: 'Đơn Mua Hàng Đã Duyệt',
  CONFIRMED_BY_SUPPLIER: 'Nhà Cung Cấp Đã Xác Nhận',
  QA_PASSED: 'Đạt Kiểm Định',
  QA_PARTIAL: 'Đạt Kiểm Định Một Phần',
  QA_REJECTED: 'Không Đạt Kiểm Định',
  RECEIVED: 'Đã Nhập Kho',
  DONE: 'Hoàn Tất',
  COMPLETED: 'Hoàn Tất',
  CANCELLED: 'Đã Hủy'
};

const TIER_VI = {
  REGULAR: 'Thường',
  BRONZE: 'Đồng',
  SILVER: 'Bạc',
  GOLD: 'Vàng',
  PLATINUM: 'Bạch Kim',
  DIAMOND: 'Kim Cương',
  B2B: 'Doanh Nghiệp (B2B)'
};

// Không bao giờ trả về mã tiếng Anh thô cho người dùng: mã lạ (chưa có nhãn) hiện là
// "Chưa xác định" — thêm nhãn vào đúng bảng ở trên khi phát sinh trạng thái mới.
const labelOf = (map, code) => (code && map[code]) || (code ? 'Chưa xác định' : 'Không có');

module.exports = { ORDER_STATUS_VI, PO_STATUS_VI, TIER_VI, labelOf };
