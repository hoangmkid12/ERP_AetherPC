# -*- coding: utf-8 -*-
"""Ảnh minh họa chương 5 (cấu hình, cài đặt, triển khai): cây thư mục, đoạn tệp cấu hình, kết quả lệnh.

Đoạn cấu hình trích từ tệp thật trong repo (bỏ chú thích dài, thay mật khẩu bằng ****).
Kết quả lệnh là đầu ra thật khi chạy trên máy phát triển (ẩn email, địa chỉ IP nội bộ).
Chạy: python hien_thuc.py → *.png cùng thư mục
"""
from PIL import Image, ImageDraw, ImageFont
from pygments import highlight
from pygments.formatters import ImageFormatter
from pygments.lexers import get_lexer_by_name

MONO = 'C:/Windows/Fonts/consola.ttf'
MONO_B = 'C:/Windows/Fonts/consolab.ttf'
S = 2


# ───────────────────────── cây thư mục ─────────────────────────
def tree(lines, out, title):
    f, fb = ImageFont.truetype(MONO, 15 * S), ImageFont.truetype(MONO_B, 15 * S)
    ft = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 15 * S)
    lh = 22 * S
    w = 40 * S + max(len(l) for l in lines) * 8.3 * S
    h = 64 * S + lh * len(lines)
    img = Image.new('RGB', (int(w), int(h)), (250, 250, 250))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 40 * S], fill=(236, 239, 244))
    d.text((16 * S, 10 * S), title, font=ft, fill=(40, 40, 40))
    y = 52 * S
    for ln in lines:
        code, _, cmt = ln.partition('#')
        x = 18 * S
        # phần nhánh cây xám, tên thư mục (kết thúc /) xanh đậm, tệp đen
        i = 0
        while i < len(code) and code[i] in '│├└─ ':
            i += 1
        d.text((x, y), code[:i], font=f, fill=(150, 150, 150)); x += d.textlength(code[:i], font=f)
        name = code[i:].rstrip()
        isdir = name.endswith('/')
        d.text((x, y), name, font=fb if isdir else f, fill=(30, 80, 160) if isdir else (30, 30, 30))
        if cmt:
            cx = 18 * S + d.textlength(code, font=f)
            d.text((cx, y), '# ' + cmt.strip(), font=f, fill=(0, 128, 0))
        y += lh
    img.save(out, dpi=(300, 300))


