FROM node:20-alpine

RUN apk add --no-cache jq curl ca-certificates

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .
# Accept build-time variable so it gets baked into the JS bundle
ARG NEXT_PUBLIC_AUTH_SERVICE_URL=/auth
ARG NEXT_PUBLIC_GAME_SERVICE_URL=/game

ENV NEXT_PUBLIC_AUTH_SERVICE_URL=${NEXT_PUBLIC_AUTH_SERVICE_URL}
ENV NEXT_PUBLIC_GAME_SERVICE_URL=${NEXT_PUBLIC_GAME_SERVICE_URL}

RUN npm run build
# Added npm run build, changed CMD to npm start

ENTRYPOINT ["/bin/sh", "/inject/inject.sh"]
# Start the service
CMD ["npm", "start"]
