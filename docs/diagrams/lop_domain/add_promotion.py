# -*- coding: utf-8 -*-
"""Bổ sung lớp/bảng Promotion vào sơ đồ Domain, sơ đồ lớp thực thể và mô hình quan hệ phân hệ bán hàng.

Từ khi máy chủ tự tính tiền giảm theo mã khuyến mãi (services/promotion.js), use case Đặt hàng đọc bảng
promotions nên bảng này thuộc nhóm bảng chính. Bảng không có khóa ngoại (đơn hàng ghi mã đã áp vào ghi chú)
nên được vẽ đứng riêng như Holiday, CompanySettings. Vẽ đè vào vùng trống của ảnh gốc, cùng màu, nét, cỡ chữ.
Chạy một lần trên ảnh gốc: python add_promotion.py
"""
from PIL import Image, ImageDraw, ImageFont

AR = 'C:/Windows/Fonts/arial.ttf'
ARB = 'C:/Windows/Fonts/arialbd.ttf'
FILL = (124, 205, 242)


def uml_box(path, x, y, name, attrs, methods=None, fs=28, row=41, pad=16, min_w=0):
    img = Image.open(path).convert('RGB')
    d = ImageDraw.Draw(img)
    f, fb = ImageFont.truetype(AR, fs), ImageFont.truetype(ARB, fs)
    w = max([d.textlength(name, font=fb)] + [d.textlength(a, font=f) for a in attrs + (methods or [])]) + 2 * pad + 6
    w = max(w, min_w)
    head = row + 22
    h_attr = len(attrs) * row + 26
    h_meth = (len(methods) * row + 16) if methods is not None else 0
    h = head + h_attr + h_meth + (0 if methods is not None else 0)
    d.rectangle([x, y, x + w, y + h], fill=FILL, outline=(0, 0, 0), width=3)
    d.text((x + (w - d.textlength(name, font=fb)) / 2, y + 14), name, font=fb, fill=(0, 0, 0))
    d.line([(x, y + head), (x + w, y + head)], fill=(0, 0, 0), width=3)
    ty = y + head + 14
    for a in attrs:
        d.text((x + pad, ty), a, font=f, fill=(0, 0, 0)); ty += row
    if methods is not None:
        my = y + head + h_attr
        d.line([(x, my), (x + w, my)], fill=(0, 0, 0), width=3)
        ty = my + 8
        for mth in methods:
            d.text((x + pad, ty), mth, font=f, fill=(0, 0, 0)); ty += row
    img.save(path, dpi=(300, 300))
    return (x, y, x + w, y + h)


def erd_table(path, x, y, name, cols, w=380, fs=26, row=43):
    img = Image.open(path).convert('RGB')
    d = ImageDraw.Draw(img)
    f, fb = ImageFont.truetype(AR, fs), ImageFont.truetype(ARB, fs)
    h = row + 8 + len(cols) * row + 14
    d.rounded_rectangle([x, y, x + w, y + h], radius=28, fill='white', outline=(154, 154, 154), width=3)
    d.rectangle([x + 3, y + 8, x + w - 2, y + row + 4], fill=(227, 213, 242))
    d.text((x + 10, y + 12), name, font=fb, fill=(0, 0, 0))
    ty = y + row + 12
    for key, col, typ in cols:
        if key:
            d.text((x + 10, ty), key, font=fb, fill=(184, 134, 11) if key == 'PK' else (47, 111, 179))
        d.text((x + 60, ty), col, font=f, fill=(0, 0, 0))
        d.text((x + w - 10 - d.textlength(typ, font=f), ty), typ, font=f, fill=(120, 120, 120))
        ty += row
    img.save(path, dpi=(300, 300))
    return (x, y, x + w, y + h)


if __name__ == '__main__':
    print(uml_box('class_khachhang_banhang_kho.png', 2900, 920, 'Promotion',
                  ['-id : Int', '-code : String', '-title : String', '-discountType : String',
                   '-discountValue : Decimal', '-minSpend : Decimal', '-expiresAt : DateTime',
                   '-status : String', '-createdAt : DateTime', '-updatedAt : DateTime'],
                  ['+listActivePromotions()', '+checkPromotion()', '+createPromotion()',
                   '+updatePromotion()', '+deletePromotion()']))
    print(uml_box('domain.png', 1010, 160, 'Promotion',
                  ['-id', '-code', '-title', '-discountType', '-discountValue', '-minSpend', '-expiresAt',
                   '-status'], None, fs=27, row=41))
    print(erd_table('mo_hinh_quan_he_banhang_kho.png', 3700, 800, 'promotions', [
        ('PK', 'id', 'integer'), ('', 'code', 'varchar(50)'), ('', 'title', 'varchar(200)'),
        ('', 'discount_type', 'varchar(10)'), ('', 'discount_value', 'decimal(15,2)'),
        ('', 'min_spend', 'decimal(15,2)'), ('', 'expires_at', 'timestamptz?'),
        ('', 'status', 'varchar(20)'), ('', 'created_at', 'timestamptz'), ('', 'updated_at', 'timestamptz')], w=420))
