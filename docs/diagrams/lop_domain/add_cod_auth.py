# -*- coding: utf-8 -*-
"""Bổ sung thay đổi mã nguồn ngày 11/10/2026 vào sơ đồ lớp thực thể và mô hình quan hệ phân hệ bán hàng:
- OrderPayment / order_payments: thêm remittedAt / remitted_at và remitNote / remit_note
  (nhân viên giao hàng khai báo đã nộp tiền thu hộ).
- Customer: thêm các hàm xác thực mới loginWithGoogle(), forgotPassword(), resetPassword().
Chèn dòng bằng cách đẩy phần dưới của khung xuống và vẽ chữ cùng phông, cỡ, màu với dòng có sẵn.
Chạy MỘT lần trên ảnh gốc trong git: python add_cod_auth.py
"""
from PIL import Image, ImageDraw, ImageFont

AR = 'C:/Windows/Fonts/arial.ttf'
FILL = (124, 205, 242)
BLACK = (0, 0, 0)


def draw_top(d, xy, s, font, fill, anchor_right=False):
    """Vẽ chữ sao cho mép trên của chữ có nét lên (d, l, A…) nằm đúng y."""
    x, y = xy
    off = font.getbbox('dlAT')[1]
    if anchor_right:
        x -= d.textlength(s, font=font)
    d.text((x, y - off), s, font=font, fill=fill)


# ---------------------------------------------------------------- sơ đồ lớp
CLS = 'class_khachhang_banhang_kho.png'
img = Image.open(CLS).convert('RGB')
f = ImageFont.truetype(AR, 28)
ROW = 41

# OrderPayment: khung x 523..859, dòng -settledBy (mép trên chữ y=640), vạch phân cách y=680..683, đáy y=783..785
X0, X1, SEP, BOT = 523, 859, 674, 786
add = 2 * ROW
label = img.crop((735, 808, 801, 845))           # nhãn "0..*" của quan hệ OrderPayment–Order
lower = img.crop((X0, SEP, X1 + 1, BOT))         # vạch phân cách + 2 hàm + đáy khung
img.paste(lower, (X0, SEP + add))
d = ImageDraw.Draw(img)
d.rectangle([X0 + 3, SEP, X1 - 3, SEP + add - 1], fill=FILL)
d.rectangle([X0, SEP, X0 + 2, SEP + add - 1], fill=BLACK)
d.rectangle([X1 - 2, SEP, X1, SEP + add - 1], fill=BLACK)
tx = 541
for i, s in enumerate(['-remittedAt : DateTime', '-remitNote : String']):
    draw_top(d, (tx, 681 + i * ROW), s, f, BLACK)
# đường nối xuống Order bị khung che 82 px đầu: vẽ lại nhãn ngay dưới đáy mới
d.rectangle([735, BOT + add, 801, BOT + add + 40], fill=(255, 255, 255))
d.rectangle([802, BOT + add, 804, BOT + add + 45], fill=(51, 51, 51))
img.paste(label, (735, BOT + add + 6))

# Customer: khung x 702..1044, hàm cuối (mép trên chữ y=3074), đáy y=3115..3118 → nới ảnh thêm 3 dòng
CX0, CX1, CBOT = 702, 1044, 3110
addc = 3 * ROW
W, H = img.size
big = Image.new('RGB', (W, H + addc + 10), (255, 255, 255))
big.paste(img, (0, 0))
tail = img.crop((CX0, CBOT, CX1 + 1, H))
big.paste(Image.new('RGB', (CX1 - CX0 + 1, H - CBOT), (255, 255, 255)), (CX0, CBOT))
big.paste(tail, (CX0, CBOT + addc))
d = ImageDraw.Draw(big)
d.rectangle([CX0 + 3, CBOT, CX1 - 3, CBOT + addc - 1], fill=FILL)
d.rectangle([CX0, CBOT, CX0 + 2, CBOT + addc - 1], fill=BLACK)
d.rectangle([CX1 - 2, CBOT, CX1, CBOT + addc - 1], fill=BLACK)
for i, s in enumerate(['+loginWithGoogle()', '+forgotPassword()', '+resetPassword()']):
    draw_top(d, (718, 3115 + i * ROW), s, f, BLACK)
big.save(CLS, dpi=(300, 300))

# ---------------------------------------------------------------- mô hình quan hệ
# Khung order_payments: x 650..1063, viền xám (154,154,154), góc dưới bo tròn bán kính ~35 px bắt đầu từ y≈3662,
# đáy y≈3697. Dòng settled_by (mép trên chữ y=3664) nằm ngay trong vùng bo góc, nên: tách dải đáy 3652..3700,
# xoá chữ trong dải (giữ cung bo góc), đẩy dải xuống 2 dòng rồi vẽ lại 3 dòng cuối.
ERD = 'mo_hinh_quan_he_banhang_kho.png'
img = Image.open(ERD).convert('RGB')
EX0, EX1, TOP, BOTTOM = 645, 1070, 3652, 3702
EROW = 43
adde = 2 * EROW
tail = img.crop((EX0, TOP, EX1, BOTTOM))
px = tail.load()
cx, cy = 1027 - EX0, 3662 - TOP
for y in range(3692 - TOP):  # chữ dừng ở y≈3688, viền đáy ở 3696–3697
    for x in range(700 - EX0, 1060 - EX0):
        on_arc = x > cx and y > cy and 29 <= ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 <= 40
        if not on_arc:
            px[x, y] = (255, 255, 255)
d = ImageDraw.Draw(img)
d.rectangle([EX0, TOP, EX1, BOTTOM + adde], fill=(255, 255, 255))
img.paste(tail, (EX0, TOP + adde))
border = img.getpixel((651, 3600))
d.rectangle([650, TOP, 652, TOP + adde + 10], fill=border)
d.rectangle([1061, TOP, 1063, TOP + adde + 10], fill=border)
fe = ImageFont.truetype(AR, 26)
GREY = (119, 119, 119)
for i, (n, t) in enumerate([('settled_by', 'varchar(100)?'), ('remitted_at', 'timestamptz?'), ('remit_note', 'varchar(255)?')]):
    y = 3664 + i * EROW
    draw_top(d, (714, y), n, fe, BLACK)
    draw_top(d, (1052, y), t, fe, GREY, anchor_right=True)
img.save(ERD, dpi=(300, 300))
print('ok')
