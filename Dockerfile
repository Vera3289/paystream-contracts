# syntax=docker/dockerfile:1

# ── base: toolchain + stellar CLI ─────────────────────────────────────────────
FROM rust:1.82-slim AS base
RUN rustup target add wasm32-unknown-unknown && \
    cargo install --locked stellar-cli --version 22.0.0
WORKDIR /app

# ── builder: compile contracts (production WASM) ───────────────────────────────
FROM base AS builder
COPY . .
RUN stellar contract build

# ── test: run unit tests ───────────────────────────────────────────────────────
FROM base AS test
COPY . .
CMD ["cargo", "test"]

# ── output stage: WASM artifacts only (~scratch-sized) ───────────────────────
FROM scratch AS output
COPY --from=builder /app/target/wasm32-unknown-unknown/release/*.wasm /contracts/
