FROM node:20.19.5

ARG APP_DIR=/var/voltage

ARG APP_PORT=8080
ARG APP_BASE_URL=http://localhost:${APP_PORT}
ARG APP_BASE_PATH=/
ARG VOLTAGE_API_NODE_PORT=4000

ENV APP_PORT ${APP_PORT}
ENV APP_BASE_URL ${APP_BASE_URL}
ENV APP_BASE_PATH ${APP_BASE_PATH}
ENV VOLTAGE_API_NODE_PORT ${VOLTAGE_API_NODE_PORT}

ENV VITE_APP_BASE=${APP_BASE_PATH}
ENV VITE_API_URL ${APP_BASE_URL}/api
ENV VITE_API_NODE_PORT ${VOLTAGE_API_NODE_PORT}

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
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip && \
    /opt/venv/bin/pip install whisper-cli

# Set working directory
WORKDIR ${APP_DIR}

# Copy source code
COPY ./ ./

# Download whisper models
# RUN npx nodejs-whisper download

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
# RUN npm install -g pnpm@9.1.0

# Install dependencies
# RUN pnpm approve-builds
RUN rm pnpm-lock.yaml
RUN pnpm install

# Build all services
COPY ./.deploy/index.html ${APP_DIR}/apps/frontend/dist/index.html

RUN npm run build:packages
RUN if [ "$VOLTAGE_RUNTIME_IS_DISABLED" != "false" ]; then npm run build:runtime; else echo "Runtime build skipped"; fi
RUN if [ "$VOLTAGE_API_IS_DISABLED" != "false" ]; then npm run build:api; else echo "API build skipped"; fi
RUN if [ "$VOLTAGE_FRONTEND_IS_DISABLED" != "false" ]; then npm run build:frontend; else echo "Frontend build skipped"; fi

# Setup nginx configuration
COPY ./.deploy/nginx.conf /etc/nginx/nginx.conf
RUN sed -i "s|\${APP_DIR}|${APP_DIR}|g" /etc/nginx/nginx.conf && \
    sed -i "s|\${APP_PORT}|${APP_PORT}|g" /etc/nginx/nginx.conf && \
    sed -i "s|\${VOLTAGE_API_NODE_PORT}|${VOLTAGE_API_NODE_PORT}|g" /etc/nginx/nginx.conf

# Create supervisor configuration
COPY ./.deploy/supervisord.conf /etc/supervisord.conf
RUN sed -i "s|\${APP_DIR}|${APP_DIR}|g" /etc/supervisord.conf

# Expose the main port
EXPOSE ${APP_PORT}

# Start supervisor
CMD ["supervisord", "--nodaemon"]

RUN rm -rf /tmp/* && rm -rf /var/lib/apt/lists/*