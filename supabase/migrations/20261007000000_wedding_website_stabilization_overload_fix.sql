-- ============================================================================
-- Wedding Website Stabilization — correction to 20261006000000
--
-- That migration added p_schedule_sync to update_my_website via CREATE OR
-- REPLACE, but a 14-parameter signature doesn't replace the prior
-- 13-parameter one — the exact "CREATE OR REPLACE only replaces exact
-- signature matches" issue this whole stabilization pass exists to close.
-- Confirmed live via pg_proc: both the old 13-param and new 14-param
-- versions were coexisting after 20261006000000 applied. This drops the
-- now-genuinely-dead 13-param version (the one that was "current" prior to
-- adding schedule_sync).
-- ============================================================================

drop function if exists public.update_my_website(text, text, boolean, text, boolean, text, text, text, text, text[], text, jsonb, text[]);
