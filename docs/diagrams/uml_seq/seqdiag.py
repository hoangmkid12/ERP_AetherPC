# -*- coding: utf-8 -*-
"""Bộ vẽ sơ đồ tuần tự (sequence diagram) theo ký hiệu phân tích UML dùng trong báo cáo KLTN.

Ký hiệu: tác nhân (hình người), lớp giao diện GD_ (boundary), lớp điều khiển CTRL_ (control),
lớp thực thể ENTITY_ (entity), hệ thống ngoài (hình chữ nhật). Thông điệp gọi là mũi tên liền đầu
đặc, thông điệp trả về là mũi tên nét đứt đầu mở, tự gọi là vòng lặp bên phải thanh kích hoạt.
Khung tổ hợp: alt (nhiều nhánh), opt (tùy chọn), loop (lặp).

Đặc tả một sơ đồ:
    parts = [('actor', 'KHÁCH HÀNG'), ('boundary', 'GD_GIOHANG'), ...]
    steps = [
        ('msg', 'KHÁCH HÀNG', 'GD_GIOHANG', '1: Bấm "Đặt hàng"'),
        ('ret', 'CTRL_ORDER', 'GD_GIOHANG', '1.2: return donHang'),
        ('self', 'GD_GIOHANG', '1.3: Hiển thị thông báo'),
        ('alt', [('[ĐỦ HÀNG]', [...]), ('[THIẾU HÀNG]', [...])]),
        ('opt', '[CÓ EMAIL]', [...]),
        ('loop', '[MỖI SẢN PHẨM]', [...]),
    ]
    render(parts, steps, 'ra.png')
"""
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = 'C:/Windows/Fonts/arial.ttf'
FONT_BOLD = 'C:/Windows/Fonts/arialbd.ttf'
FS = 25                  # cỡ chữ thông điệp
LINE_H = 31
MAX_LABEL_W = 680        # như mẫu tham khảo: nhãn để một dòng, chỉ ngắt khi quá dài
SELF_LABEL_W = 640        # nhãn dài hơn sẽ xuống dòng
FILL = (126, 196, 230)
INK = (30, 30, 30)
GRAY = (110, 110, 110)
BAR_W = 16
ICON = 64
TOP = 20
HEAD_H = ICON + 60       # biểu tượng + tên
MARGIN = 40

font = ImageFont.truetype(FONT_PATH, FS)
font_b = ImageFont.truetype(FONT_BOLD, FS)
font_n = ImageFont.truetype(FONT_PATH, FS - 3)   # tên đối tượng


def tw(text, f=font):
    return f.getbbox(text)[2] if text else 0


def wrap(text, maxw=MAX_LABEL_W):
    words, lines, cur = text.split(' '), [], ''
    # không tách số thứ tự (vd "2.1.1:") khỏi từ đứng sau nó
    if len(words) > 1 and words[0].endswith(':'):
        words = [words[0] + ' ' + words[1]] + words[2:]
    for w in words:
        t = (cur + ' ' + w).strip()
        if tw(t) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _flatten(steps, depth=0):
    """Duyệt tuần tự các bước, trả về các sự kiện bố cục."""
    for s in steps:
        k = s[0]
        if k in ('msg', 'ret', 'self'):
            yield ('step', s, depth)
        elif k in ('alt', 'par'):
            yield ('frame_start', (k, s[1][0][0]), depth)
            for bi, (guard, sub) in enumerate(s[1]):
                if bi > 0:
                    yield ('frame_else', guard, depth)
                yield from _flatten(sub, depth + 1)
            yield ('frame_end', None, depth)
        elif k in ('opt', 'loop'):
            yield ('frame_start', (k, s[1]), depth)
            yield from _flatten(s[2], depth + 1)
            yield ('frame_end', None, depth)


