-- ============================================================================
-- Work Package D4 — secured storage for the final signed-contract PDF.
--
-- The existing `documents` bucket is `public = true` with its own migration
-- comment admitting this was "for simplicity given venue RLS already guards
-- access" — but bucket-level `public = true` serves file bytes over a public
-- CDN URL with NO auth check at all; RLS on storage.objects only governs who
-- can query the metadata ROW, not who can fetch the underlying file once its
-- path is known. That is precisely the storage/RLS mismatch the Document
-- Domain audit warned about, and precisely what a signed legal agreement must
-- not repeat. This bucket is private; every real download goes through a
-- short-lived signed URL generated server-side after the caller's own
-- existing authorization already passed (venue RLS session, or a validated
-- portal token) — never a bare public path.
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('contract-representations', 'contract-representations', false)
  on conflict (id) do nothing;

-- Only the server (service-role, which bypasses RLS entirely) ever writes
-- here — PDF generation always runs in a server action, never the browser.
-- authenticated may SELECT the object metadata (needed for createSignedUrl
-- to resolve the row), never anon — the couple's access path is a signed
-- URL minted by a service-role call after their portal token is validated,
-- not a direct storage grant.
create policy contract_representations_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'contract-representations');

notify pgrst, 'reload schema';
