# -*- coding: utf-8 -*-
"""Vẽ đoạn mã theo giao diện Visual Studio Code (theme Dark+): thanh tiêu đề, tab tệp, đường dẫn breadcrumb,
cột số dòng, tô màu cú pháp theo bảng màu Dark+ và thanh trạng thái."""
from PIL import Image, ImageDraw, ImageFont
from pygments.lexer import RegexLexer, bygroups
from pygments.lexers import get_lexer_by_name
from pygments.token import Token, Keyword, Name, String, Comment, Number, Operator, Punctuation, Text, Literal

S = 2
MONO = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 14 * S)
UI = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12 * S)
UI_S = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 11 * S)

BG, GUTTER_FG, FG = (31, 31, 31), (110, 118, 129), (212, 212, 212)
TITLE_BG, TABBAR_BG, TAB_ACTIVE, TAB_TOP = (24, 24, 24), (24, 24, 24), (31, 31, 31), (0, 120, 212)
STATUS_BG, BORDER = (0, 122, 204), (43, 43, 43)

# bảng màu Dark+
C = {'kw': (86, 156, 214), 'ctrl': (197, 134, 192), 'str': (206, 145, 120), 'cmt': (106, 153, 85), 'num': (181, 206, 168),
     'fn': (220, 220, 170), 'var': (156, 220, 254), 'type': (78, 201, 176), 'fg': FG, 'tag': (86, 156, 214)}


def color_of(tt, lang):
    if tt in Comment or tt in Token.Comment:
        return C['cmt']
    if tt in String or tt in Literal.String:
        return C['str']
    if tt in Number:
        return C['num']
    if lang == 'javascript':
        if tt in Keyword.Declaration or tt in Keyword.Constant or tt in Keyword.Type:
            return C['kw']
        if tt in Keyword:
            return C['ctrl']
        if tt in Name.Function or tt in Name.Function.Magic:
            return C['fn']
        if tt in Name.Builtin or tt in Name.Class:
            return C['type']
        if tt in Name:
            return C['var']
    if lang in ('yaml',):
        if tt in Name.Tag or tt in Name.Attribute:
            return C['tag']
        if tt in Literal.Scalar or tt in Name.Constant:
            return C['str']
        if tt in Keyword or tt in Name.Variable:
            return C['kw']
    if lang == 'ini':
        if tt in Name.Attribute or tt in Keyword or tt in Name.Builtin:
            return C['var']
        if tt in Name or tt in Text:
            return C['str'] if tt not in Text.Whitespace else FG
    if lang in ('docker', 'nginx', 'prisma'):
        if tt in Keyword or tt in Name.Builtin:
            return C['kw']
        if tt in Name.Variable or tt in Name.Attribute:
            return C['var']
        if tt in Name.Function:
            return C['fn']
        if tt in Name.Class or tt in Keyword.Type:
            return C['type']
    if tt in Keyword:
        return C['kw']
    return FG


class PrismaLexer(RegexLexer):
    name = 'Prisma'
    tokens = {'root': [
        (r'//.*$', Comment.Single),
        (r'"[^"]*"', String),
        (r'\b(generator|datasource|model|enum)(\s+)(\w+)', bygroups(Keyword, Text, Name.Class)),
        (r'\b(env)\b', Name.Function),
        (r'\b\w+(?=\s*=)', Name.Attribute),
        (r'[{}()=]', Punctuation),
        (r'\s+', Text), (r'.', Text),
    ]}


def lexer_for(lang):
    return PrismaLexer() if lang == 'prisma' else get_lexer_by_name(lang)


def _lines_tokens(src, lang):
    lines = [[]]
    for tt, val in lexer_for(lang).get_tokens(src):
        parts = val.split('\n')
        for i, part in enumerate(parts):
            if i:
                lines.append([])
            if part:
                lines[-1].append((color_of(tt, lang), part))
    if lines and not lines[-1]:
        lines.pop()
    return lines


