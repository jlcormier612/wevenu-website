-- Ensure Event Order PDF private bucket + authenticated select policy exist.
-- Matches lib/event-orders/representation.ts BUCKET = event-order-representations
-- (20261252000000). Hosted Storage can leave an orphaned catalog row without
-- a usable backend bucket; re-assert idempotently. Creating/repairing the
-- actual Storage backend may still require the Storage API.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-order-representations', 'event-order-representations', false, 52428800, array['application/pdf']::text[])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = coalesce(storage.buckets.file_size_limit, excluded.file_size_limit),
      allowed_mime_types = coalesce(storage.buckets.allowed_mime_types, excluded.allowed_mime_types);

drop policy if exists "event_order_representations_select" on storage.objects;
create policy "event_order_representations_select" on storage.objects
  for select
  using (bucket_id = 'event-order-representations' and auth.role() = 'authenticated');
