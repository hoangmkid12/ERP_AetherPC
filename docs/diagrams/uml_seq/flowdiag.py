# -*- coding: utf-8 -*-
"""Sinh sơ đồ BPMN (làn ngang) và sơ đồ hoạt động UML (làn dọc) từ CÙNG một đặc tả luồng,
để hai sơ đồ và bảng đặc tả use case luôn khớp nhau.

Đặc tả:
    F = dict(title='Đặt hàng', lanes=['Khách hàng', 'Hệ thống'],
             nodes=[(id, lane, step, sub, kind, text), ...],
             edges=[(a, b, nhãn, {'via': số}), ...])
    lane  : chỉ số làn;  step: vị trí theo chiều luồng (0, 1, 2…);  sub: lệch trong làn (-1, 0, 1…)
    kind  : 'start' | 'end' | 'task' | 'gw' (rẽ nhánh, text là câu hỏi) | 'merge' (hợp nhánh)
"""
from PIL import Image, ImageDraw, ImageFont

F_REG = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 23)
F_BOLD = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 23)
F_LANE = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 24)
INK = (25, 25, 25)
# Kiểu chữ riêng cho BPMN — đồng bộ với 4 sơ đồ quy trình nghiệp vụ (Hình 3.1–3.4)
B_TASK = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 22)
B_GW = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 21)
B_EDGE = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 19)
B_EVT = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 20)
B_LANE = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 22)
B_TITLE = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 24)
EDGE_INK = (70, 70, 70)


def tw(t, f=F_REG):
    return f.getbbox(t)[2] if t else 0


def wrap(t, maxw, f=F_REG):
    out, cur = [], ''
    for w in t.split():
        c = (cur + ' ' + w).strip()
        if tw(c, f) <= maxw or not cur:
            cur = c
        else:
            out.append(cur); cur = w
    return out + ([cur] if cur else [])


def title_case(t):
    """Viết hoa chữ cái đầu mỗi từ (kể cả trong ngoặc kép), giữ nguyên từ viết tắt."""
    out = []
    for w in t.split(' '):
        i = 0
        while i < len(w) and not w[i].isalpha():
            i += 1
        if i < len(w) and not w[i:].isupper():
            w = w[:i] + w[i].upper() + w[i + 1:]
        out.append(w)
    return ' '.join(out)


