# Mô Đun Đổi Hàng / Hoàn Tiền (M_ĐHBT)

> **Hệ thống ERP Bán Linh Kiện Máy Tính — KLTN**  
> Cập nhật lần cuối: 29/07/2026

---

## 1. Tổng Quan

Mô-đun xử lý toàn bộ quy trình **yêu cầu trả hàng, đổi hàng và hoàn tiền** từ khách hàng sau khi nhận sản phẩm. Quy trình được phối hợp qua nhiều bộ phận: Khách hàng → CSKH → Giao hàng/Bưu điện → Kho → Kế toán.

---

## 2. Điều Kiện Để Tạo Yêu Cầu Trả / Đổi

Khách hàng **chỉ được tạo yêu cầu** khi đơn hàng ở trạng thái:
- `DELIVERED` — Đã giao hàng
- `COMPLETED` — Đã hoàn tất (xác nhận đã nhận)

**Không được** tạo yêu cầu khi đơn đang ở trạng thái PENDING, SHIPPED, CANCELLED, v.v.

---

## 3. Loại Yêu Cầu

| Loại | Mã | Mô tả |
|---|---|---|
| Hoàn tiền | `REFUND` | Khách muốn lấy lại tiền, trả sản phẩm về kho |
| Đổi hàng | `EXCHANGE` | Khách muốn đổi sản phẩm khác (cùng/khác giá) |

---

## 4. Quy Trình Đầy Đủ

### 4.1 Sơ Đồ Luồng

```
Khách Hàng
    │
    ▼
[Gửi yêu cầu trả/đổi] ──► Chọn: REFUND hoặc EXCHANGE
    │                       Chọn lý do + tải ảnh minh chứng
    │                       Chọn phương thức gửi hàng về:
    │                         (A) Shipper đến lấy
    │                         (B) Tự gửi qua Bưu điện
    │
    ▼
CSKH (Chăm Sóc Khách Hàng)
    │
    ├─► [Xem xét yêu cầu]
    │       - Kiểm tra lý do, ảnh minh chứng
    │       - Đối chiếu điều kiện bảo hành/đổi trả
    │
    ├─► [Từ chối] ──► Đơn về DELIVERED, thông báo khách
    │
    └─► [Duyệt]
            │
            ▼
        ┌─────────────────────────────────────┐
        │ Phương thức hoàn hàng?              │
        ├─────────────────┬───────────────────┤
        │ (A) Shipper lấy │ (B) Bưu điện      │
        │                 │                   │
        ▼                 │                   ▼
    Bộ Phận Giao Hàng     │        Khách tự gửi
        │                 │        (Kho chờ nhận)
        │ Shipper đến lấy │
        │ + kiểm tra hàng │
        │ + xác nhận      │
        │                 │
        ▼                 ▼
        Đơn: RETURNING_TO_WAREHOUSE    Đơn: RETURNING
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                            Kho Hàng
                                │
                                ├─► [Kiểm tra kiện hàng nhận được]
                                │
                                └─► [Xác nhận Nhập Kho]
                                        │
                                        ▼
                                  Đơn: RETURNED
                                  YC Trả: RETURNED
                                        │
                                        ▼
                                    Kế Toán
                                        │
                                        ├─► Xem danh sách chờ hoàn tiền
                                        │
                                        ├─► Chọn phương thức hoàn tiền:
                                        │     - Chuyển khoản ngân hàng (COD/B2B)
                                        │     - Tiền mặt tại quầy (POS)
                                        │     - Hoàn qua cổng TT (Online)
                                        │     - (Đổi hàng: gửi hàng thay thế)
                                        │
                                        └─► [Xác nhận Hoàn Tiền]
                                                │
                                                ▼
                                          Đơn: REFUNDED
                                          YC Trả: REFUNDED
                                          Sổ cái: Ghi CHI - Hoàn tiền KH
```

---

## 5. Trạng Thái Đơn Hàng Trong Quy Trình Hoàn Trả

| Trạng thái | Mã | Mô tả | Phụ trách |
|---|---|---|---|
| Yêu cầu trả | `RETURN_REQUESTED` | KH đã gửi yêu cầu, chờ CSKH xử lý | CSKH |
| Chờ lấy hàng | `RETURNING` | CSKH đã duyệt, chờ shipper lấy hoặc KH gửi bưu điện | Giao hàng / KH |
| Đang về kho | `RETURNING_TO_WAREHOUSE` | Shipper đã lấy hàng, đang vận chuyển về kho | Kho |
| Kho đã nhận | `RETURNED` | Kho xác nhận đã nhận hàng hoàn, chờ kế toán | Kế Toán |
| Đã hoàn tiền | `REFUNDED` | Kế toán đã xử lý hoàn tiền, hoàn tất | — |

---

## 6. Trạng Thái Yêu Cầu Trả Hàng (Return Request)

| Trạng thái | Mã | Mô tả |
|---|---|---|
| Chờ xử lý | `PENDING` | Vừa được KH tạo |
| Đang xử lý | `PROCESSING` | CSKH đang xem xét |
| Đã duyệt | `APPROVED` | CSKH duyệt, đang thu hồi hàng |
| Từ chối | `REJECTED` | CSKH từ chối, đơn trả về DELIVERED |
| Kho đã nhận | `RETURNED` | Kho xác nhận, chờ kế toán hoàn tiền |
| Đã hoàn tiền | `REFUNDED` | Kế toán đã xử lý xong |

