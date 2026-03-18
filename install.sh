#!/bin/bash

# Gelani AI Healthcare Assistant - Ubuntu Server Setup Script
# Run this script on your Ubuntu server after extracting the archive

set -e

echo "=========================================="
echo "  Gelani AI Healthcare Assistant - Setup Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo -e "${RED}Please do not run as root${NC}"
  exit 1
fi

echo "Step 1: Checking system requirements..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check for Bun
if ! command -v bun &> /dev/null; then
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    source ~/.bashrc
    export PATH="$HOME/.bun/bin:$PATH"
fi
echo -e "${GREEN}✓ Bun $(bun --version)${NC}"

# Install build tools if needed
if ! command -v gcc &> /dev/null; then
    echo "Installing build tools..."
    sudo apt install -y build-essential python3
fi
echo -e "${GREEN}✓ Build tools installed${NC}"

echo ""
echo "Step 2: Installing dependencies..."
bun install
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
echo "Step 3: Setting up database..."
bun run db:push
echo -e "${GREEN}✓ Database initialized${NC}"

echo ""
echo "Step 4: Creating environment file..."
if [ ! -f .env.local ]; then
    cat > .env.local << 'EOF'
# Database
DATABASE_URL="file:./db/healthcare.db"

# Bahmni Configuration
BAHMNI_URL="https://demo.bahmni.org"
BAHMNI_FHIR_ENDPOINT="/openmrs/ws/fhir2/R4"

# AI Configuration
AI_MODEL="medgemma"
AI_TEMPERATURE="0.7"

# Feature Flags
ENABLE_CLINICAL_DECISION_SUPPORT="true"
ENABLE_DRUG_INTERACTION_CHECK="true"
ENABLE_IMAGE_ANALYSIS="true"
ENABLE_VOICE_TRANSCRIPTION="true"

# Safety Settings
REQUIRE_HUMAN_REVIEW="true"
SAFETY_ALERT_THRESHOLD="0.8"
EOF
    echo -e "${GREEN}✓ .env.local created${NC}"
else
    echo -e "${GREEN}✓ .env.local already exists${NC}"
fi

echo ""
echo "Step 5: Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 3000/tcp
    echo -e "${GREEN}✓ Port 3000 allowed${NC}"
else
    echo "UFW not installed, skipping firewall configuration"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}  Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "To start the application:"
echo "  Development: bun run dev"
echo "  Production:  bun run build && bun run start"
echo ""
echo "Access at: http://YOUR_SERVER_IP:3000"
echo ""
