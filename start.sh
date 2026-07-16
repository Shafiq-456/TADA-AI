#!/bin/bash

# TADA AI — Start both Frontend and Backend simultaneously

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Clean up stale processes on target ports (8000 and 4001)
echo -e "${YELLOW}🧹 Cleaning up stale processes on ports 8000 and 4001...${NC}"
PID_8000=$(lsof -ti:8000)
if [ -n "$PID_8000" ]; then
  kill -9 $PID_8000 2>/dev/null || true
fi

PID_4001=$(lsof -ti:4001)
if [ -n "$PID_4001" ]; then
  kill -9 $PID_4001 2>/dev/null || true
fi

echo -e "${YELLOW}🚀 Starting TADA AI...${NC}"
echo ""

# ── Backend ──────────────────────────────────────────────────────────────────
echo -e "${BLUE}⚙️  Backend  → http://localhost:8000${NC}"
(
  cd "$ROOT_DIR/tada-backend" || exit 1
  source venv/bin/activate
  uvicorn main:app --reload
) &
BACKEND_PID=$!

# Small delay so backend starts printing before frontend does
sleep 1

# ── Frontend ─────────────────────────────────────────────────────────────────
echo -e "${GREEN}🖥️  Frontend → http://localhost:4001${NC}"
(
  cd "$ROOT_DIR/tada-ai" || exit 1
  npm run dev
) &
FRONTEND_PID=$!

echo ""
echo -e "${YELLOW}Both servers running. Press Ctrl+C to stop both.${NC}"
echo ""

# Kill both on Ctrl+C
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# Wait for either to exit
wait
