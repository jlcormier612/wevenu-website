-- ============================================================================
-- Couple Tasks Impl 5 — Verified Insurance Completion
--
-- 1) Extend luv_celebrations CHECK with insurance_uploaded (one-shot Luv).
-- 2) Grant service_role write on couple_documents (portal token → admin insert).
-- 3) Allow application/pdf on client-media so couple COI uploads work end-to-end.
--
-- Does NOT invent a new celebration table.
-- Classification + trigger fire live in app (POST /api/portal/documents).
-- ============================================================================

alter table public.luv_celebrations
  drop constraint if exists luv_celebrations_celebration_type_check;

alter table public.luv_celebrations
  add constraint luv_celebrations_celebration_type_check
  check (celebration_type in (
    'contract_signed',
    'final_payment_received',
    'guest_list_submitted',
    'timeline_submitted',
    'website_published',
    'vendor_list_submitted',
    'seating_submitted',
    'questionnaire_submitted',
    'insurance_uploaded'
  ));

grant select, insert, update on public.couple_documents to service_role;

-- Document uploads (insurance COIs) share client-media with portal photos.
-- Website / gallery paths still reject PDF in /api/portal/upload unless type=document.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf'
]
where id = 'client-media';
