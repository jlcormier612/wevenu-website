#!/usr/bin/env bash
# Start marketing (:3001) detached — public site, no Supabase login.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3001
LOG="${WEVERNU_MARKETING_LOG:-/tmp/wevenu-marketing-dev.log}"
python3 - "$ROOT/marketing" "$PORT" "$LOG" "Marketing" <<'PY'
import os, sys, subprocess, socket, time
cwd, port_s, log, name = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
port = int(port_s)

def listening(p: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", p)) == 0

if listening(port):
    print(f"{name} already listening on :{port}")
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
for _ in range(30):
    if listening(port):
        print(f"OK :{port} listening")
        raise SystemExit(0)
    time.sleep(1)
print(f"Not listening yet — check {log}")
raise SystemExit(1)
PY
