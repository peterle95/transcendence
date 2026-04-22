ARG NEXT_TELEMETRY_DISABLED=1
FROM node:20-alpine
ARG NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Prisma requires OpenSSL on Alpine
RUN apk add --no-cache openssl ca-certificates jq curl

# Copy package files and prisma schema first (needed for prisma generate)
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm config set fetch-timeout 120000 && npm config set fetch-retries 10 && npm ci

# Generate Prisma client (requires schema to be present)
RUN npx prisma generate

# Copy remaining application code
COPY . .

# Accept build-time variables
ARG NEXT_PUBLIC_AUTH_SERVICE_URL=/auth
ARG NEXT_PUBLIC_GAME_SERVICE_URL=/game
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=${NEXT_PUBLIC_AUTH_SERVICE_URL}
ENV NEXT_PUBLIC_GAME_SERVICE_URL=${NEXT_PUBLIC_GAME_SERVICE_URL}

RUN npm run build

# Start Next.js + Socket.IO together
CMD ["sh", "-c", "npx prisma migrate deploy && (npm run start:socket & npx next start -H 0.0.0.0 -p 3002)"]
