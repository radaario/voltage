FROM node:20.19.5

ARG VOLTAGE_DIR=/var/voltage

ARG VOLTAGE_ENV=local
ARG VOLTAGE_NGINX_PORT=8080
ARG VOLTAGE_PROTOCOL=http
ARG VOLTAGE_HOST=localhost
ARG VOLTAGE_PORT=8080
ARG VOLTAGE_PATH=

ARG VOLTAGE_API_NODE_PORT=4000
ARG VOLTAGE_FRONTEND_DATA_REFETCH_INTERVAL=10000
ARG VOLTAGE_FRONTEND_DATETIME_FORMAT="YYYY-MM-DD HH:mm:ss"
ARG VOLTAGE_FRONTEND_LOCAL_STORAGE_PREFIX="voltage"

ENV VOLTAGE_ENV=${VOLTAGE_ENV}
ENV VOLTAGE_NGINX_PORT ${VOLTAGE_NGINX_PORT}
ENV VOLTAGE_PROTOCOL ${VOLTAGE_PROTOCOL}
ENV VOLTAGE_HOST ${VOLTAGE_HOST}
ENV VOLTAGE_PORT ${VOLTAGE_PORT}
ENV VOLTAGE_PATH ${VOLTAGE_PATH}

ENV VOLTAGE_API_NODE_PORT ${VOLTAGE_API_NODE_PORT}

ENV VITE_PATH=${VOLTAGE_PATH}
ENV VITE_API_URL ${VOLTAGE_PROTOCOL}://${VOLTAGE_HOST}:${VOLTAGE_PORT}${VOLTAGE_PATH}/api
ENV VITE_API_NODE_PORT ${VOLTAGE_API_NODE_PORT}
ENV VITE_DATA_REFETCH_INTERVAL ${VOLTAGE_FRONTEND_DATA_REFETCH_INTERVAL}
ENV VITE_DATETIME_FORMAT ${VOLTAGE_FRONTEND_DATETIME_FORMAT}
ENV VITE_LOCAL_STORAGE_PREFIX ${VOLTAGE_FRONTEND_LOCAL_STORAGE_PREFIX}

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    ffmpeg \
    python3 \
    python3-venv \
    python3-pip \
    nginx \
    supervisor \
    gettext-base

# Setup Python virtual environment and install whisper-cli
# RUN python3 -m venv /opt/venv && \
#    /opt/venv/bin/pip install --upgrade pip && \
#    /opt/venv/bin/pip install whisper-cli

# Set working directory
WORKDIR ${VOLTAGE_DIR}

# Copy source code
COPY ./ ./

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
# RUN npm install -g pnpm@9.1.0

# Install dependencies
# RUN pnpm approve-builds
RUN rm pnpm-lock.yaml
RUN pnpm install

# Download whisper models
RUN cd ${VOLTAGE_DIR}/apps/runtime
RUN npx nodejs-whisper download
RUN cd ${VOLTAGE_DIR}

# Build all services
RUN npm run build:packages
RUN if [ "$VOLTAGE_RUNTIME_IS_DISABLED" != "false" ]; then npm run build:runtime; else echo "Runtime build skipped"; fi
RUN if [ "$VOLTAGE_API_IS_DISABLED" != "false" ]; then npm run build:api; else echo "API build skipped"; fi
RUN if [ "$VOLTAGE_FRONTEND_IS_DISABLED" != "false" ]; then npm run build:frontend; else echo "Frontend build skipped"; fi

# Setup nginx configuration
COPY ./.deploy/nginx.conf /etc/nginx/nginx.conf
RUN sed -i "s|\${VOLTAGE_DIR}|${VOLTAGE_DIR}|g" /etc/nginx/nginx.conf && \
    sed -i "s|\${VOLTAGE_NGINX_PORT}|${VOLTAGE_NGINX_PORT}|g" /etc/nginx/nginx.conf && \
    sed -i "s|\${VOLTAGE_API_NODE_PORT}|${VOLTAGE_API_NODE_PORT}|g" /etc/nginx/nginx.conf

# Create supervisor configuration
COPY ./.deploy/supervisord.conf /etc/supervisord.conf
RUN sed -i "s|\${VOLTAGE_DIR}|${VOLTAGE_DIR}|g" /etc/supervisord.conf

# Expose the main port
EXPOSE ${VOLTAGE_NGINX_PORT}

# Start supervisor
CMD ["supervisord", "--nodaemon"]

RUN rm -rf /tmp/* && rm -rf /var/lib/apt/lists/*