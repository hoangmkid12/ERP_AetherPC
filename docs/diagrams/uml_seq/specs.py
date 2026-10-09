# -*- coding: utf-8 -*-
"""Đặc tả 24 sơ đồ tuần tự của mục 3.5 (mỗi tác nhân 1–2 use case tiêu biểu).

Chạy:  python docs/diagrams/uml_seq/specs.py   → sinh ucNN_seq.png cùng thư mục.
Tên hàm điều khiển bám theo mã nguồn backend (auth.controller, order.controller,
payment.controller, purchase.controller, warehouse.controller, ...).
"""
import os
from seqdiag import render

A, B, C, E, X = 'actor', 'boundary', 'control', 'entity', 'external'


def m(a, b, t): return ('msg', a, b, t)
def r(a, b, t): return ('ret', a, b, t)
def s(a, t): return ('self', a, t)
def alt(*branches): return ('alt', list(branches))
def opt(g, *st): return ('opt', g, list(st))
def loop(g, *st): return ('loop', g, list(st))


D = {}

# ============ 01. Đăng ký tài khoản (Khách vãng lai) ============
KV, GD, CT, KH, EM = 'KHÁCH VÃNG LAI', 'GD_DANGKY', 'CTRL_AUTH', 'ENTITY_CUSTOMER', 'HỆ THỐNG EMAIL'
D['uc01'] = ([(A, KV), (B, GD), (C, CT), (E, KH), (X, EM)], [
    m(KV, GD, '1: Chọn "Đăng ký"'),
    s(GD, '1.1: hienThiFormDangKy()'),
    m(KV, GD, '2: Nhập họ tên, email, tên đăng nhập, SĐT, mật khẩu và bấm "Đăng ký"'),
    s(GD, '2.1: kiemTraTruongBatBuoc()'),
    m(GD, CT, '2.2: registerCustomer(hoTen, email, username, sdt, matKhau, diaChi)'),
    s(CT, '2.2.1: kiemTraDinhDangUsername()'),
    m(CT, KH, '2.2.2: findFirst(email | username | sdt)'),
    r(KH, CT, '2.2.3: return khachHangTrung'),
    alt(('[ĐÃ ĐƯỢC SỬ DỤNG]', [
        r(CT, GD, '2.2.4: return loi("… đã được sử dụng bởi tài khoản khác")'),
        s(GD, '2.3: Hiển thị lỗi, giữ dữ liệu đã nhập'),
    ]), ('[HỢP LỆ]', [
        s(CT, '2.2.5: bcrypt.hash(matKhau)'),
        m(CT, KH, '2.2.6: create(khachHang, hang = Đồng, diem = 0)'),
        r(KH, CT, '2.2.7: return khachHangMoi'),
        m(CT, EM, '2.2.8: sendWelcomeEmail(email, hoTen)'),
        s(CT, '2.2.9: taoPhien(JWT, cookie authToken)'),
        r(CT, GD, '2.2.10: return khachHangMoi'),
        s(GD, '2.4: Chuyển về trang chủ (đã đăng nhập)'),
    ])),
])

# ============ 02. Tự cấu hình máy tính (Khách vãng lai) ============
GD, CT, AI, SP, GH = 'GD_TUCAUHINH', 'CTRL_PCBUILDER', 'CTRL_TROLY_AI', 'ENTITY_PRODUCT', 'GD_GIOHANG'
D['uc02'] = ([(A, KV), (B, GD), (C, CT), (C, AI), (E, SP), (B, GH)], [
    m(KV, GD, '1: Chọn "Tự cấu hình máy tính"'),
    m(GD, CT, '1.1: taiDanhSachLinhKien()'),
    m(CT, SP, '1.1.1: getProducts()'),
    r(SP, CT, '1.1.2: return dsLinhKien'),
    r(CT, GD, '1.2: return dsLinhKien'),
    s(GD, '1.3: Hiển thị 8 khe: CPU, Mainboard, RAM, VGA, PSU, Case, Tản nhiệt, Ổ cứng'),
    opt('[DÙNG TRỢ LÝ AI]',
        m(KV, GD, '2: Nhập nhu cầu bằng văn bản'),
        m(GD, AI, '2.1: parseCustomerPrompt(yeuCau)'),
        s(AI, '2.1.1: runAIOptimizer(nganSach, mucDich)'),
        r(AI, GD, '2.2: return cauHinhGoiY'),
        s(GD, '2.3: Tự điền linh kiện vào từng khe'),
        ),
    m(KV, GD, '3: Chọn linh kiện cho một khe'),
    m(GD, CT, '3.1: kiemTraTuongThich(cauHinh)'),
    s(CT, '3.1.1: So socket CPU–Mainboard, chuẩn RAM, công suất PSU, kích thước bo mạch–vỏ, socket tản nhiệt'),
    r(CT, GD, '3.2: return ketQua, tongGia'),
    alt(('[KHÔNG TƯƠNG THÍCH]', [
        s(GD, '3.3: Hiển thị cảnh báo tương thích (không chặn)'),
    ]), ('[TƯƠNG THÍCH]', [
        s(GD, '3.4: Cập nhật tổng giá cấu hình'),
    ])),
    m(KV, GD, '4: Bấm "Thêm cấu hình vào giỏ hàng"'),
    m(GD, GH, '4.1: themGoiCauHinh(dsLinhKien)'),
    r(GH, GD, '4.2: return gioHang'),
    s(GD, '4.3: Thông báo thêm vào giỏ thành công'),
])

# ============ 03. Đặt hàng (Khách hàng) ============
KHG, GD, CT, SP, OD, EM = 'KHÁCH HÀNG', 'GD_THANHTOAN', 'CTRL_ORDER', 'ENTITY_PRODUCT', 'ENTITY_ORDER', 'HỆ THỐNG EMAIL'
D['uc03'] = ([(A, KHG), (B, GD), (C, CT), (E, SP), (E, OD), (X, EM)], [
    m(KHG, GD, '1: Mở giỏ hàng, chọn "Đặt hàng"'),
    s(GD, '1.1: Hiển thị địa chỉ mặc định và phương thức thanh toán'),
    m(KHG, GD, '2: Xác nhận địa chỉ, chọn COD hoặc chuyển khoản, bấm "Xác nhận đặt hàng"'),
    m(GD, CT, '2.1: createOrder(dsSanPham, phuongThucTT, diaChi, ghiChu)'),
    loop('[MỖI SẢN PHẨM TRONG GIỎ]',
         m(CT, SP, '2.1.1: findUnique(productId)'),
         r(SP, CT, '2.1.2: return sanPham (giá, tồn kho)'),
         ),
    s(CT, '2.1.3: Tính tạm tính, giảm giá hạng thành viên, mã khuyến mãi'),
    alt(('[CHUYỂN KHOẢN]', [
        m(CT, OD, '2.1.4: create(đơn, trạng thái = Chờ thanh toán)'),
    ]), ('[THIẾU TỒN KHO]', [
        m(CT, OD, '2.1.5: create(đơn, trạng thái = Chờ nhập hàng)'),
    ]), ('[COD, ĐỦ HÀNG]', [
        m(CT, OD, '2.1.6: create(đơn, trạng thái = Chờ xác nhận)'),
    ])),
    r(OD, CT, '2.1.7: return donHang'),
    opt('[KHÔNG PHẢI ĐƠN CHỜ THANH TOÁN]',
        m(CT, EM, '2.1.8: sendOrderConfirmationEmail(donHang)'),
        ),
    r(CT, GD, '2.2: return maDon, trangThai'),
    s(GD, '2.3: Xóa sản phẩm đã đặt khỏi giỏ'),
    alt(('[CHUYỂN KHOẢN]', [
        s(GD, '2.4: Chuyển sang trang thanh toán mã QR (use case Thanh toán chuyển khoản)'),
    ]), ('[CÒN LẠI]', [
        s(GD, '2.5: Hiển thị "Đặt hàng thành công"'),
    ])),
])

