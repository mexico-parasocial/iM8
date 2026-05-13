FROM rust:1.90.0-bookworm AS builder
WORKDIR /app
COPY . /app
RUN cargo build --bin web --release

FROM rust:1.90.0-bookworm AS web
COPY --from=builder /app/target/release/web /usr/local/bin/web

CMD ["web"]