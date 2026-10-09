# -*- coding: utf-8 -*-
"""Luồng xử lý của 24 use case tiêu biểu — nguồn chung cho sơ đồ BPMN chức năng (mục 3.2)
và sơ đồ hoạt động (mục 3.5). Bám theo mã nguồn nhánh feat/thanh-toan-sepay.

Chạy:  python flows.py   → ucNN_bpmn.png và ucNN_act.png cùng thư mục.
Nút: (id, làn, bước, lệch, loại, chữ). Cạnh: (từ, tới, nhãn, tùy chọn).
"""
import os
from flowdiag import render

HT = 'Hệ Thống'
FLOWS = {}


def T(i, lane, step, text, sub=0): return (i, lane, step, sub, 'task', text)
def G(i, lane, step, text, sub=0): return (i, lane, step, sub, 'gw', text)
def M(i, lane, step, sub=0): return (i, lane, step, sub, 'merge', '')
def S(lane=0): return ('s', lane, 0, 0, 'start', '')
def E(lane, step, sub=0, i='e'): return (i, lane, step, sub, 'end', '')


HI = {'side': 'hi'}

# 01 ---------------------------------------------------------------- Đăng ký tài khoản
FLOWS['uc01'] = dict(title='Đăng Ký Tài Khoản', lanes=['Khách Vãng Lai', HT], nodes=[
    S(), T('t1', 0, 1, 'Chọn "Đăng ký" trên trang đăng nhập'),
    T('t2', 1, 2, 'Hiển thị form đăng ký'),
    T('t3', 0, 3, 'Nhập họ tên, email, tên đăng nhập, SĐT, mật khẩu, bấm "Đăng ký"'),
    T('t4', 1, 4, 'Kiểm tra trường bắt buộc, định dạng tên đăng nhập'),
    G('g1', 1, 4.8, 'Hợp lệ?'),
    T('t5', 1, 5.8, 'Kiểm tra trùng email, tên đăng nhập, SĐT'),
    G('g2', 1, 6.6, 'Bị trùng?'),
    T('t6', 1, 7.6, 'Báo lỗi cụ thể, giữ dữ liệu đã nhập', 1),
    T('t7', 1, 7.6, 'Băm mật khẩu, tạo tài khoản hạng Đồng, tạo phiên đăng nhập'),
    T('t8', 1, 8.6, 'Gửi email chào mừng, về trang chủ'),
    E(1, 9.4)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4'), ('t4', 'g1'),
    ('g1', 't5', 'Có'), ('g1', 't6', 'Không'), ('t5', 'g2'), ('g2', 't6', 'Có'), ('g2', 't7', 'Không'),
    ('t6', 't3', None, HI), ('t7', 't8'), ('t8', 'e')])

# 02 ---------------------------------------------------------------- Tự cấu hình máy tính
FLOWS['uc02'] = dict(title='Tự Cấu Hình Máy Tính', lanes=['Khách Vãng Lai', HT], nodes=[
    S(), T('t1', 0, 1, 'Chọn "Tự cấu hình máy tính"'),
    T('t2', 1, 2, 'Tải linh kiện, hiển thị 8 khe linh kiện'),
    G('g0', 0, 2.8, 'Dùng trợ lý AI?'),
    T('tA', 0, 3.8, 'Nhập nhu cầu bằng văn bản', -1),
    T('tB', 1, 4.8, 'Phân tích nhu cầu, tự điền linh kiện gợi ý'),
    T('t3', 0, 5.8, 'Chọn hoặc điều chỉnh linh kiện từng khe'),
    T('t4', 1, 6.8, 'Kiểm tra socket, chuẩn RAM, công suất nguồn, kích thước vỏ, tản nhiệt'),
    G('g1', 1, 7.6, 'Tương thích?'),
    T('t5', 1, 8.6, 'Hiển thị cảnh báo, không chặn thao tác', 1),
    T('t6', 1, 8.6, 'Cập nhật tổng giá cấu hình'),
    T('t7', 0, 9.6, 'Bấm "Thêm cấu hình vào giỏ hàng"'),
    T('t8', 1, 10.6, 'Thêm gói cấu hình vào giỏ, báo thành công'),
    E(1, 11.4)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 'g0'), ('g0', 'tA', 'Có'), ('g0', 't3', 'Không'), ('tA', 'tB'), ('tB', 't3'),
    ('t3', 't4'), ('t4', 'g1'), ('g1', 't6', 'Có'), ('g1', 't5', 'Không'), ('t5', 't6'),
    ('t6', 't7'), ('t7', 't8'), ('t8', 'e')])

