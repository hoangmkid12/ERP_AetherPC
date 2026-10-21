# -*- coding: utf-8 -*-
"""Sơ đồ use case tổng quát (Hình 3.29) - 19 tác nhân, 55 use case theo Bảng 3.22 và Bảng 3.23.

Chạy:  python usecase_tongquat.py   => usecase_tongquat.png cùng thư mục.
Bố cục: tác nhân bên ngoài, bán hàng, mua hàng, kiểm định ở bên trái; kho, lắp ráp, giao hàng,
kế toán, nhân sự, quản lý ở bên phải; tác nhân Nhân viên ở dưới cùng, nhận quan hệ kế thừa từ các
vai trò nội bộ qua hai đường gom ở hai mép hình.
"""
import os
from PIL import Image, ImageDraw, ImageFont

FONT = 'C:/Windows/Fonts/arial.ttf'
FONT_B = 'C:/Windows/Fonts/arialbd.ttf'
FS = 41
f = ImageFont.truetype(FONT, FS)
f_act = ImageFont.truetype(FONT, FS)
f_lab = ImageFont.truetype(FONT, FS - 8)
f_title = ImageFont.truetype(FONT_B, FS + 6)
INK = (20, 20, 20)
LINE = 3

W = 3300
BX0, BX1 = 520, W - 520                  # ranh giới hệ thống
XL, XR = 1150, W - 1150                  # tâm hai cột use case
UW, UH = 640, 106                        # kích thước ellipse
AXL, AXR = 255, W - 255                  # cột tác nhân
BUSL, BUSR = 40, W - 40                  # đường gom kế thừa về Nhân viên
ROW, GAP = 116, 42
TOP = 230

# ---------------------------------------------------------------- dữ liệu
# (khóa tác nhân, tên hiển thị, nội bộ?)  - nhóm use case theo thứ tự từ trên xuống
LEFT = [
    ('kvl', 'Khách Vãng Lai', False, ['Xem và tìm sản phẩm', 'Đăng ký tài khoản', 'Tự cấu hình máy tính',
                                      'Chat hỗ trợ trực tuyến']),
    ('kh', 'Khách Hàng Thành Viên', False, ['Sửa thông tin đơn hàng chờ xác nhận', 'Theo dõi đơn hàng',
                                            'Đánh giá sản phẩm', 'Quản lý hồ sơ và sổ địa chỉ',
                                            'Gửi khiếu nại / yêu cầu đổi trả', 'Đặt hàng',
                                            'Chọn phương thức và xác nhận thanh toán']),
    ('sepay', '«system»\nCổng Thanh Toán SePay', False, []),
    ('cskh', 'Nhân Viên Chăm Sóc\nKhách Hàng', True, ['Trả lời chat trực tuyến', 'Xử lý khiếu nại']),
    ('nvbh', 'Nhân Viên Bán Hàng', True, ['Bán hàng tại quầy', 'Xử lý và cập nhật đơn hàng']),
    ('qlbh', 'Quản Lý Bán Hàng', False, ['Duyệt hủy đơn hàng']),
    ('nvmh', 'Nhân Viên Mua Hàng', True, ['Quản lý và đánh giá nhà cung cấp', 'Lập yêu cầu báo giá',
                                          'So sánh báo giá', 'Trình duyệt đơn mua hàng']),
    ('ncc', 'Nhà Cung Cấp', False, ['Phản hồi yêu cầu báo giá', 'Xác nhận đơn mua hàng']),
    ('kd', 'Nhân Viên Kiểm Định\nChất Lượng', True, ['Kiểm tra chất lượng hàng nhập', 'Thẩm định hàng hoàn trả']),
]
RIGHT = [
    ('nvk', 'Nhân Viên Kho', True, ['Nghiệm thu hàng nhập kho', 'Kiểm kê và điều chỉnh tồn kho',
                                    'Lập phiếu đề xuất mua hàng', 'Xác nhận xuất kho và phân công giao hàng']),
    (None, '', False, ['Kiểm tra và cập nhật tồn kho']),
    ('qlk', 'Quản Lý Kho', False, ['Quản lý danh mục sản phẩm', 'Duyệt phiếu đề xuất mua hàng']),
    ('lr', 'Nhân Viên Lắp Ráp', True, ['Nhận lệnh lắp ráp máy tính', 'Cập nhật tiến độ lắp ráp']),
    ('email', '«system»\nHệ Thống Email', False, []),
    ('gh', 'Nhân Viên Giao Hàng', True, ['Giao hàng và thu tiền hộ', 'Thu hồi hàng bảo hành và hoàn trả']),
    ('kt', 'Nhân Viên Kế Toán', True, ['Ghi nhận phiếu thu chi', 'Thanh toán nhà cung cấp',
                                       'Giải ngân hoàn tiền khách hàng', 'Giải ngân lương nhân viên',
                                       'Đối soát tiền thu hộ']),
    ('ns', 'Nhân Viên Nhân Sự', True, ['Quản lý hồ sơ nhân viên', 'Chấm công hàng ngày',
                                       'Tính lương và trình duyệt bảng lương', 'Duyệt đơn nghỉ phép']),
    ('bgd', 'Ban Giám Đốc', True, ['Duyệt đơn mua hàng', 'Duyệt bảng lương toàn công ty',
                                   'Xem báo cáo tổng thể']),
    ('qtv', 'Quản Trị Viên', True, ['Quản trị tài khoản và phân quyền', 'Xem nhật ký hệ thống',
                                    'Sao lưu và phục hồi dữ liệu']),
]
BOTTOM = ['Đăng ký khuôn mặt', 'Chấm công bằng khuôn mặt', 'Xin nghỉ phép',
          'Tra cứu bảng lương của tôi', 'Xem tổng quan công việc']
