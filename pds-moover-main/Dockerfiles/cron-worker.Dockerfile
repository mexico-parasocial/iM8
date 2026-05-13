FROM rust:1.90.0-bookworm AS builder
WORKDIR /app
COPY . /app
RUN cargo build --bin cron-worker --release

FROM rust:1.90.0-bookworm AS cron-worker
COPY --from=builder /app/target/release/cron-worker /usr/local/bin/cron-worker

CMD ["cron-worker"]