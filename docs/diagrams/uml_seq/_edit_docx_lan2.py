# -*- coding: utf-8 -*-
"""Đợt rà soát 2: đồng bộ BPMN chức năng (3.2), sơ đồ hoạt động + tuần tự (3.5) với mã nguồn,
bỏ quy trình chức năng không còn được đặc tả, sửa câu chữ sai lệch, rút gọn giao diện chương 5."""
import copy, os, re, sys
from lxml import etree
from PIL import Image

WORK, DIA = sys.argv[1], sys.argv[2]
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W, 'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
q = lambda t: '{%s}%s' % (W, t.split(':')[1])
XS = '{http://www.w3.org/XML/1998/namespace}space'
doc_path = os.path.join(WORK, 'word', 'document.xml')
tree = etree.parse(doc_path)
body = tree.getroot().find('w:body', NS)
rels = etree.parse(os.path.join(WORK, 'word', '_rels', 'document.xml.rels')).getroot()
rid2t = {r.get('Id'): r.get('Target') for r in rels}
log = []


def ptext(el): return ''.join(t.text or '' for t in el.iter(q('w:t')))
def style(p):
    s = p.find('w:pPr/w:pStyle', NS)
    return s.get(q('w:val')) if s is not None else ''


def set_ptext(p, text):
    runs = p.findall('w:r', NS)
    first = runs[0]
    for r in runs[1:]:
        p.remove(r)
    for el in list(first):
        if el.tag != q('w:rPr'):
            first.remove(el)
    t = etree.SubElement(first, q('w:t')); t.text = text; t.set(XS, 'preserve')


def heading(prefix, sty='Heading4'):
    for p in body.iter(q('w:p')):
        if style(p) == sty and ptext(p).startswith(prefix):
            return p
    raise KeyError(prefix)


def section(p):
    """Các phần tử từ tiêu đề p tới trước tiêu đề cùng cấp hoặc cao hơn kế tiếp."""
    lvl = int(style(p)[-1])
    out, el = [p], p.getnext()
    while el is not None:
        if el.tag == q('w:p') and style(el).startswith('Heading') and style(el)[-1].isdigit() and int(style(el)[-1]) <= lvl:
            break
        out.append(el); el = el.getnext()
    return out


EMU_PX = 4500
TEXT_W = 5580000


def put_image(p, png, max_h=7900000):
    blip = p.find('.//a:blip', NS)
    tgt = rid2t[blip.get('{%s}embed' % NS['r'])]
    dst = os.path.join(WORK, 'word', tgt.replace('/', os.sep))
    assert dst.lower().endswith('.png'), dst
    open(dst, 'wb').write(open(png, 'rb').read())
    w, h = Image.open(png).size
    cx = min(TEXT_W, w * EMU_PX); cy = int(cx * h / w)
    if cy > max_h:
        cy = max_h; cx = int(cy * w / h)
    for ext in (p.find('.//wp:extent', NS), p.find('.//a:xfrm/a:ext', NS)):
        ext.set('cx', str(cx)); ext.set('cy', str(cy))
    p.find('.//pic:cNvPr', NS).set('name', os.path.basename(png))


def image_after(els, marker):
    """Đoạn chứa ảnh đứng sau đoạn đánh dấu (vd 'Sơ đồ BPMN:', 'Sơ đồ tuần tự')."""
    seen = False
    for el in els:
        if el.tag != q('w:p'):
            continue
        t = ptext(el).strip()
        if t.startswith(marker):
            seen = True; continue
        if seen and el.find('.//a:blip', NS) is not None:
            return el
    raise KeyError(marker)


# ======================================================== 1. Mục 3.2 – quy trình chức năng
BPMN = [('3.2.5.1 ', 'uc01'), ('3.2.5.2 ', 'uc02'), ('3.2.5.3 ', 'uc03'), ('3.2.5.4 ', 'uc04'), ('3.2.5.5 ', 'uc05'),
        ('3.2.5.6 ', 'uc06'), ('3.2.5.7 ', 'uc07'), ('3.2.6.1 ', 'uc08'), ('3.2.6.2 ', 'uc09'), ('3.2.6.3 ', 'uc10'),
        ('3.2.6.4 ', 'uc12'), ('3.2.6.5 ', 'uc13'), ('3.2.7.1 ', 'uc14'), ('3.2.7.2 ', None), ('3.2.7.3 ', 'uc16'),
        ('3.2.7.4 ', 'uc15'), ('3.2.7.5 ', 'uc17'), ('3.2.8.1 ', 'uc18'), ('3.2.8.2 ', 'uc19'), ('3.2.9.1 ', 'uc21'),
        ('3.2.9.2 ', 'uc22'), ('3.2.9.3 ', None), ('3.2.9.4 ', 'uc20'), ('3.2.9.5 ', 'uc11'), ('3.2.10.1 ', 'uc23'),
        ('3.2.10.2 ', 'uc24')]
