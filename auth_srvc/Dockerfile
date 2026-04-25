FROM node:20-alpine
ARG NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apk add --no-cache -q ca-certificates jq curl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm config set fetch-timeout 120000 && npm config set fetch-retries 10 && npm ci

RUN npx prisma generate

COPY . .

RUN npm run build
