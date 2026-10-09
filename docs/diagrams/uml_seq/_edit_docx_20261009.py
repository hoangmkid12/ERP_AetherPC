# -*- coding: utf-8 -*-
"""Chỉnh AetherPC_KLTN.docx (đã giải nén ở thư mục work/):
- mỗi tác nhân 1–2 use case tiêu biểu (bỏ 2 use case, thay 1 use case bằng thanh toán SePay)
- thay toàn bộ sơ đồ tuần tự bằng bản vẽ mới
- cập nhật lời văn về thanh toán chuyển khoản tự động qua SePay
- đánh số lại Hình 3.x / Bảng 3.x và các tham chiếu
"""
import copy, re, os, sys
from lxml import etree
from PIL import Image

WORK = sys.argv[1]
SEQ_DIR = sys.argv[2]
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W,
      'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
q = lambda t: '{%s}%s' % (W, t.split(':')[1]) if t.startswith('w:') else t
XMLNS = '{http://www.w3.org/XML/1998/namespace}space'

doc_path = os.path.join(WORK, 'word', 'document.xml')
tree = etree.parse(doc_path)
root = tree.getroot()
body = root.find('w:body', NS)
rels = etree.parse(os.path.join(WORK, 'word', '_rels', 'document.xml.rels')).getroot()
rid2target = {r.get('Id'): r.get('Target') for r in rels}

log = []


def ptext(el):
    return ''.join(t.text or '' for t in el.iter(q('w:t')))


def style(p):
    s = p.find('w:pPr/w:pStyle', NS)
    return s.get(q('w:val')) if s is not None else ''


def children():
    return list(body)


def set_ptext(p, text):
    """Đặt lại nội dung đoạn: giữ pPr và định dạng của run đầu tiên."""
    runs = p.findall('w:r', NS)
    first = runs[0]
    for r in runs[1:]:
        p.remove(r)
    for el in list(first):
        if el.tag != q('w:rPr'):
            first.remove(el)
    t = etree.SubElement(first, q('w:t'))
    t.text = text
    t.set(XMLNS, 'preserve')


def find_para(pred, start=0):
    ch = children()
    for i in range(start, len(ch)):
        if ch[i].tag == q('w:p') and pred(ch[i]):
            return i, ch[i]
    raise KeyError('không tìm thấy đoạn')


def next_tbl(el):
    el = el.getnext()
    while el is not None and el.tag != q('w:tbl'):
        el = el.getnext()
    return el


def para_startswith(prefix, sty=None):
    return find_para(lambda p: ptext(p).startswith(prefix) and (sty is None or style(p) == sty))


# ---------------------------------------------------------------- 1. Mục use case
H4 = 'Heading4'


def section_range(prefix):
    i, _ = para_startswith(prefix, H4)
    ch = children()
    j = i + 1
    while j < len(ch):
        if ch[j].tag == q('w:p') and style(ch[j]) in ('Heading2', 'Heading3', 'Heading4'):
            break
        j += 1
    return i, j


def drawings_in(i, j):
    """Trả về (đoạn chứa ảnh hoạt động, đoạn chứa ảnh tuần tự) trong mục."""
    ch = children()
    act = seq = None
    mode = None
    for k in range(i, j):
        el = ch[k]
        if el.tag != q('w:p'):
            continue
        t = ptext(el).strip()
        if t == 'Sơ đồ hoạt động':
            mode = 'act'
        elif t.startswith('Sơ đồ tuần tự'):
            mode = 'seq'
        elif el.find('.//a:blip', NS) is not None:
            if mode == 'act' and act is None:
                act = el
            elif mode == 'seq' and seq is None:
                seq = el
    return act, seq


TEXT_W_EMU = 5580000  # bề rộng vùng chữ 15,5 cm


def replace_image(p, png_path, max_h_emu=7600000):
    blip = p.find('.//a:blip', NS)
    rid = blip.get('{%s}embed' % NS['r'])
    target = rid2target[rid]
    dst = os.path.join(WORK, 'word', target.replace('/', os.sep))
    assert dst.lower().endswith('.png'), dst
    with open(png_path, 'rb') as f:
        data = f.read()
    with open(dst, 'wb') as f:
        f.write(data)
    w, h = Image.open(png_path).size
    cx = TEXT_W_EMU
    cy = int(cx * h / w)
    if cy > max_h_emu:
        cy = max_h_emu
        cx = int(cy * w / h)
    p.find('.//wp:extent', NS).set('cx', str(cx))
    p.find('.//wp:extent', NS).set('cy', str(cy))
    ext = p.find('.//a:xfrm/a:ext', NS)
    ext.set('cx', str(cx)); ext.set('cy', str(cy))
    p.find('.//pic:cNvPr', NS).set('name', os.path.basename(png_path))
    return target


