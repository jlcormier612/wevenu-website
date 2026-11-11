# HTC Commercial Workflow Consolidation — C1 Status

**Phase:** C1 — Navigation & Terminology  
**Status:** **GREEN / CLOSED**  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Deployed / serving commit:** `c75bc0faee8f23b69621c4568adf001a59c20fc8`  
**Sandbox deploy run:** https://github.com/jlcormier612/wevenu-website/actions/runs/39898698330 (success)  
**GitHub deployment id:** `7270052981` (also `7269992381`)  
**ECS:** `htc-sandbox-venue-app:890` · image `…/htc-sandbox-venue-app:c75bc0faee8f23b69621c4568adf001a59c20fc8` · RUNNING · `/api/health` 200  
**Production:** untouched  
**Working tree:** pre-existing dirty work preserved (~1006 paths after this closure). No reset / clean / stash. Unrelated `event-task-list.tsx` and other docs/qa dirties left unstaged.

---

## Closure summary

C1 copy/navigation changes were isolated into commit `c75bc0fa`, pushed, deployed via `deploy-sandbox.yml` workflow_dispatch, independently verified on the live ECS image tag, and browser-verified **22/22** against that serving SHA.

---

## 1. Inspected state (closure)

| Item | Value |
| --- | --- |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Pre-commit HEAD | `ad3afd3f` |
| C1 commit | `c75bc0fa` |
| Dirty paths before commit | ~1026 |
| Dirty paths after C1 commit (unrelated preserved) | ~1003+ |
| Prior serving | `ad3afd3f` / deploy `7269830526` |

---

## 2. C1 files included in the deployment commit

```
app/(app)/events/[id]/event-order-actions.ts
app/(app)/library/inventory-templates/page.tsx
app/(app)/library/page.tsx
components/event-inventory/event-inventory-panel.tsx
components/event-orders/event-order-panel.tsx
components/events/event-detail.tsx
components/events/event-inventory-setup-editor.tsx
components/events/event-order-setup-editor.tsx
components/events/event-setup-panel.tsx
components/settings/setup-profiles-section.tsx
lib/event-inventory/service.ts
lib/event-orders/service.ts
lib/event-setup/commercial-c1-terminology.test.ts
lib/event-setup/inventory-eo-setup-editor.test.ts
lib/event-setup/outstanding-follow-ups.ts
lib/event-setup/profile-config-gaps.test.ts
lib/event-setup/profile-config-gaps.ts
lib/event-setup/profiles.ts
lib/event-setup/readiness-detail.test.ts
lib/event-setup/readiness-detail.ts
lib/event-setup/setup-profile-model.test.ts
lib/playbooks/capabilities.ts
docs/qa/commercial-workflow-consolidation/AUDIT.md
docs/qa/commercial-workflow-consolidation/C1-STATUS.md
```

No unrelated dirty files were staged. Schema unchanged. Inventory selection and `client_choices` remain separate runtimes.

---

## 3. Unit tests (re-run before deploy)

```text
npx tsx --test \
  lib/event-setup/commercial-c1-terminology.test.ts \
  lib/event-setup/readiness-detail.test.ts \
  lib/event-setup/profile-config-gaps.test.ts \
  lib/event-setup/setup-profile-model.test.ts \
  lib/event-setup/inventory-eo-setup-editor.test.ts \
  lib/event-order-templates/use-send.test.ts
```

**Result:** 73 passed / 0 failed.

---

## 4. Sandbox deployment

| Step | Result |
| --- | --- |
| `git push` `c75bc0fa` | success |
| `gh workflow run deploy-sandbox.yml --ref feat/spaces-booking-e1-smart-fields` | run `39898698330` |
| Workflow conclusion | **success** · headSha `c75bc0fa…` |
| Independent ECS image | `…:c75bc0faee8f23b69621c4568adf001a59c20fc8` (**matches**) |
| Health | 200 |

---

## 5. Browser verification

Harness: `docs/qa/commercial-workflow-consolidation/verify-browser.mts`  
Command: `EXPECTED_SHA=c75bc0faee8f23b69621c4568adf001a59c20fc8 npx tsx docs/qa/commercial-workflow-consolidation/verify-browser.mts`  
Results: `browser-results.json` · **22/22 PASS**  
Evidence: `docs/qa/commercial-workflow-consolidation/shots/`

| Area | Result |
| --- | --- |
| A Setup Profiles EO/inventory template labels; no old package/offering options | PASS (Edit form; Cancel — no save) |
| B Overview readiness copy; Open Inventory → `#inventory`; Open Event Order → commercial intro | PASS |
| C `event-commercial-workspace-intro` @1280 + 390; Client selections + Event Order; Inventory tab separate | PASS |
| D Library Packages ≠ EO Templates; Inventory Templates apply≠share | PASS |
| E Payments tab; EO invoice/payment language; portal `/p/{token}#inventory\|event-order\|choices` | PASS |
| Serving SHA gate | PASS |

**Safe path:** no share/send/invoice actions executed (no couple emails). Portal and venue navigation were read-mostly.

### Critical workflows — how verified for C1

| Workflow | Verification mode |
| --- | --- |
| Fixed EO Path A home | Commercial workspace + Event Order panel present; Library Use/Send unchanged (unit `use-send` still green) |
| Client choices runtime | Client selections panel + portal Choices section reachable |
| Inventory selection separate | Inventory tab without commercial intro; portal Inventory reachable |
| EO → Invoice → Payment Plan nav | Payments tab + EO finance language present (no create/send) |
| Setup readiness links | Open CTAs navigate correctly |
| Portal Inventory / EO / Choices | Live `/p/` sections PASS |

Full Path A Use→Finalize→Share and invoice-send were **not** re-executed end-to-end in this closure (would risk outbound notifications). Entry points and copy boundaries were verified on the live SHA.

---

## 6. Entry-point classification (unchanged from implementation)

See prior section in git history / AUDIT.md. C1 did not delete entry points.

---

## 7. Confirmations

- Production untouched: **yes**
- Pre-existing dirty changes preserved: **yes**
- Only C1 files in deploy commit: **yes**
- Serving SHA independently confirmed equal to intended commit: **yes**
- C2–C7 not started: **yes**

---

## 8. Deferred

C2–C7 per AUDIT.md. Optional: fuller Path A/B + invoice browser harnesses under C4/C5 after commercial shell work.

---

## Verdict

**GREEN / CLOSED** — C1 deployed to Sandbox at `c75bc0fa`, serving SHA confirmed, focused unit tests + 22/22 browser checks pass.
