# syntax=docker/dockerfile:1
# Use Node.js 22 as the base image
FROM node:22-alpine AS base

# Use a shared Corepack home so the non-root runtime user can reuse the
# pnpm version installed during the build (avoids network access on startup).
ENV COREPACK_HOME=/usr/local/share/corepack
RUN mkdir -p "$COREPACK_HOME" && corepack enable

# Set working directory
WORKDIR /app

# ============================================
# Stage 1: Build the application
# ============================================
FROM base AS builder
WORKDIR /app

# Copy dependency files first (better layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/dbagent/package.json ./apps/dbagent/
COPY apps/dbagent/.npmrc ./apps/dbagent/

# Install dependencies with BuildKit cache mount for pnpm store.
# On code-only changes, this is very fast (~5-10s) because packages are cached
# in the persistent mount, and pnpm only needs to recreate symlinks.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code
COPY apps/dbagent ./apps/dbagent

# Build the Next.js application
WORKDIR /app
RUN DATABASE_URL="dummy" OPENAI_API_KEY="dummy" pnpm -C apps/dbagent build

# ============================================
# Stage 2: Production image
# ============================================
FROM base AS runner
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the entire project structure to preserve module resolution
COPY --from=builder /app ./
COPY --from=builder $COREPACK_HOME $COREPACK_HOME

# Set correct permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose the port the app will run on
EXPOSE 8080

# Set the working directory so Corepack uses the root package.json as the
# single source of truth for the pnpm version (packageManager field).
WORKDIR /app

# Configure NODE_PATH to help with module resolution
ENV NODE_PATH=/app/node_modules

# Start both the scheduler and the Next.js application
CMD ["sh", "-c", "pnpm -C apps/dbagent db:migrate && (pnpm -C apps/dbagent dev-scheduler & pnpm -C apps/dbagent start)"]
