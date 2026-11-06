# =========================================================================
# Stage 1: Build React Application
# =========================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies with clean cache
COPY package.json package-lock.json ./
RUN npm ci

# Copy project source
COPY . .

# Set production environment variables
ENV NODE_ENV=production
ENV VITE_BASE_PATH=/neuro-series/

# Build optimized production bundle
RUN npm run build

# =========================================================================
# Stage 2: Production Nginx Server
# =========================================================================
FROM nginx:1.27-alpine AS runner

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy security-hardened Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts to both /neuro-series/ subpath and root
COPY --from=builder /app/dist /usr/share/nginx/html/neuro-series
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Health check
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/neuro-series/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
