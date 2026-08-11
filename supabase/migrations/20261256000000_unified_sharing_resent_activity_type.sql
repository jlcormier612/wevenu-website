-- Work Package D5E — Unified Sharing Experience distinguishes a genuine
-- resend from a first send everywhere (Contract already used a free-form
-- text `type` column so this needed no migration there; Questionnaire's
-- questionnaire_activities table, added in D5D, has a real CHECK constraint
-- that needs 'resent' added to its allowed set).
alter table public.questionnaire_activities
  drop constraint if exists questionnaire_activities_type_check;

alter table public.questionnaire_activities
  add constraint questionnaire_activities_type_check
  check (type in ('sent', 'resent', 'opened', 'submitted', 'reviewed', 'reopened'));

notify pgrst, 'reload schema';
