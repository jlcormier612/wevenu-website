#!/bin/bash
set -o pipefail

cd "/Users/jensmac/Library/Mobile Documents/com~apple~CloudDocs/Wevenu Website/wevenu-website" || { echo "Could not cd to the repo root — check the path."; exit 1; }

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found on PATH. Install it first: brew install libpq && brew link --force libpq"
  exit 1
fi

# Enter the Sandbox DB password when prompted — never put it in this file or in chat.
read -s -p "Sandbox DB password: " PGPASSWORD
echo
export PGPASSWORD
# No password embedded in the URL itself — psql reads it from PGPASSWORD, which keeps
# it out of `ps` output while the command runs.
CONN="postgresql://postgres.wvpsldwwjqdannqasrdf@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# ---------------------------------------------------------------------------
# Recovery bootstrap (one-time, idempotent): the hosted Sandbox project has no
# supabase_migrations schema at all — that schema/tables only get created by
# the Supabase CLI's own push/reset flow, which this repo deliberately does
# not use (see docs/supabase-sandbox-setup-runbook.md §3 on why). Matches the
# local project's real schema exactly (verified via \d+ before writing this):
#   schema_migrations(version text primary key, statements text[], name text)
#   seed_files(path text primary key, hash text not null)
# 20260626090000_venue_foundation.sql already ran successfully in the prior
# attempt (its SQL, not just its tracking row) — this records that fact.
# The loop below skips any file whose exact (version, name) pair is already
# tracked, which covers this one along with everything else already applied.
# ---------------------------------------------------------------------------
psql "$CONN" -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

create table if not exists supabase_migrations.seed_files (
  path text primary key,
  hash text not null
);

insert into supabase_migrations.schema_migrations (version, name)
values ('20260626090000', 'venue_foundation')
on conflict (version) do nothing;
SQL
if [ $? -ne 0 ]; then
  echo "STOPPED — could not create the migration-tracking schema/tables. Nothing else was attempted."
  unset PGPASSWORD
  exit 1
fi
echo "Tracking schema ready; 20260626090000_venue_foundation.sql recorded as already applied."

# The known timestamp-collision groups — used only to label an expected bookkeeping
# collapse clearly, vs. flagging an unexpected one that would need investigating.
# 20261176000000 is a 3-way collision (studio_canonical_color_story_clear.sql,
# task_reminders_service_role_grant.sql, vendor_availability_event_source.sql),
# not a simple pair like the other four — the loop below still handles it
# correctly (every file's SQL runs regardless; only the second and third
# insert into schema_migrations collapse to the expected-collision branch).
# 20261298000000 is two unrelated files sharing a timestamp on disk
# (coordinator_tour_availability_read, reminder_cadence_and_venue_email).
# 20261303000000 is a different kind of collision: not two files sharing
# a timestamp on disk today, but the current on-disk file at that version
# (migration_records_claim_columns) colliding with an OLDER already-applied
# migration's tracked row (uploads_bucket_venue_scoped_write) that was
# later renumbered to 20261299000000 in this repo's history. schema_migrations
# still holds the old row under the old number, so the same "only one row
# per version" collapse applies here too — diagnosed 2026-08-25 via direct
# information_schema inspection, not assumed.
KNOWN_COLLISIONS="20261175000000 20261176000000 20261177000000 20261222000000 20261298000000 20261303000000"

for f in $(ls supabase/migrations/*.sql | sort); do
  version=$(basename "$f" | sed -E 's/^([0-9]+)_.*/\1/')
  name=$(basename "$f" | sed -E 's/^[0-9]+_(.*)\.sql$/\1/')

  # Skip only if THIS EXACT file (version AND name) is already recorded —
  # not just version alone. version is only a primary key because two
  # different, unrelated migrations can legitimately share a timestamp
  # (a real, recurring pattern in this repo's history — see
  # KNOWN_COLLISIONS below, and 20261303000000 specifically: that version
  # is tracked under the name of a DIFFERENT migration that was later
  # renumbered to 20261299000000, while this repo's current
  # 20261303000000 file, migration_records_claim_columns, has never
  # actually run). Checking version alone would silently skip a genuinely
  # unapplied migration any time its timestamp happens to collide with an
  # unrelated one that already ran. Checking version+name together only
  # skips a file that matches the exact row already on record.
  already_tracked=$(psql "$CONN" -v ON_ERROR_STOP=1 -t -A -c \
    "select 1 from supabase_migrations.schema_migrations where version = '$version' and name = '$name';")
  if [ -n "$already_tracked" ]; then
    echo "Skipping $(basename "$f") — version $version, name '$name' already tracked."
    continue
  fi

  echo "Applying $(basename "$f")..."
  psql "$CONN" -v ON_ERROR_STOP=1 -f "$f"
  if [ $? -ne 0 ]; then
    echo "STOPPED at $(basename "$f") — fix the error before continuing, do not skip ahead."
    unset PGPASSWORD
    exit 1
  fi

  insert_result=$(psql "$CONN" -v ON_ERROR_STOP=1 -t -A -c \
    "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name') on conflict (version) do nothing returning version;")
  if [ $? -ne 0 ]; then
    echo "STOPPED — bookkeeping insert failed for $(basename "$f") (version $version)."
    echo "The migration's own SQL already applied successfully above; only the tracking-table write failed. Investigate before continuing — do not re-run blindly."
    unset PGPASSWORD
    exit 1
  fi

  if [ -z "$insert_result" ]; then
    if echo "$KNOWN_COLLISIONS" | grep -qw "$version"; then
      echo "  (expected: version $version already tracked under a different name — one of the known collision groups. $(basename "$f")'s SQL was fully applied above; schema_migrations can only hold one row per version.)"
    else
      echo "  !! UNEXPECTED: version $version was already tracked under a different name, and this timestamp is not one of the known collision groups. $(basename "$f")'s SQL was still applied above, but this bookkeeping collision needs investigating — it may mean a new, previously-unseen collision exists."
    fi
  fi
done
unset PGPASSWORD
echo "Done. Applied $(ls supabase/migrations/*.sql | wc -l | tr -d ' ') migration files if no STOPPED line appeared above."
