#!/usr/bin/env bash
# Verifies a live Supabase Postgres database (Sandbox or otherwise) is
# actually ready for the app, not merely that a project exists.
#
# Every query in this script was written against, and test-run against,
# the local dev database before being committed - the exact numbers
# encoded below are real query results from a real, current schema, not
# assumptions. Where a value naturally drifts as content is added (row
# counts on reference tables), this script checks ">0", not an exact
# number, so it doesn't go stale.
#
# Usage:
#   ./scripts/verify-sandbox-database.sh "postgresql://user:pass@host:port/postgres"
#
# The connection string is never logged. Get it from the Supabase
# Dashboard: Project Settings -> Database -> Connection string (use the
# Session Pooler variant, not Transaction Pooler - this script runs
# ordinary single-statement queries, so either works, but Session Pooler
# matches what the rest of this engagement's tooling has used).
#
# Exit code 0 = every required check passed. Non-zero = at least one
# required check failed; INFO-only findings never affect the exit code.

set -uo pipefail

CONN="${1:-${SANDBOX_DB_URL:-}}"
if [ -z "$CONN" ]; then
  echo "Usage: $0 <postgres-connection-string>" >&2
  echo "  (or set SANDBOX_DB_URL)" >&2
  exit 2
fi

FAILED=0
pass() { echo "  PASS  $*"; }
fail() { echo "  FAIL  $*"; FAILED=1; }
info() { echo "  INFO  $*"; }

q() {
  # Runs one query, returns trimmed scalar/first-column output. Never
  # echoes the connection string; -q suppresses psql's own banner noise.
  psql "$CONN" -t -A -q -c "$1" 2>/tmp/verify-sandbox-db.err
  if [ $? -ne 0 ]; then
    echo "QUERY_ERROR: $(tail -c 300 /tmp/verify-sandbox-db.err | tr -d '\n')" >&2
    return 1
  fi
}

echo "=== 1. Migrations ==="
MIGRATION_COUNT=$(q "select count(*) from supabase_migrations.schema_migrations;")
if [ -z "$MIGRATION_COUNT" ] || [ "$MIGRATION_COUNT" = "0" ] || [ -z "${MIGRATION_COUNT//[0-9]/}" ] 2>/dev/null; then
  :
fi
if [[ "$MIGRATION_COUNT" =~ ^[0-9]+$ ]] && [ "$MIGRATION_COUNT" -gt 0 ]; then
  pass "supabase_migrations.schema_migrations has $MIGRATION_COUNT tracked rows"
  info "Local dev's own known-good baseline tracks 363 rows for 442 migration files (4 timestamp-collision groups each produce only 1 tracked row - this is expected, not a bug). A materially lower number here means migrations were not fully applied."
else
  fail "supabase_migrations.schema_migrations is missing or empty - migrations were not applied via the tracked pipeline (they may still have been applied by direct SQL without tracking; verify table existence below before assuming nothing ran)"
fi

echo ""
echo "=== 2. Extensions ==="
for ext in pgcrypto pg_trgm; do
  FOUND=$(q "select extname from pg_extension where extname = '$ext';")
  if [ "$FOUND" = "$ext" ]; then
    pass "extension '$ext' is enabled"
  else
    fail "extension '$ext' is NOT enabled - $([ "$ext" = "pgcrypto" ] && echo "every gen_random_uuid() primary-key default will fail to insert" || echo "global search will not function")"
  fi
done

echo ""
echo "=== 3. Required reference/catalog data ==="
declare -A REF_TABLES=(
  ["lead_sources"]="leads.source foreign key depends on this; lead creation breaks without it"
  ["legal_documents"]="couple/vendor acceptance-gating flow reads these directly"
  ["collections"]="wedding-website design catalog"
  ["color_stories"]="wedding-website design catalog"
  ["typography_styles"]="wedding-website design catalog"
  ["photo_styles"]="wedding-website design catalog"
)
for t in "${!REF_TABLES[@]}"; do
  CNT=$(q "select count(*) from public.$t;")
  if [[ "$CNT" =~ ^[0-9]+$ ]] && [ "$CNT" -gt 0 ]; then
    pass "public.$t has $CNT rows"
  else
    fail "public.$t is empty or unreadable - ${REF_TABLES[$t]}"
  fi
