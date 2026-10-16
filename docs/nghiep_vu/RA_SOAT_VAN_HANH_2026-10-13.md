# Rà soát vận hành thật trên production — 13/10/2026

Ghi chú cho **phiên làm việc sau**: (1) rà soát lại các thay đổi bên dưới trên giao diện, (2) cập nhật báo cáo
`docs/bao_cao/AetherPC_KLTN.docx` (và bản `_demo`) cho khớp quy trình mới. Commit liên quan: `0c2456e` và commit
"rà soát vận hành 13/10/2026 — phần 2" ngay sau đó.

Toàn bộ thử nghiệm chạy bằng API thật trên https://www.aetherpc.site (Railway), đúng vai trò từng bộ phận
(tài khoản demo mật khẩu `123456`). Trước khi ghi đã sao lưu toàn bộ 56 bảng ra JSON tại
`backups/prod_json_2026-10-13/` (chỉ trên máy, KHÔNG commit vì có hash mật khẩu/PII).

---

## 1. Giao dịch thật đã tạo (để tra cứu / chụp màn hình báo cáo)

| Quy trình | Mã chứng từ | Kết quả |
|---|---|---|
| Mua hàng ASUS RX 6500 XT ×5 | PR-03468130 → RFQ PO-261013-2458 → PO-261013-9054 → WH/IN/261013/328 → BILL/261013/3188 | Nhập 5, giá vốn BQ 3.153.333đ, chi 15,75tr |
| Mua hàng ASUS ROG Helios ×5, QC đạt 4/5 | PR-05447773 → PO-261013-7771 → BILL/261013/4849 | Hoá đơn tự điều chỉnh 24,75tr → 19,8tr; PR tự đóng |
| Mua hàng MSI RTX 4070 SUPER ×3 | PO-261013-4637, BILL/261013/5869 | Nhập kho tự phân bổ cho 2 đơn chờ hàng ORD-260427-0362, ORD-260527-0066 |
| Bán Build PC (8 linh kiện, COD) | ORD-261013-8263 (lệnh ASM-261013-1271), ORD-261013-6165 (ASM-261013-4484) | Lắp ráp → giao → khách xác nhận → đối soát COD |
| Giao thất bại → hoàn kho | ORD-261013-3862, ORD-261013-5579 | QC đóng đơn, hoàn tồn, đảo giá vốn |
| Trả hàng hoàn tiền (lỗi NSX) | ORD-261013-7467 (RMA-261013-2669), ORD-261013-3939 (RMA-261013-8564) | Kệ gửi hãng BH, hoàn 1.068.200đ, bút toán REFUND |
| Đổi mới 1-1 | ORD-261013-5037 → ORD-EXC-261013-5037 | Đơn thay thế trừ kho thật, giao thành công |
| POS tiền mặt (khách có SĐT) | ORD-261013-1706, ORD-261013-1397 | Tạo hồ sơ khách CUS-POS-0938123456 (Trần Quốc Bảo) |
| POS chuyển khoản QR (khách lẻ) | ORD-261013-1370, ORD-261013-1301 | Hoàn tất ngay, có phiếu thu + bút toán thu |
| Rà phân bổ đơn chờ hàng | nút mới ở Bán hàng → Quản lý đơn | 56/59 đơn cũ đã đủ tồn được duyệt & xuất kho; 3 đơn còn thiếu hàng thật |
| Lương kỳ 06, 07, 08, 09/2026 | HR tính → trình → CEO duyệt → Kế toán chi | Mỗi kỳ ~24 phiếu; BH NLĐ 17,8tr + BH DN 36,4tr + TNCN ~0,5tr/kỳ ghi bút toán PAYROLL-INS-* |

Đối chiếu sau khi chạy: mọi đơn đã xuất kho có (OUT − IN) = số lượng = số serial USED; giá vốn từng dòng =
bút toán COGS; đơn huỷ không còn tồn/serial/giá vốn treo; `products.stock_quantity` = tổng `inventory` (0 lệch).

## 2. Thay đổi quy trình & quy tắc nghiệp vụ (cần đưa vào báo cáo)

### 2.1 Bán hàng / đơn hàng (mục 3.2 BPMN, 3.5 sơ đồ hoạt động, sơ đồ trạng thái đơn)
- **POS** hoàn tất ngay khi thu tiền (`COMPLETED`), ghi `OrderPayment` + bút toán `INCOME` (`POS-<mã đơn>`),
  phương thức đúng (Tiền mặt / Chuyển khoản / Thẻ). Có SĐT thì gắn/tạo hồ sơ khách và tích điểm. POS không bán
  vượt tồn. Trước đây: mọi đơn POS là "COD", nằm ở CONFIRMED chờ giao như đơn online, không có chứng từ thu.