ROOT = [
    'ERP_AetherPC/',
    '├── backend/                # Máy chủ ứng dụng Node.js + Express + Prisma',
    '├── frontend/               # Ứng dụng web React (Vite)',
    '├── ai_training/            # Dữ liệu ý định, notebook huấn luyện PhoBERT',
    '├── scraper/                # Thu thập và làm sạch dữ liệu 1.580 linh kiện',
    '├── backups/                # Bản sao lưu cơ sở dữ liệu',
    '├── deploy/                 # Cấu hình Nginx cho bản production',
    '├── osrm/                   # Máy chủ định tuyến OSRM tự host (tùy chọn)',
    '├── scripts/db/             # Sao lưu / khôi phục cơ sở dữ liệu',
    '├── docs/                   # Báo cáo, sơ đồ, ảnh giao diện, đánh giá',
    '├── .github/workflows/      # Kiểm tra biên dịch tự động (GitHub Actions)',
    '├── docker-compose.yml      # Chạy toàn bộ hệ thống trên máy cục bộ',
    '├── DEPLOYMENT.md           # Hướng dẫn triển khai',
    '└── README.md',
]
FRONT = [
    'frontend/',
    '├── public/                 # Ảnh banner, biểu tượng, dữ liệu sản phẩm dự phòng',
    '├── src/',
    '│   ├── pages/',
    '│   │   ├── Storefront/      # 15 trang cửa hàng: Home, Cart, PCBuilder ...',
    '│   │   ├── Admin/           # 12 phân hệ ERP: SalesPOS, Warehouse, HR ...',
    '│   │   │   └── Delivery/    # Ứng dụng giao hàng cho shipper',
    '│   │   ├── SupplierPortal/  # Cổng nhà cung cấp',
    '│   │   └── Login.jsx',
    '│   ├── components/          # Layout, Chat, AI, Storefront, Signature ...',
    '│   ├── context/             # AuthContext, CartContext, Notification, Theme',
    '│   ├── stores/              # Kho trạng thái Zustand theo phân hệ',
    '│   ├── services/api.js      # Gọi API REST, gửi kèm cookie đăng nhập',
    '│   ├── hooks/  utils/       # Tiện ích: định tuyến bản đồ, khuôn mặt ...',
    '│   ├── styles/  locales/    # Định dạng dùng chung, đa ngôn ngữ',
    '│   ├── App.jsx              # Khai báo định tuyến và phân quyền trang',
    '│   └── main.jsx             # Điểm khởi chạy ứng dụng',
    '├── .env.example            # Biến môi trường mẫu',
    '├── vite.config.js          # Cổng 3000, chuyển tiếp API và WebSocket',
    '├── Dockerfile              # Ảnh chạy thử cục bộ',
    '├── Dockerfile.production   # Biên dịch + phục vụ bằng Nginx',
    '├── nginx.production.conf   # Chuyển tiếp API, WebSocket tới máy chủ',
    '└── package.json',
]
BACK = [
    'backend/',
    '├── prisma/',
    '│   ├── schema.prisma        # Lược đồ 56 bảng PostgreSQL',
    '│   ├── seed.js              # Nạp dữ liệu mẫu',
    '│   └── seed-*-if-empty.js   # Khởi tạo quyền, khuyến mãi ... khi khởi động',
    '├── src/',
    '│   ├── config/database.js   # Đối tượng Prisma dùng chung',
    '│   ├── routes/              # 20 tệp định tuyến theo phân hệ',
    '│   ├── middlewares/         # Xác thực JWT, phân quyền, tải tệp, xử lý lỗi',
    '│   ├── controllers/         # Xử lý nghiệp vụ: order, purchase, payment ...',
    '│   ├── services/            # Email, SePay, khuyến mãi, lương, WebSocket',
    '│   │   └── ai/              # Trợ lý AI: so khớp ý định, công cụ truy vấn',
    '│   ├── constants/  utils/   # Vai trò, nhãn trạng thái, liên kết có chữ ký',
    '│   ├── app.js               # Khởi tạo Express, gắn middleware và route',
    '│   └── server.js            # Lắng nghe cổng 5000, WebSocket, bộ hẹn giờ',
    '├── .env.example            # Biến môi trường mẫu',
    '├── Dockerfile              # Ảnh triển khai trên Railway',
    '├── nodemon.json            # Tự khởi động lại khi phát triển',
    '└── package.json            # Thư viện và lệnh npm',
]


# ───────────────────────── đoạn cấu hình ─────────────────────────
def code(src, lang, out, title):
    fmt = ImageFormatter(font_name='Consolas', font_size=15 * S, line_numbers=True, line_number_bg='#f0f0f0',
                         line_number_fg='#999999', style='default', image_pad=14 * S, line_pad=4 * S)
    tmp = out + '.tmp.png'
    open(tmp, 'wb').write(highlight(src, get_lexer_by_name(lang), fmt))
    body = Image.open(tmp).convert('RGB')
    ft = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 15 * S)
    img = Image.new('RGB', (body.width, body.height + 40 * S), 'white')
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, body.width, 40 * S], fill=(236, 239, 244))
    d.text((16 * S, 10 * S), title, font=ft, fill=(40, 40, 40))
    img.paste(body, (0, 40 * S))
    d.rectangle([0, 0, img.width - 1, img.height - 1], outline=(210, 210, 210), width=S)
    img.save(out, dpi=(300, 300))
    import os; os.remove(tmp)


ENV_BACK = '\n'.join(l for l in open('../../../backend/.env.example', encoding='utf-8').read().strip().split('\n')[2:]
                     if 'node -e' not in l).replace('# Chuỗi ngẫu nhiên >= 32 ký tự (production từ chối khóa ngắn). Tạo bằng:',
                                                    '# Chuỗi ngẫu nhiên tối thiểu 32 ký tự')
