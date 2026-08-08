#!/usr/bin/env bash
# Detach venue (:3000), marketing (:3001), and CRM (:3002) into new process
# sessions so Cursor/agent terminal teardown cannot reap them.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${WEVERNU_DEV_LOG_DIR:-/tmp}"

python3 - "$ROOT" "$LOG_DIR" <<'PY'
import os, sys, subprocess, time, socket

root, log_dir = sys.argv[1], sys.argv[2]
apps = [
    ("Venue", 3000, root, os.path.join(log_dir, "wevenu-main-dev.log")),
    ("Marketing", 3001, os.path.join(root, "marketing"), os.path.join(log_dir, "wevenu-marketing-dev.log")),
    ("CRM", 3002, os.path.join(root, "workspace"), os.path.join(log_dir, "wevenu-workspace-dev.log")),
]

def listening(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0

for name, port, cwd, log in apps:
    if listening(port):
        print(f"{name} already listening on :{port}")
        continue
    os.makedirs(os.path.dirname(log) or ".", exist_ok=True)
    with open(log, "ab", buffering=0) as fh:
        # start_new_session=True => new process group; survives parent shell exit.
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

for _ in range(45):
    if all(listening(p) for _, p, _, _ in apps):
        break
    time.sleep(1)

for name, port, _, _ in apps:
    status = "OK" if listening(port) else "MISSING"
    print(f"{status} :{port} ({name})")
PY
