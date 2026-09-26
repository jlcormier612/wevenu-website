# Public Forms + QR — Wave 1 STATUS

## Verdict

*(filled after Sandbox + browser QA)*

## SMS consent policy (Wave 1)

Custom Public Forms **do not** collect SMS consent.

- Phone on a Public Form is contact information only.
- Phone ≠ SMS consent.
- Explicit SMS consent remains on the venue inquiry form (`requestSmsPermission` + `applyInquiryCommunicationCapture`).
- `/api/public/forms/submit` does **not** call `applyInquiryCommunicationCapture`.

## Architecture shipped

- `public_forms` + `public_form_questions` (venue-owned, RLS)
- Public route `/forms/{public_key}` (distinct from `/form/{embed_key}`)
- Submit → TypeScript `ingestLead` → `create_public_form_lead` → SQL `ingest_lead`
- QR `destination_type = public_form` + nullable `public_form_id` (many QR → one form)
- Library builder + QR destination picker (create new / choose existing)
- Venue branding inherited from venue (logo, colors, footer) — no per-form branding

## Intentionally out of scope

- Inquiry form migration
- Analytics dashboards
- Production deploy
- Couple questionnaires / events / contracts / invoices / payment plans

## QA fixtures

*(filled after runtime QA)*
