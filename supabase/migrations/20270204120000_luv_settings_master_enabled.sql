-- ============================================================================
-- LUV-OPTOUT — venue-level master Enable Luv switch
--
-- Adds public.luv_settings.enabled (DEFAULT true) so existing venues and
-- venues with no settings row keep current Luv behavior until explicitly
-- disabled. Nested observations/drafting preferences stay independent.
--
-- Deploy ordering: apply this migration BEFORE deploying application code
-- that reads/writes the enabled column.
-- ============================================================================

alter table public.luv_settings
  add column if not exists enabled boolean not null default true;

comment on column public.luv_settings.enabled is
  'Master Enable Luv switch. When false, hide Luv surfaces and block Luv AI/generation while preserving nested prefs and history.';

notify pgrst, 'reload schema';
