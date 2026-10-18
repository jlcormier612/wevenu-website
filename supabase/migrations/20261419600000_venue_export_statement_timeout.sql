-- A single venue export query measured about 5 seconds. Two overlapping calls
-- are both cancelled at the 8 second statement timeout before either finishes.
-- This raises the limit only while get_venue_export is running.

alter function public.get_venue_export(uuid) set statement_timeout = '30s';
