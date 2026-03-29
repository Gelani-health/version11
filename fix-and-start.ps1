# Gelani Healthcare - Windows Complete Setup Script
# =================================================
# Run this script in PowerShell

Write-Host "================================================" -ForegroundColor Blue
Write-Host "  Gelani Healthcare - Windows Complete Setup    " -ForegroundColor Blue
Write-Host "================================================" -ForegroundColor Blue
Write-Host ""

# Step 1: Stop PM2 to release file locks
Write-Host "[1/7] Stopping PM2..." -ForegroundColor Yellow
pm2 stop gelani 2>$null
pm2 delete gelani 2>$null
Start-Sleep -Seconds 2
Write-Host "  Done." -ForegroundColor Green

# Step 2: Clean Prisma cache
Write-Host "[2/7] Cleaning Prisma cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
Write-Host "  Done." -ForegroundColor Green

# Step 3: Regenerate Prisma Client
Write-Host "[3/7] Regenerating Prisma client..." -ForegroundColor Yellow
bun run db:generate
Write-Host "  Done." -ForegroundColor Green

# Step 4: Push database schema
Write-Host "[4/7] Pushing database schema..." -ForegroundColor Yellow
bun run db:push
Write-Host "  Done." -ForegroundColor Green

# Step 5: Seed database if needed
Write-Host "[5/7] Checking database seed..." -ForegroundColor Yellow
bun run db:seed:services
Write-Host "  Done." -ForegroundColor Green

# Step 6: Start PM2 for main app
Write-Host "[6/7] Starting PM2 for main app..." -ForegroundColor Yellow
pm2 start ecosystem.config.js
pm2 save
Write-Host "  Done." -ForegroundColor Green

# Step 7: Start mini-services in background
Write-Host "[7/7] Starting RAG/ASR mini-services..." -ForegroundColor Yellow
Start-Process -FilePath "bun" -ArgumentList "run", "start-services.ts" -WindowStyle Minimized
Start-Sleep -Seconds 5
Write-Host "  Done." -ForegroundColor Green

# Show status
Write-Host ""
Write-Host "================================================" -ForegroundColor Blue
Write-Host "  Checking Service Status...                    " -ForegroundColor Blue
Write-Host "================================================" -ForegroundColor Blue
Write-Host ""

# Check main app
try {
    $mainApp = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  Main App (3000):     " -NoNewline
    Write-Host "OK" -ForegroundColor Green
} catch {
    Write-Host "  Main App (3000):     " -NoNewline
    Write-Host "Starting..." -ForegroundColor Yellow
}

# Check mini-services
foreach ($port in @(3031, 3032, 3033)) {
    try {
        $health = Invoke-WebRequest -Uri "http://localhost:$port/health" -TimeoutSec 5 -UseBasicParsing
        Write-Host "  Service ($port):     " -NoNewline
        Write-Host "OK" -ForegroundColor Green
    } catch {
        Write-Host "  Service ($port):     " -NoNewline
        Write-Host "Not responding" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Blue
Write-Host "  Setup Complete!                               " -ForegroundColor Blue
Write-Host "================================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Main Application: " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "API Documentation:" -ForegroundColor White
Write-Host "  Medical RAG:   " -NoNewline
Write-Host "http://localhost:3031/docs" -ForegroundColor Cyan
Write-Host "  LangChain RAG: " -NoNewline
Write-Host "http://localhost:3032/docs" -ForegroundColor Cyan
Write-Host "  MedASR:        " -NoNewline
Write-Host "http://localhost:3033/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor White
Write-Host "  pm2 logs gelani      - View main app logs" -ForegroundColor Gray
Write-Host "  pm2 restart gelani   - Restart main app" -ForegroundColor Gray
Write-Host "  pm2 status           - Check PM2 status" -ForegroundColor Gray
Write-Host ""
