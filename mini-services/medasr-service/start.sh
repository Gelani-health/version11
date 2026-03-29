#!/bin/bash
cd /home/z/my-project/mini-services/medasr-service
source venv/bin/activate 2>/dev/null || true
export PORT=3033
export HF_API_KEY=YOUR_HUGGINGFACE_TOKEN_HERE
nohup python index.py > /home/z/logs/medasr.log 2>&1 &
echo $! > /home/z/pids/medasr.pid
echo "MedASR started on port 3033"
