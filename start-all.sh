#!/bin/bash
# Gelani Healthcare Platform - All Services Startup Script
# =============================================================
# This script starts all services needed for Gelani:
# - Main Next.js application (port 3000)
# - Medical RAG Service (port 3031)
# - LangChain RAG Service (port 3032)
# - MedASR Service (port 3033)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINI_SERVICES_DIR="$SCRIPT_DIR/mini-services"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Gelani Healthcare Platform - Starting All Services     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Parse arguments
STUB_MODE=false
DETACH=false

for arg in "$@"; do
    case $arg in
        --stub)
            STUB_MODE=true
            shift
            ;;
        --detach)
            DETACH=true
            shift
            ;;
    esac
done

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    echo -ne "  Waiting for $name..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}✗${NC}"
    return 1
}

# Create log directory
mkdir -p /tmp/gelani-logs

# ============================================
# Start Mini-Services
# ============================================
echo -e "\n${YELLOW}📦 Starting Mini-Services...${NC}"

cd "$MINI_SERVICES_DIR"

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo -e "  ${RED}Error: Virtual environment not found. Run: python -m venv venv && pip install -r medical-rag-service/requirements.txt${NC}"
    exit 1
fi

# Determine which scripts to use
if [ "$STUB_MODE" = true ]; then
    echo -e "  ${YELLOW}Using stub (lightweight) mode${NC}"
    MEDICAL_RAG_SCRIPT="stub_medical_rag.py"
    LANGCHAIN_RAG_SCRIPT="stub_langchain_rag.py"
    MEDASR_SCRIPT="stub_medasr.py"
else
    echo -e "  ${YELLOW}Using full ML mode${NC}"
    MEDICAL_RAG_SCRIPT="medical_rag_full.py"
    LANGCHAIN_RAG_SCRIPT="langchain_rag_full.py"
    MEDASR_SCRIPT="medasr_full.py"
fi

# Kill existing services
pkill -f "python.*stub" 2>/dev/null || true
pkill -f "python.*_full" 2>/dev/null || true
sleep 2

# Start Medical RAG Service (Port 3031)
echo -ne "  Starting Medical RAG Service (3031)..."
PORT=3031 nohup python $MEDICAL_RAG_SCRIPT > /tmp/gelani-logs/medical_rag.log 2>&1 &
echo -e " ${GREEN}✓${NC}"

# Start LangChain RAG Service (Port 3032)
echo -ne "  Starting LangChain RAG Service (3032)..."
PORT=3032 nohup python $LANGCHAIN_RAG_SCRIPT > /tmp/gelani-logs/langchain_rag.log 2>&1 &
echo -e " ${GREEN}✓${NC}"

# Start MedASR Service (Port 3033)
echo -ne "  Starting MedASR Service (3033)..."
PORT=3033 nohup python $MEDASR_SCRIPT > /tmp/gelani-logs/medasr.log 2>&1 &
echo -e " ${GREEN}✓${NC}"

# Wait for mini-services to be ready
echo -e "\n${YELLOW}⏳ Waiting for mini-services to be ready...${NC}"
sleep 3

wait_for_service 3031 "Medical RAG"
wait_for_service 3032 "LangChain RAG"
wait_for_service 3033 "MedASR"

# ============================================
# Start Main Application
# ============================================
echo -e "\n${YELLOW}🚀 Starting Main Application...${NC}"

cd "$SCRIPT_DIR"

# Kill existing Next.js process
pkill -f "next" 2>/dev/null || true
sleep 2

# Start Next.js development server
echo -ne "  Starting Next.js (3000)..."
if [ "$DETACH" = true ]; then
    nohup bun run dev > /tmp/gelani-logs/main_app.log 2>&1 &
else
    bun run dev > /tmp/gelani-logs/main_app.log 2>&1 &
fi
echo -e " ${GREEN}✓${NC}"

# Wait for main app
sleep 5

# ============================================
# Final Status
# ============================================
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    SERVICE STATUS                           ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════╣${NC}"

# Check each service
for port in 3031 3032 3033 3000; do
    if check_port $port; then
        case $port in
            3031) name="Medical RAG" ;;
            3032) name="LangChain RAG" ;;
            3033) name="MedASR" ;;
            3000) name="Main App" ;;
        esac
        echo -e "${BLUE}║${NC} ${GREEN}✓${NC} $name ${YELLOW}port $port${NC}                              ${BLUE}║${NC}"
    fi
done

echo -e "${BLUE}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}                                                            ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}Main Application:${NC}  http://localhost:3000              ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}Medical RAG API:${NC}   http://localhost:3031/docs          ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}LangChain RAG API:${NC} http://localhost:3032/docs          ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}MedASR API:${NC}        http://localhost:3033/docs          ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}                                                            ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  ${YELLOW}Logs:${NC} /tmp/gelani-logs/                               ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}                                                            ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${GREEN}✨ All services started successfully!${NC}"
echo ""

if [ "$DETACH" = true ]; then
    echo -e "${YELLOW}Services running in background.${NC}"
    echo -e "To stop: ${BLUE}pkill -f 'python.*stub|next'${NC}"
    echo -e "View logs: ${BLUE}tail -f /tmp/gelani-logs/*.log${NC}"
fi
