FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm config set fetch-timeout 120000 && npm config set fetch-retries 10 && npm ci

RUN npx prisma generate

COPY . .

EXPOSE 3000

RUN npm run build

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
# npm run build + npm start instead of npm run dev for production
