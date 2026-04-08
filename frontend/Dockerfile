FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache jq curl ca-certificates

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Accept build-time variable so it gets baked into the JS bundle
# This prevents the frontend from trying to connect to localhost
# For development, we use /auth, meaning the frontend will try to connect to http://localhost:3000/auth

ARG NEXT_PUBLIC_AUTH_SERVICE_URL=/auth
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=${NEXT_PUBLIC_AUTH_SERVICE_URL}

ENTRYPOINT ["/bin/sh", "/inject/inject.sh"]

CMD ["npm", "start"]
