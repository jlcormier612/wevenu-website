-- ============================================================================
-- Sprint 28 — Luv Settings
--
-- One row per venue (primary key = venue_id, upsert semantics).
-- All columns default to the most permissive/helpful settings so venues
-- experience Luv immediately without any configuration required.
-- ============================================================================

create table public.luv_settings (
  venue_id             uuid primary key references public.venues (id) on delete cascade,
  observations_enabled boolean not null default true,   -- dashboard "What Luv noticed today"
  drafting_enabled     boolean not null default true,   -- "Ask Luv to draft" surfaces
  autonomy_level       text not null default 'draft_for_review'
                         check (autonomy_level in ('suggest_only', 'draft_for_review')),
  preferred_tone       text not null default 'warm'
                         check (preferred_tone in ('warm', 'professional', 'formal')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger luv_settings_updated_at
  before update on public.luv_settings
  for each row execute function public.set_updated_at();

-- RLS
alter table public.luv_settings enable row level security;

create policy luv_settings_all on public.luv_settings
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.luv_settings to authenticated;

notify pgrst, 'reload schema';