class Layout:
    """Toạ độ trừu tượng: f = trục luồng, l = trục làn. Hướng ngang (BPMN) hoặc dọc (hoạt động)."""

    def __init__(self, spec, mode):
        self.s, self.mode = spec, mode
        self.nodes = {n[0]: dict(id=n[0], lane=n[1], step=n[2], sub=n[3], kind=n[4], text=n[5]) for n in spec['nodes']}
        if mode == 'bpmn':
            # BPMN dùng nhãn rút gọn, Viết Hoa (spec['short']); sơ đồ hoạt động giữ câu mô tả đầy đủ
            short = spec.get('short', {})
            moved = spec.get('bpmn', {}).get('nodes', {})
            for n in self.nodes.values():
                n['text'] = short.get(n['id']) or title_case(n['text'])
                if n['id'] in moved:
                    n['step'], n['sub'] = moved[n['id']]
        nl = len(spec['lanes'])
        subs = {i: [n['sub'] for n in self.nodes.values() if n['lane'] == i] or [0] for i in range(nl)}
        if mode == 'bpmn':
            self.SF, self.SUB = 285, 150
            self.TW, self.TH = 252, 96
            self.F0 = 235                 # sau cột tên pool và làn
            base = 270
        else:
            self.SF, self.SUB = 150, 345
            self.TW, self.TH = 315, 70
            self.F0 = 70 + 70
            base = 520
        # kích thước từng làn theo khoảng lệch lớn nhất
        self.lane_lo, self.lane_size = [], []
        acc = 0
        for i in range(nl):
            lo, hi = min(subs[i]), max(subs[i])
            size = base + (hi - lo) * self.SUB
            self.lane_lo.append(acc)
            self.lane_size.append(size)
            acc += size
        self.lane_total = acc
        self.lane_mid = [self.lane_lo[i] + self.lane_size[i] / 2 - (min(subs[i]) + max(subs[i])) / 2 * self.SUB for i in range(nl)]
        for n in self.nodes.values():
            n['f'] = self.F0 + n['step'] * self.SF
            n['l'] = self.lane_mid[n['lane']] + n['sub'] * self.SUB
            if n['kind'] == 'task':
                if mode == 'bpmn':
                    n['lines'] = wrap(n['text'], self.TW - 34, B_TASK)
                    w, h = self.TW, max(self.TH, len(n['lines']) * 27 + 26)
                else:
                    n['lines'] = wrap(n['text'], self.TW - 26)
                    w = min(self.TW, max(220, max(tw(x) for x in n['lines']) + 44))
                    h = max(self.TH, len(n['lines']) * 29 + 26)
                n['w'], n['h'] = w, h
            elif n['kind'] in ('gw', 'merge'):
                n['w'] = n['h'] = 60
            else:
                n['w'] = n['h'] = 50
            # nửa kích thước theo trục luồng / trục làn
            if mode == 'bpmn':
                n['hf'], n['hl'] = n['w'] / 2, n['h'] / 2
            else:
                n['hf'], n['hl'] = n['h'] / 2, n['w'] / 2
        self.f_end = max(n['f'] + n['hf'] for n in self.nodes.values()) + 90

    def xy(self, f, l):
        return (f, l) if self.mode == 'bpmn' else (l, f)

    def route(self, a, b, opt):
        A, B = self.nodes[a], self.nodes[b]
        isg = lambda n: n['kind'] in ('gw', 'merge')
        sgn = lambda v: (v > 0) - (v < 0)
        if 'via' in opt or B['f'] < A['f']:          # cạnh quay lui
            gap = 48 if self.mode == 'bpmn' else 40
            if opt.get('side') == 'hi':
                v = max(A['l'] + A['hl'], B['l'] + B['hl']) + gap
            else:
                v = min(A['l'] - A['hl'], B['l'] - B['hl']) - gap
            v = opt.get('via', v)
            s1 = sgn(v - A['l']) or -1
            s2 = sgn(v - B['l']) or -1
            pts = [(A['f'], A['l'] + s1 * A['hl']), (A['f'], v), (B['f'], v), (B['f'], B['l'] + s2 * B['hl'])]
        elif B['f'] == A['f']:
            s = sgn(B['l'] - A['l'])
            pts = [(A['f'], A['l'] + s * A['hl']), (B['f'], B['l'] - s * B['hl'])]
        elif A['l'] == B['l']:
            pts = [(A['f'] + A['hf'], A['l']), (B['f'] - B['hf'], B['l'])]
        elif isg(A) and opt.get('exit') != 'fwd':
            s = sgn(B['l'] - A['l'])
            pts = [(A['f'], A['l'] + s * A['hl']), (A['f'], B['l']), (B['f'] - B['hf'], B['l'])]
        elif isg(B) and opt.get('enter') != 'back':
            s = sgn(A['l'] - B['l'])
            pts = [(A['f'] + A['hf'], A['l']), (B['f'], A['l']), (B['f'], B['l'] + s * B['hl'])]
        else:
            fm = self.F0 + opt['midstep'] * self.SF if 'midstep' in opt else (A['f'] + A['hf'] + B['f'] - B['hf']) / 2
            pts = [(A['f'] + A['hf'], A['l']), (fm, A['l']), (fm, B['l']), (B['f'] - B['hf'], B['l'])]
        return [self.xy(*p) for p in pts]


