#!/bin/bash
# Gelani Healthcare Platform - Stop All Services
# ===============================================

echo "🛑 Stopping all Gelani services..."

# Stop mini-services
pkill -f "python.*stub" 2>/dev/null
pkill -f "python.*_full" 2>/dev/null
pkill -f "uvicorn" 2>/dev/null

# Stop main app
pkill -f "next" 2>/dev/null
pkill -f "bun.*dev" 2>/dev/null

sleep 2

# Verify all stopped
if lsof -i :3000 -i :3031 -i :3032 -i :3033 2>/dev/null; then
    echo "⚠️  Some services may still be running"
    echo "   Check with: lsof -i :3000 -i :3031 -i :3032 -i :3033"
else
    echo "✅ All services stopped successfully"
fi
