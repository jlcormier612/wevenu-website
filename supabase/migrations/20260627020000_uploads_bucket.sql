-- ============================================================================
-- Sprint 19 — Shared Upload Infrastructure
-- Creates the `uploads` bucket for venue logos and future photo uploads.
-- The `floor-plans` bucket (Sprint 18) stays separate for floor plan images.
--
-- Planned path structure:
--   uploads/{venue_id}/logo.{ext}          — venue logo (Sprint 19)
--   uploads/{venue_id}/leads/{id}/*        — lead photos (future)
--   uploads/{venue_id}/clients/{id}/*      — couple photos (future)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

create policy "uploads_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads');

create policy "uploads_select" on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'uploads');

create policy "uploads_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads');

notify pgrst, 'reload schema';
