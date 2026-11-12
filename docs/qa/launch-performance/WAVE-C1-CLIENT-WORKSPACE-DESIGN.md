# Wave C1 — Client / EventDetail data-loading design (NO IMPLEMENTATION)

**Status:** Design only — **do not implement** until Lead optimize is approved  
**Date:** 2026-11-12  
**Depends on:** Lead optimize branch proving KEEP-worthy gains

---

## Why Client is harder than Lead

| Factor | Lead | Client / EventDetail |
| --- | --- | --- |
| Shell | `LeadDetail` tabs | Heavy `EventDetail` interaction model |
| Domains | Docs, Luv, notes, tasks, journey | Floor plans, seating, vendors, EO, inventory, questionnaires, timeline, release gates |
| Money | Journey display | Schedules, invoices, portal, booking handoff |
| Inheritance | Limited | Setup Profile → event resources |

Rewriting EventDetail interaction is **out of scope** for C1.

---

## Proposed Overview minimum

Authorize + identity first (`getClient` / event membership + venue RLS).

Overview useful content likely needs:

1. Client + event identity, stage, dates, spaces  
2. Booking / commercial journey (scoped contracts — never venue-wide)  
3. Payment schedule summary for linked client (not full invoice bodies)  
4. Attention / release indicators that gate Planning  

Defer until tab (or idle after Overview paint):

| Pack | Contents | Trigger |
| --- | --- | --- |
| Floor plan / seating | Plans, tables, assignments | Floor Plans tab / hover |
| Vendors | Assignments + inquiry state | Vendors tab |
| Event Order + inventory | EO lines, inventory links | EO / Inventory tabs |
| Questionnaires | Forms + answers | Questionnaires tab |
| Documents | Workspace docs + pins | Documents tab |
| Timeline | Timeline items | Timeline tab |
| Full payment detail | Line edits, send history | Payments deep panel |

Shared dependencies that must stay request-scoped (`cache`) and venue-bound:

- `getCurrentVenue`  
- Client/event identity  
- Staff role / release permissions  

---

## EventDetail coupling

Prefer **pack loaders beside EventDetail** (props / children Suspense) over a second global store.

Do **not**:

- Duplicate EventDetail state machines  
- Optimistic contract/payment/booking success  
- Cross-venue caching  

Deep links (`?tab=`, `#hash`) must either eager-fetch the target pack or show honest pending on first paint of that tab.

---

## Regression risks

- Floor plan edit races if plan pack reloads mid-drag  
- Seating persistence vs stale pack  
- Release/preview permission flaps  
- Setup Profile inheritance appearing empty until deferred pack loads  
- Financial totals mismatch if journey uses different contract scope than Documents  

---

## Gate to implement

Lead optimize must show **KEEP** on Overview useful-content **and** Overview→Documents workflow without material regression, with authz/stale tests green — then open a separate Client design-implementation brief.
