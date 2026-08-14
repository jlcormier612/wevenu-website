-- Seed active placeholder Couple End User Terms so couple portal acceptance
-- can complete. Privacy Policy is seeded in 20261206000000. Replace content
-- before launch.

insert into public.legal_documents (
  document_type,
  title,
  version,
  effective_date,
  content,
  is_active
) values
  (
    'couple_end_user_terms',
    'Couple End User Terms',
    '2026-08-07.1',
    '2026-08-07',
    $couple$
# Couple End User Terms

Placeholder active Couple End User Terms for Hello to Cheers.

By opening your couple planning workspace, you agree to these terms. Replace this placeholder with counsel-approved language before production launch.
$couple$,
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
