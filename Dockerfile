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

# ── dev: watch mode with hot-reload on source changes ─────────────────────────
FROM base AS dev
RUN cargo install --locked cargo-watch --version 8.5.2
# Source is mounted at runtime via volume; do not COPY here
CMD ["cargo", "watch", "-x", "test"]
