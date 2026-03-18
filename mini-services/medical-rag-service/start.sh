#!/bin/bash
cd /home/z/my-project/mini-services/medical-rag-service
source venv/bin/activate 2>/dev/null || true
export PORT=3031
nohup python index.py > /home/z/logs/medical-rag.log 2>&1 &
echo $! > /home/z/pids/medical-rag.pid
echo "Medical RAG started on port 3031"
