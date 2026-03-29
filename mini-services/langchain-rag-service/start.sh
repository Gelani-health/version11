#!/bin/bash
cd /home/z/my-project/mini-services/langchain-rag-service
source venv/bin/activate 2>/dev/null || true
export PORT=3032
nohup python index.py > /home/z/logs/langchain-rag.log 2>&1 &
echo $! > /home/z/pids/langchain-rag.pid
echo "LangChain RAG started on port 3032"
