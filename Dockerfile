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
    ghostscript \
    unpaper \
    pngquant \
    qpdf \
    liblept5 \
    libffi-dev \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment and install OCRmyPDF
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir ocrmypdf==15.4.3

# Final image combining frontend and OCR
FROM ubuntu:22.04

# Copy OCR environment from the OCR stage
COPY --from=ocr /opt/venv /opt/venv
COPY --from=ocr /usr/bin/tesseract /usr/bin/
COPY --from=ocr /usr/share/tesseract-ocr /usr/share/tesseract-ocr/
COPY --from=ocr /usr/lib/x86_64-linux-gnu/libtesseract* /usr/lib/x86_64-linux-gnu/
COPY --from=ocr /usr/bin/gs /usr/bin/
COPY --from=ocr /usr/bin/unpaper /usr/bin/
COPY --from=ocr /usr/bin/pngquant /usr/bin/
COPY --from=ocr /usr/bin/qpdf /usr/bin/

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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
    chown -R node:node /app/uploads /app/processed

# Create a non-root user to run the application
USER node

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
