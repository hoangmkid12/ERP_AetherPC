# -*- coding: utf-8 -*-
"""Sơ đồ kiến trúc tổng thể (Hình 4.1) — vẽ theo hệ thống đang triển khai trên Railway.

Đối chiếu mã nguồn:
  frontend/Dockerfile.production + nginx.production.conf  — Nginx phục vụ SPA, chuyển tiếp /api/ và /ws/
  backend/src/app.js, routes/, middlewares/, controllers/, services/, config/database.js (Prisma dùng chung)
  backend/src/services/websocketService.js — /ws/cskh (chat CSKH), /ws/tracking (vị trí shipper)
  backend/src/services/orderScheduler.js   — mỗi phút: tự duyệt đơn COD quá 5 giờ, tự hủy đơn chưa thanh toán
  routes/payment.routes.js (webhook SePay), services/emailService.js (Resend / Brevo / Gmail),
  controllers/ai.controller.js (Gemini), controllers/routeOptimizer.controller.js (OSRM Table API),
  frontend/src/utils/routingService.js (Goong, Nominatim, OSRM), utils/faceRecognition.js (face-api.js)
Redis + orderWorker không vẽ: hàng đợi chỉ được gọi từ script demo, chưa nằm trong luồng nghiệp vụ.
Chạy: python kientruc.py → kientruc_tongthe.png
"""
from PIL import Image, ImageDraw, ImageFont

S = 2
F = lambda size, bold=False: ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf', size * S)
f_txt, f_b, f_cl, f_lb = F(13), F(14, True), F(15, True), F(12)
INK, LINE, GRAY = (30, 30, 30), (60, 60, 60), (110, 110, 110)
FILL_BOX, FILL_LAYER, FILL_DB = (255, 255, 255), (234, 244, 252), (242, 242, 242)

W_, H_ = 1240, 1010
img = Image.new('RGB', (W_ * S, H_ * S), 'white')
d = ImageDraw.Draw(img)
P = lambda *v: [x * S for x in v]


def tw(t, f): return d.textlength(t, font=f)


def text_block(x0, y0, x1, y1, lines, bold_first=True, align='center'):
    fonts = [f_b if (i == 0 and bold_first) else f_txt for i in range(len(lines))]
    lh = 18 * S
    total = lh * len(lines)
    y = (y0 * S + y1 * S - total) / 2
    for ln, f in zip(lines, fonts):
        x = (x0 * S + x1 * S - tw(ln, f)) / 2 if align == 'center' else x0 * S + 12 * S
        d.text((x, y), ln, font=f, fill=INK)
        y += lh


