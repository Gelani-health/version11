#!/bin/bash
# Medical RAG Service - Full Implementation Startup
# Port: 3031

cd /home/z/my-project/mini-services/medical-rag-service

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

# Try to install sentence-transformers (may take time)
pip install -q sentence-transformers 2>/dev/null || echo "Note: sentence-transformers installation may require additional steps"

# Set environment
export PORT=3031
export ZAI_API_KEY="${ZAI_API_KEY:-}"
export LOG_LEVEL=INFO

# Create log directory
mkdir -p /home/z/logs

echo "Starting Medical RAG Service v2.0 on port 3031..."
echo "Features: Z.ai LLM, Semantic Search, Medical Knowledge Base"

# Start the service
nohup python index_full.py > /home/z/logs/medical-rag.log 2>&1 &
echo $! > /home/z/pids/medical-rag.pid

echo "Medical RAG Service started. PID: $(cat /home/z/pids/medical-rag.pid)"
echo "Logs: /home/z/logs/medical-rag.log"
