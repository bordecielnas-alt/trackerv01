# Stage 1: Build Vite frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Install backend dependencies
FROM node:20-alpine AS backend-builder

WORKDIR /server
COPY server/package*.json ./
RUN npm install --production

# Stage 3: Final image with nginx + node backend
FROM nginx:stable-alpine

# Install Node.js runtime
RUN apk add --no-cache nodejs supervisor

# Copy frontend build
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy backend
COPY server/index.js /server/index.js
COPY --from=backend-builder /server/node_modules /server/node_modules

# Create data directory
RUN mkdir -p /data && chmod 777 /data

# Supervisor config to run both nginx and node
RUN mkdir -p /etc/supervisor.d
COPY <<'EOF' /etc/supervisor.d/app.ini
[supervisord]
nodaemon=true
logfile=/dev/null
logfile_maxbytes=0

[program:nginx]
command=nginx -g "daemon off;"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:backend]
command=node /server/index.js
environment=DATA_DIR="/data",PORT="3001"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

EXPOSE 80

VOLUME /data

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
