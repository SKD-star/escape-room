@echo off
REM ============================================================
REM  AI Powered Escape Room — 1-Click Dual Server Launcher
REM  Double-click to start Game + Admin Panel.
REM ============================================================
cd /d "%~dp0"
title AI Escape Room Launcher

echo.
echo  ============================================================
echo    🗝️  AI POWERED ESCAPE ROOM — STARTING SERVERS...
echo  ============================================================
echo.

if not exist node_modules (
    echo   Installing Node.js dependencies...
    call npm install
    echo.
)

REM 1. Start Python Flask Backend Server (Port 5000)
start "AI Escape Room - Python Backend (:5000)" cmd /k "python server/app.py"

REM 2. Start Vite 3D Game Server (Port 3000)
start "AI Escape Room - Vite Game Server (:3000)" cmd /k "npm run dev"

REM 3. Wait 4 seconds for both servers to be fully ready
echo   Booting servers... please wait...
timeout /t 4 /nobreak >nul

REM 4. Open browser tabs AFTER servers are listening
start "" http://localhost:3000
start "" http://localhost:5000/admin/

echo.
echo   ============================================================
echo    SUCCESS! Two browser tabs opened:
echo     - 🎮 3D Game:      http://localhost:3000
echo     - ⚙️ Admin Panel:  http://localhost:5000/admin/   (admin / Admin1234)
echo   ============================================================
echo.
echo   Keep the server command windows open while playing.
echo   Press any key to close this launcher window.
echo.
pause
