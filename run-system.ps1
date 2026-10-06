# PowerShell launcher for Student Learning Monitoring System
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting Student Learning Monitoring System" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Start Backend
Write-Host "[1/2] Starting Python FastAPI Backend on port 8000..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$ScriptDir\backend`" && `"$ScriptDir\.venv\Scripts\python.exe`" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

# 2. Start Frontend
Write-Host "[2/2] Starting Next.js React Frontend on port 3000..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$ScriptDir\frontend`" && npm run dev"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Both servers launched in background windows!" -ForegroundColor Green
Write-Host ""
Write-Host "  - Teacher Dashboard:  http://localhost:3000/teacher"
Write-Host "  - Student Classroom:  http://localhost:3000/classroom/live-demo"
Write-Host "  - Backend API Docs:   http://localhost:8000/docs"
Write-Host "========================================================" -ForegroundColor Green

Start-Sleep -Seconds 3
Start-Process "http://localhost:3000/teacher"