# 03 ---------------------------------------------------------------- Đặt hàng
FLOWS['uc03'] = dict(title='Đặt Hàng', lanes=['Khách Hàng', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở giỏ hàng, chọn "Đặt hàng"'),
    T('t2', 1, 2, 'Hiển thị trang thanh toán, địa chỉ mặc định'),
    G('g1', 1, 2.8, 'Có địa chỉ?'),
    T('t3', 0, 2.8, 'Bổ sung địa chỉ giao hàng'),
    T('t4', 0, 4, 'Nhập mã khuyến mãi (nếu có), chọn COD hoặc chuyển khoản, xác nhận'),
    T('t5', 1, 5, 'Kiểm tra tồn kho, giảm giá hạng thành viên, kiểm tra và áp mã khuyến mãi'),
    G('g2', 1, 5.8, 'Phương thức?'),
    T('t6', 1, 6.8, 'Tạo đơn "Chờ thanh toán"', -1),
    G('g3', 1, 6.6, 'Đủ hàng?', 0.7),
    T('t7', 1, 7.6, 'Tạo đơn "Chờ xác nhận"', 0),
    T('t8', 1, 7.6, 'Tạo đơn "Chờ nhập hàng"', 1.4),
    M('m', 1, 8.4, 0.7),
    T('t9', 1, 9.2, 'Gửi email xác nhận, dọn giỏ hàng', 0.7),
    T('t10', 1, 9.2, 'Dọn giỏ, mở trang thanh toán VietQR', -1),
    E(1, 10, 0)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 'g1'), ('g1', 't3', 'Không'), ('t3', 't2', None),
    ('g1', 't4', 'Có', {'exit': 'fwd', 'midstep': 3.42}), ('t4', 't5'), ('t5', 'g2'),
    ('g2', 't6', 'Chuyển khoản'), ('g2', 'g3', 'COD'), ('g3', 't7', 'Có'), ('g3', 't8', 'Không'),
    ('t7', 'm'), ('t8', 'm'), ('m', 't9'), ('t6', 't10'), ('t10', 'e'), ('t9', 'e')])

# 04 ---------------------------------------------------------------- Thanh toán chuyển khoản qua SePay
FLOWS['uc04'] = dict(title='Chọn Phương Thức Và Xác Nhận Thanh Toán', lanes=['Khách Hàng', HT, 'Cổng Thanh Toán SePay'], nodes=[
    S(), T('t1', 0, 1, 'Mở trang thanh toán của đơn'),
    T('t2', 1, 2, 'Sinh mã VietQR kèm số tiền, nội dung "AETHERPC <mã đơn>"'),
    T('t3', 0, 3, 'Quét mã, chuyển khoản bằng ứng dụng ngân hàng'),
    T('t4', 2, 4, 'Phát hiện tiền vào, gửi thông báo giao dịch kèm khóa xác thực'),
    T('t5', 1, 5, 'Xác thực khóa, tìm mã đơn trong nội dung'),
    G('g1', 1, 5.8, 'Tìm thấy đơn?'),
    T('t6', 1, 7.6, 'Bỏ qua giao dịch, ghi cảnh báo', 1),
    G('g2', 1, 6.6, 'Đủ tiền?'),
    T('t7', 1, 7.6, 'Ghi đã thanh toán, tự duyệt đơn, ghi sổ thu, gửi email'),
    T('t8', 1, 7.6, 'Ghi khoản "Chờ hoàn tiền", ghi sổ thu', -1),
    T('t9', 0, 8.8, 'Xem kết quả thanh toán trên trang đơn hàng'),
    E(0, 9.6), E(1, 8.5, 1, 'e2')], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4'), ('t4', 't5'), ('t5', 'g1'),
    ('g1', 'g2', 'Có'), ('g1', 't6', 'Không'), ('g2', 't7', 'Có'), ('g2', 't8', 'Không'),
    ('t8', 't9', None, {'midstep': 8.2}), ('t7', 't9', None, {'midstep': 8.3}), ('t9', 'e'), ('t6', 'e2')])

# 05 ---------------------------------------------------------------- Trả lời chat trực tuyến
FLOWS['uc05'] = dict(title='Trả Lời Chat Trực Tuyến', lanes=['Nhân Viên CSKH', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở màn hình "Chat tư vấn"'),
    T('t2', 1, 2, 'Xác thực phiên đăng nhập, gửi danh sách phiên chat'),
    T('t3', 0, 3, 'Chọn một phiên chat'),
    T('t4', 1, 4, 'Đánh dấu đã đọc, hiển thị lịch sử hội thoại'),
    T('t5', 0, 5, 'Nhập nội dung trả lời và gửi'),
    G('g1', 1, 5.8, 'Còn kết nối?'),
    T('t6', 1, 6.8, 'Báo lỗi gửi tin, tự kết nối lại', 1),
    T('t7', 1, 6.8, 'Lưu tin nhắn vào phiên chat'),
    T('t8', 1, 7.8, 'Đẩy tin nhắn tới đúng khách hàng của phiên'),
    E(1, 8.6)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4'), ('t4', 't5'), ('t5', 'g1'),
    ('g1', 't7', 'Có'), ('g1', 't6', 'Không'), ('t6', 't5', None, HI), ('t7', 't8'), ('t8', 'e')])

