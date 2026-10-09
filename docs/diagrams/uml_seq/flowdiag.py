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


class Layout:
    """Toạ độ trừu tượng: f = trục luồng, l = trục làn. Hướng ngang (BPMN) hoặc dọc (hoạt động)."""

    def __init__(self, spec, mode):
        self.s, self.mode = spec, mode
        self.nodes = {n[0]: dict(id=n[0], lane=n[1], step=n[2], sub=n[3], kind=n[4], text=n[5]) for n in spec['nodes']}
        nl = len(spec['lanes'])
        subs = {i: [n['sub'] for n in self.nodes.values() if n['lane'] == i] or [0] for i in range(nl)}
        if mode == 'bpmn':
            self.SF, self.SUB = 265, 135
            self.TW, self.TH = 220, 84
            self.F0 = 230                 # sau cột tên pool và làn
            base = 200
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
                maxw = self.TW - 26
                n['lines'] = wrap(n['text'], maxw)
                w = self.TW if mode == 'bpmn' else min(self.TW, max(220, max(tw(x) for x in n['lines']) + 44))
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
            if opt.get('side') == 'hi':
                v = max(A['l'] + A['hl'], B['l'] + B['hl']) + 40
            else:
                v = min(A['l'] - A['hl'], B['l'] - B['hl']) - 40
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


