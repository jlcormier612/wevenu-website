#!/bin/bash
set -o pipefail

cd "/Users/jensmac/Library/Mobile Documents/com~apple~CloudDocs/Wevenu Website/wevenu-website" || { echo "Could not cd to the repo root — check the path."; exit 1; }

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found on PATH. Install it first: brew install libpq && brew link --force libpq"
  exit 1
fi

# Read-only verification pass — every statement below is a SELECT. Nothing is
# created, altered, inserted, or deleted.

read -s -p "Sandbox DB password: " PGPASSWORD
echo
export PGPASSWORD
CONN="postgresql://postgres.wvpsldwwjqdannqasrdf@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

psql "$CONN" -v ON_ERROR_STOP=1 <<'SQL'
\echo '===== A. Migration/schema completeness ====='
\echo '-- schema_migrations row count (expect 442) --'
select count(*) from supabase_migrations.schema_migrations;
\echo '-- public schema table count (informational, compare to local dev) --'
select count(*) from information_schema.tables where table_schema = 'public';

\echo ''
\echo '===== B. Extensions / gen_random_uuid() ====='
select extname from pg_extension where extname in ('pg_trgm','pgcrypto') order by extname;
select gen_random_uuid() as gen_random_uuid_works;

\echo ''
\echo '===== C. RLS policy count (expect 360) ====='
select count(*) from pg_policies where schemaname = 'public';

\echo ''
\echo '===== D. Function count (expect 397) ====='
select count(*) from information_schema.routines where routine_schema = 'public' and routine_type = 'FUNCTION';

\echo ''
\echo '===== E. Storage buckets (expect 11, public/private as documented) ====='
select id, public from storage.buckets order by id;

\echo ''
\echo '===== F. lead_sources (expect 14) ====='
select count(*) from public.lead_sources;

\echo ''
\echo '===== G. Wedding-website design catalog ====='
\echo '-- collections (expect 10) --'
select count(*) from public.collections;
\echo '-- color_stories (expect 38) --'
select count(*) from public.color_stories;
\echo '-- typography_styles (expect 10) --'
select count(*) from public.typography_styles;
\echo '-- photo_styles (expect 10) --'
select count(*) from public.photo_styles;

\echo ''
\echo '===== H. legal_documents active rows (expect 7 document_types, 1 each) ====='
select document_type, count(*) from public.legal_documents where is_active = true group by document_type order by document_type;

\echo ''
\echo '===== I. Collision-group SQL-level verification (did each distinct file land, not just its shared tracking row) ====='

\echo '-- [1/9] 20261175000000_venue_account_access_lock.sql: 3 columns + 1 index on public.venues --'
select column_name from information_schema.columns
  where table_schema='public' and table_name='venues'
  and column_name in ('access_disabled','account_status','saas_stripe_customer_id')
  order by column_name;
select indexname from pg_indexes where schemaname='public' and indexname='venues_access_disabled_idx';

\echo '-- [2/9] 20261175000000_wedding_website_coastal_art_direction_pass2.sql: data-only fix, no schema object to check (see note below) --'
select 'no schema object expected for this file — data-only UPDATE/DELETE against seed fixture content' as note;

\echo '-- [3/9] 20261176000000_studio_canonical_color_story_clear.sql: function exists --'
select routine_name from information_schema.routines where routine_schema='public' and routine_name='update_my_website';

\echo '-- [4/9] 20261176000000_task_reminders_service_role_grant.sql: service_role grant --'
select has_table_privilege('service_role', 'public.task_reminders', 'INSERT') as service_role_can_insert_task_reminders;

\echo '-- [5/9] 20261176000000_vendor_availability_event_source.sql: 2 unique indexes + grant --'
select indexname from pg_indexes where schemaname='public' and indexname in
  ('vendor_availability_manual_date_uidx','vendor_availability_event_source_uidx') order by indexname;
select has_table_privilege('service_role', 'public.vendor_availability', 'INSERT') as service_role_can_insert_vendor_availability;

