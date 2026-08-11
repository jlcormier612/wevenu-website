-- Work Package D5D fix — CREATE OR REPLACE FUNCTION does not replace a
-- function whose parameter LIST differs (a new p_expected_updated_at param
-- was added in migration 20261253000000); Postgres created a second,
-- overloaded submit_questionnaire_as_couple() instead of replacing the
-- original. PostgREST then can't choose between the 10-arg and 11-arg
-- overloads and every call fails with PGRST203 ("Could not choose the best
-- candidate function"). Drop the old 10-arg signature explicitly — found via
-- this phase's own live validation script, not by code review.
drop function if exists public.submit_questionnaire_as_couple(
  text, integer, text, text, text, text, text, text, text, text
);

notify pgrst, 'reload schema';
