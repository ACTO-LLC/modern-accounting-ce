FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 8080

# CE Phase 1a: preload runs dotenv then assertPaidNotLinked (same as npm start).
CMD ["node", "--import", "./src/ce/preload.js", "--max-old-space-size=2048", "server.js"]
