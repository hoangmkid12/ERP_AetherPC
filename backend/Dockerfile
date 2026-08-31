# Sử dụng image Node.js LTS chạy trên Alpine Linux để tối ưu kích thước
FROM node:20-alpine

# Cài đặt openssl cho Prisma Client hoạt động chính xác trên Alpine
RUN apk add --no-cache openssl

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
CMD ["sh", "-c", "npx prisma db push && node prisma/seed-if-empty.js && node prisma/sync-supplier-accounts.js && npm start"]
