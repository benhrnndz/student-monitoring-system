@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Student Learning Monitoring System - Docker Deployment
echo ========================================================
echo.

where docker >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker command not found in your system PATH.
    echo Please install or launch Docker Desktop for Windows:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo If you wish to run without Docker, you can run:
    echo   run-system.bat
    echo.
    pause
    exit /b 1
)

echo [1/3] Checking environment file...
if not exist ".env" (
    echo No .env file found. Copying .env.example to .env...
    copy .env.example .env >nul
)

echo [2/3] Building and starting Docker containers in detached mode...
docker compose up --build -d

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Docker Compose failed to build or start containers.
    echo Ensure Docker Desktop engine is running and try again.
    pause
    exit /b 1
)

echo.
echo [3/3] Checking container status...
docker compose ps

echo.
echo ========================================================
echo   Services are running successfully via Docker!
echo ========================================================
echo.
echo   - Teacher Dashboard:  http://localhost:3000/teacher
echo   - Student Classroom:  http://localhost:3000/classroom/live-demo
echo   - Backend API Docs:   http://localhost:8000/docs
echo   - Health Endpoint:    http://localhost:8000/api/health
echo.
echo Useful Commands:
echo   - View live logs:     docker compose logs -f
echo   - Stop containers:    docker compose down
echo   - Restart containers: docker compose restart
echo ========================================================
echo.
pause

