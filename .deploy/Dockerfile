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

# Copy package files
COPY package*.json ./
COPY api/package*.json ./api/
COPY frontend/package*.json ./frontend/
COPY runtime/package*.json ./runtime/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Download whisper models
RUN npx nodejs-whisper download

# Build all services
RUN npm run build:runtime
RUN npm run build:api
RUN npm run build:frontend

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