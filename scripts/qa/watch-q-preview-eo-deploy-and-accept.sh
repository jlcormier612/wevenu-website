#!/usr/bin/env bash
set -euo pipefail
cd /Users/jensmac/Developer/wevenu-website
EXPECTED=592a69b513685876d3efe3cab708d6af822632da
RUN_ID=39730706358
OUT=docs/qa/booking-to-portal-simplification
LOG="$OUT/q-preview-eo-deploy-watch.log"
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
    EXPECTED_SHA=$EXPECTED npx tsx scripts/qa/questionnaire-preview-eo-included-acceptance.mts
    exit $?
  fi
  sleep 15
done
echo "SERVING_TIMEOUT"
exit 1
