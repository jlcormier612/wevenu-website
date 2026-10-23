# HTC Commercial Workflow Consolidation — C1 Status

**Phase:** C1 — Navigation & Terminology  
**Status:** **PARTIAL** (code + unit tests green; Sandbox deploy / browser not run — changes uncommitted)  
**Date:** 2026-10-22  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD at start/end of C1 work:** `ad3afd3f9b1f4b8c63d6e0d57d64f8b46de95a92`  
**Sandbox serving (ECS / latest deployment API):** `ad3afd3f` (deployment id `7269830526`) — **does not include C1 copy changes**  
**Production:** untouched  
**Working tree:** pre-existing dirty work preserved (~1004 → ~1025 paths after C1 edits + this report). No reset / clean / stash.

---

## 1. Files and routes inspected

| Area | Routes / files |
| --- | --- |
| Audit baseline | `docs/qa/commercial-workflow-consolidation/AUDIT.md` |
| Setup Profiles | `/settings/leads/setup-profiles` → `components/settings/setup-profiles-section.tsx`, `lib/event-setup/profiles.ts`, `profile-config-gaps.ts` |
| Overview Setup | `components/events/event-setup-panel.tsx`, `lib/event-setup/readiness-detail.ts` |
| Event commercial tabs | `components/events/event-detail.tsx` (`event-order`, `inventory`, `invoice`), `EventOrderPanel`, `ClientChoicesPanel`, `EventInventoryPanel` |
| Setup editors | `event-order-setup-editor.tsx`, `event-inventory-setup-editor.tsx` |
| Library | `/library`, `/library/event-order-templates`, `/library/inventory-templates`, offerings, packages |
| Capabilities | `lib/playbooks/capabilities.ts` |
| EO Use/Send | `event-order-template-list.tsx`, `use-send` (already Path A/B correct post-`10caa16b`) |
| Finance | Invoice link remains on Event Order panel; Payments tab unchanged |

Discrepancy vs audit: none material. Library EO Templates page already had Path A/B copy; C1 focused on Setup Profile / Overview / event workspace terminology and a commercial-home intro.

---

## 2. Entry-point classification

| Entry point | Classification | C1 action |
| --- | --- | --- |
| Event tab **Event Order** (+ Client Choices + invoice CTA) | **Canonical workflow** | Added commercial-workspace intro; clarified EO panel copy |
| Event tab **Inventory** | **Canonical workflow** (Path B1) | Terminology: starting inventory template |
| Event tab **Payments / Invoice** | **Canonical** finance handoff | Retained unchanged |
| Library Available Inventory / Offerings / Inv Templates / EO Templates | **Configuration** | Retained; Packages vs EO Templates clarified on Library home; Inv Templates description clarifies apply ≠ share |
| Library EO **Use** / **Send** | **Configuration → event** (Use) / Path B2 send | Retained; existing Path A/B gating kept |
| Setup Profiles starting Inv / EO refs | **Configuration** (defaults) | Renamed package/offering → template; clarified event tabs run the workflow |
| Overview Setup Inventory / EO rows | **Readiness** (+ deep link Open) | Copy clarifies readiness ≠ send/invoice; Open CTAs retained |
| Overview **Change for this event** editors | **Contextual** draft customize | Terminology fix; still no share/invoice |
| Portal Inventory / Event Order / Your Choices | **Client-facing** | Untouched |
| Choices Templates Library tombstones | Tombstone / redirect | Untouched (C2) |
| Setup Hub financials | Onboarding | Untouched |

No entry points deleted. Misleading **duplicate** behavior (Setup implying send/invoice) addressed with copy only — rows retained (C6 deferral).

---

## 3. Changes made (and why)

1. **“Starting package” → “starting Event Order template”** wherever the referenced entity is `eventOrderTemplateId` / Event Order Templates (Setup Profiles, readiness, gaps, capabilities, setup editor, EO panel, service messages).  
   *Why:* Locked decision — Packages ≠ Event Orders.
2. **“Starting offering” → “starting inventory template”** wherever the referenced entity is an Inventory Template (not Offerings catalog).  
   *Why:* “Offering” collided with Offerings catalog; entity is an inventory template.
3. **Overview Setup** intro + readiness summaries state that share / choices / finalize / invoice run on event Inventory / Event Order tabs.  
   *Why:* C1 narrative — Setup = readiness, not commercial runner.
4. **Event Order tab** `data-testid="event-commercial-workspace-intro"` — short commercial home copy.  
   *Why:* Establish canonical home without C3 shell redesign.
5. **Library home Packages** card notes distinction from Event Order Templates; Inventory Templates description notes share happens on event tab.
6. **Regression tests** updated + `lib/event-setup/commercial-c1-terminology.test.ts` added.

---

## 4. Entry points deliberately retained

- Overview Setup Inventory / Event Order cards and Open / Change CTAs (readiness + deep links; product default from audit).
- Library Use / Send on EO Templates (configuration apply / Path B send).
- Client Choices panel above Event Order (separate runtime).
- Portal sections and capabilities toggles.
- Sales Packages product and booking package flows (unchanged wording in booking journey).

---

## 5. Tests run

```text
npx tsx --test \
  lib/event-setup/commercial-c1-terminology.test.ts \
  lib/event-setup/readiness-detail.test.ts \
  lib/event-setup/profile-config-gaps.test.ts \
  lib/event-setup/setup-profile-model.test.ts \
  lib/event-setup/inventory-eo-setup-editor.test.ts \
  lib/event-order-templates/use-send.test.ts
```

**Result:** all passed (66 + 7 use-send; C1 terminology suite 5/5).

Browser harness: **not run** (C1 not deployed; no commit requested).

---

## 6. Browser verification

**None.** Serving SHA remains `ad3afd3f` without these copy edits.

---

## 7. Deployment

**Not deployed.** C1 changes are local working-tree only. No Production deploy. Latest Sandbox deployment still `7269830526` @ `ad3afd3f`.

---

## 8–9. Confirmations

- Production untouched: **yes**
- Pre-existing dirty changes preserved: **yes** (no reset/clean/stash; only targeted C1 files edited)
- Schema / lifecycle / selection merge: **none**
- Invoice freeze / payment-plan flows: **untouched**

---

## 10. Deferred to C2–C7

| Item | Phase |
| --- | --- |
| Broader Library IA / Choices tombstone link crawl | C2 |
| Event commercial sub-nav shell (Order / Choices / Invoice composition) | C3 |
| Progress checklist from existing statuses | C4 |
| Finance browser re-verify | C5 |
| Remove misleading Setup CTAs after replacements green | C6 |
| Portal/tasks/messaging regression | C7 |
| Commit + Sandbox deploy + browser Overview→tab deep links | After C1 approval / commit authorization |

---

## Verdict

**PARTIAL** — C1 navigation/terminology implemented and unit-tested; not Sandbox-verified until committed and deployed.
