-- Nudge PostgREST to rebuild its schema cache after prior DDL.
-- Safe / idempotent.
notify pgrst, 'reload schema';
select 1;
