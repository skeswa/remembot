FROM oven/bun:1.2.11-alpine AS base

# BUILD STAGE
FROM base AS builder
WORKDIR /app

# Copy entire monorepo for pruning
COPY . .

# Prune the app and its dependencies
RUN bunx turbo prune courier --docker

# INSTALL STAGE
FROM base AS installer
WORKDIR /app

# Copy pruned lockfile and package.json files
COPY --from=builder /app/out/json/ .

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code from pruned monorepo
COPY --from=builder /app/out/full/ .

# Build the app
RUN bun run turbo run build --filter=courier...

# RUNNER STAGE
FROM base
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 bunuser
USER bunuser

# Copy compiled executable
COPY --from=installer --chown=bunuser:nodejs /app/apps/courier/dist/courier ./

CMD ["./courier"]