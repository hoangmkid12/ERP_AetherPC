# Sinh sơ đồ BPMN "Quy trình Chấm Công & Tính Lương" (Hình 3.4 trong báo cáo).
# Chạy: python quy_trinh_tinh_luong.py  → quy_trinh_tinh_luong.png cùng thư mục.
# Cổng rẽ nhánh là hình thoi trống, đồng bộ với Hình 3.1–3.3 và các sơ đồ chức năng.
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Circle, Polygon, Rectangle

plt.rcParams['font.family'] = ['Arial', 'DejaVu Sans']
W, H = 232, 146
fig, ax = plt.subplots(figsize=(W / 10, H / 10))
ax.set_xlim(0, W)
ax.set_ylim(0, H)
ax.axis('off')

LINE = '#222222'
LANES = ['Nhân Viên', 'Hệ Thống', 'Nhân Viên Nhân Sự', 'Ban Giám Đốc', 'Nhân Viên Kế Toán']
LANE_H = 26
TOP = 134
lane_y = {name: TOP - LANE_H * i - LANE_H / 2 for i, name in enumerate(LANES)}

# Tiêu đề và pool
ax.add_patch(Rectangle((1, 138), 70, 6, fill=False, lw=1.2, ec=LINE))
ax.text(3, 141, 'Quy Trình Nghiệp Vụ Chấm Công & Tính Lương', fontsize=11, weight='bold', va='center')
ax.add_patch(Rectangle((2, TOP - LANE_H * len(LANES)), W - 3, LANE_H * len(LANES), fill=False, lw=1.2, ec='#333333'))
ax.add_patch(Rectangle((2, TOP - LANE_H * len(LANES)), 4, LANE_H * len(LANES), fill=False, lw=1.2, ec='#333333'))
ax.text(4, TOP - LANE_H * len(LANES) / 2, 'Hệ Thống AetherPC - Chấm Công & Tính Lương', rotation=90, fontsize=11, weight='bold', ha='center', va='center')
for i, name in enumerate(LANES):
    y0 = TOP - LANE_H * (i + 1)
    ax.add_patch(Rectangle((6, y0), W - 7, LANE_H, fill=False, lw=0.9, ec='#888888'))
    ax.add_patch(Rectangle((6, y0), 4.5, LANE_H, fill=False, lw=0.9, ec='#888888'))
    ax.text(8.25, y0 + LANE_H / 2, name, rotation=90, fontsize=9.5, weight='bold', ha='center', va='center')


def task(x, y, text, w=22, h=12):
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle='round,pad=0,rounding_size=1.6', fc='white', ec=LINE, lw=1.3))
    ax.text(x, y, text, ha='center', va='center', fontsize=8.6, linespacing=1.25)


def gateway(x, y, label, r=4.5, label_pos='below'):
    ax.add_patch(Polygon([(x, y + r), (x + r, y), (x, y - r), (x - r, y)], closed=True, fc='white', ec=LINE, lw=1.3))
    dy = -(r + 2.2) if label_pos == 'below' else (r + 2.2)
    ax.text(x, y + dy, label, ha='center', va='center', fontsize=8.6, weight='bold')


def event(x, y, text, end=False):
    ax.add_patch(Circle((x, y), 3, fc='white', ec=LINE, lw=3 if end else 1.3))
    ax.text(x, y - 5.5, text, ha='center', va='top', fontsize=8.4, linespacing=1.2)


def flow(points, label=None, label_at=None, dashed=False):
    xs, ys = zip(*points)
    ax.plot(xs[:-1] + (xs[-1],), ys, color=LINE, lw=1.2, ls='--' if dashed else '-')
    if not dashed:
        ax.annotate('', xy=points[-1], xytext=points[-2], arrowprops=dict(arrowstyle='-|>', color=LINE, lw=1.2, mutation_scale=11, shrinkA=0, shrinkB=0))
    if label:
        lx, ly = label_at
        ax.text(lx, ly, label, fontsize=7.8, color='#333333', ha='center', va='center', backgroundcolor='white')


NV, HT, HR, BGD, KT = (lane_y[n] for n in LANES)

