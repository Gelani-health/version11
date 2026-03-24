# MedASR Service Dockerfile
# FastAPI service for medical speech recognition

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 medasr && chown -R medasr:medasr /app
USER medasr

# Expose port
EXPOSE 3033

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3033/health || exit 1

# Start the service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3033"]