# 06 ---------------------------------------------------------------- Bán hàng tại quầy
FLOWS['uc06'] = dict(title='Bán Hàng Tại Quầy', lanes=['Nhân Viên Bán Hàng', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở "Điểm bán hàng"'),
    T('t2', 1, 2, 'Hiển thị danh mục sản phẩm và giỏ tại quầy'),
    T('t3', 0, 3, 'Quét mã hoặc tìm sản phẩm, nhập số lượng'),
    G('g1', 1, 3.8, 'Đủ tồn kho?'),
    T('t4', 1, 4.8, 'Cảnh báo hết hàng, không thêm vào giỏ', 1),
    T('t5', 1, 4.8, 'Thêm vào giỏ, cập nhật tổng tiền'),
    T('t6', 0, 5.8, 'Nhập khách, chiết khấu, hình thức thanh toán, xác nhận thu tiền'),
    G('g2', 1, 6.6, 'Vượt hạn mức?'),
    T('t7', 1, 7.6, 'Từ chối tạo đơn', 1),
    T('t8', 1, 7.6, 'Tạo đơn tại quầy đã thanh toán, trừ kho, gán Serial'),
    T('t9', 1, 8.6, 'In phiếu thu / hóa đơn bán hàng'),
    E(1, 9.4)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 'g1'), ('g1', 't5', 'Có'), ('g1', 't4', 'Không'),
    ('t4', 't3', None, HI), ('t5', 't6'), ('t6', 'g2'), ('g2', 't8', 'Không'), ('g2', 't7', 'Có'),
    ('t7', 't6', None, HI), ('t8', 't9'), ('t9', 'e')])

# 07 ---------------------------------------------------------------- Xử lý và cập nhật đơn hàng
FLOWS['uc07'] = dict(title='Xử Lý Và Cập Nhật Đơn Hàng', lanes=['Nhân Viên Bán Hàng', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở danh sách đơn, lọc "Chờ xác nhận"'),
    T('t2', 1, 2, 'Hiển thị danh sách đơn theo bộ lọc'),
    T('t3', 0, 3, 'Xem chi tiết đơn, bấm "Xác nhận đơn"'),
    T('t4', 1, 4, 'Kiểm tra chuyển trạng thái hợp lệ, trừ tồn kho, gán Serial'),
    G('g1', 1, 4.8, 'Đủ tồn kho?'),
    T('t5', 1, 5.8, 'Báo tồn kho không đủ, giữ nguyên đơn', 1),
    T('t6', 1, 5.8, 'Ghi giá vốn, tích điểm, chuyển "Đã xác nhận"'),
    T('t7', 1, 6.8, 'Lưu lịch sử trạng thái, gửi email khách hàng'),
    E(1, 7.6), E(1, 6.8, 1, 'e2')], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4'), ('t4', 'g1'), ('g1', 't6', 'Có'),
    ('g1', 't5', 'Không'), ('t5', 'e2'), ('t6', 't7'), ('t7', 'e')])

# 08 ---------------------------------------------------------------- Lập RFQ và so sánh báo giá
FLOWS['uc08'] = dict(title='Lập Yêu Cầu Báo Giá Và So Sánh Báo Giá', lanes=['Nhân Viên Mua Hàng', HT, 'Nhà Cung Cấp'], nodes=[
    S(), T('t1', 0, 1, 'Tạo yêu cầu báo giá: sản phẩm, số lượng, các nhà cung cấp'),
    G('g0', 1, 1.8, 'Đủ thông tin?'),
    T('t2', 1, 2.8, 'Báo lỗi, không gửi', 1),
    T('t3', 1, 2.8, 'Tạo yêu cầu báo giá cho từng nhà cung cấp, gửi cổng NCC'),
    T('t4', 2, 3.8, 'Phản hồi đơn giá, thời gian giao hoặc từ chối'),
    T('t5', 1, 4.8, 'Hiển thị bảng so sánh đơn giá, thời gian giao'),
    T('t6', 0, 5.8, 'Chọn báo giá tốt nhất'),
    T('t7', 1, 6.8, 'Chốt báo giá, hủy các báo giá còn lại'),
    T('t8', 0, 7.8, 'Lập phiếu mua hàng trình Ban Giám đốc'),
    T('t9', 1, 8.8, 'Tạo phiếu mua hàng "Chờ BGĐ duyệt"'),
    E(1, 9.6)], edges=[
    ('s', 't1'), ('t1', 'g0'), ('g0', 't3', 'Có'), ('g0', 't2', 'Không'), ('t2', 't1', None, HI),
    ('t3', 't4'), ('t4', 't5'), ('t5', 't6'), ('t6', 't7'), ('t7', 't8'), ('t8', 't9'), ('t9', 'e')])

