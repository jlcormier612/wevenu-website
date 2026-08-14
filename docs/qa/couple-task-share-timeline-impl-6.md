# Couple Tasks — Implementation 6 — Share Timeline Verified Completion

**Status:** Implemented (approved domain model built)  
**Date:** 2026-08-09  
**Prior commits (verified present, untouched):** `5657066`, `0ad64af`, `fc843dc`, `358153b`, `56e98a4`, `8d52f38`

---

## Signal / SoT / Share action / Task relationship / Trigger / Celebration

| Item | Value |
| --- | --- |
| **Exact signal** | Durable `event_vendor_timeline_shares` row for `(event_id, vendor_id)` written only by `share_portal_timeline_with_vendor` on confirmed success |
| **SoT** | `event_vendor_timeline_shares` (UNIQUE event+vendor; first share durable; re-share idempotent) |
| **Share action** | Portal RPC `share_portal_timeline_with_vendor(token, vendor_id)` + `POST /api/portal/timeline/share` |
| **Task relationship** | Completes pending **owned** `vendor_tasks` where `action_type = 'share_timeline'` **and** `vendor_id = V` only |
| **Trigger** | **None** — does **not** use playbook `triggerAutoComplete` / `timeline_submitted` |
| **Celebration type** | `timeline_shared_with_vendor` via `luv_celebrations`; UI only when `celebrated === true`; entity = completed `vendor_task.id` (or share id) |
| **Typed action** | `vendor_tasks.action_type` / template item `action_type`; couple-portal value `'share_timeline'`; **never** inferred from title |
| **Deep link** | `#timeline/share` → `portal-focus-timeline-share` via `action_type`, not title |
| **Manual complete** | `canComplete=false` for `share_timeline`; Tasks shows Share CTA instead of checkbox |

**Does not complete on:** open Timeline, navigate, dialog, draft, cancel, fail, refetch, load, venue submit, Mark complete, vendors audience toggle alone, title match.

---

## Migration?

**Yes** — `supabase/migrations/20261239000000_couple_share_timeline_verified_completion.sql`:

1. `vendor_tasks.action_type` + `vendor_task_template_items.action_type` (+ soft CHECK)
2. New table `event_vendor_timeline_shares`
3. Widen `luv_celebrations` CHECK → `timeline_shared_with_vendor`
4. Update `get_portal_vendor_tasks` (project `actionType`; block Mark-complete for share)
5. New RPC `share_portal_timeline_with_vendor` (auth + assignment → share insert → minimal `vendors` audience flip → scoped task complete → optional Luv)

---

## Files changed

| File | Change |
| --- | --- |
| `supabase/migrations/20261239000000_couple_share_timeline_verified_completion.sql` | Schema + RPC |
| `lib/portal/couple-share-timeline.ts` | Gates / constants / scoping helpers |
| `lib/portal/couple-share-timeline.test.ts` | WP matrix cases 1–17 |
| `app/api/portal/timeline/share/route.ts` | Portal share API |
| `lib/portal/service.ts` | `sharePortalTimelineWithVendor` + `actionType` mapping |
| `lib/portal/types.ts` | `PortalVendorTask.actionType` |
| `lib/portal/workspace-routing.ts` | Focus `share` |
| `lib/portal/next-steps.ts` | Compact CTA preserves **Share** |
| `lib/luv/celebrations.ts` | Type + copy |
| `lib/luv/verified-domain-celebrations.ts` | Comment: playbook map still null for invented `share_timeline` trigger |
| `components/portal/timeline-section.tsx` | Share-with-vendor panel + celebrate gate |
| `components/portal/unified-tasks-section.tsx` | Share CTA / no Mark complete for typed tasks |
| `components/portal/portal-shell.tsx` | Home Next Steps → `#timeline/share` for typed tasks |
| `lib/vendor-tasks/service.ts` + `lib/vendors/types.ts` | Create/map `actionType` |
| `lib/vendor-task-templates/*` + manager UI | Template item `actionType` + apply copy |
| `lib/vendor-events/service.ts` | Map `actionType` |
| `components/vendor-app/vendor-event-workspace.tsx` | Optional Share timeline action on create |
| `scripts/local-qa/fix-share-timeline-demo-notes.sql` | Seed Golden Hour `action_type` |
| Tests (celebrations / next-steps / workspace-routing) | Extended |
| `docs/qa/couple-task-share-timeline-impl-6.md` | This report |

