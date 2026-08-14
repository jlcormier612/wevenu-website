-- Work Package 5 — Legal Administration (HQ Business → Legal)
-- Adds publish attribution for version history. Keeps WP1 immutability
-- trigger intact (content/identity fields only). HQ may select all
-- acceptance rows for operational reporting (service-role also used).

alter table public.legal_documents
  add column if not exists published_by uuid references auth.users (id) on delete set null;

alter table public.legal_documents
  add column if not exists published_at timestamptz;

comment on column public.legal_documents.published_by is
  'HQ admin who first published this version (nullable for legacy rows).';

comment on column public.legal_documents.published_at is
  'When this version was first published (nullable for legacy rows).';

-- HQ can read the full append-only acceptance audit trail.
create policy legal_acceptances_hq_select on public.legal_acceptances
  for select to authenticated
  using (public.is_hq_admin());

notify pgrst, 'reload schema';
