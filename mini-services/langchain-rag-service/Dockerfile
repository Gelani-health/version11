# LangChain RAG Service Dockerfile
# FastAPI service for document management RAG

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 langchainrag && chown -R langchainrag:langchainrag /app
USER langchainrag

# Expose port
EXPOSE 3032

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3032/health || exit 1

# Start the service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3032"]
