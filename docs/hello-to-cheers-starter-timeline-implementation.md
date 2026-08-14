# Hello to Cheers — Starter Timeline Templates Implementation

**Customer-facing names:** Timeline, Timeline Templates, Wedding Day Timeline, Reception Timeline, Working Timeline, Schedule  
**Internal keys:** `TL-01` (Standard Wedding Day), `TL-02` (Reception Only), `TL-03` (Wedding Weekend)  
**Status:** Implemented on the existing Timeline Templates + Working Timeline architecture (no second Timeline system).

## Product purpose

Give every Hello to Cheers venue three useful starting Timeline Templates they can open in the Library, preview as activities, customize, and apply to a booking’s Working Timeline — without inventing clock times and without merging Timeline with Tasks or Event Order.

## Customer mental model

| Term | Meaning |
|---|---|
| **Timeline Template** | Reusable day-of schedule structure the venue builds once |
| **Working Timeline** | This event’s live schedule (`timeline_entries`) |
| **Schedule** | Customer language for what guests/couple see when published |
| **Wedding Day Timeline / Reception Timeline** | Named starters for common shapes |

```
Library Timeline Templates → Apply → Working Timeline (independent snapshot)
```

## Timeline vs Tasks vs Event Order

| Domain | Owns | Does not own |
|---|---|---|
| **Timeline** | Ordered day-of activities, optional clock times, audiences, multi-day `dayOffset` | Task completion, consolidated ops document |
| **Tasks / Playbooks** | Planning & execution checklist work | Day-of run-of-show structure |
| **Event Order** | Consolidated operational document (sections/lines, PDF, share) — **existing D5C/D7A** | Authoritative schedule times (prefer Timeline); does not replace Timeline |

These remain **separate systems**. Starters do not merge them.

## Multi-day architecture — SUPPORTED

Confirmed in product code:

| Capability | Location |
|---|---|
| Event span | `events.event_date` + `event_end_date` |
| Working Timeline day banding | `timeline_entries.day_offset` (0-based from event start) — `lib/timeline/types.ts`, `lib/timeline/constants.ts` |
| Template day banding | `timeline_template_items.day_offset` |
| Apply copies day | `lib/timeline-templates/apply.ts` |
| Untimed entries | `timeOfDay` and `minutesOffset` both null → `entryTime` stays empty |

**Wedding Weekend (TL-03):**

| Offset | Band label (preview) | Content |
|---|---|---|
| 0 | Day Before | Rehearsal / welcome activities |
| 1 | Wedding Day | Full Standard Wedding Day structure |
| 2 | Day After | Pickup / closeout / follow-up |

No Gantt, no second calendar, no dependency graph.

## Starter contents

Masters live in `lib/timeline-templates/starters.ts` (code fixtures).

### TL-01 — Standard Wedding Day Timeline

Single-day (`dayOffset = 0`). Ceremony + reception activity sequence from venue access through event closeout. **No clock times.**

### TL-02 — Reception Only Timeline

Single-day (`dayOffset = 0`). Reception-at-venue path; on-site ceremony milestones omitted (not left as empty stubs). **No clock times.**

### TL-03 — Wedding Weekend Timeline

Multi-day (`dayOffset` 0 / 1 / 2). Day Before + Standard Wedding Day (offset 1) + Day After. **No clock times.**

## Source-of-truth matrix

| Information | Source of truth | Notes |
|---|---|---|
| Activity title / sequence on template | Venue `timeline_template_items` (copy of master) | Editable; masters never written |
| Activity title / sequence on event | Working `timeline_entries` | Snapshot on apply; no live link back |
| Clock times | Working Timeline (venue sets) | Starters seed `null` / empty — never invent |
| Event calendar span | Event `event_date` / `event_end_date` | Templates use offsets only |
| Planning checklist | Tasks / Playbooks | Separate |
| Consolidated ops doc / PDF | Event Order | Separate; EO may deep-link / note schedule, not replace Timeline |
| Inventory quantities / prices | Inventory / Working Inventory | Separate |
| Floor plan layout | Floor Plans | Separate |
| Vendor assignments | Vendor Network / assignments | Separate |
| Questionnaire answers | Questionnaire family | Separate |

## Template architecture, provisioning, isolation

