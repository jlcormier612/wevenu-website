-- Corrective follow-up for 20261362000000 when it was applied targeting the
-- mistaken bucket name event-order-pdfs. Ensures the real runtime bucket
-- (lib/event-orders/representation.ts → event-order-representations) and removes the
-- orphan event-order-pdfs catalog row when it has no objects.

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

-- Orphan cleanup: only when empty (no durable Event Order PDFs live here).
drop policy if exists "event_order_pdfs_select" on storage.objects;

delete from storage.buckets b
where b.id = 'event-order-pdfs'
  and not exists (
    select 1 from storage.objects o where o.bucket_id = 'event-order-pdfs'
  );
