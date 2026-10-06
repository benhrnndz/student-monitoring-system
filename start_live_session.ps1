# ClassPulse Live Google Meet Session Launcher
# Automates Backend, Frontend, Cloudflare Tunnel, and Student Extension Packaging

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ClassPulse - Live Google Meet & Classroom Launcher      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$WorkspaceRoot = $PSScriptRoot
$CloudflaredExe = "C:\Program Files (x86)\cloudflared\cloudflared.exe"

if (-not (Test-Path $CloudflaredExe)) {
    Write-Host "[!] Cloudflare Tunnel not found at $CloudflaredExe" -ForegroundColor Red
    Write-Host "    Please ensure cloudflared is installed via winget install Cloudflare.cloudflared" -ForegroundColor Yellow
    exit 1
}

# 1. Start Backend if not already running
$Port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if (-not $Port8000) {
    Write-Host "[1/4] Starting FastAPI backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
    Start-Process -FilePath "$WorkspaceRoot\.venv\Scripts\python.exe" `
        -ArgumentList "-m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000" `
        -WorkingDirectory $WorkspaceRoot -WindowStyle Minimized
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/4] Backend is already running on port 8000." -ForegroundColor Green
}

# 2. Start Frontend if not already running
$Port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $Port3000) {
    Write-Host "[2/4] Starting Next.js frontend on http://localhost:3000..." -ForegroundColor Yellow
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npm run dev" `
        -WorkingDirectory "$WorkspaceRoot\frontend" -WindowStyle Minimized
    Start-Sleep -Seconds 3
} else {
    Write-Host "[2/4] Frontend is already running on port 3000." -ForegroundColor Green
}

# 3. Start Cloudflare Tunnel
$LogFile = "$WorkspaceRoot\cloudflared.log"
Write-Host "[3/4] Establishing secure Cloudflare Tunnel to the internet..." -ForegroundColor Yellow
if (Test-Path $LogFile) { Remove-Item $LogFile -Force }

$TunnelProc = Start-Process -FilePath $CloudflaredExe `
    -ArgumentList "tunnel --url http://127.0.0.1:8000 --logfile `"$LogFile`"" `
    -PassThru -WindowStyle Minimized

Write-Host "Waiting for tunnel assignment..." -ForegroundColor DarkGray
$TunnelUrl = $null
$Timeout = 20
while ($Timeout -gt 0) {
    if (Test-Path $LogFile) {
        $Content = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue
        if ($Content -match 'https://([a-zA-Z0-9\-]+\.trycloudflare\.com)') {
            $TunnelUrl = $matches[1]
            break
        }
    }
    Start-Sleep -Seconds 1
    $Timeout--
}

if (-not $TunnelUrl) {
    Write-Host "[X] Could not retrieve Cloudflare Tunnel URL. Please check $LogFile" -ForegroundColor Red
    exit 1
}

$WssUrl = "wss://$TunnelUrl/ws/session"
Write-Host ">>> Public Tunnel Active: https://$TunnelUrl" -ForegroundColor Green
Write-Host ">>> Secure WebSocket URL: $WssUrl" -ForegroundColor Cyan

# 4. Update Extension configuration with the live URL
Write-Host "[4/4] Configuring & Packaging Student Extension..." -ForegroundColor Yellow

$BgJs = "$WorkspaceRoot\extension\background.js"
(Get-Content $BgJs) -replace 'wsBaseUrl:\s*"[^"]*"', "wsBaseUrl: `"$WssUrl`"" | Set-Content $BgJs

$PopJs = "$WorkspaceRoot\extension\popup.js"
(Get-Content $PopJs) -replace 'wss?://[^"]+/ws/session', $WssUrl | Set-Content $PopJs

$PopHtml = "$WorkspaceRoot\extension\popup.html"
(Get-Content $PopHtml) -replace 'value="wss?://[^"]+/ws/session"', "value=`"$WssUrl`"" | Set-Content $PopHtml

# Package ClassPulse-Companion.zip
$ZipPath = "$WorkspaceRoot\ClassPulse-Companion.zip"
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path "$WorkspaceRoot\extension\*" -DestinationPath $ZipPath -Force

Write-Host ">>> ClassPulse-Companion.zip created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "                   SESSION READY!                         " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "1. Teacher Dashboard:  http://localhost:3000/teacher"
Write-Host "2. Student Zip File:   $ZipPath"
Write-Host "3. Share with students on Google Meet or Google Classroom:"
Write-Host "   - Download & extract ClassPulse-Companion.zip"
Write-Host "   - Load unpacked in chrome://extensions/"
Write-Host "   - Open Google Meet, enter student name in extension, and click Save"
Write-Host "==========================================================" -ForegroundColor Cyan

Start-Process "http://localhost:3000/teacher"

