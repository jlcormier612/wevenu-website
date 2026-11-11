#!/usr/bin/env python3
"""Add hospitality page classes to main pages when f22 imports already resolve."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path


def imports_resolve(source: str) -> bool:
    for m in re.finditer(r'from\s+"(@/[^"]+)"', source):
        rel = m.group(1)[2:]
        cands = [rel, f"{rel}.ts", f"{rel}.tsx", f"{rel}/index.ts", f"{rel}/index.tsx"]
        if not any(Path(c).exists() for c in cands):
            return False
    return True


def main() -> None:
    try:
        raw = subprocess.check_output(
            ["git", "grep", "-l", "htc-hospitality", "f22b8c14", "--", "app/(app)"],
            text=True,
        )
    except subprocess.CalledProcessError:
        raw = ""

    paths = sorted({line.split(":", 1)[-1] for line in raw.splitlines() if line.strip()})
    patched = 0
    for path in paths:
        p = Path(path)
        if not p.exists():
            continue
        text = p.read_text()
        if "htc-hospitality-page" in text:
            continue
        try:
            f22 = subprocess.check_output(
                ["git", "show", f"f22b8c14:{path}"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
        except subprocess.CalledProcessError:
            continue
        if not imports_resolve(f22):
            continue
        m = re.search(r'return \(\s*\n(\s*)<div className="([^"]*)"', text)
        if not m:
            continue
        classes = m.group(2)
        new = f"htc-hospitality-page {classes}".strip()
        if "htc-hospitality-heading" in f22 and "PageHeader" in text:
            new = new.replace(
                "htc-hospitality-page",
                "htc-hospitality-page htc-hospitality-heading htc-hospitality-intro-accent",
                1,
            )
        p.write_text(text[: m.start(2)] + new + text[m.end(2) :])
        patched += 1
        print(f"patched {path}")
    print(f"PATCHED {patched}")


if __name__ == "__main__":
    main()