\echo '-- [6/9] 20261177000000_lifecycle_engine_service_role_grants.sql: representative grants --'
select has_table_privilege('service_role', 'public.timeline_entries', 'SELECT') as service_role_can_select_timeline_entries,
       has_table_privilege('service_role', 'public.venue_staff', 'SELECT') as service_role_can_select_venue_staff;

\echo '-- [7/9] 20261177000000_vendor_documents.sql: table + function --'
select table_name from information_schema.tables where table_schema='public' and table_name='vendor_library_documents';
select routine_name from information_schema.routines where routine_schema='public' and routine_name='get_vendor_library_documents';

\echo '-- [8/9] 20261222000000_document_workspace.sql: 2 tables + function --'
select table_name from information_schema.tables where table_schema='public'
  and table_name in ('document_workspace_pins','document_workspace_interactions') order by table_name;
select routine_name from information_schema.routines where routine_schema='public' and routine_name='get_venue_documents';

\echo '-- [9/9] 20261222000000_legal_documents_vsa_sentence_case_disclaimers.sql: specific version string --'
select document_type, version from public.legal_documents
  where document_type in ('terms_of_service','venue_terms_of_service') and is_active = true
  order by document_type;

\echo ''
\echo '===== J. Manager Permissions security migrations (TR-G5/G6/G7) — do NOT trust these as enforced without this query returning all four rows ====='
\echo '-- tracking rows present --'
select version, name from supabase_migrations.schema_migrations
  where version in ('20260716000000','20261001000000','20261002000000','20261003000000')
  order by version;
\echo '-- TR-G1 prerequisite: current_user_role()/current_user_venue_id() exist --'
select routine_name from information_schema.routines where routine_schema='public'
  and routine_name in ('current_user_role','current_user_venue_id') order by routine_name;
\echo '-- TR-G5: refund RLS backstop actually present on payment_line_items UPDATE --'
select policyname from pg_policies where schemaname='public' and tablename='payment_line_items' and cmd='UPDATE';
\echo '-- TR-G6: 40 RESTRICTIVE delete-gate policies present (expect 40) --'
select count(*) from pg_policies where schemaname='public' and cmd='DELETE' and policyname like '%_delete_gate';
\echo '-- TR-G7: invite identity check present on accept_team_invitation --'
select routine_name from information_schema.routines where routine_schema='public' and routine_name='accept_team_invitation';
select indexname from pg_indexes where schemaname='public' and indexname='venue_staff_one_active_role_per_user';

\echo ''
\echo '===== K. This reconciliation''s new migrations ====='
\echo '-- tracking rows present --'
select version, name from supabase_migrations.schema_migrations
  where version in ('20261298000000','20261307000000','20261308000000')
  order by version;
\echo '-- 20261298000000 collision: BOTH files'' schema objects present, not just one tracking row --'
select routine_name from information_schema.routines where routine_schema='public' and routine_name='get_coordinator_tour_availability';
select table_name from information_schema.tables where table_schema='public' and table_name='venue_reminder_cadence';
select column_name from information_schema.columns where table_schema='public' and table_name='task_reminders' and column_name='after_due_recur_interval_days';
\echo '-- 20261307000000: plusOneName now selected by _build_seating_json (source-text check, not a live call) --'
select prosrc ~* 'plus_one_name' as build_seating_json_selects_plus_one_name
  from pg_proc where proname = '_build_seating_json';
\echo '-- 20261308000000: no client_key_dates row left that duplicates an agreeing rehearsal_date --'
select count(*) from public.client_key_dates ckd join public.clients c on c.id = ckd.client_id
  where c.rehearsal_date is not null and ckd.date = c.rehearsal_date and ckd.label ~* '^rehearsal\b';
SQL
if [ $? -ne 0 ]; then
  echo "One or more verification queries failed to run — paste the full output back, including which query errored."
  unset PGPASSWORD
  exit 1
fi
unset PGPASSWORD
echo "Verification queries complete — paste the full output back."
