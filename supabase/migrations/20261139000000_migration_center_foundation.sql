-- ============================================================================
-- Hospitality Success Platform — Migration Center Phase 2: batch tracking +
-- one-platform-two-audiences foundation.
--
-- Per docs/hospitality-success-platform-implementation-plan.md §2:
--  1. import_batches — a real identity for "everything imported together,"
--     unlocking both a real import history and conservative, window-limited
--     rollback (batch delete, only while nothing downstream has touched the
--     rows yet).
--  2. import_batch_id stamped on every importable entity table.
--  3. Both self-service (venue session) and white-glove (HQ staff, service_role
--     + explicit venue_id) write through the exact same repository insert
--     functions — decided 2026-07-22, "one migration platform serving two
--     audiences, not two different products." service_role already bypasses
--     RLS (it needs GRANTs, not new policies) — confirmed here rather than
--     assumed, per this engagement's own repeatedly-learned lesson about
--     missing service_role grants.
-- ============================================================================

create table public.import_batches (
  id                uuid primary key default gen_random_uuid(),
  venue_id          uuid not null references public.venues (id) on delete cascade,
  entity_type       text not null check (entity_type in ('couples', 'leads', 'vendors', 'inventory', 'packages')),
  source_label      text,
  imported_by_type  text not null default 'venue' check (imported_by_type in ('venue', 'hq_staff')),
  imported_by       uuid,
  row_count         integer not null default 0,
  imported_count    integer not null default 0,
  skipped_count     integer not null default 0,
  error_count       integer not null default 0,
  rolled_back_at    timestamptz,
  -- The latest updated_at across every row this batch stamped, captured
  -- immediately after stamping. Rollback's "has anything touched this row
  -- since import" check compares against this, not created_at — stamping
  -- import_batch_id is itself an UPDATE, which fires each table's own
  -- updated_at trigger, so created_at and updated_at differ on every row
  -- from the moment of import, not just after a real later edit. Found live
  -- during verification, not assumed.
  stamped_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index import_batches_venue on public.import_batches (venue_id, created_at desc);

alter table public.import_batches enable row level security;
create policy import_batches_all on public.import_batches
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update on public.import_batches to authenticated;
grant select, insert, update on public.import_batches to service_role;

-- ── import_batch_id on every importable entity table ────────────────────────

alter table public.clients         add column import_batch_id uuid references public.import_batches (id) on delete set null;
alter table public.leads           add column import_batch_id uuid references public.import_batches (id) on delete set null;
alter table public.vendors         add column import_batch_id uuid references public.import_batches (id) on delete set null;
alter table public.inventory_items add column import_batch_id uuid references public.import_batches (id) on delete set null;
alter table public.packages        add column import_batch_id uuid references public.import_batches (id) on delete set null;

create index clients_import_batch         on public.clients (import_batch_id) where import_batch_id is not null;
create index leads_import_batch           on public.leads (import_batch_id) where import_batch_id is not null;
create index vendors_import_batch         on public.vendors (import_batch_id) where import_batch_id is not null;
create index inventory_items_import_batch on public.inventory_items (import_batch_id) where import_batch_id is not null;
create index packages_import_batch        on public.packages (import_batch_id) where import_batch_id is not null;

-- ── service_role grants — the white-glove path's real requirement ──────────
-- White-glove import writes via createAdminClient() (service_role, no user
-- session) calling the exact same repo.insertX() functions self-service
-- already uses, with an explicit venue_id instead of one resolved from
-- session. Confirmed live (not assumed) which of these five tables were
-- already missing a service_role grant before adding import_batches.

grant select, insert, update on public.clients         to service_role;
grant select, insert, update on public.vendors         to service_role;
grant select, insert, update on public.inventory_items to service_role;
grant select, insert, update on public.packages        to service_role;
-- leads/inventory_categories already granted to service_role by earlier
-- migrations (QuickBooks/Facebook Lead Ads work) — re-granting is harmless
-- and documents the dependency explicitly rather than relying on a grant
-- added for an unrelated reason.
grant select, insert, update on public.leads               to service_role;
grant select, insert, update on public.inventory_categories to service_role;

notify pgrst, 'reload schema';
