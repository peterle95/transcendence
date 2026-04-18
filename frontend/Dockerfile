FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm config set fetch-timeout 120000 && npm config set fetch-retries 10 && npm ci

COPY . .

# Accept build-time variable so it gets baked into the JS bundle
# This prevents the frontend from trying to connect to localhost
# For development, we use /auth, meaning the frontend will try to connect to http://localhost:8080/auth

ARG NEXT_PUBLIC_AUTH_SERVICE_URL=/auth
ARG NEXT_PUBLIC_CHAT_SERVICE_URL=/chat
ARG NEXT_PUBLIC_GAME_SERVICE_URL=/game

ENV NEXT_PUBLIC_AUTH_SERVICE_URL=${NEXT_PUBLIC_AUTH_SERVICE_URL}
ENV NEXT_PUBLIC_CHAT_SERVICE_URL=${NEXT_PUBLIC_CHAT_SERVICE_URL}
ENV NEXT_PUBLIC_GAME_SERVICE_URL=${NEXT_PUBLIC_GAME_SERVICE_URL}

RUN npm run build

EXPOSE 3003

CMD ["npm", "start"]
