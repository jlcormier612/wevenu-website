# Hello to Cheers — Starter Contract Implementation

**Customer-facing name:** Wedding Venue Agreement  
**Internal key:** `CTR-01`  
**Status:** Implemented on the existing D4/D6 Contract Domain (no second engine).

## Goal

Give every new venue a professionally structured, immediately usable agreement framework that:

- uses information Hello to Cheers already knows
- clearly marks where the venue must supply approved legal language
- can be customized, saved, applied, sent, signed, finalized, and PDF’d through the certified workflow

## Absolute legal safety

Hello to Cheers does **not** invent:

cancellation / rescheduling / termination, liability/indemnification, force majeure, insurance requirements, alcohol policy, damage fees, dispute resolution, governing law, refund rules, or any other legally consequential policy language.

Those sections use:

> Add your venue's approved … here.

## Starter structure

Canonical body: `lib/contracts/starters.ts` (`WEDDING_VENUE_AGREEMENT_CONTENT`)

1. Agreement introduction (factual)
2. Client & event details (merge tokens)
3. Event schedule (booking / timeline context)
4. Venue & spaces
5. Services & package
6. Included / additional items
7. Payment schedule
8. Venue policies (placeholders)
9. Client responsibilities (placeholder)
10. Venue responsibilities (placeholder)
11. Vendors & outside services (placeholder + optional vendors on file)
12. Food & beverage (placeholder)
13. Alcohol (placeholder)
14. Decor, setup & property (placeholder)
15. Insurance (placeholder)
16. Event-day requirements (placeholder)
17. Cancellation & termination / force majeure (placeholders)
18. Dispute resolution / governing law (placeholders)
19. Additional terms (placeholder)
20. Acknowledgment (non-assertive)
21. Signatures (existing signing system owns legal signature meaning)

Section-level initials are **not** configured by the starter — the certified signing path is typed name + consent (no section-initials product surface today). Documented as intentional.

## Merge-field / source-of-truth matrix

| Token | Source | Notes |
|---|---|---|
| `venue_name` | Venue | Required identity |
| `venue_address` / `phone` / `email` | Venue profile | Honest fallback if blank |
| `client_name` / `couple_name` | Client (+ partner) | `couple_name` kept as alias |
| `primary_contact_name` | Client primary | |
| `client_email` / `client_phone` | Client | |
| `event_name` | Event | Real name only |
| `event_date` / `event_type` / `guest_count` | Event (else client) | |
| `event_spaces` | `events.space_id` → venue spaces | Single-space model today |
| `coordinator_name` | Owner staff name | Fallback: “Your venue team” |
| `venue_access_hours` | Event start/end/setup/teardown | |
| `ceremony_summary` / `reception_summary` | Final Details questionnaire columns when present | Else honest “not listed yet” |
| `package_section` / included / additional | Event Order lines | Provenance package/inventory/custom |
| `payment_schedule_summary` / totals | Payment Plan for event | No recalculation engine |
| `vendors_on_file` | Event vendor assignments | Review list, not policy |
| `today_date` / `contract_title` | Generation context | |

Unknown optional values are **not** invented as legal facts. Operational “not on file yet” language is used so tokens do not ship unresolved.

## Template vs Working Contract

| | Template | Working Contract |
|---|---|---|
| Contains | Structure, placeholders, tokens | Merged client/event/booking facts + venue policy language |
| Independence | Edit does not change existing agreements | Edit does not change Library template |
| Isolation | Per-venue row + `source_master_key` | Snapshotted `content` at create |

## Safety gates

`assertCustomerSafeContractContent` (`lib/contracts/starters.ts`):

1. **Unresolved `{{tokens}}`** — block create (after merge) and send / finalize
2. **Untouched policy placeholders** (“Add your venue's approved…”) — block **send** and **finalize** (drafts may still contain them while the venue customizes)

Matches the spirit of message unresolved-token protection. Tokens are never silently blanked.

## Provisioning

- Migration: `supabase/migrations/20261270000000_contract_starter_library.sql` (`source_master_key`)
- `lib/contracts/provision.ts` — seed / ensure / add-again
- New venues: `seedContractStarters` from venue setup
- Library visit: `ensureContractStartersForCurrentVenue`
- Add again: never overwrites a customized copy
- Existing same-named templates preserved
- **Old legalistic `DEFAULT_TEMPLATE_CONTENT` is no longer the product starter** — constants re-export the Wedding Venue Agreement

## Permissions

Unchanged Owner / Manager / Coordinator / Staff RLS on `contract_templates` and contracts. Delete remains Owner/Manager gated.

## Lifecycle

Uses existing D4 path only:

Template → Working Contract → Edit → Preview → Send → Client Sign → Venue Finalize → Immutable PDF (Document Domain)

Amendment/clone via `createAmendmentFromContract` / supersede-on-finalize unchanged.

## PDF / branding

Existing `lib/contracts/pdf.ts` (@react-pdf/renderer). Venue logo/name/colors on the PDF. No Hello to Cheers brand on the customer document. Page-level `lineHeight` remains avoided (D4 pagination fix).

## UI

- Library cards: **Wedding Venue Agreement**, Starter badge, Edit / Use Template / Preview
- Template editor notice: this is your template; Hello to Cheers does not provide legal advice (venue-facing only)
- Placeholder text is obvious in the editor; blocked from client send until replaced

## Validation

| Check | Result |
|---|---|
| Unit: starters.test.ts | Placeholders detected; legalistic arbitration absent; merge + replace becomes send-safe |
| Schema | `source_master_key` migration |
| Provision | Ensure on Library; seed on venue create |
| Isolation | Master in code; venue rows independent; add-again non-destructive |
| Send safety | Placeholders / unresolved tokens blocked |
| Multi-space bookings | Current product has one `space_id` per event — documented |

## Genuine gaps (not deferred excuses)

- **Section initials:** existing product does not expose section-level initial configuration; starter does not invent it.
- **Multi-space presentation:** events have a single `space_id`; ceremony/cocktail/reception space lists use EO/questionnaire/context where available, not a fictional multi-space graph.
- **Existing production templates:** not overwritten. Old “Standard Venue Rental Agreement” rows already customized stay as customer work.

## Stop condition

Contract starter family only. No Event Order / Inventory / Timeline / Floor Plan / Packages / FAQ starters in this package.

## Product standard

Venue reaction: *“They already gave me a real contract structure — I just need to make it ours.”*  
Not: *“Why is my software writing legal terms for me?”*