# ============ 04. Thanh toán chuyển khoản VietQR qua SePay (Khách hàng) ============
GD, CT, OD, PM, LG, SE = 'GD_THANHTOAN_QR', 'CTRL_PAYMENT', 'ENTITY_ORDER', 'ENTITY_ORDERPAYMENT', 'ENTITY_LEDGER', 'CỔNG SEPAY'
D['uc04'] = ([(A, KHG), (B, GD), (C, CT), (X, SE), (E, OD), (E, PM), (E, LG)], [
    m(KHG, GD, '1: Mở trang thanh toán của đơn'),
    m(GD, CT, '1.1: getSepayPayment(maDon)'),
    m(CT, OD, '1.1.1: findUnique(maDon)'),
    r(OD, CT, '1.1.2: return donHang'),
    s(CT, '1.1.3: getReceivingAccount(), transferContentOf(maDon)'),
    s(CT, '1.1.4: buildQrUrl(taiKhoan, tongTien, "AETHERPC <mã đơn>")'),
    r(CT, GD, '1.2: return maQR, soTaiKhoan, noiDung, soTien'),
    s(GD, '1.3: Hiển thị mã VietQR, số tài khoản, nội dung chuyển khoản'),
    m(KHG, SE, '2: Quét mã QR, chuyển khoản bằng ứng dụng ngân hàng'),
    m(SE, CT, '2.1: sepayWebhook(id, soTien, noiDung, maGD)'),
    s(CT, '2.1.1: verifyWebhookAuth(Apikey)'),
    s(CT, '2.1.2: findOrderByTransfer(noiDung)'),
    m(CT, OD, '2.1.3: Khóa theo đơn, đọc lại đơn'),
    r(OD, CT, '2.1.4: return donHang'),
    alt(('[ĐỦ TIỀN, ĐƠN CHỜ THANH TOÁN]', [
        m(CT, PM, '2.1.5: create(SUCCESS, soTien = tongDon)'),
        m(CT, OD, '2.1.6: update(Đã thanh toán), approveOrderIfReady()'),
        m(CT, LG, '2.1.7: create(INCOME, kênh BANK)'),
    ]), ('[THIẾU TIỀN / ĐƠN ĐÃ HỦY / CHUYỂN TRÙNG]', [
        m(CT, PM, '2.1.8: create(REFUND_PENDING, soTien)'),
        m(CT, LG, '2.1.9: create(INCOME — chờ hoàn trả khách)'),
    ])),
    r(CT, SE, '2.2: return success'),
    loop('[MỖI 3 GIÂY ĐẾN KHI CÓ KẾT QUẢ]',
         m(GD, CT, '3: getSepayPayment(maDon)'),
         r(CT, GD, '3.1: return trangThaiThanhToan, dsKhoanHoan'),
         ),
    alt(('[ĐÃ THANH TOÁN]', [
        s(GD, '3.2: Hiển thị "Thanh toán thành công"'),
    ]), ('[CÓ KHOẢN CHỜ HOÀN]', [
        s(GD, '3.3: Báo số tiền chưa hợp lệ, Kế toán sẽ hoàn lại'),
    ]), ('[QUÁ 30 PHÚT CHƯA THANH TOÁN]', [
        s(GD, '3.4: Hiển thị "Đơn đã hủy do quá hạn thanh toán" (bộ lập lịch đã gọi autoCancelUnpaidOrders)'),
    ])),
])

# ============ 05. Trả lời chat trực tuyến (Nhân viên CSKH) ============
NV, GD, WS, CS, SS, MSG = 'NV CSKH', 'GD_CHAT_CSKH', 'CTRL_WEBSOCKET', 'CTRL_CHATSERVICE', 'ENTITY_CHATSESSION', 'ENTITY_CHATMESSAGE'
KHC = 'GD_CHAT_KHACH'
D['uc05'] = ([(A, NV), (B, GD), (C, WS), (C, CS), (E, SS), (E, MSG), (B, KHC)], [
    m(NV, GD, '1: Mở màn hình "Chat tư vấn"'),
    m(GD, WS, '1.1: ketNoi(cookie authToken)'),
    s(WS, '1.1.1: Xác thực JWT, kiểm tra vai trò CSKH'),
    m(WS, CS, '1.1.2: getAllSessions()'),
    m(CS, SS, '1.1.2.1: findMany()'),
    r(SS, CS, '1.1.2.2: return dsPhien'),
    r(CS, WS, '1.1.3: return dsPhien'),
    r(WS, GD, '1.2: INIT_SESSIONS(dsPhien)'),
    s(GD, '1.3: Hiển thị danh sách phiên chat'),
    m(NV, GD, '2: Chọn một phiên chat'),
    m(GD, WS, '2.1: MARK_READ(maPhien)'),
    m(WS, CS, '2.1.1: markRead(maPhien)'),
    s(GD, '2.2: Hiển thị lịch sử hội thoại'),
    m(NV, GD, '3: Nhập nội dung và gửi'),
    m(GD, WS, '3.1: STAFF_SEND_MSG(maPhien, noiDung)'),
    m(WS, CS, '3.1.1: addMessage(maPhien, "staff", noiDung)'),
    m(CS, MSG, '3.1.1.1: create(tinNhan)'),
    r(MSG, CS, '3.1.1.2: return tinNhan'),
    r(CS, WS, '3.1.2: return tinNhan'),
    m(WS, KHC, '3.2: Đẩy tin nhắn tới đúng khách của phiên'),
    r(WS, GD, '3.3: Xác nhận đã gửi'),
    alt(('[MẤT KẾT NỐI]', [
        s(GD, '3.4: Báo lỗi gửi tin, tự kết nối lại'),
    ]), ('[THÀNH CÔNG]', [
        s(GD, '3.5: Hiển thị tin nhắn trong khung chat'),
    ])),
])