| Layer | Source |
|---|---|
| Masters | `lib/timeline-templates/starters.ts` |
| Provision | `lib/timeline-templates/provision.ts` |
| Library CRUD | `lib/timeline-templates/repository.ts` + `service.ts` |
| Apply (library) | `lib/timeline-templates/apply.ts` |
| Apply (booking picker starters) | `lib/timeline/repository.ts` `applyTemplate` via `TIMELINE_TEMPLATES` |
| Booking picker constants | `lib/timeline/constants.ts` → `getBookingPickerStarters()` |

### Provisioning rules

Migration: `supabase/migrations/20261273000000_timeline_starter_library.sql`

- Adds `source_master_key` + unique `(venue_id, source_master_key)` where not null  
- Grants `service_role` select/insert/update on templates + items (venue-create seed)

Behavior:

1. **Skip if key exists** for venue (idempotent re-provision)  
2. **Skip if same name exists** (treat as customized / pre-existing — never overwrite)  
3. **Add Starter Again / Restore** creates a fresh copy when key is missing; if name collides uses `(Starter)` suffix  
4. Seed on venue create: `seedTimelineStarters` in `lib/venue/service.ts`  
5. Ensure on Library page open: `ensureTimelineStartersForCurrentVenue`  
6. Duplicate template does **not** copy `source_master_key` (insertTemplate defaults null)

### Isolation (A–E)

| Case | Expected |
|---|---|
| A. Edit Working Timeline | Template unchanged |
| B. Edit template | Existing Working Timelines unchanged |
| C. Two events from one template | Independent entry sets |
| D. Re-provision / ensure | No overwrite of key or same-name customs |
| E. Cross-venue | RLS `venue_id = current_user_venue_id()` — Venue A cannot read Venue B templates |

## Working Timeline, event date/time

- Apply appends entries (does not wipe existing) — existing picker confirm when entries already present  
- `minutesOffset: null` → no invented times (even if event start is set)  
- Relative offsets still resolve when present (import / hand-authored templates)  
- `dayOffset` is clamped to the event’s span when editing Working Timeline (existing helpers)

## Relationships (existing — not invented)

| Domain | Relationship |
|---|---|
| Tasks | Separate checklist engine; timeline submission can complete related stock tasks where already wired |
| Event Order | Consolidated ops doc; Event Schedule section may hold ops rows / prefer Timeline for truth |
| Floor Plan | Separate layout system; no auto-merge from Timeline starters |
| Inventory | Separate catalog / Working Inventory |
| Vendors | Audience tag `vendors` on entries when published; separate assignment model |
| Questionnaire | Couple planning answers; not Timeline structure |

## Permissions

Uses existing Owner / Manager / Coordinator / Staff model and timeline template RLS:

- `timeline_templates_all` / `timeline_template_items_all` — venue scoped  
- Delete gated by existing template delete permission normalization (`20261260000000_…`)  
- No new ACL invented

## UI surfaces

- `/library/timeline-templates` — ensure provision, Starter badge, Restore starters, activity preview (titles + weekend day grouping)  
- Template editor — unchanged editor; Starter badge on detail when `sourceMasterKey` present  
- Booking **Use Template** picker — starters aligned to TL-01/02/03 with null times  

Preview is presentation-only (titles from template items / masters). No fake event records written.

## Validation

### Automated

```bash
npx tsx --test lib/timeline-templates/starters.test.ts
```

Covers:

- Content + naming  
- No invented clock times  
- Weekend dayOffset 0/1/2 with Standard Wedding Day on offset 1  
- Provision skip rules  
- `resolveEntryTimeFromOffset(null)` stays null  

### Manual / DB

1. Apply migration; open Library → TL-01/02/03 appear  
2. Re-open Library → ensure creates nothing new  
3. Rename TL-01 → ensure does not recreate same key / does not overwrite rename  
4. Delete TL-02 → Restore starters recreates  
5. Apply TL-01 → Working entries have empty times + correct titles  
6. Apply TL-03 to multi-day event → day bands 0/1/2  
7. Cross-venue isolation  

## Intentional gaps / honest findings

| Topic | Status |
|---|---|
| Fake clock times in starters | **Not shipped** — activities only |
| Hardcoded corporate / birthday pickers | Removed from `TIMELINE_TEMPLATES` in favor of Hello to Cheers starters |
| Automatic EO ↔ Timeline sync | Not built (EO remains ops doc; Timeline remains schedule) |
| Delete RPC beyond existing RLS/gate | Not reinvented |
| Floor Plan / Packages / FAQs / Brochure / Reports starters | **Out of scope** — stop after Timeline |

## Stop condition

Timeline family complete. No Floor Plan, Packages, FAQs, BEO, Inventory, Brochure, or Saved Reports work started in this pass.