- **Mã đơn** luôn do máy chủ sinh.
- **Máy trạng thái** (order.controller.js `ORDER_TRANSITIONS`):
  - `SHIPPING_FAILED`/`FAILED_DELIVERY` → chỉ `SHIPPED` (giao lại) hoặc `RETURNING_TO_WAREHOUSE`; không huỷ thẳng.
  - `RETURNING_TO_WAREHOUSE` → `CANCELLED` chỉ do **QC/Kho** (đã kiểm kiện). Kiện hư hỏng do vận chuyển
    (`restockCondition = DAMAGED_CARRIER`) không nhập tồn bán, serial `DEFECTIVE`, giữ giá vốn như tổn thất.
  - `DELIVERED` → chỉ `COMPLETED`; trả hàng phải qua luồng đổi trả.
  - Hoàn kho chỉ xảy ra khi đơn bị huỷ (trước đây "giao thất bại" hoàn kho ngay dù kiện còn trên xe → tồn cộng khống).
- Khách **không** tự xác nhận "đã nhận" đơn COD khi shipper chưa xác nhận giao & thu tiền.
- Đổi trả chỉ cho đơn đã giao (`DELIVERED`/`COMPLETED`).
- **Giá mua kèm** được máy chủ áp đúng (trước đây máy chủ luôn tính giá gốc do bảng slug danh mục sai).
- Nút **"Phân bổ hàng cho đơn chờ hàng"** (QL Bán hàng/QL Kho/CEO) + tự phân bổ (FIFO) mỗi khi Kho nhập GRN.

### 2.2 Lắp ráp (UC lắp ráp, Hình 5.15 có thể chụp lại vì đã có lệnh lắp ráp thật)
- Đơn Build PC (giỏ từ công cụ Build PC, ≥2 linh kiện) **tự sinh lệnh lắp ráp**, linh kiện lấy từ dòng hàng của đơn.
- Chỉ bắt đầu lắp khi đơn đã xác nhận & xuất kho; bắt đầu → đơn `PROCESSING`; nghiệm thu → `READY_TO_SHIP`.
- Serial gán tự động từ **serial thật đã xuất kho cho đơn**; nghiệm thu từ chối serial không thuộc đơn.
- Kho không thể chuyển `READY_TO_SHIP/SHIPPED` khi lệnh lắp ráp chưa nghiệm thu.
- Lệnh gắn đơn chỉ huỷ được, không xoá; lệnh đã nghiệm thu không sửa/xoá.

### 2.3 Đổi trả – hoàn tiền (UC CSKH/QC/Kho/Kế toán)
Chuỗi trạng thái phiếu: `PENDING → RETURN_APPROVED → RETURNING_TO_WAREHOUSE → DELIVERED_TO_WAREHOUSE → QC_PASSED/REJECTED
→ (RESTOCKING) → RESTOCKED | VENDOR_WARRANTY | INSPECTED_SCRAP | EXCHANGED → REFUNDED`. Mỗi bước có chặn trạng thái.
- Kho nhập kệ: claim có điều kiện (không cộng tồn 2 lần); kệ bán A1/B3 → cộng tồn, serial về AVAILABLE, **đảo COGS**;
  kệ hãng/phế phẩm → không cộng tồn, serial WARRANTY/DEFECTIVE, giữ COGS.
- Đổi mới 1-1: đơn `ORD-EXC-*` 0đ **trừ kho thật** + COGS của hàng thay thế.
- Kế toán chỉ hoàn tiền **sau** khi Kho phân luồng kiện; hoàn tiền trong 1 transaction, thu hồi điểm thành viên.
- Màn QC không còn liệt kê đơn RMA trong danh sách "giao thất bại hoàn kho" (tránh huỷ nhầm → hoàn kho/hoàn tiền 2 lần).

### 2.4 Mua hàng – kho
- RFQ/PO mang thẻ `[PR:mã]`; Kho xác nhận GRN → **đề xuất mua tự đóng** (`COMPLETED`, nhãn "Đã nhập kho").
- Ghi chú báo giá của NCC không còn bị lưu vào "lý do huỷ".
- Mọi xuất/hoàn kho đi qua `backend/src/services/orderFulfillment.js` (tồn sản phẩm, serial, tồn từng kho, COGS).