---

## 7. Phương Thức Hoàn Tiền (Kế Toán)

| Trường hợp | Phương thức | Ghi chú |
|---|---|---|
| Thanh toán COD (tiền mặt khi nhận) | Chuyển khoản ngân hàng | Kế toán chuyển vào TK KH cung cấp |
| Thanh toán Online (VNPay, Momo, Thẻ) | Hoàn qua cổng thanh toán | Tự động hoặc thủ công qua cổng |
| Mua tại cửa hàng POS | Tiền mặt tại quầy | Hoàn trực tiếp khi KH đến cửa hàng |
| Doanh nghiệp B2B (chuyển khoản) | Chuyển khoản ngân hàng | Kế toán chuyển về TK doanh nghiệp |
| Đổi hàng (EXCHANGE) | Gửi hàng thay thế | Không hoàn tiền, gửi sản phẩm mới |

---

## 8. Tác Động Kế Toán

Khi kế toán xác nhận hoàn tiền, hệ thống tự động:
1. Cập nhật trạng thái `returnRequest` → `REFUNDED`
2. Cập nhật trạng thái `order` → `REFUNDED`
3. Ghi vào **Sổ Cái (General Ledger)**:
   - **Loại giao dịch**: `EXPENSE` (Chi phí)
   - **Nội dung**: `Hoàn tiền KH [Tên KH] - Đơn [Mã đơn] ([Phương thức])`
   - **Số tiền**: Bằng `totalAmount` của đơn hàng gốc

---

## 9. Phân Quyền Theo Bộ Phận

| Bộ Phận | Role | Quyền trong quy trình |
|---|---|---|
| Khách Hàng | `CUSTOMER` | Tạo yêu cầu, xem trạng thái |
| CSKH | `CSKH` | Duyệt / Từ chối yêu cầu, xem tất cả đơn hoàn |
| Giao Hàng | `DELIVERY` | Xác nhận lấy hàng + kiểm tra hàng của KH (nếu chọn shipper) |
| Kho | `WAREHOUSE` / `WAREHOUSE_MANAGER` | Xác nhận nhập kho hàng hoàn |
| Kế Toán | `ACCOUNTANT` | Xử lý hoàn tiền, ghi sổ cái |
| CEO / Admin | `CEO`, `ADMIN` | Xem toàn bộ, không thao tác trực tiếp |

---

## 10. Các File Liên Quan Trong Hệ Thống

| File | Vai trò |
|---|---|
| `frontend/src/pages/Storefront/MyOrders.jsx` | KH xem đơn + gửi yêu cầu trả |
| `frontend/src/pages/Admin/CustomerService.jsx` | CSKH xem + duyệt yêu cầu |
| `frontend/src/pages/Admin/Delivery.jsx` | Shipper xác nhận lấy hàng hoàn |
| `frontend/src/pages/Admin/Warehouse.jsx` | Kho xác nhận nhận hàng (tab Nhận Hàng Hoàn) |
| `frontend/src/pages/Admin/Accountant.jsx` | Kế toán xử lý hoàn tiền (tab Hoàn Tiền Khách Hàng) |
| `frontend/src/context/ERPContext.jsx` | Quản lý state: `returnRequests`, `orders`, `ledger` |

### Các hàm chính trong ERPContext:

```javascript
addReturnRequest(data)           // KH tạo yêu cầu → order: RETURN_REQUESTED
approveReturn(id, resolution)    // CSKH duyệt → order: RETURNING
rejectReturn(id, resolution)     // CSKH từ chối → order: DELIVERED
updateReturnStatus(id, status)   // Cập nhật trạng thái YC trả
updateOrderStatus(orderId, status) // Cập nhật trạng thái đơn hàng
processRefund(returnReqId, paymentMethod, note) // Kế toán hoàn tiền → REFUNDED + ghi ledger
```

---

## 11. Lưu Ý Nghiệp Vụ

1. **Trường hợp Đổi Hàng (EXCHANGE)**:
   - Nếu hàng đổi **cùng giá**: không phát sinh hoàn tiền
   - Nếu hàng đổi **rẻ hơn**: hoàn phần chênh lệch cho KH
   - Nếu hàng đổi **đắt hơn**: KH thanh toán thêm
   - Kế toán ghi nhận "Xác nhận gửi hàng đổi" thay vì "Hoàn tiền"

2. **Shipper kiểm tra hàng**: Khi shipper đến lấy hàng của KH, phải **kiểm tra sơ bộ sản phẩm** trước khi xác nhận lấy để tránh tranh chấp sau.

3. **Ghi sổ cái**: Khoản hoàn tiền được ghi là **CHI (EXPENSE)** vì đây là tiền công ty chi ra cho khách, ảnh hưởng trực tiếp đến lợi nhuận ròng.

4. **Không thể hủy sau khi REFUNDED**: Sau khi kế toán xác nhận hoàn tiền, trạng thái không thể quay lại.
