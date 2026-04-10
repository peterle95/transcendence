FROM node:20-bookworm-slim

WORKDIR /app

RUN apt update && apt install -y --no-install-recommends ca-certificates jq curl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

RUN npx prisma generate

COPY . .

RUN npm run build

ENTRYPOINT ["/bin/sh", "/inject/inject.sh"]

CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
# npm run build + npm start instead of npm run dev for production