### 2.5 Kế toán (mục báo cáo tài chính, Báo cáo KQKD)
- **Doanh thu ghi nhận khi hàng đã xuất kho** (`frontend/src/utils/revenue.js`): loại PENDING / WAITING_PAYMENT /
  AWAITING_STOCK / CANCELLED — cùng thời điểm ghi giá vốn.
- Báo cáo KQKD: 1. Doanh thu → 2. Giảm trừ (**hàng bán bị trả lại** + VAT đầu ra) → 3. DT thuần → 4. Giá vốn →
  5. LN gộp → 6. Chi phí nhân sự → 7. Chi phí vận hành → 8. LN trước thuế. Hoàn tiền không còn là "chi phí".
- **Chi phí nhân sự** = thực lĩnh + BH phần NLĐ + thuế TNCN khấu trừ + BH phần DN (21,5%). Giải ngân lương ghi 2 bút
  toán: `PAYROLL-<id>` (thực lĩnh) và `PAYROLL-INS-<id>` (nộp BH & thuế).
- Biểu đồ chi phí theo tháng không còn cộng trùng tiền trả NCC với giá vốn.
- **Khoá bút toán hệ thống** (COGS-, VENDORBILL-, COD-SETTLE-, SEPAY-, POS-, PAYROLL-, RF-, REFUND): không sửa/xoá
  qua API; sai thì lập bút toán điều chỉnh. Bút toán thủ công không được dùng các tiền tố này.
- Hoa hồng Sales không tính đơn chưa xuất kho / đã hoàn tiền.
- Dashboard: bảng xếp hạng doanh số lấy số thật theo nhân viên đứng quầy (trước là 3 dòng bịa).

### 2.6 QC
- Vai trò QC được xem đơn hàng và đóng kiện hoàn kho (trước bị 403).
- Nhật ký & biên bản QC dựng từ dữ liệu thật trên máy chủ (QcInspection, phiếu đổi trả đã thẩm định, đơn QC đóng),
  bỏ localStorage và các biên bản/phiếu RMA mẫu bịa.

## 2.7 Kiểm thử giao diện (Chrome, 13/10/2026 tối)

Chạy frontend + backend ở localhost (nối cùng DB production; không nhập mật khẩu lên trang production) bằng tài khoản CEO.
Đạt: Kế toán (KQKD mới: DT 19,75 tỷ, hàng trả lại 6,16tr, giá vốn 15,65 tỷ, biên gộp 12,8%, chi phí nhân sự 1,878 tỷ,
LN trước thuế 418,6tr), Lắp ráp (serial thật của đơn), Quản lý đơn (bộ lọc + nút phân bổ), Dashboard KPI (bảng xếp
hạng thật), QC (nhật ký thật; thẩm định kiện hoàn ORD-311404 qua giao diện → đơn đóng, OUT 1 / IN 1), Mua hàng (nhãn
"Đã nhập kho"), Kho (hàng chờ giao). Lỗi tìm thấy & đã sửa (commit phần 3):
- Ngày đặt hàng hiển thị sai (22/10 thay vì 13/10): chuỗi "HH:mm DD/MM/YYYY" bị tách theo "/" → lấy giờ làm ngày;
  bộ lọc kỳ (`PeriodFilterBar`) còn loại đơn trong ngày khỏi mọi thống kê. Sửa parser ở Bán hàng/Mua hàng/Kho và 2 bộ lọc.
- Đơn POS hiện kênh "Online Web" (nhận diện theo tiền tố mã POS- cũ) → nhận diện theo `soldById`.
- Dashboard: kỹ thuật viên hiện email → hiện họ tên.
- Nhật ký QC: mã quyết định cũ (APPROVE_REFUND…) hiện nhầm "TỪ CHỐI"; mã biên bản lặp "RMA-QA-RMA-".
Ghi nhận thêm — đã sửa ở commit phần 4 (16/10/2026):
- Báo cáo KQKD hiện "0đ" khi đang tải danh sách đơn → có trạng thái "Đang tải dữ liệu đơn hàng".
- Lệnh lắp ráp đã giao vẫn mang nhãn "Đã Hoàn Tất - Chờ Xuất Kho" → nhãn theo trạng thái thật của đơn
  ("Đã Nghiệm Thu - Chờ Xuất Kho / Đang Giao / Đã Giao Khách / Đơn Hoàn/Hủy").
