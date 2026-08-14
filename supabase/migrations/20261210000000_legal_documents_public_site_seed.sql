-- Public site legal documents: Site Terms of Service type + placeholder
-- active versions for Terms, Cookie Policy, and Acceptable Use Policy.
-- Privacy Policy is already seeded in 20261206000000. Replace placeholders
-- with counsel-approved language before production launch.

-- Allow general/public Site Terms alongside venue/couple/vendor terms.
alter table public.legal_documents
  drop constraint if exists legal_documents_document_type_check;

alter table public.legal_documents
  add constraint legal_documents_document_type_check
  check (document_type in (
    'terms_of_service',
    'venue_terms_of_service',
    'couple_end_user_terms',
    'vendor_end_user_terms',
    'privacy_policy',
    'cookie_policy',
    'acceptable_use_policy'
  ));

comment on column public.legal_documents.document_type is
  'Stable key: terms_of_service, venue_terms_of_service, couple_end_user_terms, vendor_end_user_terms, privacy_policy, cookie_policy, acceptable_use_policy';

insert into public.legal_documents (
  document_type,
  title,
  version,
  effective_date,
  content,
  is_active
) values
  (
    'terms_of_service',
    'Terms of Service',
    '2026-08-07.1',
    '2026-08-07',
    $terms$
# Terms of Service

Placeholder active Terms of Service for Hello to Cheers.

These terms govern access to and use of our websites and related services. Venue account subscribers are also subject to the Venue Terms of Service. Replace this placeholder with counsel-approved language before production launch.
$terms$,
    true
  ),
  (
    'cookie_policy',
    'Cookie Policy',
    '2026-08-07.1',
    '2026-08-07',
    $cookies$
# Cookie Policy

Placeholder active Cookie Policy for Hello to Cheers.

This describes how we use cookies and similar technologies on our websites and applications. Replace this placeholder with counsel-approved language before production launch.
$cookies$,
    true
  ),
  (
    'acceptable_use_policy',
    'Acceptable Use Policy',
    '2026-08-07.1',
    '2026-08-07',
    $aup$
# Acceptable Use Policy

Placeholder active Acceptable Use Policy for Hello to Cheers.

This describes prohibited and permitted uses of Hello to Cheers services. Replace this placeholder with counsel-approved language before production launch.
$aup$,
    true
  )
on conflict (document_type, version) do update
  set
    title = excluded.title,
    effective_date = excluded.effective_date,
    content = excluded.content,
    is_active = excluded.is_active,
    updated_at = now();

notify pgrst, 'reload schema';
