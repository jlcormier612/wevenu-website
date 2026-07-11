-- ============================================================================
-- Timeline Templates — Template Library
--
-- Same two-layer split this codebase already uses for Planning Templates
-- (playbook_templates/playbook_tasks vs event_tasks): a reusable template
-- layer here, fully separate from timeline_entries (the per-booking, per-
-- event Day-of Timeline — untouched by this migration). Template items use
-- minutes_offset (relative to an event's start time) instead of an absolute
-- entry_time, because a template isn't tied to any one event's clock yet —
-- the same relative-time concept already hardcoded in lib/timeline/constants
-- .ts's TIMELINE_TEMPLATES, now made venue-editable and persisted.
-- ============================================================================

create table public.timeline_templates (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,

  name        text not null check (char_length(trim(name)) > 0),
  event_type  text,
  space_id    uuid references public.venue_spaces (id) on delete set null,
  is_default  boolean not null default false,
  is_archived boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index timeline_templates_venue on public.timeline_templates (venue_id);

-- One default per (event_type, space) combination — coalesced so the two
-- optional dimensions ("all event types", "no specific space") each behave
-- as one real group instead of Postgres treating every NULL as distinct.
create unique index timeline_templates_default
  on public.timeline_templates (venue_id, coalesce(event_type, ''), coalesce(space_id::text, ''))
  where is_default = true;

create trigger timeline_templates_updated_at
  before update on public.timeline_templates
  for each row execute function public.set_updated_at();

create table public.timeline_template_items (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  template_id  uuid not null references public.timeline_templates (id) on delete cascade,

  title          text not null check (char_length(trim(title)) > 0),
  description    text,
  notes          text,
  time_of_day    time,
  minutes_offset int,
  audiences      text[] not null default '{internal}' check (audiences <@ '{internal,couple,guest,vendor,public}'::text[]),
  sort_order     smallint not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index timeline_template_items_template on public.timeline_template_items (template_id, sort_order);

create trigger timeline_template_items_updated_at
  before update on public.timeline_template_items
  for each row execute function public.set_updated_at();

-- ---- RLS ---------------------------------------------------------------------
alter table public.timeline_templates      enable row level security;
alter table public.timeline_template_items enable row level security;

create policy timeline_templates_all on public.timeline_templates
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy timeline_template_items_all on public.timeline_template_items
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.timeline_templates      to authenticated;
grant select, insert, update, delete on public.timeline_template_items to authenticated;

notify pgrst, 'reload schema';
