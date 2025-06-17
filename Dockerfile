# Use the official Node.js image as base for the frontend
FROM node:20-alpine AS frontend

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml* package-lock.json* ./

# Use package manager based on lock file availability
RUN if [ -f "pnpm-lock.yaml" ]; then \
        npm install -g pnpm && \
        pnpm install --frozen-lockfile; \
    elif [ -f "package-lock.json" ]; then \
        npm ci; \
    else \
        npm install; \
    fi

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN NODE_ENV=production npm run build

# Use Ubuntu as the base image for OCR
FROM ubuntu:22.04 AS ocr

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# Install Tesseract and its dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-fra \
    tesseract-ocr-deu \
    tesseract-ocr-spa \
    tesseract-ocr-ita \
    tesseract-ocr-rus \
    tesseract-ocr-chi-sim \
    tesseract-ocr-jpn \
    # Build dependencies
    build-essential \
    wget \
    curl \
    ca-certificates \
    unpaper \
    pngquant \
    qpdf \
    liblept5 \
    libffi-dev \
    libsm6 \
    libxext6 \
    libxrender-dev \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Final image combining frontend and OCR
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    NODE_ENV=production \
    PORT=3000 \
    MAX_UPLOAD_SIZE=100 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--max-old-space-size=4096"

# Label the image with metadata
LABEL maintainer="Your Name <your.email@example.com>" \
      description="OCR Application with Tesseract.js and TensorFlow.js" \
      version="1.0.0" \
      org.opencontainers.image.title="OCR Application" \
      org.opencontainers.image.description="Pure TypeScript OCR processing application" \
      org.opencontainers.image.url="https://github.com/yourusername/ocr-app" \
      org.opencontainers.image.vendor="Your Organization"

# Install all dependencies in one step to reduce layers
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Base utilities
    ca-certificates \
    curl \
    gnupg \
    # Tesseract OCR and dependencies
    tesseract-ocr \
    tesseract-ocr-eng \
    ghostscript \
    unpaper \
    pngquant \
    qpdf \
    libleptonica-dev \
    # System utilities
    procps \
    # For file operations
    file \
    # Setup Node.js repository (for various architectures)
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    # Create node user and group
    && groupadd --gid 1000 node \
    && useradd --uid 1000 --gid node --shell /bin/bash --create-home node \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    # Verify installed versions
    && echo "Checking installed versions:" \
    && tesseract --version \
    && gs --version \
    && node --version \
    && npm --version

# Copy the built Next.js application
WORKDIR /app
COPY --from=frontend /app/.next ./.next
COPY --from=frontend /app/public ./public
COPY --from=frontend /app/node_modules ./node_modules
COPY --from=frontend /app/package.json ./package.json
COPY --from=frontend /app/next.config.mjs ./next.config.mjs
COPY ./healthcheck.sh /app/healthcheck.sh

# Copy the entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create directories for file uploads and processed files with proper permissions
RUN mkdir -p /app/uploads /app/processed /app/output /app/tmp /app/models \
    && chmod -R 777 /app/uploads /app/processed /app/output /app/tmp /app/models \
    && chmod +x /app/healthcheck.sh \
    # Verify the node user exists before chowning
    && id -u node && id -g node \
    && chown -R node:node /app/uploads /app/processed /app/output /app/tmp /app/models /app/healthcheck.sh /app/entrypoint.sh \
    || echo "Warning: Could not change ownership to node:node, using current user instead"

# Create a healthcheck script
USER root
RUN echo '#!/bin/bash\n\
if ! command -v tesseract &> /dev/null; then\n\
    echo "Tesseract not found"\n\
    exit 1\n\
fi\n\
if [ ! -d "/app/uploads" ] || [ ! -w "/app/uploads" ]; then\n\
    echo "Upload directory not writable"\n\
    exit 1\n\
fi\n\
if [ ! -d "/app/processed" ] || [ ! -w "/app/processed" ]; then\n\
    echo "Processed directory not writable"\n\
    exit 1\n\
fi\n\
if [ ! -d "/app/output" ] || [ ! -w "/app/output" ]; then\n\
    echo "Output directory not writable"\n\
    exit 1\n\
fi\n\
# Check if Next.js app is running\n\
if ! curl -s --head http://localhost:${PORT} | grep "200 OK" > /dev/null; then\n\
    echo "Next.js app is not running correctly"\n\
    exit 1\n\
fi\n\
exit 0' > /app/healthcheck.sh \
    && chmod +x /app/healthcheck.sh \
    && chown node:node /app/healthcheck.sh

# Switch to non-root user
USER node

# Expose the port (configurable via PORT env var)
EXPOSE ${PORT}

# Add healthcheck using our custom script
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /app/healthcheck.sh

# Set the entrypoint to our script
ENTRYPOINT ["/app/entrypoint.sh"]

# Start the application
CMD ["npm", "start"]
