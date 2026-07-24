@echo off
REM ============================================================
REM  AI Powered Escape Room - one-click launcher
REM  Double-click this file to start EVERYTHING:
REM    - Game        -> http://localhost:3000
REM    - Admin panel -> http://localhost:5000/admin/  (admin / Admin1234)
REM  Leave the black server window OPEN while you play.
REM  To stop: close that black window.
REM ============================================================
cd /d "%~dp0"
title AI Escape Room - launcher

echo.
echo   Starting the game + admin server...
echo   (a second window will open - leave it running)
echo.

REM Launch both servers (Flask backend on :5000 + game on :3000) in their own window
start "AI Escape Room - SERVERS (keep open)" cmd /k "npm start"

REM Give the servers a few seconds to boot, then open the pages
timeout /t 9 /nobreak >nul
start "" http://localhost:3000
start "" http://localhost:5000/admin/

echo.
echo   Done! Two browser tabs should have opened:
echo     - The game:  http://localhost:3000
echo     - Admin:     http://localhost:5000/admin/   (login: admin / Admin1234)
echo.
echo   You can close THIS window. Keep the "SERVERS" window open while playing.
echo.
pause
