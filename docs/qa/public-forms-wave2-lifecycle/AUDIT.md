# Public Forms Wave 2 — Forensic seams (pre-implementation)

**Date:** 2026-09-26  
**Wave 1:** `4446af99` / migration `20261407600000` / ECS `:398` — **GREEN, left intact**

## What Wave 1 already had (do not rebuild)

| Capability | Status |
|---|---|
| `public_forms` + form-scoped questions | Exists |
| Status `draft` / `published` / `archived` | Exists |
| Create / edit / publish / deactivate / archive service | Exists |
| Public URL `/forms/{key}` | Exists |
| Submit → `ingestLead` → `create_public_form_lead` | Exists |
| `source_data.public_form_id` + `qr_campaign_id` | Exists |
| QR destination `public_form` (many QR → one form) | Exists |
| Venue branding + form title (not Inquiry Form) | Exists |
| Draft/unpublished submit rejected | Exists (`get_public_form` published-only) |
| Legacy inquiry + tour QR | Untouched |

## Wave 2 seams (real gaps)

1. **Management list** — name/status/question count only. Missing public URL, QR count, lead count, copy/duplicate/archive from the list.
2. **Duplicate** — none.
3. **QR relationship on the form** — picker exists on QR page; form detail did not show associated codes or create-QR-for-this-form.
4. **Unpublished public URL** — `get_public_form` → `notFound()` (blank 404). Need honest branded unavailable page. QR to unpublished form already goes to `/qr/inactive` (not inquiry) — keep that.
5. **Lead visibility** — `source_data.public_form_id` already supports a count/list. No new reporting system.
6. **Historical answers** — already safe: answers live on `leads.source_data.custom_answers`; question replace only mutates `public_form_questions`.

## Not expanded

- No Inquiry Form migration
- No analytics dashboard
- No second QR system
- No second submission table
- No schema migration (Wave 1 lifecycle is sufficient)