# ============ 06. Bán hàng tại quầy (Nhân viên bán hàng) ============
NV, GD, CT, PE, SP, OD = 'NV BÁN HÀNG', 'GD_POS', 'CTRL_ORDER', 'CTRL_PHANQUYEN', 'ENTITY_PRODUCT', 'ENTITY_ORDER'
D['uc06'] = ([(A, NV), (B, GD), (C, CT), (C, PE), (E, SP), (E, OD)], [
    m(NV, GD, '1: Chọn "Điểm bán hàng"'),
    m(GD, CT, '1.1: getProducts()'),
    r(CT, GD, '1.2: return dsSanPham (giá, tồn kho)'),
    s(GD, '1.3: Hiển thị danh mục sản phẩm, giỏ tại quầy'),
    loop('[MỖI SẢN PHẨM]',
         m(NV, GD, '2: Quét mã / tìm sản phẩm, nhập số lượng'),
         alt(('[VƯỢT TỒN KHO]', [s(GD, '2.1: Cảnh báo, không thêm vào giỏ')]),
             ('[CÒN HÀNG]', [s(GD, '2.2: Thêm vào giỏ, cập nhật tổng tiền')])),
         ),
    m(NV, GD, '3: Nhập khách, chiết khấu, hình thức thanh toán, bấm "Xác nhận thu tiền"'),
    m(GD, CT, '3.1: createPosOrder(dsSanPham, chietKhau, phuongThucTT)'),
    opt('[CHIẾT KHẤU > 10% TỔNG TIỀN]',
        m(CT, PE, '3.1.1: hasOperationalPermission(vaiTro, "duyệt chiết khấu")'),
        r(PE, CT, '3.1.2: return coQuyen'),
        ),
    alt(('[KHÔNG CÓ QUYỀN]', [
        r(CT, GD, '3.2: return loi("Cần Quản lý bán hàng duyệt")'),
        s(GD, '3.3: Hiển thị lỗi, không tạo đơn'),
    ]), ('[HỢP LỆ]', [
        m(CT, OD, '3.1.3: create(đơn POS, khách WALK-IN, Đã thanh toán, soldById)'),
        m(CT, SP, '3.1.4: updateMany(tồn kho ≥ số lượng, trừ tồn), gán Serial'),
        r(SP, CT, '3.1.5: return soDongCapNhat'),
        r(CT, GD, '3.4: return donHang'),
        s(GD, '3.5: In phiếu thu / hóa đơn bán hàng'),
    ])),
])

# ============ 07. Xử lý và cập nhật đơn hàng (Nhân viên bán hàng) ============
GD, OH, EM = 'GD_QL_DONHANG', 'ENTITY_ORDERHISTORY', 'HỆ THỐNG EMAIL'
D['uc07'] = ([(A, NV), (B, GD), (C, CT), (E, OD), (E, SP), (E, OH), (X, EM)], [
    m(NV, GD, '1: Mở danh sách đơn, lọc "Chờ xác nhận"'),
    m(GD, CT, '1.1: getCustomerOrders(trangThai)'),
    m(CT, OD, '1.1.1: findMany(trangThai)'),
    r(OD, CT, '1.1.2: return dsDon'),
    r(CT, GD, '1.2: return dsDon'),
    m(NV, GD, '2: Chọn một đơn'),
    s(GD, '2.1: Hiển thị sản phẩm, địa chỉ, thanh toán, lịch sử'),
    m(NV, GD, '3: Chọn "Xác nhận đơn"'),
    m(GD, CT, '3.1: updateOrderStatus(maDon, "Đã xác nhận")'),
    loop('[MỖI DÒNG SẢN PHẨM]',
         m(CT, SP, '3.1.1: updateMany(tồn kho ≥ số lượng, trừ tồn), gán Serial'),
         r(SP, CT, '3.1.2: return soDongCapNhat'),
         ),
    alt(('[TỒN KHO KHÔNG ĐỦ]', [
        r(CT, GD, '3.2: return loi("Tồn kho không đủ")'),
        s(GD, '3.3: Hiển thị lỗi, đơn giữ nguyên'),
    ]), ('[THÀNH CÔNG]', [
        m(CT, OD, '3.1.3: update(Đã xác nhận), ghi giá vốn'),
        m(CT, OH, '3.1.4: create(lịch sử trạng thái)'),
        m(CT, EM, '3.1.5: sendOrderStatusUpdateEmail(donHang)'),
        r(CT, GD, '3.4: return donHang'),
        s(GD, '3.5: Cập nhật trạng thái trên danh sách'),
    ])),
])

# ============ 08. Lập yêu cầu báo giá và so sánh báo giá (Nhân viên mua hàng) ============
NV, GD, CT, PR, PO = 'NV MUA HÀNG', 'GD_MUAHANG', 'CTRL_PURCHASE', 'ENTITY_PURCHASEREQUEST', 'ENTITY_PURCHASEORDER'
D['uc08'] = ([(A, NV), (B, GD), (C, CT), (E, PR), (E, PO)], [
    m(NV, GD, '1: Chọn "Tạo yêu cầu báo giá mới", chọn sản phẩm, số lượng, các nhà cung cấp'),
    s(GD, '1.1: Kiểm tra đã chọn sản phẩm và nhà cung cấp'),
    loop('[MỖI NHÀ CUNG CẤP ĐƯỢC CHỌN]',
         m(GD, CT, '1.2: createPurchaseOrder(maNCC, dsSanPham, maPhieuDeXuat)'),
         opt('[LẬP TỪ PHIẾU ĐỀ XUẤT]',
             m(CT, PR, '1.2.1: updateMany(Đã duyệt → Đã lập RFQ)'),
             ),
         m(CT, PO, '1.2.2: create(trạng thái RFQ, đơn giá = 0)'),
         m(GD, CT, '1.3: updatePurchaseOrderStatus(maRFQ, "Đã gửi NCC")'),
         m(CT, PO, '1.3.1: updateMany(RFQ → Đã gửi NCC)'),
         ),
    s(GD, '1.4: Thông báo đã gửi yêu cầu báo giá'),
    m(NV, GD, '2: Mở bảng so sánh khi nhà cung cấp đã phản hồi'),
    m(GD, CT, '2.1: getPurchaseOrders()'),
    m(CT, PO, '2.1.1: findMany()'),
    r(PO, CT, '2.1.2: return dsBaoGia (Đã báo giá / Đã hủy)'),
    r(CT, GD, '2.2: return dsBaoGia'),
    s(GD, '2.3: So sánh đơn giá, thời gian giao'),
    m(NV, GD, '3: Chọn báo giá tốt nhất'),
    m(GD, CT, '3.1: updatePurchaseOrderStatus(maBaoGia, "Chờ lập phiếu", loserIds)'),
    s(CT, '3.1.1: Kiểm tra mọi mặt hàng đã có đơn giá'),
    m(CT, PO, '3.1.2: update(báo giá được chọn), hủy các báo giá còn lại'),
    m(NV, GD, '4: Bấm "Lập phiếu mua hàng"'),
    m(GD, CT, '4.1: issuePurchaseOrder(maBaoGia)'),
    m(CT, PO, '4.1.1: create(phiếu mua hàng, Chờ BGĐ duyệt); báo giá → Đã chuyển'),
    r(CT, GD, '4.2: return phieuMuaHang'),
    s(GD, '4.3: Thông báo đã trình Ban Giám đốc'),
])