# 09 ---------------------------------------------------------------- Phản hồi yêu cầu báo giá
FLOWS['uc09'] = dict(title='Phản Hồi Yêu Cầu Báo Giá', lanes=['Nhà Cung Cấp', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở mục "Yêu cầu báo giá"'),
    T('t2', 1, 2, 'Hiển thị yêu cầu đang chờ phản hồi của nhà cung cấp'),
    T('t3', 0, 3, 'Chọn yêu cầu, xem sản phẩm và số lượng'),
    G('g1', 0, 3.8, 'Nhận báo giá?'),
    T('t4', 0, 4.8, 'Nhập đơn giá, thời gian giao từng mặt hàng, gửi', -1),
    T('t5', 0, 4.8, 'Chọn "Từ chối", nhập lý do'),
    T('t6', 1, 6, 'Lưu đơn giá, chuyển "Đã báo giá", ghi lịch sử'),
    T('t7', 1, 6, 'Chuyển "Đã hủy" kèm lý do', 1),
    E(1, 7, 0.5)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 'g1'), ('g1', 't4', 'Có'), ('g1', 't5', 'Không'),
    ('t4', 't6', None, {'midstep': 5.45}), ('t5', 't7', None, {'midstep': 5.35}), ('t6', 'e'), ('t7', 'e')])

# 10 ---------------------------------------------------------------- Duyệt đơn mua hàng
FLOWS['uc10'] = dict(title='Duyệt Đơn Mua Hàng', lanes=['Ban Giám Đốc', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở "Trung tâm phê duyệt" → Đơn mua hàng'),
    T('t2', 1, 2, 'Hiển thị phiếu mua hàng chờ duyệt'),
    T('t3', 0, 3, 'Xem nhà cung cấp, đơn giá, báo giá gốc'),
    G('g1', 0, 3.8, 'Quyết định?'),
    T('t4', 0, 4.8, 'Nhập lý do từ chối', 1),
    G('g2', 1, 4.8, 'Có quyền duyệt?'),
    T('t5', 1, 5.8, 'Từ chối thao tác', 1),
    T('t6', 1, 5.8, 'Chuyển sang "Đơn mua hàng", ghi lịch sử, nhật ký, gửi cổng NCC'),
    T('t7', 1, 5.8, 'Chuyển phiếu sang "Đã hủy" kèm lý do', 2),
    E(1, 6.8, 1)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 'g1'), ('g1', 'g2', 'Phê duyệt'), ('g1', 't4', 'Từ chối'),
    ('g2', 't6', 'Có'), ('g2', 't5', 'Không'), ('t4', 't7', None, {'midstep': 5.2}),
    ('t5', 'e'), ('t6', 'e'), ('t7', 'e')])

# 11 ---------------------------------------------------------------- Duyệt bảng lương toàn công ty
FLOWS['uc11'] = dict(title='Duyệt Bảng Lương Toàn Công Ty', lanes=['Ban Giám Đốc', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở "Trung tâm phê duyệt" → Bảng lương'),
    T('t2', 1, 2, 'Hiển thị kỳ lương chờ duyệt, số nhân viên, tổng thực lĩnh'),
    T('t3', 0, 3, 'Xem chi tiết bảng lương từng nhân viên'),
    G('g1', 0, 3.8, 'Quyết định?'),
    T('t5', 0, 4.8, 'Nhập lý do trả về (bắt buộc)', 1),
    T('t4', 1, 5, 'Kiểm tra quyền, chuyển "Đã duyệt – chờ giải ngân", ghi người duyệt'),
    T('t6', 1, 6, 'Chuyển "Bị trả về", hiển thị lý do cho Nhân sự', 1),
    E(1, 7, 0.5)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 'g1'), ('g1', 't4', 'Phê duyệt'), ('g1', 't5', 'Trả về'),
    ('t5', 't6', None, {'midstep': 5.6}), ('t4', 'e'), ('t6', 'e')])

# 12 ---------------------------------------------------------------- Kiểm tra chất lượng hàng nhập
FLOWS['uc12'] = dict(title='Kiểm Tra Chất Lượng Hàng Nhập', lanes=['Nhân Viên Kiểm Định', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở danh sách đơn mua chờ kiểm định'),
    T('t2', 1, 2, 'Hiển thị đơn và hàng cần kiểm định'),
    T('t3', 0, 3, 'Đối chiếu hàng thực nhận, ghi tỷ lệ lấy mẫu'),
    G('g1', 0, 3.8, 'Kết luận?'),
    T('t5', 0, 4.8, 'Nhập số lượng đạt và không đạt', 1),
    T('t4', 1, 5.8, 'Chuyển "Đạt kiểm định"', 0),
    T('t6', 1, 5.8, 'Chuyển "Đạt một phần", lưu tỷ lệ đạt', 1),
    T('t7', 1, 5.8, 'Chuyển "Không đạt", hủy phiếu nhập kho', 2),
    T('t8', 1, 6.8, 'Lưu biên bản kiểm định, báo Kho nhập kho', 1),
    E(1, 7.6, 1)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 'g1'),
    ('g1', 't4', 'Toàn bộ', {'exit': 'fwd', 'midstep': 5.3}), ('g1', 't5', 'Một phần'),
    ('t5', 't6', None, {'midstep': 5.2}), ('g1', 't7', 'Từ chối'),
    ('t4', 't8'), ('t6', 't8'), ('t7', 't8'), ('t8', 'e')])

