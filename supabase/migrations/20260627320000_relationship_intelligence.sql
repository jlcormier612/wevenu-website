-- ============================================================================
-- Sprint 36 — Relationship Intelligence Foundation
--
-- Two additions:
--
-- 1. leads.commitment_score (smallint, 0–100)
--    Computed from milestone data that already exists in the platform.
--    Reflects how far along the booking journey a lead has progressed.
--    Refreshed on dashboard load + after milestone events.
--
-- 2. lead_signal_events table
--    Records behavioral intent signals: form views, email opens, questionnaire
--    events, payment link clicks. Foundation for Interest + Responsiveness
--    dimensions of the three-axis engagement model.
--    Lightweight — purpose-built for signal aggregation, not a full audit log.
-- ============================================================================

-- Commitment score on leads --------------------------------------------------
-- Updated when: status changes, tour scheduled, contract signed, payment received.
-- Computed by: computeLeadCommitmentScore() in the application layer.
alter table public.leads
  add column commitment_score smallint not null default 0
    check (commitment_score >= 0 and commitment_score <= 100),
  add column scores_updated_at timestamptz;

create index leads_commitment on public.leads (venue_id, commitment_score desc)
  where status not in ('won', 'lost', 'cancelled');

-- lead_signal_events ----------------------------------------------------------
-- Every meaningful behavioral signal from a lead. Distinct from lead_activities
-- (which logs coordinator actions) — this logs lead/prospect actions.
--
-- signal_strength: 1=passive (page view), 2=active (reply), 3=high (payment click)
-- Time-decayed in the application layer to compute Interest score.
create table public.lead_signal_events (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues (id) on delete cascade,
  lead_id         uuid not null references public.leads  (id) on delete cascade,
  signal_type     text not null check (signal_type in (
    -- Questionnaire signals
    'questionnaire_viewed', 'questionnaire_submitted',
    -- Email signals (from Resend webhooks via message_events)
    'email_opened', 'email_clicked',
    -- Form signals (public inquiry form)
    'form_viewed', 'form_revisited',
    -- Payment signals (future)
    'payment_link_clicked',
    -- Proposal signals (future)
    'proposal_viewed'
  )),
  signal_strength smallint not null default 1
    check (signal_strength between 1 and 3),
  metadata        jsonb,               -- source_id, email_subject, link_url, etc.
  occurred_at     timestamptz not null default now()
);

create index lead_signal_events_lead  on public.lead_signal_events (lead_id, occurred_at desc);
create index lead_signal_events_venue on public.lead_signal_events (venue_id, occurred_at desc);
create index lead_signal_events_type  on public.lead_signal_events (venue_id, signal_type, occurred_at desc);

-- RLS
alter table public.lead_signal_events enable row level security;

create policy lead_signal_events_all on public.lead_signal_events
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.lead_signal_events to authenticated;

notify pgrst, 'reload schema';
