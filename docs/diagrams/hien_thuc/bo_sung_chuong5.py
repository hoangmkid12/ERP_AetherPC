# -*- coding: utf-8 -*-
"""Bổ sung chương 5 (Hiện thực và triển khai) theo cấu trúc mẫu tham khảo: cấu trúc thư mục, cài đặt từng bước
(máy chủ, cơ sở dữ liệu, giao diện, Docker Compose), triển khai trên Railway, CI/CD, kết quả triển khai.

python bo_sung_chuong5.py <thư mục docx đã giải nén> <thư mục ảnh hien_thuc>
"""
import copy, os, re, sys
from lxml import etree
from PIL import Image

WORK, IMG = sys.argv[1:3]
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
tree = etree.parse(doc_path)
body = tree.getroot().find('w:body', NS)
rels_tree = etree.parse(rels_path)
rels = rels_tree.getroot()
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
    return p


def find_p(pred):
    for p in body.iter(q('w:p')):
        if pred(p):
            return p
    raise KeyError


def heading(prefix, sty):
    return find_p(lambda p: style(p) == sty and ptext(p).startswith(prefix))


# ───────── mẫu định dạng lấy từ chính báo cáo ─────────
T_H3 = heading('5.1.2 ', 'Heading3')
T_H4 = heading('5.2.2.1 ', 'Heading4')
T_TXT = next(e for e in T_H3.itersiblings() if e.tag == q('w:p') and style(e) == 'ContentText')
T_BUL = find_p(lambda p: style(p) == 'BulletText')
T_CAP_FIG = find_p(lambda p: style(p) == 'CaptionText' and re.match(r'Hình 5\.\d+ Giao diện đăng nhập', ptext(p)))
T_IMG = T_CAP_FIG.getprevious()
while T_IMG.find('.//a:blip', NS) is None:
    T_IMG = T_IMG.getprevious()
T_CAP_TBL = find_p(lambda p: style(p) == 'CaptionText' and ptext(p).startswith('Bảng 5.1 '))
T_TBL = T_CAP_TBL.getnext()
assert T_TBL.tag == q('w:tbl')
T_TBL3 = find_p(lambda p: style(p) == 'CaptionText' and ptext(p).startswith('Bảng PL.2')).getnext()
assert T_TBL3.tag == q('w:tbl')

max_id = [max(int(e.get('id')) for e in body.iter('{%s}docPr' % NS['wp']))]
new_caps = set()


def H3(t): return set_ptext(copy.deepcopy(T_H3), t)
def H4(t): return set_ptext(copy.deepcopy(T_H4), t)
def P(t): return set_ptext(copy.deepcopy(T_TXT), t)
def B(t): return set_ptext(copy.deepcopy(T_BUL), t)


def CODE(t):
    """Dòng lệnh: phông Consolas, căn trái, không giãn đoạn."""
    p = set_ptext(copy.deepcopy(T_TXT), t)
    ppr = p.find('w:pPr', NS)
    for tag in ('w:jc', 'w:spacing', 'w:ind'):
        e = ppr.find(tag, NS)
        if e is not None:
            ppr.remove(e)
    sp = etree.SubElement(ppr, q('w:spacing')); sp.set(q('w:before'), '0'); sp.set(q('w:after'), '0'); sp.set(q('w:line'), '276'); sp.set(q('w:lineRule'), 'auto')
    ind = etree.SubElement(ppr, q('w:ind')); ind.set(q('w:left'), '567')
    jc = etree.SubElement(ppr, q('w:jc')); jc.set(q('w:val'), 'left')
    r = p.find('w:r', NS)
    rpr = r.find('w:rPr', NS)
    if rpr is None:
        rpr = etree.Element(q('w:rPr')); r.insert(0, rpr)
    for e in list(rpr):
        if e.tag in (q('w:rFonts'), q('w:sz'), q('w:szCs')):
            rpr.remove(e)
    f = etree.SubElement(rpr, q('w:rFonts'))
    for k in ('ascii', 'hAnsi', 'cs'):
        f.set(q('w:' + k), 'Consolas')
    etree.SubElement(rpr, q('w:sz')).set(q('w:val'), '22')
    etree.SubElement(rpr, q('w:szCs')).set(q('w:val'), '22')
    return p