def _arrow(d, pts, filled):
    d.line(pts, fill=INK, width=2)
    (x1, y1), (x2, y2) = pts[-2], pts[-1]
    if abs(x2 - x1) > abs(y2 - y1):
        s = 1 if x2 > x1 else -1
        p = [(x2, y2), (x2 - 15 * s, y2 - 8), (x2 - 15 * s, y2 + 8)]
    else:
        s = 1 if y2 > y1 else -1
        p = [(x2, y2), (x2 - 8, y2 - 15 * s), (x2 + 8, y2 - 15 * s)]
    if filled:
        d.polygon(p, fill=INK)
    else:
        d.line([p[1], p[0], p[2]], fill=INK, width=2)


def _gw_used_tips(L, spec):
    """Các đỉnh của hình thoi đã có đường nối — để đặt câu hỏi vào phía còn trống."""
    used = {}
    for e in spec['edges']:
        opt = spec.get('bpmn', {}).get('edges', {}).get((e[0], e[1]), e[3] if len(e) > 3 else {})
        pts = L.route(e[0], e[1], opt)
        for nid, (px, py) in ((e[0], pts[0]), (e[1], pts[-1])):
            g = L.nodes[nid]
            if g['kind'] not in ('gw', 'merge'):
                continue
            gx, gy = L.xy(g['f'], g['l'])
            for tip, (tx, ty) in (('top', (gx, gy - g['hl'])), ('bot', (gx, gy + g['hl'])),
                                  ('left', (gx - g['hf'], gy)), ('right', (gx + g['hf'], gy))):
                if abs(px - tx) < 2 and abs(py - ty) < 2:
                    used.setdefault(nid, set()).add(tip)
    return used


def _vtext(img, box, text, font, at):
    """Chữ xoay 90 độ (tên pool/làn), canh giữa theo chiều dài của làn."""
    length, thick = box
    lab = Image.new('RGB', (int(length), thick), 'white')
    ld = ImageDraw.Draw(lab)
    lines = [text] if tw(text, font) <= length - 16 else wrap(text, length - 16, font)[:2]
    lh = font.size + 4
    y = thick / 2 - lh * len(lines) / 2
    for k, ln in enumerate(lines):
        ld.text((length / 2 - tw(ln, font) / 2, y + lh * k), ln, font=font, fill=INK)
    img.paste(lab.rotate(90, expand=True), at)


