# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-slim AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
# Official Playwright image — includes Chromium + all required system deps
FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Install root (server + pipeline) dependencies
COPY package*.json ./
RUN npm install

# Copy compiled frontend from Stage 1
COPY --from=client-builder /app/client/dist ./client/dist

# Copy application source
COPY src/     ./src/
COPY server/  ./server/
COPY tsconfig.json ./

# Create data and output directories (will be overridden by volumes)
RUN mkdir -p data output

# Ensure Playwright browsers are available (already in base image, this is a no-op safeguard)
RUN npx playwright install chromium --with-deps 2>/dev/null || true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

CMD ["npx", "ts-node", "--project", "tsconfig.json", "server/index.ts"]