# ============ 09. Phản hồi yêu cầu báo giá (Nhà cung cấp) ============
NCC, GD, POH = 'NHÀ CUNG CẤP', 'GD_CONG_NCC', 'ENTITY_POHISTORY'
D['uc09'] = ([(A, NCC), (B, GD), (C, CT), (E, PO), (E, POH)], [
    m(NCC, GD, '1: Mở mục "Yêu cầu báo giá"'),
    m(GD, CT, '1.1: getPurchaseOrders(maNhaCungCap, Đã gửi NCC)'),
    m(CT, PO, '1.1.1: findMany()'),
    r(PO, CT, '1.1.2: return dsYeuCau'),
    r(CT, GD, '1.2: return dsYeuCau'),
    m(NCC, GD, '2: Chọn một yêu cầu báo giá'),
    s(GD, '2.1: Hiển thị sản phẩm, số lượng yêu cầu'),
    alt(('[GỬI BÁO GIÁ]', [
        m(NCC, GD, '3: Nhập đơn giá, thời gian giao từng mặt hàng, gửi'),
        m(GD, CT, '3.1: updatePurchaseOrderStatus(maPO, "Đã báo giá", itemPrices)'),
        s(CT, '3.1.1: Kiểm tra chuyển trạng thái hợp lệ cho vai trò NCC'),
        m(CT, PO, '3.1.2: update(đơn giá, Đã báo giá)'),
        m(CT, POH, '3.1.3: create(lịch sử)'),
        r(CT, GD, '3.2: return baoGia'),
        s(GD, '3.3: Thông báo đã gửi báo giá'),
    ]), ('[TỪ CHỐI]', [
        m(NCC, GD, '4: Chọn "Từ chối", nhập lý do'),
        m(GD, CT, '4.1: updatePurchaseOrderStatus(maPO, "Đã hủy", lyDo)'),
        m(CT, PO, '4.1.1: update(Đã hủy, lyDo)'),
        r(CT, GD, '4.2: return ketQua'),
        s(GD, '4.3: Cập nhật danh sách'),
    ])),
])

# ============ 10. Duyệt đơn mua hàng (Ban Giám đốc) ============
BGD, GD, PE, AU = 'BAN GIÁM ĐỐC', 'GD_PHEDUYET', 'CTRL_PHANQUYEN', 'ENTITY_AUDITLOG'
D['uc10'] = ([(A, BGD), (B, GD), (C, CT), (C, PE), (E, PO), (E, AU)], [
    m(BGD, GD, '1: Mở "Trung tâm phê duyệt" → Đơn mua hàng'),
    m(GD, CT, '1.1: getPurchaseOrders("Chờ BGĐ duyệt")'),
    m(CT, PO, '1.1.1: findMany()'),
    r(PO, CT, '1.1.2: return dsPhieu'),
    r(CT, GD, '1.2: return dsPhieu'),
    m(BGD, GD, '2: Chọn phiếu, xem NCC, đơn giá, báo giá gốc'),
    alt(('[PHÊ DUYỆT]', [
        m(BGD, GD, '3: Bấm "Phê duyệt"'),
        m(GD, CT, '3.1: updatePurchaseOrderStatus(maPO, "Đơn mua hàng")'),
        m(CT, PE, '3.1.1: hasOperationalPermission(vaiTro, "duyệt PO")'),
        r(PE, CT, '3.1.2: return coQuyen'),
        alt(('[KHÔNG CÓ QUYỀN]', [
            r(CT, GD, '3.2: return loi("Không có quyền duyệt PO")'),
        ]), ('[CÓ QUYỀN]', [
            m(CT, PO, '3.1.3: updateMany(Chờ BGĐ duyệt → Đơn mua hàng), ghi lịch sử'),
            opt('[CẬP NHẬT THÀNH CÔNG]', m(CT, AU, '3.1.4: logAudit("APPROVE_PO")')),
            r(CT, GD, '3.3: return phieu (trạng thái hiện tại, không ghi đè)'),
            s(GD, '3.4: Hiển thị kết quả; phiếu xuất hiện trên cổng NCC'),
        ])),
    ]), ('[TỪ CHỐI]', [
        m(BGD, GD, '4: Bấm "Từ chối", nhập lý do'),
        m(GD, CT, '4.1: updatePurchaseOrderStatus(maPO, "Đã hủy", lyDo)'),
        m(CT, PO, '4.1.1: updateMany(→ Đã hủy, lý do), ghi lịch sử'),
        r(CT, GD, '4.2: return phieu'),
    ])),
])

# ============ 11. Duyệt bảng lương toàn công ty (Ban Giám đốc) ============
GD, CT, PL = 'GD_PHEDUYET', 'CTRL_HR', 'ENTITY_PAYROLL'
D['uc11'] = ([(A, BGD), (B, GD), (C, CT), (C, PE), (E, PL), (E, AU)], [
    m(BGD, GD, '1: Mở "Trung tâm phê duyệt" → Bảng lương'),
    m(GD, CT, '1.1: getPayrolls(kyLuong, "Chờ BGĐ duyệt")'),
    m(CT, PL, '1.1.1: findMany()'),
    r(PL, CT, '1.1.2: return dsPhieuLuong'),
    r(CT, GD, '1.2: return dsPhieuLuong, tongThucLinh'),
    m(BGD, GD, '2: Xem chi tiết từng nhân viên'),
    s(GD, '2.1: Hiển thị bảng lương chi tiết'),
    alt(('[PHÊ DUYỆT]', [
        m(BGD, GD, '3: Bấm "Phê duyệt ngay bảng lương"'),
        m(GD, CT, '3.1: approvePayrollCeo(kyLuong)'),
        m(CT, PE, '3.1.1: checkOperationalPermission("duyệt bảng lương")'),
        r(PE, CT, '3.1.2: return coQuyen'),
        m(CT, PL, '3.1.3: updateMany(Đã duyệt – chờ giải ngân, nguoiDuyet)'),
        m(CT, AU, '3.1.4: logAudit("Duyệt bảng lương")'),
        r(CT, GD, '3.2: return soPhieu'),
        s(GD, '3.3: Thông báo đã duyệt'),
    ]), ('[TRẢ VỀ ĐIỀU CHỈNH]', [
        m(BGD, GD, '4: Bấm "Trả về điều chỉnh", nhập lý do'),
        s(GD, '4.1: Kiểm tra đã nhập lý do'),
        m(GD, CT, '4.2: rejectPayrollCeo(kyLuong, lyDo)'),
        m(CT, PL, '4.2.1: updateMany(Bị trả về, lyDo)'),
        m(CT, AU, '4.2.2: logAudit("REJECT_PAYROLL")'),
        r(CT, GD, '4.3: return ketQua'),
        s(GD, '4.4: Thông báo đã trả về Nhân sự'),
    ])),
])

# ============ 12. Kiểm tra chất lượng hàng nhập (Nhân viên kiểm định) ============
QC, GD, CT, QI = 'NV KIỂM ĐỊNH', 'GD_KIEMDINH', 'CTRL_PURCHASE', 'ENTITY_QCINSPECTION'
D['uc12'] = ([(A, QC), (B, GD), (C, CT), (E, PO), (E, QI), (E, POH)], [
    m(QC, GD, '1: Mở danh sách đơn mua hàng chờ kiểm định'),
    m(GD, CT, '1.1: getPurchaseOrders("NCC đã xác nhận")'),
    m(CT, PO, '1.1.1: findMany()'),
    r(PO, CT, '1.1.2: return dsDon'),
    r(CT, GD, '1.2: return dsDon'),
    m(QC, GD, '2: Đối chiếu hàng thực nhận, ghi tỷ lệ lấy mẫu'),
    s(GD, '2.1: Hiển thị form kết luận kiểm định'),
    m(QC, GD, '3: Chọn kết luận (và nhập số lượng đạt / không đạt nếu một phần)'),
    s(GD, '3.1: Kiểm tra đủ thông tin kiểm định'),
    m(GD, CT, '3.2: updatePurchaseOrderStatus(maPO, ketLuan, slDat, slLoi)'),
    alt(('[CHẤP NHẬN TOÀN BỘ]', [
        m(CT, PO, '3.2.1: update(Đạt kiểm định)'),
    ]), ('[CHẤP NHẬN MỘT PHẦN]', [
        m(CT, PO, '3.2.2: update(Đạt một phần)'),
    ]), ('[TỪ CHỐI TOÀN BỘ]', [
        m(CT, PO, '3.2.3: update(Không đạt kiểm định), hủy phiếu nhập kho'),
    ])),
    m(CT, QI, '3.2.4: create(slDat, slLoi, ketQua, ghiChu)'),
    m(CT, POH, '3.2.5: create(lịch sử)'),
    r(CT, GD, '3.3: return ketQua'),
    s(GD, '3.4: Thông báo Kho lập phiếu nhập'),
])

