# Public Forms + QR — Wave 1 STATUS

## Verdict

**WAVE 1 = GREEN**

## Commit / deploy

| Item | Value |
|------|-------|
| Commit | `4446af99` — *Add purpose-specific Public Forms with QR destination (Wave 1).* |
| Branch | `feature/public-forms-qr-wave1` |
| Migration | `20261407600000_public_forms_wave1.sql` |
| Migration run | https://github.com/jlcormier612/wevenu-website/actions/runs/36259163776 — **success** |
| Deploy run | https://github.com/jlcormier612/wevenu-website/actions/runs/36259165687 — **success** |
| ECS task | `htc-sandbox-venue-app:398` |
| Production | **untouched** |

## SMS consent policy (Wave 1)

Custom Public Forms **do not** collect SMS consent.

- Phone on a Public Form is contact information only.
- Phone ≠ SMS consent.
- Explicit SMS consent remains on the venue inquiry form only.
- `/api/public/forms/submit` does **not** call `applyInquiryCommunicationCapture`.

## Architecture shipped

- `public_forms` + `public_form_questions` (venue-owned, RLS)
- Public route `/forms/{public_key}` (distinct from `/form/{embed_key}`)
- Submit → TypeScript `ingestLead` → `create_public_form_lead` → SQL `ingest_lead`
- QR `destination_type = public_form` + nullable `public_form_id` (many QR → one form)
- Library builder + QR destination picker (create new / choose existing)
- Venue branding inherited (logo, colors, footer)

## Tests / typecheck

- `npx tsx --test lib/public-forms/wave1.test.ts lib/public-forms/public-path.test.ts lib/qr-campaigns/archive-ui-state.test.ts` → **23/23 pass**
- `tsc --noEmit`: **no new Wave 1 errors** (2 pre-existing unrelated errors remain in inbox tests)

## QA fixtures (Jen's Fancy Venue)

| Object | ID |
|--------|----|
| Venue | `a415ac52-cd74-42a6-8df7-7a8f6e71d080` |
| Public Form | `5f4ab426-6fca-4a5c-ab9d-924f9171c4b4` |
| Public key | `35a56b1d565ff8d49287e1d2abb3870c` |
| Public URL | https://app.sandbox.hellotocheers.com/forms/35a56b1d565ff8d49287e1d2abb3870c |
| QR campaign (Entrance) | `70bb03ba-b3bb-4292-9ff5-f5e93b9116b9` (`e56175492a291771`) |
| QR campaign (Booth) | second campaign same `public_form_id` (see `multi-qr-same-form.json`) |
| Browser lead (direct) | `082b78e5-fb00-4e60-afc4-3106b801e829` |
| Browser lead (QR-attributed) | `fa6c85c3-95d5-437c-ab41-72a97260e50e` |
| RPC lead (API proof) | `77c69ad8-9a08-4907-80ee-67b4e068ea45` |

## Browser QA

- Builder list + detail: **pass** (`01-builder-list.png`, `02-builder-detail.png`)
- Public form branding / title / description / question order: **pass**
- Required validation: **pass**
- Direct submit → confirmation: **pass**
- QR resolve → `/forms/{key}?qr=…`: **pass**
- QR-attributed submit with `public_form_id` + `qr_campaign_id`: **pass**
- QR analytics scans/conversions still increment: **pass** (scans 4, conversions 2)
- Legacy inquiry QR → `/form/{embed}?qr=…`: **pass**
- Legacy tour QR → `/book/{key}?qr=…`: **pass**
- No client created for new relationships: **pass** (`clientsForRelationship: 0`)

## Security / RLS proof

- Bogus public key → `get_public_form` `ok: false`
- Draft/inactive form → submit rejected (`Form is not available.`)
- Lead `venue_id` matches Fancy only
- Management gated to owner/manager; queries scoped by `venue_id`

## Intentionally out of scope (stopped)

- Inquiry form migration
- Analytics dashboards
- Production deploy
