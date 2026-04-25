ARG NEXT_TELEMETRY_DISABLED=1
FROM node:20-bookworm-slim
ARG NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN	apt-get update -qq && \
	apt-get upgrade -qq && \
	apt-get install -qq \
	--no-install-recommends \
	ca-certificates jq curl && \
	rm -rf /var/cache/apt/archives \
	/var/lib/apt/lists/*
	

COPY package*.json ./
COPY prisma ./prisma/

RUN npm config set fetch-timeout 120000 && npm config set fetch-retries 10 && npm ci

RUN npx prisma generate

COPY . .

RUN npm run build

CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
# npm run build + npm start instead of npm run dev for production
