-- Fix: components/vendor-app/vendor-profile-form.tsx's logo upload calls
-- uploadToStorage("vendors", `${profile.id}/logo`, file) — the "vendors"
-- storage bucket referenced there was never created (confirmed live: zero
-- rows in storage.buckets for id='vendors', zero storage.objects policies
-- mentioning it), so every vendor logo upload has always failed with a
-- generic "Logo upload failed" toast, found only once a vendor could
-- actually reach their own Profile page (Vendor Workspace Realignment,
-- 2026-07-22). Mirrors the existing `uploads` bucket's exact shape
-- (20260627020000_uploads_bucket.sql) — public read (uploadToStorage
-- calls getPublicUrl immediately after upload), authenticated
-- insert/select/delete, no per-vendor path scoping beyond bucket_id, same
-- as every other bucket in this codebase.
insert into storage.buckets (id, name, public)
values ('vendors', 'vendors', true)
on conflict (id) do nothing;

create policy "vendors_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vendors');

create policy "vendors_select" on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'vendors');

create policy "vendors_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vendors');

notify pgrst, 'reload schema';