---

## Tests

```bash
npx tsx --test \
  lib/luv/celebrations.test.ts \
  lib/luv/verified-domain-celebrations.test.ts \
  lib/portal/unified-tasks.test.ts \
  lib/portal/next-steps.test.ts \
  lib/portal/workspace-routing.test.ts \
  lib/portal/couple-insurance-completion.test.ts \
  lib/portal/couple-share-timeline.test.ts \
  lib/storage.test.ts
```

**Result: 94/94 pass** (incl. WP matrix 1–17 for share timeline).

---

## Live QA (Emma & Jordan)

**Env:** `http://localhost:3000` · token `seedcoupleportal00000000000000000000000000000001` · local Supabase  
**Migration + seed applied locally.**

| Probe | Result |
| --- | --- |
| Before task | Golden Hour `90eff479-…` pending, `action_type=share_timeline`, `canComplete=false` |
| Open / no share | Stayed pending until share RPC |
| Bad vendor (no assignment) | `ok:false` / `no_assignment` |
| First share (Golden Hour) | Share row insert; task **complete** / `completed_by=couple`; `celebrated:true` |
| Second share (same vendor) | `alreadyShared:true`, `celebrated:false`, `completedTaskIds:[]` |
| Vendor A ≠ Vendor B | Share A again did not complete B’s pending `share_timeline`; share B completed only B (`celebrated:false` — client already had Luv) |
| After portal projection | Golden Hour task `status=complete`, still `actionType=share_timeline` |

### Celebration 1st / 2nd

| Attempt | `celebrated` |
| --- | --- |
| 1st successful share (Golden Hour) | `true` |
| 2nd share same vendor | `false` |
| Share different vendor (Baker’s Dozen probe) | `false` (existing `(client_id, celebration_type)` uniqueness — residual) |

### Before / after task state (Golden Hour)

| | status | completed_by | share row |
| --- | --- | --- | --- |
| Before | pending | null | none |
| After 1st share | complete | couple | 1 row `couple_portal` |

### Vendor-scoping proof

Completion filters `event_id + vendor_id + owned + action_type=share_timeline + pending`. Live: Vendor A share completed only Golden Hour; Vendor B task stayed pending until its own share.

---

## Seed / demo

- Golden Hour task `90eff479-…` + template item `58262c37-…` set to `action_type='share_timeline'` via `scripts/local-qa/fix-share-timeline-demo-notes.sql`
- Template apply copies `action_type` from item → `vendor_tasks`

---

## Intact / untouched

| Area | Status |
| --- | --- |
| Prior Impl commits | Intact (`5657066` … `8d52f38`) |
| WW / Studio / Collections / Photo Styles / RSVP | Untouched |
| Payments / insurance / Couple Home hierarchy | Untouched beyond Next Steps CTA routing for typed share tasks |
| Vendor Network architecture | Untouched (broadcast `vendors` audience remains; completion keys off share row) |
| No push | Confirmed |

---

## Residual gaps (honest)

1. **Multi-vendor Luv uniqueness** — `luv_celebrations` remains unique `(client_id, celebration_type)`, so only the **first** vendor share celebrates; later vendors complete tasks without a second Luv (consistent with insurance-style one-shot; approved model preferred per-task entity uniqueness which would require changing the global unique — deferred).
2. **Access remains broadcast** — share adds `vendors` audience to event timeline entries (minimal); not a per-vendor ACL redesign.
3. **Legacy titled “Share timeline” without `action_type`** still Mark-complete until re-tagged / seeded (no title-match auto-complete).
4. Historical rows already complete without celebration are not backfilled (by design).

---

## Commit

**SHA:** `192c72824b66e880e4f53cc8b2f04e218a895079`  
**Message:** Couple Tasks – Implementation 6 – Verified Share Timeline Completion  

**No push.** Prior commits intact: `5657066`, `0ad64af`, `fc843dc`, `358153b`, `56e98a4`, `8d52f38`.
