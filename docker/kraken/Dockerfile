# Kraken OCR Specialized Service for Handwriting Recognition
FROM python:3.9-slim

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libgtk-3-0 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libfontconfig1 \
    libxcb1 \
    libx11-6 \
    wget \
    curl \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt /app/

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download and install some common Kraken models at build time
RUN python -c "\
import kraken; \
from kraken.lib import models; \
try: \
    models.load_any('10.5281/zenodo.2577813'); \
    print('Successfully downloaded default handwriting model'); \
except Exception as e: \
    print(f'Could not download model: {e}'); \
    pass; \
" || echo "Model download failed, will download at runtime"

# Copy the service code
COPY kraken_service.py /app/

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run the service
CMD ["uvicorn", "kraken_service:app", "--host", "0.0.0.0", "--port", "8001"]
