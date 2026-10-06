@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Launching Multi-Student Classroom Simulator (15 Bots)
echo ========================================================
echo.

"%~dp0.venv\Scripts\python.exe" "%~dp0scripts\simulate_classroom.py" --count 15

pause
