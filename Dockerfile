# 1. Base Image
# Use Debian (glibc) instead of Alpine (musl) to avoid Prisma engine incompatibilities.
# Use Bookworm to get Python 3.11+ (required for dataclass(slots=True) used by scanners).
FROM node:18-bookworm-slim

# Set working directory
WORKDIR /usr/src/app

# Install OS deps:
# - Puppeteer/Chromium runtime libraries
# - OpenSSL 1.1 compatibility for Prisma on some platforms
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        openssl \
        libssl3 \
        python3 \
        python3-venv \
        python3-pip \
        python-is-python3 \
        chromium \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
    && rm -rf /var/lib/apt/lists/*

# Use system Chromium (we run npm ci with --ignore-scripts, so Puppeteer won't auto-download Chrome)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy package files
COPY package*.json ./

# Install dependencies (includes dev deps so we can compile TypeScript during image build)
# Use BuildKit cache to avoid re-downloading packages every build.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --ignore-scripts

# Copy Prisma schema and generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy Python scanners + AI 30 Days tools into the backend image so the worker can run them.
COPY scanners ./scanners/
COPY ["AI 30 Days", "./AI 30 Days/"]

# Install Python deps required by the AI30 scanner wrappers (cache wheels between builds).
RUN python -m venv /opt/scanner-venv
ENV PATH="/opt/scanner-venv/bin:${PATH}"
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r ./scanners/requirements-ai30.txt

# Copy TypeScript source and build backend
COPY tsconfig.backend.json tsconfig.backend.json
COPY tsconfig.json tsconfig.json
COPY src ./src
RUN npm run build:backend

# Prune dev dependencies for a smaller production image
RUN npm prune --omit=dev

# Expose port
EXPOSE 3001

# Start command
CMD [ "node", "dist/server.js" ]
