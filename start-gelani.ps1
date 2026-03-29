# Gelani Healthcare - Windows Complete Setup & Start Script
# ==========================================================
# This script sets up and starts ALL services with REAL AI capabilities
# using z-ai-web-dev-sdk (no Python required)
#
# Run in PowerShell: .\start-gelani.ps1

param(
    [switch]$Setup,      # Run full setup (first time)
    [switch]$Start,      # Start all services
    [switch]$Stop,       # Stop all services
    [switch]$Status,     # Check service status
    [switch]$Logs        # View logs
)

$ErrorActionPreference = "Continue"

# Colors
function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success { param([string]$Text) Write-Host "  ✅ $Text" -ForegroundColor Green }
function Write-Info { param([string]$Text) Write-Host "  ℹ️  $Text" -ForegroundColor Yellow }
function Write-Err { param([string]$Text) Write-Host "  ❌ $Text" -ForegroundColor Red }

# Check if running in project directory
if (-not (Test-Path "package.json")) {
    Write-Err "Please run this script from the Gelani project root directory"
    exit 1
}

# Create logs directory
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
}

# Default action: Start services
if (-not ($Setup -or $Stop -or $Status -or $Logs)) {
    $Start = $true
}

# Setup mode
if ($Setup) {
    Write-Header "Gelani Healthcare - Full Setup"
    
    # 1. Stop existing services
    Write-Info "Stopping existing services..."
    pm2 stop all 2>$null
    pm2 delete all 2>$null
    Start-Sleep -Seconds 2
    
    # 2. Install dependencies
    Write-Info "Installing dependencies..."
    bun install
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to install dependencies"
        exit 1
    }
    Write-Success "Dependencies installed"
    
    # 3. Clean Prisma cache
    Write-Info "Cleaning Prisma cache..."
    Remove-Item -Recurse -Force "node_modules\.prisma" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "node_modules\@prisma\client" -ErrorAction SilentlyContinue
    
    # 4. Generate Prisma client
    Write-Info "Generating Prisma client..."
    bun run db:generate
    Write-Success "Prisma client generated"
    
    # 5. Push database schema
    Write-Info "Pushing database schema..."
    bun run db:push
    Write-Success "Database schema pushed"
    
    # 6. Seed database
    Write-Info "Seeding database..."
    bun run db:seed:all
    Write-Success "Database seeded"
    
    # 7. Verify z-ai-web-dev-sdk
    Write-Info "Verifying z-ai-web-dev-sdk..."
    if (Test-Path "node_modules\z-ai-web-dev-sdk") {
        Write-Success "z-ai-web-dev-sdk installed"
    } else {
        Write-Err "z-ai-web-dev-sdk not found - installing..."
        bun add z-ai-web-dev-sdk
    }
    
    Write-Host ""
    Write-Success "Setup complete!"
    Write-Host ""
}

# Stop mode
if ($Stop) {
    Write-Header "Stopping All Services"
    pm2 stop all 2>$null
    pm2 delete all 2>$null
    Write-Success "All services stopped"
    exit 0
}

# Status mode
if ($Status) {
    Write-Header "Service Status"
    
    Write-Host "PM2 Processes:" -ForegroundColor White
    pm2 list
    
    Write-Host ""
    Write-Host "Health Checks:" -ForegroundColor White
    
    $services = @(
        @{Name="Main App"; Port=3000; Url="/api/health"},
        @{Name="Medical RAG"; Port=3031; Url="/health"},
        @{Name="LangChain RAG"; Port=3032; Url="/health"},
        @{Name="MedASR"; Port=3033; Url="/health"}
    )
    
    foreach ($service in $services) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)$($service.Url)" -TimeoutSec 3 -UseBasicParsing
            Write-Success "$($service.Name) (Port $($service.Port)) - Running"
        } catch {
            Write-Err "$($service.Name) (Port $($service.Port)) - Not responding"
        }
    }
    
    exit 0
}

# Logs mode
if ($Logs) {
    Write-Header "Viewing Logs (Ctrl+C to exit)"
    pm2 logs
    exit 0
}

# Start mode
if ($Start) {
    Write-Header "Gelani Healthcare - Starting All Services"
    
    Write-Info "Starting services with PM2..."
    
    # Start all services via PM2
    pm2 start ecosystem.config.js
    
    # Wait for services to start
    Write-Info "Waiting for services to initialize..."
    Start-Sleep -Seconds 5
    
    # Save PM2 configuration
    pm2 save
    
    Write-Host ""
    Write-Header "Service Status"
    
    pm2 list
    
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✨ GELANI HEALTHCARE ASSISTANT IS RUNNING!               " -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "  🌐 Main Application:   " -NoNewline
    Write-Host "http://localhost:3000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  📡 API Services:" -ForegroundColor White
    Write-Host "     Medical RAG:    " -NoNewline
    Write-Host "http://localhost:3031/docs" -ForegroundColor Cyan
    Write-Host "     LangChain RAG:  " -NoNewline
    Write-Host "http://localhost:3032/docs" -ForegroundColor Cyan
    Write-Host "     MedASR Voice:   " -NoNewline
    Write-Host "http://localhost:3033/docs" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  📋 Useful Commands:" -ForegroundColor White
    Write-Host "     View logs:    pm2 logs" -ForegroundColor Gray
    Write-Host "     Check status: pm2 status" -ForegroundColor Gray
    Write-Host "     Stop all:     pm2 stop all" -ForegroundColor Gray
    Write-Host "     Restart:      pm2 restart all" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  🧠 All services use Z.ai SDK for REAL AI capabilities!" -ForegroundColor Yellow
    Write-Host ""
}
