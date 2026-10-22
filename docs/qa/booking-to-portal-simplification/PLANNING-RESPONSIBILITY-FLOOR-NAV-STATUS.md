# Planning responsibility groups + Floor Plans workspace nav — STATUS

**Verdict: GREEN** for both product asks on Sandbox.

Production untouched. Unrelated dirty working tree preserved (~940 paths).

## Preflight

| Item | Value |
| --- | --- |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD at start | `cfd0d3b2` (portal preview evidence) |
| Serving at start | `afbd0dff…` |
| Product commits | `fd8760d5` (grouping + no auto-redirect) → `7d2b60b0` (back control test id) |
| Intended / serving SHA | `7d2b60b07e51904b777eac00198a3ed38adee9fd` (`dpl=` exact match) |
| Deploy | [39811852069](https://github.com/jlcormier612/wevenu-website/actions/runs/39811852069) (venue-app live; stack finalize in progress at verification — `dpl=` already matched) |
| Fixture | event `ebf74f77-…` · client `b4e2764b-…` (Fancy) |

---

## Part A — Planning: Client / Venue / Vendor

### Classification rules (source of truth)

`EventTask.ownerType` via `lib/playbooks/task-responsibility.ts`:

| `ownerType` | Section |
| --- | --- |
| `couple` | **Client** |
| `coordinator`, `team` | **Venue** |
| `vendor` | **Vendor** |
| unknown | **Venue** (safe default — never Client) |

Never title heuristics. Empty sections are omitted (no fake empty panels).

Within each section, status subgroups remain: Overdue / Upcoming / Completed / Waived.

### Privacy

Couple portal / portal preview still load `owner_type = couple` only. Venue sections are venue Planning UI only (`EventTaskList`).

### Files

- `lib/playbooks/task-responsibility.ts` (+ test)
- `components/playbooks/event-task-list.tsx`
- `lib/playbooks/task-waiver-counts.test.ts` (waived subgroup still asserted)

### Browser

Sections present with DB-aligned counts: Client 10, Venue 7, Vendor 1 (18 total). Couple titles not leaked into Venue. Task fingerprint unchanged after browse.

Screenshots: `planning-floor-nav-shots/planning-responsibility-{1280,390}.png` (Client / Venue / Vendor headings visible after scroll).

---

## Part B — Floor Plans: navigation + selection honesty

### Root cause

`FloorPlanWorkspace` `useEffect` called `router.replace(/events/:id/floor-plans/:planId)` whenever an operational plan existed (and again after ensure). Opening Floor Plans briefly showed the workspace, then forced the designer. “Back to Floor Plans” (`/clients/:id#floorplan`) re-entered the same effect → redirect loop; staff had to leave the client.

### Fix

1. Remove auto-`router.replace` into the designer.
2. Keep one-time `ensureWorkingFloorPlanAction` when offers exist and no operational plan — then `router.refresh()` only (workspace card appears).
3. Staff open the designer explicitly via the working-layout card link.
4. Designer back: `Back to Floor Plans` → `/clients/:id#floorplan` (events without client → `/events/:id`). Shared header `data-testid="business-asset-back"`.

### Authoritative state distinction (unchanged model)

| Concept | Field / rule |
| --- | --- |
| Working / operational layout | `events.operational_floor_plan_id` |
| Client selection | `events.couple_selected_floor_plan_id` |
| Offers | `event_floor_plan_offers` (`is_offered`) |

Status strip still truthfully says when the working layout is the sole offer but the client has **not** confirmed a choice.

### Files

- `components/events/floor-plan-workspace.tsx`
- `app/(app)/events/[id]/floor-plans/[planId]/page.tsx`
- `app/(app)/clients/[id]/floor-plans/[planId]/page.tsx`
- `components/business-assets/asset-header.tsx`
- `lib/floor-plans/floor-plan-workspace-nav.test.ts`

### Browser before → after

| Step | Before | After |
| --- | --- | --- |
| Click Floor Plans | Workspace flash → designer | Stay on `/clients/…#floorplan` workspace |
| Back from designer | Bounce to designer again | Return to booking Floor Plans; no loop |
| Selection | — | “Using the only offered layout… client has not separately confirmed” |
| Plans / offers / selection | — | Unchanged (1 plan, 2 offers, `couple_selected` null) |

Screenshots: `planning-floor-nav-shots/floor-workspace-{1280,390}.png`.

---

## Tests

```text
npx tsx --test \
  lib/playbooks/task-responsibility.test.ts \
  lib/playbooks/task-waiver-counts.test.ts \
  lib/floor-plans/floor-plan-workspace-nav.test.ts \
  lib/floor-plans/ensure-working-layout.test.ts \
  lib/event-setup/floor-plans-setup-editor.test.ts
→ 36 pass / 0 fail
```

```text
EXPECTED_SHA=7d2b60b07e51904b777eac00198a3ed38adee9fd \
  npx tsx scripts/qa/planning-responsibility-floor-nav-acceptance.mts
→ GREEN · 25/25
```

Evidence: `planning-floor-nav-results.json`, `planning-floor-nav-acceptance.log`, shots above.

### Side effects

invoices 38→38 · invites 1→1 · task fingerprint identical · offers 2→2 · plans 1→1 · couple_selected null→null · operational stable.

## Production

Untouched.
