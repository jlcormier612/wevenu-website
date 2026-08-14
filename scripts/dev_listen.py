"""Shared helpers for durable local Next.js detach starters."""

from __future__ import annotations

import os
import signal
import socket
import subprocess
import time
import urllib.error
import urllib.request


def listening_ipv4(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def listening_ipv6(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s:
            s.settimeout(0.3)
            return s.connect_ex(("::1", port)) == 0
    except OSError:
        return False


def listener_pids(port: int) -> list[int]:
    try:
        out = subprocess.check_output(
            ["lsof", f"-tiTCP:{port}", "-sTCP:LISTEN"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    pids: list[int] = []
    for line in out.splitlines():
        line = line.strip()
        if line.isdigit():
            pids.append(int(line))
    return pids


def kill_listeners(port: int) -> None:
    pids = listener_pids(port)
    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    deadline = time.time() + 3
    while time.time() < deadline and listener_pids(port):
        time.sleep(0.2)
    for pid in listener_pids(port):
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def _http_status(url: str, timeout: float) -> int | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return getattr(resp, "status", 200)
    except urllib.error.HTTPError as exc:
        # Auth redirects / app errors still prove the server is alive.
        return int(exc.code)
    except Exception:
        return None


def http_healthy(port: int, path: str = "/", timeout: float = 2.5) -> bool:
    """
    True when at least one of IPv4 / localhost answers promptly.
    Important on macOS: `localhost` often prefers ::1, and a hung IPv6
    listener with a live IPv4 twin presents as 'won't reload'.
    """
    candidates = [
        f"http://127.0.0.1:{port}{path}",
        f"http://localhost:{port}{path}",
    ]
    for url in candidates:
        status = _http_status(url, timeout=timeout)
        if status is not None and status < 500:
            # Prefer dual-stack health: if ::1 is accepted but hangs, fail.
            if listening_ipv6(port):
                v6 = _http_status(f"http://[::1]:{port}{path}", timeout=timeout)
                if v6 is None:
                    return False
            return True
    return False


def ensure_port_clear_if_unhealthy(port: int, name: str, path: str = "/") -> bool:
    """
    If something listens but does not answer HTTP quickly, kill it.
    Returns True when the port is free (caller should start), False when healthy.
    """
    if not listening_ipv4(port) and not listening_ipv6(port):
        return True
    if http_healthy(port, path=path):
        print(f"{name} already healthy on :{port}")
        return False
    print(f"{name} listener on :{port} is unhealthy — restarting")
    kill_listeners(port)
    time.sleep(0.5)
    return True
