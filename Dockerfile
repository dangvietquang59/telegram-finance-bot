# Dựa trên Node 20
FROM node:20

# Tạo thư mục ứng dụng
WORKDIR /app

# Copy package.json & cài đặt
COPY package*.json ./
RUN npm install

# Copy toàn bộ project vào container
COPY . .

# Cổng mặc định Express
EXPOSE 3000

# Lệnh chạy app (gồm generate & db push)
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && node app.js"]
