#!/usr/bin/env bash
# Sandbox CI only: rewrite Dockerfile FROM lines that point at AWS Public ECR
# library images to the private htc-ci-bases mirror so BuildKit never requests
# public.ecr.aws metadata (HTTP 429). Committed Dockerfiles stay unchanged.
#
# Usage:
#   rewrite-sandbox-dockerfile-bases.sh <src-dockerfile> <dest-dockerfile> <ecr-registry>
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <src-dockerfile> <dest-dockerfile> <ecr-registry>" >&2
  exit 2
fi

SRC="$1"
DEST="$2"
REGISTRY="$3"

if [ ! -f "$SRC" ]; then
  echo "error: source Dockerfile not found: $SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
# Exact Public ECR library tags used by committed Dockerfiles today.
sed -E \
  -e "s|FROM public\\.ecr\\.aws/docker/library/node:22-alpine|FROM ${REGISTRY}/htc-ci-bases:node-22-alpine|g" \
  -e "s|FROM public\\.ecr\\.aws/docker/library/alpine:3.20|FROM ${REGISTRY}/htc-ci-bases:alpine-3.20|g" \
  "$SRC" > "$DEST"

if grep -E '^FROM[[:space:]]+public\.ecr\.aws/docker/library/' "$DEST" >/dev/null; then
  echo "error: public.ecr.aws/docker/library FROM remains after rewrite in $DEST:" >&2
  grep -nE '^FROM[[:space:]]+public\.ecr\.aws/docker/library/' "$DEST" >&2 || true
  exit 1
fi

if ! grep -E "^FROM[[:space:]]+${REGISTRY}/htc-ci-bases:(node-22-alpine|alpine-3.20)" "$DEST" >/dev/null; then
  echo "error: rewritten Dockerfile has no private htc-ci-bases FROM: $DEST" >&2
  exit 1
fi

echo "Rewrote $SRC -> $DEST (private htc-ci-bases FROM)"
