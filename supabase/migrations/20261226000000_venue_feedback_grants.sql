-- venue_feedback / venue_feedback_votes were created with RLS policies but never
-- granted table privileges to authenticated (or service_role). PostgREST then
-- returns 42501 permission denied before RLS can allow vendor/venue inserts.

grant select, insert, update on public.venue_feedback to authenticated;
grant select, insert, update, delete on public.venue_feedback to service_role;

grant select, insert, delete on public.venue_feedback_votes to authenticated;
grant select, insert, update, delete on public.venue_feedback_votes to service_role;