# tác nhân hệ thống nối với use case của nhóm liền trên / liền dưới
SYS_LINKS = {'sepay': ['Chọn phương thức và xác nhận thanh toán'],
             'email': ['Cập nhật tiến độ lắp ráp', 'Giao hàng và thu tiền hộ']}
GENERAL = [('kh', 'kvl'), ('qlbh', 'nvbh'), ('qlk', 'nvk')]          # con -> cha
EXTEND = [('Chọn phương thức và xác nhận thanh toán', 'Đặt hàng'),
          ('Tự cấu hình máy tính', 'Đặt hàng'),
          ('Đánh giá sản phẩm', 'Theo dõi đơn hàng'),
          ('Duyệt hủy đơn hàng', 'Xử lý và cập nhật đơn hàng')]
INCLUDE = [('Đặt hàng', 'Kiểm tra và cập nhật tồn kho'),
           ('Bán hàng tại quầy', 'Kiểm tra và cập nhật tồn kho'),
           ('Nghiệm thu hàng nhập kho', 'Kiểm tra và cập nhật tồn kho'),
           ('Xác nhận xuất kho và phân công giao hàng', 'Kiểm tra và cập nhật tồn kho')]


LABW = 410
PRE_GAP = {'qlbh': 120}   # chừa chỗ cho mũi tên kế thừa thẳng đứng
# ---------------------------------------------------------------- bố cục
def layout(groups, xc):
    ucs, actors, y = {}, {}, TOP
    for key, name, internal, items in groups:
        if key in PRE_GAP: y += PRE_GAP[key]
        if not items:                    # tác nhân hệ thống chen giữa hai nhóm
            actors[key] = dict(name=name, y=y + 95, internal=internal)
            y += 250
            continue
        ys = []
        for it in items:
            ucs[it] = (xc, y + UH / 2)
            ys.append(y + UH / 2)
            y += ROW
        if key:
            actors[key] = dict(name=name, y=sum(ys) / len(ys), internal=internal, ucs=items)
        y += GAP
    return ucs, actors, y


ucL, actL, yL = layout(LEFT, XL)
ucR, actR, yR = layout(RIGHT, XR)
def n_lines(name):
    n = 0
    for part in name.split('\n'):
        words, cur = part.split(), ''
        n += 1
        for w_ in words:
            t = (cur + ' ' + w_).strip()
            if f_act.getlength(t) > LABW and cur: n += 1; cur = w_
            else: cur = t
    return n


def spread(acts):
    prev = None
    for a in sorted(acts.values(), key=lambda a: a['y']):
        if prev is not None:
            a['y'] = max(a['y'], prev['y'] + 75 + n_lines(prev['name']) * (FS + 6) + 210)
        prev = a


for a in actL.values(): a['x'] = AXL
for a in actR.values(): a['x'] = AXR
spread(actL); spread(actR)
UC = {**ucL, **ucR}
ACT = {**actL, **actR}
yband = max(yL, yR) + 40
UWB = (BX1 - BX0 - 60) / len(BOTTOM) - 16
for i, it in enumerate(BOTTOM):
    UC[it] = (BX0 + 30 + (UWB + 16) * (i + 0.5), yband + UH / 2)
BY1 = yband + UH + 60
ACT['nv'] = dict(name='Nhân Viên', x=W / 2, y=BY1 + 200, internal=False, ucs=BOTTOM)
H = int(BY1 + 400)

img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)


def tw(t, font=f):
    return d.textlength(t, font=font)


