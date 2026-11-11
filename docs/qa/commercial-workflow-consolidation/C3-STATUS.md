# HTC Commercial Workflow Consolidation — C3 Status

**Phase:** C3 — Event Commercial Workspace (status strip + anchors + copy)  
**Status:** **GREEN / CLOSED**  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`

---

## 1. Verdict

C3.1–C3.4 are implemented, isolated, deployed to Sandbox, and browser-verified against the live serving image. The Event Order tab is the event-level commercial home via composition only: live status chips + deep links + in-tab anchors + explanatory copy. No Share/Finalize/Send/Create Invoice actions on the strip; inventory and `client_choices` remain separate; tab id `event-order` unchanged; pending-handoff count deferred; Production untouched; pre-existing dirty work preserved.

---

## 2. Repository and deployment state

| Item | Value |
| --- | --- |
| Initial branch / HEAD (pre-C3 impl) | `feat/spaces-booking-e1-smart-fields` @ `76961c16` |
| Initial Sandbox serving | `bc9db111` (C2) |
| Product commit (C3.1–C3.3) | `e9fffb2821bc64f483459fd14563d81f5adf48ea` |
| Product commit (anchor hash sync fix) | `dfabcca2107558710b72a9c6efd650c7733ad174` |
| **Final product / serving SHA** | **`dfabcca2107558710b72a9c6efd650c7733ad174`** |
| Deploy run (first C3 image) | `39902478738` → served `e9fffb28` |
| Deploy run (final / verified) | `39903470679` — https://github.com/jlcormier612/wevenu-website/actions/runs/39903470679 |
| Verified ECS image | `htc-sandbox-venue-app:dfabcca2107558710b72a9c6efd650c7733ad174` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Dirty paths after C3 product commits | ~1003 unrelated paths preserved (no reset/clean/stash) |
| Production | untouched |

---

## 3. Product files changed (deployed)

| File | Purpose |
| --- | --- |
| `lib/event-orders/commercial-status.ts` | Pure chip derivation from already-loaded props |
| `lib/event-orders/commercial-status.test.ts` | Status mapping, ambiguity, deep-links, no-action seams |
| `components/event-orders/event-commercial-status-strip.tsx` | Chips + sub-nav deep links + C3.3 copy |
| `components/events/event-detail.tsx` | Mount strip; wrap Choices/Order anchors; hash sync for `event-order-*` |
| `components/event-orders/event-order-invoice-link.tsx` | `id="event-order-invoice"` scroll target |
| `lib/event-setup/commercial-c1-terminology.test.ts` | Strip supersedes static C1 intro testid |
| `docs/qa/commercial-workflow-consolidation/C3-PLAN.md` | Locked plan (shipped with product) |
| `docs/qa/commercial-workflow-consolidation/verify-browser*.mts` | C1/C2 updated for strip; new C3 harness |

---

## 4. Locked decisions honored

1. Status strip = chips + deep links only — **yes** (no Share/Finalize/Send/Create).
2. Tab id remains `event-order` — **yes**.
3. Pending-handoff count deferred — **yes** (not implemented).
4. Domain boundaries preserved — **yes**.
5. No new top-level commercial tab — **yes**.
6. Inventory = deep link only (no embedded panel) — **yes**.
7. Production untouched — **yes**.
8. Unrelated dirty work preserved — **yes**.

---

## 5. Unit / integration results

```text
npx tsx --test \
  lib/event-orders/commercial-status.test.ts \
  lib/event-setup/commercial-c1-terminology.test.ts \
  lib/library/commercial-c2-library-clarity.test.ts \
  lib/event-order-templates/use-send.test.ts \
  lib/event-inventory/handoff.test.ts \
  lib/invoices/eo-freeze-billable.test.ts
```

**Result:** 39/39 pass (0 fail) against final implementation.

---

## 6. Browser verification (Sandbox, pinned SHA)

| Harness | Command | Result |
| --- | --- | --- |
| C3 | `EXPECTED_SHA=dfabcca2… npx tsx docs/qa/commercial-workflow-consolidation/verify-browser-c3.mts` | **26/26 PASS** |
| C1 regression | `EXPECTED_SHA=dfabcca2… npx tsx …/verify-browser.mts` | **22/22 PASS** |
| C2 regression | `EXPECTED_SHA=dfabcca2… npx tsx …/verify-browser-c2.mts` | **20/20 PASS** |

Evidence JSON: `browser-results-c3.json`, `browser-results.json`, `browser-results-c2.json`  
Logs: `browser-run-c3.log`, `browser-run-c1-after-c3.log`, `browser-run-c2-after-c3.log`  
Shots: `docs/qa/commercial-workflow-consolidation/shots-c3/`

### Workflow results

| Workflow | Result |
| --- | --- |
| **A. Fixed Event Order** | Strip + Choices/Order panels mount without requiring choice groups; EO chip matches DB (`finalized` + `shared_at` → Shared); no strip Share/Finalize |
| **B. Pending inventory selection** | Chip matches DB `shared` → “Awaiting client” (not confirmation); Open Inventory → `#inventory` / Inventory workspace |
| **C. Client-selectable choices** | Separate Choices chip; anchor `#event-order-choices` keeps Event Order tab and Client selections panel |
| **D. Finance handoff** | Invoice anchor reaches existing EO invoice link; strip has no Create Invoice/Plan; invoice chip status-only |
| **E. Navigation / C1–C2 / portal** | Inventory + Payments tabs; Library Packages≠EO; Setup readiness; portal Inventory/Order/Choices; 390 strip + Open Inventory |

### Persisted-state / duplicate checks

Navigation-only C3 session: inventory rows `1→1`, EO lines `44→44`, client_choices `1→1`. No new share/send/invoice mutations performed.

---

## 7. Defect found during verification (fixed)

**Symptom:** Clicking Choices / Order / Invoice anchors unloaded the commercial workspace.  
**Cause:** `hashchange` sync treated `#event-order-choices` (etc.) as tab ids.  
**Fix:** Map those fragments to `setActiveTab("event-order")` + scroll (commit `dfabcca2`).  
**Redeployed and re-verified.**

---

## 8. Deferred / limitations

- Pending inventory handoff **count** on strip — deferred per locked decision.
- Browser smoke does not click Share / Finalize / Send invoice / create payment plan (avoids outbound customer actions); finance path verified via existing link presence + unit freeze tests.
- C4+ not started.

---

## 9. Confirmations

- C1/C2 behavior intact (browser 22/22 + 20/20 on serving `dfabcca2`).
- Production untouched.
- Pre-existing dirty work preserved (~1003 unrelated paths).
- No inventory/`client_choices` runtime merge.
- No schema migration.

**Definition of done:** GREEN / CLOSED.
