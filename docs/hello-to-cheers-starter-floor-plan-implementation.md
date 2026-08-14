# Hello to Cheers — Starter Floor Plan Templates + Collaborative Floor Plan Implementation

**Customer-facing names:** Floor Plan Template, Working Floor Plan, Ready, Review, Make Changes, Share Floor Plan, Share for Seating  
**Internal keys:** `FP-01` (Standard Wedding — Ceremony + Reception), `FP-02` (Standard Wedding — Reception Only)  
**Status:** Implemented on the existing Floor Plan Templates + Working Floor Plans + Seating/portal architecture (no second Floor Plan / CAD / collab engine).  
**Stop condition:** Floor Plan family only — Packages, FAQs, Inventory, Timeline, Event Order, Brochure, and Saved Reports were **not** started in this pass.

---

## Product purpose

Give every Hello to Cheers venue two useful starting Floor Plan Templates they can open in the Library, preview with the real Floor Plan shape renderer, customize (including real room dimensions), and apply to a booking’s Working Floor Plan — then collaborate with the couple using the **existing** portal / Seating model.

Illustrative layouts only. Masters do **not** claim real venue dimensions, fire code, ADA, exits, bar/kitchen placement, or capacity ratings.

---

## Capability matrix

| Capability | Existed before this pass | Implemented here | Genuine gap (honest) |
|---|---|---|---|
| Floor Plan Templates table + objects | Yes (`floor_plan_templates`, `floor_plan_template_objects`) | — | — |
| Working Floor Plans on events | Yes (`floor_plans` / `floor_plan_objects`) | — | — |
| Apply template → independent Working FP snapshot | Yes (`applyTemplate`) | — | — |
| Studio Lite editor (template + booking modes) | Yes (`floor-plan-editor.tsx`) | — | — |
| Shape library (arbor, aisle, cocktail, dj_booth, …) | Yes (`floor-plan-shapes.tsx`) | Used by FP-01/02 masters | — |
| Hello to Cheers starter masters + provision | **No** | `starters.ts` + `provision.ts` + migration | — |
| `source_master_key` + idempotent ensure / seed / restore | **No** for FP | Migration + Library ensure + venue seed + Restore starters | — |
| Library Starter badge + real SVG preview | Partial (cards, no starters/preview) | Badge + card + sheet using `FloorPlanLayoutPreview` | — |
| Couple **views** shared Floor Plan | Yes (`shared_with_couple`) | Language polish only where touched | — |
| Couple **seats** guests on shared tables | Yes (Seating / `client_access`) | Unchanged | — |
| Couple **edits furniture / placement** | Reserved (`client_access = 'edit'`) — **not built** | **Not invented** | Couples do not rearrange tables |
| Formal “submit layout for Review” / Requests bridge | Enum reserved historically | **Not invented** | No Floor-Plan-sourced Request workflow |
| Ready checkpoint (non-locking) | Yes (`finalized_at` + Ready UI) | Confirmed; “Make Changes” label; no Final regression | Immutability still **not** enforced (correct) |
| Element-level permissions | **Absent** | Not invented | Venue-scoped RLS only |
| Guest-count → auto seating / auto layout | **Absent** | Not invented | By design |
| Cross-system auto-sync Inventory / EO / Timeline | Informational inventory usage + EO reconciliation already | Not expanded | Separate systems remain separate |
| Optimistic concurrency / etag on FP edits | **Absent** | Documented only | Last-write-wins if concurrent editors |

---

## Divergence from `STARTER-LIBRARY.md` §5.L

The pack document still lists a single **FP-01 Reception — Rounds (150)**.  
This implementation follows the **approved execution brief** for finished product:

| Key | Shipped name |
|-----|----------------|
| FP-01 | Standard Wedding — Ceremony + Reception |
| FP-02 | Standard Wedding — Reception Only |

Update the pack doc in a separate content pass if product wants the two names consolidated there.

---

## Customer mental model

| Term | Meaning |
|---|---|
| **Floor Plan Template** | Reusable room layout in the Library |
| **Working Floor Plan** | This event’s live layout (`floor_plans`) |
| **Share Floor Plan** | Couple sees layout (view only) |
| **Share for Seating** | Couple assigns guests to tables on that plan |
| **Ready** | Venue checkpoint that the Working Floor Plan is print/setup-ready — **not** a lock |
| **Make Changes** | Clears Ready so staff continue editing |

```
Library Floor Plan Template → Apply → Working Floor Plan (independent snapshot)
Venue edits room / furniture → Share Floor Plan (view) + Share for Seating
Couple seats guests → venue reviews → corrections → Mark as Ready
```

---

## Starter contents

Masters live in `lib/floor-plan-templates/starters.ts` (code fixtures).

