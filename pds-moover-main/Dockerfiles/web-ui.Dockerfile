FROM node:24-slim as builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY ./web-ui /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:24-alpine3.22 as web-ui
WORKDIR /app

COPY --from=builder /app/build /app/build
COPY --from=builder /app/package*.json /app/
RUN npm install --omit=dev

CMD ["node", "build"]