# (tiêu đề cũ, tiêu đề mới, sơ đồ tuần tự) — None nghĩa là bỏ mục
SECTIONS = [
    ('3.5.1.1 ', '3.5.1.1 Use case Đăng ký tài khoản', 'uc01'),
    ('3.5.1.2 ', '3.5.1.2 Use case Tự cấu hình máy tính', 'uc02'),
    ('3.5.1.3 ', '3.5.1.3 Use case Đặt hàng', 'uc03'),
    ('3.5.1.4 ', '3.5.1.4 Use case Chọn phương thức và xác nhận thanh toán', 'uc04'),
    ('3.5.1.5 ', '3.5.1.5 Use case Trả lời chat trực tuyến', 'uc05'),
    ('3.5.1.6 ', '3.5.1.6 Use case Bán hàng tại quầy', 'uc06'),
    ('3.5.1.7 ', '3.5.1.7 Use case Xử lý và cập nhật đơn hàng', 'uc07'),
    ('3.5.2.1 ', '3.5.2.1 Use case Lập yêu cầu báo giá và so sánh báo giá', 'uc08'),
    ('3.5.2.2 ', '3.5.2.2 Use case Phản hồi yêu cầu báo giá', 'uc09'),
    ('3.5.2.3 ', '3.5.2.3 Use case Duyệt đơn mua hàng', 'uc10'),
    ('3.5.2.4 ', '3.5.2.4 Use case Kiểm tra chất lượng hàng nhập', 'uc12'),
    ('3.5.2.5 ', '3.5.2.5 Use case Thẩm định hàng hoàn trả', 'uc13'),
    ('3.5.3.1 ', '3.5.3.1 Use case Nghiệm thu hàng nhập kho', 'uc14'),
    ('3.5.3.2 ', None, None),                                   # Lập phiếu đề xuất mua hàng
    ('3.5.3.3 ', '3.5.3.2 Use case Cập nhật tiến độ lắp ráp', 'uc16'),
    ('3.5.3.4 ', '3.5.3.3 Use case Xác nhận xuất kho và phân công giao hàng', 'uc15'),
    ('3.5.3.5 ', '3.5.3.4 Use case Giao hàng và thu tiền hộ', 'uc17'),
    ('3.5.4.1 ', '3.5.4.1 Use case Thanh toán nhà cung cấp', 'uc18'),
    ('3.5.4.2 ', '3.5.4.2 Use case Đối soát tiền thu hộ', 'uc19'),
    ('3.5.5.1 ', '3.5.5.1 Use case Đăng ký khuôn mặt', 'uc21'),
    ('3.5.5.2 ', '3.5.5.2 Use case Chấm công bằng khuôn mặt', 'uc22'),
    ('3.5.5.3 ', None, None),                                   # Xin nghỉ phép
    ('3.5.5.4 ', '3.5.5.3 Use case Tính lương và trình duyệt bảng lương', 'uc20'),
    ('3.5.5.5 ', '3.5.5.4 Use case Duyệt bảng lương toàn công ty', 'uc11'),
    ('3.5.6.1 ', '3.5.6.1 Use case Đăng nhập', 'uc23'),
    ('3.5.6.2 ', '3.5.6.2 Use case Quản trị tài khoản, phân quyền và nhật ký', 'uc24'),
]

# Ghi nhận phần tử tiêu đề trước khi đổi số (tránh khớp nhầm sau khi đổi)
heads = {}
for old, new, key in SECTIONS:
    i, p = para_startswith(old, H4)
    heads[old] = p
for old, new, key in SECTIONS:
    p = heads[old]
    i = children().index(p)
    _, j = section_range(ptext(p)[:9])
    if new is None:
        removed = ptext(p)
        for el in children()[i:j]:
            body.remove(el)
        log.append(f'Bỏ mục: {removed}')
        continue
    act, seq = drawings_in(i, j)
    replace_image(seq, os.path.join(SEQ_DIR, f'{key}_seq.png'))
    if key == 'uc04':
        replace_image(act, os.path.join(SEQ_DIR, 'uc04_act.png'))
    if ptext(p) != new:
        log.append(f'Đổi tiêu đề: {ptext(p)}  →  {new}')
        set_ptext(p, new)

# ---------------------------------------------------------------- 2. Use case thanh toán SePay
i, j = section_range('3.5.1.4 ')
ch = children()
for el in ch[i:j]:
    if el.tag == q('w:p') and style(el) == 'CaptionText':
        ts = el.findall('.//w:t', NS)
        last = ts[-1]
        last.text = (last.text
                     .replace('Đặc tả use case Gửi khiếu nại và yêu cầu đổi trả', 'Đặc tả use case Chọn phương thức và xác nhận thanh toán')
                     .replace('Sơ đồ hoạt động use case Gửi khiếu nại và yêu cầu đổi trả', 'Sơ đồ hoạt động use case Chọn phương thức và xác nhận thanh toán')
                     .replace('Sơ đồ tuần tự use case Gửi khiếu nại và yêu cầu đổi trả', 'Sơ đồ tuần tự use case Chọn phương thức và xác nhận thanh toán'))
