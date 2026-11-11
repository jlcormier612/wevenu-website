# Proposal customer-facing brand name — forensic audit

**Date:** 2026-09-28  
**Venue fixture:** Jen's Fancy Venue / Fancy Venue LLC  
**Status:** Defect confirmed. Isolated to Proposal email identity resolution.

## Authoritative settings contract

Business & Brand (`components/setup/setup-steps.tsx`):

| UI label | Column | Example | Intended use |
| --- | --- | --- | --- |
| Venue name | `venues.name` | Jen's Fancy Venue | Customer-facing identity |
| Legal business name | `venues.business_name` | Fancy Venue LLC | "Used on contracts and invoices." |

These are two distinct persisted fields. Do not collapse them.

## Defect

`submitProposalCoupleEmail` selected `name, business_name` then **preferred `business_name`**:

```ts
const venueName = (venue?.business_name)?.trim()
  || (venue?.name)?.trim()
  || "Your venue";
```

That value is the shared source for:

- email subject: `{venue} sent you a proposal`
- email body headline
- "A note from {venue}"
- email footer signature

Observed customer-facing result: **"Fancy Venue LLC sent you a proposal."**

That is the legal name, not the venue name.

## Surface audit

| Surface | What is shown | Authoritative source | Correct? |
| --- | --- | --- | --- |
| 1. Proposal creation (staff) | Preview venue line | `getCurrentVenue().name` via `lib/booking-journey/load.ts` | Yes |
| 2. Proposal review / preview | Same as couple page | `buildDraftOfferView({ venueName })` ← `venues.name` | Yes |
| 3. Proposal send | Publishes then emails | `sendCommercialProposal` → `submitProposalCoupleEmail` | Email wrong |
| 4. Proposal email body | `{venue} sent you a proposal` | **was `venues.business_name`** | **No** |
| 5. Email subject | `{venue} sent you a proposal` | same resolver | **No** |
| 6. Email From / display name | Platform `FROM_EMAIL` (e.g. `Hello to Cheers <jennifer@hellotocheers.com>`) | `lib/email/send.ts` env — no per-venue From | N/A (not legal name; platform sender) |
| 7. Email Reply-To | Venue contact email | `venues.email` | Yes |
| 8. Couple offer page `/offer/{token}` | Venue line under "Your proposal" | RPC `get_commercial_proposal_by_accept_token` → `select v.name` | Yes |
| 9. Option/package presentation | Package names / prices | proposal options | N/A (not venue identity) |
| 10. Approval / selection messaging | "You approved this selection" | offer view; no venue legal name | Yes |
| 11. After open branding | Colors from `venues.primary_color` etc.; name from `v.name` | `enrichBrand` + RPC | Yes |
| 12. Subsequent couple emails | Resend uses same `submitProposalCoupleEmail` | same resolver | **was No** |
| 13. Withdraw / reject | No couple email; venue activity only | `withdrawCommercialProposal` | N/A |
| 14. Selection/approve notices | Venue-staff notifications ("A couple selected…") | `_notify_proposal_selected` | N/A (not couple-facing venue identity) |
| 15. Legacy Path B offer token | `venueName` | `get_commercial_selection_by_accept_token` → `v.name` | Yes |
| 16. Contract PDF | Document header | `businessName \|\| name` | Yes — legal intended |
| 17. Invoice print | Document header | `businessName ?? name` | Yes — legal intended |

## What is not the bug

- Offer page SQL already uses `venues.name`.
- Staff preview already uses `venues.name`.
- Contracts and invoices already prefer `business_name` / `businessName` by design.
- From: address is platform-level (`FROM_EMAIL`), not the legal business name.

## Implementation rule

Shared resolver: `customerFacingVenueName()` in `lib/venue/identity.ts`.

- Customer-facing Proposal communications: `venues.name` only. Never fall back to legal name.
- Legal documents: keep existing `legalDocumentVenueName` / current contract+invoice preference.

Do not invent a second venue-name column.
Do not mutate `venues.business_name`.
