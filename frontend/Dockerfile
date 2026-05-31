# frontend/Dockerfile

FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Build Next.js app
# These are build-time placeholders — real values injected at runtime
ENV NEXTAUTH_SECRET="build-placeholder"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV GITHUB_CLIENT_ID="build-placeholder"
ENV GITHUB_CLIENT_SECRET="build-placeholder"
ENV NEXT_PUBLIC_API_URL="http://localhost:3001"

RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nextjs -u 1001

# Copy built app from builder
RUN mkdir -p ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public* ./public/

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
