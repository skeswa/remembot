FROM oven/bun:1.2.11-alpine AS base

# BUILD STAGE
FROM base AS builder
WORKDIR /app

# Copy entire monorepo for pruning
COPY . .

# Prune the app and its dependencies
RUN bunx turbo prune web --docker

# INSTALL STAGE
FROM base AS installer
WORKDIR /app

# Copy pruned lockfile and package.json files
COPY --from=builder /app/out/json/ .

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code from pruned monorepo
COPY --from=builder /app/out/full/ .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here:
# - https://nextjs.org/telemetry
# - https://turborepo.com/docs/telemetry
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1

# Build the app
RUN bun run turbo run build --filter=web...

# RUNNER STAGE
FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=installer /app/apps/web/public ./public

# Set ownership for Next.js directories
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

CMD ["bun", "apps/web/server.js"]