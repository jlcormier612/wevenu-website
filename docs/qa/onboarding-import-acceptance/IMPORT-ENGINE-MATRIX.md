# Import engine matrix — Bring Your Business

Verified against repository code on tip `0b3838d3` (Sandbox serving) and live browser runs in this folder.

## How paths reach Migration Center

| Bring Your Business UI choice | Destination | Intake resume shortcut |
|---|---|---|
| Continue with that source (HoneyBook intake) | `/settings/migration?source=honeybook` | Shown when `venue_onboarding_intake.bring_business_choice = honeybook` |
| Import my business: HoneyBook | `/settings/migration?source=honeybook` | Same lane as resume |
| Import my business: Tripleseat | `/settings/migration?source=tripleseat` | Same pattern for Tripleseat intake |
| Import my business: another system | `/settings/migration?source=another_system` | Maps to `generic_csv` profile |
| Add things individually | Sets hub path `individual` + link to `/settings/import` | Not an importer; spreadsheet Import is optional |
| Skip for now / start fresh | Sets hub path `skipped` | Intake `starting_fresh` only changes copy; Migration Center still reachable later |

Source of truth for hub completion: `isBringYourBusinessComplete` — complete when migration import exists **or** path is `individual` / `skipped`. Intake choice is acknowledged, not a second SoT.

## Are HoneyBook and Tripleseat different engines?

**Yes — different source adapters on the same Migration Center CSV pipeline.** They are not separate full-stack importers (no live API/OAuth, no distinct commit/session stack).

| Capability | HoneyBook (`lib/migration/sources/honeybook.ts`) | Tripleseat (`lib/migration/sources/tripleseat.ts`) | Another system (`generic-csv`) |
|---|---|---|---|
| Recognition | Header contains `honeybook`, **or** combined Name + email/phone/address **without** first/last columns | Header contains `tripleseat`, **or** `account_id`/`lead_source`/`contact_type` + contact cluster, **or** literal `Full_name` + contact cluster | Always available; field-mapping driven |
| Unique normalize behavior | Splits combined `name` via `splitName`; low-confidence splits → needs_review | Defers to generic when first/last already split; Full_name uses same `splitName` | Column mapping + generic normalize |
| Supported entity types (adapter-specific) | `client`, `lead` only; vendor → generic; other entities rejected by adapter | Same as HoneyBook | Clients, leads, vendors, events, tours, holds, blocks, packages, documents, specialized entities per MC |
| File format | CSV only (MC file input `accept=".csv"`) | CSV only | CSV only in Migration Center; small lists also via `/settings/import` |
| Live connection | Never | Never (file-based Phase 1 only) | Never |

## Record types each path actually supports

- **HoneyBook / Tripleseat adapters:** contact-like **clients** and **leads** only. Events, calendar commitments, vendors, packages, documents are **not** HoneyBook/Tripleseat-specific — customer must use Another system / generic entity pickers (or Import Data) for those.
- **Another system:** full Migration Center entity menu (clients, leads, vendors, events, tours, holds, blocks, packages, documents, specialized follow-ons where enabled).
- **Add individually:** normal app create flows + optional `/settings/import` spreadsheet wizard — does not auto-create sample clients.
- **Skip:** no records created; hub marked complete via `skipped` path.

## Customer-facing honesty requirements

- UI must not imply a live HoneyBook/Tripleseat login.
- UI must not claim Tripleseat imports bookings/events unless/until that adapter scope ships.
- “Continue with that source” and explicit HoneyBook must land on the same HoneyBook lane.
- Switching sources after intake is supported (BYB copy: “You can still pick a different path below”).
