# -*- coding: utf-8 -*-
"""Chèn ảnh bảng điều khiển Railway (docs/railway) vào 5.1.3.2, 5.3.2, 5.3.3 và sửa lời văn theo cấu hình thật
trong ảnh (tên dịch vụ, danh sách biến môi trường). Đánh số lại hình chương 5.

python chen_anh_railway.py <thư mục docx đã giải nén> <docs/railway>
"""
import copy, os, re, sys
from lxml import etree
from PIL import Image

WORK, RW = sys.argv[1:3]
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PR = 'http://schemas.openxmlformats.org/package/2006/relationships'
NS = {'w': W, 'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture', 'r': R}
q = lambda t: '{%s}%s' % (W, t.split(':')[1])
XS = '{http://www.w3.org/XML/1998/namespace}space'
doc_path = os.path.join(WORK, 'word', 'document.xml')
rels_path = os.path.join(WORK, 'word', '_rels', 'document.xml.rels')
tree = etree.parse(doc_path); body = tree.getroot().find('w:body', NS)
rels_tree = etree.parse(rels_path); rels = rels_tree.getroot()
log = []


def ptext(el): return ''.join(t.text or '' for t in el.iter(q('w:t')))
def style(p):
    s = p.find('w:pPr/w:pStyle', NS)
    return s.get(q('w:val')) if s is not None else ''


def set_ptext(p, text):
    runs = p.findall('w:r', NS); first = runs[0]
    for r in runs[1:]:
        p.remove(r)
    for el in list(first):
        if el.tag != q('w:rPr'):
            first.remove(el)
    t = etree.SubElement(first, q('w:t')); t.text = text; t.set(XS, 'preserve')
    return p


def find_p(pred):
    for p in body.iter(q('w:p')):
        if pred(p):
            return p
    raise KeyError


def body_p(prefix):
    return find_p(lambda p: style(p) == 'ContentText' and ptext(p).startswith(prefix))


T_CAP = find_p(lambda p: style(p) == 'CaptionText' and 'Trang chủ cửa hàng trực tuyến sau khi triển khai' in ptext(p))
T_IMG = T_CAP.getprevious()
while T_IMG.find('.//a:blip', NS) is None:
    T_IMG = T_IMG.getprevious()
max_id = [max(int(e.get('id')) for e in body.iter('{%s}docPr' % NS['wp']))]
new_caps = set()