RENAME32 = {'3.2.7.3 ': '3.2.7.2 ', '3.2.7.4 ': '3.2.7.3 ', '3.2.7.5 ': '3.2.7.4 ', '3.2.9.4 ': '3.2.9.3 ', '3.2.9.5 ': '3.2.9.4 '}
heads32 = {pre: heading(pre) for pre, _ in BPMN}
for pre, key in BPMN:
    h = heads32[pre]
    els = section(h)
    if key is None:
        log.append('Bỏ quy trình chức năng: ' + ptext(h))
        for el in els:
            body.remove(el)
        continue
    put_image(image_after(els, 'Sơ đồ BPMN'), os.path.join(DIA, f'{key}_bpmn.png'))
    if pre in RENAME32:
        set_ptext(h, RENAME32[pre] + ptext(h)[len(pre):])

# 3.2.5.4: thay quy trình khiếu nại bằng quy trình thanh toán chuyển khoản
h = heads32['3.2.5.4 ']
set_ptext(h, '3.2.5.4 Quy trình chức năng chọn phương thức và xác nhận thanh toán')
els = section(h)
i0 = next(i for i, el in enumerate(els) if ptext(el).strip() == 'Mô tả:')
i1 = next(i for i, el in enumerate(els) if ptext(el).strip().startswith('Sơ đồ BPMN'))
tpl = copy.deepcopy(els[i0 + 1])
for el in els[i0 + 1:i1]:
    body.remove(el)
STEPS = [
    '1. Khách hàng mở trang thanh toán của đơn chuyển khoản đang ở trạng thái "Chờ thanh toán".',
    '2. Hệ thống hiển thị mã VietQR đã điền sẵn số tiền, số tài khoản nhận và nội dung "AETHERPC <mã đơn>".',
    '3. Khách hàng quét mã bằng ứng dụng ngân hàng và chuyển khoản.',
    '4. Cổng SePay phát hiện tiền vào tài khoản và gửi thông báo giao dịch kèm khóa xác thực tới hệ thống.',
    '5. Hệ thống xác thực khóa, tìm mã đơn trong nội dung chuyển khoản và khóa đơn để các thông báo cùng đơn được xử lý lần lượt.',
    '6. Số tiền không nhỏ hơn tổng đơn → Hệ thống ghi khoản thanh toán thành công, chuyển đơn sang "Đã thanh toán", tự duyệt đơn, ghi bút toán thu và gửi email xác nhận.',
    '7. Trang thanh toán tự kiểm tra lại mỗi 3 giây và hiển thị "Thanh toán thành công".',
    'Các trường hợp rẽ nhánh:',
    '3.1 Quá 30 phút chưa thanh toán → Bộ lập lịch tự hủy đơn; khoản tiền về sau đó được ghi "Chờ hoàn tiền".',
    '5.1 Khóa xác thực sai hoặc nội dung không chứa mã đơn hợp lệ → Hệ thống bỏ qua giao dịch và ghi cảnh báo.',
    '5.2 SePay gửi lại cùng một giao dịch → Hệ thống nhận ra mã giao dịch đã xử lý, không ghi trùng.',
    '6.1 Khách chuyển dư → Phần dư được ghi "Chờ hoàn tiền" để Kế toán chuyển trả.',
    '6.2 Khách chuyển thiếu, chuyển trùng hoặc chuyển vào đơn đã hủy → Hệ thống không xác nhận đơn, ghi toàn bộ khoản "Chờ hoàn tiền".',
]
anchor = els[i0]
for t in STEPS:
    p = copy.deepcopy(tpl); set_ptext(p, t); anchor.addnext(p); anchor = p
