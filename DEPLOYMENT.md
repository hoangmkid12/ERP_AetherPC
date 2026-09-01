# Triển khai Docker

## Chuẩn bị máy chủ

- Cài Docker Engine và Docker Compose v2.
- Mở cổng 80. Khi có tên miền, thêm HTTPS bằng Caddy, Certbot hoặc reverse proxy của nhà cung cấp hosting.
- Không đưa PostgreSQL hoặc backend ra Internet; chỉ service `proxy` được publish cổng.

## Khởi tạo

1. Sao chép `.env.production.example` thành `.env.production`.
2. Thay tất cả giá trị `CHANGE_*` bằng secrets mạnh. Ví dụ: `openssl rand -base64 48` cho `JWT_SECRET`.
3. Đặt `CORS_ORIGIN` thành domain thật khi đã có domain.
4. **Giữ nguyên `COOKIE_SECURE=false`** cho đến khi bước 7 (TLS) hoàn tất — xem cảnh báo ngay dưới đây.
5. Build và khởi tạo database lần đầu:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d db
docker compose --env-file .env.production -f docker-compose.production.yml run --rm backend npx prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.production.yml run --rm backend node prisma/seed-if-empty.js
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

6. **⚠️ Bắt buộc ngay sau khi seed**: `seed-if-empty.js` tạo các tài khoản demo (CEO, ADMIN, các trưởng phòng...) với mật khẩu mặc định `123456`. Đây là dữ liệu trình bày cho đồ án, **không an toàn để dùng thật**. Trước khi cho bất kỳ ai ngoài bạn truy cập hệ thống, hãy đăng nhập từng tài khoản quản trị và đổi mật khẩu qua trang Hồ Sơ, hoặc cập nhật trực tiếp `password_hash` trong bảng `employees`/`customers`.

Truy cập `http://SERVER_IP` để kiểm tra (lúc này đăng nhập vẫn hoạt động vì `COOKIE_SECURE=false`).

7. Khi có domain và TLS thật (Caddy, Certbot, hoặc reverse proxy của nhà cung cấp hosting), cập nhật để chuyển tiếp HTTPS về cổng 80 của service `proxy`, **rồi mới** đặt `COOKIE_SECURE=true` trong `.env.production` và chạy lại `docker compose ... up -d --build backend`.

> **Cảnh báo quan trọng**: Cookie đăng nhập chỉ được đánh dấu `Secure` khi `COOKIE_SECURE=true`. Nếu bạn đặt biến này thành `true` trước khi HTTPS thực sự hoạt động, trình duyệt sẽ **âm thầm từ chối lưu cookie** — không ai đăng nhập được, kể cả CEO/ADMIN, mà không có lỗi rõ ràng nào hiện ra. Luôn giữ `false` cho tới khi xác nhận HTTPS chạy đúng.

## Vận hành

```bash
# Theo dõi log
docker compose --env-file .env.production -f docker-compose.production.yml logs -f

# Cập nhật ứng dụng
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Sao lưu volume PostgreSQL trước mọi cập nhật schema. Mọi thay đổi `schema.prisma` phải đi kèm một migration mới (`npx prisma migrate dev --name ...` ở máy dev, commit thư mục `prisma/migrations/`), rồi áp dụng ở production bằng `npx prisma migrate deploy` như bước khởi tạo — không dùng `prisma db push` cho production.