# ============ 13. Thẩm định hàng hoàn trả (Nhân viên kiểm định) ============
GD, CT, RR, OD2 = 'GD_THAMDINH_DOITRA', 'CTRL_RETURN', 'ENTITY_RETURNREQUEST', 'ENTITY_ORDER'
D['uc13'] = ([(A, QC), (B, GD), (C, CT), (E, RR), (E, OD2)], [
    m(QC, GD, '1: Mở yêu cầu đổi trả "Đã nhận hàng tại kho"'),
    m(GD, CT, '1.1: getReturnRequests(trangThai)'),
    m(CT, RR, '1.1.1: findMany()'),
    r(RR, CT, '1.1.2: return dsYeuCau'),
    r(CT, GD, '1.2: return dsYeuCau'),
    s(GD, '1.3: Hiển thị lý do khách khai báo'),
    m(QC, GD, '2: Kiểm tra tem, ngoại quan, hoạt động, đối chiếu Serial; ghi kết luận, ảnh minh chứng'),
    m(GD, CT, '2.1: qcInspectReturn(maYeuCau, qcDecision, dangLoi, ghiChu, anh)'),
    alt(('[ĐẠT]', [
        m(CT, RR, '2.1.1: update(Đạt thẩm định, dạng lỗi, ảnh, người thẩm định)'),
        m(CT, OD2, '2.1.2: update(trạng thái "Đạt thẩm định")'),
        r(CT, GD, '2.2: return ketQua'),
        s(GD, '2.3: Báo Thủ kho nhập lại kệ; yêu cầu đổi mới sẽ tạo đơn 0đ khi nhập kho'),
    ]), ('[KHÔNG ĐẠT]', [
        m(CT, RR, '2.1.3: update(Từ chối, lý do)'),
        m(CT, OD2, '2.1.4: update(trạng thái "Đã giao")'),
        r(CT, GD, '2.4: return ketQua'),
        s(GD, '2.5: Báo giao trả hàng lại cho khách'),
    ])),
])

# ============ 14. Nghiệm thu hàng nhập kho (Nhân viên kho) ============
NK, GD, CT, GR, SN, SP = 'NV KHO', 'GD_NHAPKHO', 'CTRL_WAREHOUSE', 'ENTITY_GOODSRECEIPT', 'ENTITY_SERIALNUMBER', 'ENTITY_PRODUCT'
D['uc14'] = ([(A, NK), (B, GD), (C, CT), (E, GR), (E, PO), (E, SN), (E, SP)], [
    m(NK, GD, '1: Mở phiếu nhập kho của đơn mua hàng'),
    m(GD, CT, '1.1: getReceiptById(maPhieu)'),
    m(CT, GR, '1.1.1: findUnique()'),
    r(GR, CT, '1.1.2: return phieuNhap, ketQuaKiemDinh'),
    r(CT, GD, '1.2: return slDuocNhap'),
    s(GD, '1.3: Hiển thị số lượng được nhập'),
    m(NK, GD, '2: Quét Serial từng đơn vị, bấm "Duyệt phiếu nhập"'),
    m(GD, CT, '2.1: validateReceipt(maPhieu, dsSerial)'),
    m(CT, GR, '2.1.1: updateMany(chưa duyệt → Đã duyệt)'),
    m(CT, PO, '2.1.2: Kiểm tra Đạt / Đạt một phần, lấy tỷ lệ đạt'),
    r(PO, CT, '2.1.3: return donMuaHang, tyLeDat'),
    s(CT, '2.1.4: Kiểm tra đủ số lượng, không trùng Serial'),
    alt(('[THIẾU HOẶC TRÙNG SERIAL]', [
        r(CT, GD, '2.2: return loi (hoàn tác toàn bộ giao dịch)'),
        s(GD, '2.3: Yêu cầu bổ sung / sửa Serial'),
    ]), ('[HỢP LỆ]', [
        m(CT, SN, '2.1.5: createMany(dsSerial, Sẵn có)'),
        m(CT, SP, '2.1.6: update(+tồn kho, giá vốn bình quân gia quyền)'),
        m(CT, PO, '2.1.7: update(Đã nhận hàng)'),
        r(CT, GD, '2.4: return phieuNhap'),
        s(GD, '2.5: Thông báo nhập kho thành công'),
    ])),
])

# ============ 15. Xác nhận xuất kho và phân công giao hàng (Nhân viên kho) ============
GD, CT, AJ, EP = 'GD_LENH_GIAOHANG', 'CTRL_ORDER', 'ENTITY_ASSEMBLYJOB', 'ENTITY_EMPLOYEE'
D['uc15'] = ([(A, NK), (B, GD), (C, CT), (E, OD), (E, AJ), (E, EP)], [
    m(NK, GD, '1: Mở "Lệnh giao hàng"'),
    m(GD, CT, '1.1: getCustomerOrders("Sẵn sàng giao")'),
    m(CT, OD, '1.1.1: findMany()'),
    r(OD, CT, '1.1.2: return dsDon'),
    m(CT, AJ, '1.1.3: Kiểm tra lệnh lắp ráp dang dở'),
    r(AJ, CT, '1.1.4: return dsLenh'),
    r(CT, GD, '1.2: return dsDon (kèm nhãn "Chờ / Đang lắp ráp")'),
    m(NK, GD, '2: Chọn đơn, bấm "Xác nhận xuất kho"'),
    m(GD, CT, '2.1: getShippers(khuVuc)'),
    m(CT, EP, '2.1.1: findMany(vai trò Giao hàng, đang hoạt động)'),
    r(EP, CT, '2.1.2: return dsShipper'),
    r(CT, GD, '2.2: return dsShipper'),
    s(GD, '2.3: Mở khung phân công, gợi ý shipper theo khu vực'),
    m(NK, GD, '3: Chọn nhân viên giao hàng, xác nhận'),
    m(GD, CT, '3.1: updateOrderStatus(maDon, assignedShipperId)'),
    m(CT, EP, '3.1.1: Kiểm tra là shipper nội bộ hợp lệ'),
    r(EP, CT, '3.1.2: return shipper'),
    alt(('[KHÔNG HỢP LỆ]', [
        r(CT, GD, '3.2: return loi'),
    ]), ('[HỢP LỆ]', [
        m(CT, OD, '3.1.3: update(assignedShipperId, Sẵn sàng giao)'),
        r(CT, GD, '3.3: return donHang'),
        s(GD, '3.4: Đơn chuyển vào mục Chờ nhận của shipper'),
    ])),
])

