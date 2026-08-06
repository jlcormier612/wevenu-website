#!/usr/bin/env bash
# Start CRM (workspace/) detached from the calling shell so it survives
# Cursor agent terminal teardown. Venue (:3000) and marketing (:3001) already
# run this way (PPID 1 / launchd); agent-bound `npm run dev` on :3002 does not.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3002
LOG="${WEVERNU_WORKSPACE_LOG:-/tmp/wevenu-workspace-dev.log}"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "CRM already listening on :$PORT"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
  exit 0
fi

cd "$ROOT/workspace"
# nohup + background + disown from job control so the process is reparented
# to launchd when this shell exits (same durability as venue/marketing).
nohup npm run dev >>"$LOG" 2>&1 &
disown %1 2>/dev/null || true

echo "CRM starting on http://localhost:$PORT (log: $LOG)"
sleep 1
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
else
  echo "Not listening yet — check $LOG"
  tail -n 40 "$LOG" || true
  exit 1
fi
