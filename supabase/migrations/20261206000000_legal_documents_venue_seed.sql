-- Seed active placeholder Venue Terms of Service + Privacy Policy so local
-- venue subscription acceptance can complete. Replace content before launch.

insert into public.legal_documents (
  document_type,
  title,
  version,
  effective_date,
  content,
  is_active
) values
  (
    'venue_terms_of_service',
    'Venue Terms of Service',
    '2026-08-07.1',
    '2026-08-07',
    $tos$
# Venue Terms of Service

Placeholder active Venue Terms of Service for Hello to Cheers.

By creating a venue account or subscribing, you agree to these terms. Replace this placeholder with counsel-approved language before production launch.
$tos$,
    true
  ),
  (
    'privacy_policy',
    'Privacy Policy',
    '2026-08-07.1',
    '2026-08-07',
    $privacy$
# Privacy Policy

Placeholder active Privacy Policy for Hello to Cheers.

This describes how we handle personal information in connection with venue accounts and related services. Replace this placeholder with counsel-approved language before production launch.
$privacy$,
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
