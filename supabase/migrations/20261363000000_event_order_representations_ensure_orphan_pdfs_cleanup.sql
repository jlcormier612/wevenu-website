-- Corrective follow-up for 20261362000000 when it was applied targeting the
-- mistaken bucket name event-order-pdfs. Ensures the real runtime bucket
-- (lib/event-orders/representation.ts → event-order-representations) and drops the
-- orphan event-order-pdfs select policy if present.
--
-- Note: hosted Supabase blocks DELETE on storage.buckets via protect_delete().
-- Storage API already reports event-order-pdfs as NoSuchBucket (no backend
-- objects). Any leftover catalog row is harmless infrastructure residue —
-- runtime only reads/writes event-order-representations.

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

drop policy if exists "event_order_pdfs_select" on storage.objects;