# ── Nhân Viên ──
event(16, NV, 'Bắt Đầu\nNgày Làm Việc')
task(38, NV, 'Chấm Công Bằng\nKhuôn Mặt\n(Vào Ca / Ra Ca)')
# ── Hệ Thống ──
task(38, HT, 'So Khớp Khuôn Mặt\nVới Mẫu Đã Đăng Ký\n(Thử Thách Quay Đầu)')
gateway(60, HT, 'Khớp?', label_pos='below')
task(84, HT, 'Ghi Giờ Vào / Ra,\nTính Đi Muộn, Giờ Làm,\nTăng Ca', w=24)
# ── Nhân Sự ──
gateway(84, HR, 'Hết Kỳ\nLương?', label_pos='below')
task(106, HR, 'Rà Soát Bảng Công\n& Điều Chỉnh Chấm\nCông Thủ Công')
task(130, HR, 'Tính Lương Kỳ\n(Tạo Phiếu Nháp)')
task(130, HT, 'Tự Tính Phiếu Lương\nTừng Nhân Viên')
task(156, HR, 'Điều Chỉnh Thưởng /\nKhấu Trừ & Trình\nBan Giám Đốc', w=24)
# ── Ban Giám Đốc ──
task(156, BGD, 'Xem Xét Bảng Lương\n(Tổng Quỹ Lương)', w=24)
gateway(182, BGD, 'Duyệt?', label_pos='below')
# ── Kế Toán ──
task(182, KT, 'Giải Ngân Lương &\nGhi Sổ Cái (Chi Phí)', w=24)
# ── Nhân Viên ──
task(206, NV, 'Xem Phiếu Lương\nCá Nhân', w=20)
event(225, NV, 'Hoàn Tất\nKỳ Lương', end=True)

# Ghi chú công thức gắn với bước tự tính lương
note = ('• Công chuẩn = số ngày làm việc trong tháng; nghỉ lễ, phép đã duyệt hưởng lương\n'
        '• Lương theo công = (LCB + PC chức vụ) × ngày hưởng lương / công chuẩn\n'
        '• Tăng ca 150% ngày thường · 200% ngày nghỉ · 300% ngày lễ\n'
        '• Hoa hồng bán hàng, thưởng lắp ráp; trừ chuyên cần theo phút đi muộn\n'
        '• BH NLĐ 10,5% (BHXH 8%, BHYT 1,5%, BHTN 1%); DN đóng 21,5%\n'
        '• Thuế TNCN lũy tiến sau giảm trừ gia cảnh → Thực lĩnh')
ax.add_patch(Rectangle((146, HT - 11), 81, 22, fc='#fffde7', ec='#999999', lw=0.9))
ax.text(148, HT, note, fontsize=7.6, va='center', ha='left', linespacing=1.45)
flow([(141, HT), (146, HT)], dashed=True)

# Luồng tuần tự
flow([(19, NV), (27, NV)])
flow([(38, NV - 6), (38, HT + 6)])
flow([(49, HT), (55.5, HT)])
flow([(60, HT + 4.5), (60, NV), (49, NV)], 'Không khớp – chụp lại', (60, HT + 13))
flow([(64.5, HT), (72, HT)], 'Khớp', (68.2, HT + 2.2))
flow([(84, HT - 6), (84, HR + 4.5)])
flow([(79.5, HR), (24, HR), (24, NV - 3), (27, NV - 3)], 'Chưa hết kỳ – ngày làm việc tiếp theo', (52, HR + 2.2))
flow([(88.5, HR), (95, HR)], 'Hết kỳ', (91.7, HR + 2.2))
flow([(117, HR), (119, HR)])
flow([(126, HR + 6), (126, HT - 6)])
flow([(134, HT - 6), (134, HR + 9), (156, HR + 9), (156, HR + 6)])
flow([(156, HR - 6), (156, BGD + 6)], 'Chờ Ban Giám Đốc duyệt', (156, (HR + BGD) / 2))
flow([(168, BGD), (177.5, BGD)])
flow([(182, BGD + 4.5), (182, HR), (168, HR)], 'Trả về kèm lý do', (182, (HR + BGD) / 2 + 2))
flow([(182, BGD - 4.5), (182, KT + 6)], 'Đã duyệt – chờ giải ngân', (182, (BGD + KT) / 2 - 1.5))
flow([(194, KT), (206, KT), (206, NV - 6)], 'Đã chi trả lương', (206, (KT + BGD) / 2))
flow([(216, NV), (222, NV)])

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'quy_trinh_tinh_luong')
fig.savefig(out + '.png', dpi=120, bbox_inches='tight', facecolor='white')
print('saved', out)
