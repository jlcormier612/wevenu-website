#!/usr/bin/env bash
# Classify a PR change set for venue-app-pr-build.yml.
# Prints: mode=docs | mode=full
# Fail-closed: empty/ambiguous input → mode=full
set -euo pipefail

is_docs_only_path() {
  local f="$1"
  case "$f" in
    README.md|CHANGELOG.md|LICENSE|AGENTS.md|CLAUDE.md) return 0 ;;
  esac
  case "$f" in
    docs/*) ;;
    *) return 1 ;;
  esac
  # Under docs/: evidence / documentation extensions only.
  # Executable / TypeScript under docs/ is ambiguous → full build.
  case "$f" in
    *.md|*.txt|*.json|*.csv|*.png|*.jpg|*.jpeg|*.webp|*.gif|*.svg) return 0 ;;
    *) return 1 ;;
  esac
}

if [ "$#" -eq 0 ]; then
  echo "mode=full"
  exit 0
fi

MODE=docs
for f in "$@"; do
  if ! is_docs_only_path "$f"; then
    MODE=full
    break
  fi
done

echo "mode=$MODE"
