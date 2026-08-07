-- Work Package 1 — Legal Foundation
-- Separates published vs currently-enforced active versions, makes
-- document_type extensible (app registry in lib/legal/types.ts), and adds
-- acceptance_method to the append-only legal_acceptances audit trail.
-- Does not delete historical document or acceptance rows.

-- ---------------------------------------------------------------------------
-- PART 1 / 4 — Extensible document_type + published flag
-- ---------------------------------------------------------------------------

alter table public.legal_documents
  drop constraint if exists legal_documents_document_type_check;

comment on column public.legal_documents.document_type is
  'Stable snake_case key (e.g. terms_of_service, privacy_policy). Validated in the app registry (lib/legal/types.ts); not constrained in SQL so new types do not require schema migrations.';

alter table public.legal_documents
  add column if not exists is_published boolean not null default false;

-- Existing seeded / counsel versions were released content. Keep is_active
-- as the single currently-enforced version per type (unchanged semantics).
update public.legal_documents
set is_published = true
where is_published = false;

comment on column public.legal_documents.is_published is
  'Whether this version has been released for read. Independent of is_active.';

comment on column public.legal_documents.is_active is
  'Currently enforced version for acceptance gates. At most one active row per document_type (partial unique index).';

create index if not exists legal_documents_type_published
  on public.legal_documents (document_type, effective_date desc)
  where is_published = true;

-- ---------------------------------------------------------------------------
-- PART 2 — Acceptance method (append-only; never overwrite history)
-- ---------------------------------------------------------------------------

alter table public.legal_acceptances
  add column if not exists acceptance_method text not null default 'Version Update';

comment on column public.legal_acceptances.acceptance_method is
  'How the acceptance was recorded (e.g. Venue Signup, Couple Invitation, Vendor Invitation, Version Update). App registry in lib/legal/types.ts.';

create index if not exists legal_acceptances_method
  on public.legal_acceptances (acceptance_method);

notify pgrst, 'reload schema';