for el in section(h):
    if el.tag == q('w:p') and style(el) == 'CaptionText':
        ts = el.findall('.//w:t', NS)
        ts[-1].text = ' Sơ đồ BPMN quy trình chức năng chọn phương thức và xác nhận thanh toán'
log.append('Thay quy trình chức năng 3.2.5.4 bằng quy trình thanh toán chuyển khoản SePay')

# ======================================================== 2. Mục 3.5 – sơ đồ hoạt động và tuần tự
UC35 = [('3.5.1.1 ', 'uc01'), ('3.5.1.2 ', 'uc02'), ('3.5.1.3 ', 'uc03'), ('3.5.1.4 ', 'uc04'), ('3.5.1.5 ', 'uc05'),
        ('3.5.1.6 ', 'uc06'), ('3.5.1.7 ', 'uc07'), ('3.5.2.1 ', 'uc08'), ('3.5.2.2 ', 'uc09'), ('3.5.2.3 ', 'uc10'),
        ('3.5.2.4 ', 'uc12'), ('3.5.2.5 ', 'uc13'), ('3.5.3.1 ', 'uc14'), ('3.5.3.2 ', 'uc16'), ('3.5.3.3 ', 'uc15'),
        ('3.5.3.4 ', 'uc17'), ('3.5.4.1 ', 'uc18'), ('3.5.4.2 ', 'uc19'), ('3.5.5.1 ', 'uc21'), ('3.5.5.2 ', 'uc22'),
        ('3.5.5.3 ', 'uc20'), ('3.5.5.4 ', 'uc11'), ('3.5.6.1 ', 'uc23'), ('3.5.6.2 ', 'uc24')]
for pre, key in UC35:
    els = section(heading(pre))
    put_image(image_after(els, 'Sơ đồ hoạt động'), os.path.join(DIA, f'{key}_act.png'))
    put_image(image_after(els, 'Sơ đồ tuần tự'), os.path.join(DIA, f'{key}_seq.png'))
log.append('Thay 24 sơ đồ hoạt động, 24 sơ đồ tuần tự, 24 sơ đồ BPMN chức năng')

