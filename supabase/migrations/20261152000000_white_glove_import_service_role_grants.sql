-- White-Glove Customer Success Workspace §2.2a step 4 — createClientForVenue
-- (lib/clients/service.ts) runs the exact same core logic self-service
-- client creation does (createClientCore), just via createAdminClient()
-- (service_role) with an explicit venueId instead of a resolved session.
-- Two tables that core path touches were missing service_role grants,
-- found by tracing the code, not assumed — the same "RLS/grant is bypassed
-- for service_role, but the table GRANT itself still isn't implicit" class
-- of gap this engagement has hit repeatedly (Sprint 2's vendor_inquiries/
-- vendor_tasks, White-Glove's own venue_customer_relationships/
-- venue_vendor_relationships in 20261141000000).
--
-- calendar_blocks: read by the calendar-block hard-stop check before
-- creating a client with an event date.
-- events: written by autoCreateEvent when a client has an event date.
grant select on public.calendar_blocks to service_role;
grant insert, update on public.events to service_role;
