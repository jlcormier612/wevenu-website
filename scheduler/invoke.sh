#!/bin/sh
# One scheduled-job invocation, called by supercronic per crontab line.
# Always exits non-zero on failure (network error or non-2xx) so
# supercronic's own log line makes failures visible without extra
# plumbing; never retries and never touches any other job's schedule.
set -u

name="$1"
url="$2"
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
body_file="/tmp/invoke-body.$$"

code=$(curl -sS -o "$body_file" -w '%{http_code}' --max-time 60 \
  -H "Authorization: Bearer ${CRON_SECRET:-}" "$url")
curl_exit=$?
body=$(head -c 500 "$body_file" 2>/dev/null)
rm -f "$body_file"

if [ "$curl_exit" -ne 0 ]; then
  echo "[scheduler] FAILED name=$name curl_exit=$curl_exit url=$url started=$started"
  exit 1
fi

echo "[scheduler] name=$name http_status=$code url=$url started=$started body=$body"

case "$code" in
  2??) exit 0 ;;
  *) exit 1 ;;
esac
