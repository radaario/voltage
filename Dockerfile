FROM node:20-bookworm AS base

WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN npm ci --include=dev || npm install --include=dev
COPY tsconfig.json .
COPY src ./src
COPY public ./public

RUN npm run build

FROM jrottenberg/ffmpeg:6.1-scratch AS ffmpeg

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/package.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/public ./public
# ffmpeg installed via apt for simplicity
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

EXPOSE 8080
CMD ["node", "dist/app.js"]