ENV_FRONT = '\n'.join(open('../../../frontend/.env.example', encoding='utf-8').read().strip().split('\n')[1:])

VITE = """import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Chạy ngoài Docker: VITE_API_PROXY_TARGET=http://localhost:5000
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://backend:5000'

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/ws':  { target: proxyTarget, ws: true, changeOrigin: true }
      }
    }
  }
})"""

PRISMA_SCHEMA = """generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}"""

PRISMA_DB = """const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: { db: { url: withPoolDefaults(process.env.DATABASE_URL) } },  // nới số kết nối
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

module.exports = prisma;"""

COMPOSE = """services:
  redis:                               # hàng đợi đơn hàng cho tiến trình nền
    image: redis:7-alpine
    ports: ["6379:6379"]

  backend:                             # máy chủ ứng dụng
    build: { context: ./backend, dockerfile: Dockerfile }
    ports: ["5000:5000"]
    env_file: [./backend/.env]
    environment:
      - DATABASE_URL=postgresql://postgres:****@<máy chủ Railway>:<cổng>/railway
      - REDIS_URL=redis://redis:6379
    depends_on: { redis: { condition: service_healthy } }

  worker:                              # tiến trình xử lý nền
    build: { context: ./backend, dockerfile: Dockerfile }
    command: npm run queue:worker

  frontend:                            # giao diện (Vite)
    build: { context: ./frontend, dockerfile: Dockerfile }
    ports: ["3000:3000"]
    environment:
      - VITE_API_PROXY_TARGET=http://backend:5000"""

DOCKER_BACK = """FROM node:20-alpine
RUN apk add --no-cache openssl postgresql16-client   # Prisma + sao lưu/khôi phục
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 5000

# Đồng bộ lược đồ (dừng nếu có nguy cơ mất dữ liệu), khởi tạo dữ liệu còn thiếu, chạy máy chủ
CMD ["sh", "-c", "npx prisma db push && node prisma/seed-if-empty.js \\
  && node prisma/seed-rbac-if-empty.js && node prisma/seed-promotions-if-empty.js \\
  && ... && npm start"]"""

DOCKER_FRONT = """# Giai đoạn 1: biên dịch ứng dụng React
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Giai đoạn 2: phục vụ tệp tĩnh bằng Nginx
FROM nginx:1.27-alpine
COPY nginx.production.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=80
ENV BACKEND_URL=http://localhost:5000    # khai báo lại trong Variables của Railway
CMD ["/bin/sh", "-c", "envsubst '${PORT} ${BACKEND_URL}' < /etc/nginx/templates/default.conf.template \\
  > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]"""

NGINX = """server {
  listen ${PORT};
  root /usr/share/nginx/html;
  client_max_body_size 12m;            # ảnh chấm công, ảnh giao hàng gửi dạng base64

  location /api/ {                     # yêu cầu API → máy chủ ứng dụng
    proxy_pass ${BACKEND_URL};
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_ssl_server_name on;
  }

  location /ws/ {                      # WebSocket chat và định vị
    proxy_pass ${BACKEND_URL};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }

  location / {                         # ứng dụng một trang: mọi đường dẫn trả index.html
    try_files $uri $uri/ /index.html;
  }
}"""

CI = """name: CI
on:
  push:         { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  backend-build:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    env:
      DATABASE_URL: postgresql://user:password@localhost:5432/ci_placeholder
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx prisma validate
      - run: npx prisma generate

  frontend-build:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build"""


