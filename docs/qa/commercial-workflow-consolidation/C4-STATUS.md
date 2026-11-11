# HTC Commercial Workflow Consolidation — C4 Status

**Phase:** C4 — Connect fixed EO + selection paths in UX  
**Status:** **GREEN / CLOSED**  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`

---

## 1. Exact C4 scope (from AUDIT.md)

> **Phase C4 — Connect fixed EO + selection paths in UX**  
> - Reuse existing Use/Send/share/finalize; add checklist-style progress (draft → shared/selections → finalized → invoiced) **read from existing statuses**.  
> - Tests: `use-send`, EO share gates, client-choices lifecycle, inventory selection.  
> - Browser: Path A fixed; Path B1 inventory; Path B2 choices (`eo-fixed-vs-selection-routing`, `inventory-client-selection`, `eo-offerings-inventory-closure`).

**Interpreted deliverable (not expanded):** checklist + next-action deep links on the C3 commercial strip; path-wiring copy for fixed EO vs Library Send vs Inventory vs Choices. No new Share/Finalize/Send/Create controls; no runtime merge; finance redesign deferred to C5.

---

## 2. Repository / deployment state

| Item | Value |
| --- | --- |
| Initial HEAD (pre-C4) | `040546b3` (C3 evidence) |
| Initial serving | `dfabcca2` (C3 product) |
| Product commits | `b9ea6b49` (checklist) → `6576c9f1` (engagement id) → **`c1b210d3`** (order_agreed id + C3 seam) |
| **Final product / serving SHA** | **`c1b210d3fb4155d6dc68b1853f1581d244e03cba`** |
| Deploy (final) | [39907895243](https://github.com/jlcormier612/wevenu-website/actions/runs/39907895243) |
| ECS image | `htc-sandbox-venue-app:c1b210d3fb4155d6dc68b1853f1581d244e03cba` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Dirty paths | ~1003 unrelated preserved |
| Production | untouched |

---

## 3. Files changed

| File | Reason |
| --- | --- |
| `lib/event-orders/commercial-status.ts` | `buildCommercialProgressSteps` + `buildCommercialNextAction` from existing statuses |
| `lib/event-orders/commercial-status.test.ts` | Path A/B checklist + next-action + inference guards |
| `components/event-orders/event-commercial-status-strip.tsx` | Checklist UI, path-wiring copy, next deep-link (no authoritative actions) |
| `docs/qa/.../verify-browser-c4.mts` | Path A / B1 / B2 wiring browser (no outbound Share/Send) |
| `docs/qa/.../verify-browser-c3.mts` | Tighten strip seam assertion (avoid milestone testid false positives) |

**Handlers/services unmodified:** `use-send`, inventory share/confirm/finalize/handoff, client_choices send/finalize, EO finalize/share, invoice create/freeze.

---

## 4. Unit / integration

```text
npx tsx --test \
  lib/event-orders/commercial-status.test.ts \
  lib/event-setup/commercial-c1-terminology.test.ts \
  lib/library/commercial-c2-library-clarity.test.ts \
  lib/event-order-templates/use-send.test.ts \
  lib/event-inventory/client-selection.test.ts \
  lib/event-inventory/handoff.test.ts \
  lib/client-choices/lifecycle-gates.test.ts \
  lib/client-choices/apply-to-event-order.test.ts \
  lib/invoices/eo-freeze-billable.test.ts
```

**Result:** **61/61 pass**

---

## 5. Browser (pinned `EXPECTED_SHA=c1b210d3…`)

| Harness | Result |
| --- | --- |
| C4 `verify-browser-c4.mts` | **23/23 PASS** |
| C3 regression | **26/26 PASS** |
| C1 regression | **22/22 PASS** |
| C2 regression | **20/20 PASS** |

Evidence: `browser-results-c4.json`, `browser-run-c4.log`, `shots-c4/`, plus C1–C3 after-c4 logs/results.

### Journeys (venue staff + portal client read)

| Path | What was exercised | Limitation |
| --- | --- | --- |
| **A Fixed EO** | Library Use/Send gating copy; EO panel Finalize/Share remain authoritative; checklist matches DB finalized+shared | Did **not** re-click Share (avoids outbound client email) |
| **B1 Inventory** | Chip matches `shared` → Awaiting client; Open Inventory; portal Inventory | Did **not** re-run full share→submit→confirm mutate cycle |
| **B2 Choices** | Choices anchor → `client_choices` panel; portal Choices; separate from Inventory | Did **not** re-Send choices |
| **Finance** | Invoice anchor to existing EO invoice link; strip has no Create | Invoice **send**/payment-plan create deferred to **C5** |

Duplicate checks (navigation-only): inventory `1→1`, EO lines `44→44`, choices `1→1`, tasks `19→19`.

---

## 6. Confirmations

- C1–C3 intact on serving `c1b210d3`
- Inventory selection and `client_choices` remain distinct
- C3 strip chips/anchors retained; checklist additive
- Production untouched
- Unrelated dirty work preserved
- C5+ not started

**Deferred:** full mutating Path A Share / B1 select lifecycle / invoice-send browsers (AUDIT C5 + outbound-comms constraint); pending-handoff count (locked deferral from C3).

**Definition of done:** GREEN / CLOSED.