# 13 ---------------------------------------------------------------- Thẩm định hàng hoàn trả
FLOWS['uc13'] = dict(title='Thẩm Định Hàng Hoàn Trả', lanes=['Nhân Viên Kiểm Định', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở yêu cầu đổi trả "Đã nhận hàng tại kho"'),
    T('t2', 1, 2, 'Hiển thị thông tin yêu cầu, lý do khách khai báo'),
    T('t3', 0, 3, 'Kiểm tra tem, ngoại quan, hoạt động, đối chiếu Serial'),
    G('g1', 0, 3.8, 'Đạt?'),
    T('t6', 0, 4.8, 'Ghi lý do không đạt (mất tem, lỗi người dùng)', 1),
    T('t4', 1, 5, 'Chuyển yêu cầu "Đạt thẩm định", lưu dạng lỗi, ảnh minh chứng'),
    T('t5', 1, 6, 'Báo Thủ kho nhập lại kệ, Kế toán hoàn tiền hoặc đổi mới'),
    T('t7', 1, 6, 'Chuyển "Từ chối", đơn về "Đã giao" để giao trả khách', 1),
    E(1, 7, 0.5)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 'g1'), ('g1', 't4', 'Đạt'), ('g1', 't6', 'Không đạt'),
    ('t4', 't5'), ('t6', 't7', None, {'midstep': 5.4}), ('t5', 'e'), ('t7', 'e')])

# 14 ---------------------------------------------------------------- Nghiệm thu hàng nhập kho
FLOWS['uc14'] = dict(title='Nghiệm Thu Hàng Nhập Kho', lanes=['Nhân Viên Kho', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở phiếu nhập kho của đơn mua hàng'),
    T('t2', 1, 2, 'Hiển thị số lượng được nhập theo kết quả kiểm định'),
    T('t3', 0, 3, 'Quét Serial từng đơn vị, bấm "Duyệt phiếu nhập"'),
    G('g1', 1, 3.8, 'Serial hợp lệ?'),
    T('t4', 1, 4.8, 'Từ chối duyệt, báo Serial thiếu hoặc trùng', 1),
    T('t5', 1, 4.8, 'Tạo Serial, cộng tồn kho, ghi phiếu nhập'),
    T('t6', 1, 5.8, 'Tính lại giá vốn bình quân, đơn mua chuyển "Đã nhận hàng"'),
    E(1, 6.6)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 'g1'), ('g1', 't5', 'Có'), ('g1', 't4', 'Không'),
    ('t4', 't3', None, HI), ('t5', 't6'), ('t6', 'e')])

# 15 ---------------------------------------------------------------- Xác nhận xuất kho và phân công giao hàng
FLOWS['uc15'] = dict(title='Xác Nhận Xuất Kho Và Phân Công Giao Hàng', lanes=['Nhân Viên Kho', HT, 'Nhân Viên Giao Hàng'], nodes=[
    S(), T('t1', 0, 1, 'Mở "Lệnh giao hàng"'),
    T('t2', 1, 2, 'Hiển thị đơn sẵn sàng xuất kho, đánh dấu đơn còn lắp ráp'),
    T('t3', 0, 3, 'Chọn đơn, bấm "Xác nhận xuất kho"'),
    T('t4', 1, 4, 'Mở khung phân công, gợi ý nhân viên giao hàng theo khu vực'),
    T('t5', 0, 5, 'Chọn nhân viên giao hàng, xác nhận'),
    G('g1', 1, 5.8, 'Shipper hợp lệ?'),
    T('t6', 1, 6.8, 'Từ chối phân công', 1),
    T('t7', 1, 6.8, 'Gán nhân viên, đưa đơn vào mục "Chờ nhận"'),
    G('g2', 2, 7.8, 'Nhận chuyến?'),
    T('t8', 1, 8.8, 'Gỡ phân công, trả đơn về danh sách chờ', 0),
    T('t9', 2, 8.8, 'Bắt đầu giao (use case Giao hàng và thu tiền hộ)'),
    E(2, 9.8)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4'), ('t4', 't5'), ('t5', 'g1'),
    ('g1', 't7', 'Có'), ('g1', 't6', 'Không'), ('t6', 't5', None, HI), ('t7', 'g2', None, {'enter': 'back'}),
    ('g2', 't9', 'Có'), ('g2', 't8', 'Không'), ('t9', 'e'), ('t8', 'e')])

