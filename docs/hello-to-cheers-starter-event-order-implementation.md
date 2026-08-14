# Hello to Cheers — Starter Event Order Implementation

**Customer-facing name:** Event Order (BEO where useful as secondary industry terminology)  
**Internal keys:** `EO-01` (Standard Wedding), `EO-02` (Reception Only)  
**Status:** Implemented as a template layer on the existing D5C Event Order + D7A template architecture (no second Event Order system).

## Goal

Give every new Hello to Cheers venue a genuinely useful Event Order template they can open, understand, customize, apply to an event, populate from live event context, share, finalize, and PDF — without designing a BEO from scratch and without duplicating domain systems.

## Architecture (reuse, do not replace)

| Layer | Source |
|---|---|
| Working Event Order | D5C `lib/event-orders/*` — lifecycle, lines, sections, finalize, reopen |
| Templates | D7A `lib/event-order-templates/*` — sections + structural lines |
| Starters | `lib/event-order-templates/starters.ts` + `provision.ts` |
| Inventory handoff | D5A Working Inventory → Add to Event Order |
| Floor plan link | Existing section → floor plan association |
| PDF / share / portal | D5C `pdf.ts`, `representation.ts`, D5E ShareDialog |
| Branding | Venue logo/name/colors already used by Event Order PDF |

Templates remain **structure only** (section names + operational starter lines with qty 1 / $0). They do **not** store merge tokens or fake event data. Live Event / Payment / Vendor / Timeline context is displayed on the Working Event Order and PDF from authoritative domains.

## Starter variants

### EO-01 — Standard Wedding Event Order

Library card description:

> A complete starting point for organizing the details your team needs to prepare for and run a wedding. Customize the sections and information to match the way your venue operates.

Sections (fixed order):

1. Event Overview  
2. Event Schedule  
3. Ceremony  
4. Reception  
5. Food & Beverage  
6. Rentals & Inventory  
7. Room Setup  
8. Vendor Team  
9. Vendor Arrival & Load-In  
10. Staffing & Venue Responsibilities  
11. Client Requests & Special Notes  
12. Decor & Setup  
13. Client-Provided Items  
14. Payment Summary  
15. Final Event Readiness  
16. Day-of Notes  
17. Event Closeout  

### EO-02 — Standard Wedding — Reception Only

Same architecture. **Ceremony section omitted** (not left empty). Ceremony row removed from Event Schedule starter activities.

## Source-of-truth matrix

| Event Order Section | Information | Existing Source | EO Owns It? | Display / Reference | Editable on EO? | Destination |
|---|---|---|---|---|---|---|
| Event Overview | Event name | Event | No | Live overview card + PDF header context | No (edit on Overview) | Event |
| Event Overview | Client | Client / Event | No | Live overview card + PDF | No | Client / Event |
| Event Overview | Event date | Event | No | Live overview + PDF | No | Event |
| Event Overview | Event type | Event | No | Live overview | No | Event |
| Event Overview | Venue | Venue | No | Live overview + PDF branding | No | Venue |
| Event Overview | Guest count | Event | No | Live overview + PDF | No | Event |
| Event Overview | Coordinator | Venue team / booking (when present) | No | Not invented as a token if unsupported | Via team/booking surfaces | Team / Event |
| Event Overview | Spaces | Event / booking | No | Live overview (`spaceName`) | No | Event / Spaces |
| Event Overview | Ops checklist lines | Template → Working EO lines | Yes (notes/process) | Lines | Yes while Open | EO lines |
| Event Schedule | Starter activity labels | Template | Yes as ops rows | Lines | Yes | EO; Timeline remains schedule engine |
| Event Schedule | Actual times / timeline | Timeline / event schedule | No for truth | Prefer Timeline deep-link; do not invent second Timeline | Change EO note rows only | Timeline |
| Ceremony / Reception | Location / start | Event / questionnaire / timeline | No | Overview times when present | Structural setup lines yes | Event / Timeline / Qs |
| Ceremony / Reception | Setup categories | Template / EO | Yes as ops structure | Lines | Yes | EO lines |
| Food & Beverage | Meal / bar structure | Template / EO | Ops structure yes | Lines | Yes | EO; package/inventory for commercial items |
| Food & Beverage | Menus / pricing / policies | Package / Inventory / Venue policy | No | Use package/inventory handoff; no invented policies | Via Add line | Package / Inventory |
| Rentals & Inventory | Categories / line items | Working Inventory (D5A) | Snapshot lines yes after add | Add from Inventory; starter examples replaceable | Yes while Open | Working Inventory → EO |
| Rentals & Inventory | Prices / quantities used financially | D5A handoff + EO line math | Line amounts yes after add | Existing EO total | Via inventory/add line | Financial pipeline |
| Room Setup | Floor plan | Floor Plan system | Link only | Section floor-plan picker | Link, not second editor | Floor Plan |
| Vendor Team | Vendors / contacts | Vendor Network | No | Deep-link to Vendors tab | Do not re-key | Vendors |
| Vendor Arrival & Load-In | Arrival/load-in notes | EO ops + vendors | Ops notes yes | Lines | Yes | EO / Vendors |
| Staffing | Roles / responsibilities | Team / EO notes | Ops yes | Lines | Yes | Team / EO |
| Client Requests | Special moments / requests | Client Planning / Final Details / EO notes | Prefer questionnaire domain | Deep-link + optional EO notes | Notes yes; don't force copy | Questionnaires / EO |
| Decor / Client-Provided | Categories | Template / EO | Yes ops | Lines | Yes | EO |
| Payment Summary | Contracted / paid / balance / next due | Invoices / Payment Plan | **No** | Live Payment Summary card (invoice aggregates) | No | Invoices |
| Final Event Readiness | Completion of real workflows | Tasks / Playbooks / domain tabs | **No fake checkbox SoT** | Deep-links to Overview, Inventory, Floor Plan, Vendors, Timeline, Payments | Complete work in destination | Domain workflows |
| Day-of / Closeout | Operational notes | EO | Yes as notes | Lines | Yes | EO (notes only; no false closeout workflow) |

