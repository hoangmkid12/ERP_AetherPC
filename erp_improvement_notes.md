# Báo Cáo Đánh Giá Kiến Trúc & Cải Thiện Hệ Thống ERP AetherPC

> [!NOTE]
> Đây là bản ghi chú tổng hợp các điểm thắt cổ chai (bottlenecks) và lỗ hổng hiện tại của hệ thống. Ở mức độ đồ án KLTN, hệ thống đã rất hoàn thiện, nhưng để triển khai môi trường thực tế (Production) cần giải quyết các vấn đề dưới đây.

## 1. Kiến Trúc Frontend & Quản Lý State

> [!WARNING]
> Vấn đề hiệu năng (Performance)

- **Vấn đề:** File `ERPContext.jsx` hiện đang đảm nhận toàn bộ State của hệ thống (Đơn hàng, Nhân viên, Chấm công, Kho bãi...) với gần 2000 dòng code.
- **Tác hại:** Bất kỳ thay đổi nhỏ nào (ví dụ: 1 nhân viên điểm danh) cũng sẽ gây re-render toàn bộ các component đang sử dụng `useERP()`. Gây giật lag khi dữ liệu lớn.
- **Hướng cải thiện:**
  1. Chia nhỏ Context thành các domain độc lập: `AuthContext`, `HRContext`, `SalesContext`, `InventoryContext`.
  2. Áp dụng các thư viện quản lý state tối ưu cho dữ liệu lớn như **Zustand** hoặc **Redux Toolkit**.

## 2. Bảo Mật & Xác Thực (Security)

> [!CAUTION]
> Lỗ hổng bảo mật cấp thiết cần khắc phục

- **Lưu trữ JWT:** Hiện tại Frontend lưu token ở `localStorage.getItem('token')`. Dễ bị tấn công XSS đánh cắp phiên đăng nhập.
  - **Khắc phục:** Backend nên set token vào `HTTP-Only Cookies`.
- **Hardcode Secret Key:** Trong `auth.middleware.js`, biến môi trường có fallback về một chuỗi cố định `'kltn_erp_linh_kien_may_tinh_ai_secret_key_2026'`. Kẻ tấn công có thể giả mạo token nếu biết source code.
- **Dual-mode Mock API:** Môi trường thật cần vô hiệu hóa hoàn toàn cơ chế tạo tài khoản/chạy fallback không qua API (`mock-token-*`) để ngăn chặn việc bypass hệ thống auth.

## 3. Kiến Trúc Backend & Database

> [!IMPORTANT]
> Khả năng mở rộng và chịu tải

- **Lưu trữ Chatbot (WebSocket):** Toàn bộ session chat trong `websocketService.js` đang lưu trên RAM. Nếu Server khởi động lại (restart), toàn bộ lịch sử chat CSKH sẽ bị mất.
  - **Khắc phục:** Cần lưu trữ các session này vào CSDL (PostgreSQL) hoặc Redis.
- **Cronjob Duyệt Đơn Hàng:** Hàm tự động duyệt đơn trong `orderScheduler.js` đang dùng `setInterval` chạy mỗi 1 phút trên luồng chính của Node.js. Nếu chạy nhiều server cùng lúc (Load Balancing), đơn hàng có thể bị xử lý trùng lặp và trừ kho nhiều lần.
  - **Khắc phục:** Sử dụng hệ thống Queue chuyên nghiệp như **BullMQ** kết hợp Redis để lock task và xử lý tuần tự.
- **Tìm kiếm dữ liệu:** Search sản phẩm dùng `mode: 'insensitive'` trên chuỗi text sẽ quét toàn bộ bảng (Full Table Scan), rất chậm trên tập dữ liệu lớn. Nên dùng Index `pg_trgm` của PostgreSQL hoặc chuyển qua ElasticSearch.

## 4. Thiếu Sót Nghiệp Vụ Cốt Lõi (Business Logic)

- **Định giá hàng tồn kho (COGS):** Hệ thống chỉ lưu tổng số lượng hàng trong kho (`stockQuantity`). Khi xuất hàng chưa thấy rõ cơ chế hạch toán giá trị (FIFO - Nhập trước xuất trước, hay LIFO, hay Bình quân gia quyền). Điều này ảnh hưởng đến độ chính xác của báo cáo lợi nhuận Kế toán.
- **Quản lý Serial Number:** Kinh doanh đồ công nghệ bắt buộc phải truy vết bảo hành qua mã Serial / IMEI. DB có bảng hỗ trợ nhưng luồng nhập/xuất kho hiện tại chưa bắt buộc thao tác quét/kiểm tra mã Serial thực tế.