tbl = next(el for el in ch[i:j] if el.tag == q('w:tbl'))

SPEC = {
    'Tên use case: ': 'Chọn phương thức và xác nhận thanh toán',
    'Mô tả sơ lược chức năng: ': 'Cho phép khách hàng thanh toán đơn chuyển khoản bằng mã VietQR. Hệ thống nhận thông báo giao dịch từ cổng thanh toán SePay và tự xác nhận thanh toán, không cần nhân viên đối soát thủ công.',
    'Actor chính: ': 'Khách hàng thành viên',
    'Actor phụ: ': 'Cổng thanh toán SePay, Nhân viên kế toán (hoàn trả các khoản chuyển sai)',
    'Tiền điều kiện (Pre-condition): ': 'Khách hàng đã đăng nhập; đơn hàng thuộc khách, chọn phương thức chuyển khoản và đang ở trạng thái "Chờ thanh toán"; cửa hàng đã khai báo tài khoản nhận tiền liên kết với SePay.',
    'Hậu điều kiện (Post-condition): ': 'Đơn được đánh dấu "Đã thanh toán" và được duyệt tự động (trừ kho, gán Serial hoặc chuyển "Chờ nhập hàng" nếu thiếu hàng); bút toán thu được ghi vào sổ cái và khách nhận email xác nhận. Khoản chuyển sai số tiền được ghi "Chờ hoàn tiền" để Kế toán xử lý.',
}
MAIN = [
    ('1. Khách hàng mở trang thanh toán của đơn.', '2. Hệ thống hiển thị mã VietQR đã điền sẵn số tiền, số tài khoản nhận và nội dung "AETHERPC <mã đơn>".'),
    ('3. Khách hàng quét mã bằng ứng dụng ngân hàng và chuyển khoản.', '4. Cổng SePay phát hiện tiền vào tài khoản và gửi thông báo giao dịch kèm khóa xác thực tới hệ thống.'),
    ('', '5. Hệ thống xác thực khóa, tìm mã đơn trong nội dung chuyển khoản và khóa đơn để các thông báo cùng đơn được xử lý lần lượt.'),
    ('', '6. Số tiền không nhỏ hơn tổng đơn → Hệ thống ghi khoản thanh toán thành công, chuyển đơn sang "Đã thanh toán", tự duyệt đơn, ghi bút toán thu và gửi email xác nhận.'),
    ('', '7. Trang thanh toán tự kiểm tra lại mỗi 3 giây và hiển thị "Thanh toán thành công".'),
]
ALT = [
    ('', '6.1 Khách chuyển dư → Phần dư được ghi "Chờ hoàn tiền" để Kế toán chuyển trả.'),
    ('', '6.2 Khách chuyển thiếu, chuyển trùng hoặc chuyển vào đơn đã hủy → Hệ thống không xác nhận đơn, ghi toàn bộ khoản "Chờ hoàn tiền"; trang thanh toán báo khoản này sẽ được hoàn lại.'),
]
EXC = [
    ('', '3.1 Quá 30 phút chưa thanh toán → Bộ lập lịch tự hủy đơn; khoản tiền về sau đó được ghi "Chờ hoàn tiền".'),
    ('', '5.1 Khóa xác thực không đúng → Hệ thống từ chối thông báo giao dịch.'),
    ('', '5.2 Nội dung chuyển khoản không chứa mã đơn hợp lệ → Hệ thống bỏ qua giao dịch và ghi cảnh báo để đối soát thủ công.'),
    ('', '5.3 SePay gửi lại cùng một giao dịch → Hệ thống nhận ra mã giao dịch đã xử lý, không ghi trùng.'),
]


def cell_set(tc, text):
    ps = tc.findall('w:p', NS)
    for p in ps[1:]:
        tc.remove(p)
    p = ps[0]
    runs = p.findall('w:r', NS)
    if not runs:
        r = etree.SubElement(p, q('w:r'))
        rpr = etree.SubElement(r, q('w:rPr'))
        f = etree.SubElement(rpr, q('w:rFonts')); f.set(q('w:cs'), 'Times New Roman')
        s = etree.SubElement(rpr, q('w:szCs')); s.set(q('w:val'), '26')
        runs = [r]
    for r in runs[1:]:
        p.remove(r)
    r = runs[0]
    for el in list(r):
        if el.tag != q('w:rPr'):
            r.remove(el)
    if text:
        t = etree.SubElement(r, q('w:t')); t.text = text; t.set(XMLNS, 'preserve')


