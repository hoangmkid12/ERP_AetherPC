# Mô Đun Khách Hàng Đặt Hàng (M_KHDH)

> **Hệ thống ERP Bán Linh Kiện Máy Tính — KLTN**  
> Cập nhật lần cuối: 31/07/2026

---

## 1. Tổng Quan

Mô-đun quản lý toàn bộ quy trình **đặt hàng trực tuyến (Storefront)** của khách hàng (B2C) và doanh nghiệp (B2B), từ lúc tìm kiếm sản phẩm, thêm vào giỏ hàng, đến khi thanh toán và tạo đơn hàng thành công trên hệ thống.

---

## 2. Quy Trình Đặt Hàng

### 2.1 Sơ Đồ Luồng Đặt Hàng

```text
Khách Hàng (Storefront)
    │
    ▼
[Tìm kiếm / Xem sản phẩm]
    │
    ▼
[Thêm vào Giỏ Hàng (Cart)]
    │
    ▼
[Tiến hành Thanh Toán (Checkout)]
    │   ├─► Nhập thông tin giao hàng
    │   ├─► Áp dụng mã giảm giá (nếu có)
    │   └─► Chọn phương thức giao hàng
    │
    ▼
[Chọn Phương Thức Thanh Toán]
    │
    ├─► (A) Thanh toán COD (Nhận hàng trả tiền)
    │
    ├─► (B) Chuyển khoản ngân hàng (B2B/Cá nhân)
    │
    └─► (C) Thanh toán Online (VNPay, Momo, Thẻ)
            │
            ▼
        [Cổng thanh toán xử lý]
            │
            ├─► Thất bại ──► Báo lỗi, yêu cầu thanh toán lại
            │
            └─► Thành công ─┐
                            │
    ┌───────────────────────┘
    ▼
[Hệ thống Tạo Đơn Hàng (Order Created)]
    │
    ├─► Trạng thái đơn: PENDING (Chờ xử lý)
    │
    ├─► Gửi Email/SMS xác nhận cho khách hàng
    │
    └─► Thông báo cho bộ phận Sale / Kho / Kế toán
```

---

## 3. Các Phương Thức Thanh Toán Hỗ Trợ

| Phương thức | Viết tắt | Áp dụng cho | Quy trình xử lý |
|---|---|---|---|
| Tiền mặt khi nhận hàng | `COD` | B2C, Khách lẻ | Đơn được duyệt ngay → Giao hàng thu tiền |
| Chuyển khoản ngân hàng | `BANK_TRANSFER` | B2B, Đơn sỉ | Kế toán xác nhận nhận được tiền → Duyệt đơn |
| Cổng thanh toán trực tuyến | `ONLINE_GATEWAY` | B2C, Khách lẻ | Tự động duyệt đơn khi cổng thanh toán báo thành công |

---

## 4. Các Phương Thức Giao Hàng Hỗ Trợ

| Phương thức | Áp dụng | Thời gian dự kiến | Phí vận chuyển |
|---|---|---|---|
| Giao hàng tiêu chuẩn | Toàn quốc | 3 - 5 ngày | Tính theo biểu phí bưu điện |
| Giao hàng hỏa tốc | Nội thành | Trong ngày (2H-4H) | Phí cao hơn, theo khoảng cách |
| Nhận tại cửa hàng (Click & Collect) | KH ở gần cửa hàng | Ngay lập tức | Miễn phí |

---

## 5. Trạng Thái Đơn Hàng Mới (M_KHDH)

Giai đoạn khách hàng đặt hàng chủ yếu liên quan đến các trạng thái đầu tiên của vòng đời đơn hàng:

| Trạng thái | Mã | Mô tả | Trách nhiệm |
|---|---|---|---|
| Chờ thanh toán | `WAITING_PAYMENT` | Đơn chọn chuyển khoản hoặc cổng TT đang chờ khách thanh toán | Khách hàng |
| Chờ xử lý | `PENDING` | Khách đặt thành công (COD hoặc đã thanh toán xong), chờ Sales duyệt | Sale |
| Đã xác nhận | `CONFIRMED` | Sale đã gọi/kiểm tra xác nhận với khách, chuyển sang Kho | Sale |
| Đã hủy | `CANCELLED` | Khách tự hủy đơn trước khi Sale xác nhận hoặc hết hạn thanh toán | Hệ thống / KH |

---

## 6. Phân Quyền Theo Bộ Phận

| Bộ Phận | Role | Quyền trong quy trình này |
|---|---|---|
| Khách Hàng | `CUSTOMER` | Tìm kiếm, xem, thêm giỏ hàng, đặt hàng, hủy đơn PENDING, theo dõi đơn |
| Nhân Viên Sale | `SALE` | Nhận thông báo đơn mới, liên hệ KH xác nhận đơn, chuyển PENDING → CONFIRMED |
| Kế Toán | `ACCOUNTANT` | Kiểm tra giao dịch chuyển khoản đối với đơn B2B/chuyển khoản |
| CEO / Admin | `CEO`, `ADMIN` | Theo dõi tổng quan doanh số và đơn hàng mới |

---

## 7. Các File / Component Liên Quan Trong Hệ Thống

| File / Component | Vai trò |
|---|---|
| `frontend/src/pages/Storefront/ProductList.jsx` | Danh sách sản phẩm để KH tìm kiếm, lọc |
| `frontend/src/pages/Storefront/ProductDetail.jsx` | Chi tiết sản phẩm, nút "Thêm vào giỏ" |
| `frontend/src/pages/Storefront/Cart.jsx` | Giỏ hàng, thay đổi số lượng, xóa SP |
| `frontend/src/pages/Storefront/Checkout.jsx` | Trang thanh toán (nhập địa chỉ, chọn payment/shipping) |
| `frontend/src/pages/Storefront/OrderSuccess.jsx` | Màn hình thông báo đặt hàng thành công |
| `frontend/src/pages/Storefront/MyOrders.jsx` | Lịch sử đơn hàng của KH |
| `frontend/src/context/CartContext.jsx` | Quản lý state giỏ hàng |
| `frontend/src/context/ERPContext.jsx` | Xử lý logic tạo `order` mới |

### Các hàm chính:

```javascript
addToCart(product, quantity)     // Thêm SP vào giỏ
updateCartItem(productId, qty)   // Cập nhật SL trong giỏ
removeFromCart(productId)        // Xóa SP khỏi giỏ
clearCart()                      // Xóa sạch giỏ (sau khi đặt hàng thành công)
createOrder(orderData)           // Gửi API tạo đơn hàng mới trên hệ thống
cancelOrder(orderId)             // KH hủy đơn khi đang PENDING
```

---

## 8. Tác Động Kho & Kế Toán Ban Đầu

1. **Với Kho Hàng (Inventory)**:
   - Khi đơn ở trạng thái `PENDING` hoặc `CONFIRMED`, hệ thống tạm thời **giữ chỗ (reserve)** số lượng sản phẩm trong kho.
   - Tránh tình trạng khách khác đặt mua trùng sản phẩm sắp hết hàng.

2. **Với Kế Toán**:
   - Nếu KH thanh toán online/chuyển khoản thành công, hệ thống ghi nhận khoản tiền gửi tới trong Sổ Cái (Ledger).
