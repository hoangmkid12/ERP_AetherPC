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

> ✅ **Đã xử lý**

- **Lưu trữ Chatbot (WebSocket):** Đã chuyển sang lưu session/message vào PostgreSQL thật (`websocketService.js` + `chatService.js`), không còn phụ thuộc RAM.
- **Cronjob Duyệt Đơn Hàng:** `orderScheduler.js` (poll 5h) và `orderWorker.js` (hàng đợi Redis) giờ dùng chung một hàm duy nhất — `services/orderApprovalService.js` (`approveOrderIfReady`) — thay vì mỗi nơi tự cài logic riêng. `orderWorker.js` trước đây chỉ `sleep()` giả rồi duyệt đơn thẳng, **không hề kiểm tra tồn kho**, nên nếu có traffic thật sẽ bán vượt tồn; giờ dùng đúng logic kiểm tra + trừ kho atomic-conditional như scheduler. Hàm dùng chung + điều kiện `status === 'PENDING'` re-fetch trong transaction + `updateMany` có điều kiện đảm bảo 2 cơ chế không thể duyệt trùng cùng 1 đơn dù có chạy song song.
- **Tìm kiếm dữ liệu:** Đã thêm B-tree index cho các cột tìm kiếm phổ biến (migration `20260823093113_add_search_indexes`, xem `backend/DATABASE_INDEXES.md`). Vẫn **chưa có** full-text/trigram search (`pg_trgm`) — tài liệu tự ghi nhận "No full-text search (yet)", nên tìm kiếm `contains` trên tập dữ liệu rất lớn vẫn sẽ chậm hơn so với dùng index GIN/trigram.

## 4. Thiếu Sót Nghiệp Vụ Cốt Lõi (Business Logic)

> ✅ **Đã xử lý**

- **Định giá hàng tồn kho (COGS):** Đã triển khai giá bình quân gia quyền (`Product.averageCost`, xem `utils/inventoryCosting.js`) — mỗi lần GRN nhập kho (`validateReceipt`) sẽ hòa trộn `unitCost` thật của PO vào giá bình quân của sản phẩm. Mỗi lần đơn hàng thực sự xuất kho (`orderApprovalService.js`, `order.controller.js` createOrder/updateOrderStatus) sẽ ghi 1 bút toán `LedgerEntry` (`EXPENSE`, `referenceId: COGS-{orderId}`) = `averageCost × số lượng bán` tại đúng thời điểm bán. `Accountant.jsx` giờ tính `cogsAmount` từ các bút toán này thay vì tổng tiền mua NCC (trước đây nhầm "tổng chi mua hàng trong kỳ" thành "giá vốn hàng đã bán" — mua 1000 SP chỉ bán 10 SP vẫn từng bị tính COGS = giá của 1000 SP). Đơn bị hủy/giao thất bại sẽ tự xóa bút toán COGS tương ứng, khớp với việc doanh thu đơn đó cũng bị loại khỏi P&L.
  - **Phát hiện phụ khi làm mục này:** `Product.stockQuantity` bị lệch nghiêm trọng so với tồn kho thật ở **1271/1580 sản phẩm** (seed.js tạo ngẫu nhiên 2 lần độc lập cho `Inventory` và `Product.stockQuantity`, không đồng bộ) — 80% catalog hiện `stockQuantity=0` dù kho thật có hàng, khiến các luồng đặt hàng/duyệt đơn (vốn đọc `Product.stockQuantity`) coi như hết hàng. Đã sửa `seed.js` cho các lần seed sau, và chạy `prisma/backfillProductStockFromInventory.js` để đồng bộ lại dữ liệu hiện tại.
- **Quản lý Serial Number:** Bắt buộc cho **mọi** linh kiện, ở mọi điểm nhập/xuất kho thật: GRN (`validateReceipt` × 2 route), nhập trực tiếp/kiểm kê (`adjustInventory`), và mọi điểm xuất kho khi bán (`orderApprovalService.js`, `order.controller.js`). Thiếu/sai số lượng serial hoặc serial trùng sẽ bị từ chối (400/409) ngay tại API — xem `utils/serialAllocation.js` (claim atomic-conditional, tránh 2 đơn giành cùng 1 serial) và `SerialEntryModal` ở `Warehouse.jsx` (UI quét/nhập serial trước khi xác nhận nhập kho). Đơn bị hủy/giao thất bại sẽ tự trả serial về `AVAILABLE`. Đã backfill `78,513` serial giả định (`SN-<productId>-<index>`) cho tồn kho hiện có (nhập trước khi có quy định này, không có serial thật) qua `prisma/backfillSerialNumbers.js`.
