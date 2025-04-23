# Dựa trên Node 20
FROM node:20

# Tạo thư mục ứng dụng
WORKDIR /app

# Copy package.json & cài đặt
COPY package*.json ./
RUN npm install

# Copy toàn bộ project vào container
COPY . .

# Build Prisma
RUN npx prisma generate

# Cổng mặc định Express
EXPOSE 3000

# Lệnh chạy app
CMD ["node", "app.js"]
