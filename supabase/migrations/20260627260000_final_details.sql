-- ============================================================================
-- Sprint 33 — Final Details Questionnaire
--
-- Structured questionnaire linked to an event. One per event (unique FK).
-- Standard fields cover the most common venue needs. JSONB `additional`
-- handles custom fields without schema changes (future form engine).
--
-- Completes the 8th Planning Progress checklist item:
--   "Final details submitted" → event_questionnaires.status = 'submitted'
-- ============================================================================

create table public.event_questionnaires (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  event_id   uuid not null references public.events  (id) on delete cascade,

  status     text not null default 'draft'
               check (status in ('draft', 'submitted', 'reviewed')),

  -- Timeline & logistics
  ceremony_start_time      time,
  reception_start_time     time,
  ceremony_location        text,
  reception_location       text,

  -- Guest & meal details
  final_guest_count        integer,
  meal_notes               text,   -- entrée counts, dietary notes, etc.

  -- Music & programme
  processional_song        text,
  recessional_song         text,
  first_dance_song         text,
  parent_dances            text,   -- mother/father dances etc.

  -- Emergency & logistics
  emergency_contact_name   text,
  emergency_contact_phone  text,

  -- Vendor arrival notes (free-form; structured vendor times in event_team)
  vendor_notes             text,

  -- Special requests / anything else
  special_requests         text,

  -- Overflow for custom / future fields
  additional               jsonb,

  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint questionnaires_one_per_event unique (event_id)
);

create index event_questionnaires_venue on public.event_questionnaires (venue_id);

create trigger event_questionnaires_updated_at
  before update on public.event_questionnaires
  for each row execute function public.set_updated_at();

-- RLS
alter table public.event_questionnaires enable row level security;

create policy event_questionnaires_all on public.event_questionnaires
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.event_questionnaires to authenticated;

notify pgrst, 'reload schema';
