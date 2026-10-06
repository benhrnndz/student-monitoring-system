@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Starting Student Learning Monitoring System
echo ========================================================
echo.

echo [1/2] Starting Python FastAPI Backend on port 8000...
start "Backend - FastAPI" cmd /k "cd /d "%~dp0backend" && "%~dp0.venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting Next.js React Frontend on port 3000...
start "Frontend - Next.js" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================================
echo Both servers have been launched in separate windows!
echo.
echo   - Main Landing Page:  http://localhost:3000
echo   - Teacher Dashboard:  http://localhost:3000/teacher
echo   - Student Classroom:  http://localhost:3000/classroom/live-demo
echo   - Backend API Docs:   http://localhost:8000/docs
echo.
echo TIP: If a terminal window title says "Select Backend...",
echo      Windows has paused it for text selection.
echo      Click into that window and press ENTER or ESC to resume.
echo ========================================================
echo.
echo Opening Teacher Dashboard in your default browser...
timeout /t 3 >nul
start http://localhost:3000/teacher

exit /b 0