- QC đổi trả: bỏ serial bịa "SN-RMA-xxxxxx", đối soát với serial thật đã xuất kho cho đơn (đơn nhiều linh kiện khớp
  một trong các serial); nhãn trạng thái phiếu theo bước thật (Chờ hàng về kho / QC đạt — chờ Kho nhập / Đã nhập lại
  kho / Đã đổi mới 1-1 / Đã hoàn tiền); nhật ký QC có thêm bộ lọc "Hoàn Kho"; bảng gọn một dòng, tên NCC rút gọn.
- Bộ lọc ngày dùng chung: "7 ngày" → "Tuần này" (Thứ Hai → Chủ Nhật).

## 3. Việc CÒN LẠI cho phiên sau

1. **Chạy script đối chiếu dữ liệu** (bị chặn quyền ghi trực tiếp DB trong phiên này):
   `cd backend && node scripts/reconcile-2026-10-13.js` (xem trước) rồi `--apply`. Gồm: đóng PR-03468130; trừ 106 điểm
   đơn hoàn tiền ORD-261013-7467; xoá bút toán chi NCC 47,5tr mồ côi (BILL/260910/3034, PO-2026-0005 không tồn tại);
   tạo ~77.500 serial tồn đầu kỳ `OB-<productId>-NNNN` cho 1.271 sản phẩm tồn chưa có serial; bổ sung khoản thu COD
   cho 4 đơn cũ hoàn tất thiếu chứng từ (ORD-551729, ORD-413208, ORD-603601, ORD-599756 — chờ Kế toán đối soát);
   chuẩn hoá giảm giá/phí ship 11 đơn cũ lệch tổng tiền (giữ nguyên số tiền khách trả; đơn nào không khớp thì bỏ qua).
2. **Rà giao diện** (tiện ích Chrome không kết nối trong phiên này): Bán hàng (POS, bộ lọc trạng thái mới, nút phân bổ),
   Lắp ráp (chọn serial của đơn), QC (tab đổi trả/hoàn kho, nhật ký), Kế toán (KQKD mới), Dashboard (bảng xếp hạng),
   Mua hàng (nhãn PR "Đã nhập kho").
3. Chưa kiểm thử: đơn online chuyển khoản qua webhook SePay thật; 3 đơn chờ hàng còn thiếu hàng thật (cần lập PR).
4. 3 PR cũ (PR-21592032, PR-51824496, PR-89153800) ở "Đã lập RFQ" từ trước khi có thẻ [PR:] — cần Mua hàng đóng/huỷ tay.
5. 2 sản phẩm có số serial khả dụng > tồn (script mục 4 sẽ in ra) — cần Kho kiểm kê.

## 4. Gợi ý cập nhật báo cáo KLTN

- **3.2 / 3.5**: sửa BPMN + sơ đồ hoạt động các UC Bán tại quầy, Giao hàng (nhánh thất bại → hoàn kho → QC đóng đơn),
  Lắp ráp (tự sinh lệnh, chặn bắt đầu khi chưa xuất kho), Đổi trả/hoàn tiền (thứ tự Kho phân luồng trước Kế toán hoàn
  tiền), Nhập kho (tự phân bổ đơn chờ hàng, đóng PR). Nguồn: `docs/diagrams/uml_seq/flows.py` + `specs.py`.
- **Sơ đồ trạng thái đơn hàng / phiếu đổi trả**: theo mục 2.1 và 2.3 ở trên.
- **Chương 4 (quy tắc nghiệp vụ, thiết kế xử lý)**: thêm service `orderFulfillment` (xuất/hoàn kho idempotent theo
  OUT−IN), `receiptFollowUp`, quy tắc ghi nhận doanh thu, khoá bút toán hệ thống, chi phí lương đầy đủ.
- **Chương 5**: chụp lại Hình 5.15 (Lắp ráp — đã có lệnh thật ASM-261013-1271/4484), màn Kế toán KQKD, POS hoá đơn,
  Dashboard bảng xếp hạng. Script chụp: `docs/screenshots/shoot.js` (chạy API không kèm scheduler).
- **Chương 6**: bổ sung test case theo các bước PASS ở mục 1 (đặc biệt các ca bị chặn đúng: lắp ráp trước khi xuất kho,
  xuất kho trước khi nghiệm thu, serial lạ, huỷ đơn khi kiện còn trên xe, Sales đóng kiện hoàn, khách tự xác nhận COD,
  QC thẩm định trước khi kiện về, hoàn tiền trước khi Kho phân luồng, nhập kệ 2 lần, chiết khấu POS >10%,
  sửa/xoá bút toán hệ thống). Script kiểm thử đã dùng: o2c / flows2 / exchange / p2p / payroll (cùng mẫu với mục 1).