def FIG(png_name, caption, max_h=7900000):
    src = os.path.join(IMG, png_name)
    media = 'ht5_' + png_name
    open(os.path.join(WORK, 'word', 'media', media), 'wb').write(open(src, 'rb').read())
    rid = 'rIdHt5' + re.sub(r'\W', '', png_name)
    etree.SubElement(rels, '{%s}Relationship' % PR, Id=rid,
                     Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', Target='media/' + media)
    p = copy.deepcopy(T_IMG)
    p.find('.//a:blip', NS).set('{%s}embed' % R, rid)
    max_id[0] += 1
    dp = p.find('.//wp:docPr', NS); dp.set('id', str(max_id[0])); dp.set('name', png_name)
    w, h = Image.open(src).size
    cx = min(5580000, w * 4500); cy = int(cx * h / w)
    if cy > max_h:
        cy = max_h; cx = int(cy * w / h)
    for ext in (p.find('.//wp:extent', NS), p.find('.//a:xfrm/a:ext', NS)):
        ext.set('cx', str(cx)); ext.set('cy', str(cy))
    p.find('.//pic:cNvPr', NS).set('name', png_name)
    cap = copy.deepcopy(T_CAP_FIG)
    cap.findall('.//w:t', NS)[-1].text = ' ' + caption
    new_caps.add(cap)
    return [p, cap]


def cell_set(tc, text):
    p = tc.find('w:p', NS)
    for extra in tc.findall('w:p', NS)[1:]:
        tc.remove(extra)
    if p.find('w:r', NS) is None:
        etree.SubElement(p, q('w:r'))
    set_ptext(p, text)


def TABLE(template, caption, header, rows):
    tbl = copy.deepcopy(template)
    trs = tbl.findall('w:tr', NS)
    hdr, tpl = trs[0], trs[1]
    for tr in trs[1:]:
        tbl.remove(tr)
    for tc, v in zip(hdr.findall('w:tc', NS), header):
        cell_set(tc, v)
    for row in rows:
        tr = copy.deepcopy(tpl)
        for tc, v in zip(tr.findall('w:tc', NS), row):
            cell_set(tc, v)
        tbl.append(tr)
    cap = copy.deepcopy(T_CAP_TBL)
    cap.findall('.//w:t', NS)[-1].text = ' ' + caption
    new_caps.add(cap)
    return [cap, tbl]


def insert_after(anchor, items):
    flat = []
    for it in items:
        flat.extend(it if isinstance(it, list) else [it])
    for e in flat:
        anchor.addnext(e); anchor = e
    return anchor


# ═════════════════════════ 5.1 ═════════════════════════
set_ptext(heading('5.1 ', 'Heading2'), '5.1 Cấu hình và cài đặt hệ thống')
h511 = heading('5.1.1 ', 'Heading3'); set_ptext(h511, '5.1.1 Môi trường và công cụ phát triển')
intro511 = P('Các công cụ, nền tảng và môi trường phần mềm được sử dụng trong quá trình phát triển và triển khai hệ thống được '
             'tổng hợp ở bảng dưới đây.')
h511.addnext(intro511)
# cập nhật Bảng 5.1 theo phiên bản thực tế trong package.json
ROWS511 = [('Hệ điều hành phát triển', 'Windows 11'),
           ('Môi trường thực thi', 'Node.js 20 (ảnh Docker triển khai), Node.js 24 trên máy phát triển'),
           ('Máy chủ ứng dụng', 'Express 4, ws 8 (WebSocket), jsonwebtoken, bcryptjs, nodemailer'),
           ('Cơ sở dữ liệu', 'PostgreSQL (dịch vụ Railway)'),
           ('Thư viện truy cập dữ liệu', 'Prisma ORM 6.19'),
           ('Giao diện', 'React 18.3, Vite 5.4, React Router 6, Zustand 5, Chart.js 4'),
           ('Bản đồ, nhận diện khuôn mặt', 'Leaflet, Goong Maps, OSRM; face-api.js'),
           ('Trí tuệ nhân tạo', 'Google Gemini API, node-nlp'),
           ('Đóng gói và triển khai', 'Docker, Docker Compose, Nginx, Railway'),
           ('Tích hợp liên tục', 'GitHub Actions'),
           ('Soạn thảo mã nguồn, quản lý phiên bản', 'Visual Studio Code, Git, GitHub'),
           ('Kiểm thử giao diện, chụp màn hình', 'Playwright (Chromium)'),
           ('Vẽ sơ đồ', 'draw.io, Graphviz, Python (Pillow)')]
trs = T_TBL.findall('w:tr', NS)
tpl_row = trs[1]
for tr in trs[1:]:
    T_TBL.remove(tr)
for a, b in ROWS511:
    tr = copy.deepcopy(tpl_row)
    tcs = tr.findall('w:tc', NS); cell_set(tcs[0], a); cell_set(tcs[1], b)
    T_TBL.append(tr)

h512 = heading('5.1.2 ', 'Heading3'); set_ptext(h512, '5.1.2 Cấu trúc thư mục dự án')
p512 = T_TXT  # đoạn giới thiệu sẵn có
set_ptext(p512, 'Mã nguồn được tổ chức trong một kho duy nhất gồm hai dự án độc lập là máy chủ ứng dụng (backend) và giao diện '
          '(frontend), cùng các thư mục phụ trợ cho dữ liệu, huấn luyện mô hình, triển khai và tài liệu. Hai dự án được đóng gói '
          'riêng bằng Docker và có thể chạy chung bằng một tệp Docker Compose ở thư mục gốc.')
blk = [FIG('cay_thu_muc_tong.png', 'Cấu trúc thư mục tổng thể của dự án'),
       P('Giải thích các thư mục ở cấp gốc:'),
       B('backend, frontend: hai dự án chính, mỗi dự án có tệp package.json, tệp biến môi trường mẫu và Dockerfile riêng.'),
       B('ai_training: bộ dữ liệu câu hỏi theo ý định dùng để huấn luyện mô hình hiểu ngôn ngữ của trợ lý AI; máy chủ đọc trực tiếp tệp dữ liệu trong thư mục này khi khởi động.'),
       B('scraper: các chương trình Python thu thập và làm sạch dữ liệu linh kiện thực tế, là nguồn của dữ liệu mẫu.'),
       B('backups, scripts/db: bản sao lưu cơ sở dữ liệu cùng các tệp lệnh sao lưu, khôi phục.'),
       B('deploy, osrm: cấu hình Nginx cho bản production và máy chủ định tuyến OSRM tự cài đặt (tùy chọn).'),
       B('docs: báo cáo, sơ đồ, ảnh giao diện, kết quả đánh giá và ghi chú kỹ thuật.'),
       B('.github/workflows: quy trình kiểm tra biên dịch tự động mỗi lần đẩy mã lên nhánh chính.'),
       H4('5.1.2.1 Cấu trúc dự án giao diện'),
       P('Dự án giao diện là một ứng dụng React một trang được tạo bằng Vite. Mã nguồn chia theo nhóm trang tương ứng với ba khu vực '
         'định tuyến: cửa hàng trực tuyến, trang quản trị nghiệp vụ và cổng nhà cung cấp.'),
       FIG('cay_thu_muc_frontend.png', 'Cấu trúc thư mục dự án giao diện'),
       B('pages: các trang chức năng; Storefront chứa 15 trang cửa hàng, Admin chứa 12 phân hệ quản trị và ứng dụng giao hàng, SupplierPortal là cổng nhà cung cấp.'),
       B('components: thành phần dùng chung như khung trang, thanh điều hướng, khung trò chuyện, trợ lý AI, chữ ký điện tử.'),
       B('context, stores: quản lý trạng thái; context giữ phiên đăng nhập, giỏ hàng, thông báo; stores là các kho Zustand theo phân hệ.'),
       B('services/api.js: hàm gọi API dùng chung, gửi kèm cookie đăng nhập và chuẩn hóa thông báo lỗi.'),
       B('hooks, utils: tiện ích như định tuyến bản đồ, nhận diện khuôn mặt, định dạng số tiền; styles, locales: định dạng dùng chung và tệp ngôn ngữ.'),
       B('App.jsx, main.jsx: khai báo định tuyến kèm vai trò được phép truy cập từng trang, và điểm khởi chạy ứng dụng.'),
       B('vite.config.js, Dockerfile, Dockerfile.production, nginx.production.conf: cấu hình chạy thử, đóng gói và phục vụ bản production.'),
       H4('5.1.2.2 Cấu trúc dự án máy chủ'),
       P('Dự án máy chủ là ứng dụng Node.js dùng Express, tổ chức theo các lớp trách nhiệm đã mô tả ở mục 4.1.2; toàn bộ truy cập dữ '
         'liệu đi qua Prisma.'),
       FIG('cay_thu_muc_backend.png', 'Cấu trúc thư mục dự án máy chủ'),
       B('prisma: lược đồ cơ sở dữ liệu schema.prisma, chương trình nạp dữ liệu mẫu và các bước khởi tạo dữ liệu chạy mỗi lần khởi động (quyền mặc định, mã khuyến mãi, ngày nghỉ lễ...).'),
       B('src/routes: khai báo điểm truy cập theo phân hệ và gắn bộ kiểm tra xác thực, phân quyền cho từng điểm.'),
       B('src/middlewares: xác thực token, kiểm tra vai trò và ma trận nghiệp vụ, nhận tệp tải lên, chuẩn hóa lỗi.'),
       B('src/controllers: xử lý nghiệp vụ của từng phân hệ như đơn hàng, mua hàng, kho, thanh toán, nhân sự.'),
       B('src/services: chức năng dùng chung gồm gửi email, thanh toán SePay, tính khuyến mãi, chính sách lương, WebSocket và trợ lý AI.'),
       B('src/app.js, src/server.js: khởi tạo ứng dụng Express với các lớp bảo vệ, sau đó lắng nghe cổng 5000, mở WebSocket và chạy bộ hẹn giờ.')]
insert_after(p512, blk)

h513 = heading('5.1.3 ', 'Heading3'); set_ptext(h513, '5.1.3 Cài đặt hệ thống trên máy cục bộ')
p513 = next(e for e in h513.itersiblings() if e.tag == q('w:p') and style(e) == 'ContentText')
set_ptext(p513, 'Hệ thống có thể chạy theo hai cách: chạy trực tiếp từng dự án bằng Node.js, hoặc chạy toàn bộ bằng Docker Compose. '
          'Các mục dưới đây trình bày lần lượt cách cài đặt máy chủ ứng dụng, cơ sở dữ liệu, giao diện và cách chạy bằng Docker '
          'Compose. Tài khoản dùng thử theo từng vai trò được liệt kê ở Phụ lục B.')
blk = [H4('5.1.3.1 Cài đặt và cấu hình máy chủ ứng dụng'),
       P('Bước 1. Cài đặt Node.js phiên bản 20 trở lên (kèm trình quản lý gói npm) và Git, sau đó kiểm tra phiên bản:'),
       CODE('node -v'), CODE('npm -v'),
       P('Bước 2. Tải mã nguồn và cài đặt thư viện cho dự án máy chủ:'),
       CODE('git clone https://github.com/hoangmkid12/ERP_AetherPC.git'), CODE('cd ERP_AetherPC/backend'), CODE('npm install'),
       P('Các thư viện chính của máy chủ ứng dụng:'),
       B('express: xây dựng giao diện lập trình REST; helmet, cors, express-rate-limit, cookie-parser: lớp bảo vệ và đọc cookie đăng nhập.'),
       B('@prisma/client, prisma: truy cập cơ sở dữ liệu PostgreSQL và đồng bộ lược đồ.'),
       B('jsonwebtoken, bcryptjs: phát hành token đăng nhập và băm mật khẩu.'),
       B('ws: máy chủ WebSocket cho trò chuyện và định vị giao hàng; multer: nhận tệp tải lên.'),
       B('nodemailer: gửi email; @google/genai, node-nlp: trợ lý AI; nodemon: tự khởi động lại khi sửa mã.'),
       P('Bước 3. Sinh mã truy cập dữ liệu (Prisma Client) từ lược đồ:'),
       CODE('npx prisma generate'),
       FIG('terminal_prisma.png', 'Kết quả cài đặt thư viện và sinh Prisma Client'),
       P('Bước 4. Sao chép tệp backend/.env.example thành backend/.env và khai báo các biến môi trường. Hai biến bắt buộc là '
         'DATABASE_URL (chuỗi kết nối cơ sở dữ liệu, xem mục 5.1.3.2) và JWT_SECRET (khóa ký token, tối thiểu 32 ký tự khi chạy '
         'production); các biến còn lại dành cho email, thanh toán SePay và các dịch vụ tùy chọn. Ý nghĩa từng biến được tóm tắt ở Bảng PL.2.'),
       FIG('env_backend.png', 'Tệp biến môi trường mẫu của máy chủ ứng dụng'),
       P('Bước 5. Tạo cấu trúc bảng theo lược đồ Prisma và nạp dữ liệu mẫu (lệnh db:prepare-seed chuẩn bị dữ liệu sản phẩm thu thập được):'),
       CODE('npx prisma db push'), CODE('npm run db:prepare-seed'), CODE('npm run db:seed'),
       P('Bước 6. Khởi động máy chủ ở chế độ phát triển bằng lệnh npm run dev (dùng nodemon) hoặc npm start. Máy chủ lắng nghe tại cổng '
         '5000, mở hai kênh WebSocket và nạp mô hình hiểu ngôn ngữ của trợ lý AI.'),
       CODE('npm run dev'),
       FIG('terminal_backend.png', 'Kết quả khởi động máy chủ ứng dụng'),
       H4('5.1.3.2 Cấu hình cơ sở dữ liệu PostgreSQL'),
       P('Hệ thống dùng PostgreSQL. Trong quá trình phát triển và khi triển khai, cơ sở dữ liệu đặt trên dịch vụ PostgreSQL do Railway '
         'quản lý, nhờ đó các thành viên dùng chung một nguồn dữ liệu và dữ liệu không bị mất khi dựng lại ứng dụng. Khi cần chạy độc '
         'lập, có thể cài PostgreSQL 15 trên máy hoặc chạy bằng Docker rồi trỏ chuỗi kết nối về máy cục bộ.'),
       P('Chuỗi kết nối được khai báo trong biến DATABASE_URL theo dạng:'),
       CODE('postgresql://<tên người dùng>:<mật khẩu>@<máy chủ>:<cổng>/<tên cơ sở dữ liệu>'),
       B('<tên người dùng>, <mật khẩu>: tài khoản truy cập cơ sở dữ liệu do Railway cấp hoặc tự tạo khi cài đặt.'),
       B('<máy chủ>, <cổng>: địa chỉ và cổng kết nối; với Railway là địa chỉ kết nối công khai (TCP Proxy) của dịch vụ PostgreSQL.'),
       B('<tên cơ sở dữ liệu>: tên cơ sở dữ liệu chứa các bảng của hệ thống.'),
       P('Prisma đọc biến DATABASE_URL trong khối datasource của tệp schema.prisma. Đối tượng Prisma dùng chung được tạo một lần trong '
         'tệp config/database.js; tệp này nới số kết nối tối đa và thời gian chờ để các truy vấn nhỏ như kiểm tra phiên đăng nhập không '
         'phải xếp hàng sau các truy vấn danh sách lớn khi trang quản trị vừa mở.'),
       FIG('prisma_ketnoi.png', 'Khai báo kết nối cơ sở dữ liệu qua Prisma'),
       H4('5.1.3.3 Cài đặt và cấu hình giao diện'),
       P('Bước 1. Cài đặt thư viện cho dự án giao diện:'),
       CODE('cd ERP_AetherPC/frontend'), CODE('npm install'),
       P('Các thư viện chính gồm react, react-dom, react-router-dom (định tuyến), zustand (quản lý trạng thái), chart.js và react-chartjs-2 '
         '(biểu đồ), @goongmaps/goong-js (bản đồ), lucide-react (biểu tượng).'),
       P('Bước 2. Sao chép tệp frontend/.env.example thành frontend/.env. Biến VITE_API_PROXY_TARGET chỉ tới máy chủ ứng dụng; hai biến '
         'còn lại là khóa dịch vụ bản đồ Goong.'),
       FIG('env_frontend.png', 'Tệp biến môi trường mẫu của giao diện'),
       P('Bước 3. Tệp vite.config.js đặt cổng chạy là 3000 và chuyển tiếp các yêu cầu API cùng kết nối WebSocket tới máy chủ ứng dụng. '
         'Nhờ vậy trình duyệt luôn gọi cùng một địa chỉ với giao diện, cookie đăng nhập được gửi kèm mà không cần cấu hình chia sẻ tài '
         'nguyên khác nguồn.'),
       FIG('vite_config.png', 'Cấu hình Vite của dự án giao diện'),
       P('Bước 4. Khởi động giao diện và truy cập tại địa chỉ http://localhost:3000:'),
       CODE('npm run dev'),
       FIG('terminal_frontend.png', 'Kết quả khởi động giao diện'),
       H4('5.1.3.4 Chạy hệ thống bằng Docker Compose'),
       P('Tệp docker-compose.yml ở thư mục gốc khai báo bốn dịch vụ: máy chủ ứng dụng, tiến trình xử lý nền, Redis cho hàng đợi của tiến '
         'trình nền và giao diện. Máy chủ ứng dụng đọc biến môi trường từ tệp backend/.env và kết nối tới cơ sở dữ liệu trên Railway; '
         'giao diện được trỏ tới máy chủ ứng dụng qua tên dịch vụ trong mạng nội bộ của Docker.'),
       FIG('docker_compose.png', 'Khai báo các dịch vụ trong tệp Docker Compose'),
       P('Tại thư mục gốc của dự án, chạy lệnh sau để dựng và khởi động toàn bộ hệ thống; giao diện chạy ở cổng 3000, máy chủ ứng dụng ở cổng 5000:'),
       CODE('docker-compose up --build -d')]
insert_after(p513, blk)
log.append('Bổ sung 5.1.1–5.1.3')

# ═════════════════════════ 5.3 ═════════════════════════
h531 = heading('5.3.1 ', 'Heading3')
p531 = next(e for e in h531.itersiblings() if e.tag == q('w:p') and style(e) == 'ContentText')
txt531 = ptext(p531).replace('Khi phát triển trên máy cá nhân, Docker Compose dựng cùng lúc giao diện và máy chủ ứng dụng nối tới cơ sở dữ liệu trên Railway.',
                             'Khi phát triển trên máy cá nhân, hệ thống chạy theo cách trình bày ở mục 5.1.3.')
set_ptext(p531, txt531)
h532 = heading('5.3.2 ', 'Heading3'); set_ptext(h532, '5.3.5 Cấu hình và bảo mật khi triển khai')
p535 = next(e for e in h532.itersiblings() if e.tag == q('w:p') and style(e) == 'ContentText')
set_ptext(p535, 'Trên Railway, các thông tin nhạy cảm như chuỗi kết nối cơ sở dữ liệu, khóa ký token, khóa dịch vụ email và khóa xác '
          'thực của SePay được khai báo trong mục biến môi trường của từng dịch vụ; tệp .env bị loại khỏi ảnh Docker nhờ tệp '
          '.dockerignore. Khi chạy production, máy chủ từ chối phát hành và kiểm tra token nếu khóa ký ngắn hơn 32 ký tự; biến '
          'COOKIE_SECURE bật cờ chỉ gửi cookie đăng nhập qua HTTPS, và biến CORS_ORIGIN giới hạn nguồn được phép gọi API về tên miền của giao diện. Email được gửi qua giao thức HTTPS của Resend '
          'hoặc Brevo vì nhà cung cấp hạ tầng chặn cổng SMTP. Tính năng chấm công bằng khuôn mặt yêu cầu truy cập qua HTTPS để trình '
          'duyệt cho phép dùng camera.')
closing = p535.getnext()
while closing is not None and not (closing.tag == q('w:p') and ptext(closing).startswith('Chương 5 đã trình bày')):
    closing = closing.getnext()

blk = [H3('5.3.2 Triển khai máy chủ ứng dụng trên Railway'),
       P('Bước 1. Đăng nhập Railway bằng tài khoản GitHub, tạo một dự án mới và thêm dịch vụ PostgreSQL; Railway tự cấp chuỗi kết nối cho dịch vụ này.'),
       P('Bước 2. Thêm dịch vụ mới từ kho mã nguồn GitHub, đặt thư mục gốc (Root Directory) là backend. Railway nhận ra tệp Dockerfile và '
         'dựng ảnh theo tệp này.'),
       P('Bước 3. Khai báo biến môi trường cho dịch vụ: DATABASE_URL tham chiếu tới biến của dịch vụ PostgreSQL, JWT_SECRET, '
         'NODE_ENV=production, COOKIE_SECURE=true, CORS_ORIGIN là tên miền của giao diện, cùng các khóa email và SePay.'),
       P('Bước 4. Khi container khởi động, chuỗi lệnh trong Dockerfile đồng bộ lược đồ cơ sở dữ liệu (dừng lại nếu thay đổi có thể làm '
         'mất dữ liệu), chạy các bước khởi tạo dữ liệu còn thiếu rồi mới khởi động máy chủ.'),
       FIG('dockerfile_backend.png', 'Tệp Dockerfile của máy chủ ứng dụng'),
       P('Bước 5. Tạo địa chỉ công khai cho dịch vụ và khai báo địa chỉ này làm địa chỉ nhận thông báo giao dịch (webhook) trong trang quản '
         'lý của SePay.'),
       H3('5.3.3 Triển khai giao diện trên Railway'),
       P('Bước 1. Thêm dịch vụ thứ hai từ cùng kho mã nguồn, đặt thư mục gốc là frontend và chọn tệp Dockerfile.production. Tệp này biên '
         'dịch ứng dụng React ở giai đoạn đầu, sau đó chép kết quả vào ảnh Nginx để phục vụ.'),
       FIG('dockerfile_frontend.png', 'Tệp Dockerfile.production của giao diện'),
       P('Bước 2. Khai báo biến BACKEND_URL là địa chỉ của dịch vụ máy chủ ứng dụng. Khi khởi động, Nginx thay biến này vào tệp cấu hình '
         'để chuyển tiếp yêu cầu API và kết nối WebSocket, các đường dẫn còn lại trả về trang của ứng dụng React.'),
       FIG('nginx_production.png', 'Cấu hình Nginx phục vụ giao diện và chuyển tiếp yêu cầu'),
       P('Bước 3. Gắn tên miền aetherpc.site cho dịch vụ giao diện; Railway tự cấp chứng chỉ HTTPS.'),
       H3('5.3.4 Tích hợp và triển khai liên tục'),
       P('Mỗi lần mã nguồn được đẩy lên nhánh chính, GitHub Actions chạy hai công việc song song: kiểm tra lược đồ và sinh Prisma Client '
         'cho máy chủ ứng dụng, biên dịch bản production cho giao diện. Lỗi biên dịch được báo ngay trên GitHub trong khoảng một phút. '
         'Đồng thời Railway tự dựng lại và triển khai hai dịch vụ từ mã mới, không cần thao tác thủ công.'),
       FIG('ci_github_actions.png', 'Quy trình kiểm tra biên dịch tự động bằng GitHub Actions')]
insert_after(p531, blk)

rows = [('Máy cục bộ', 'Giao diện (cửa hàng, trang quản trị, cổng nhà cung cấp)', 'http://localhost:3000'),
        ('Máy cục bộ', 'Máy chủ ứng dụng', 'http://localhost:5000'),
        ('Railway', 'Cửa hàng trực tuyến', 'https://www.aetherpc.site'),
        ('Railway', 'Trang đăng nhập dùng chung', 'https://www.aetherpc.site/login'),
        ('Railway', 'Trang quản trị nghiệp vụ', 'https://www.aetherpc.site/admin'),
        ('Railway', 'Cổng nhà cung cấp', 'https://www.aetherpc.site/supplier/portal'),
        ('GitHub', 'Kho mã nguồn', 'https://github.com/hoangmkid12/ERP_AetherPC')]
blk = [H3('5.3.6 Kết quả cài đặt và triển khai'),
       P('Sau khi hoàn tất cài đặt và triển khai, hệ thống truy cập và hoạt động ổn định ở hai môi trường theo các địa chỉ dưới đây.'),
       TABLE(T_TBL3, 'Địa chỉ truy cập hệ thống ở các môi trường', ('Môi trường', 'Thành phần', 'Địa chỉ'), rows),
       P('Giao diện cửa hàng trực tuyến và trang đăng nhập sau khi triển khai:'),
       FIG('prod_home.png', 'Trang chủ cửa hàng trực tuyến sau khi triển khai'),
       FIG('prod_login.png', 'Trang đăng nhập sau khi triển khai')]
last = insert_after(p535, blk)
if closing is not None:
    last.addnext(closing)
log.append('Bổ sung 5.3.2–5.3.4, 5.3.6; đổi 5.3.2 thành 5.3.5')

# ═════════════════════════ đánh số lại Hình/Bảng chương 5 ═════════════════════════
caption_ps, maps = set(), {}
for ch in ('5',):
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
        if p not in new_caps:
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
    log.append(f'Chương 5: {cnt["Hình"]} hình, {cnt["Bảng"]} bảng')
pat = re.compile(r'(Hình|Bảng) (5)\.(\d+)')
nref = [0]
for p in body.iter(q('w:p')):
    if p in caption_ps or style(p).lower().startswith(('tableoffigures', 'toc')):
        continue
    for t in p.iter(q('w:t')):
        if t.text and pat.search(t.text):
            def sub(m):
                key = (m.group(1), m.group(2), int(m.group(3)))
                if key in maps and maps[key] != key[2]:
                    nref[0] += 1
                    return f'{m.group(1)} {m.group(2)}.{maps[key]}'
                return m.group(0)
            t.text = pat.sub(sub, t.text)
log.append(f'Cập nhật {nref[0]} tham chiếu')

tree.write(doc_path, xml_declaration=True, encoding='UTF-8', standalone=True)
rels_tree.write(rels_path, xml_declaration=True, encoding='UTF-8', standalone=True)
print('\n'.join(log))
