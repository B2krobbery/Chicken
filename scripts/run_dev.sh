#!/usr/bin/env bash
set -e

echo "🚀 Starting TheChickenMan B2B Poultry Platform..."

# 1. Start Backend FastAPI
echo "📦 Launching Backend API on http://localhost:8000..."
cd "$(dirname "$0")/../backend"
source ../.venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 2. Start Frontend Next.js
echo "💻 Launching Next.js Web App on http://localhost:3000..."
cd "$(dirname "$0")/../apps/web"
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
