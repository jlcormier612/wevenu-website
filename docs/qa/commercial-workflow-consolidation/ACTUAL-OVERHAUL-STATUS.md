# HTC — Actual Commercial Workflow Overhaul Status

**Status:** **GREEN / COMPLETE** (full browser E2E + DB proof)  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`

| Role | SHA / identity |
| --- | --- |
| Product (serving Sandbox) | `c5bdafc029ca9ee0a3ad356e96131e30bd1b96bd` |
| Overhaul product baseline (still in history) | `e1c84abf22d32e4718c255e1f695488df9df3754` |
| Migration repair (applied earlier; not re-run) | `be5723ef` / file `20261422800000_event_order_client_agreement.sql` |
| Complete E2E evidence commit | *(this push)* |

---

## 1. What was verified in this pass

This pass **does not reopen** the structural overhaul or migration. It proves the **actual customer journey** on the running Sandbox app:

- Setup boundary (Inventory/EO not in Setup checklist; commercial tabs remain).
- Event Order reopen → finalize → share → client accept → reopen → re-finalize → re-share → re-accept.
- Agreement columns independently verified in DB (`client_agreed_at/name/revision` match accepted revision).
- Inventory portal shared surface + finance/documents handoff surfaces.
- Overhaul harness no longer PASS-on-skip for acceptance.
- C5 finance browser regression re-run vs serving SHA.

---

## 2. Serving revision evidence (Sandbox)

| Check | Result |
| --- | --- |
| ECS service | `htc-sandbox-venue-app` |
| Container image | `…/htc-sandbox-venue-app:c5bdafc029ca9ee0a3ad356e96131e30bd1b96bd` |
| Harness gate | `EXPECTED_SHA=c5bdafc029ca9ee0a3ad356e96131e30bd1b96bd` matched live tag |
| Health | Sandbox app reachable (`app.sandbox.hellotocheers.com`) |
| Environment | Sandbox (`wvpsldwwjqdannqasrdf`) |

---

## 3. Complete commercial browser E2E

```text
EXPECTED_SHA=c5bdafc029ca9ee0a3ad356e96131e30bd1b96bd E2E_RUN_ID=E2E72168 \
  npx tsx docs/qa/commercial-workflow-consolidation/verify-browser-e2e-commercial.mts
→ 22 PASS / 0 FAIL / 0 BLOCKED
```

| Check | Outcome |
| --- | --- |
| A Setup Profiles exclude Inventory/EO templates | PASS |
| A Event Setup excludes Inventory/EO checklist rows | PASS |
| A Inventory commercial tab / EO strip | PASS |
| E1–E13 reopen → finalize → share → accept → reopen → re-finalize → re-share → re-accept | PASS |
| C Portal inventory shared surface | PASS (`status=shared`) |
| F EO invoice link + Documents tab | PASS |

**Agreement persistence (run `E2E72168`, EO `624eceef-…`):**

| Step | revision | `client_agreed_name` | `client_agreed_revision` |
| --- | --- | --- | --- |
| Accept 1 | 10 | `E2E-COMMERCIAL-E2E72168-ACCEPT1` | 10 |
| After reopen | 10 | cleared | cleared |
| Accept 2 (post re-share) | 11 | `E2E-COMMERCIAL-E2E72168-ACCEPT2` | 11 |

Evidence:

- `browser-results-e2e-commercial.json`
- `browser-run-e2e-commercial.log`
- `e2e-evidence/before-E2E72168.json` / `after-E2E72168.json`
- `shots-e2e/`

**Share UI note:** ShareDialog “Sent to …” toast can miss the harness wait (`uiSent=false`) while `shared_at` updates authoritatively — E3/E11 pass on DB `shared_at` change after the real Share/Update Shared Copy UI click.

**Harness anti-false-positive:** `verify-browser-overhaul.mts` fails (does not PASS) when accept is skipped because EO is already agreed.

---

## 4. C5 finance regression

```text
EXPECTED_SHA=c5bdafc029ca9ee0a3ad356e96131e30bd1b96bd \
  npx tsx docs/qa/commercial-workflow-consolidation/verify-browser-c5.mts
→ ALL PASS 20/20
```

Evidence: `browser-run-c5-e2e.log`, `browser-results-c5.json`.

---

## 5. Unit / integration

```text
npx tsx --test \
  lib/event-setup/commercial-setup-separation.test.ts \
  lib/event-orders/client-agreement.test.ts \
  lib/event-orders/commercial-status.test.ts
→ 30/30 pass

npx tsx --test \
  lib/playbooks/constants.test.ts \
  lib/portal/task-action-destinations.test.ts \
  lib/event-inventory/client-selection.test.ts \
  lib/portal/inventory-event-order-discoverability.test.ts \
  lib/event-setup/inventory-eo-setup-editor.test.ts
→ 34/34 pass
```

---

## 6. Related: Event Task Opens matrix

Separate track — see `docs/qa/event-task-opens/STATUS.md`.

```text
EXPECTED_SHA=c5bdafc0… E2E_RUN_ID=OP2555 \
  npx tsx docs/qa/event-task-opens/verify-browser.mts
→ 19 PASS / 0 FAIL / 0 BLOCKED (all 13 Opens options + staff href); fixtures use QAOPENS-/QA-BTN- (avoid /\be2e\b/ portal filter)
```

---

## 7. Limitations (accepted, non-blocking)

- Fresh booking UI not recreated this run; draft suppression remains proven by removed call sites + stable inventory/EO row counts on the Fancy fixture + Setup UI checks.
- Outbound email/SMS intercepted at app Share UI; no real delivery required. Share success asserted via `shared_at`.
- No real money / live payment collection (C5 uses frozen sent invoice fixtures).
- Inventory client select → venue confirm deep path uses existing shared inventory fixture rather than creating a brand-new template from scratch in this run.

---

## 8. Confirmations

- **Production untouched.**
- **Migration not re-run** (schema already present; no new schema defect).
- **Unrelated dirty/untracked work preserved** (no reset/clean/stash).
- **No real communications or payments.**
