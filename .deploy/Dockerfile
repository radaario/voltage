FROM node:20.19.5

ARG APP_PORT=10011
ARG VOLTAGE_API_PORT=4000
ARG VOLTAGE_FRONTEND_PORT=8080

ENV APP_PORT ${APP_PORT}
ENV VOLTAGE_API_PORT ${VOLTAGE_API_PORT}
ENV VOLTAGE_FRONTEND_PORT ${VOLTAGE_FRONTEND_PORT}

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
WORKDIR /voltage

# Copy source code
COPY ./ ./

# Download whisper models
RUN npx nodejs-whisper download

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate
# RUN npm install -g pnpm@9.1.0

# Install dependencies
# RUN pnpm approve-builds
RUN rm pnpm-lock.yaml
RUN pnpm install

# Build all services
RUN npm run build

# Setup nginx configuration
COPY ./.deploy/nginx.conf /etc/nginx/nginx.conf
RUN sed -i "s|\${APP_PORT}|${APP_PORT}|g" /etc/nginx/nginx.conf && \
    sed -i "s|\${VOLTAGE_API_PORT}|${VOLTAGE_API_PORT}|g" /etc/nginx/nginx.conf && \
    sed -i "s|\${VOLTAGE_FRONTEND_PORT}|${VOLTAGE_FRONTEND_PORT}|g" /etc/nginx/nginx.conf

# Create supervisor configuration
COPY ./.deploy/supervisord.conf /etc/supervisord.conf

# Expose the main port
EXPOSE ${APP_PORT}

# Start supervisor
CMD ["supervisord", "--nodaemon"]

RUN rm -rf /tmp/* && rm -rf /var/lib/apt/lists/*