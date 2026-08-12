-- Library Archive + Client Release Safety — allow logging when a venue
-- stops couple access on a sent questionnaire (status sent → draft).
-- Public RPC already only serves sent|submitted|reviewed, so draft removes link access.
alter table public.questionnaire_activities
  drop constraint if exists questionnaire_activities_type_check;

alter table public.questionnaire_activities
  add constraint questionnaire_activities_type_check
  check (type in (
    'sent', 'resent', 'opened', 'submitted', 'reviewed', 'reopened', 'access_withdrawn'
  ));

notify pgrst, 'reload schema';
