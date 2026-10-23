# HTC — Actual Commercial Workflow Overhaul Status

**Status:** **GREEN / COMPLETE**  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`

| Role | SHA |
| --- | --- |
| Product (serving) | `e1c84abf22d32e4718c255e1f695488df9df3754` |
| Closure / migration repair (pushed) | `be5723ef202f942579dd3e2946456b7ff5cf1604` |

---

## 1. What was fixed

### Structural overhaul (product commit `e1c84abf`)
- Removed Inventory / Event Order from Setup Profiles and Event Setup UI.
- Stopped booking inherit and portal-release from auto-creating Inventory/EO drafts.
- Added Event Order **client agreement** (`client_agreed_*`) distinct from venue finalize/share; portal Accept UI + RPC.

### Migration repair (commit `be5723ef`)
- **Root cause:** version `20261401000000` was already tracked as `20261401000000_sandbox_pgrst_recover.sql` (PostgREST cache recovery). The sibling file `…_event_order_client_agreement.sql` shared that version and could never apply.
- **Live schema before repair:** `client_agreed_*` columns **missing**; `accept_event_order_for_portal` **missing**.
- **Fix:** removed colliding agreement filename; added forward idempotent migration `20261422800000_event_order_client_agreement.sql` (after tracked max `20261422700000`).
- **Did not** delete/fabricate `schema_migrations` rows; **did not** re-run the failed batch.

---

## 2. Serving revision evidence (Sandbox)

| Check | Result |
| --- | --- |
| Deploy workflow | [39916930256](https://github.com/jlcormier612/wevenu-website/actions/runs/39916930256) **success** · headSha `e1c84abf…` |
| ECS service | `htc-sandbox-venue-app` desired/running **1** · task def `:898` |
| Container image | `…/htc-sandbox-venue-app:e1c84abf22d32e4718c255e1f695488df9df3754` |
| Image digest | `sha256:bcad9d4f3a41548804b951350786d0119bee921c715bf58a62614ea0c781646b` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Environment | Sandbox (`wvpsldwwjqdannqasrdf` / `app.sandbox.hellotocheers.com`) |

Browser harness gated on `EXPECTED_SHA=e1c84abf…` and matched the live image tag.

---

## 3. Migration / schema verification

| Item | Result |
| --- | --- |
| Failed apply (expected) | [39916932605](https://github.com/jlcormier612/wevenu-website/actions/runs/39916932605) preflight: `20261401000000` already recorded |
| Successful repair apply | [39977648998](https://github.com/jlcormier612/wevenu-website/actions/runs/39977648998) **success** · file `20261422800000_event_order_client_agreement.sql` · verify-sandbox-database step **passed** |
| Columns | `client_agreed_at`, `client_agreed_name`, `client_agreed_revision` present on `event_orders` |
| RPC `get_event_order_for_portal` | Returns agreement fields on fixture token |
| RPC `accept_event_order_for_portal` | Live; invalid token → `Portal session not found.` |
| Probe evidence | `overhaul-schema-probe.json` |

---

## 4. Browser harness

```text
EXPECTED_SHA=e1c84abf22d32e4718c255e1f695488df9df3754 \
  npx tsx docs/qa/commercial-workflow-consolidation/verify-browser-overhaul.mts
→ ALL PASS 11/11
```

Evidence: `browser-results-overhaul.json`, `browser-run-overhaul.log`, `shots-overhaul/`.

Finance regression:

```text
EXPECTED_SHA=e1c84abf22d32e4718c255e1f695488df9df3754 \
  npx tsx docs/qa/commercial-workflow-consolidation/verify-browser-c5.mts
```

(See `browser-run-c5-overhaul.log`.)

---

## 5. Journey results (A–F)

| Area | Result | Evidence |
| --- | --- | --- |
| **A. Setup boundary** | **PASS** | Profiles: no Starting Inventory/EO templates. Event Setup: no Open Inventory/EO; planning/timeline/vendors/floor only. Commercial strip remains on EO tab. |
| **B. Booking / draft creation** | **PASS** | Units assert inherit + prepare-release have **no** `ensureEventInventory` / `ensureEventOrder`. Fixture remained **1** inventory row / **1** EO row after overhaul ops. Fresh booking not created (avoid extra fixtures); suppression is structural + count-stable. |
| **C. Inventory-selection separation** | **PASS** | Portal home Inventory entry retained as commercial (not Setup). Existing selection runtime + units unchanged; Inventory Templates remain in Library. |
| **D. Event Order agreement** | **PASS** | Share ≠ agree. Browser Accept recorded `Overhaul Accept QA` @ revision 3. Reopen cleared agreement (no outbound share). Re-finalize + accept required new agreement (`ReAgree QA`); second accept idempotent `already=true`. Activities: 2× `client_agreed`. See `overhaul-agreement-persist.json`. |
| **E. Commercial handoff** | **PASS** | Strip present; checklist uses `clientAgreedAt` for Agreed. C5 finance browser re-run vs serving SHA. No finance redesign. |
| **F. Persistence / regression** | **PASS** | Agreement persisted across reload path; reopen clears; idempotent accept. Focused units **30/30**; original overhaul suite **88/88** on product commit. |

---

## 6. Unit / integration commands

```text
npx tsx --test \
  lib/event-setup/commercial-setup-separation.test.ts \
  lib/event-orders/client-agreement.test.ts \
  lib/event-orders/commercial-status.test.ts
→ 30/30 pass (closure re-run)

# Product commit baseline (earlier):
# commercial-setup + status + profile/setup suites → 88/88
```

---

## 7. Workflow links

| Workflow | URL | Outcome |
| --- | --- | --- |
| Deploy Sandbox (`e1c84abf`) | https://github.com/jlcormier612/wevenu-website/actions/runs/39916930256 | success |
| Migration (collision fail) | https://github.com/jlcormier612/wevenu-website/actions/runs/39916932605 | failure (preflight; nothing applied) |
| Migration repair `20261422800000` | https://github.com/jlcormier612/wevenu-website/actions/runs/39977648998 | success + DB verify |

---

## 8. Limitations (accepted, non-blocking)

- No new Sandbox booking was created in this pass; draft suppression is proven by removed call sites + stable fixture counts + release copy.
- Reopen/re-agree used the same DB updates as `reopenEventOrder` / finalize (no customer email). Full re-share UI was not re-triggered (outbound risk).
- Closure commit `be5723ef` is migration + evidence; runtime product remains serving `e1c84abf` (intentional — no product code change required for the repair).

---

## 9. Confirmations

- **Production untouched.**
- **Unrelated dirty work preserved** (~1055 dirty/untracked paths at verification start; no reset/clean/stash).
- Artifacts now **in git** at `be5723ef`: `ACTUAL-OVERHAUL-STATUS.md`, `verify-browser-overhaul.mts`, `20261422800000_event_order_client_agreement.sql`.
