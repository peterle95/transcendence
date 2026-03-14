FROM node:20-alpine

WORKDIR /app

# Copy package files and prisma schema first (needed for prisma generate)
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci

# Generate Prisma client (requires schema to be present)
RUN npx prisma generate

# Copy remaining application code
COPY . .

# Expose ports
EXPOSE 3002

# Start Next.js + Socket.IO together
CMD ["sh", "/app/docker-start.sh"]