# ======================================================== 3. Câu chữ sai lệch so với mã nguồn
SUBS = [
    ('6. Hệ thống kiểm tra tồn kho, tạo đơn POS và trừ kho.',
     '6. Hệ thống kiểm tra hạn mức chiết khấu, tạo đơn bán tại quầy ở trạng thái đã thanh toán, trừ kho có điều kiện và gán Serial.'),
    ('6. Hệ thống tạo Serial Number, cộng tồn kho, tính lại giá vốn bình quân gia quyền và ghi lịch sử nhập kho.',
     '6. Hệ thống tạo Serial Number, cộng tồn kho, tính lại giá vốn bình quân gia quyền, ghi lịch sử nhập kho và chuyển đơn mua hàng sang "Đã nhận hàng".'),
    ('4. Hệ thống kiểm tra thông tin với tài khoản nhân viên và nhà cung cấp; nếu không có thì kiểm tra tài khoản khách hàng.',
     '4. Hệ thống gửi đồng thời hai yêu cầu đăng nhập: tài khoản nội bộ (nhân viên, nhà cung cấp) và tài khoản khách hàng; yêu cầu nào thành công thì dùng kết quả đó.'),
    ('JSON Web Token hiệu lực 7 ngày)', 'JSON Web Token hiệu lực 1 ngày với nhân viên, nhà cung cấp và 7 ngày với khách hàng)'),
    ('và ghi nhật ký đăng nhập thất bại.', 'và ghi nhật ký đăng nhập thất bại với tài khoản nội bộ.'),
    ('6. Hệ thống kiểm tra tồn kho, tạo đơn bán tại quầy và trừ kho.',
     '6. Hệ thống kiểm tra hạn mức chiết khấu, tạo đơn bán tại quầy ở trạng thái đã thanh toán, trừ kho có điều kiện và gán Serial.'),
    ('6.1 Sản phẩm không đủ tồn kho → Hệ thống cảnh báo, không tạo đơn.',
     '4.1 Số lượng vượt tồn kho hiện có → Hệ thống cảnh báo, không thêm sản phẩm vào giỏ.'),
    ('6.1.1 Nhân viên điều chỉnh số lượng hoặc bỏ sản phẩm → quay lại bước 5.',
     '4.1.1 Nhân viên điều chỉnh số lượng → quay lại bước 3.'),
    ('6.2 Chiết khấu vượt hạn mức mà vai trò', '6.2 Chiết khấu vượt 10% giá trị đơn mà vai trò'),
    ('6.2 Phiếu vừa được người khác xử lý → Hệ thống báo trạng thái đã thay đổi, không ghi đè.',
     '6.2 Phiếu vừa được người khác xử lý → Hệ thống không ghi đè, hiển thị trạng thái hiện tại của phiếu.'),
    ('5.1 Yêu cầu đổi mới → Hệ thống tự tạo đơn đổi mới',
     '5.1 Yêu cầu đổi mới → Khi Thủ kho xác nhận nhập lại kệ, hệ thống tự tạo đơn đổi mới'),
    ('không kích hoạt hoàn tiền; Nhân viên giao hàng giao trả hàng lại cho khách.',
     'không kích hoạt hoàn tiền; đơn hàng trở về "Đã giao" để Nhân viên giao hàng giao trả lại cho khách.'),
    ('6. Hệ thống tạo số Serial, cộng tồn kho, tính lại giá vốn bình quân gia quyền và ghi lịch sử nhập kho.',
     '6. Hệ thống tạo số Serial, cộng tồn kho, tính lại giá vốn bình quân gia quyền, ghi lịch sử nhập kho và chuyển đơn mua hàng sang "Đã nhận hàng".'),
    ('7. Hệ thống đánh dấu báo giá được chọn (PENDING_PO_DRAFT) để lập phiếu mua hàng trình Ban giám đốc.',
     '7. Hệ thống kiểm tra mọi mặt hàng đã có đơn giá, chốt báo giá được chọn, hủy các báo giá còn lại trong đợt và lập phiếu mua hàng "Chờ Ban Giám đốc duyệt".'),
    ('7. Hệ thống đánh dấu báo giá được chọn để lập phiếu mua hàng trình Ban Giám đốc.',
     '7. Hệ thống kiểm tra mọi mặt hàng đã có đơn giá, chốt báo giá được chọn, hủy các báo giá còn lại trong đợt và lập phiếu mua hàng "Chờ Ban Giám đốc duyệt".'),
    ('4. Hệ thống kiểm tra tồn kho thực tế của từng sản phẩm.',
     '4. Hệ thống kiểm tra tồn kho thực tế của từng sản phẩm, tính giảm giá theo hạng thành viên và mã khuyến mãi.'),
    ('4.1 Một hoặc nhiều sản phẩm không đủ tồn kho → Hệ thống vẫn tạo đơn',
     '4.1 Đơn COD có sản phẩm không đủ tồn kho → Hệ thống vẫn tạo đơn'),
    ('6. Hệ thống cập nhật trạng thái đơn tương ứng và thông báo cho Kho lập phiếu nhập kho.',
     '6. Hệ thống cập nhật trạng thái đơn, lưu biên bản kiểm định (số lượng đạt, lỗi, tỷ lệ lấy mẫu); từ chối toàn bộ thì hủy phiếu nhập kho, ngược lại báo Kho nhập kho.'),
    ('đặc tả chi tiết 23 use case tiêu biểu', 'đặc tả chi tiết 24 use case tiêu biểu (mỗi tác nhân một đến hai use case)'),
    ('khách chọn thanh toán khi nhận hàng hoặc chuyển khoản qua mã QR.',
     'khách chọn thanh toán khi nhận hàng hoặc chuyển khoản; với chuyển khoản, hệ thống mở trang thanh toán mã VietQR và tự xác nhận khi cổng SePay báo tiền về.'),
]
for old, new in SUBS:
    n = 0
    for t in body.iter(q('w:t')):
        if t.text and old in t.text:
            t.text = t.text.replace(old, new); n += 1
    log.append(f'[{n}] {old[:70]}')

