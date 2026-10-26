#!/usr/bin/env bash
# Read-only inspection of live Sandbox booking/availability definitions,
# plus the fixed Timeline P1a migration preflight at the end of this file.
# Usage: bash scripts/inspect-sandbox-booking-functions.sh "$SANDBOX_DB_URL"
# The connection string is an argument only. This script never prints it.
set -euo pipefail

CONN="${1:-${SANDBOX_DB_URL:-}}"
if [ -z "$CONN" ]; then
  echo "usage: $0 <SANDBOX_DB_URL>" >&2
  exit 1
fi

psql "$CONN" -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
\echo === schema_migrations 041/042/043 ===
select version, name
from supabase_migrations.schema_migrations
where version in ('20261404100000', '20261404200000', '20261404300000')
order by version;

\echo === events.booked_at ===
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'events' and column_name = 'booked_at';

\echo === venues availability flags ===
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'venues'
  and column_name in ('allow_tours_during_booked_events', 'hold_blocks_availability')
order by column_name;

\echo === planning client_id / event_id ===
select table_name, column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'event_tasks', 'event_playbook_applications', 'timeline_entries',
    'timeline_sections', 'floor_plans', 'event_orders', 'event_vendor_assignments'
  )
  and column_name in ('client_id', 'event_id')
order by table_name, column_name;

\echo === owner-check constraints ===
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid)
from pg_constraint
where conname ~ 'owner_check'
order by 1, 2;

\echo === availability / book triggers ===
select tgrelid::regclass as table_name, tgname, pg_get_triggerdef(oid)
from pg_trigger
where not tgisinternal
  and (tgname like '%availability%' or tgname like '%vendor_assigned_on_book%')
order by 1, 2;

\echo === function bodies ===
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'book_relationship',
    'events_enforce_availability',
    'evaluate_event_availability',
    'assert_event_availability'
  )
order by p.proname;

\echo === relevant RLS ===
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in (
  'events', 'event_tasks', 'event_playbook_applications', 'timeline_entries',
  'timeline_sections', 'floor_plans', 'event_orders', 'event_vendor_assignments',
  'date_holds', 'venues'
)
order by tablename, policyname;

-- Fixed Timeline P1a preflight. These statements are reviewed source, not caller input.
\echo === timeline p1a schema_migrations 236/237 ===
select version, name
from supabase_migrations.schema_migrations
where version in ('20261423600000', '20261423700000')
order by version;

\echo === timeline p1a timeline_entries timing columns ===
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'timeline_entries'
  and column_name like 'timing_%'
order by 1;

\echo === timeline p1a get_venue_export identity ===
do $p1a$
declare
  n integer;
begin
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'get_venue_export';
  if n is distinct from 1 then
    raise exception 'timeline p1a preflight: expected exactly one public.get_venue_export, found %', n;
  end if;
end
$p1a$;

\echo === timeline p1a get_venue_export lists timing_day_intent ===
select
  (position('timing_day_intent' in pg_get_functiondef(p.oid)) > 0) as lists_timing_day_intent
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_venue_export';
SQL
