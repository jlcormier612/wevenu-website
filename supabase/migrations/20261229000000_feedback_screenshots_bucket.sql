-- Feedback bug-report screenshots.
-- Public read so Support can open URLs from feedback metadata / CRM;
-- writes go through service-role API routes (venue/vendor auth or portal token).
-- Paths: feedback-screenshots/{surface}/{actor_id}/{timestamp}-{uuid}.{ext}

insert into storage.buckets (id, name, public)
values ('feedback-screenshots', 'feedback-screenshots', true)
on conflict (id) do nothing;

drop policy if exists "feedback_screenshots_select" on storage.objects;
create policy "feedback_screenshots_select" on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'feedback-screenshots');

-- No direct client inserts — uploads use SUPABASE_SERVICE_ROLE_KEY via API routes.
drop policy if exists "feedback_screenshots_insert" on storage.objects;
drop policy if exists "feedback_screenshots_update" on storage.objects;
drop policy if exists "feedback_screenshots_delete" on storage.objects;

notify pgrst, 'reload schema';