rows = tbl.findall('w:tr', NS)
two_col_tpl = None
sections = {'main': [], 'alt': [], 'exc': []}
cur = None
for tr in rows:
    tcs = tr.findall('w:tc', NS)
    txt = ptext(tr)
    if len(tcs) == 1:
        for label, val in SPEC.items():
            if txt.startswith(label):
                ts = tr.findall('.//w:t', NS)
                ts[-1].text = val
                for t in ts[1:-1]:
                    t.text = ''
        if txt.startswith('Dòng sự kiện chính'):
            cur = 'main'
        elif txt.startswith('Dòng sự kiện thay thế'):
            cur = 'alt'
        elif txt.startswith('Dòng sự kiện ngoại lệ'):
            cur = 'exc'
    elif txt.strip() not in ('ActorSystem',):
        if two_col_tpl is None:
            two_col_tpl = copy.deepcopy(tr)
        sections[cur].append(tr)


def rebuild(sec, data):
    old = sections[sec]
    anchor = old[0].getprevious()
    for tr in old:
        tbl.remove(tr)
    for a, s in data:
        tr = copy.deepcopy(two_col_tpl)
        tcs = tr.findall('w:tc', NS)
        cell_set(tcs[0], a); cell_set(tcs[1], s)
        anchor.addnext(tr)
        anchor = tr


rebuild('main', MAIN); rebuild('alt', ALT); rebuild('exc', EXC)
log.append('Thay use case "Gửi khiếu nại và yêu cầu đổi trả" bằng "Chọn phương thức và xác nhận thanh toán" (SePay)')

