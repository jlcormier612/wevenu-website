#!/usr/bin/env bash
# Regression: docs-only vs full-build classification for required venue PR check.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLS="$ROOT/scripts/ci/classify-venue-pr-scope.sh"
chmod +x "$CLS"

assert_mode() {
  local want="$1"
  shift
  local got
  got="$("$CLS" "$@")"
  if [ "$got" != "mode=$want" ]; then
    echo "FAIL want=mode=$want got=$got args=$*" >&2
    exit 1
  fi
  echo "PASS mode=$want — $*"
}

# Empty / no args → full (fail closed)
assert_mode full

# Pure documentation
assert_mode docs docs/launch/LAUNCH-READINESS.md
assert_mode docs docs/qa/launch-performance/nav-perf-wave7a/AFTER-DEPLOY-REPORT.md \
  docs/qa/launch-performance/nav-perf-wave7a/sandbox-acceptance.json
assert_mode docs README.md docs/foo.md

# Application / tests / shared
assert_mode full lib/foo.ts
assert_mode full docs/launch/LAUNCH-READINESS.md lib/foo.ts
assert_mode full 'app/(app)/dashboard/page.tsx'
assert_mode full shared/relationships/service.ts
assert_mode full components/dashboard/dashboard-focus-island.tsx

# Scripts / workflow / config → full
assert_mode full .github/workflows/venue-app-pr-build.yml
assert_mode full scripts/ci/classify-venue-pr-scope.sh
assert_mode full tsconfig.json
assert_mode full package.json

# Executable under docs/ is ambiguous → full
assert_mode full docs/qa/launch-performance/nav-perf-wave7a/measure-sandbox.mts
assert_mode docs docs/qa/x.md docs/qa/y.json
assert_mode full docs/qa/x.md docs/qa/y.mts

echo "All classify-venue-pr-scope assertions passed."
