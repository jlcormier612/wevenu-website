-- ============================================================================
-- Sprint 30 — Message Events (delivery and engagement audit trail)
--
-- message_events stores every webhook event received from the email provider
-- (Resend). This creates a full audit trail for deliverability debugging,
-- future automation triggers, and Luv observations.
--
-- Event types (Phase 1):
--   sent, delivered, delivery_delayed, bounced, complained
-- Event types (future):
--   opened, clicked, unsubscribed
-- ============================================================================

create table public.message_events (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues   (id) on delete cascade,
  message_id  uuid not null references public.messages (id) on delete cascade,
  event_type  text not null,     -- delivered, bounced, complained, opened, etc.
  occurred_at timestamptz not null default now(),
  payload     jsonb              -- raw webhook payload for debugging
);

create index message_events_message on public.message_events (message_id, occurred_at desc);
create index message_events_venue   on public.message_events (venue_id, occurred_at desc);

-- RLS
alter table public.message_events enable row level security;

create policy message_events_all on public.message_events
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.message_events to authenticated;

notify pgrst, 'reload schema';
