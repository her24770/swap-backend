ARG SOURCE_DATE_EPOCH=0

# ─────────────────────────────────────────────
# Stage 1: Builder
# ─────────────────────────────────────────────
FROM node:22.22.3-alpine3.22@sha256:cd7807368cf24826297cbad5dca1a44972ccfd770647db52a8c7589eb4599ac8 AS builder

ARG SOURCE_DATE_EPOCH

RUN apk add --no-cache \
    openssl=3.5.9-r0 \
    gcompat=1.1.0-r4
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --no-audit --no-fund

# Generar el cliente de Prisma
RUN ./node_modules/.bin/prisma generate

COPY tsconfig.json vitest.config.ts ./
COPY src ./src/
COPY scripts ./scripts/
COPY tests ./tests/

# Build TypeScript → JavaScript
RUN npm run build


# ─────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────
FROM node:22.22.3-alpine3.22@sha256:cd7807368cf24826297cbad5dca1a44972ccfd770647db52a8c7589eb4599ac8 AS production

ARG SOURCE_DATE_EPOCH

# También necesitamos las librerías aquí para el runtime
RUN apk add --no-cache openssl=3.5.9-r0 gcompat=1.1.0-r4 \
    && addgroup -g 10001 -S appgroup \
    && adduser -u 10001 -S -D -H -G appgroup appuser

WORKDIR /app

ENV NODE_ENV=production

# Copiamos solo lo esencial
COPY --from=builder --chown=10001:10001 /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=builder --chown=10001:10001 /app/dist ./dist
COPY --from=builder --chown=10001:10001 /app/prisma ./prisma

# Seguridad: Usuario no root
USER appuser

EXPOSE 3001

# Aplica migraciones versionadas (sin pérdida de datos) y luego arranca el servidor
CMD ["sh", "-c", "./node_modules/.bin/prisma db execute --file ./prisma/setup.sql && ./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/prisma db execute --file ./prisma/add_embedding.sql && node dist/index.js"]