def wrap(text, maxw, font=f):
    words, lines, cur = text.split(), [], ''
    for w_ in words:
        t = (cur + ' ' + w_).strip()
        if tw(t, font) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w_
    lines.append(cur)
    return lines


def ctext(x, y, lines, font=f, lh=None):
    lh = lh or font.size + 6
    y0 = y - lh * len(lines) / 2
    for i, ln in enumerate(lines):
        d.text((x - tw(ln, font) / 2, y0 + i * lh), ln, font=font, fill=INK)


def dashed(p, q, dash=18, gap=12):
    import math
    (x0, y0), (x1, y1) = p, q
    L = math.hypot(x1 - x0, y1 - y0)
    if L == 0: return
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    s = 0
    while s < L:
        e = min(s + dash, L)
        d.line([(x0 + ux * s, y0 + uy * s), (x0 + ux * e, y0 + uy * e)], fill=INK, width=LINE)
        s = e + gap


def open_arrow(p, q, size=26):
    import math
    ang = math.atan2(q[1] - p[1], q[0] - p[0])
    for s in (-0.45, 0.45):
        d.line([q, (q[0] - size * math.cos(ang + s), q[1] - size * math.sin(ang + s))], fill=INK, width=LINE)


def hollow_tri(p, q, size=34):
    import math
    ang = math.atan2(q[1] - p[1], q[0] - p[0])
    a = (q[0] - size * math.cos(ang - 0.42), q[1] - size * math.sin(ang - 0.42))
    b = (q[0] - size * math.cos(ang + 0.42), q[1] - size * math.sin(ang + 0.42))
    base = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    d.line([p, base], fill=INK, width=LINE)
    d.polygon([q, a, b], outline=INK, fill='white')
    d.line([q, a, b, q], fill=INK, width=LINE)


# ranh giới hệ thống
d.rectangle([BX0, 120, BX1, BY1], outline=INK, width=4)
title = 'Hệ Thống ERP AetherPC'
d.text(((BX0 + BX1) / 2 - tw(title, f_title) / 2, 140), title, font=f_title, fill=INK)

# tác nhân
def actor_geom(a):
    x, y = a['x'], a['y']
    return dict(head=(x, y - 95), neck=(x, y - 68), hip=(x, y + 5), arm_y=y - 40,
                foot=y + 60, label_y=y + 75)


def draw_actor(a):
    g = actor_geom(a); x, y = a['x'], a['y']
    hx, hy = g['head']
    d.ellipse([hx - 26, hy - 26, hx + 26, hy + 26], outline=INK, width=LINE)
    d.line([g['neck'], g['hip']], fill=INK, width=LINE)
    d.line([(x - 45, g['arm_y']), (x + 45, g['arm_y'])], fill=INK, width=LINE)
    d.line([g['hip'], (x - 38, g['foot'])], fill=INK, width=LINE)
    d.line([g['hip'], (x + 38, g['foot'])], fill=INK, width=LINE)
    lines = []
    for part in a['name'].split('\n'):
        lines += wrap(part, LABW, f_act)
    lh = FS + 6
    for i, ln in enumerate(lines):
        d.text((x - tw(ln, f_act) / 2, g['label_y'] + i * lh), ln, font=f_act, fill=INK)
    a['label_bottom'] = g['label_y'] + lh * len(lines)
    a['label_w'] = max(tw(ln, f_act) for ln in lines)


def uc_edge(name, toward_x):
    x, y = UC[name]
    return (x - UW / 2, y) if toward_x < x else (x + UW / 2, y)


# liên kết tác nhân - use case (vẽ trước để ellipse đè lên đầu đường)
for k, a in ACT.items():
    for it in a.get('ucs', []):
        if k == 'nv':
            x, y = UC[it]
            d.line([(a['x'], a['y'] - 130), (x, y + UH / 2)], fill=INK, width=LINE)
        else:
            side = 1 if a['x'] < W / 2 else -1
            d.line([(a['x'] + side * 48, a['y'] - 40), uc_edge(it, a['x'])], fill=INK, width=LINE)
for k, items in SYS_LINKS.items():
    a = ACT[k]; side = 1 if a['x'] < W / 2 else -1
    for it in items:
        d.line([(a['x'] + side * 48, a['y'] - 40), uc_edge(it, a['x'])], fill=INK, width=LINE)

# extend (cùng cột trái): vòng ra mép trong của cột
for i, (src, dst) in enumerate(EXTEND):
    (sx, sy), (tx, ty) = UC[src], UC[dst]
    xo = sx + UW / 2 + 45 + i % 2 * 55
    p0, p3 = (sx + UW / 2 - 6, sy), (tx + UW / 2 - 6, ty)
    dashed(p0, (xo, sy)); dashed((xo, sy), (xo, ty)); dashed((xo, ty), p3)
    open_arrow((xo, ty), p3)
    lab = '«extend»'
    lx, ly = xo + 8, sy + 6
    d.rectangle([lx - 2, ly, lx + tw(lab, f_lab) + 2, ly + f_lab.size + 4], fill='white')
    d.text((lx, ly), lab, font=f_lab, fill=INK)