# 16 ---------------------------------------------------------------- Cập nhật tiến độ lắp ráp
FLOWS['uc16'] = dict(title='Cập Nhật Tiến Độ Lắp Ráp', lanes=['Nhân Viên Lắp Ráp', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở lệnh lắp ráp'),
    T('t2', 1, 2, 'Hiển thị linh kiện và danh mục kiểm thử 4 mục'),
    T('t3', 0, 3, 'Lắp phần cứng, nhập Serial từng linh kiện'),
    T('t4', 0, 4, 'Đánh dấu BIOS/POST, cài hệ điều hành, chạy tải nặng, niêm phong'),
    T('t5', 1, 5, 'Lưu Serial và tiến độ kiểm thử'),
    T('t6', 0, 6, 'Bấm "Nghiệm thu"'),
    G('g1', 1, 6.8, 'Đủ kiểm thử, Serial?'),
    T('t7', 1, 7.8, 'Từ chối, báo rõ phần còn thiếu', 1),
    T('t8', 1, 7.8, 'Lệnh chuyển "Hoàn tất", đơn chuyển "Sẵn sàng giao"'),
    T('t9', 1, 8.8, 'Gửi email thông báo cho khách hàng'),
    E(1, 9.6)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4'), ('t4', 't5'), ('t5', 't6'), ('t6', 'g1'),
    ('g1', 't8', 'Có'), ('g1', 't7', 'Không'), ('t7', 't4', None, HI), ('t8', 't9'), ('t9', 'e')])

# 17 ---------------------------------------------------------------- Giao hàng và thu tiền hộ
FLOWS['uc17'] = dict(title='Giao Hàng Và Thu Tiền Hộ', lanes=['Nhân Viên Giao Hàng', HT], nodes=[
    S(), T('t1', 0, 1, 'Bấm "Nhận chuyến"'),
    T('t2', 1, 2, 'Chuyển "Đang giao", ghi vị trí để khách theo dõi'),
    T('t3', 0, 3, 'Đến địa chỉ giao hàng'),
    G('g1', 0, 3.8, 'Kết quả giao?'),
    T('t8', 0, 4.8, 'Chụp ảnh xác nhận, thu tiền mặt hoặc nhập mã giao dịch'),
    T('t4', 0, 4.8, 'Ghi lý do vắng mặt', 1),
    T('t6', 0, 4.8, 'Chụp ảnh kiện hàng', 2),
    T('t9', 1, 6, 'Chuyển "Đã giao", ghi khoản thu chờ đối soát, gửi email'),
    T('t5', 1, 6, 'Chuyển "Giao không thành công", chờ giao lại', 1),
    T('t7', 1, 6, 'Chuyển "Đang hoàn về kho", hoàn tồn kho', 2),
    E(1, 7, 1)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 'g1'),
    ('g1', 't8', 'Thành công'), ('g1', 't4', 'Vắng mặt'), ('g1', 't6', 'Từ chối'),
    ('t8', 't9', None, {'midstep': 5.5}), ('t4', 't5', None, {'midstep': 5.4}), ('t6', 't7', None, {'midstep': 5.3}),
    ('t9', 'e'), ('t5', 'e'), ('t7', 'e')])

# 18 ---------------------------------------------------------------- Thanh toán nhà cung cấp
FLOWS['uc18'] = dict(title='Thanh Toán Nhà Cung Cấp', lanes=['Nhân Viên Kế Toán', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở "Thanh toán đơn mua hàng", chọn đơn đã nhập kho'),
    T('t2', 1, 2, 'Hiển thị đơn mua và số lượng đã nghiệm thu'),
    T('t3', 0, 3, 'Chọn "Lập hóa đơn công nợ"'),
    T('t4', 1, 4, 'Đối chiếu đơn mua – phiếu nhập – hóa đơn, tạo hóa đơn theo số lượng đạt'),
    T('t5', 0, 5, 'Ghi nhận một đợt thanh toán (số tiền, hình thức)'),
    G('g1', 1, 5.8, 'Số tiền hợp lệ?'),
    T('t6', 1, 6.8, 'Từ chối, yêu cầu nhập lại', 1),
    T('t7', 1, 6.8, 'Ghi khoản thanh toán, bút toán chi, cập nhật công nợ'),
    G('g2', 1, 7.6, 'Còn công nợ?'),
    T('t8', 1, 8.6, 'Hóa đơn "Đã thanh toán"; nhập đủ, trả đủ thì đơn mua "Hoàn tất"'),
    E(1, 9.4)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4'), ('t4', 't5'), ('t5', 'g1'),
    ('g1', 't7', 'Có'), ('g1', 't6', 'Không'), ('t6', 't5', None, HI), ('t7', 'g2'),
    ('g2', 't8', 'Không'), ('g2', 't5', 'Còn'), ('t8', 'e')])

