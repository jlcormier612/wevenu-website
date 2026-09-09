-- Ensure Event Order PDF private bucket + authenticated select policy exist.
-- 20261252000000 already inserts the bucket row; hosted Storage can leave an
-- orphaned catalog row without a usable backend bucket. Re-assert idempotently.
-- Creating/repairing the actual Storage backend may still require the Storage
-- API (as done for Sandbox); this migration keeps SQL catalog + RLS aligned.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-order-pdfs', 'event-order-pdfs', false, 52428800, array['application/pdf']::text[])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = coalesce(storage.buckets.file_size_limit, excluded.file_size_limit),
      allowed_mime_types = coalesce(storage.buckets.allowed_mime_types, excluded.allowed_mime_types);

drop policy if exists "event_order_pdfs_select" on storage.objects;
create policy "event_order_pdfs_select" on storage.objects
  for select
  using (bucket_id = 'event-order-pdfs' and auth.role() = 'authenticated');
