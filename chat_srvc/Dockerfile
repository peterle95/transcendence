FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3001

RUN npm run build
# Added npm run build, changed CMD to npm start

# Start the service
CMD ["npm", "start"]
