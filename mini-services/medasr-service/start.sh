#!/bin/bash
# MedASR Service Start Script
# Uses virtual environment for VAD support (webrtcvad)

cd /home/z/my-project/mini-services/medasr-service

# Activate virtual environment if available
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "Using virtual environment with VAD support"
else
    echo "Warning: venv not found, VAD may not be available"
fi

export PORT=3033
export HF_API_KEY=${HF_API_KEY:-""}

# Create log directory if needed
mkdir -p /home/z/logs /home/z/pids

# Start the service
nohup python index.py > /home/z/logs/medasr.log 2>&1 &
echo $! > /home/z/pids/medasr.pid
echo "MedASR v3.0 started on port 3033"
