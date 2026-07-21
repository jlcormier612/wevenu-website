-- ============================================================================
-- RC2 — Messaging & Conversations, Milestone 4: Event.Completed becomes the
-- natural transition into post-event relationship management.
--
-- No new communication model — this is a Scheduled Send like any other,
-- just queued by an Automation Rule (already-built infrastructure: Event.
-- Completed already fires as a Platform Event, the Automation engine
-- already consumes platform_events and dispatches through an Action
-- Registry) instead of a coordinator's own click. schedule_relationship_
-- message (lib/automation/actions.ts) is the one new action type this adds.
--
-- No rules-editing UI exists yet (automation_rules has full CRUD RLS ready
-- for one later, but Phase 1 shipped without it) — so this seeds one
-- default rule per venue directly, built and fully functional end to end,
-- but created DISABLED (enabled = false). Per explicit direction: the
-- first experience should be a venue intentionally turning this on, never
-- discovering after the fact that review requests already went out
-- automatically. Flipping enabled = true (per venue, directly on the row
-- until a settings UI exists) is the only step left to activate it.
-- ============================================================================

-- scheduled_messages previously granted service_role only SELECT/UPDATE
-- (enough for the processor, which only ever read+updated existing rows) —
-- this is the first Automation action that INSERTs into it directly via a
-- service-role client (lib/automation/actions.ts's established convention:
-- actions call repository functions with a service-role client, since
-- Automation runs with no interactive session). Found by actually running
-- this action against the local DB, not by inspection.
grant insert on public.scheduled_messages to service_role;

create or replace function public.seed_default_automation_rules()
returns trigger
language plpgsql
as $$
begin
  insert into public.automation_rules (venue_id, name, trigger_event_type, action_type, action_params, enabled)
  values (
    new.id,
    'Post-event review & referral nudge',
    'Event.Completed',
    'schedule_relationship_message',
    jsonb_build_object(
      'offsetDays', 3,
      'channel', 'email',
      'subject', 'How was your day with us?',
      'body', E'Hi there!\n\nNow that the celebration has had a few days to settle, we would love to hear how everything went. If you have a moment, a review means the world to us — and if you know anyone else planning an event, we would be so grateful for the introduction.\n\nThank you again for celebrating with us.'
    ),
    false
  )
  on conflict do nothing;
  return new;
end;
$$;

create trigger venues_seed_default_automation_rules
  after insert on public.venues
  for each row execute function public.seed_default_automation_rules();

-- Backfill: every venue that predates this migration gets the same default
-- rule now (disabled), provided it doesn't already have an Event.Completed
-- rule (so re-running this migration, or a venue that already configured
-- its own, is a safe no-op).
insert into public.automation_rules (venue_id, name, trigger_event_type, action_type, action_params, enabled)
select
  v.id,
  'Post-event review & referral nudge',
  'Event.Completed',
  'schedule_relationship_message',
  jsonb_build_object(
    'offsetDays', 3,
    'channel', 'email',
    'subject', 'How was your day with us?',
    'body', E'Hi there!\n\nNow that the celebration has had a few days to settle, we would love to hear how everything went. If you have a moment, a review means the world to us — and if you know anyone else planning an event, we would be so grateful for the introduction.\n\nThank you again for celebrating with us.'
  ),
  false
from public.venues v
where not exists (
  select 1 from public.automation_rules ar
  where ar.venue_id = v.id and ar.trigger_event_type = 'Event.Completed'
);
