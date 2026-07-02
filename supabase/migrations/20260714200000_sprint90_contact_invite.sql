-- ============================================================================
-- Sprint 90: Contact invite tracking
--
-- Adds invited_at to client_contacts so coordinators can see when a portal
-- invitation was last sent. Already mapped in lib/contacts/types.ts; this
-- migration adds the actual column.
--
-- Also adds a helper index for finding contacts who haven't responded to
-- their invite (status = 'invited' + invited_at is not null).
-- ============================================================================

alter table public.client_contacts
  add column if not exists invited_at timestamptz;

-- Index: find contacts with pending invitations (Luv observation source)
create index if not exists client_contacts_pending_invite
  on public.client_contacts (client_id, invited_at)
  where status = 'invited' and invited_at is not null;

notify pgrst, 'reload schema';
