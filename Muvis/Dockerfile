FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ace.js adonisrc.ts ./
RUN npm ci
COPY app ./app
COPY bin ./bin
COPY config ./config
COPY start ./start
COPY src ./src
COPY zkp ./zkp
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/build ./build
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8787/v1/health || exit 1
CMD ["node", "--enable-source-maps", "build/bin/server.js"]
