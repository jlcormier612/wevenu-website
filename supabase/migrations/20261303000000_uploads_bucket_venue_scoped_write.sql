-- Venue logo / hero writes on storage.objects (bucket `uploads`).
--
-- Defect: ImageUpload calls storage.upload(..., { upsert: true }). When
-- `{venue_id}/logo.png` already exists, upsert is an UPDATE on
-- storage.objects. 20260627020000_uploads_bucket.sql granted INSERT and
-- DELETE to any authenticated user, but never granted UPDATE — so a
-- replacement PNG fails with "new row violates row-level security policy"
-- and the stored object never changes.
--
-- Writes are now:
--   * authenticated only (not anon)
--   * bucket `uploads` only
--   * first path segment = current_user_venue_id() (cannot write another venue)
--   * current_user_role() in (owner, manager) — same Team Permissions
--     operational-settings tier as venue branding; coordinator/staff do not
--     gain write rights from this fix
--
-- Public read of the existing public bucket is unchanged (couple portal,
-- contracts, sidebar). No service_role grant. No public write.

drop policy if exists "uploads_insert" on storage.objects;
drop policy if exists "uploads_update" on storage.objects;
drop policy if exists "uploads_delete" on storage.objects;

create policy "uploads_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
    and public.current_user_role() in ('owner', 'manager')
  );

create policy "uploads_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
    and public.current_user_role() in ('owner', 'manager')
  )
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
    and public.current_user_role() in ('owner', 'manager')
  );

create policy "uploads_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
    and public.current_user_role() in ('owner', 'manager')
  );

-- SELECT stays as created in 20260627020000 (authenticated + anon, public bucket).

notify pgrst, 'reload schema';