# ───────────────────────── cửa sổ terminal ─────────────────────────
def terminal(lines, out, title):
    f = ImageFont.truetype(MONO, 15 * S)
    ft = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13 * S)
    lh = 21 * S
    w = max(900 * S, 40 * S + max(ImageDraw.Draw(Image.new('RGB', (1, 1))).textlength(l, font=f) for l in lines))
    h = 50 * S + lh * len(lines) + 16 * S
    img = Image.new('RGB', (int(w), int(h)), (12, 12, 12))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 32 * S], fill=(45, 45, 45))
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([12 * S + i * 20 * S, 10 * S, 24 * S + i * 20 * S, 22 * S], fill=c)
    d.text((80 * S, 7 * S), title, font=ft, fill=(210, 210, 210))
    y = 44 * S
    for ln in lines:
        col = (204, 204, 204)
        if ln.startswith('PS '):
            col = (240, 240, 240)
        elif '✔' in ln or '✅' in ln or 'ready' in ln or '➜' in ln or 'Local:' in ln:
            col = (120, 220, 120)
        elif ln.startswith('[WebSocket]') or ln.startswith('[SelfTrainedAI]'):
            col = (120, 190, 255)
        ln = ln.replace('✅', '✔').replace('✔', '√').replace('➜', '->').replace('⚠️ ', '')
        d.text((18 * S, y), ln, font=f, fill=col)
        y += lh
    img.save(out, dpi=(300, 300))


if __name__ == '__main__':
    import os
    tree(ROOT, 'cay_thu_muc_tong.png', 'Cấu trúc thư mục tổng thể của dự án')
    tree(FRONT, 'cay_thu_muc_frontend.png', 'Cấu trúc thư mục dự án giao diện (frontend)')
    tree(BACK, 'cay_thu_muc_backend.png', 'Cấu trúc thư mục dự án máy chủ (backend)')
    from vscode import save_editor, save_stack
    save_editor(ENV_BACK, 'ini', 'env_backend.png', '.env.example', ['backend', '.env.example'], 'Properties')
    save_editor(ENV_FRONT, 'ini', 'env_frontend.png', '.env.example', ['frontend', '.env.example'], 'Properties')
    save_editor(VITE, 'javascript', 'vite_config.png', 'vite.config.js', ['frontend', 'vite.config.js'], 'JavaScript')
    save_stack([(PRISMA_SCHEMA, 'prisma', 'schema.prisma', ['backend', 'prisma', 'schema.prisma'], 'Prisma'),
                (PRISMA_DB, 'javascript', 'database.js', ['backend', 'src', 'config', 'database.js'], 'JavaScript')],
               'prisma_ketnoi.png')
    save_editor(COMPOSE, 'yaml', 'docker_compose.png', 'docker-compose.yml', ['ERP_AetherPC', 'docker-compose.yml'], 'YAML')
    save_editor(DOCKER_BACK, 'docker', 'dockerfile_backend.png', 'Dockerfile', ['backend', 'Dockerfile'], 'Dockerfile')
    save_editor(DOCKER_FRONT, 'docker', 'dockerfile_frontend.png', 'Dockerfile.production', ['frontend', 'Dockerfile.production'], 'Dockerfile')
    save_editor(NGINX, 'nginx', 'nginx_production.png', 'nginx.production.conf', ['frontend', 'nginx.production.conf'], 'Nginx')
    save_editor(CI, 'yaml', 'ci_github_actions.png', 'ci.yml', ['.github', 'workflows', 'ci.yml'], 'YAML')
    here = os.path.dirname(os.path.abspath(__file__))
    out = lambda n: open(os.path.join(here, 'terminal', n), encoding='utf-8').read().rstrip('\n').split('\n')
    terminal(['PS D:\\ERP_AetherPC\\backend> node -v', 'v24.19.0', 'PS D:\\ERP_AetherPC\\backend> npm install', '...',
              'PS D:\\ERP_AetherPC\\backend> npx prisma generate'] + out('prisma.txt'),
             'terminal_prisma.png', 'Windows PowerShell — cài thư viện và sinh Prisma Client')
    terminal(['PS D:\\ERP_AetherPC\\backend> node src/server.js', ''] + out('backend.txt'),
             'terminal_backend.png', 'Windows PowerShell — khởi động máy chủ ứng dụng')
    terminal(['PS D:\\ERP_AetherPC\\frontend> npm run dev', ''] + out('vite.txt'),
             'terminal_frontend.png', 'Windows PowerShell — khởi động giao diện')
    print('done')
