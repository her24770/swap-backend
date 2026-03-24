# ─────────────────────────────────────────────
# Stage 1: Builder
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src
#COPY prisma ./prisma

# Generate Prisma client
#RUN npx prisma generate

# Build TypeScript → JavaScript
RUN npm run build


# ─────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output and Prisma artifacts
COPY --from=builder /app/dist ./dist
#COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
#COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
#COPY prisma ./prisma

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

# Run migrations then start the server
CMD ["node", "dist/index.js"]
#CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]