# Existing-lead tour scheduling — preserve preferred event date

**Status:** implementing → verify on Sandbox deploy  
**Sandbox tip (pre-deploy):** `8e4f911e…` (blocked-date fix preserved)  
**Production:** untouched

---

## Workflow mismatch

Staff send an existing lead a Schedule Tour link (`/book/{tour_embed_key}?o={originToken}`). The public form still required Preferred event date using new-inquiry availability (`choose_available`). If that date was held or blocked, the visitor could not submit a tour even when tour slots were open.

## Root cause

- Lead-aware booking **already** existed server-side: `book_public_tour_for_lead` attaches the tour, copies `leads.event_date` onto the appointment, and does **not** update the lead or consume holds.
- The **UI** still rendered the preferred-date picker and client validation for `preferred_event_date: required`, gated by inquiry availability — conflating event date with tour slot selection.

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
| `app/book/[key]/page.tsx` | Pass `existingLeadTour` into `InquiryForm` |
| `components/form/inquiry-form.tsx` | Read-only preferred date block; skip date requirement for existing-lead tour |
| `lib/tours/protection.ts` | Protected attach stores lead `event_date`, not client field |

## Tests

- `lib/tours/existing-lead-tour-context.test.ts`
- Existing `lib/availability/inquiry-tour-blocked-dates.test.ts` (still pass)
- Browser: `scripts/qa/existing-lead-tour-preferred-date-browser.mts` → `browser-results.json`

## Evidence (fill after deploy)

| Item | Value |
|---|---|
| Deployed SHA | _pending_ |
| Browser verdict | _pending_ |
| Event date / hold unchanged | _pending_ |
| `8e4f911e` still in tip ancestry | yes (must remain) |

## Remaining availability-integrity risks (out of scope)

- Legacy public form paths that may not call `_is_event_date_available` (documented in recurring blocked-date incident).
- Staff preferred-date prechecks unrelated to this tour link.