def render_bpmn(spec, out):
    """BPMN làn ngang theo đúng phong cách các sơ đồ quy trình nghiệp vụ (Hình 3.1–3.4):
    khung tiêu đề, pool "Hệ Thống AetherPC", ô bo góc cùng kích thước, cổng XOR hình thoi trống,
    câu hỏi in đậm cạnh cổng, nhãn nhánh chữ xám trên nền trắng nằm ngay trên đường nối."""
    L = Layout(spec, 'bpmn')
    OY, X_POOL, X_LANE, X_BODY = 78, 20, 70, 124
    W, H = int(L.f_end + 24), int(OY + L.lane_total + 22)
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)

    def P(pt):
        return pt[0], pt[1] + OY

    # ---- tiêu đề, pool, làn
    title = 'Quy Trình Chức Năng ' + spec['title']
    d.rectangle([X_POOL, 14, X_POOL + tw(title, B_TITLE) + 44, 58], outline=INK, width=2)
    d.text((X_POOL + 22, 22), title, font=B_TITLE, fill=INK)
    top, bot = OY, OY + L.lane_total
    d.rectangle([X_POOL, top, W - 14, bot], outline=(60, 60, 60), width=2)
    d.line([(X_LANE, top), (X_LANE, bot)], fill=(60, 60, 60), width=2)
    _vtext(img, (L.lane_total, 46), 'Hệ Thống AetherPC', B_LANE, (X_POOL + 2, int(top)))
    for i, name in enumerate(spec['lanes']):
        y0 = top + L.lane_lo[i]
        if i:
            d.line([(X_LANE, y0), (W - 14, y0)], fill=(150, 150, 150), width=2)
        d.line([(X_BODY, y0), (X_BODY, y0 + L.lane_size[i])], fill=(150, 150, 150), width=2)
        _vtext(img, (L.lane_size[i], 50), name, B_LANE, (X_LANE + 2, int(y0)))

    used = _gw_used_tips(L, spec)

    # ---- cạnh (vẽ trước để nút đè lên đầu mút)
    labels = []
    for e in spec['edges']:
        label = e[2] if len(e) > 2 else None
        opt = spec.get('bpmn', {}).get('edges', {}).get((e[0], e[1]), e[3] if len(e) > 3 else {})
        pts = [P(p) for p in L.route(e[0], e[1], opt)]
        _arrow(d, pts, filled=True)
        if label:
            labels.append((label, pts))

    # ---- nút
    for n in L.nodes.values():
        x, y = P(L.xy(n['f'], n['l']))
        k = n['kind']
        if k in ('start', 'end'):
            d.ellipse([x - 24, y - 24, x + 24, y + 24], fill='white', outline=INK, width=6 if k == 'end' else 2)
            cap = 'Kết Thúc' if k == 'end' else 'Bắt Đầu'
            d.text((x - tw(cap, B_EVT) / 2, y + 30), cap, font=B_EVT, fill=INK)
        elif k in ('gw', 'merge'):
            r = 30
            d.polygon([(x, y - r), (x + r, y), (x, y + r), (x - r, y)], fill='white', outline=INK)
            d.line([(x, y - r), (x + r, y), (x, y + r), (x - r, y), (x, y - r)], fill=INK, width=2)
            if k == 'gw' and n['text']:
                u = used.get(n['id'], set())
                lines = wrap(n['text'], 190, B_GW)
                for i, ln in enumerate(lines):
                    if 'top' not in u:
                        tx, ty = x - tw(ln, B_GW) / 2, y - r - 8 - 26 * (len(lines) - i)
                    elif 'bot' not in u:
                        tx, ty = x - tw(ln, B_GW) / 2, y + r + 6 + 26 * i
                    elif 'right' not in u:              # hai đỉnh dọc đều có nhánh: đặt chéo phía trên bên phải
                        tx, ty = x + 18, y - r + 2 - 26 * (len(lines) - i)
                    else:
                        tx, ty = x - 18 - tw(ln, B_GW), y - r + 2 - 26 * (len(lines) - i)
                    d.rectangle([tx - 3, ty + 2, tx + tw(ln, B_GW) + 3, ty + 25], fill='white')
                    d.text((tx, ty), ln, font=B_GW, fill=INK)
        else:
            w, h = n['w'], n['h']
            d.rounded_rectangle([x - w / 2, y - h / 2, x + w / 2, y + h / 2], radius=12, fill='white', outline=INK, width=2)
            lines = n['lines']
            for i, ln in enumerate(lines):
                d.text((x - tw(ln, B_TASK) / 2, y - len(lines) * 27 / 2 + i * 27 + 1), ln, font=B_TASK, fill=INK)

    # ---- nhãn nhánh: chữ xám trên nền trắng, cắt ngang đường nối ngay sau điểm rẽ nhánh
    for label, pts in labels:
        lw = tw(label, B_EDGE)
        (x1, y1), (x2, y2) = pts[0], pts[1]
        if abs(x2 - x1) < 1 and len(pts) > 2 and abs(pts[2][1] - pts[1][1]) < 1:
            # đi dọc ra khỏi cổng rồi rẽ ngang: nhãn nằm trên đoạn ngang, sát góc rẽ (như "Thất bại" ở Hình 3.1)
            (x1, y1), (x2, y2) = pts[1], pts[2]
        if abs(y2 - y1) < 1:
            span = abs(x2 - x1)
            off = span / 2 if span < 2 * lw + 120 else lw / 2 + 34
            cx, cy = x1 + off * (1 if x2 > x1 else -1), y1
        else:
            cx, cy = x1, (y1 + y2) / 2
        d.rectangle([cx - lw / 2 - 4, cy - 13, cx + lw / 2 + 4, cy + 12], fill='white')
        d.text((cx - lw / 2, cy - 12), label, font=B_EDGE, fill=EDGE_INK)

    img.save(out, dpi=(300, 300))
    return img.size