def FIG(png, caption):
    src = os.path.join(RW, png)
    media = 'rw_' + png
    open(os.path.join(WORK, 'word', 'media', media), 'wb').write(open(src, 'rb').read())
    rid = 'rIdRw' + re.sub(r'\W', '', png)
    etree.SubElement(rels, '{%s}Relationship' % PR, Id=rid,
                     Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', Target='media/' + media)
    p = copy.deepcopy(T_IMG)
    p.find('.//a:blip', NS).set('{%s}embed' % R, rid)
    max_id[0] += 1
    dp = p.find('.//wp:docPr', NS); dp.set('id', str(max_id[0])); dp.set('name', png)
    w, h = Image.open(src).size
    cx = 5580000; cy = int(cx * h / w)
    for ext in (p.find('.//wp:extent', NS), p.find('.//a:xfrm/a:ext', NS)):
        ext.set('cx', str(cx)); ext.set('cy', str(cy))
    p.find('.//pic:cNvPr', NS).set('name', png)
    cap = copy.deepcopy(T_CAP)
    cap.findall('.//w:t', NS)[-1].text = ' ' + caption
    new_caps.add(cap)
    return [p, cap]


def after(anchor, items):
    for e in items:
        anchor.addnext(e); anchor = e
    return anchor


# 5.1.3.2 — dịch vụ PostgreSQL trên Railway
p = body_p('Hệ thống dùng PostgreSQL. Trong quá trình phát triển')
note = copy.deepcopy(p)
set_ptext(note, 'Trên Railway, dịch vụ PostgreSQL được gắn một ổ lưu trữ riêng (postgres-volume) nên dữ liệu không mất khi dịch vụ '
          'khởi động lại. Thẻ Database cho phép xem trực tiếp các bảng do Prisma tạo ra, còn nút Connect cung cấp chuỗi kết nối nội '
          'bộ cho các dịch vụ cùng dự án và chuỗi kết nối công khai cho máy phát triển.')
after(p, [note] + FIG('csdl_cat.png', 'Dịch vụ PostgreSQL và các bảng của hệ thống trên Railway'))

# 5.3.2 — máy chủ ứng dụng
p1 = body_p('Bước 1. Đăng nhập Railway bằng tài khoản GitHub')
set_ptext(p1, 'Bước 1. Đăng nhập Railway bằng tài khoản GitHub, tạo một dự án mới và thêm dịch vụ PostgreSQL. Dự án của hệ thống gồm '
          'ba dịch vụ: Postgres (cơ sở dữ liệu), ERP_AetherPC (máy chủ ứng dụng) và gallant-nourishment (giao diện); mũi tên trên '
          'sơ đồ cho biết máy chủ ứng dụng kết nối tới cơ sở dữ liệu.')
after(p1, FIG('trangchu_cat.png', 'Các dịch vụ của hệ thống trên Railway'))
p2 = body_p('Bước 2. Thêm dịch vụ mới từ kho mã nguồn GitHub')
set_ptext(p2, 'Bước 2. Thêm dịch vụ mới từ kho mã nguồn GitHub (dịch vụ ERP_AetherPC), đặt thư mục gốc (Root Directory) là backend. '
          'Railway nhận ra tệp Dockerfile và dựng ảnh theo tệp này.')
p3 = body_p('Bước 3. Khai báo biến môi trường cho dịch vụ')
set_ptext(p3, 'Bước 3. Khai báo biến môi trường trong thẻ Variables của dịch vụ: DATABASE_URL là chuỗi kết nối tới dịch vụ PostgreSQL, '
          'JWT_SECRET là khóa ký token, CORS_ORIGIN là tên miền của giao diện, PORT là cổng lắng nghe, cùng các khóa gửi email '
          '(Brevo, Gmail) và các thông tin thanh toán SePay. Railway che giá trị của các biến và tự bổ sung các biến hệ thống như '
          'tên miền, mã dự án.')
after(p3, FIG('backend_cat.png', 'Biến môi trường của dịch vụ máy chủ ứng dụng trên Railway'))

# 5.3.3 — giao diện
q1 = body_p('Bước 1. Thêm dịch vụ thứ hai từ cùng kho mã nguồn')
set_ptext(q1, 'Bước 1. Thêm dịch vụ thứ hai từ cùng kho mã nguồn (dịch vụ gallant-nourishment), đặt thư mục gốc là frontend và chọn '
          'tệp Dockerfile.production. Tệp này biên dịch ứng dụng React ở giai đoạn đầu, sau đó chép kết quả vào ảnh Nginx để phục vụ.')
q2 = body_p('Bước 2. Khai báo biến BACKEND_URL')
set_ptext(q2, 'Bước 2. Khai báo biến BACKEND_URL là địa chỉ của dịch vụ máy chủ ứng dụng, cùng biến PORT. Khi khởi động, Nginx thay '
          'hai biến này vào tệp cấu hình để chuyển tiếp yêu cầu API và kết nối WebSocket tới máy chủ ứng dụng; các đường dẫn còn lại '
          'trả về trang của ứng dụng React.')
after(q2, FIG('fontend_cat.png', 'Biến môi trường của dịch vụ giao diện trên Railway'))
log.append('Chèn 4 ảnh Railway, sửa lời văn 5.1.3.2, 5.3.2, 5.3.3')

# đánh số lại hình chương 5
caption_ps, maps, cnt = set(), {}, {'Hình': 0, 'Bảng': 0}
for p in body.iter(q('w:p')):
    if style(p) != 'CaptionText':
        continue
    mm = re.match(r'(Hình|Bảng) 5\.(\d+)', ptext(p))
    if not mm:
        continue
    caption_ps.add(p)
    kind, old = mm.group(1), int(mm.group(2))
    cnt[kind] += 1; new = cnt[kind]
    if p not in new_caps:
        maps[(kind, old)] = new
    for it in p.iter(q('w:instrText')):
        it.text = re.sub(r'\\r \d+', r'\\r %d' % new, it.text)
    sep = False
    for r in p.iter(q('w:r')):
        fc = r.find('w:fldChar', NS)
        if fc is not None and fc.get(q('w:fldCharType')) == 'separate':
            sep = True; continue
        if sep and r.find('w:t', NS) is not None:
            r.find('w:t', NS).text = str(new); break
pat = re.compile(r'(Hình|Bảng) 5\.(\d+)')
nref = 0
for p in body.iter(q('w:p')):
    if p in caption_ps or style(p).lower().startswith(('tableoffigures', 'toc')):
        continue
    for t in p.iter(q('w:t')):
        if t.text and pat.search(t.text):
            def sub(m):
                global nref
                key = (m.group(1), int(m.group(2)))
                if key in maps and maps[key] != key[1]:
                    nref += 1
                    return f'{m.group(1)} 5.{maps[key]}'
                return m.group(0)
            t.text = pat.sub(sub, t.text)
log.append(f'Chương 5: {cnt["Hình"]} hình, {cnt["Bảng"]} bảng; cập nhật {nref} tham chiếu')
tree.write(doc_path, xml_declaration=True, encoding='UTF-8', standalone=True)
rels_tree.write(rels_path, xml_declaration=True, encoding='UTF-8', standalone=True)
print('\n'.join(log))
