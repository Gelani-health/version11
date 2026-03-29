#!/bin/bash
# LangChain RAG Service - Full Implementation Startup
# Port: 3032

cd /home/z/my-project/mini-services/langchain-rag-service

# Create virtual environment if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q --upgrade pip
pip install -q fastapi uvicorn pydantic loguru python-dotenv httpx numpy

# Try to install sentence-transformers
pip install -q sentence-transformers 2>/dev/null || echo "Note: sentence-transformers installation may require additional steps"

# Set environment
export PORT=3032
export MEDICAL_RAG_URL="${MEDICAL_RAG_URL:-http://localhost:3031}"
export ZAI_API_KEY="${ZAI_API_KEY:-}"
export LOG_LEVEL=INFO

# Create log directory
mkdir -p /home/z/logs

echo "Starting LangChain RAG Service v2.0 on port 3032..."
echo "Mode: READ_WRITE"
echo "Medical RAG URL: $MEDICAL_RAG_URL"

# Start the service
nohup python index_full.py > /home/z/logs/langchain-rag.log 2>&1 &
echo $! > /home/z/pids/langchain-rag.pid

echo "LangChain RAG Service started. PID: $(cat /home/z/pids/langchain-rag.pid)"
echo "Logs: /home/z/logs/langchain-rag.log"