## 5. Đã cập nhật báo cáo (16/10/2026)

Cả `AetherPC_KLTN.docx` (349 trang) và `_demo` (260 trang) đã sửa theo mục 2 + 4, PDF xuất lại:
- Sơ đồ BPMN, hoạt động, tuần tự của 7 UC: Bán tại quầy, Xử lý đơn, Thẩm định hoàn trả, Nhập kho, Xuất kho
  (thêm cổng "Lắp ráp đã nghiệm thu?"), Lắp ráp (cổng "Đơn đã xuất kho?", Serial của đơn), Giao hàng (thất bại
  không hoàn kho). Nguồn `docs/diagrams/uml_seq/flows.py` + `specs.py`.
- Lời văn 3.2 + bảng đặc tả 3.5 của các UC trên; Bảng 3.1/3.3; Bảng 3.21 thêm QT16–QT19.
- Chương 4: Bảng 4.3 (chuyển trạng thái đơn bán), mục mới 4.3.6 + Bảng 4.4 (đổi trả, ghi nhận doanh thu, khoá bút toán),
  chi phí lương 2 bút toán, dịch vụ xuất/hoàn kho dùng chung.
- Chương 5: lời văn POS/đơn hàng/QC/lắp ráp/xuất kho; chụp lại Hình 5.28 (thẩm định đổi trả) và 5.30 (lắp ráp).
- Chương 6: +20 test case lấy từ lần chạy 13/10 (tổng 138/138), Bảng 6.21 thêm 10 lỗi, đoạn mô tả đợt chạy thật.
- Hình 3.1–3.4 đã sửa nhãn (draw.io bản Store: `C:/Program Files/WindowsApps/draw.io.draw.ioDiagrams_*/app/draw.io.exe
  -x -f png -s 2 -o out.png in.drawio`; Hình 3.4 sinh bằng `quy_trinh_tinh_luong.py`), Bảng 3.2/3.4 sửa dòng tương ứng.
- Script đối chiếu `--apply` chạy 16/10/2026 (sao lưu trước: `backups/before_reconcile_2026-10-16.json`, chỉ trên máy):
  bước 1 đóng PR-03468130, bước 2 trừ 106 điểm customer_demo (3041 → 2935), bước 3 xoá bút toán mồ côi 47,5tr — XONG;
  bước 4–6 hoàn tất bằng `scripts/reconcile-2026-10-13-resume.js` (người dùng tự chạy): đủ 77.340 serial OB-, 0 sản phẩm thiếu
  serial; bổ sung khoản thu COD cho ORD-551729, ORD-603601, ORD-413208, ORD-599756 (chờ Kế toán đối soát); chuẩn hoá 7/11 đơn.
  KHÔNG chạy lại script gốc với --apply (bước 2 sẽ trừ điểm lần hai).
- Phương án cho 2 việc còn mở (script `backend/scripts/fix-open-items-2026-10-16.js`, chạy thử rồi `--apply`, chạy lặp an toàn):
  (A) 4 đơn: khách trả và được hoàn đúng tổng tiền = tạm tính + 30.000đ ship → giảm giá chưa từng được áp, ghi lại giảm giá 0đ,
  giữ nguyên số tiền; (B1) serial SN-1050103254-00001 gắn cho ORD-413208 (đơn cũ xuất 1 chiếc khi chưa bắt buộc serial);
  (B2) ORD-834751 bị ghi xuất kho lặp 3 lần cho 1 chiếc → hoàn 2 vào tồn + kho 1, serial SN-1047243498-00001 của ORD-576569
  (đã nhập lại kệ A1) về "Sẵn có". Sau khi chạy: Logitech 40/40/40, HDD Seagate 18/18/18 (tồn/tồn kho/serial).
- Chi tiết trước khi có phương án: 4 đơn ORD-143082, ORD-278680, ORD-576569, ORD-205210 có tổng tiền = tạm tính + 30.000đ ship,
  tức giảm giá (500–700 nghìn) được ghi nhưng không trừ vào số tiền khách trả — phải xác định khách đã trả bao nhiêu rồi mới
  sửa tay; 2 sản phẩm có serial khả dụng nhiều hơn tồn 1 chiếc (Logitech G Pro X TKL 1050103254: 41/40, HDD Seagate
  Barracuda 2TB 1047243498: 17/16) — Kho kiểm kê.

