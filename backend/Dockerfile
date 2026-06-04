# backend/Dockerfile — Multi-stage build optimized for Windows Docker Desktop

# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache \
    openssl \
    dumb-init \
    git \
    libc6-compat

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodejs -u 1001

# Copy package files and install ONLY production deps inside the container
# This avoids the slow node_modules copy between stages on Windows
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npx prisma generate

# Copy source code only (small — fast)
COPY --from=builder /app/src ./src

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1
CMD ["node", "src/server.js"]
