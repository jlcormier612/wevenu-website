# Existing-lead tour scheduling — preserve preferred event date

**Status:** GREEN on Sandbox (see also `EXISTING-LEAD-ELLIE-INCIDENT.md`, `CALENDAR-TOUR-LINK-GUIDANCE.md`)  
**Deployed tip:** `0122911f32c20b33ea99321d1df4ad7306cea3ce`  
**Prior tips:** `553c8687` (mode lock); `45290d6a` (API-path)  
**Blocked-date fix preserved:** `8e4f911e`  
**Production:** untouched  
**Observed:** 2026-10-12T02:58Z — existing-lead browser **27/27**; generic held-date **12/12**

---

## Workflow mismatch

Staff send an existing lead a Schedule Tour link (`/book/{tour_embed_key}?o={originToken}`). The public form still required Preferred event date using new-inquiry availability (`choose_available`). If that date was held or blocked, the visitor could not submit a tour even when tour slots were open.

## Root cause

1. **UI conflation:** Lead-aware booking already existed server-side (`book_public_tour_for_lead` attaches the tour, copies `leads.event_date` onto the appointment, does not update the lead or consume holds). The **UI** still rendered the preferred-date picker and client validation for `preferred_event_date: required`, gated by inquiry availability.
2. **Public `/book` 404 (discovered during verification):** Anonymous RLS blocks direct `venues` selects via cookie-bound `createClient()`. The page called `notFound()` before the form could render. Fixed by resolving `embed_key` with `createAdminClient()` (same trust boundary as `getPublicInquiryFormConfig`).

## Intended behavior

| Path | Behavior |
|---|---|
| Existing lead + `?o=` token + preferred date on file | Show date read-only; do not reselect; schedule tour independently |
| Existing lead + token + no preferred date | Allow tour without fabricating a date |
| Generic `/book/{key}` | Unchanged; no lead PII |
| New inquiry `/form/{key}` | Unchanged; blocked dates still enforced (`8e4f911e`) |

## Implementation

| File | Change |
|---|---|
| `lib/tours/existing-lead-tour-context.ts` | Server resolve context from HMAC `o=` token + venue embed key |
| `app/book/[key]/page.tsx` | Admin resolve embed_key; pass `existingLeadTour` into `InquiryForm` |
| `components/form/inquiry-form.tsx` | Read-only preferred date block; skip date requirement for existing-lead tour |
| `lib/tours/protection.ts` | Protected attach stores lead `event_date`, not client field |

## Tests

- Unit: `lib/tours/existing-lead-tour-context.test.ts` + `lib/availability/inquiry-tour-blocked-dates.test.ts` (13/13)
- Browser: `scripts/qa/existing-lead-tour-preferred-date-browser.mts` → `browser-results.json` (**21/21 GREEN**)
- Screenshot: `existing-lead-tour-form.png`

## Live Sandbox evidence (`45290d6a`)

| Check | Result |
|---|---|
| Read-only preferred date shown (`data-testid`) | PASS |
| Not forced to reselect calendar | PASS |
| Tour booked with empty client `eventDate` | PASS (`attachedExistingLead=true`) |
| Event date unchanged (`2027-12-25`) | PASS |
| Hold unchanged (`active` on preferred date) | PASS |
| No duplicate lead / no event created | PASS |
| Invalid token / unavailable slot / cross-venue rejected | PASS |
| Generic link exposes no lead context | PASS |
| Lead without preferred date: tour UI allowed | PASS |
| Reopen preserves context; no duplicate tour | PASS |
| New inquiry blocked Christmas still enforced | PASS |

Deploy run: https://github.com/jlcormier612/wevenu-website/actions/runs/38188584934

## Remaining availability-integrity risks (out of scope)

- Legacy public form paths that may not call `_is_event_date_available` (documented in recurring blocked-date incident).
- Staff preferred-date prechecks unrelated to this tour link.
- Do **not** declare platform-wide availability integrity GREEN solely because this tour workflow passes.
