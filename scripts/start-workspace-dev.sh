#!/usr/bin/env bash
# Start CRM (workspace/) detached from the calling shell so it survives
# Cursor agent terminal teardown.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3002
LOG="${WEVERNU_WORKSPACE_LOG:-/tmp/wevenu-workspace-dev.log}"
export PYTHONPATH="$ROOT/scripts${PYTHONPATH:+:$PYTHONPATH}"
python3 - "$ROOT/workspace" "$PORT" "$LOG" "CRM" <<'PY'
import os, sys, subprocess, time
from dev_listen import ensure_port_clear_if_unhealthy, listening_ipv4, http_healthy

cwd, port_s, log, name = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
port = int(port_s)

if not ensure_port_clear_if_unhealthy(port, name, path="/"):
    raise SystemExit(0)

with open(log, "ab", buffering=0) as fh:
    subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=cwd,
        stdout=fh,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
        env=os.environ.copy(),
    )
print(f"{name} starting on http://localhost:{port} (log: {log})")
for _ in range(40):
    if listening_ipv4(port) and http_healthy(port, path="/", timeout=3.0):
        print(f"OK :{port} healthy")
        raise SystemExit(0)
    time.sleep(1)
print(f"Not healthy yet — check {log}")
raise SystemExit(1)
PY
