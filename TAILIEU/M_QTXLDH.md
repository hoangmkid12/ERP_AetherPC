# Mô Đun Quy Trình Xử Lý Đơn Hàng (M_QTXLDH)

> **Hệ thống ERP Bán Linh Kiện Máy Tính — KLTN**  
> Cập nhật lần cuối: 31/07/2026

---

## 1. Tổng Quan

Mô-đun quản lý toàn bộ **vòng đời của một đơn hàng (Order Lifecycle)**, tính từ lúc khách hàng vừa đặt hàng thành công trên Storefront (trạng thái `PENDING`) cho đến khi khách hàng nhận được hàng và hoàn tất đơn (trạng thái `COMPLETED`).
Quy trình này đòi hỏi sự phối hợp của các bộ phận: **Sale (Bán hàng)**, **Kho (Warehouse)**, **Kế toán (Accountant)** và **Giao hàng (Delivery)**.

---

## 2. Sơ Đồ Luồng Xử Lý (Order Flow)

```text
Khách hàng đặt hàng (Storefront)
         │
         ▼
    Đơn: PENDING (Chờ xử lý)
         │
         ├─► [Kế toán kiểm tra thanh toán - nếu chọn Chuyển Khoản]
         │
         ▼
    Bộ Phận Sale (Bán hàng)
         ├─► Gọi điện thoại xác nhận với khách
         ├─► Kiểm tra thông tin nhận hàng
         │
         ├─► KHÔNG HỢP LỆ / KH HỦY ──► Đơn: CANCELLED (Đã hủy)
         │
         └─► HỢP LỆ (Duyệt)
                 │
                 ▼
          Đơn: CONFIRMED (Đã xác nhận)
                 │
                 ▼
    Bộ Phận Kho (Warehouse)
         ├─► In phiếu xuất kho (Packing Slip)
         ├─► Nhặt hàng (Picking) & Đóng gói (Packing)
         ├─► Gắn mã vận đơn
         │
         ├─► Hết hàng đột xuất ──► Báo Sale xử lý / Chờ nhập hàng
         │
         └─► Sẵn sàng giao
                 │
                 ▼
         Đơn: PACKED (Đã đóng gói)
                 │
                 ▼
    Bộ Phận Giao Hàng (Delivery / Đơn vị vận chuyển)
         ├─► Bàn giao cho Shipper / Viettel Post / GHN...
         │
         ▼
         Đơn: SHIPPED (Đang giao hàng)
         │
         ├─► Giao thất bại ──► Shipper báo cáo ──► Đơn: FAILED_DELIVERY (Giao thất bại) ──► Hoàn về kho
         │
         └─► Giao thành công
                 │
                 ▼
         Đơn: DELIVERED (Đã giao)
                 │
                 ├─► [Hệ thống đếm ngược 3-7 ngày (Thời gian cho phép Đổi trả)]
                 │
                 ├─► [Khách hàng nhấn "Đã nhận hàng" trên hệ thống]
                 │
                 ▼
         Đơn: COMPLETED (Hoàn tất)
                 │
                 └─► [Kế toán đối soát, ghi nhận DOANH THU thực tế]
```

---

## 3. Trạng Thái Đơn Hàng Chi Tiết

Dưới đây là các trạng thái xuyên suốt quy trình xử lý đơn:

| Trạng thái | Mã Code | Ý nghĩa & Bộ phận phụ trách |
|---|---|---|
| **Chờ xử lý** | `PENDING` | Hệ thống vừa ghi nhận đơn. Sale chờ duyệt. |
| **Đã xác nhận** | `CONFIRMED` | Sale đã xác nhận thông tin. Kho chuẩn bị đóng gói. |
| **Đã đóng gói** | `PACKED` | Kho đã đóng gói xong, dán mã vận đơn. Chờ Shipper lấy hàng. |
| **Đang giao** | `SHIPPED` | Shipper đã lấy hàng đi giao cho khách. |
| **Đã giao hàng** | `DELIVERED` | Shipper báo đã giao thành công. Chờ khách xác nhận (hoặc hết hạn chờ). |
| **Hoàn tất** | `COMPLETED` | Khách đã xác nhận nhận hàng, không phát sinh khiếu nại đổi/trả. |
| **Đã hủy** | `CANCELLED` | Đơn bị hủy (bởi KH hoặc Sale). Kho hoàn lại tồn. |
| **Giao thất bại** | `FAILED_DELIVERY` | Giao hàng không thành công (Khách không nhận, bom hàng). |

