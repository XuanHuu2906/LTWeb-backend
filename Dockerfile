# Stage 1: base — shared dependencies layer (no target)
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

# Stage 2: dev — hot-reload development (target: dev)
# NOTE: src/ is NOT copied — it's bind-mounted via docker-compose.dev.yml.
# Do NOT run this stage standalone without manually mounting src/.
FROM base AS dev
RUN npm ci
COPY tsconfig.json ./
COPY docker-entrypoint.dev.sh ./
RUN chmod +x docker-entrypoint.dev.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.dev.sh"]

# Stage 3: builder — compile TypeScript + generate Prisma client (internal)
FROM base AS builder
RUN npm ci
COPY src ./src
COPY tsconfig.json ./
RUN npm run build
RUN npx prisma generate

# Stage 4: production — optimized runtime (target: production)
FROM node:22-alpine AS production
RUN apk add --no-cache curl openssl libc6-compat
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