# ---------------------------------------------------------------- 3. Sửa lời văn theo luồng SePay
REPL = [
    # (đoạn bắt đầu bằng, văn bản mới)
    ('Một số bước kiểm soát bên trong không thể hiện chi tiết trên sơ đồ: đơn chuyển khoản phải được đối soát',
     'Một số bước kiểm soát bên trong không thể hiện chi tiết trên sơ đồ: đơn chuyển khoản chỉ được xác nhận khi cổng thanh toán SePay báo tiền đã vào tài khoản và tự hủy nếu quá 30 phút chưa thanh toán; đơn thanh toán khi nhận hàng không được xác nhận sau 5 giờ sẽ được hệ thống tự duyệt; tồn kho chỉ bị trừ khi đơn được xác nhận và được hoàn lại nếu đơn bị hủy hoặc giao thất bại.'),
    ('5.1 Khách chọn chuyển khoản → Hệ thống tạo đơn ở trạng thái "Chờ thanh toán" và hiển thị mã QR chuyển khoản; đơn chờ Nhân viên bán hàng đối soát.',
     '5.1 Khách chọn chuyển khoản → Hệ thống tạo đơn ở trạng thái "Chờ thanh toán" và chuyển sang trang thanh toán mã VietQR; đơn được xác nhận tự động khi SePay báo tiền về (use case Chọn phương thức và xác nhận thanh toán).'),
    ('Mục này đặc tả chi tiết 26 use case tiêu biểu',
     'Mục này đặc tả chi tiết 24 use case tiêu biểu. Nguyên tắc chọn: mỗi tác nhân chỉ chọn một đến hai use case thể hiện rõ nhất vai trò của tác nhân đó trong bốn quy trình nghiệp vụ chính; các tác nhân kế thừa (Quản lý bán hàng, Quản lý kho, Nhân viên văn phòng) dùng lại use case của tác nhân cha nên không đặc tả riêng. @@BANG_CHON@@ liệt kê use case được chọn cho từng tác nhân. Mỗi use case được trình bày theo ba phần:'),
    ('Sơ đồ tuần tự: dùng các ký hiệu phân tích của UML.',
     'Sơ đồ tuần tự: dùng các ký hiệu phân tích của UML. Tác nhân (hình người) tương tác với lớp giao diện (boundary, tiền tố GD_), lớp điều khiển (control, tiền tố CTRL_, tương ứng controller hoặc dịch vụ của máy chủ), lớp thực thể (entity, tiền tố ENTITY_, tương ứng bảng dữ liệu) và hệ thống bên ngoài (hình chữ nhật, như Hệ thống email, Cổng SePay). Thông điệp được đánh số phân cấp: số nguyên là thao tác của tác nhân, 2.1 là lời gọi đầu tiên do giao diện thực hiện sau thao tác 2, 2.1.1 là lời gọi của lớp điều khiển xuống lớp thực thể. Mũi tên liền đầu đặc là lời gọi kèm tên hàm và tham số theo mã nguồn, mũi tên nét đứt là giá trị trả về, mũi tên quay về chính đối tượng là xử lý nội bộ. Các khung alt, opt, loop thể hiện nhánh điều kiện, phần tùy chọn và vòng lặp; điều kiện của từng nhánh ghi trong ngoặc vuông.'),
    ('Đơn đặt trực tuyến được khởi tạo ở một trong ba trạng thái: "Chờ thanh toán" với đơn chuyển khoản chưa đối soát',
     'Đơn đặt trực tuyến được khởi tạo ở một trong ba trạng thái: "Chờ thanh toán" với đơn chuyển khoản chưa nhận được tiền, "Chờ nhập hàng" khi thiếu tồn kho, hoặc "Chờ xác nhận" với đơn thanh toán khi nhận hàng đủ hàng. Sau khi được xác nhận, đơn lần lượt qua các trạng thái "Đã xác nhận", "Đang chuẩn bị hàng", "Sẵn sàng giao", "Đang giao hàng" và "Đã giao hàng". Nếu giao thất bại, đơn chuyển sang "Giao thất bại – hẹn lại" hoặc "Đang hoàn về kho". Tồn kho và số Serial chỉ bị giữ khi đơn được xác nhận và được hoàn lại khi đơn bị hủy hay giao thất bại.'),
    ('Danh sách đơn bán lẻ và trực tuyến kèm khách hàng, ngày đặt, tổng tiền, hình thức thanh toán và trạng thái; nhân viên lọc theo trạng thái, xác nhận đơn, đối soát chuyển khoản',
     'Danh sách đơn bán lẻ và trực tuyến kèm khách hàng, ngày đặt, tổng tiền, hình thức thanh toán và trạng thái; nhân viên lọc theo trạng thái và xác nhận đơn, đơn chuyển khoản hiển thị "Đã thanh toán" ngay khi SePay báo tiền về; quản lý bán hàng duyệt hủy đơn.'),
    ('Chưa tích hợp cổng thanh toán trực tuyến; giao dịch chuyển khoản được đối soát thủ công.',
     'Thanh toán trực tuyến mới hỗ trợ chuyển khoản VietQR qua SePay; chưa hỗ trợ thẻ quốc tế và ví điện tử, việc hoàn tiền cho khoản chuyển sai vẫn do kế toán chuyển trả thủ công.'),
    ('Tích hợp cổng thanh toán trực tuyến như VNPay, MoMo để xác thực giao dịch chuyển khoản tự động.',
     'Tích hợp thêm cổng thanh toán thẻ và ví điện tử như VNPay, MoMo; tự động hóa hoàn tiền cho khoản chuyển sai qua API ngân hàng.'),
    ('Đề tài không đi sâu vào nghiệp vụ kế toán thuế chuyên sâu',
     'Đề tài không đi sâu vào nghiệp vụ kế toán thuế chuyên sâu như lập báo cáo tài chính hay khai thuế giá trị gia tăng, và chưa kết nối với đơn vị vận chuyển bên thứ ba. Về thanh toán trực tuyến, hệ thống mới tích hợp chuyển khoản VietQR qua cổng SePay; thanh toán thẻ và ví điện tử chưa nằm trong phạm vi.'),
    ('Danh sách yêu cầu đổi trả đã đạt thẩm định và chọn hoàn tiền',
     'Danh sách yêu cầu đổi trả đã đạt thẩm định và chọn hoàn tiền, kèm khách hàng, tài khoản nhận và số tiền hoàn; kế toán lập phiếu đề nghị chi, quét mã VietQR để chuyển khoản rồi bấm "Xác nhận đã chuyển" để ghi bút toán hoàn tiền. Mục "Hoàn tiền chuyển khoản" liệt kê riêng các khoản khách chuyển qua SePay bị thiếu, dư, trùng hoặc vào đơn đã hủy; kế toán nhập mã giao dịch chuyển trả để hệ thống ghi bút toán hoàn tiền và trừ số dư tài khoản ngân hàng.'),
    ('Hệ thống có 18 tác nhân',
     'Hệ thống có 19 tác nhân, chia thành ba nhóm: tác nhân bên ngoài doanh nghiệp, nhân viên nghiệp vụ và cấp quản lý. Mỗi tác nhân nội bộ tương ứng với một vai trò được gán cho tài khoản đăng nhập; hai tác nhân hệ thống là Hệ thống email và Cổng thanh toán SePay.'),
]
for prefix, new in REPL:
    hits = [el for el in body.iter(q('w:p')) if ptext(el).startswith(prefix)]
    assert hits, prefix
    for p in hits:
        set_ptext(p, new)
    log.append(f'Sửa {len(hits)} đoạn: {prefix[:60]}…')

# Câu trong ô bảng (đặc tả Đặt hàng, Xử lý đơn hàng)
CELL_REPL = [
    ('Cho phép nhân viên bán hàng theo dõi đơn hàng mới, đối soát thanh toán, xác nhận đơn và cập nhật trạng thái xử lý.',
     'Cho phép nhân viên bán hàng theo dõi đơn hàng mới, xác nhận đơn và cập nhật trạng thái xử lý.'),
    ('5.1 Đơn chuyển khoản: nhân viên đối soát tiền đã về tài khoản và chọn "Xác nhận đã thanh toán".',
     '5.1 Đơn chuyển khoản đã được SePay xác nhận thanh toán: nhân viên không cần đối soát, đơn đã ở trạng thái "Đã xác nhận" hoặc "Chờ nhập hàng".'),
    ('5.2 Hệ thống ghi nhận thanh toán rồi tiếp tục bước 6.',
     '5.2 Hệ thống hiển thị khoản thanh toán kèm mã giao dịch ngân hàng để đối chiếu khi cần.'),
    ('Cổng thanh toán trực tuyến', None),
]
for old, new in CELL_REPL:
    if new is None:
        continue
    n = 0
    for t in body.iter(q('w:t')):
        if t.text and old in t.text:
            t.text = t.text.replace(old, new); n += 1
    log.append(f'Sửa {n} ô: {old[:50]}…')

