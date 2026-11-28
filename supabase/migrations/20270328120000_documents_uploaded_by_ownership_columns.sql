-- ============================================================================
-- Documents ownership columns required by get_couple_documents (and related
-- portal/venue document RPCs).
--
-- Root cause (Batch 2C):
--   Repository contains TWO files with version stamp 20261177000000:
--     - 20261177000000_lifecycle_engine_service_role_grants.sql  (applied)
--     - 20261177000000_vendor_documents.sql                    (shadowed / never applied)
--   Later migrations replaced get_couple_documents to read documents.uploaded_by_type
--   / uploaded_by_id, assuming vendor_documents had landed. Production never received
--   those columns; Sandbox did (vendor_documents body applied there under the same
--   collision class / parallel history). Ledger presence of 20261177000000 therefore
--   does NOT prove vendor_documents schema.
--
-- This tip migration is idempotent and ONLY adds the missing ownership columns +
-- index so existing couple-document RPCs execute. It does not weaken RLS, rewrite
-- get_couple_documents, or invent security-definer bypasses.
--
-- Full vendor_library_documents + share_vendor_document_to_event catch-up remains a
-- separate Production gap vs Sandbox (same collision) and is intentionally out of
-- this smallest Docs correction.
-- ============================================================================

alter table public.documents
  add column if not exists uploaded_by_type text not null default 'venue';

-- Add check only when missing (IF NOT EXISTS unsupported for constraints on older PG paths).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_uploaded_by_type_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_uploaded_by_type_check
      check (uploaded_by_type in ('venue', 'vendor'));
  end if;
end $$;

alter table public.documents
  add column if not exists uploaded_by_id uuid,
  add column if not exists source_library_document_id uuid;

create index if not exists documents_uploaded_by_vendor
  on public.documents (event_id, uploaded_by_type)
  where uploaded_by_type = 'vendor';

-- Backfill: treat historical rows as venue-owned (matches column default).
update public.documents
set uploaded_by_type = 'venue'
where uploaded_by_type is null;
