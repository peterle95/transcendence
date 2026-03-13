FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
# COPY prisma ./prisma
# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Expose ports
EXPOSE 3002

# Start Next.js + Socket.IO together
CMD ["sh", "/app/docker-start.sh"]
