#!/usr/bin/env bash
# Detach venue (:3000), marketing (:3001), and CRM (:3002) into new process
# sessions so Cursor/agent terminal teardown cannot reap them.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${WEVERNU_DEV_LOG_DIR:-/tmp}"
export PYTHONPATH="$ROOT/scripts${PYTHONPATH:+:$PYTHONPATH}"

python3 - "$ROOT" "$LOG_DIR" <<'PY'
import os, sys, subprocess, time
from dev_listen import ensure_port_clear_if_unhealthy, listening_ipv4, http_healthy

root, log_dir = sys.argv[1], sys.argv[2]
apps = [
    ("Venue", 3000, root, os.path.join(log_dir, "wevenu-main-dev.log"), "/login"),
    ("Marketing", 3001, os.path.join(root, "marketing"), os.path.join(log_dir, "wevenu-marketing-dev.log"), "/"),
    ("CRM", 3002, os.path.join(root, "workspace"), os.path.join(log_dir, "wevenu-workspace-dev.log"), "/"),
]

for name, port, cwd, log, path in apps:
    if not ensure_port_clear_if_unhealthy(port, name, path=path):
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

for _ in range(50):
    if all(
        listening_ipv4(port) and http_healthy(port, path=path, timeout=2.5)
        for _, port, _, _, path in apps
    ):
        break
    time.sleep(1)

for name, port, _, _, path in apps:
    status = "OK" if http_healthy(port, path=path, timeout=2.5) else "MISSING"
    print(f"{status} :{port} ({name})")
PY
