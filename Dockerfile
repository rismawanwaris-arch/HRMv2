# =============================================
# Stage 1: Build Frontend
# =============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files and install
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./
RUN npm run build

# =============================================
# Stage 2: Production Server
# =============================================
FROM node:20-alpine

WORKDIR /app

# Copy backend package files and install production deps only
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create volume mount point for persistent database
RUN mkdir -p /app/data

EXPOSE 5000

# Start the application
CMD ["node", "backend/server.js"]