# Đoạn mới ở mục 4.3.2: xác nhận thanh toán tự động
_, p432 = para_startswith('Đơn đặt trực tuyến được khởi tạo ở một trong ba trạng thái')
newp = copy.deepcopy(p432)
set_ptext(newp, 'Đơn chuyển khoản được xác nhận tự động qua cổng thanh toán SePay. Trang thanh toán hiển thị mã VietQR chứa sẵn số tiền và nội dung "AETHERPC <mã đơn>". Khi tiền vào tài khoản, SePay gửi thông báo giao dịch tới máy chủ; máy chủ kiểm tra khóa xác thực bằng phép so sánh thời gian hằng định, tìm mã đơn trong nội dung chuyển khoản, rồi xử lý trong một giao dịch cơ sở dữ liệu có khóa tư vấn (advisory lock) theo mã đơn để các thông báo của cùng một đơn chạy lần lượt. Mã giao dịch SePay được lưu cùng khoản thanh toán nên thông báo gửi lại không bị ghi trùng. Chỉ một giao dịch đủ tổng tiền mới xác nhận đơn; khoản chuyển thiếu, dư, trùng hoặc vào đơn đã hủy được ghi "Chờ hoàn tiền" và hiện trong danh sách hoàn tiền của Kế toán. Mọi khoản tiền vào đều được ghi bút toán thu và cộng số dư tài khoản ngân hàng; khi Kế toán hoàn trả, hệ thống ghi bút toán hoàn tiền và trừ số dư tương ứng. Đơn chuyển khoản quá 30 phút chưa thanh toán được bộ lập lịch tự hủy.')
p432.addnext(newp)
log.append('Thêm đoạn mô tả xử lý thanh toán SePay ở mục 4.3.2')

# ---------------------------------------------------------------- 4. Bảng tác nhân: thêm Cổng thanh toán SePay
_, cap_actor = para_startswith('Bảng 3.22 Danh sách tác nhân', 'CaptionText')
t_actor = next_tbl(cap_actor)
assert t_actor.tag == q('w:tbl')
email_row = next(tr for tr in t_actor.findall('w:tr', NS) if 'Hệ thống email' in ptext(tr))
sepay_row = copy.deepcopy(email_row)
tcs = sepay_row.findall('w:tc', NS)
cell_set(tcs[1], 'Cổng thanh toán SePay')
cell_set(tcs[2], 'Tác nhân phụ: phát hiện tiền chuyển khoản vào tài khoản cửa hàng và gửi thông báo giao dịch để hệ thống tự xác nhận thanh toán đơn hàng')
email_row.addnext(sepay_row)
log.append('Thêm tác nhân "Cổng thanh toán SePay" vào bảng tác nhân')

# ---------------------------------------------------------------- 5. Bảng use case tiêu biểu theo tác nhân
_, intro = para_startswith('Mục này đặc tả chi tiết 24 use case tiêu biểu')
cap_new = copy.deepcopy(cap_actor)
for t in cap_new.iter(q('w:instrText')):
    t.text = re.sub(r'\\r \d+', r'\\r 24', t.text)
for bm in cap_new.findall('w:bookmarkStart', NS) + cap_new.findall('w:bookmarkEnd', NS):
    cap_new.remove(bm)
ts = cap_new.findall('.//w:t', NS)
# ts: "Bảng 3.", "22", " Danh sách..."
ts[1].text = '24'
ts[-1].text = ' Use case tiêu biểu được đặc tả theo từng tác nhân'
tbl_new = copy.deepcopy(t_actor)
grid = tbl_new.find('w:tblGrid', NS)
widths = [2500, 4587, 1700]
for gc, wv in zip(grid.findall('w:gridCol', NS), widths):
    gc.set(q('w:w'), str(wv))
trs = tbl_new.findall('w:tr', NS)
hdr, tpl = trs[0], copy.deepcopy(trs[1])
for tr in trs[1:]:
    tbl_new.remove(tr)
for tc, wv, txt in zip(hdr.findall('w:tc', NS), widths, ['Tác nhân', 'Use case được đặc tả', 'Mục']):
    tc.find('w:tcPr/w:tcW', NS).set(q('w:w'), str(wv))
    cell_set(tc, txt)
    rpr = tc.find('.//w:r/w:rPr', NS)
    if rpr is not None and rpr.find('w:b', NS) is None:
        etree.SubElement(rpr, q('w:b'))