# 19 ---------------------------------------------------------------- Đối soát tiền thu hộ
FLOWS['uc19'] = dict(title='Đối Soát Tiền Thu Hộ', lanes=['Nhân Viên Kế Toán', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở "Đối soát tiền thu hộ"'),
    T('t2', 1, 2, 'Tổng hợp tiền mặt theo từng nhân viên giao hàng'),
    T('t3', 0, 3, 'Chọn nhân viên giao hàng, kiểm đếm tiền mặt'),
    G('g1', 0, 3.8, 'Số tiền khớp?'),
    T('t4', 0, 4.8, 'Đối chiếu lại với nhân viên giao hàng', 1),
    T('t5', 0, 4.8, 'Bấm "Xác nhận đã thu"'),
    T('t6', 1, 5.8, 'Đánh dấu các khoản đã đối soát, ghi người và thời điểm'),
    T('t7', 1, 6.8, 'Ghi bút toán thu tiền mặt, nhật ký, báo kết quả'),
    E(1, 7.6)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 'g1'), ('g1', 't5', 'Khớp'), ('g1', 't4', 'Không khớp'),
    ('t4', 't3', None, HI), ('t5', 't6'), ('t6', 't7'), ('t7', 'e')])

# 20 ---------------------------------------------------------------- Tính lương và trình duyệt
FLOWS['uc20'] = dict(title='Tính Lương Và Trình Duyệt Bảng Lương', lanes=['Nhân Viên Nhân Sự', HT, 'Ban Giám Đốc'], nodes=[
    S(), T('t1', 0, 1, 'Chọn kỳ lương, bấm "Tính lương kỳ này"'),
    G('g1', 1, 1.8, 'Còn phiếu chưa trình?'),
    T('t2', 1, 2.8, 'Từ chối tính lại', 1),
    T('t3', 1, 2.8, 'Phân loại ngày công, nghỉ phép, ngày lễ'),
    T('t4', 1, 3.8, 'Tính công, phụ cấp, tăng ca, hoa hồng, bảo hiểm, thuế TNCN'),
    T('t5', 1, 4.8, 'Lưu phiếu "Nháp", hiển thị tổng quỹ lương'),
    T('t6', 0, 5.8, 'Rà soát từng phiếu lương'),
    G('g2', 0, 6.6, 'Cần điều chỉnh?'),
    T('t7', 0, 7.6, 'Nhập thưởng hoặc khấu trừ kèm lý do', 1),
    T('t8', 1, 8.6, 'Tính lại thuế và thực lĩnh', 1),
    T('t9', 0, 7.6, 'Bấm "Trình Ban Giám đốc duyệt"'),
    T('t10', 1, 9.6, 'Chuyển phiếu "Nháp" sang "Chờ BGĐ duyệt"'),
    T('t11', 2, 10.6, 'Nhận bảng lương chờ duyệt'),
    E(2, 11.4), E(1, 3.6, 1, 'e2')], edges=[
    ('s', 't1'), ('t1', 'g1'), ('g1', 't3', 'Có'), ('g1', 't2', 'Không'), ('t2', 'e2'),
    ('t3', 't4'), ('t4', 't5'), ('t5', 't6'), ('t6', 'g2'), ('g2', 't7', 'Có'), ('g2', 't9', 'Không'),
    ('t7', 't8'), ('t8', 't6', None, HI), ('t9', 't10'), ('t10', 't11'), ('t11', 'e')])

# 21 ---------------------------------------------------------------- Đăng ký khuôn mặt
FLOWS['uc21'] = dict(title='Đăng Ký Khuôn Mặt', lanes=['Nhân Viên', HT], nodes=[
    S(), T('t1', 0, 1, 'Chọn "Chấm công khuôn mặt" (chưa có mẫu)'),
    T('t2', 1, 2, 'Tải mô hình nhận diện, mở camera'),
    T('t3', 0, 3, 'Nhìn thẳng, quay trái, quay phải, nhìn thẳng lại'),
    G('g1', 1, 3.8, 'Là người thật?'),
    T('t4', 1, 4.8, 'Nhắc điều chỉnh, làm lại', 1),
    T('t5', 1, 4.8, 'Lấy 5 mẫu, tính vector trung bình, gửi máy chủ'),
    G('g2', 1, 5.6, 'Đã có / trùng mẫu?'),
    T('t6', 1, 6.6, 'Từ chối, ghi nhật ký, hướng dẫn liên hệ phòng nhân sự', 1),
    T('t7', 1, 6.6, 'Lưu vector và ảnh mẫu, ghi nhật ký, báo thành công'),
    E(1, 7.6, 0.5)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 'g1'), ('g1', 't5', 'Có'), ('g1', 't4', 'Không'),
    ('t4', 't3', None, HI), ('t5', 'g2'), ('g2', 't7', 'Không'), ('g2', 't6', 'Có'), ('t6', 'e'), ('t7', 'e')])