# include: tới "Kiểm tra và cập nhật tồn kho" ở cột phải
tgt = 'Kiểm tra và cập nhật tồn kho'
tx, ty = UC[tgt]
lanes = {'Đặt hàng': XL + UW / 2 + 260, 'Bán hàng tại quầy': XL + UW / 2 + 200,
         'Nghiệm thu hàng nhập kho': XR - UW / 2 - 70, 'Xác nhận xuất kho và phân công giao hàng': XR - UW / 2 - 130}
for j, (src, _) in enumerate(INCLUDE):
    sx, sy = UC[src]; xo = lanes[src]
    if sx < tx:
        p0 = (sx + UW / 2 - 6, sy)
    else:
        p0 = (sx - UW / 2 + 6, sy)
    end_y = ty + (-30 + 20 * j)
    p3 = (tx - UW / 2 + 22, end_y)
    dashed(p0, (xo, sy)); dashed((xo, sy), (xo, end_y)); dashed((xo, end_y), p3)
    open_arrow((xo, end_y), p3)
INC_LABEL = (tx - UW / 2 - 175, ty + 26)

# use case
for name, (x, y) in UC.items():
    uw = UWB if name in BOTTOM else UW
    lines = wrap(name, uw - 100)
    h = max(UH, (FS + 6) * len(lines) + 28)
    d.ellipse([x - uw / 2, y - h / 2, x + uw / 2, y + h / 2], outline=INK, width=LINE, fill='white')
    ctext(x, y, lines)

lx, ly = INC_LABEL
d.rectangle([lx - 4, ly - 2, lx + tw('«include»', f_lab) + 4, ly + f_lab.size + 4], fill='white')
d.text((lx, ly), '«include»', font=f_lab, fill=INK)

# tác nhân
for a in ACT.values():
    draw_actor(a)

# kế thừa giữa các tác nhân cùng cột (con nằm dưới cha)
for c, p in GENERAL:
    ca, pa = ACT[c], ACT[p]
    hollow_tri((ca['x'], ca['y'] - 123), (pa['x'], pa['label_bottom'] + 6))

# các vai trò nội bộ kế thừa Nhân viên: gom về hai mép rồi nối vào Nhân viên
nv = ACT['nv']; ny = nv['y'] - 40
for side, bus in ((-1, BUSL), (1, BUSR)):
    members = [a for k, a in ACT.items() if a.get('internal') and (a['x'] < W / 2) == (side < 0)]
    top = min(a['y'] for a in members) - 40
    for a in members:
        x_from = a['x'] - a['label_w'] / 2 - 12 if side < 0 else a['x'] + a['label_w'] / 2 + 12
        x_from = min(x_from, a['x'] - 60) if side < 0 else max(x_from, a['x'] + 60)
        d.line([(bus, a['y'] - 40), (a['x'] + side * 48, a['y'] - 40)], fill=INK, width=LINE)
    d.line([(bus, top), (bus, ny)], fill=INK, width=LINE)
    d.line([(bus, ny), (nv['x'] - side * 230, ny)], fill=INK, width=LINE)
    hollow_tri((nv['x'] - side * 230, ny), (nv['x'] - side * 50, ny))

# ghi chú điều kiện đăng nhập
note = ['Mọi use case đều yêu cầu đăng nhập (use case', 'Đăng nhập, mục 3.5.6.1), trừ các use case', 'công khai của Khách Vãng Lai.']
nx0, ny0 = BX0 + 10, BY1 + 195
nw = max(tw(t, f_lab) for t in note) + 50; nh = (FS) * len(note) + 30
d.polygon([(nx0, ny0), (nx0 + nw - 30, ny0), (nx0 + nw, ny0 + 30), (nx0 + nw, ny0 + nh), (nx0, ny0 + nh)],
          outline=INK, fill=(255, 253, 231))
d.line([(nx0 + nw - 30, ny0), (nx0 + nw - 30, ny0 + 30), (nx0 + nw, ny0 + 30)], fill=INK, width=2)
for i, t in enumerate(note):
    d.text((nx0 + 22, ny0 + 16 + i * FS), t, font=f_lab, fill=INK)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'usecase_tongquat.png')
img.save(out)
print(out, img.size, round(H / W * 15.5, 1), 'cm cao khi rộng 15,5 cm')
