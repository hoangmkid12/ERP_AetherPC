# Sử dụng image Node.js LTS chạy trên Alpine Linux để tối ưu kích thước
FROM node:20-alpine

# Cài đặt openssl cho Prisma Client hoạt động chính xác trên Alpine
# postgresql16-client cung cấp pg_dump/pg_restore cho tính năng Sao Lưu/Khôi
# Phục thật ở /admin/system. Cố định bản 16 (không phải "postgresql-client"
# mặc định — Alpine trỏ tới bản 18 mới nhất): server thật là postgres:15-alpine,
# và pg_dump 18 phát ra lệnh `SET transaction_timeout = 0` (tham số chỉ có từ
# PG 17) mà server 15 không hiểu — vô hại khi restore từng câu lệnh riêng lẻ,
# nhưng làm ROLLBACK TOÀN BỘ khi dùng --single-transaction (an toàn dữ liệu
# hơn). Bản 16 chưa phát sinh lệnh SET đó nên không gặp xung đột này.
RUN apk add --no-cache openssl postgresql16-client

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép file cấu hình package để cài đặt dependencies
COPY package*.json ./

# Cài đặt dependencies (bao gồm cả devDependencies như nodemon, prisma)
RUN npm install

# Sao chép toàn bộ mã nguồn của backend vào container
COPY . .

# Biên dịch Prisma Client cho Linux Alpine
RUN npx prisma generate

# Mở cổng port 5000 cho backend service
EXPOSE 5000

# Chạy lệnh cập nhật database schema, seed nếu trống, sau đó khởi chạy server ở chế độ ổn định
CMD ["sh", "-c", "npx prisma db push && node prisma/seed-if-empty.js && node prisma/sync-supplier-accounts.js && node prisma/seed-rbac-if-empty.js && node prisma/rebalance-warehouse-locations.js && node prisma/rename-categories.js && npm start"]