def render(spec, mode, out):
    L = Layout(spec, mode)
    if mode == 'bpmn':
        W, H = int(L.f_end + 20), int(L.lane_total + 110)
        OY = 70
    else:
        W, H = int(L.lane_total + 4), int(L.f_end + 30)
        OY = 0
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)

    def P(pt):
        return (pt[0], pt[1] + OY) if mode == 'bpmn' else pt

    # ---- khung làn
    if mode == 'bpmn':
        title = 'Quy Trình Chức Năng ' + spec['title']
        d.rectangle([14, 12, 40 + tw(title, F_BOLD) + 30, 56], outline=INK, width=2)
        d.text((32, 22), title, font=F_BOLD, fill=INK)
        top, bot = OY, OY + L.lane_total
        d.rectangle([20, top, W - 12, bot], outline=(60, 60, 60), width=2)
        d.line([(70, top), (70, bot)], fill=(60, 60, 60), width=2)
        pool = Image.new('RGB', (int(L.lane_total), 48), 'white')
        pd = ImageDraw.Draw(pool)
        pt = 'Hệ Thống AetherPC'
        pd.text((L.lane_total / 2 - tw(pt, F_LANE) / 2, 10), pt, font=F_LANE, fill=INK)
        img.paste(pool.rotate(90, expand=True), (22, int(top)))
        for i, name in enumerate(spec['lanes']):
            y0 = top + L.lane_lo[i]
            y1 = y0 + L.lane_size[i]
            d.line([(70, y0), (W - 12, y0)], fill=(140, 140, 140), width=2)
            d.line([(125, y0), (125, y1)], fill=(140, 140, 140), width=2)
            lab = Image.new('RGB', (int(L.lane_size[i]), 46), 'white')
            ld = ImageDraw.Draw(lab)
            if tw(name, F_LANE) > L.lane_size[i] - 16:     # tên dài: hai dòng, chữ nhỏ hơn
                fs = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 19)
                for k, part in enumerate(wrap(name, L.lane_size[i] - 16, fs)[:2]):
                    ld.text((L.lane_size[i] / 2 - tw(part, fs) / 2, 1 + 22 * k), part, font=fs, fill=INK)
            else:
                ld.text((L.lane_size[i] / 2 - tw(name, F_LANE) / 2, 10), name, font=F_LANE, fill=INK)
            img.paste(lab.rotate(90, expand=True), (74, int(y0)))
    else:
        d.rectangle([1, 1, W - 2, H - 2], outline=INK, width=3)
        d.line([(0, 56), (W, 56)], fill=INK, width=2)
        for i, name in enumerate(spec['lanes']):
            x0 = L.lane_lo[i]
            if i:
                d.line([(x0, 0), (x0, H)], fill=INK, width=4)
            d.text((x0 + L.lane_size[i] / 2 - tw(name) / 2, 14), name, font=F_REG, fill=INK)

    # ---- đỉnh trên/dưới của hình thoi đã có đường đi qua (để đặt câu hỏi vào chỗ trống)
    used = {}
    for e in spec['edges']:
        a, b = e[0], e[1]
        A, B = L.nodes[a], L.nodes[b]
        for g, other in ((A, B), (B, A)):
            if g['kind'] in ('gw', 'merge') and other['l'] != g['l']:
                pts = L.route(a, b, e[3] if len(e) > 3 else {})
                gx, gy = L.xy(g['f'], g['l'])
                for (px, py) in (pts[0], pts[-1]):
                    if abs(px - gx) < 2 and abs(py - (gy - g['hl'])) < 2 and mode == 'bpmn':
                        used.setdefault(g['id'], set()).add('top')
                    if abs(px - gx) < 2 and abs(py - (gy + g['hl'])) < 2 and mode == 'bpmn':
                        used.setdefault(g['id'], set()).add('bot')

    # ---- cạnh
    labels = []
    for e in spec['edges']:
        a, b = e[0], e[1]
        label = e[2] if len(e) > 2 else None
        opt = e[3] if len(e) > 3 else {}
        pts = [P(p) for p in L.route(a, b, opt)]
        _arrow(d, pts, filled=(mode == 'bpmn'))
        if label:
            labels.append((label, pts))

    # ---- nút
    for n in L.nodes.values():
        x, y = P(L.xy(n['f'], n['l']))
        k = n['kind']
        if k == 'start':
            if mode == 'bpmn':
                d.ellipse([x - 25, y - 25, x + 25, y + 25], fill='white', outline=INK, width=3)
                d.text((x - tw('Bắt Đầu') / 2, y + 30), 'Bắt Đầu', font=F_REG, fill=INK)
            else:
                d.ellipse([x - 23, y - 23, x + 23, y + 23], fill=INK)
        elif k == 'end':
            if mode == 'bpmn':
                d.ellipse([x - 25, y - 25, x + 25, y + 25], fill='white', outline=INK, width=6)
                d.text((x - tw('Kết Thúc') / 2, y + 30), 'Kết Thúc', font=F_REG, fill=INK)
            else:
                d.ellipse([x - 24, y - 24, x + 24, y + 24], fill='white', outline=INK, width=3)
                d.ellipse([x - 14, y - 14, x + 14, y + 14], fill=INK)
        elif k in ('gw', 'merge'):
            r = 30
            d.polygon([(x, y - r), (x + r, y), (x, y + r), (x - r, y)], fill='white', outline=INK)
            d.line([(x, y - r), (x + r, y), (x, y + r), (x - r, y), (x, y - r)], fill=INK, width=2)
            if k == 'gw' and n['text']:
                if mode == 'bpmn':
                    # phía trên bên trái hình thoi: không chạm nhánh dọc (đi ra từ đỉnh/đáy) và nhánh ngang
                    u = used.get(n['id'], set())
                    lines = wrap(n['text'], 170 if ('top' not in u or 'bot' not in u) else 150, F_BOLD)
                    for i, ln in enumerate(lines):
                        if 'top' not in u:
                            tx, ty = x - tw(ln, F_BOLD) / 2, y - r - 6 - 29 * (len(lines) - i)
                        elif 'bot' not in u:
                            tx, ty = x - tw(ln, F_BOLD) / 2, y + r + 4 + 29 * i
                        else:
                            tx, ty = x - 14 - tw(ln, F_BOLD), y - 12 - 29 * (len(lines) - i)
                        d.rectangle([tx - 2, ty + 3, tx + tw(ln, F_BOLD) + 2, ty + 27], fill='white')
                        d.text((tx, ty), ln, font=F_BOLD, fill=INK)
                else:
                    lines = wrap(n['text'], 300)
                    for i, ln in enumerate(lines):
                        d.text((x + 22, y - r - 6 - 29 * (len(lines) - i)), ln, font=F_REG, fill=INK)
        else:
            w, h = n['w'], n['h']
            if mode == 'bpmn':
                d.rounded_rectangle([x - w / 2, y - h / 2, x + w / 2, y + h / 2], radius=12, fill='white', outline=INK, width=2)
            else:
                d.rounded_rectangle([x - w / 2, y - h / 2, x + w / 2, y + h / 2], radius=16, fill=(205, 205, 205), outline=(60, 60, 60), width=2)
            lines = n['lines']
            for i, ln in enumerate(lines):
                d.text((x - tw(ln) / 2, y - len(lines) * 29 / 2 + i * 29 + 1), ln, font=F_REG, fill=INK)
    # ---- nhãn nhánh: đặt trên đoạn ngang đầu tiên, vẽ sau cùng để không bị ô che
    for label, pts in labels:
        if mode == 'act' and len(pts) >= 3 and abs(pts[1][1] - pts[0][1]) < 1 and abs(pts[2][0] - pts[1][0]) < 1:
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
