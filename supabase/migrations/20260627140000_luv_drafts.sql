-- ============================================================================
-- Sprint 27 — Luv Drafts (Phase 2 Foundation)
--
-- Stores AI-generated draft content for coordinator review.
-- Coordinator reviews, edits, and sends manually — Luv never sends.
--
-- draft_type values for Phase 2:
--   follow_up_email  — follow-up email to a lead
-- Future:
--   follow_up_text   — short SMS draft
--   next_steps       — suggested next actions
--   timeline         — day-of timeline suggestion
-- ============================================================================

create table public.luv_drafts (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,

  -- The entity this draft is for
  entity_type text not null check (entity_type in ('lead', 'client', 'event')),
  entity_id   uuid not null,

  draft_type  text not null default 'follow_up_email'
                check (draft_type in ('follow_up_email', 'follow_up_text', 'next_steps', 'timeline')),

  content     text not null,         -- the generated draft text
  subject     text,                  -- for email drafts: the suggested subject line

  -- Context snapshot used to generate this draft (for audit / re-generation)
  context     jsonb,

  status      text not null default 'pending_review'
                check (status in ('pending_review', 'accepted', 'discarded')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index luv_drafts_entity on public.luv_drafts (entity_type, entity_id, created_at desc);
create index luv_drafts_venue  on public.luv_drafts (venue_id, created_at desc);

create trigger luv_drafts_updated_at
  before update on public.luv_drafts
  for each row execute function public.set_updated_at();

-- RLS
alter table public.luv_drafts enable row level security;

create policy luv_drafts_all on public.luv_drafts
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.luv_drafts to authenticated;

notify pgrst, 'reload schema';
