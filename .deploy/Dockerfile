FROM node:20.19.5

# Set default environment variables
ENV APP_PORT=80
ENV VOLTAGE_API_PORT=4000
ENV VOLTAGE_FRONTEND_PORT=3000

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
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

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

# Create supervisor configuration
COPY ./.deploy/supervisord.conf /etc/supervisord.conf

# Expose the main port
EXPOSE ${APP_PORT}

# Start supervisor
CMD ["supervisord", "--nodaemon"]