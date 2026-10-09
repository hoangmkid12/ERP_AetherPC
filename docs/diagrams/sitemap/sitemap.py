# -*- coding: utf-8 -*-
"""Sơ đồ site map (mục 5.2.1 báo cáo KLTN) theo kiểu cây của mẫu tham khảo:
gốc hình elip, trang vào (Trang chủ / Đăng nhập) ngay dưới, các mục menu cấp 1 xếp ngang trên một
thanh nối, trang con liệt kê dọc, thụt phải theo cấp và nối bằng đường gấp khúc; mỗi cấp một màu.

Nội dung lấy từ route thật (frontend/src/App.jsx), menu đầu trang cửa hàng (Header.jsx) và menu
phân hệ quản trị (Sidebar.jsx). Chạy: python sitemap.py → sitemap_khachhang.png, sitemap_noibo.png
"""
from PIL import Image, ImageDraw, ImageFont

S = 2                                   # hệ số phóng để ảnh nét khi chèn vào Word
FONT = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 15 * S)
FONT_B = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 16 * S)
INK = (70, 70, 70)
LINE = (90, 90, 90)
ROOT = (251, 196, 206)
ENTRY = (253, 205, 180)
LEVEL = [(214, 214, 247), (190, 226, 247), (204, 244, 213), (255, 244, 200), (251, 211, 230)]
BOX_H = 30 * S
PAD_X = 12 * S
ROW_GAP = 12 * S                        # khoảng cách dọc giữa hai trang con
INDENT = 26 * S                         # thụt phải mỗi cấp
COL_GAP = 22 * S                        # khoảng cách giữa hai cột menu cấp 1


def tw(t, f=FONT):
    return f.getbbox(t)[2]


def box_w(t):
    return tw(t) + 2 * PAD_X


def subtree_size(node, depth):
    """(rộng, cao) của một mục cấp 1 cùng toàn bộ trang con xếp dọc bên dưới."""
    label, kids = node
    w, h = box_w(label), BOX_H
    for k in kids:
        kw, kh = subtree_size(k, depth + 1)
        w = max(w, INDENT + kw)
        h += ROW_GAP + kh
    return w, h


