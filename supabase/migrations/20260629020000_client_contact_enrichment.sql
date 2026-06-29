-- ============================================================================
-- Sprint 49 Follow-up: client_contacts enrichment fields
--
-- Five additive nullable columns on client_contacts.
-- All null-safe — existing rows are unaffected. No queries need updating.
--
-- These enable Luv observations and relationship intelligence:
--
--   is_payer + status → "Jim (Dad) hasn't logged in since the invoice was sent.
--                         The deposit is due Thursday."
--
--   is_decision_maker + last_activity_at → "The decision maker hasn't been
--                         active in 3 weeks. The upcoming proposal needs their attention."
--
--   is_emergency_contact → surfaces on day-of coordinator briefing
--                         "If Emily is unreachable, call Sarah (MOH)."
--
--   status + last_activity_at → engagement gap observation
--                         "Emily's father was invited 2 weeks ago but hasn't
--                          visited the portal."
-- ============================================================================

alter table public.client_contacts
  -- Contact lifecycle
  add column status text not null default 'active'
    check (status in (
      'invited',   -- added + portal link sent, no visit yet
      'active',    -- has visited portal, replied to thread, or completed a task
      'inactive',  -- had access, no engagement in a meaningful window
      'removed'    -- soft delete: history preserved, portal access revoked
    )),

  -- Intent signal: last time this contact did anything in Wevenu
  -- Updated by: portal visit (client_portal_sessions.last_accessed_at),
  --   message thread reply (future), task completion (future)
  add column last_activity_at timestamptz,

  -- Role flags — not mutually exclusive, multiple can be true
  add column is_payer            boolean not null default false,
  add column is_decision_maker   boolean not null default false,
  add column is_emergency_contact boolean not null default false;

-- Index: find invited contacts who haven't visited yet (Luv observation source)
create index client_contacts_invited
  on public.client_contacts (venue_id, status, created_at)
  where status = 'invited';

-- Index: find payers for financial notification routing
create index client_contacts_payers
  on public.client_contacts (client_id)
  where is_payer = true;

-- Index: find emergency contacts for day-of briefings
create index client_contacts_emergency
  on public.client_contacts (client_id)
  where is_emergency_contact = true;

notify pgrst, 'reload schema';
