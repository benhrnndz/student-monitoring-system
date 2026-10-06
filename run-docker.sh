#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================"
echo "  Student Learning Monitoring System - Docker Deployment"
echo "========================================================"
echo ""

if ! command -v docker &> /dev/null; then
    echo "[ERROR] 'docker' command could not be found."
    echo "Please install Docker and Docker Compose before running this script."
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "[INFO] No .env found. Copying .env.example to .env..."
    cp .env.example .env
fi

echo "[1/2] Building and launching containers..."
docker compose up --build -d

echo ""
echo "[2/2] Checking container health..."
docker compose ps

echo ""
echo "========================================================"
echo "  Services are running successfully via Docker!"
echo "========================================================"
echo ""
echo "  - Teacher Dashboard:  http://localhost:3000/teacher"
echo "  - Student Classroom:  http://localhost:3000/classroom/live-demo"
echo "  - Backend API Docs:   http://localhost:8000/docs"
echo "  - Health Endpoint:    http://localhost:8000/api/health"
echo ""
echo "Useful Commands:"
echo "  - Live logs:  docker compose logs -f"
echo "  - Stop:       docker compose down"
echo "========================================================"

