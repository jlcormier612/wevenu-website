-- ============================================================================
-- RC2 — Messaging & Conversations, Milestone 5 (Rollout verification): fix a
-- real, live, silent gap found while verifying "does every entry point that
-- represents a conversation actually reach Conversations."
--
-- resolve_relationship_id_for_thread_entity() — the function
-- sync_message_to_conversation() calls to mirror a legacy `messages` row
-- into `conversation_messages` — resolved a Client's or Event's
-- relationship by joining through `leads` (`join public.leads l on
-- l.id = c.lead_id`), the same stale pattern already fixed in
-- resolve_relationship_id_for_client() (20260721000000, portal RPCs) and in
-- get_conversation_inbox() (20261117000000, the venue Inbox). This one was
-- missed: clients.relationship_id has been the direct, authoritative link
-- since Phase 2B, but this function was never updated to match.
--
-- Concretely, this was silently dropping two kinds of real messages for any
-- Client created without ever going through a Lead (a real, supported path —
-- lib/clients/repository.ts's insertClient has always had a direct-create
-- path alongside lead-conversion):
--   1. Inbound EMAIL REPLIES from that couple (app/api/messaging/inbound/
--      route.ts writes to legacy `messages`, correctly, but the mirror
--      trigger below silently no-ops instead of forwarding it into
--      conversation_messages — so it never appeared in the Conversations
--      Inbox, search, or the couple's own Activity Timeline).
--   2. Automated questionnaire system messages ("The couple opened the
--      final details form." / "Final details submitted by the couple.")
--      from mark_questionnaire_opened()/submit_questionnaire_as_couple().
--
-- Same fix, same reasoning, as the two prior instances: read
-- clients.relationship_id directly instead of joining through leads.
-- ============================================================================

create or replace function public.resolve_relationship_id_for_thread_entity(
  p_lead_id   uuid,
  p_client_id uuid,
  p_event_id  uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select relationship_id from public.leads where id = p_lead_id),
    (select c.relationship_id from public.clients c
      where c.id = p_client_id),
    (select c.relationship_id from public.events e
       join public.clients c on c.id = e.client_id
      where e.id = p_event_id)
  )
$$;

notify pgrst, 'reload schema';
