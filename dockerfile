# ═══════════════════════════════════════════════════════════════════════════════
# Stage 1 — Build the React / Vite frontend
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files first so npm install is cached unless deps change
COPY ./Frontend/package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY ./Frontend .
RUN npm run build
# Output: /app/dist


# ═══════════════════════════════════════════════════════════════════════════════
# Stage 2 — Production Node.js server
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine

# dumb-init: proper PID-1 signal handling so SIGTERM reaches Node
RUN apk add --no-cache dumb-init

WORKDIR /app

# Install production deps only
COPY ./Backend/package*.json ./
RUN npm ci --omit=dev --prefer-offline

# Copy backend source
COPY ./Backend .

# Copy the built React app into /app/public
# Express serves this as static files — same origin as the socket server.
COPY --from=frontend-builder /app/dist ./public

# PORT env var lets ECS / Kubernetes override the port without rebuilding.
ENV PORT=3000
EXPOSE 3000

# dumb-init forwards signals correctly; node receives SIGTERM for graceful shutdown
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
