FROM rust:1.90.0-bookworm AS builder
WORKDIR /app
COPY . /app
RUN cargo build --bin worker --release

FROM rust:1.90.0-bookworm AS worker
COPY --from=builder /app/target/release/worker /usr/local/bin/worker

CMD ["worker"]