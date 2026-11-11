# HTC Commercial Workflow Consolidation — C6 Status

**Phase:** C6 — Remove obsolete setup *duplication* only  
**Status:** **GREEN / CLOSED**  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`

---

## 1. Exact C6 scope (from AUDIT.md)

> **Phase C6 — Remove obsolete setup *duplication* only**  
> - After C3–C5 green: remove misleading Setup CTAs that imply send/invoice; **do not** remove Included readiness or profile template refs.  
> - Accept: checklist still drives portal release; commercial runner is event workspace.  
> - Tests: setup panel CTA tests · Browser: Setup no longer shows Send-as-EO

| Authorized | Not authorized |
| --- | --- |
| Remove/correct Setup CTAs implying Send EO / invoice | Delete Included readiness rows |
| Clarify Release ≠ share Inventory/EO / create invoice | Remove profile starting-template refs |
| Lock Open Inventory / Open Event Order deep links | Merge selection runtimes; C7; finance redesign |

---

## 2. Repository / deployment

| Item | Value |
| --- | --- |
| Initial HEAD | `1e01ceec` (C5 evidence) |
| Initial serving | `c1b210d3` |
| **Product commit** | **`020b6f0bc8b7288cf8e10ef6ce117367530cf0f4`** |
| Deploy | [39910763342](https://github.com/jlcormier612/wevenu-website/actions/runs/39910763342) |
| **Serving SHA** | **`020b6f0bc8b7288cf8e10ef6ce117367530cf0f4`** |
| Health | ok |
| Dirty paths | ~1020 unrelated preserved |
| Production | untouched |

---

## 3. Setup entry-point classification (audit)

| Surface | Classification | Notes |
| --- | --- | --- |
| Setup Profile Inventory / EO Included + starting templates | **Retain as configuration** | Labels already “starting … template”; no Send/Create Invoice |
| Setup Profile save / incomplete gaps | **Retain as configuration** | Unchanged |
| Overview Inventory / EO readiness rows | **Retain as readiness indicator** | Not deleted |
| Overview Open Inventory / Open Event Order | **Retain as contextual deep link** | Canonical tabs |
| Change for this event (inv/EO editors) | **Retain as configuration** | Draft customize only; no share/finalize/invoice |
| Release to client portal | **Correct misleading copy** | Explicit: does **not** share Inventory/EO or create invoices |
| Invite client / questionnaires authorized send | **Retain** (out of C6 commercial Send-as-EO) | Separate from EO Send |
| Send-as-EO / Create Invoice on Setup | **Already absent** (C1); **locked by C6 tests** | Acceptance: Setup no longer shows Send-as-EO |

---

## 4. Files changed

| File | Rationale |
| --- | --- |
| `components/events/event-setup-panel.tsx` | Release copy: not Inventory/EO share; not invoice create |
| `lib/event-setup/prepare-release.ts` | Success message: unshared drafts; no invitation/invoice |
| `lib/event-setup/commercial-c6-setup-cleanup.test.ts` | CTA / seam locks |
| `docs/qa/.../verify-browser-c6.mts` | Live Setup no-Send-as-EO + Open deep links |

No schema, readiness completion rules, or template ref persistence changes.

---

## 5. Tests

```text
npx tsx --test \
  lib/event-setup/commercial-c6-setup-cleanup.test.ts \
  lib/event-setup/commercial-c1-terminology.test.ts \
  lib/event-setup/inventory-eo-setup-editor.test.ts \
  lib/event-setup/readiness-detail.test.ts \
  lib/event-setup/booking-to-portal-simplification.test.ts \
  lib/event-setup/profile-config-gaps.test.ts
```

**59/59 pass** (pre-deploy). Focused post-verify also **32/32** including commercial-status + freeze.

---

## 6. Browser (`EXPECTED_SHA=020b6f0b…`)

| Harness | Result |
| --- | --- |
| C6 | **16/16 PASS** |
| C1 | **22/22** |
| C2 | **20/20** |
| C3 | **26/26** |
| C4 | **23/23** |
| C5 | **20/20** |

Evidence: `browser-results-c6.json`, `shots-c6/`, `browser-run-c6.log`, `browser-run-*-after-c6.log`.

Persisted: inventory `1→1`, event orders `1→1` (navigation-only; no Release clicked).

---

## 7. Confirmations

- Checklist / commercial strip still drive portal readiness + event commercial runner  
- Inventory selection and `client_choices` remain separate  
- EO → Invoice → Payment Plan intact (C5 harness green on new SHA)  
- Production untouched; dirty tree preserved  
- **C7 not started**

**Definition of done:** GREEN / CLOSED.
