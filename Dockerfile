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

# Use Ubuntu as the base image for OCRmyPDF
FROM ubuntu:22.04 AS ocr

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONUNBUFFERED=1

# Add architecture-specific installations 
ARG TARGETARCH=amd64
ENV TARGETARCH=${TARGETARCH}

# Install OCRmyPDF and its dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    python3-venv \
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
    # Install jbig2enc dependencies
    automake \
    libtool \
    libleptonica-dev \
    ghostscript \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install jbig2enc from source with improved error handling
RUN cd /tmp \
    && echo "Installing jbig2enc (architecture: ${TARGETARCH})..." \
    && wget -q https://github.com/agl/jbig2enc/archive/refs/tags/0.29.tar.gz \
    && tar -xzf 0.29.tar.gz \
    && cd jbig2enc-0.29 \
    && ./autogen.sh \
    && ./configure \
    && make -j$(nproc) \
    && make install \
    && ldconfig \
    && echo "Verifying jbig2enc installation:" \
    && ls -la /usr/local/bin/jbig2* \
    && echo "Creating jbig2 symlink" \
    && ln -sf /usr/local/bin/jbig2 /usr/bin/jbig2 \
    && echo "Testing jbig2 command:" \
    && (jbig2 --version || echo "jbig2 command not working in OCR stage, but continuing anyway") \
    && rm -rf /tmp/jbig2enc-0.29* /tmp/0.29.tar.gz

# Create a virtual environment and install OCRmyPDF with specific version
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip==25.1.1 && \
    pip install --no-cache-dir ocrmypdf==15.4.3 && \
    pip install --no-cache-dir wheel setuptools && \
    # Test OCRmyPDF installation
    ocrmypdf --version

# Final image combining frontend and OCR
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    NODE_ENV=production \
    PATH="/opt/venv/bin:$PATH" \
    PORT=3000 \
    MAX_UPLOAD_SIZE=100 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--max-old-space-size=4096"

# Label the image with metadata
LABEL maintainer="Your Name <your.email@example.com>" \
      description="OCR Application with OCRmyPDF and Next.js" \
      version="1.0.0" \
      org.opencontainers.image.title="OCR Application" \
      org.opencontainers.image.description="PDF OCR processing application" \
      org.opencontainers.image.url="https://github.com/yourusername/ocr-app" \
      org.opencontainers.image.vendor="Your Organization"

# Copy OCR environment from the OCR stage
COPY --from=ocr /opt/venv /opt/venv

# Install all OCR dependencies in one step to reduce layers
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
    && npm --version \
    && ocrmypdf --version

# Copy jbig2enc binary from OCR stage
COPY --from=ocr /usr/local/bin/jbig2 /usr/bin/
COPY --from=ocr /usr/local/lib/libjbig2enc* /usr/local/lib/
RUN echo "Verifying jbig2 installation:" && \
    ln -sf /usr/local/lib/libjbig2enc.so.* /usr/lib/ || true && \
    ldconfig && \
    ls -la /usr/bin/jbig2* || true && \
    echo "Testing jbig2 command:" && \
    (jbig2 --version || echo "jbig2 command not working, but continuing anyway")

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
RUN mkdir -p /app/uploads /app/processed && \
    chmod -R 777 /app/uploads /app/processed && \
    chmod +x /app/healthcheck.sh && \
    # Verify the node user exists before chowning
    id -u node && id -g node && \
    chown -R node:node /app/uploads /app/processed /app/healthcheck.sh /app/entrypoint.sh || \
    echo "Warning: Could not change ownership to node:node, using current user instead"

# Create a healthcheck script
USER root
RUN echo '#!/bin/bash\n\
if ! command -v ocrmypdf &> /dev/null; then\n\
    echo "OCRmyPDF not found"\n\
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
