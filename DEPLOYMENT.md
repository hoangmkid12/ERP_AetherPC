# Triển khai Docker

## Chuẩn bị máy chủ

- Cài Docker Engine và Docker Compose v2.
- Mở cổng 80. Khi có tên miền, thêm HTTPS bằng Caddy, Certbot hoặc reverse proxy của nhà cung cấp hosting.
- Không đưa PostgreSQL, Redis hoặc backend ra Internet; chỉ service `proxy` được publish cổng.

## Khởi tạo

1. Sao chép `.env.production.example` thành `.env.production`.
2. Thay tất cả giá trị `CHANGE_*` bằng secrets mạnh. Ví dụ: `openssl rand -base64 48` cho `JWT_SECRET`.
3. Đặt `CORS_ORIGIN` thành domain thật khi đã có domain.
4. Build và khởi tạo database lần đầu:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d db redis
docker compose --env-file .env.production -f docker-compose.production.yml run --rm backend npx prisma db push
docker compose --env-file .env.production -f docker-compose.production.yml run --rm backend node prisma/seed-if-empty.js
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

Truy cập `http://SERVER_IP` để kiểm tra. Khi có domain và TLS, cập nhật Nginx/reverse proxy để chuyển tiếp HTTPS về cổng 80 của service `proxy`.

## Vận hành

```bash
# Theo dõi log
docker compose --env-file .env.production -f docker-compose.production.yml logs -f

# Cập nhật ứng dụng
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Sao lưu volume PostgreSQL trước mọi cập nhật schema. `prisma db push` chỉ là bước bootstrap hiện tại; trước khi có dữ liệu thật, cần tạo migration nền và từ đó dùng `prisma migrate deploy` cho mọi lần nâng cấp.