### FP-01 — Standard Wedding — Ceremony + Reception

Description (exact):  
“A flexible starting layout for a wedding with both a ceremony and reception. Customize the room, seating, and other elements to match your venue and the event.”

Illustrative canvas: **80 ft × 50 ft** (placeholder only — venue resizes on their copy).

Zones (Ceremony → Cocktail → Reception) using supported object types / display shapes:

- Ceremony: arbor, aisle, ceremony seating rows, reserved seating  
- Cocktail: cocktail tables + cocktail bar + zone label  
- Reception: guest rounds, sweetheart, dance floor, DJ/band, bar, cake, gifts  

### FP-02 — Standard Wedding — Reception Only

Description (exact):  
“A flexible starting layout for a wedding reception at your venue. Customize the room, seating, dance floor, service areas, and other elements to match your space and event.”

Illustrative canvas: **60 ft × 40 ft** (placeholder only).

Intentional reception-only layout — **no** arbor/aisle/ceremony rows disguised as hidden ceremony.

No `inventory_item_id` on starters (venues may source inventory after customize).

---

## Template architecture, provisioning, isolation

| Layer | Source |
|---|---|
| Masters | `lib/floor-plan-templates/starters.ts` |
| Provision | `lib/floor-plan-templates/provision.ts` |
| Library CRUD | existing `repository.ts` + `service.ts` |
| Apply | existing `lib/floor-plans/service.ts` `applyTemplate` |
| Preview SVG | `components/floor-plan/floor-plan-layout-preview.tsx` (real shape renderer) |

Migration: `supabase/migrations/20261274000000_floor_plan_starter_library.sql`

- Adds `source_master_key` + unique `(venue_id, source_master_key)` where not null  
- Grants `service_role` select/insert/update on templates + objects (venue-create seed)

### Provisioning rules

1. **Skip if key exists** for venue (idempotent re-provision)  
2. **Skip if same name exists** (treat as customized / pre-existing — never overwrite)  
3. **Add Starter Again / Restore** creates a fresh copy when key is missing; if name collides uses `(Starter)` suffix  
4. Seed on venue create: `seedFloorPlanStarters` in `lib/venue/service.ts`  
5. Ensure on Library page open: `ensureFloorPlanStartersForCurrentVenue`  
6. Duplicate template does **not** copy `source_master_key`

### Isolation (A–E)

| Case | Expected |
|---|---|
| A. Edit Working Floor Plan | Template unchanged |
| B. Edit template | Existing Working Floor Plans unchanged |
| C. Two events from one template | Independent object sets |
| D. Re-provision / ensure | No overwrite of key or same-name customs |
| E. Cross-venue | RLS `venue_id = current_user_venue_id()` — Venue A cannot read Venue B templates |

---

## Collaborative workflow status

| Step | Status |
|---|---|
| Venue creates Working FP from template | **Supported** |
| Venue establishes room / venue elements | **Supported** (editor + room settings) |
| Shares layout with couple | **Supported** (Share Floor Plan — view only) |
| Couples arrange **seating** | **Supported** (Share for Seating → portal Seating) |
| Couple saves seating | **Supported** (portal seating APIs) |
| Couple rearranges furniture / tables | **Gap** — not supported; architecture forbids blurring Venue-Owned floor objects |
| Couple “submits layout for Review” as a formal state | **Gap** — no Request / submission engine wired for Floor Plans |
| Venue reviews & corrects Working FP | **Supported** (venue editor; seating remains couple-owned) |
| Venue marks Ready | **Supported** (non-locking Ready / Make Changes) |

**Overall journey: partial / supported along the ownership model that already ships** — furniture Author/Editor stays with the venue; seating Author/Editor-within-bounds stays with the couple. This is the finished collaborative product for Floor Plans in this architecture, not a symmetric co-edit canvas.

Offer Layouts (Phase 2 couple choose-among-templates) remains available and unchanged.

---

## Ready status language confirmation

| Surface | Language |
|---|---|
| Working FP control | **Ready** badge; **Mark as Ready** / **Make Changes** |
| DB column | still `finalized_at` (internal) — does **not** gate editing |
| Completion confirm copy | “no Floor Plan is marked Ready” (not “finalized”) |

**No regression to customer-facing “Final”** for Floor Plan checkpoints. Immutability was never enforced and was not invented.

---

## Concurrency assessment

Venue staff and the couple do **not** co-edit the same furniture graph:

- Couple seating writes `guest_seat_assignments` (separate)  
- Couple Floor Plan view is read-only  
- Venue object updates are last-write-wins via ordinary `UPDATE` (no `updated_at` / etag precondition)

**Risk:** two venue users editing the same Working Floor Plan object concurrently can overwrite each other.  
**Fix applied:** none — no existing Floor Plan optimistic-concurrency pattern to extend. Documented only.

