@echo off
echo ========================================================
echo   Starting Student Learning Monitoring System (Phase 4 MVP)
echo ========================================================
echo.

echo Starting Python FastAPI Backend on port 8000...
start "Backend - FastAPI" cmd /k "cd backend && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Next.js React Frontend on port 3000...
start "Frontend - Next.js" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo Both servers launched!
echo.
echo   - Landing Page:      http://localhost:3000
echo   - Teacher Dashboard: http://localhost:3000/teacher
echo   - Student Classroom: http://localhost:3000/classroom/live-demo
echo   - Backend API Docs:  http://localhost:8000/docs
echo ========================================================
