-- ============================================================================
-- Migration Center — the historical-import engine (docs/migration-cutover-
-- architecture.md §B). Sits above the existing import_batches/ImportWizard
-- foundation (20261139000000 + white-glove work) — extends it, does not
-- replace it. Every self-service import that doesn't go through this new
-- flow keeps working completely unchanged; migration_session_id is nullable
-- everywhere and simply null for those.
--
-- Four new tables:
--  1. source_profiles      — capability registry (mirrors lead_sources'
--                             own reference-table pattern, not a CHECK enum).
--  2. migration_sessions   — the resumable session/orchestration layer.
--  3. migration_session_documents — join table linking a session to its
--                             uploaded artifacts, stored as ordinary
--                             venue-level `documents` rows (the already-
--                             supported all-entity-FK-null pattern), not a
--                             new FK on `documents` itself.
--  4. migration_records    — one row per source record: raw_payload →
--                             normalized_payload → dedupe/validation status
--                             → created_entity_id. The explicit boundary
--                             between a source file and a real product
--                             entity; never a second representation of a
--                             client/lead/vendor.
--
-- Per this codebase's own established (and repeatedly-learned) lesson: RLS
-- + explicit service_role GRANT in the same migration, every time.
-- ============================================================================


-- ── 1. source_profiles — capability registry ────────────────────────────────
-- A source selection must never imply more than this row honestly claims.
-- Every row starts has_direct_connection = false; flip it only once a real
-- API/OAuth historical-retrieval path genuinely exists for that source.

create table public.source_profiles (
  key                      text primary key,
  display_name             text not null,
  has_direct_connection    boolean not null default false,
  forward_only             boolean not null default false,
  export_assisted          boolean not null default true,
  white_glove_recommended  boolean not null default false,
  supported_file_types     text[] not null default '{}',
  has_known_parser         boolean not null default false,
  historical_limitations   text,
  is_enabled               boolean not null default true,
  created_at               timestamptz not null default now()
);

comment on table public.source_profiles is
  'Capability registry for migration sources. UI copy describing a source must be generated from these flags, never hand-written per source — this is what keeps a source selection from ever implying a live connection that does not exist.';

insert into public.source_profiles
  (key, display_name, has_direct_connection, forward_only, export_assisted, white_glove_recommended, supported_file_types, has_known_parser, historical_limitations)
values
  ('generic_csv', 'CSV / Spreadsheet', false, false, true, false, '{csv,xlsx,xls}', true, null),
  ('the_knot', 'The Knot', false, false, true, false, '{csv,xlsx,pdf,docx}',
    'No public developer API or documented bulk export exists. Coverage depends on whatever the venue can manually export or copy from their account. New inquiries can already be forwarded by email (a separate, existing capability) — this profile covers historical data only.'),
  ('weddingwire', 'WeddingWire', false, false, true, false, '{csv,xlsx,pdf,docx}',
    'Same platform family and same limitation as The Knot — no public API or confirmed bulk export.'),
  ('planning_pod', 'Planning Pod', false, false, true, true, '{csv,xlsx,pdf,docx}',
    'No public developer API found. Zapier integration exists on Planning Pod''s side but is unverified for bulk historical export. No adapter built yet — recognized generically until one exists.'),
  ('honeybook', 'HoneyBook', false, true, true, true, '{csv,xlsx,pdf,docx}',
    'No public developer API. Official integration path is Zapier, with real "New Inquiry Created"/"New Client Created"/"Project Booked" triggers — but those are forward-only and cannot backfill history. Historical data is upload-only.'),
  ('weven_legacy', 'Weven (legacy)', false, false, true, true, '{csv,xlsx,pdf,docx}',
    'Weven was acquired by The Knot Worldwide in 2022 and no longer operates independently — no live account exists to connect to. Coverage depends entirely on whatever export or file a venue happened to retain from before the acquisition.')
on conflict (key) do nothing;

alter table public.source_profiles enable row level security;
create policy source_profiles_read on public.source_profiles for select using (true);
grant select on public.source_profiles to authenticated, anon, service_role;


-- ── 2. migration_sessions — the resumable orchestration layer ──────────────