# 22 ---------------------------------------------------------------- Chấm công bằng khuôn mặt
FLOWS['uc22'] = dict(title='Chấm Công Bằng Khuôn Mặt', lanes=['Nhân Viên', HT], nodes=[
    S(), T('t1', 0, 1, 'Chọn "Chấm công khuôn mặt"'),
    T('t2', 1, 2, 'Hiển thị ca hôm nay, lần chấm VÀO CA / RA CA, mở camera'),
    T('t3', 0, 3, 'Thực hiện thử thách quay đầu'),
    T('t4', 1, 4, 'Xác nhận người thật, trích vector, chụp ảnh, gửi máy chủ'),
    G('g1', 1, 4.8, 'Khuôn mặt khớp?'),
    T('t5', 1, 6.6, 'Từ chối, ghi nhật ký lần thử thất bại', 1),
    G('g2', 1, 5.6, 'Đã chấm vào ca?'),
    T('t6', 1, 6.6, 'Ghi giờ vào ca, tính phút đi muộn'),
    T('t7', 1, 6.6, 'Ghi giờ ra ca, tính về sớm, giờ làm, tăng ca', -1),
    T('t8', 1, 7.6, 'Hiển thị kết quả chấm công', -0.5),
    E(1, 8.4, -0.5)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4'), ('t4', 'g1'), ('g1', 'g2', 'Có'), ('g1', 't5', 'Không'),
    ('t5', 't3', None, HI), ('g2', 't6', 'Chưa'), ('g2', 't7', 'Rồi'), ('t6', 't8'), ('t7', 't8'), ('t8', 'e')])

# 23 ---------------------------------------------------------------- Đăng nhập
FLOWS['uc23'] = dict(title='Đăng Nhập', lanes=['Người Dùng', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở trang "Đăng nhập"'),
    T('t2', 1, 2, 'Hiển thị form đăng nhập'),
    T('t3', 0, 3, 'Nhập tên đăng nhập hoặc email, mật khẩu, bấm "Đăng nhập"'),
    T('t4', 1, 4, 'Gửi đồng thời yêu cầu đăng nhập nội bộ và khách hàng'),
    T('t5', 1, 5, 'So khớp mật khẩu đã băm, kiểm tra trạng thái tài khoản'),
    G('g1', 1, 5.8, 'Hợp lệ?'),
    T('t6', 1, 6.8, 'Báo lỗi: sai thông tin, ngừng hoạt động hoặc thử quá nhiều lần', 1),
    T('t7', 1, 6.8, 'Tạo JWT, đặt cookie phiên, ghi nhật ký'),
    T('t8', 1, 7.8, 'Chuyển tới trang theo vai trò'),
    E(1, 8.6)], edges=[
    ('s', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4'), ('t4', 't5'), ('t5', 'g1'),
    ('g1', 't7', 'Có'), ('g1', 't6', 'Không'), ('t6', 't3', None, HI), ('t7', 't8'), ('t8', 'e')])

# 24 ---------------------------------------------------------------- Quản trị tài khoản, phân quyền và nhật ký
FLOWS['uc24'] = dict(title='Quản Trị Tài Khoản, Phân Quyền Và Nhật Ký', lanes=['Quản Trị Viên', HT], nodes=[
    S(), T('t1', 0, 1, 'Mở "Quản trị hệ thống"'),
    G('g1', 0, 1.8, 'Chức năng?'),
    T('t2', 0, 2.8, 'Bật/tắt quyền trong Ma trận phân quyền, lưu'),
    T('t3', 0, 2.8, 'Khóa, mở khóa hoặc đặt lại mật khẩu tài khoản', 1),
    T('t4', 0, 2.8, 'Lọc nhật ký theo người dùng, hành động, thời gian', 2),
    G('g2', 1, 3.8, 'Hợp lệ?'),
    T('t6', 1, 4.8, 'Lưu, áp dụng ngay, ghi nhật ký'),
    T('t5', 1, 4.8, 'Từ chối lưu', 1),
    T('t7', 1, 4.8, 'Cập nhật trạng thái tài khoản, ghi nhật ký', 2),
    T('t8', 1, 4.8, 'Hiển thị kết quả tra cứu', 3),
    E(1, 5.8, 1.5)], edges=[
    ('s', 't1'), ('t1', 'g1'), ('g1', 't2', 'Phân quyền'), ('g1', 't3', 'Tài khoản'), ('g1', 't4', 'Nhật ký'),
    ('t2', 'g2'), ('t3', 't7', None, {'midstep': 3.6}), ('t4', 't8', None, {'midstep': 3.5}),
    ('g2', 't6', 'Có'), ('g2', 't5', 'Không'), ('t6', 'e'), ('t5', 'e'), ('t7', 'e'), ('t8', 'e')])


if __name__ == '__main__':
    import sys
    here = os.path.dirname(os.path.abspath(__file__))
    only = sys.argv[1:]
    for k, f in FLOWS.items():
        if only and k not in only:
            continue
        b = render(f, 'bpmn', os.path.join(here, f'{k}_bpmn.png'))
        a = render(f, 'act', os.path.join(here, f'{k}_act.png'))
        print(k, 'bpmn', b, 'act', a)