PICK = [
    ('Khách vãng lai', 'Đăng ký tài khoản; Tự cấu hình máy tính', '3.5.1.1; 3.5.1.2'),
    ('Khách hàng thành viên', 'Đặt hàng; Chọn phương thức và xác nhận thanh toán', '3.5.1.3; 3.5.1.4'),
    ('Nhân viên chăm sóc khách hàng', 'Trả lời chat trực tuyến', '3.5.1.5'),
    ('Nhân viên bán hàng', 'Bán hàng tại quầy; Xử lý và cập nhật đơn hàng', '3.5.1.6; 3.5.1.7'),
    ('Nhân viên mua hàng', 'Lập yêu cầu báo giá và so sánh báo giá', '3.5.2.1'),
    ('Nhà cung cấp', 'Phản hồi yêu cầu báo giá', '3.5.2.2'),
    ('Nhân viên kiểm định chất lượng', 'Kiểm tra chất lượng hàng nhập; Thẩm định hàng hoàn trả', '3.5.2.4; 3.5.2.5'),
    ('Nhân viên kho', 'Nghiệm thu hàng nhập kho; Xác nhận xuất kho và phân công giao hàng', '3.5.3.1; 3.5.3.3'),
    ('Nhân viên lắp ráp', 'Cập nhật tiến độ lắp ráp', '3.5.3.2'),
    ('Nhân viên giao hàng', 'Giao hàng và thu tiền hộ', '3.5.3.4'),
    ('Nhân viên kế toán', 'Thanh toán nhà cung cấp; Đối soát tiền thu hộ', '3.5.4.1; 3.5.4.2'),
    ('Nhân viên nhân sự', 'Tính lương và trình duyệt bảng lương', '3.5.5.3'),
    ('Nhân viên (tác nhân tổng quát)', 'Đăng ký khuôn mặt; Chấm công bằng khuôn mặt', '3.5.5.1; 3.5.5.2'),
    ('Ban Giám đốc', 'Duyệt đơn mua hàng; Duyệt bảng lương toàn công ty', '3.5.2.3; 3.5.5.4'),
    ('Quản trị viên', 'Quản trị tài khoản, phân quyền và nhật ký', '3.5.6.2'),
    ('Mọi người dùng có tài khoản', 'Đăng nhập', '3.5.6.1'),
    ('Hệ thống email, Cổng thanh toán SePay', 'Tác nhân phụ, xuất hiện trong các use case trên', '–'),
]
for row in PICK:
    tr = copy.deepcopy(tpl)
    for tc, wv, txt in zip(tr.findall('w:tc', NS), widths, row):
        tc.find('w:tcPr/w:tcW', NS).set(q('w:w'), str(wv))
        cell_set(tc, txt)
    tbl_new.append(tr)
# bảng nằm sau đoạn giới thiệu, trước các gạch đầu dòng giải thích ký hiệu
_, last_bullet = para_startswith('Sơ đồ tuần tự: dùng các ký hiệu phân tích')
last_bullet.addnext(cap_new)
cap_new.addnext(tbl_new)
spacer = copy.deepcopy(t_actor.getnext()) if t_actor.getnext().tag == q('w:p') and not ptext(t_actor.getnext()).strip() else None
if spacer is not None:
    tbl_new.addnext(spacer)
log.append('Thêm Bảng "Use case tiêu biểu được đặc tả theo từng tác nhân"')

# ---------------------------------------------------------------- 5b. Sơ đồ use case tổng quát có thêm tác nhân SePay
_, cap_uc_dia = para_startswith('Hình 3.31 Sơ đồ use case tổng quát', 'CaptionText')
pic = cap_uc_dia.getprevious()
blip = pic.find('.//a:blip', NS)
tgt = rid2target[blip.get('{%s}embed' % NS['r'])]
src_png = os.path.join(SEQ_DIR, '..', 'usecase_tongquat.png')
assert Image.open(src_png).size == (3248, 6987)
with open(src_png, 'rb') as f:
    data = f.read()
with open(os.path.join(WORK, 'word', tgt.replace('/', os.sep)), 'wb') as f:
    f.write(data)
log.append(f'Thay ảnh sơ đồ use case tổng quát ({tgt})')

# ---------------------------------------------------------------- 6. Đánh số lại Hình 3.x / Bảng 3.x
fig_map, tab_map = {}, {}
nf = nt = 0
caption_ps = set()
for p in body.iter(q('w:p')):
    if style(p) != 'CaptionText':
        continue
    t = ptext(p)
    mm = re.match(r'(Hình|Bảng) 3\.(\d+)', t)
    if not mm:
        continue
    caption_ps.add(p)
    old = int(mm.group(2))
    if mm.group(1) == 'Hình':
        nf += 1; new = nf
        if p is not cap_new:
            fig_map[old] = new
    else:
        nt += 1; new = nt
        if p is not cap_new:
            tab_map[old] = new
    for it in p.iter(q('w:instrText')):
        it.text = re.sub(r'\\r \d+', r'\\r %d' % new, it.text)
    # kết quả hiển thị của trường SEQ: run ngay sau fldChar separate
    seen_sep = False
    for r in p.iter(q('w:r')):
        fc = r.find('w:fldChar', NS)
        if fc is not None and fc.get(q('w:fldCharType')) == 'separate':
            seen_sep = True; continue
        if seen_sep:
            tt = r.find('w:t', NS)
            if tt is not None:
                tt.text = str(new)
                break