def editor(src, lang, filename, crumbs, lang_label, min_w=760):
    """Trả về ảnh một cửa sổ VS Code chứa đoạn mã."""
    lines = _lines_tokens(src, lang)
    lh = 20 * S
    d0 = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    gw = d0.textlength(str(len(lines)), font=MONO) + 34 * S
    code_w = max((sum(d0.textlength(t, font=MONO) for _, t in ln) for ln in lines), default=0)
    w = int(max(min_w * S, gw + code_w + 40 * S))
    title_h, tab_h, crumb_h, status_h = 30 * S, 34 * S, 24 * S, 22 * S
    h = title_h + tab_h + crumb_h + 8 * S + lh * len(lines) + 12 * S + status_h
    img = Image.new('RGB', (w, int(h)), BG)
    d = ImageDraw.Draw(img)
    # thanh tiêu đề
    d.rectangle([0, 0, w, title_h], fill=TITLE_BG)
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([12 * S + i * 18 * S, 10 * S, 22 * S + i * 18 * S, 20 * S], fill=c)
    t = f'{filename} — ERP_AetherPC — Visual Studio Code'
    d.text(((w - d.textlength(t, font=UI_S)) / 2, 8 * S), t, font=UI_S, fill=(204, 204, 204))
    # thanh tab
    y0 = title_h
    d.rectangle([0, y0, w, y0 + tab_h], fill=TABBAR_BG)
    tab_w = d.textlength(filename, font=UI) + 60 * S
    d.rectangle([0, y0, tab_w, y0 + tab_h], fill=TAB_ACTIVE)
    d.rectangle([0, y0, tab_w, y0 + 2 * S], fill=TAB_TOP)
    d.text((14 * S, y0 + 8 * S), filename, font=UI, fill=(255, 255, 255))
    d.text((tab_w - 22 * S, y0 + 7 * S), '×', font=UI, fill=(160, 160, 160))
    d.line([(0, y0 + tab_h), (w, y0 + tab_h)], fill=BORDER, width=S)
    # breadcrumb
    y1 = y0 + tab_h
    d.text((14 * S, y1 + 4 * S), '  ›  '.join(crumbs), font=UI_S, fill=(169, 169, 169))
    # mã
    y = y1 + crumb_h + 8 * S
    for n, ln in enumerate(lines, 1):
        num = str(n)
        d.text((gw - 18 * S - d.textlength(num, font=MONO), y), num, font=MONO, fill=GUTTER_FG)
        x = gw
        for col, txt in ln:
            d.text((x, y), txt, font=MONO, fill=col)
            x += d.textlength(txt, font=MONO)
        y += lh
    # thanh trạng thái
    ys = h - status_h
    d.rectangle([0, ys, w, h], fill=STATUS_BG)
    # biểu tượng nhánh git (hai nút tròn nối nhánh) + tên nhánh
    wh = (255, 255, 255)
    bx, by = 12 * S, ys + 5 * S
    d.line([(bx + 3 * S, by + 2 * S), (bx + 3 * S, by + 11 * S)], fill=wh, width=S)
    d.ellipse([bx + 1 * S, by, bx + 5 * S, by + 4 * S], outline=wh, width=S)
    d.ellipse([bx + 1 * S, by + 9 * S, bx + 5 * S, by + 13 * S], outline=wh, width=S)
    d.ellipse([bx + 8 * S, by + 2 * S, bx + 12 * S, by + 6 * S], outline=wh, width=S)
    d.line([(bx + 10 * S, by + 6 * S), (bx + 4 * S, by + 10 * S)], fill=wh, width=S)
    d.text((bx + 17 * S, ys + 3 * S), 'main', font=UI_S, fill=wh)
    right = f'Ln 1, Col 1    Spaces: 2    UTF-8    LF    {lang_label}'
    d.text((w - d.textlength(right, font=UI_S) - 12 * S, ys + 3 * S), right, font=UI_S, fill=(255, 255, 255))
    return img


def save_editor(src, lang, out, filename, crumbs, lang_label):
    editor(src, lang, filename, crumbs, lang_label).save(out, dpi=(300, 300))


def save_stack(parts, out, gap=14):
    """Nhiều cửa sổ editor xếp dọc trong một ảnh (vd. schema.prisma + database.js)."""
    w0 = max(editor(*p).width for p in parts)
    ims = [editor(*p, min_w=w0 / S) for p in parts]
    w = max(i.width for i in ims)
    h = sum(i.height for i in ims) + gap * S * (len(ims) - 1)
    canvas = Image.new('RGB', (w, h), 'white')
    y = 0
    for im in ims:
        canvas.paste(im, (0, y)); y += im.height + gap * S
    canvas.save(out, dpi=(300, 300))
