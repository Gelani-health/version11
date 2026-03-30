@echo off
REM ============================================================
REM Gelani Healthcare Assistant - Windows Startup Script
REM ============================================================
REM 
REM World-Class Clinical Decision Support System
REM 
REM Usage:
REM   start-gelani.bat          - Start main application only
REM   start-gelani.bat full     - Start with all services (RAG, ASR)
REM   start-gelani.bat pm2      - Start with PM2 process manager
REM
REM Requirements:
REM   - Node.js 18+ or Bun
REM   - SQLite3
REM   - Python 3.10+ (for extended RAG services)
REM   - PM2: npm install -g pm2
REM
REM ============================================================

SETLOCAL EnableDelayedExpansion

echo.
echo ============================================================
echo  Gelani Healthcare Assistant v3.0.0
echo  World-Class Clinical Decision Support System
echo ============================================================
echo.

REM Check if Node.js or Bun is available
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set RUNTIME=node
    echo [OK] Node.js found
) else (
    where bun >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set RUNTIME=bun
        echo [OK] Bun found
    ) else (
        echo [ERROR] Neither Node.js nor Bun found. Please install one.
        pause
        exit /b 1
    )
)

REM Create necessary directories
if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "upload" mkdir upload

REM Check if database exists
if not exist "data\healthcare.db" (
    echo.
    echo [INFO] Database not found. Initializing...
    call :init_database
)

REM Parse command line argument
set MODE=%1
if "%MODE%"=="" set MODE=dev

echo.
echo [INFO] Starting Gelani in %MODE% mode...
echo.

if "%MODE%"=="full" (
    call :start_full
) else if "%MODE%"=="pm2" (
    call :start_pm2
) else (
    call :start_dev
)

echo.
echo [INFO] Gelani is running at http://localhost:3000
echo [INFO] Press Ctrl+C to stop
echo.

REM Keep the window open
if "%MODE%"=="dev" (
    %RUNTIME% run dev
)

goto :eof

REM ============================================================
REM Functions
REM ============================================================

:init_database
echo [INFO] Running database migrations...
if "%RUNTIME%"=="bun" (
    bun run db:generate
    bun run db:push
) else (
    npm run db:generate
    npm run db:push
)
echo [INFO] Seeding default data...
if "%RUNTIME%"=="bun" (
    bun run db:seed:ai
) else (
    npm run db:seed:ai
)
goto :eof

:start_dev
echo [INFO] Starting main application...
if "%RUNTIME%"=="bun" (
    bun run dev
) else (
    npm run dev
)
goto :eof

:start_full
echo [INFO] Starting all services...
echo [WARN] Full mode requires Python services to be installed.
echo [INFO] Run 'setup:services' first if not done.
REM Start Python services in background
start /B python mini-services\medical-rag-service\index.py
start /B python mini-services\langchain-rag-service\index.py
start /B python mini-services\medasr-service\index.py
REM Start main app
if "%RUNTIME%"=="bun" (
    bun run dev
) else (
    npm run dev
)
goto :eof

:start_pm2
echo [INFO] Starting with PM2...
pm2 start ecosystem.config.js
pm2 save
echo [INFO] PM2 started. Use 'pm2 logs' to view logs.
echo [INFO] Use 'pm2 stop all' to stop all services.
goto :eof
