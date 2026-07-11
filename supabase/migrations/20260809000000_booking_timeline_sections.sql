-- ============================================================================
-- Booking Timeline — sections, notes, links, and attachments
--
-- Extends the existing per-event timeline_entries table (Sprint 12 — Day-of
-- Timeline). Sections are per-booking groupings (Getting Ready, Ceremony,
-- Cocktail Hour, ...), entries keep their existing columns and gain a
-- nullable section_id (null = unsectioned) plus a genuinely separate notes
-- column — event_tasks already keeps description and notes as two distinct
-- columns; timeline_entries follows the same convention rather than
-- overloading description.
-- ============================================================================

create table public.timeline_sections (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,

  name        text not null check (char_length(trim(name)) > 0),
  sort_order  smallint not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index timeline_sections_event on public.timeline_sections (event_id, sort_order);

create trigger timeline_sections_updated_at
  before update on public.timeline_sections
  for each row execute function public.set_updated_at();

alter table public.timeline_entries
  add column section_id uuid references public.timeline_sections (id) on delete set null,
  add column notes      text;

create index timeline_entries_section on public.timeline_entries (section_id);

-- ---- Links (raw URL + label, one row per link) --------------------------------

create table public.timeline_entry_links (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            uuid not null references public.venues (id) on delete cascade,
  timeline_entry_id   uuid not null references public.timeline_entries (id) on delete cascade,

  url         text not null check (char_length(trim(url)) > 0),
  label       text,
  sort_order  smallint not null default 0,

  created_at  timestamptz not null default now()
);

create index timeline_entry_links_entry on public.timeline_entry_links (timeline_entry_id);

-- ---- Attachments (uploaded / existing venue documents, document-only — links
-- are their own field above, so this table never stores a raw URL) -------------

create table public.timeline_entry_attachments (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            uuid not null references public.venues (id) on delete cascade,
  timeline_entry_id   uuid not null references public.timeline_entries (id) on delete cascade,
  document_id         uuid not null references public.documents (id) on delete cascade,

  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index timeline_entry_attachments_entry on public.timeline_entry_attachments (timeline_entry_id);

-- ---- RLS ---------------------------------------------------------------------
alter table public.timeline_sections           enable row level security;
alter table public.timeline_entry_links        enable row level security;
alter table public.timeline_entry_attachments  enable row level security;

create policy timeline_sections_all on public.timeline_sections
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy timeline_entry_links_all on public.timeline_entry_links
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy timeline_entry_attachments_all on public.timeline_entry_attachments
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.timeline_sections          to authenticated;
grant select, insert, update, delete on public.timeline_entry_links       to authenticated;
grant select, insert, update, delete on public.timeline_entry_attachments to authenticated;

notify pgrst, 'reload schema';
