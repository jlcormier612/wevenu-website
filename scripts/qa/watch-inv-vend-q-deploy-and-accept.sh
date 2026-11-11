#!/usr/bin/env bash
# Wait for Sandbox deploy of a9bd5903, confirm serving SHA, run acceptance.
set -euo pipefail
cd /Users/jensmac/Developer/wevenu-website
EXPECTED=a9bd5903cf1baae14a72b0e2e0898d7b837c552d
RUN_ID=39727906815
OUT=docs/qa/booking-to-portal-simplification
LOG="$OUT/inv-vend-q-deploy-watch.log"
mkdir -p "$OUT"
exec > >(tee -a "$LOG") 2>&1

echo "Waiting for deploy $RUN_ID ($EXPECTED)…"
for i in $(seq 1 80); do
  STATUS=$(gh run view "$RUN_ID" --json status,conclusion -q '"\(.status)|\(.conclusion)"')
  echo "poll=$i $STATUS"
  if [[ "$STATUS" == "completed|success" ]]; then
    break
  fi
  if [[ "$STATUS" == completed\|* ]]; then
    echo "DEPLOY_NOT_SUCCESS $STATUS"
    exit 1
  fi
  sleep 20
done
STATUS=$(gh run view "$RUN_ID" --json status,conclusion -q '"\(.status)|\(.conclusion)"')
echo "final_deploy=$STATUS"
if [[ "$STATUS" != "completed|success" ]]; then
  echo "DEPLOY_FAILED $STATUS"
  exit 1
fi

echo "Waiting for serving SHA ${EXPECTED:0:8}…"
for i in $(seq 1 40); do
  SHA=$(curl -sS https://app.sandbox.hellotocheers.com/login | rg -o 'dpl=[a-f0-9]{40}' | head -1 | sed 's/dpl=//' || true)
  echo "serving_poll=$i ${SHA:-none}"
  if [[ "${SHA:-}" == "$EXPECTED" ]]; then
    echo "SERVING_MATCH $SHA"
    EXPECTED_SHA=$EXPECTED npx tsx scripts/qa/inventory-vendors-q-nav-acceptance.mts
    exit $?
  fi
  sleep 15
done
echo "SERVING_TIMEOUT"
exit 1