def pill(d, x, y, label, color, font=FONT, w=None):
    w = w or box_w(label)
    d.rounded_rectangle([x, y, x + w, y + BOX_H], radius=BOX_H // 2 if w < 0 else 6 * S, fill=color)
    d.text((x + (w - tw(label, font)) / 2, y + (BOX_H - font.size) / 2 - 1 * S), label, font=font, fill=INK)
    return w


def draw_subtree(d, node, x, y, depth):
    """Vẽ một nút tại (x, y); trang con nằm dưới, thụt phải INDENT, nối gấp khúc từ cạnh trái nút cha."""
    label, kids = node
    pill(d, x, y, label, LEVEL[min(depth, len(LEVEL) - 1)])
    cy = y + BOX_H
    stem_x = x + 10 * S
    last_mid = None
    for k in kids:
        cy += ROW_GAP
        mid = cy + BOX_H / 2
        d.line([(stem_x, mid), (x + INDENT, mid)], fill=LINE, width=S)
        last_mid = mid
        _, kh = subtree_size(k, depth + 1)
        draw_subtree(d, k, x + INDENT, cy, depth + 1)
        cy += kh
    if last_mid is not None:
        d.line([(stem_x, y + BOX_H), (stem_x, last_mid)], fill=LINE, width=S)


def render(root_label, entry_label, rows, out_path):
    """rows: danh sách hàng, mỗi hàng là danh sách mục cấp 1 (label, [trang con...])."""
    margin = 30 * S
    row_sizes = [[subtree_size(n, 0) for n in row] for row in rows]
    row_w = [sum(w for w, _ in sz) + COL_GAP * (len(sz) - 1) for sz in row_sizes]
    width = int(max(row_w) + 2 * margin)
    top_block = margin + BOX_H + 26 * S + BOX_H + 30 * S        # gốc + trang vào + thanh nối
    heights = [max(h for _, h in sz) for sz in row_sizes]
    height = int(top_block + sum(heights) + 46 * S * (len(rows) - 1) + margin)

    img = Image.new('RGB', (width, height), 'white')
    d = ImageDraw.Draw(img)
    cx = width / 2

    # gốc (elip) và trang vào
    rw = box_w(root_label) + 40 * S
    d.ellipse([cx - rw / 2, margin, cx + rw / 2, margin + BOX_H], fill=ROOT)
    d.text((cx - tw(root_label, FONT_B) / 2, margin + (BOX_H - FONT_B.size) / 2 - S), root_label, font=FONT_B, fill=INK)
    ey = margin + BOX_H + 26 * S
    d.line([(cx, margin + BOX_H), (cx, ey)], fill=LINE, width=S)
    ew = box_w(entry_label) + 30 * S
    pill(d, cx - ew / 2, ey, entry_label, ENTRY, w=ew)
    trunk_top = ey + BOX_H

    y = top_block
    for ri, row in enumerate(rows):
        x = (width - row_w[ri]) / 2
        bus_y = y - 16 * S
        centers = []
        for node, (w, _) in zip(row, row_sizes[ri]):
            bw = box_w(node[0])
            centers.append(x + bw / 2)
            d.line([(x + bw / 2, bus_y), (x + bw / 2, y)], fill=LINE, width=S)
            draw_subtree(d, node, x, y, 0)
            x += w + COL_GAP
        # hàng 1 nối thẳng lên trang vào; hàng sau nối với thanh của hàng 1 bằng đường chạy sát lề trái
        side_x = margin / 2
        lo = min(centers + [cx] + ([side_x] if len(rows) > 1 else []))
        d.line([(lo, bus_y), (max(centers + [cx]), bus_y)], fill=LINE, width=S)
        if ri == 0:
            d.line([(cx, trunk_top), (cx, bus_y)], fill=LINE, width=S)
            first_bus = bus_y
        else:
            d.line([(side_x, first_bus), (side_x, bus_y)], fill=LINE, width=S)
        y += heights[ri] + 46 * S
    img.save(out_path, dpi=(300, 300))
    return img.size


# ───────────────────────── Phía khách hàng (cửa hàng trực tuyến) ─────────────────────────
STOREFRONT = [[
    ('Sản phẩm', [('Danh mục sản phẩm', [('Chi tiết sản phẩm', [('Đánh giá sản phẩm', [])])]),
                  ('Tìm kiếm sản phẩm', [])]),
    ('Tự cấu hình PC', [('Chọn linh kiện', []), ('Gợi ý cấu hình AI', []),
                        ('Kiểm tra tương thích', [])]),
    ('Khuyến mãi', [('Flash Sale', []), ('Mã giảm giá', [])]),
    ('Tin tức', [('Danh sách bài viết', [('Chi tiết bài viết', [])])]),
    ('Giới thiệu', [('Tuyển dụng', [])]),
    ('Giỏ hàng', [('Đặt hàng', [('Thanh toán khi nhận (COD)', []),
                                ('Chuyển khoản QR (SePay)', [])])]),
    ('Theo dõi đơn hàng', [('Lộ trình giao hàng', [])]),
    ('Tài khoản', [('Đăng nhập', []), ('Đăng ký', []),
                   ('Trang cá nhân', [
                       ('Hồ sơ & sổ địa chỉ', []),
                       ('Đơn hàng của tôi', [('Hủy đơn', []), ('Xác nhận đã nhận', []),
                                             ('Yêu cầu đổi trả', []), ('Gửi khiếu nại', [])]),
                       ('Hạng thành viên', []),
                       ('Chat tư vấn', []),
                   ]),
                   ('Đăng xuất', [])]),
]]

# ───────────────────────── Phía nội bộ (trang quản trị + cổng nhà cung cấp) ─────────────────────────
ADMIN_ROW1 = [
    ('Tổng quan điều hành', [('Tổng quan điều hành', []), ('Trung tâm phê duyệt', []),
                             ('Tài chính & lãi lỗ', []), ('Năng suất & KPI', []),
                             ('Chuỗi cung ứng & kho', [])]),
    ('Bán hàng', [('Tổng quan bán hàng', []), ('Bán hàng tại quầy (POS)', []),
                  ('Quản lý đơn hàng', []), ('Khách hàng (CRM)', []), ('Danh mục sản phẩm', []),
                  ('Bảng giá & khuyến mãi', []), ('Báo cáo doanh thu', [])]),
    ('Kho', [('Tổng quan tồn kho', []), ('Đơn chờ hàng', []), ('Phiếu nhập kho', []),
             ('Lệnh giao hàng', []), ('Nhập trực tiếp', []), ('Bổ sung hàng (RFQ)', []),
             ('Hàng lỗi & trả về', []), ('Danh sách sản phẩm', []), ('Lịch sử điều chuyển', []),
             ('Kho hàng & vị trí kệ', []), ('Danh mục sản phẩm', [])]),
    ('Mua hàng', [('Tổng quan mua hàng', []), ('Yêu cầu mua hàng', []),
                  ('Yêu cầu báo giá (RFQ)', []), ('Đơn mua hàng (PO)', []), ('Nhà cung cấp', []),
                  ('Sản phẩm & bảng giá', []), ('Báo cáo & phân tích', [])]),
    ('Kiểm định', [('Tổng quan kiểm định', []), ('Kiểm định hàng nhập', []),
                   ('Thẩm định đổi trả', []), ('Nhật ký & biên bản', []),
                   ('Báo cáo & đánh giá NCC', [])]),
    ('Lắp ráp', [('Tổng quan lắp ráp', []), ('Lệnh lắp ráp', []),
                 ('Kiểm định xuất xưởng', []), ('Báo cáo hiệu suất', [])]),
    ('Giao vận', [('Tổng quan giao vận', []), ('Đơn chờ nhận giao', []),
                  ('Đang giao & minh chứng', []), ('Thu hồi đổi trả', []),
                  ('Lịch sử & bảng kê COD', [])]),
]
ADMIN_ROW2 = [
    ('Kế toán', [('Tổng quan tài chính', []), ('Sổ cái dòng tiền', []),
                 ('Thanh toán đơn PO', []), ('Đối soát COD shipper', []),
                 ('Chi trả bảng lương', []), ('Hoàn tiền đổi trả', []),
                 ('Hoàn tiền chuyển khoản', []), ('Báo cáo lãi lỗ & VAT', [])]),
    ('Nhân sự', [('Tổng quan nhân sự', []), ('Chấm công hàng ngày', []), ('Bảng công tháng', []),
                 ('Hồ sơ nhân viên', []), ('Quản lý nghỉ phép', []),
                 ('Tính lương & trình duyệt', []), ('Cấu hình công & lương', [])]),
    ('Chăm sóc khách hàng', [('Tổng quan CSKH', []), ('Xử lý khiếu nại', []),
                             ('Chat tư vấn trực tuyến', []), ('Tiếp nhận đổi trả', []),
                             ('Đánh giá & CSAT', [])]),
    ('Hệ thống', [('Tổng quan quản trị', []), ('Tài khoản & người dùng', []),
                  ('Tài khoản doanh nghiệp', []), ('Ma trận phân quyền', []),
                  ('Cơ sở tri thức & SOP', []), ('Huấn luyện AI', []), ('Nhật ký kiểm toán', []),
                  ('Cấu hình & sao lưu', [])]),
    ('Thông tin cá nhân', [('Chấm công khuôn mặt', []), ('Lịch sử chấm công', []),
                           ('Nghỉ phép', []), ('Phiếu lương', []), ('Hồ sơ cá nhân', []),
                           ('Tài liệu nội bộ', [])]),
    ('Cổng nhà cung cấp', [('Yêu cầu báo giá', [('Gửi báo giá', [])]),
                           ('Đơn mua hàng', [('Xác nhận đơn', []), ('Theo dõi kiểm định', [])])]),
]

if __name__ == '__main__':
    print(render('AETHERPC', 'Trang chủ', STOREFRONT, 'sitemap_khachhang.png'))
    print(render('AETHERPC ERP', 'Đăng nhập', [ADMIN_ROW1, ADMIN_ROW2], 'sitemap_noibo.png'))
