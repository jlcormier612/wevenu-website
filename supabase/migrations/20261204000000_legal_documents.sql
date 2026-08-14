-- Versioned legal documents (platform-wide, not venue-scoped).
-- document_type uses stable snake_case keys; human display names live in title:
--   venue_terms_of_service  → Venue Terms of Service
--   couple_end_user_terms   → Couple End User Terms
--   vendor_end_user_terms   → Vendor End User Terms
--   privacy_policy          → Privacy Policy
--   cookie_policy           → Cookie Policy
--   acceptable_use_policy   → Acceptable Use Policy
--
-- Only one active version per document_type (partial unique index).
-- Writes are service-role only until an admin authoring surface exists;
-- active rows are readable by anon + authenticated (legal docs are public).

create table public.legal_documents (
  id              uuid primary key default gen_random_uuid(),
  document_type   text not null
    check (document_type in (
      'venue_terms_of_service',
      'couple_end_user_terms',
      'vendor_end_user_terms',
      'privacy_policy',
      'cookie_policy',
      'acceptable_use_policy'
    )),
  title           text not null,
  version         text not null,
  effective_date  date not null,
  content         text not null,
  is_active       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (document_type, version)
);

comment on table public.legal_documents is
  'Versioned platform legal documents. document_type is a stable snake_case key; title holds the human display name.';

comment on column public.legal_documents.document_type is
  'Stable key: venue_terms_of_service, couple_end_user_terms, vendor_end_user_terms, privacy_policy, cookie_policy, acceptable_use_policy';

create unique index legal_documents_one_active_per_type
  on public.legal_documents (document_type)
  where is_active = true;

create index legal_documents_type_effective
  on public.legal_documents (document_type, effective_date desc);

create trigger legal_documents_updated_at
  before update on public.legal_documents
  for each row execute function public.set_updated_at();

alter table public.legal_documents enable row level security;

create policy legal_documents_select_active on public.legal_documents
  for select to anon, authenticated
  using (is_active = true);

grant select on public.legal_documents to anon, authenticated;

notify pgrst, 'reload schema';
