-- Lead Pipeline — Release Readiness, Release Blocker #2.
--
-- clients.lead_id had a foreign key but no uniqueness guarantee — a
-- double-click or a race between two tabs on "Convert to Client" could
-- create two Client records for the same Lead, with no server-side guard.
-- A partial unique index (nullable column — plenty of Clients exist with no
-- originating Lead at all) closes this the same way every other
-- "one real thing per source row" invariant in this platform is enforced,
-- at the database layer, not just trusted to application code.

create unique index clients_lead_id_unique on public.clients (lead_id) where lead_id is not null;
