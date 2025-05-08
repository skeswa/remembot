FROM oven/bun:1.2.11 as base

# BUILD STAGE
FROM base AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://turbo.build/install.sh | sh

# Copy entire monorepo for pruning
COPY . .

# Prune the web app and its dependencies
RUN turbo prune web --docker

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
RUN bun run turbo run build --filter=web...

# RUNNER STAGE
FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set ownership for Next.js directories
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

EXPOSE 3000

CMD ["node", "apps/web/server.js"] 