# ============ 16. Cập nhật tiến độ lắp ráp (Nhân viên lắp ráp) ============
LR, GD, CT, EM = 'NV LẮP RÁP', 'GD_LAPRAP', 'CTRL_ASSEMBLY', 'HỆ THỐNG EMAIL'
D['uc16'] = ([(A, LR), (B, GD), (C, CT), (E, AJ), (E, OD), (X, EM)], [
    m(LR, GD, '1: Mở lệnh lắp ráp'),
    m(GD, CT, '1.1: getAssemblyJobs()'),
    m(CT, AJ, '1.1.1: findMany()'),
    r(AJ, CT, '1.1.2: return dsLenh'),
    r(CT, GD, '1.2: return dsLinhKien, checklist 4 mục'),
    m(LR, GD, '2: Nhập Serial từng linh kiện, đánh dấu BIOS/POST, cài HĐH, tải nặng, niêm phong'),
    m(GD, CT, '2.1: updateAssemblyJob(maLenh, componentSerials, checklist)'),
    m(CT, AJ, '2.1.1: update(tiến độ)'),
    r(CT, GD, '2.2: return lenhLapRap'),
    m(LR, GD, '3: Bấm "Nghiệm thu"'),
    m(GD, CT, '3.1: updateAssemblyJob(maLenh, "Hoàn tất")'),
    s(CT, '3.1.1: Kiểm tra đủ 4 mục kiểm thử và đủ Serial'),
    alt(('[THIẾU MỤC / THIẾU SERIAL]', [
        r(CT, GD, '3.2: return loi(phần còn thiếu)'),
        s(GD, '3.3: Hiển thị phần còn thiếu'),
    ]), ('[ĐỦ ĐIỀU KIỆN]', [
        m(CT, AJ, '3.1.2: update(Hoàn tất, người và thời điểm nghiệm thu)'),
        opt('[ĐƠN GẮN LỆNH ĐANG "ĐÃ XÁC NHẬN"]',
            m(CT, OD, '3.1.3: update(Sẵn sàng giao), ghi lịch sử'),
            m(CT, EM, '3.1.4: sendOrderStatusUpdateEmail(donHang)'),
            ),
        r(CT, GD, '3.4: return lenhLapRap'),
        s(GD, '3.5: Thông báo nghiệm thu thành công'),
    ])),
])

# ============ 17. Giao hàng và thu tiền hộ (Nhân viên giao hàng) ============
SH, GD, WS, CT, PM, EM = 'NV GIAO HÀNG', 'GD_GIAOHANG', 'CTRL_WEBSOCKET', 'CTRL_ORDER', 'ENTITY_ORDERPAYMENT', 'HỆ THỐNG EMAIL'
D['uc17'] = ([(A, SH), (B, GD), (C, WS), (C, CT), (E, OD), (E, PM), (X, EM)], [
    m(SH, GD, '1: Bấm "Nhận chuyến"'),
    m(GD, CT, '1.1: updateOrderStatus(maDon, "Đang giao")'),
    m(CT, OD, '1.1.1: update(Đang giao, shippedAt)'),
    r(CT, GD, '1.2: return donHang'),
    loop('[TRONG KHI ĐANG GIAO]',
         m(GD, WS, '2: SHIPPER_UPDATE_LOCATION(maDon, viDo, kinhDo)'),
         s(WS, '2.1: updateDeliveryLocation() — lưu vị trí, đẩy cho khách theo dõi'),
         ),
    m(SH, GD, '3: Chụp ảnh xác nhận, thu tiền, bấm "Giao hàng thành công"'),
    m(GD, CT, '3.1: updateOrderStatus(maDon, "Đã giao", proofPhoto, cashAmount, bankAmount, bankRefCode)'),
    alt(('[KHÁCH VẮNG MẶT / TỪ CHỐI NHẬN]', [
        m(CT, OD, '3.1.1: update(Giao không thành công / Đang hoàn về kho, lý do, ảnh)'),
    ]), ('[GIAO THÀNH CÔNG]', [
        m(CT, OD, '3.1.2: update(Đã giao, ảnh xác nhận, Đã thanh toán)'),
        alt(('[TIỀN MẶT COD]', [
            m(CT, PM, '3.1.3: create(CASH, chờ Kế toán đối soát)'),
        ]), ('[CHUYỂN KHOẢN]', [
            m(CT, PM, '3.1.4: create(BANK_TRANSFER, mã giao dịch bắt buộc)'),
        ])),
    ])),
    m(CT, EM, '3.1.5: sendOrderStatusUpdateEmail(donHang)'),
    r(CT, GD, '3.2: return donHang'),
    s(GD, '3.3: Cập nhật danh sách chuyến'),
])

# ============ 18. Thanh toán nhà cung cấp (Nhân viên kế toán) ============
KT, GD, CT, VB, VP, LG = 'NV KẾ TOÁN', 'GD_THANHTOAN_NCC', 'CTRL_PURCHASE', 'ENTITY_VENDORBILL', 'ENTITY_VENDORPAYMENT', 'ENTITY_LEDGER'
D['uc18'] = ([(A, KT), (B, GD), (C, CT), (E, PO), (E, VB), (E, VP), (E, LG)], [
    m(KT, GD, '1: Mở "Thanh toán đơn mua hàng", chọn đơn đã nhập kho'),
    m(GD, CT, '1.1: getPurchaseOrders(Đã nhập kho)'),
    m(CT, PO, '1.1.1: findMany(kèm phiếu nhập, hóa đơn)'),
    r(PO, CT, '1.1.2: return dsDon'),
    r(CT, GD, '1.2: return dsDon, slNghiemThu'),
    m(KT, GD, '2: Chọn "Lập hóa đơn công nợ"'),
    m(GD, CT, '2.1: createVendorBill(maPO)'),
    s(CT, '2.1.1: Đối chiếu 3 chứng từ: PO – phiếu nhập – hóa đơn'),
    m(CT, VB, '2.1.2: create(tongTien = slDat × đơn giá)'),
    r(CT, GD, '2.2: return hoaDon'),
    m(KT, GD, '3: Ghi nhận một đợt thanh toán (số tiền, hình thức)'),
    m(GD, CT, '3.1: registerPayment(maHoaDon, soTien, hinhThuc)'),
    alt(('[SỐ TIỀN VƯỢT CÔNG NỢ]', [
        r(CT, GD, '3.2: return loi'),
        s(GD, '3.3: Yêu cầu nhập lại'),
    ]), ('[HỢP LỆ]', [
        m(CT, VP, '3.1.1: create(khoanThanhToan)'),
        m(CT, VB, '3.1.2: update(daTra, Một phần / Đã thanh toán)'),
        m(CT, LG, '3.1.3: create(EXPENSE)'),
        s(CT, '3.1.4: checkAndUpdatePoCompletion()'),
        opt('[NHẬP ĐỦ VÀ TRẢ ĐỦ]', m(CT, PO, '3.1.5: update(Hoàn tất)')),
        r(CT, GD, '3.4: return congNoConLai'),
        s(GD, '3.5: Hiển thị công nợ còn lại'),
    ])),
])