# ======================================================== 4. Chương 5: chỉ giữ giao diện minh họa use case tiêu biểu
KEEP = {
    '5.2.2.': ['5.2.2.1 ', '5.2.2.2 ', '5.2.2.3 ', '5.2.2.5 '],
    '5.2.3.': ['5.2.3.2 ', '5.2.3.3 ', '5.2.3.6 '],
    '5.2.4.': ['5.2.4.2 ', '5.2.4.5 ', '5.2.4.6 ', '5.2.4.7 '],
    '5.2.5.': ['5.2.5.2 ', '5.2.5.6 ', '5.2.5.7 ', '5.2.5.8 '],
    '5.2.6.': ['5.2.6.2 ', '5.2.6.3 '],
    '5.2.7.': ['5.2.7.5 ', '5.2.7.8 '],
    '5.2.8.': ['5.2.8.1 ', '5.2.8.3 ', '5.2.8.5 '],
}
h4s = [p for p in body.iter(q('w:p')) if style(p) == 'Heading4' and re.match(r'5\.2\.\d\.\d+ ', ptext(p))]
removed = 0
for grp, keep in KEEP.items():
    mine = [p for p in h4s if ptext(p).startswith(grp)]
    k = 0
    for p in mine:
        pre = re.match(r'5\.2\.\d\.\d+ ', ptext(p)).group(0)
        if pre in keep:
            k += 1
            set_ptext(p, f'{grp}{k} ' + ptext(p)[len(pre):])
        else:
            for el in section(p):
                body.remove(el)
            removed += 1
log.append(f'Chương 5: bỏ {removed} giao diện, giữ {sum(len(v) for v in KEEP.values())}')
h52 = heading('5.2 Giao diện chương trình', 'Heading2')
intro_tpl = next(p for p in body.iter(q('w:p')) if style(p) == 'ContentText' and ptext(p).startswith('Giao diện được tổ chức thành bốn khu vực'))
intro = copy.deepcopy(intro_tpl)
set_ptext(intro, 'Mục này trình bày sơ đồ site map và các giao diện minh họa cho 24 use case tiêu biểu đã đặc tả ở mục 3.5; mỗi tác nhân có một đến hai màn hình chính. Các màn hình phụ trợ như danh mục sản phẩm, tồn kho, sổ cái hay báo cáo vẫn có trong hệ thống nhưng không trình bày chi tiết để tránh dàn trải.')
h52.addnext(intro)

# ======================================================== 5. Đánh số lại Hình/Bảng chương 3 và 5, cập nhật tham chiếu
caption_ps = set()
maps = {}
for ch in ('3', '5'):
    cnt = {'Hình': 0, 'Bảng': 0}
    for p in body.iter(q('w:p')):
        if style(p) != 'CaptionText':
            continue
        mm = re.match(r'(Hình|Bảng) %s\.(\d+)' % ch, ptext(p))
        if not mm:
            continue
        caption_ps.add(p)
        kind, old = mm.group(1), int(mm.group(2))
        cnt[kind] += 1; new = cnt[kind]
        maps[(kind, ch, old)] = new
        for it in p.iter(q('w:instrText')):
            it.text = re.sub(r'\\r \d+', r'\\r %d' % new, it.text)
        sep = False
        for r in p.iter(q('w:r')):
            fc = r.find('w:fldChar', NS)
            if fc is not None and fc.get(q('w:fldCharType')) == 'separate':
                sep = True; continue
            if sep and r.find('w:t', NS) is not None:
                r.find('w:t', NS).text = str(new); break
    log.append(f'Chương {ch}: {cnt["Hình"]} hình, {cnt["Bảng"]} bảng')
pat = re.compile(r'(Hình|Bảng) ([35])\.(\d+)')
nref = 0
for p in body.iter(q('w:p')):
    if p in caption_ps or style(p).lower().startswith('tableoffigures') or style(p).lower().startswith('toc'):
        continue
    for t in p.iter(q('w:t')):
        if t.text and pat.search(t.text):
            def sub(m):
                global nref
                key = (m.group(1), m.group(2), int(m.group(3)))
                if key in maps and maps[key] != key[2]:
                    nref += 1
                    return f'{m.group(1)} {m.group(2)}.{maps[key]}'
                return m.group(0)
            t.text = pat.sub(sub, t.text)
log.append(f'Cập nhật {nref} tham chiếu')
dangling = sorted({m.group(0) for p in body.iter(q('w:p')) if p not in caption_ps
                   for m in pat.finditer(ptext(p)) if (m.group(1), m.group(2), int(m.group(3))) not in maps})
log.append('Tham chiếu không còn hình/bảng tương ứng: ' + ', '.join(dangling))

tree.write(doc_path, xml_declaration=True, encoding='UTF-8', standalone=True)
print('\n'.join(log))