def box(x0, y0, x1, y1, lines, fill=FILL_BOX, bold_first=True, align='center', r=10):
    d.rounded_rectangle(P(x0, y0, x1, y1), radius=r * S, fill=fill, outline=LINE, width=2 * S // 2 + 1)
    text_block(x0, y0, x1, y1, lines, bold_first, align)
    return (x0, y0, x1, y1)


def cluster(x0, y0, x1, y1, title, dashed=False):
    if dashed:
        for x in range(x0, x1, 14):
            d.line(P(x, y0, min(x + 8, x1), y0), fill=GRAY, width=2 * S // 2 + 1)
            d.line(P(x, y1, min(x + 8, x1), y1), fill=GRAY, width=2 * S // 2 + 1)
        for y in range(y0, y1, 14):
            d.line(P(x0, y, x0, min(y + 8, y1)), fill=GRAY, width=2 * S // 2 + 1)
            d.line(P(x1, y, x1, min(y + 8, y1)), fill=GRAY, width=2 * S // 2 + 1)
    else:
        d.rounded_rectangle(P(x0, y0, x1, y1), radius=14 * S, outline=GRAY, width=2 * S // 2 + 1)
    d.text((x0 * S + 14 * S, y0 * S + 8 * S), title, font=f_cl, fill=INK)


def cylinder(x0, y0, x1, y1, lines):
    e = 18
    d.rectangle(P(x0, y0 + e / 2, x1, y1 - e / 2), fill=FILL_DB)
    d.line(P(x0, y0 + e / 2, x0, y1 - e / 2), fill=LINE, width=3)
    d.line(P(x1, y0 + e / 2, x1, y1 - e / 2), fill=LINE, width=3)
    d.chord(P(x0, y1 - e, x1, y1), 0, 180, fill=FILL_DB, outline=LINE, width=3)
    d.ellipse(P(x0, y0, x1, y0 + e), fill=FILL_DB, outline=LINE, width=3)
    text_block(x0, y0 + e, x1, y1, lines)


def arrow(pts, label=None, lpos=None, both=False, dashed=False):
    pts = [(x * S, y * S) for x, y in pts]
    for a, b in zip(pts, pts[1:]):
        if dashed:
            import math
            L = math.dist(a, b); n = int(L // (12 * S))
            for i in range(n):
                t0, t1 = i / n, min(1, (i + 0.55) / n)
                d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0),
                        (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)], fill=LINE, width=3)
        else:
            d.line([a, b], fill=LINE, width=3)

    def head(tip, frm):
        import math
        ang = math.atan2(tip[1] - frm[1], tip[0] - frm[0])
        L, Wd = 13 * S, 6 * S
        p1 = (tip[0] - L * math.cos(ang) + Wd * math.sin(ang), tip[1] - L * math.sin(ang) - Wd * math.cos(ang))
        p2 = (tip[0] - L * math.cos(ang) - Wd * math.sin(ang), tip[1] - L * math.sin(ang) + Wd * math.cos(ang))
        d.polygon([tip, p1, p2], fill=LINE)
    head(pts[-1], pts[-2])
    if both:
        head(pts[0], pts[1])
    if label:
        lx, ly = lpos
        lines = label.split('\n')
        for i, ln in enumerate(lines):
            w = tw(ln, f_lb)
            yy = ly * S + i * 16 * S
            d.rectangle([lx * S - 3 * S, yy, lx * S + w + 3 * S, yy + 15 * S], fill='white')
            d.text((lx * S, yy), ln, font=f_lb, fill=GRAY)


# ───────── Tầng giao diện ─────────
cluster(20, 20, 900, 230, 'TẦNG GIAO DIỆN — Trình duyệt (ứng dụng web một trang React)')
bw, gap, x = 160, 12, 34
users = [['Cửa hàng trực tuyến', '(Khách hàng)'], ['Trang quản trị', '(Nhân viên, Ban GĐ)'],
         ['Ứng dụng giao hàng', '(NV giao hàng)'], ['Cổng nhân viên', '(chấm công, phiếu lương)'],
         ['Cổng nhà cung cấp', '(Nhà cung cấp)']]
for u in users:
    box(x, 56, x + bw, 116, u); x += bw + gap
box(34, 132, 886, 214, ['React 18 + Vite · React Router (tải trang theo nhu cầu, định tuyến theo vai trò)',
                        'Zustand / Context API (trạng thái) · Leaflet (bản đồ) · face-api.js (nhận diện khuôn mặt ngay trên trình duyệt)',
                        'Gọi API REST kèm cookie đăng nhập HTTP-only · WebSocket cho chat và định vị'],
    fill=FILL_LAYER, bold_first=False)

# ───────── Railway ─────────
cluster(20, 270, 900, 990, 'HẠ TẦNG RAILWAY', dashed=True)
ngx = box(150, 300, 770, 360, ['Máy chủ web Nginx (giao diện)',
                               'Phục vụ tệp của ứng dụng React · chuyển tiếp yêu cầu API và kết nối WebSocket tới máy chủ ứng dụng'])
arrow([(460, 230), (460, 300)], 'HTTPS: gọi API REST   ·   WSS: kênh chat và kênh định vị', (468, 252), both=True)

cluster(40, 390, 880, 830, 'TẦNG ỨNG DỤNG — Máy chủ Node.js + Express (cổng 5000)')
rt = box(60, 424, 600, 482, ['Lớp định tuyến (routes)', 'Điểm truy cập theo phân hệ: xác thực, đơn hàng, mua hàng, kho, nhân sự, thanh toán ...'], fill=FILL_LAYER)
mw = box(60, 504, 600, 562, ['Lớp trung gian (middlewares)', 'Xác thực JWT · phân quyền theo vai trò và ma trận nghiệp vụ · chuẩn hóa lỗi'], fill=FILL_LAYER)
ct = box(60, 584, 600, 642, ['Lớp xử lý nghiệp vụ (controllers)', 'Bán hàng, mua hàng, kho, lắp ráp, giao vận, kế toán, nhân sự, CSKH, quản trị'], fill=FILL_LAYER)
sv = box(60, 664, 862, 722, ['Lớp dịch vụ (services)', 'Email · khuyến mãi · đồng bộ tồn kho · thanh toán SePay · duyệt đơn · chính sách lương · trợ lý AI · tối ưu tuyến'], fill=FILL_LAYER)
pr = box(60, 744, 862, 802, ['Prisma ORM', 'Một đối tượng kết nối dùng chung cho toàn bộ truy cập dữ liệu'], fill=FILL_LAYER)
for a, b in ((rt, mw), (mw, ct), (ct, sv), (sv, pr)):
    arrow([(330, a[3]), (330, b[1])])
ws = box(630, 424, 862, 520, ['Máy chủ WebSocket', 'Kênh chat chăm sóc khách hàng', 'Kênh định vị nhân viên giao hàng'])
sch = box(630, 540, 862, 640, ['Bộ hẹn giờ (mỗi phút)', 'Tự duyệt đơn COD chờ quá 5 giờ', 'Tự hủy đơn quá hạn thanh toán'])
arrow([(580, 360), (580, 424)])                       # /api → lớp định tuyến
arrow([(746, 360), (746, 424)])                       # /ws → WebSocket
arrow([(630, 472), (615, 472), (615, 664)])           # WebSocket → dịch vụ (lưu tin nhắn, vị trí)
arrow([(746, 640), (746, 664)])                       # hẹn giờ → dịch vụ duyệt / hủy đơn

db = cylinder(250, 880, 650, 975, ['Tầng dữ liệu — PostgreSQL (Railway)', '56 bảng · khóa ngoại · giao dịch, khóa theo đơn'])
arrow([(330, 802), (330, 880)], 'SQL qua Prisma', (338, 834), both=True)

# ───────── Dịch vụ bên ngoài ─────────
cluster(930, 20, 1220, 990, 'DỊCH VỤ BÊN NGOÀI')
box(950, 56, 1200, 140, ['Dịch vụ bản đồ', 'Goong, OpenStreetMap /', 'Nominatim, OSRM chỉ đường'])
arrow([(900, 98), (950, 98)])
box(950, 290, 1200, 374, ['Cổng thanh toán SePay', 'Mã VietQR · webhook báo', 'giao dịch ngân hàng'])
arrow([(950, 330), (770, 330)], 'Webhook', (842, 312))
box(950, 580, 1200, 640, ['OSRM Table API', 'Tối ưu thứ tự điểm giao'])
box(950, 663, 1200, 723, ['Dịch vụ email', 'Resend / Brevo / Gmail SMTP'])
box(950, 746, 1200, 806, ['Google Gemini API', 'Trợ lý AI nội bộ, chatbot'])
arrow([(862, 678), (905, 678), (905, 610), (950, 610)])
arrow([(862, 693), (950, 693)])
arrow([(862, 708), (915, 708), (915, 776), (950, 776)])

img.save('kientruc_tongthe.png', dpi=(300, 300))
print(img.size)
