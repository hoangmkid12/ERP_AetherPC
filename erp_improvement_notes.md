# Báo Cáo Đánh Giá Kiến Trúc & Cải Thiện Hệ Thống ERP AetherPC

> [!NOTE]
> Bản ghi chú tổng hợp các điểm thắt cổ chai (bottlenecks) và lỗ hổng của hệ thống, đối chiếu lại với trạng thái code hiện tại (không chỉ liệt kê vấn đề gốc mà còn đánh dấu mục nào đã xử lý, mục nào vẫn còn tồn đọng). Cập nhật lần gần nhất: rà soát trực tiếp trên `backend/src`, `frontend/src`, `docker-compose.yml`.

## 1. Kiến Trúc Frontend & Quản Lý State

> ✅ **Đã xử lý**

- **Vấn đề gốc:** `ERPContext.jsx` (~2000 dòng) đảm nhận toàn bộ state hệ thống, gây re-render tràn lan.
- **Hiện trạng:** `ERPContext.jsx` đã được gỡ bỏ hoàn toàn khỏi `frontend/src`. State đã được tách theo domain sang các Zustand store (`stores/inventoryStore.js`, `salesStore.js`, `hrStore.js`, `financeStore.js`, `utilityStore.js` — xem `stores/README.md`).
- **Còn lưu ý:** Theo `CLAUDE.md`, quá trình migrate sang store vẫn *chưa hoàn tất 100%* ở một vài màn hình — cần kiểm tra từng trang cụ thể xem đang import context nào trước khi sửa.

## 2. Bảo Mật & Xác Thực (Security)

> ✅ **Đã xử lý phần lớn**

- **Lưu trữ JWT:** Đã chuyển sang `HTTP-Only Cookie` (`authToken`) — `auth.middleware.js` đọc token từ cookie hoặc header `Authorization: Bearer`, không còn đọc từ `localStorage`.
- **Hardcode Secret Key:** Đã bỏ fallback cứng. `JWT_SECRET` bắt buộc phải có trong `.env`; nếu thiếu, mọi request xác thực trả về lỗi 500 thay vì âm thầm dùng secret mặc định.
- **Dual-mode Mock API:** Chuỗi `mock-token-*` đã bị loại bỏ hoàn toàn khỏi `frontend/src`. Tuy nhiên `AuthContext` vẫn còn các fallback localStorage khác cho tài khoản demo (`mock_erp_employees`, `MOCK_USERS`...) ở môi trường **dev**; các fallback này đã bị tắt khi build production (`import.meta.env.PROD`).

## 3. Kiến Trúc Backend & Database

> ✅ **Đã xử lý** / ⚠️ **Một điểm cần theo dõi**

- **Lưu trữ Chatbot (WebSocket):** Đã chuyển sang lưu session/message vào PostgreSQL thật (`websocketService.js` + `chatService.js`), không còn phụ thuộc RAM.
- **Cronjob Duyệt Đơn Hàng:** Đã có hệ thống Queue thật (`orderQueue.js` + `orderWorker.js`, BullMQ/ioredis), và `docker-compose.yml` giờ đã có service `redis` + service chạy `npm run queue:worker`.
  - ⚠️ **Lưu ý còn tồn đọng:** `server.js` vẫn khởi động song song `orderScheduler.js` (cơ chế `setInterval` cũ) *cùng lúc* với queue worker mới. Cần xác nhận rõ chỉ một trong hai cơ chế thực sự xử lý duyệt đơn — chạy đồng thời cả hai có nguy cơ trừ kho trùng lặp, đúng như rủi ro ban đầu ghi chú, chỉ là dưới hình thức khác (2 cơ chế chồng lấn thay vì 1 cơ chế không khóa).
- **Tìm kiếm dữ liệu:** Đã thêm B-tree index cho các cột tìm kiếm phổ biến (migration `20260823093113_add_search_indexes`, xem `backend/DATABASE_INDEXES.md`). Vẫn **chưa có** full-text/trigram search (`pg_trgm`) — tài liệu tự ghi nhận "No full-text search (yet)", nên tìm kiếm `contains` trên tập dữ liệu rất lớn vẫn sẽ chậm hơn so với dùng index GIN/trigram.

## 4. Thiếu Sót Nghiệp Vụ Cốt Lõi (Business Logic)

> ❌ **Vẫn còn tồn đọng**

- **Định giá hàng tồn kho (COGS):** Chưa có cơ chế hạch toán giá vốn theo FIFO/LIFO/bình quân gia quyền — không tìm thấy logic COGS nào trong `backend/src`. Hệ thống vẫn chỉ lưu `Product.stockQuantity`/`Inventory.quantityOnHand` dạng số lượng đơn thuần, không tách lô giá nhập. Báo cáo lợi nhuận (P&L) vì vậy chưa phản ánh đúng giá vốn thực tế theo từng lô hàng.
- **Quản lý Serial Number:** DB đã có bảng `SerialNumber`, nhưng luồng nhập kho (`validateReceipt` trong `purchase.controller.js`/`warehouse.controller.js`) và các luồng xuất kho hiện tại **không** thao tác tới bảng này — chưa bắt buộc quét/ghi nhận Serial khi nhập/xuất hàng thật.
