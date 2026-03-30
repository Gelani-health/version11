@echo off
REM ============================================================
REM Gelani Healthcare Assistant - Windows Stop Script
REM ============================================================

echo.
echo ============================================================
echo  Stopping Gelani Healthcare Assistant
echo ============================================================
echo.

REM Stop PM2 processes if running
pm2 stop all >nul 2>&1

REM Kill any Node.js processes on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Kill Python services on ports 3031, 3032, 3033
for %%p in (3031 3032 3033) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p') do (
        taskkill /PID %%a /F >nul 2>&1
    )
)

echo [OK] All Gelani processes stopped.
echo.
pause
