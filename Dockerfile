# ─────────────────────────────────────────────
# Stage 1: Builder
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache \
    openssl \
    openssl-dev \
    libc6-compat \
    python3 \
    make \
    g++ \
    build-base
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Generar el cliente de Prisma
RUN npx prisma generate

COPY . .

# Build TypeScript → JavaScript
RUN npm run build


# ─────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

# También necesitamos las librerías aquí para el runtime
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production

# Copiamos solo lo esencial
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Seguridad: Usuario no root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Ajustamos permisos para que appuser pueda ejecutar npx prisma db push
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]