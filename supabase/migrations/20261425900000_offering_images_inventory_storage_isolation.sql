-- Offering catalog photos + Inventory/Offering storage write isolation.
--
-- 1) Path-scoped insert/update/delete on public `inventory` bucket
--    (first path segment must equal current_user_venue_id).
--    Public SELECT remains for couple-facing / catalog display.
-- 2) offerings.image_url + event_order_template_options.image_url snapshots.
-- 3) Bucket MIME + size limits for catalog photos.

-- ---- Storage: inventory bucket isolation ------------------------------------

update storage.buckets
set
  file_size_limit = coalesce(file_size_limit, 5242880), -- 5 MiB
  allowed_mime_types = coalesce(
    allowed_mime_types,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
where id = 'inventory';

drop policy if exists "inventory_storage_insert" on storage.objects;
drop policy if exists "inventory_storage_select" on storage.objects;
drop policy if exists "inventory_storage_delete" on storage.objects;
drop policy if exists "inventory_storage_update" on storage.objects;

-- Unauthenticated + authenticated reads for intended public catalog photos.
create policy inventory_storage_select on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'inventory');

-- Writes: first folder must be the caller's active venue id.
create policy inventory_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'inventory'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
  );

create policy inventory_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'inventory'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
  )
  with check (
    bucket_id = 'inventory'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
  );

create policy inventory_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'inventory'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
  );

-- ---- Offerings + EO template option image snapshots -------------------------

alter table public.offerings
  add column if not exists image_url text;

comment on column public.offerings.image_url is
  'Optional venue-uploaded photo for this catalog Offering. Null = no dedicated photo.';

alter table public.event_order_template_options
  add column if not exists image_url text;

comment on column public.event_order_template_options.image_url is
  'Optional snapshotted photo URL when the option was created/updated from a catalog Offering.';

notify pgrst, 'reload schema';