create table public.migration_sessions (
  id                uuid primary key default gen_random_uuid(),
  venue_id          uuid not null references public.venues (id) on delete cascade,
  source_key        text not null references public.source_profiles (key),
  status            text not null default 'uploaded' check (status in (
                       'uploaded', 'recognizing', 'mapping', 'validating',
                       'ready_for_review', 'committing', 'committed',
                       'partially_committed', 'failed', 'abandoned'
                     )),
  created_by_type   text not null default 'venue' check (created_by_type in ('venue', 'hq_staff')),
  created_by        uuid,
  -- Onboarding Engagement linkage (Hospitality Success Platform §2.2a) —
  -- reused as-is, not reinvented. Null for a pure self-service venue that
  -- has no HQ engagement at all.
  engagement_id     uuid references public.venue_onboarding_engagements (id) on delete set null,
  resumable         boolean not null default true,
  started_at        timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index migration_sessions_venue on public.migration_sessions (venue_id, created_at desc);
create index migration_sessions_engagement on public.migration_sessions (engagement_id) where engagement_id is not null;

alter table public.migration_sessions enable row level security;

create policy migration_sessions_venue_all on public.migration_sessions
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- Additive HQ read/write, mirroring the already-proven *_hq_select pattern
-- (Postgres OR's permissive policies — a venue user's own policy above is
-- untouched; an HQ admin additionally passes because is_hq_admin() is true).
create policy migration_sessions_hq_all on public.migration_sessions
  for all using (public.is_hq_admin())
  with check (public.is_hq_admin());

grant select, insert, update on public.migration_sessions to authenticated;
grant select, insert, update on public.migration_sessions to service_role;


-- ── 3. migration_session_documents — join to existing `documents` rows ─────
-- Uploaded artifacts are ordinary venue-level `documents` rows (the
-- already-supported all-four-entity-FKs-null pattern), tagged
-- tags @> ARRAY['migration_artifact']. This join table is what links them
-- to a session, so `documents` itself gains no new narrow-purpose FK.

create table public.migration_session_documents (
  session_id   uuid not null references public.migration_sessions (id) on delete cascade,
  document_id  uuid not null references public.documents (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (session_id, document_id)
);

alter table public.migration_session_documents enable row level security;

create policy migration_session_documents_venue_all on public.migration_session_documents
  for all using (
    exists (select 1 from public.migration_sessions s where s.id = session_id and s.venue_id = public.current_user_venue_id())
  )
  with check (
    exists (select 1 from public.migration_sessions s where s.id = session_id and s.venue_id = public.current_user_venue_id())
  );

create policy migration_session_documents_hq_all on public.migration_session_documents
  for all using (public.is_hq_admin())
  with check (public.is_hq_admin());

grant select, insert, update, delete on public.migration_session_documents to authenticated;
grant select, insert, update, delete on public.migration_session_documents to service_role;


-- ── 4. migration_records — source-specific parser → normalized record →
--       validation/dedupe → canonical entity. A staging/audit record, never
--       a second representation of a client/lead/vendor/event/payment. ────

create table public.migration_records (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.migration_sessions (id) on delete cascade,
  venue_id             uuid not null references public.venues (id) on delete cascade,
  source_row_ref       text,
  raw_payload          jsonb not null default '{}'::jsonb,
  target_entity_type   text not null check (target_entity_type in ('client', 'lead', 'vendor', 'event', 'payment', 'document')),
  normalized_payload    jsonb,
  status               text not null default 'parsed' check (status in (
                          'parsed', 'normalized', 'validated',
                          'duplicate_exact', 'duplicate_likely', 'conflict',
                          'needs_review', 'approved', 'rejected', 'committed', 'skipped'
                        )),
  match_type           text not null default 'none' check (match_type in ('none', 'exact', 'likely')),
  matched_entity_id    uuid,
  match_confidence      numeric,
  conflict_fields       jsonb,
  validation_errors     jsonb,
  created_entity_id     uuid,
  reviewed_by            uuid,
  reviewed_at            timestamptz,
  committed_at           timestamptz,
  created_at             timestamptz not null default now()
);

comment on column public.migration_records.created_entity_id is
  'Set only once actually committed via the existing, unmodified canonical create function (createClientCore/ingestLead/etc). This being non-null is itself the resume checkpoint for an interrupted session — no separate cursor concept needed.';

create index migration_records_session on public.migration_records (session_id, status);
create index migration_records_venue on public.migration_records (venue_id, created_at desc);
-- Repeat-import short-circuit (§B.4): find a prior committed record for this
-- venue+source with the same source-supplied record id, before falling back
-- to name/email matching. Indexed on normalized_payload, not raw_payload —
-- every adapter agrees to populate normalized_payload.sourceId in the same
-- place when a source record has a stable id, whereas raw_payload's actual
-- id field name varies unpredictably per source. Partial index: most rows
-- won't have one, and this must stay cheap when they don't.
create index migration_records_source_id on public.migration_records (venue_id, (normalized_payload ->> 'sourceId'))
  where normalized_payload ? 'sourceId' and status = 'committed';

alter table public.migration_records enable row level security;

create policy migration_records_venue_all on public.migration_records
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy migration_records_hq_all on public.migration_records
  for all using (public.is_hq_admin())
  with check (public.is_hq_admin());

grant select, insert, update on public.migration_records to authenticated;
grant select, insert, update on public.migration_records to service_role;


-- ── 5. import_batches — one additive nullable link back to its session ─────
-- A self-service import that never goes through Migration Center leaves
-- this null, exactly as before; no existing behavior changes.

alter table public.import_batches
  add column if not exists migration_session_id uuid references public.migration_sessions (id) on delete set null;

create index if not exists import_batches_migration_session
  on public.import_batches (migration_session_id) where migration_session_id is not null;

notify pgrst, 'reload schema';
