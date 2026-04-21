ARG NEXT_TELEMETRY_DISABLED=1
FROM node:20-alpine
ARG NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache curl jq ca-certificates

WORKDIR /app

COPY package*.json ./

RUN npm config set fetch-timeout 120000 && npm config set fetch-retries 10 && npm ci

COPY . .

EXPOSE 3001

# Accept build-time variable so it gets baked into the JS bundle
ARG NEXT_PUBLIC_AUTH_SERVICE_URL=/auth
ARG NEXT_PUBLIC_GAME_SERVICE_URL=/game

ENV NEXT_PUBLIC_AUTH_SERVICE_URL=${NEXT_PUBLIC_AUTH_SERVICE_URL}
ENV NEXT_PUBLIC_GAME_SERVICE_URL=${NEXT_PUBLIC_GAME_SERVICE_URL}

RUN npm run build
# Added npm run build, changed CMD to npm start

# Start the service
CMD ["npm", "start"]
