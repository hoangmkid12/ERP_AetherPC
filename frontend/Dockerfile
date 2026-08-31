# Sử dụng image Node.js LTS chạy trên Alpine Linux để tối ưu kích thước
FROM node:20-alpine

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép file cấu hình package để cài đặt dependencies
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Sao chép toàn bộ mã nguồn của frontend vào container
COPY . .

# Mở cổng port 3000 cho frontend service
EXPOSE 3000

# Khởi chạy Vite dev server (vite.config.js đã có config server.host: true để truy cập ngoài container)
CMD ["npm", "run", "dev"]