# ============ 19. Đối soát tiền thu hộ COD (Nhân viên kế toán) ============
GD, CT, AU = 'GD_DOISOAT_COD', 'CTRL_LEDGER', 'ENTITY_AUDITLOG'
D['uc19'] = ([(A, KT), (B, GD), (C, CT), (E, PM), (E, LG), (E, AU)], [
    m(KT, GD, '1: Mở mục "Đối soát tiền thu hộ"'),
    m(GD, CT, '1.1: getCodSettlement()'),
    m(CT, PM, '1.1.1: findMany(CASH, chưa đối soát)'),
    r(PM, CT, '1.1.2: return dsKhoanThu'),
    s(CT, '1.1.3: Gom theo nhân viên giao hàng: số đơn, tổng tiền'),
    r(CT, GD, '1.2: return dsTheoShipper'),
    s(GD, '1.3: Hiển thị bảng tổng hợp'),
    m(KT, GD, '2: Chọn shipper, kiểm đếm tiền mặt'),
    s(GD, '2.1: Hiển thị chi tiết từng đơn'),
    m(KT, GD, '3: Bấm "Xác nhận đã thu"'),
    m(GD, CT, '3.1: settleCodForShipper(maShipper)'),
    m(CT, PM, '3.1.1: updateMany(chưa đối soát → đã đối soát, nguoi, thoiDiem)'),
    r(PM, CT, '3.1.2: return soKhoan'),
    alt(('[SỐ KHOẢN = 0]', [
        r(CT, GD, '3.2: return loi("Không có khoản COD nào đang chờ")'),
    ]), ('[THÀNH CÔNG]', [
        m(CT, LG, '3.1.3: create(INCOME, kênh CASH)'),
        m(CT, AU, '3.1.4: logAudit("Đối soát COD")'),
        r(CT, GD, '3.3: return soKhoan, tongTien'),
        s(GD, '3.4: Báo "Đã đối soát thành công … đơn"'),
    ])),
])

# ============ 20. Tính lương và trình duyệt bảng lương (Nhân viên nhân sự) ============
NS, GD, CT, PS, AT, PL = 'NV NHÂN SỰ', 'GD_TINHLUONG', 'CTRL_HR', 'CTRL_PAYROLLSERVICE', 'ENTITY_ATTENDANCE', 'ENTITY_PAYROLL'
D['uc20'] = ([(A, NS), (B, GD), (C, CT), (C, PS), (E, AT), (E, PL)], [
    m(NS, GD, '1: Chọn kỳ lương, bấm "Tính lương kỳ này"'),
    m(GD, CT, '1.1: calculatePayroll(kyLuong)'),
    m(CT, PL, '1.1.1: Kiểm tra kỳ chưa trình / chưa duyệt'),
    r(PL, CT, '1.1.2: return trangThaiKy'),
    m(CT, PS, '1.1.3: loadPayrollContext(kyLuong)'),
    m(PS, AT, '1.1.3.1: findMany(chấm công, nghỉ phép, ngày lễ)'),
    r(AT, PS, '1.1.3.2: return duLieuCong'),
    loop('[MỖI NHÂN VIÊN]',
         m(CT, PS, '1.1.4: computePayslip(nhanVien, context)'),
         s(PS, '1.1.4.1: Công, phụ cấp, tăng ca, hoa hồng, BHXH 10,5%, thuế TNCN'),
         r(PS, CT, '1.1.4.2: return phieuLuong'),
         m(CT, PL, '1.1.5: upsert(phieuLuong, Nháp)'),
         ),
    r(CT, GD, '1.2: return dsPhieu, tongQuyLuong'),
    opt('[ĐIỀU CHỈNH MỘT PHIẾU]',
        m(NS, GD, '2: Nhập thưởng / khấu trừ kèm lý do'),
        m(GD, CT, '2.1: adjustPayroll(maPhieu, soTien, lyDo)'),
        m(CT, PL, '2.1.1: update(tính lại thuế, thực lĩnh)'),
        r(CT, GD, '2.2: return phieuLuong'),
        ),
    m(NS, GD, '3: Bấm "Trình Ban Giám đốc duyệt"'),
    m(GD, CT, '3.1: submitPayroll(kyLuong)'),
    m(CT, PL, '3.1.1: updateMany(Nháp → Chờ BGĐ duyệt)'),
    r(CT, GD, '3.2: return soPhieu'),
    s(GD, '3.3: Thông báo đã trình duyệt'),
])

# ============ 21. Đăng ký khuôn mặt (Nhân viên) ============
NVI, GD, FA, CT, EP, AU = 'NHÂN VIÊN', 'GD_KHUONMAT', 'CTRL_FACEAPI', 'CTRL_HR', 'ENTITY_EMPLOYEE', 'ENTITY_AUDITLOG'
D['uc21'] = ([(A, NVI), (B, GD), (C, FA), (C, CT), (E, EP), (E, AU)], [
    m(NVI, GD, '1: Chọn "Chấm công khuôn mặt" (chưa có mẫu)'),
    m(GD, FA, '1.1: taiMoHinh(), moCamera()'),
    r(FA, GD, '1.2: return camera'),
    m(NVI, GD, '2: Nhìn thẳng, quay trái, quay phải, nhìn thẳng lại'),
    m(GD, FA, '2.1: kiemTraNguoiThat(thử thách quay đầu)'),
    loop('[5 MẪU KHI NHÌN THẲNG]',
         m(GD, FA, '2.2: detectSingleFace().withFaceDescriptor()'),
         r(FA, GD, '2.3: return vector128'),
         ),
    s(GD, '2.4: Tính vector trung bình, chụp ảnh mẫu'),
    m(GD, CT, '2.5: registerFace(vectorTB, anhMau)'),
    m(CT, EP, '2.5.1: findUnique(nhanVien) — đã có mẫu?'),
    r(EP, CT, '2.5.2: return faceRegisteredAt'),
    alt(('[ĐÃ CÓ MẪU]', [
        r(CT, GD, '2.6: return loi("Đề nghị phòng nhân sự đặt lại")'),
    ]), ('[CHƯA CÓ MẪU]', [
        m(CT, EP, '2.5.3: findMany(nhân viên khác đã có mẫu)'),
        r(EP, CT, '2.5.4: return dsMau'),
        s(CT, '2.5.5: euclideanDistance() < ngưỡng?'),
        alt(('[TRÙNG NHÂN VIÊN KHÁC]', [
            m(CT, AU, '2.5.6: logAudit("FACE_REGISTER", FAILED)'),
            r(CT, GD, '2.7: return loi("Khuôn mặt đã được đăng ký")'),
        ]), ('[KHÔNG TRÙNG]', [
            m(CT, EP, '2.5.7: update(faceDescriptor, faceImage, faceRegisteredAt)'),
            m(CT, AU, '2.5.8: logAudit("FACE_REGISTER")'),
            r(CT, GD, '2.8: return thanhCong'),
        ])),
    ])),
    s(GD, '2.9: Hiển thị kết quả đăng ký'),
])