---

## Permissions & RLS

Uses existing Owner / Manager / Coordinator / Staff venue membership and:

- `floor_plan_templates_all` / `floor_plan_template_objects_all` — `venue_id = current_user_venue_id()`  
- Working plans: existing venue-scoped policies  
- Couple access: portal SECURITY DEFINER RPCs / routes only  

No element-level ACLs invented. Role delete gates remain whatever the shared template-delete normalization already enforces.

Cross-venue isolation: same RLS pattern as Timeline / Inventory starters — verify with two venues after migration when DB access is available.

---

## Relationships (existing — not invented)

| Domain | Relationship |
|---|---|
| Seating | Tables = `floor_plan_objects`; guest assignments separate |
| Inventory | Optional `inventory_item_id` on placements; starters ship unlinked |
| Event Order | Phase 4 count reconciliation when both reference inventory — not auto-layout |
| Timeline | Separate schedule system |
| Guest count | Event / questionnaire fields — no auto table generation |

---

## UI surfaces

- `/library/floor-plan-templates` — ensure provision, Starter badge, Restore starters, real SVG preview  
- Template detail — Starter badge + master description + existing editor  
- Booking Floor Plans — “Working Floor Plans” empty state language; Ready / Make Changes  
- Portal Floor Plan — view / choose layout (unchanged architecture)  
- Portal Seating — seating collaboration (unchanged)

---

## Validation

### Automated

```bash
npx tsx --test lib/floor-plan-templates/starters.test.ts
```

Covers content/naming, ceremony vs reception-only, no fake code claims in copy, provision skip rules.

`tsc --noEmit` — no new Floor Plan type errors.

### Visual / browser

**Blocked this session:** no app server listening on `:3000`; no browser MCP tools attached.

Validate manually after `npm run dev` + migration apply:

1. Library → Floor Plan Templates shows FP-01 / FP-02 with Starter badge and live SVG (not a screenshot stub)  
2. Preview sheet matches editor shapes (arbor/aisle/cocktail visible on FP-01)  
3. Open editor → room dimensions editable illustrative values  
4. Apply to event → Working Floor Plan gets objects; template unchanged after Working edit  
5. Re-open Library → ensure creates nothing new  
6. Delete FP-02 → Restore starters recreates  
7. Share Floor Plan + Share for Seating → couple sees layout / seats guests  
8. Mark as Ready → Make Changes clears Ready; editing still allowed  

### RLS / isolation (when DB available)

Re-run ensure as Venue A and Venue B; confirm keys scoped per `venue_id` and cross-select fails under authenticated sessions.

---

## Files changed

| Path | Role |
|---|---|
| `supabase/migrations/20261274000000_floor_plan_starter_library.sql` | `source_master_key` + grants |
| `lib/floor-plan-templates/starters.ts` | FP-01 / FP-02 masters |
| `lib/floor-plan-templates/provision.ts` | Seed / ensure / restore |
| `lib/floor-plan-templates/starters.test.ts` | Content + skip-rule tests |
| `lib/floor-plan-templates/types.ts` | `sourceMasterKey`, preview objects |
| `lib/floor-plan-templates/repository.ts` | Map key + preview objects for Library |
| `lib/venue/service.ts` | Seed on venue create |
| `app/(app)/library/floor-plan-templates/page.tsx` | Ensure on open |
| `app/(app)/library/floor-plan-templates/actions.ts` | Restore starter action |
| `app/(app)/library/floor-plan-templates/[id]/page.tsx` | Starter badge + description |
| `components/floor-plan-templates/floor-plan-templates-section.tsx` | Badge, restore, preview |
| `components/floor-plan/floor-plan-layout-preview.tsx` | Shared real renderer preview |
| `components/floor-plan/floor-plan-finalize-control.tsx` | Ready / Make Changes |
| `components/events/floor-plan-workspace.tsx` | Working Floor Plan empty state |
| `components/events/event-detail.tsx` | Ready language on complete confirm |
| `lib/floor-plans/types.ts` / `repository.ts` | Comments: Ready not Final |
| `docs/hello-to-cheers-starter-floor-plan-implementation.md` | This document |

---

## Intentional gaps / what we deliberately did not build

- CAD-quality drafting, walls, fire exits, ADA overlays  
- Auto guest-count → table generation  
- Couple furniture editing / element-level permissions  
- New sharing, invite, or messaging engines  
- Second guest-count / inventory / Event Order / Timeline systems  
- Packages / FAQs / Inventory / Timeline / Event Order starters in this pass  

---

## Stop confirmation

**Stopped after Floor Plan.** No Packages, FAQs, Inventory, Timeline, or Event Order work was started in this implementation pass.
