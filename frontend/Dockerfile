# Stage 1: Build React 19 / Vite App with Node 22
FROM node:22-alpine AS builder

WORKDIR /app

# Install npm packages
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build production assets
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Default BACKEND_URL fallback for Docker Compose / Render
ENV BACKEND_URL=http://backend:5000

# Copy template for automatic envsubst by Nginx docker-entrypoint
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Fallback default configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