done

echo ""
echo "=== 4. Storage buckets ==="
# Exact 11-bucket list, re-confirmed directly against the local dev
# database for this script (the original Sandbox readiness audit
# undercounted this at 10 - couple-messages was missing from it).
declare -A EXPECTED_BUCKETS=(
  ["client-media"]="t" ["contract-representations"]="f" ["couple-messages"]="t"
  ["documents"]="t" ["event-order-representations"]="f" ["feedback-screenshots"]="t"
  ["floor-plans"]="t" ["inventory"]="t" ["request-uploads"]="t" ["uploads"]="t" ["vendors"]="t"
)
for b in "${!EXPECTED_BUCKETS[@]}"; do
  ACTUAL=$(q "select public from storage.buckets where id = '$b';")
  EXPECTED="${EXPECTED_BUCKETS[$b]}"
  if [ "$ACTUAL" = "$EXPECTED" ]; then
    pass "bucket '$b' exists, public=$ACTUAL (correct)"
  elif [ -z "$ACTUAL" ]; then
    fail "bucket '$b' does not exist"
  else
    fail "bucket '$b' exists but public=$ACTUAL, expected public=$EXPECTED"
  fi
done

echo ""
echo "=== 5. RLS / policies / functions / triggers ==="
NO_RLS=$(q "select count(*) from pg_tables where schemaname='public' and rowsecurity=false;")
if [ "$NO_RLS" = "0" ]; then
  pass "every public table has RLS enabled (0 tables with rowsecurity=false)"
else
  fail "$NO_RLS public table(s) have RLS DISABLED - list them with: select tablename from pg_tables where schemaname='public' and rowsecurity=false;"
fi

POLICY_COUNT=$(q "select count(*) from pg_policies where schemaname='public';")
if [[ "$POLICY_COUNT" =~ ^[0-9]+$ ]] && [ "$POLICY_COUNT" -gt 300 ]; then
  pass "$POLICY_COUNT RLS policies present (local dev baseline: 360)"
else
  fail "only $POLICY_COUNT RLS policies found - local dev baseline is 360; a materially lower count means policy migrations did not fully apply"
fi

ZERO_POLICY_TABLES=$(q "select string_agg(t.tablename, ', ') from pg_tables t where t.schemaname='public' and t.rowsecurity=true and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t.tablename);")
info "tables with RLS enabled but zero policies (expected - these are gated by SECURITY DEFINER RPCs instead, not a gap): ${ZERO_POLICY_TABLES:-none}"

echo ""
echo "=== 6. auth.sessions dependency ==="
FUNCS=$(q "select string_agg(proname, ', ') from pg_proc where proname in ('get_my_auth_sessions','revoke_my_auth_session');")
if [[ "$FUNCS" == *"get_my_auth_sessions"* && "$FUNCS" == *"revoke_my_auth_session"* ]]; then
  pass "get_my_auth_sessions() and revoke_my_auth_session() both exist"
  info "these are the only functions in the whole migration set that touch auth.sessions directly (not just auth.uid()) - confirm the migration-runner's role actually had grants to create them without error, which passing this check already implies"
else
  fail "one or both of get_my_auth_sessions()/revoke_my_auth_session() is missing - found: ${FUNCS:-none}"
fi

echo ""
echo "=== 7. HQ admin bootstrap ==="
HQ_COUNT=$(q "select count(*) from public.hq_admins;")
if [[ "$HQ_COUNT" =~ ^[0-9]+$ ]] && [ "$HQ_COUNT" -gt 0 ]; then
  pass "$HQ_COUNT hq_admins row(s) exist - /admin/* is reachable"
else
  info "hq_admins is empty (expected before manual bootstrap) - /admin/* is NOT reachable by anyone yet. This is not a script failure: it requires a real auth.users account to exist first, which this script cannot create. See docs/supabase-sandbox-readiness-audit.md Sec.4 for the exact insert statement."
fi

echo ""
echo "======================================"
if [ "$FAILED" -eq 0 ]; then
  echo "RESULT: all required checks passed."
else
  echo "RESULT: one or more required checks FAILED - see FAIL lines above."
fi
exit $FAILED
