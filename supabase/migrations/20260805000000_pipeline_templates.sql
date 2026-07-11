-- ============================================================================
-- Pipeline Templates — Phase 1 (Pipeline Template System)
--
-- docs/booking-journey-design.md's two-layer model: a small, fixed canonical
-- stage vocabulary (never venue-editable) drives reporting; venue-facing
-- stages are fully customizable and each map to exactly one canonical
-- stage. This migration builds the reusable template/stage editor only —
-- no connection to leads.* anywhere. Leads keep using their existing fixed
-- status column untouched; wiring templates to real leads is a later phase.
-- ============================================================================

create table public.pipeline_templates (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,

  name        text not null check (char_length(trim(name)) > 0),
  description text,
  is_active   boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index pipeline_templates_venue on public.pipeline_templates (venue_id);

create trigger pipeline_templates_updated_at
  before update on public.pipeline_templates
  for each row execute function public.set_updated_at();

create table public.pipeline_stages (
  id                    uuid primary key default gen_random_uuid(),
  venue_id              uuid not null references public.venues (id) on delete cascade,
  pipeline_template_id  uuid not null references public.pipeline_templates (id) on delete cascade,

  name             text not null check (char_length(trim(name)) > 0),
  color            text not null default '#5D6F5D' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order       int not null default 0,
  -- Fixed, small canonical vocabulary (docs/booking-journey-design.md §2) —
  -- reporting/automation eligibility keys off this, never venue-editable.
  -- Multiple venue-facing stages may share one canonical stage (e.g. "Tour
  -- Scheduled" and "Tour Completed" both mapping to "tour").
  canonical_stage  text not null check (canonical_stage in ('inquiry', 'tour', 'proposal', 'decision', 'booked', 'lost', 'cancelled')),
  probability      smallint check (probability is null or (probability between 0 and 100)),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index pipeline_stages_template on public.pipeline_stages (pipeline_template_id, sort_order);

create trigger pipeline_stages_updated_at
  before update on public.pipeline_stages
  for each row execute function public.set_updated_at();

-- ---- RLS ---------------------------------------------------------------------
alter table public.pipeline_templates enable row level security;
alter table public.pipeline_stages    enable row level security;

create policy pipeline_templates_all on public.pipeline_templates
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy pipeline_stages_all on public.pipeline_stages
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.pipeline_templates to authenticated;
grant select, insert, update, delete on public.pipeline_stages    to authenticated;

notify pgrst, 'reload schema';