---

## 4. Tác Động Qua Từng Giai Đoạn

### 4.1. Giai đoạn PENDING → CONFIRMED
- **Sale**: Kiểm tra tồn kho khả dụng (Available Stock). Gọi xác nhận khách hàng.
- **Kho (Inventory)**: Hệ thống tạm giữ (Reserve) số lượng hàng để tránh bán vượt quá số lượng thực tế.
- **Kế toán**: (Nếu khách chọn Chuyển khoản), Kế toán phải bấm xác nhận "Đã nhận tiền" thì Sale mới được quyền chuyển sang CONFIRMED.

### 4.2. Giai đoạn CONFIRMED → PACKED
- **Kho**: Nhân viên kho xem danh sách đơn `CONFIRMED`.
- Thực hiện trừ tồn kho vật lý (Deduct Stock).
- In hóa đơn / Phiếu xuất kho. Đóng gói kiện hàng. Chuyển trạng thái sang `PACKED`.

### 4.3. Giai đoạn PACKED → SHIPPED
- **Giao hàng**: Lấy kiện hàng từ kho. Khi kiện hàng rời khỏi kho, cập nhật thành `SHIPPED`.
- Hệ thống gửi Email / SMS cho Khách hàng báo hàng đang trên đường đi cùng với Mã vận đơn (Tracking Code).

### 4.4. Giai đoạn SHIPPED → DELIVERED
- **Giao hàng**: Nhân viên giao thành công, thu tiền COD (nếu có).
- Cập nhật trạng thái `DELIVERED`.

### 4.5. Giai đoạn DELIVERED → COMPLETED
- Khách hàng có một khoảng thời gian (ví dụ: 3 - 7 ngày) để kiểm tra hàng.
- **Hoàn tất**: Khách hàng nhấn "Đã nhận được hàng" trên Storefront, HOẶC hệ thống tự động chuyển `COMPLETED` khi hết thời gian chờ mà không có khiếu nại.
- Khi đơn `COMPLETED`, Kế toán ghi nhận Doanh Thu (Revenue) chính thức vào Sổ Cái (General Ledger), kết thúc vòng đời đơn hàng.

---

## 5. Xử Lý Các Sự Cố (Exceptions)

| Trường Hợp | Cách Xử Lý | Trạng thái cuối |
|---|---|---|
| Khách hủy đơn khi đang PENDING | Sale xác nhận hủy. Kho tự động nhả (unreserve) số lượng hàng. Nếu KH đã thanh toán, Kế toán thực hiện hoàn tiền. | `CANCELLED` |
| Hàng lỗi / Hết hàng khi đóng gói | Kho báo lại Sale. Sale liên hệ khách đổi sản phẩm hoặc hủy đơn. | `CANCELLED` |
| Giao hàng thất bại (Bom hàng) | Shipper đem hàng về lại Kho. Kho xác nhận nhận lại hàng và cộng lại vào Tồn kho vật lý. | `FAILED_DELIVERY` |

---

## 6. Các Phân Hệ Liên Quan

| Phân hệ / Component | Vai trò |
|---|---|
| `frontend/src/pages/Admin/OrderList.jsx` | Quản lý danh sách toàn bộ đơn hàng (Cho Admin/Sale/Kế toán) |
| `frontend/src/pages/Admin/OrderDetail.jsx` | Xem chi tiết đơn hàng, lịch sử thay đổi trạng thái |
| `frontend/src/pages/Admin/Warehouse.jsx` | Quản lý đóng gói (`CONFIRMED` -> `PACKED`), trừ tồn kho |
| `frontend/src/pages/Admin/Delivery.jsx` | Quản lý giao hàng (`PACKED` -> `SHIPPED` -> `DELIVERED`) |
| `frontend/src/pages/Storefront/MyOrders.jsx` | Khách theo dõi hành trình đơn hàng, nút "Đã nhận được hàng" |

```javascript
// Các API chính cho quy trình này:
updateOrderStatus(orderId, 'CONFIRMED'); 
processWarehousePacking(orderId);        // Kèm theo logic trừ tồn kho
assignToShipper(orderId, shipperId); 
updateDeliveryStatus(orderId, 'DELIVERED');
completeOrder(orderId);                  // KH xác nhận hoặc CronJob chạy tự động
```