def render(parts, steps, out_path, title=None):
    names = [p[1] for p in parts]
    idx = {n: i for i, n in enumerate(names)}
    n = len(parts)

    # ---- 1. Khoảng cách giữa các đường sống: đủ chỗ cho tên và nhãn thông điệp ----
    name_w = [tw(nm, font_n) for nm in names]
    gaps = [max(150, (name_w[i] + name_w[i + 1]) / 2 + 22) for i in range(n - 1)]
    right_extra = name_w[-1] / 2 + MARGIN
    events = list(_flatten(steps))
    reqs = []
    for ev, s, _ in events:
        if ev != 'step':
            continue
        if s[0] == 'self':
            lines = wrap(s[2], SELF_LABEL_W)
            w = max(tw(l) for l in lines) + 70
            i = idx[s[1]]
            if i < n - 1:
                reqs.append((i, i + 1, w + 30))
            else:
                right_extra = max(right_extra, w + MARGIN)
        else:
            a, b = sorted((idx[s[1]], idx[s[2]]))
            lines = wrap(s[3])
            w = max(tw(l) for l in lines) + 36
            reqs.append((a, b, w))
    reqs.sort(key=lambda r: r[1] - r[0])
    for _ in range(3):
        for a, b, w in reqs:
            have = sum(gaps[a:b])
            if have < w:
                add = (w - have) / (b - a)
                for k in range(a, b):
                    gaps[k] += add
    left = MARGIN + max(name_w[0] / 2, 70)
    xs = [left]
    for g in gaps:
        xs.append(xs[-1] + g)
    width = int(xs[-1] + right_extra)

    # ---- 2. Bố cục dọc ----
    y = TOP + HEAD_H + 30
    layout = []          # (loại, dữ liệu, y, depth)
    frame_stack = []
    for ev, s, depth in events:
        if ev == 'frame_start':
            y += 8
            layout.append(('fstart', s, y, depth))
            frame_stack.append(len(layout) - 1)
            y += 76          # thẻ khung + dòng điều kiện đặt bên dưới thẻ
        elif ev == 'frame_else':
            y += 4
            layout.append(('felse', s, y, depth))
            y += 46
        elif ev == 'frame_end':
            y += 6
            start = frame_stack.pop()
            layout.append(('fend', start, y, depth))
            y += 18
        else:
            label = s[2] if s[0] == 'self' else s[3]
            lines = wrap(label, SELF_LABEL_W if s[0] == 'self' else MAX_LABEL_W)
            y += LINE_H * len(lines)
            if s[0] == 'self':
                layout.append(('self', (s[1], lines), y, depth))
                y += 46
            else:
                layout.append((s[0], (s[1], s[2], lines), y, depth))
                y += 26
    height = int(y + 40)

    img = Image.new('RGB', (width, height), 'white')
    d = ImageDraw.Draw(img)

    # ---- 3. Thanh kích hoạt: từ lần tham gia đầu tới lần cuối ----
    span = {}
    for kind, data, yy, _ in layout:
        if kind in ('msg', 'ret'):
            for nm in data[:2]:
                lo, hi = span.get(nm, (yy, yy))
                span[nm] = (min(lo, yy), max(hi, yy))
        elif kind == 'self':
            nm = data[0]
            lo, hi = span.get(nm, (yy, yy + 30))
            span[nm] = (min(lo, yy), max(hi, yy + 30))

    # đường sống
    for i, (kind, nm) in enumerate(parts):
        x = xs[i]
        for yy in range(TOP + HEAD_H - 4, height - 15, 14):
            d.line([(x, yy), (x, min(yy + 7, height - 15))], fill=GRAY, width=2)

    # khung tổ hợp (vẽ trước để nằm dưới mũi tên)
    fx0, fx1 = 14, width - 14
    guards = []
    for li, (kind, data, yy, depth) in enumerate(layout):
        inset = depth * 10
        if kind == 'fend':
            sk, sd, sy, _ = layout[data]
            d.rectangle([fx0 + inset, sy, fx1 - inset, yy], outline=INK, width=2)
            tag, guard = sd
            tag_w = tw(tag, font_b) + 22
            x0 = fx0 + inset
            d.polygon([(x0, sy), (x0 + tag_w, sy), (x0 + tag_w, sy + 24), (x0 + tag_w - 10, sy + 34), (x0, sy + 34)],
                      fill='white', outline=INK)
            d.text((x0 + 8, sy + 3), tag, font=font_b, fill=INK)
            guards.append((x0 + 10, sy + 38, guard))   # điều kiện nằm dưới thẻ, như mẫu
        elif kind == 'felse':
            x0 = fx0 + depth * 10
            for xx in range(x0, fx1 - depth * 10, 18):
                d.line([(xx, yy), (min(xx + 9, fx1 - depth * 10), yy)], fill=INK, width=2)
            guards.append((x0 + 12, yy + 7, data))

    for i, (kind, nm) in enumerate(parts):
        x = xs[i]
        if kind == 'actor':
            lo, hi = TOP + HEAD_H + 10, height - 30
        elif nm in span:
            lo, hi = span[nm][0] - 14, span[nm][1] + 14
        else:
            continue
        d.rectangle([x - BAR_W / 2, lo, x + BAR_W / 2, hi], fill=FILL, outline=INK, width=1)

    # nhãn điều kiện của khung nằm trên thanh kích hoạt, có nền trắng cho dễ đọc
    for gx, gy, g in guards:
        d.rectangle([gx - 3, gy - 1, gx + tw(g) + 3, gy + LINE_H - 3], fill='white')
        d.text((gx, gy), g, font=font, fill=INK)

    # ---- 4. Biểu tượng và tên ----
    for i, (kind, nm) in enumerate(parts):
        x = xs[i]
        cy = TOP + ICON / 2
        r = ICON / 2 - 6
        if kind == 'actor':
            d.ellipse([x - 11, TOP, x + 11, TOP + 22], outline=INK, width=2)
            d.line([(x, TOP + 22), (x, TOP + 46)], fill=INK, width=2)
            d.line([(x - 18, TOP + 31), (x + 18, TOP + 31)], fill=INK, width=2)
            d.line([(x, TOP + 46), (x - 15, TOP + 64)], fill=INK, width=2)
            d.line([(x, TOP + 46), (x + 15, TOP + 64)], fill=INK, width=2)
        elif kind == 'boundary':
            d.ellipse([x - r + 8, cy - r, x + r + 8, cy + r], fill=FILL, outline=INK, width=2)
            d.line([(x - r - 14, cy - r + 2), (x - r - 14, cy + r - 2)], fill=INK, width=3)
            d.line([(x - r - 14, cy), (x - r + 8, cy)], fill=INK, width=2)
        elif kind == 'control':
            d.ellipse([x - r, cy - r, x + r, cy + r], fill=FILL, outline=INK, width=2)
            d.line([(x - 2, cy - r), (x + 9, cy - r - 8)], fill=INK, width=2)
            d.line([(x - 2, cy - r), (x + 9, cy - r + 7)], fill=INK, width=2)
        elif kind == 'entity':
            d.ellipse([x - r, cy - r, x + r, cy + r], fill=FILL, outline=INK, width=2)
            d.line([(x - r, cy + r + 3), (x + r, cy + r + 3)], fill=INK, width=3)
        else:  # hệ thống ngoài
            d.rectangle([x - 34, cy - r + 2, x + 34, cy + r - 2], fill=FILL, outline=INK, width=2)
        d.text((x - tw(nm, font_n) / 2, TOP + ICON + 14), nm, font=font_n, fill=INK)

    # ---- 5. Thông điệp ----
    def head_filled(xe, ye, direction):
        d.polygon([(xe, ye), (xe - 16 * direction, ye - 8), (xe - 16 * direction, ye + 8)], fill=INK)

    def head_open(xe, ye, direction):
        d.line([(xe, ye), (xe - 15 * direction, ye - 8)], fill=INK, width=2)
        d.line([(xe, ye), (xe - 15 * direction, ye + 8)], fill=INK, width=2)

    for kind, data, yy, depth in layout:
        if kind in ('msg', 'ret'):
            a, b, lines = data
            xa, xb = xs[idx[a]], xs[idx[b]]
            direction = 1 if xb > xa else -1
            x1 = xa + direction * BAR_W / 2
            x2 = xb - direction * BAR_W / 2
            if kind == 'msg':
                d.line([(x1, yy), (x2, yy)], fill=INK, width=2)
                head_filled(x2, yy, direction)
            else:
                xx = x1
                while (xx - x2) * direction < 0:
                    nx = xx + 12 * direction
                    if (nx - x2) * direction > 0:
                        nx = x2
                    d.line([(xx, yy), (nx, yy)], fill=INK, width=2)
                    xx = nx + 8 * direction
                head_open(x2, yy, direction)
            mid = (x1 + x2) / 2
            for li, line in enumerate(lines):
                ly = yy - LINE_H * (len(lines) - li) - 2
                lx = mid - tw(line) / 2
                d.rectangle([lx - 3, ly + 2, lx + tw(line) + 3, ly + LINE_H - 4], fill='white')
                d.text((lx, ly), line, font=font, fill=INK)
        elif kind == 'self':
            nm, lines = data
            x = xs[idx[nm]] + BAR_W / 2
            d.line([(x, yy), (x + 44, yy)], fill=INK, width=2)
            d.line([(x + 44, yy), (x + 44, yy + 26)], fill=INK, width=2)
            d.line([(x + 44, yy + 26), (x, yy + 26)], fill=INK, width=2)
            head_filled(x, yy + 26, -1)
            for li, line in enumerate(lines):
                ly = yy - LINE_H * (len(lines) - li) + 14
                d.rectangle([x + 53, ly + 2, x + 59 + tw(line), ly + LINE_H - 4], fill='white')
                d.text((x + 56, ly), line, font=font, fill=INK)

    img.save(out_path, dpi=(300, 300))
    return img.size
