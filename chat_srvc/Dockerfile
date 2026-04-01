FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3001

# Accept build-time variable so it gets baked into the JS bundle
ARG NEXT_PUBLIC_AUTH_SERVICE_URL=/auth
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=${NEXT_PUBLIC_AUTH_SERVICE_URL}

RUN npm run build
# Added npm run build, changed CMD to npm start

# Start the service
CMD ["npm", "start"]
