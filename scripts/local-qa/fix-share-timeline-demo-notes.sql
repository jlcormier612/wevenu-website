-- Local QA / demo content hygiene ONLY.
-- Couple Home Issue 3 + Impl 6: Golden Hour "Share timeline" notes + typed action.
--
-- Targets known Sweet Daisy / Golden Hour demo UUIDs only.
-- Does NOT rewrite arbitrary customer vendor_tasks.notes.
-- Not a production migration — apply manually against local Supabase when needed:
--   docker exec -i supabase_db_wevenu-website psql -U postgres -d postgres < scripts/local-qa/fix-share-timeline-demo-notes.sql

BEGIN;

UPDATE public.vendor_tasks
SET
  notes = 'Share your timeline so your photographer knows when and where they''ll be needed.',
  action_type = 'share_timeline'
WHERE id = '90eff479-b947-41a1-bcca-8496e004fcad'
  AND title = 'Share timeline';

-- Same copy + action on the Golden Hour "Gold Package Task List" template item that mints future applies.
UPDATE public.vendor_task_template_items
SET
  notes = 'Share your timeline so your photographer knows when and where they''ll be needed.',
  action_type = 'share_timeline'
WHERE id = '58262c37-876f-4b18-af1f-67b4276071a5'
  AND title = 'Share timeline';

COMMIT;
