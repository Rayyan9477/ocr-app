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
    python3-pip=20.0.2-5ubuntu1.11 \
    python3-venv=3.8.2-0ubuntu2 \
    tesseract-ocr=4.1.1-2build2 \
    tesseract-ocr-eng=1:4.00~git30-7274cfa-1 \
    tesseract-ocr-fra=1:4.00~git30-7274cfa-1 \
    tesseract-ocr-deu=1:4.00~git30-7274cfa-1 \
    tesseract-ocr-spa=1:4.00~git30-7274cfa-1 \
    tesseract-ocr-ita=1:4.00~git30-7274cfa-1 \
    tesseract-ocr-rus=1:4.00~git30-7274cfa-1 \
    tesseract-ocr-chi-sim=1:4.00~git30-7274cfa-1 \
    tesseract-ocr-jpn=1:4.00~git30-7274cfa-1 \
    # Build the latest Ghostscript from source instead of using the package
    build-essential \
    wget \
    unpaper=6.1-2build1 \
    pngquant=2.12.6-1 \
    qpdf=10.1.0-1 \
    liblept5=1.79.0-1 \
    libffi-dev=3.3-4 \
    libsm6=2:1.2.3-1 \
    libxext6=2:1.3.4-0ubuntu1 \
    libxrender-dev=1:0.9.10-1 \
    jbig2enc=0.29-1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Download, compile and install the latest Ghostscript version
RUN cd /tmp && \
    wget https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10020/ghostscript-10.02.0.tar.gz && \
    tar -xzf ghostscript-10.02.0.tar.gz && \
    cd ghostscript-10.02.0 && \
    ./configure && \
    make && \
    make install && \
    cd .. && \
    rm -rf ghostscript-10.02.0*

# Create a virtual environment and install OCRmyPDF
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip==25.1.1 && \
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
COPY --from=ocr /usr/bin/jbig2enc /usr/bin/
RUN ln -sf /usr/bin/jbig2enc /usr/bin/jbig2

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl=7.81.0-1ubuntu1.15 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs=20.11.1-1nodesource1 \
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
