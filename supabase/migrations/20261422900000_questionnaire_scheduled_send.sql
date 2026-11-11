-- ============================================================================
-- Event questionnaire — one-time scheduled send (reuses communication cron).
--
-- Persists a future authorized send on the event questionnaire row itself.
-- Delivery executes via /api/communication/scheduled/process (existing
-- scheduler cadence), calling the same send path as Send now — not a
-- parallel scheduling engine and not freeform scheduled_messages body mail.
-- ============================================================================

alter table public.event_questionnaires
  add column if not exists scheduled_send_at timestamptz,
  add column if not exists scheduled_send_status text
    check (
      scheduled_send_status is null
      or scheduled_send_status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled')
    ),
  add column if not exists scheduled_send_message text,
  add column if not exists scheduled_send_error text;

comment on column public.event_questionnaires.scheduled_send_at is
  'When set with scheduled_send_status=scheduled, the questionnaire email fires at this time via the communication scheduled processor.';
comment on column public.event_questionnaires.scheduled_send_status is
  'scheduled | sent | failed | cancelled — independent of questionnaire completion status.';

create index if not exists event_questionnaires_scheduled_send_due
  on public.event_questionnaires (scheduled_send_at)
  where scheduled_send_status = 'scheduled';

-- Cron processor runs as service_role (same grants pattern as scheduled_messages).
grant select, update on public.event_questionnaires to service_role;

notify pgrst, 'reload schema';