# ============ 22. Chấm công bằng khuôn mặt (Nhân viên) ============
D['uc22'] = ([(A, NVI), (B, GD), (C, FA), (C, CT), (E, EP), (E, AT), (E, AU)], [
    m(NVI, GD, '1: Chọn "Chấm công khuôn mặt"'),
    m(GD, CT, '1.1: getTodayAttendance()'),
    r(CT, GD, '1.2: return caLamViec, gioVao, gioRa'),
    s(GD, '1.3: Hiển thị lần chấm VÀO CA / RA CA, mở camera'),
    m(NVI, GD, '2: Thực hiện thử thách quay đầu'),
    m(GD, FA, '2.1: kiemTraNguoiThat(), detectSingleFace()'),
    r(FA, GD, '2.2: return vector128, anhChup'),
    m(GD, CT, '2.3: checkAttendance(vector, anhChup)'),
    m(CT, EP, '2.3.1: findUnique(nhanVien)'),
    r(EP, CT, '2.3.2: return faceDescriptor, trangThai'),
    s(CT, '2.3.3: euclideanDistance(mẫu, vector) ≤ 0,50?'),
    alt(('[KHÔNG KHỚP]', [
        m(CT, AU, '2.3.4: logAudit("FACE_CHECK", FAILED)'),
        r(CT, GD, '2.4: return loi("Khuôn mặt không khớp")'),
    ]), ('[KHỚP, CHƯA CÓ GIỜ VÀO]', [
        s(CT, '2.3.5: Tính số phút đi muộn (trừ nghỉ trưa)'),
        m(CT, AT, '2.3.6: create(checkIn, FACE, faceDistance, ảnh)'),
        r(CT, GD, '2.5: return gioVao, phutMuon'),
    ]), ('[KHỚP, ĐÃ CÓ GIỜ VÀO]', [
        s(CT, '2.3.7: Tính về sớm, giờ làm, giờ tăng ca'),
        m(CT, AT, '2.3.8: update(checkOut)'),
        r(CT, GD, '2.6: return gioRa, gioLam, tangCa'),
    ])),
    s(GD, '2.7: Hiển thị kết quả chấm công'),
])

# ============ 23. Đăng nhập (Người dùng) ============
ND, GD, CT, EP, SU, KH, AU = 'NGƯỜI DÙNG', 'GD_DANGNHAP', 'CTRL_AUTH', 'ENTITY_EMPLOYEE', 'ENTITY_SUPPLIER', 'ENTITY_CUSTOMER', 'ENTITY_AUDITLOG'
D['uc23'] = ([(A, ND), (B, GD), (C, CT), (E, EP), (E, SU), (E, KH), (E, AU)], [
    m(ND, GD, '1: Mở trang "Đăng nhập"'),
    s(GD, '1.1: hienThiFormDangNhap()'),
    m(ND, GD, '2: Nhập tên đăng nhập hoặc email, mật khẩu, bấm "Đăng nhập"'),
    s(GD, '2.1: Kiểm tra không bỏ trống'),
    ('par', [('[TÀI KHOẢN NỘI BỘ]', [
        m(GD, CT, '2.2: loginEmployee(username, password)'),
        m(CT, EP, '2.2.1: findFirst(email | mã nhân viên)'),
        r(EP, CT, '2.2.2: return nhanVien'),
        opt('[KHÔNG PHẢI NHÂN VIÊN]',
            m(CT, SU, '2.2.3: findFirst(email | mã NCC)'),
            r(SU, CT, '2.2.4: return nhaCungCap'),
            ),
        s(CT, '2.2.5: bcrypt.compare(), kiểm tra trạng thái'),
        m(CT, AU, '2.2.6: logAudit("LOGIN", SUCCESS | FAILED)'),
    ]), ('[TÀI KHOẢN KHÁCH HÀNG]', [
        m(GD, CT, '2.3: loginCustomer(username, password)'),
        m(CT, KH, '2.3.1: findFirst(email | tên đăng nhập)'),
        r(KH, CT, '2.3.2: return khachHang'),
        s(CT, '2.3.3: bcrypt.compare(), kiểm tra trạng thái'),
    ])]),
    alt(('[CẢ HAI ĐỀU THẤT BẠI]', [
        r(CT, GD, '2.4: return loi'),
        s(GD, '2.5: Báo lỗi đăng nhập hoặc quá số lần thử'),
    ]), ('[CÓ MỘT YÊU CẦU THÀNH CÔNG]', [
        s(CT, '2.6: jwt.sign(id, role) — nhân viên 1 ngày, khách 7 ngày; đặt cookie authToken'),
        r(CT, GD, '2.7: return nguoiDung, vaiTro'),
        s(GD, '2.8: Chuyển tới trang theo vai trò'),
    ])),
])

# ============ 24. Quản trị tài khoản, phân quyền và nhật ký (Quản trị viên) ============
QT, GD, CT, RP, AU = 'QUẢN TRỊ VIÊN', 'GD_QUANTRI', 'CTRL_SYSTEM', 'ENTITY_ROLEPERMISSION', 'ENTITY_AUDITLOG'
D['uc24'] = ([(A, QT), (B, GD), (C, CT), (E, RP), (E, EP), (E, AU)], [
    m(QT, GD, '1: Mở "Ma trận phân quyền"'),
    m(GD, CT, '1.1: getRolePermissions()'),
    m(CT, RP, '1.1.1: findMany()'),
    r(RP, CT, '1.1.2: return maTran'),
    r(CT, GD, '1.2: return maTran'),
    s(GD, '1.3: Hiển thị ma trận nghiệp vụ × vai trò'),
    m(QT, GD, '2: Bật / tắt quyền và bấm "Lưu"'),
    m(GD, CT, '2.1: updateRolePermissions(maTranMoi)'),
    s(CT, '2.1.1: Kiểm tra vai trò Quản trị viên, dữ liệu hợp lệ'),
    alt(('[KHÔNG HỢP LỆ]', [
        r(CT, GD, '2.2: return loi'),
    ]), ('[HỢP LỆ]', [
        m(CT, RP, '2.1.2: upsert(quyền từng vai trò)'),
        m(CT, AU, '2.1.3: logAudit("Cập nhật phân quyền")'),
        r(CT, GD, '2.3: return thanhCong'),
        s(GD, '2.4: Thông báo đã áp dụng ngay'),
    ])),
    opt('[KHÓA / MỞ TÀI KHOẢN]',
        m(QT, GD, '3: Chọn tài khoản, bấm "Khóa"'),
        m(GD, CT, '3.1: setEmployeeStatus(maNV, Ngừng hoạt động)'),
        m(CT, EP, '3.1.1: update(trangThai)'),
        m(CT, AU, '3.1.2: logAudit()'),
        r(CT, GD, '3.2: return thanhCong'),
        ),
    m(QT, GD, '4: Mở "Nhật ký kiểm toán", lọc'),
    m(GD, CT, '4.1: getAuditLogs(nguoiDung, hanhDong, thoiGian)'),
    m(CT, AU, '4.1.1: findMany(boLoc)'),
    r(AU, CT, '4.1.2: return dsNhatKy'),
    r(CT, GD, '4.2: return dsNhatKy'),
    s(GD, '4.3: Hiển thị kết quả tra cứu'),
])


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    for key, (parts, steps) in D.items():
        size = render(parts, steps, os.path.join(here, f'{key}_seq.png'))
        print(key, size, round(size[0] / 25), round(size[1] / size[0], 2))
