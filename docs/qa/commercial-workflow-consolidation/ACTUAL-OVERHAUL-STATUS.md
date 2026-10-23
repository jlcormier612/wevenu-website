# HTC — Actual Commercial Workflow Overhaul Status

**Status:** **PARTIAL**  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Product commit:** `e1c84abf22d32e4718c255e1f695488df9df3754`

This report covers the structural Setup separation and Event Order client-agreement lifecycle that C1–C7 did not deliver. It does **not** claim a full venue→client→invoice→documents browser journey against the new serving build until deploy + migration verification below completes.

---

## 1. Requirements → implementation

| Requirement | Implementation |
| --- | --- |
| **A. Setup only planning / timeline / vendors / floor plans** | `applicableSetupSteps` excludes `inventory` / `event_order`; `overviewSetupSteps` / `setupExperienceSteps` planning-only. UI removed from `setup-profiles-section.tsx` and `event-setup-panel.tsx`. |
| **B. Setup Profile must not drive commercial execution** | Removed `applyInheritedInventoryAndEventOrder` from `lib/event-setup/inherit.ts`. Removed Inventory/EO `ensure*` from `lib/event-setup/prepare-release.ts`. Historical `template_refs` still parse/serialize; no longer edited or applied. |
| **C1–C3 Inventory selection path** | Existing inventory-selection runtime retained (Library Use/Send, event Inventory tab, portal select/submit, venue confirm). Not auto-started from Setup. |
| **C4 EO for agreement** | New `client_agreed_at` / `client_agreed_name` / `client_agreed_revision`; portal Accept UI + `accept_event_order_for_portal` RPC; reopen clears agreement. Share ≠ agree. |
| **C5 Invoice / payment plan** | Unchanged existing EO→invoice→plan path; checklist now waits for **client agree** before treating order as agreed. Freeze-on-send preserved. |
| **C6 Documents** | Existing EO share → document domain path unchanged; agreement activity recorded on EO activities. |

---

## 2. Structurally removed from Setup / portal release

- Setup Profile Included rows + starting-template pickers for Inventory and Event Order.
- Event Setup panel Inventory/Event Order readiness rows, Open CTAs, and setup editors.
- Booking inherit auto-`ensureEventInventory` / `ensureEventOrder`.
- Prepare-and-release auto-ensure of Inventory / Event Order drafts.
- Profile hard-gaps requiring Inventory/EO starting templates.

**Preserved:** planning, timeline, vendors, floor plans; Library templates; event Inventory / Event Order tabs; historical profile JSON fields (not silently wiped).

---

## 3. Commercial lifecycle stages (what was implemented)

| Stage | Status |
| --- | --- |
| 1. Venue prepares/sends inventory selection | Existing — Library + Inventory tab; not Setup |
| 2. Client selects/submits | Existing portal inventory select |
| 3. Venue reviews/confirms | Existing inventory confirm |
| 4. Venue issues EO; client agrees | **New** — Accept panel + DB agreement; reopen clears |
| 5. Invoice + payment plan | Existing; checklist gated on agreement |
| 6. Documents | Existing EO share documents; agreement evidence in activities |

---

## 4. Schema

**Migration:** `supabase/migrations/20261401000000_event_order_client_agreement.sql`

- Columns on `event_orders`: `client_agreed_at`, `client_agreed_name`, `client_agreed_revision`
- Updates `get_event_order_for_portal` to return agreement fields
- Adds `accept_event_order_for_portal(token, name)`

**Sandbox apply run:** https://github.com/jlcormier612/wevenu-website/actions/runs/39916932605  
**Sandbox deploy run:** https://github.com/jlcormier612/wevenu-website/actions/runs/39916930256 (`headSha` = `e1c84abf…`)

*(Conclusion at report write: both still queued/in progress — verify before GREEN.)*

---

## 5. Tests (local)

```text
npx tsx --test \
  lib/event-setup/commercial-setup-separation.test.ts \
  lib/event-orders/client-agreement.test.ts \
  lib/event-orders/commercial-status.test.ts \
  lib/event-setup/state.test.ts \
  lib/event-setup/commercial-c1-terminology.test.ts \
  lib/event-setup/commercial-c6-setup-cleanup.test.ts \
  lib/event-setup/setup-profile-model.test.ts \
  lib/event-setup/profile-config-gaps.test.ts \
  lib/event-setup/inventory-eo-setup-editor.test.ts
→ 88/88 pass
```

Harness ready: `docs/qa/commercial-workflow-consolidation/verify-browser-overhaul.mts`  
(Run after serving SHA matches `e1c84abf` and migration applied.)

---

## 6. Browser / persisted evidence

**Not yet verified against deployed `e1c84abf`.** Required next:

```text
EXPECTED_SHA=e1c84abf22d32e4718c255e1f695488df9df3754 \
  npx tsx docs/qa/commercial-workflow-consolidation/verify-browser-overhaul.mts
```

Then full venue/client acceptance journey (template → share inventory → submit → confirm → EO share → accept → invoice → plan → documents) on an isolated fixture.

---

## 7. Product commit / deployment

| Item | Value |
| --- | --- |
| Commit | `e1c84abf22d32e4718c255e1f695488df9df3754` |
| Files | 23 product/test/migration (dirty tree otherwise untouched) |
| Deploy | [39916930256](https://github.com/jlcormier612/wevenu-website/actions/runs/39916930256) |
| Migration | [39916932605](https://github.com/jlcormier612/wevenu-website/actions/runs/39916932605) |
| Serving SHA (at write) | still prior `020b6f0b…` until deploy completes |
| Production | untouched |
| Dirty work | preserved (~1000+ unrelated paths) |

---

## 8. Incomplete / remaining (why PARTIAL)

1. **Sandbox deploy + migration must finish** and serving SHA must equal `e1c84abf…`.
2. **Browser overhaul harness + full E2E acceptance journey** not yet run against that build.
3. **Client “request changes” on EO** — Accept is implemented; a first-class portal “request changes” path for EO (beyond Messages) is not yet a dedicated control (can use Messages / venue reopen).
4. **Document visibility matrix** for agreement evidence as a couple-facing Documents row was not newly wired beyond EO share PDF + activity trail.
5. **Fixed EO / proposal-contract regression browsers** not re-run in this turn after deploy.

Minimum remaining work for GREEN: confirm migration + deploy success → run `verify-browser-overhaul.mts` → exercise full acceptance journey on isolated Sandbox fixture → update this file to GREEN with evidence paths.

---

## 9. Confirmations

- Production untouched.
- Pre-existing dirty work preserved (only overhaul paths committed).
- C1–C7 clarification commits remain in history; this overhaul corrects the Setup/commercial structural gap.
