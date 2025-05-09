# Use the official Node.js image as base for the frontend
FROM node:20-alpine AS frontend

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Use Ubuntu as the base image for OCRmyPDF
FROM ubuntu:22.04 AS ocr

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install OCRmyPDF and its dependencies
RUN apt-get update && apt-get install -y \
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
    unpaper \
    pngquant \
    qpdf \
    liblept5 \
    libffi-dev \
    libsm6 \
    libxext6 \
    libxrender-dev \
    # Install jbig2enc from source (version 0.29)
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    # Install jbig2enc from source with specific version
    && cd /tmp \
    && wget https://github.com/agl/jbig2enc/archive/refs/tags/0.29.tar.gz \
    && tar -xzf 0.29.tar.gz \
    && cd jbig2enc-0.29 \
    && apt-get update \
    && apt-get install -y automake libtool libleptonica-dev \
    && ./autogen.sh \
    && ./configure \
    && make \
    && make install \
    && ldconfig \
    && echo "Verifying jbig2enc installation:" \
    && ls -la /usr/local/bin/jbig2* \
    && echo "Creating jbig2 symlink" \
    && ln -sf /usr/local/bin/jbig2 /usr/bin/jbig2 \
    && echo "Testing jbig2 command:" \
    && (jbig2 --version || echo "jbig2 command not working in OCR stage, but continuing anyway") \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Ghostscript
RUN apt-get update && apt-get install -y \
    ghostscript \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && gs --version

# Create a virtual environment and install OCRmyPDF with specific version
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip==25.1.1 && \
    pip install --no-cache-dir ocrmypdf==15.4.3

# Final image combining frontend and OCR
FROM ubuntu:22.04

# Copy OCR environment from the OCR stage
COPY --from=ocr /opt/venv /opt/venv
# Install all OCR dependencies in one step to reduce layers
RUN apt-get update && apt-get install -y \
    # Tesseract OCR and language packs
    tesseract-ocr \
    tesseract-ocr-eng \
    ghostscript \
    unpaper \
    pngquant \
    qpdf \
    libleptonica-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && echo "Checking installed versions:" \
    && tesseract --version \
    && gs --version

# Copy jbig2enc binary from OCR stage
COPY --from=ocr /usr/local/bin/jbig2 /usr/bin/
RUN echo "Verifying jbig2 installation:" && \
    ls -la /usr/bin/jbig2* || true && \
    echo "Testing jbig2 command:" && \
    (jbig2 --version || echo "jbig2 command not working, but continuing anyway")

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    # Create node user and group
    && groupadd --gid 1000 node \
    && useradd --uid 1000 --gid node --shell /bin/bash --create-home node \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && node --version \
    && npm --version

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH"
ENV NODE_ENV=production

# Copy the built Next.js application
WORKDIR /app
COPY --from=frontend /app/.next ./.next
COPY --from=frontend /app/public ./public
COPY --from=frontend /app/node_modules ./node_modules
COPY --from=frontend /app/package.json ./package.json

# Create directories for file uploads and processed files with proper permissions
RUN mkdir -p /app/uploads /app/processed && \
    chmod -R 777 /app/uploads /app/processed && \
    # Verify the node user exists before chowning
    id -u node && id -g node && \
    chown -R node:node /app/uploads /app/processed || \
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
exit 0' > /app/healthcheck.sh \
    && chmod +x /app/healthcheck.sh \
    && chown node:node /app/healthcheck.sh

# Create a non-root user to run the application
# We created the node user earlier, so we can use it directly
USER node

# Expose the port
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /app/healthcheck.sh

# Start the application
CMD ["npm", "start"]