**Snapshot / mutability:** Working Event Order lines are independent copies after apply (D7A: apply-once). Overview/Payment cards remain live until PDF share uses the D5C finalized representation rules. Finalized EO immutability preserved; reopen follows existing D5C behavior.

## Template → Working Event Order

Flow:

Library → Event Order Templates → Standard Wedding Event Order → (customize/save) → Event → Event Order tab → choose template → Start Event Order → sections/lines copied as custom lines → overview/payment read live from Event / invoices.

Isolation (existing D7A / D5A lineage):

1. Edit Working EO → template unchanged  
2. Edit template → existing Working EO unchanged  
3. Two Working EOs from one template → independent  
4. Duplicate template → independent copy (`source_master_key` not copied onto duplicates from `duplicateTemplate`)  
5. Inventory template edits do not rewrite existing Working Inventory / EO lines  

## Provisioning

- Migration: `supabase/migrations/20261271000000_event_order_starter_library.sql` (`source_master_key` + unique venue/key index)
- Seed on venue create: `seedEventOrderStarters` in `lib/venue/service.ts`
- Ensure on Library page open: `ensureEventOrderStartersForCurrentVenue`
- Same-name D7 leftovers: **skipped** (never overwrite customized / pre-existing templates)
- Restore starters menu: available when a master key is missing (after delete); never overwrites an existing key-backed copy

## UI surfaces

- Library list: Starter badge, Restore starters menu, descriptions from masters  
- Working Event Order panel: Event Overview card, Payment Summary card, Final Event Readiness deep-links  
- Apply template: existing event-scoped selector (explicit Start Event Order)  
- PDF / Share / Client portal: unchanged D5C/D5E pipelines  

## Permissions & isolation

Uses existing Event Order Templates RLS + Owner/Manager delete gate. No RLS weakening. Venue isolation continues via `venue_id` on templates and event orders.

## Validation

### Automated

```bash
npx tsx --test lib/event-order-templates/starters.test.ts
```

Covers section order, Reception Only omitting Ceremony, and absence of fake event-specific seed values.

### Manual / DB (development)

- Provision EO-01 / EO-02 on both local venues without overwriting same-named customs  
- Master protection via unique `(venue_id, source_master_key)`  
- Apply EO-01 to an event → sections present → template unchanged after EO edit  
- Payment Summary matches invoice totals for that event  
- Inventory Add to Event Order still produces one EO line / no duplicate totals  
- Share + PDF still white-labeled to venue  
- Cross-venue: Venue A cannot read Venue B templates / EOs  

## Intentional gaps (honest)

| Topic | Status |
|---|---|
| Merge tokens inside template lines | Not used — overview/payment are live panels, not token fields |
| Automatic bidirectional sync EO schedule ↔ Timeline | Timeline remains schedule engine; EO has starter activity rows / deep-link |
| Fake completion checkboxes that mirror task status | Not built — readiness is deep-links to real work |
| Coordinator field when no team assignment exists | Not invented as a token |
| Multi-space list beyond current event `spaceId` | Displays current space name; multi-space is broader booking capability |
| Replacing customized D7 template content in place | Not done — same-name skip preserves customer data |

## Do not start next

Inventory Starters, Task/Planning Starters, Timeline Starters, Floor Plan Starters, Packages, FAQs, Brochure, Saved Reports — out of scope for this pack.

## Files

- `lib/event-order-templates/starters.ts`
- `lib/event-order-templates/provision.ts`
- `lib/event-order-templates/starters.test.ts`
- `lib/event-order-templates/{types,repository}.ts` — `sourceMasterKey`
- `supabase/migrations/20261271000000_event_order_starter_library.sql`
- `app/(app)/library/event-order-templates/{page,actions}.ts(x)`
- `components/event-order-templates/event-order-template-list.tsx`
- `components/event-orders/event-order-panel.tsx` — SoT cards + readiness links
- `lib/venue/service.ts` — seed wiring
- This doc
