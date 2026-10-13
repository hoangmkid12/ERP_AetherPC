# Kiểm thử E2E nghiệp vụ (chạy bằng API thật, đúng vai trò)

Mặc định gọi `http://localhost:5000/api/v1`. Muốn chạy trên production phải đặt rõ
`BASE=https://www.aetherpc.site/api/v1` — **mọi script đều tạo dữ liệu thật** (đơn, PO, phiếu lương...).

| Script | Quy trình |
|---|---|
| `p2p.js <productId> <qty> <đơn giá> [PASS\|PARTIAL:<số đạt>]` (env `SUPC=<mã NCC>`) | Đề xuất → RFQ → báo giá → PO → CEO duyệt → QC → nhập kho serial → hoá đơn → thanh toán |
| `o2c.js` | Build PC COD → duyệt → lắp ráp → xuất kho → giao → khách xác nhận → đối soát COD |
| `flows2.js [all\|failed\|rma\|pos\|ledger\|bundle]` | Giao thất bại, trả hàng hoàn tiền, POS, khoá bút toán, giá mua kèm |
| `exchange.js` | Đổi mới 1-1 |
| `payroll.js` | Kỳ lương: HR tính → trình → CEO duyệt → Kế toán chi (sửa danh sách kỳ trong file) |

Kết quả lần chạy 13/10/2026: xem `docs/nghiep_vu/RA_SOAT_VAN_HANH_2026-10-13.md`.
