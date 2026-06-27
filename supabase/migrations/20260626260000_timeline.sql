-- ============================================================================
-- Sprint 12 — Day-of Timeline
-- "A venue coordinator should be able to open an event and understand
--  exactly how the day will unfold."
--
-- timeline_entries is the single table. Entries are ordered by entry_time
-- (primary) then sort_order (secondary, for same-time groups) then created_at.
-- Templates are hardcoded in the application layer; no template table needed.
-- ============================================================================

create table public.timeline_entries (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,

  title       text not null check (char_length(trim(title)) > 0),
  description text,

  -- Nullable: entries can exist without a fixed time (e.g., reminders)
  entry_time  time,

  -- Secondary sort within the same entry_time (for future drag-and-drop;
  -- Sprint 12 uses up/down arrow buttons within same-time groups).
  sort_order  smallint not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Composite index mirrors the ORDER BY used in queries
create index timeline_entries_event
  on public.timeline_entries (event_id, entry_time asc nulls last, sort_order, created_at);

create trigger timeline_entries_updated_at
  before update on public.timeline_entries
  for each row execute function public.set_updated_at();

alter table public.timeline_entries enable row level security;

create policy timeline_entries_all on public.timeline_entries
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.timeline_entries to authenticated;

notify pgrst, 'reload schema';