log.append(f'Đánh số lại: {nf} hình, {nt} bảng ở chương 3')
changed_f = {k: v for k, v in fig_map.items() if k != v}
changed_t = {k: v for k, v in tab_map.items() if k != v}

# tham chiếu trong lời văn và trong bảng (trừ chính các chú thích)
pat = re.compile(r'(Hình|Bảng) 3\.(\d+)')
nref = 0
for p in body.iter(q('w:p')):
    if p in caption_ps:
        continue
    for t in p.iter(q('w:t')):
        if not t.text or '3.' not in t.text:
            continue
        def sub(m):
            global nref
            kind, n = m.group(1), int(m.group(2))
            mp = fig_map if kind == 'Hình' else tab_map
            if n in mp:
                if mp[n] != n:
                    nref += 1
                return f'{kind} 3.{mp[n]}'
            return m.group(0)
        t.text = pat.sub(sub, t.text)
log.append(f'Cập nhật {nref} tham chiếu Hình/Bảng trong lời văn')

# ---------------------------------------------------------------- 7. Bảng danh sách use case: cột "Đặc tả" + mô tả UC 6
spec_no = {}
for p in caption_ps:
    t = ptext(p)
    mm = re.match(r'Bảng 3\.(\d+) Đặc tả use case (.+)', t)
    if mm:
        spec_no[mm.group(2).strip()] = f'Bảng 3.{mm.group(1)}'
UC_SPEC = {
    '2': 'Đăng ký tài khoản', '3': 'Tự cấu hình máy tính', '4': 'Đặt hàng',
    '6': 'Chọn phương thức và xác nhận thanh toán', '12': 'Trả lời chat trực tuyến',
    '14': 'Bán hàng tại quầy', '15': 'Xử lý và cập nhật đơn hàng',
    '18': 'Lập yêu cầu báo giá và so sánh báo giá', '19': 'Lập yêu cầu báo giá và so sánh báo giá',
    '21': 'Phản hồi yêu cầu báo giá', '23': 'Duyệt đơn mua hàng', '24': 'Kiểm tra chất lượng hàng nhập',
    '25': 'Thẩm định hàng hoàn trả', '26': 'Nghiệm thu hàng nhập kho', '33': 'Cập nhật tiến độ lắp ráp',
    '34': 'Xác nhận xuất kho và phân công giao hàng', '35': 'Giao hàng và thu tiền hộ',
    '38': 'Thanh toán nhà cung cấp', '41': 'Đối soát tiền thu hộ', '44': 'Tính lương và trình duyệt bảng lương',
    '46': 'Duyệt bảng lương toàn công ty', '47': 'Đăng ký khuôn mặt', '48': 'Chấm công bằng khuôn mặt',
    '52': 'Quản trị tài khoản, phân quyền và nhật ký', '53': 'Quản trị tài khoản, phân quyền và nhật ký',
}
_, cap_uc = para_startswith('Bảng 3.23 Danh sách use case', 'CaptionText')
t_uc = next_tbl(cap_uc)
assert t_uc.tag == q('w:tbl')
nset = 0
for tr in t_uc.findall('w:tr', NS):
    tcs = tr.findall('w:tc', NS)
    if len(tcs) != 5:
        continue
    stt = ptext(tcs[0]).strip()
    if not stt.isdigit():
        continue
    want = spec_no[UC_SPEC[stt]] if stt in UC_SPEC else '–'
    if ptext(tcs[4]).strip() != want:
        cell_set(tcs[4], want); nset += 1
    if stt == '6':
        cell_set(tcs[3], 'Chọn COD hoặc chuyển khoản; đơn chuyển khoản được thanh toán bằng mã VietQR và tự xác nhận khi cổng SePay báo tiền về.')
log.append(f'Cập nhật {nset} ô cột "Đặc tả" của bảng danh sách use case')

new_tab_no = re.match(r'Bảng 3\.(\d+)', ptext(cap_new)).group(1)
for t in body.iter(q('w:t')):
    if t.text and '@@BANG_CHON@@' in t.text:
        t.text = t.text.replace('@@BANG_CHON@@', f'Bảng 3.{new_tab_no}')
tree.write(doc_path, xml_declaration=True, encoding='UTF-8', standalone=True)
print('\n'.join(log))
print('fig map changed:', changed_f)
print('tab map changed:', changed_t)