def render(spec, mode, out):
    if mode == 'bpmn':
        return render_bpmn(spec, out)
    L = Layout(spec, mode)
    W, H = int(L.lane_total + 4), int(L.f_end + 30)
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)

    # ---- khung làn
    d.rectangle([1, 1, W - 2, H - 2], outline=INK, width=3)
    d.line([(0, 56), (W, 56)], fill=INK, width=2)
    for i, name in enumerate(spec['lanes']):
        x0 = L.lane_lo[i]
        if i:
            d.line([(x0, 0), (x0, H)], fill=INK, width=4)
        d.text((x0 + L.lane_size[i] / 2 - tw(name) / 2, 14), name, font=F_REG, fill=INK)

    # ---- cạnh
    labels = []
    for e in spec['edges']:
        a, b = e[0], e[1]
        label = e[2] if len(e) > 2 else None
        opt = e[3] if len(e) > 3 else {}
        pts = L.route(a, b, opt)
        _arrow(d, pts, filled=False)
        if label:
            labels.append((label, pts))

    # ---- nút
    for n in L.nodes.values():
        x, y = L.xy(n['f'], n['l'])
        k = n['kind']
        if k == 'start':
            d.ellipse([x - 23, y - 23, x + 23, y + 23], fill=INK)
        elif k == 'end':
            d.ellipse([x - 24, y - 24, x + 24, y + 24], fill='white', outline=INK, width=3)
            d.ellipse([x - 14, y - 14, x + 14, y + 14], fill=INK)
        elif k in ('gw', 'merge'):
            r = 30
            d.polygon([(x, y - r), (x + r, y), (x, y + r), (x - r, y)], fill='white', outline=INK)
            d.line([(x, y - r), (x + r, y), (x, y + r), (x - r, y), (x, y - r)], fill=INK, width=2)
            if k == 'gw' and n['text']:
                lines = wrap(n['text'], 300)
                for i, ln in enumerate(lines):
                    d.text((x + 22, y - r - 6 - 29 * (len(lines) - i)), ln, font=F_REG, fill=INK)
        else:
            w, h = n['w'], n['h']
            d.rounded_rectangle([x - w / 2, y - h / 2, x + w / 2, y + h / 2], radius=16, fill=(205, 205, 205), outline=(60, 60, 60), width=2)
            lines = n['lines']
            for i, ln in enumerate(lines):
                d.text((x - tw(ln) / 2, y - len(lines) * 29 / 2 + i * 29 + 1), ln, font=F_REG, fill=INK)
    # ---- nhãn nhánh: đặt trên đoạn ngang đầu tiên, vẽ sau cùng để không bị ô che
    for label, pts in labels:
        if len(pts) >= 3 and abs(pts[1][1] - pts[0][1]) < 1 and abs(pts[2][0] - pts[1][0]) < 1:
            # nhánh ngang rồi rẽ xuống: đặt nhãn ngay dưới góc rẽ của chính nhánh đó
            lx, ly = pts[1][0] + 8, pts[1][1] + 4
            d.rectangle([lx - 3, ly + 4, lx + tw(label) + 3, ly + 27], fill='white')
            d.text((lx, ly), label, font=F_REG, fill=INK)
            continue
        seg = None
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            if abs(y2 - y1) < 1 and abs(x2 - x1) > 1:
                seg = ((x1, y1), (x2, y2)); break
        if seg:
            (x1, y1), (x2, y2) = seg
            lx = (x1 + 8) if x2 > x1 else (x1 - 8 - tw(label))
            ly = y1 - 31
        else:
            (x1, y1), (x2, y2) = pts[0], pts[1]
            lx, ly = x1 + 8, y1 + (6 if y2 > y1 else -34)
        d.rectangle([lx - 3, ly + 4, lx + tw(label) + 3, ly + 27], fill='white')
        d.text((lx, ly), label, font=F_REG, fill=INK)

    img.save(out, dpi=(300, 300))
    return img.size
