FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
# COPY prisma ./prisma
# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Expose port
EXPOSE 3002

# Start the dev server (skip Prisma for now)
CMD ["npm", "run", "dev"]
