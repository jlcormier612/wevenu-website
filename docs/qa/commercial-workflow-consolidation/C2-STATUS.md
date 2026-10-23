# HTC Commercial Workflow Consolidation — C2 Status

**Phase:** C2 — Library Clarity  
**Status:** **PARTIAL** (implementation + unit tests; Sandbox deploy / browser pending in this file — updated on closure)  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Baseline HEAD before C2 commit:** `28bedd9a` (C1 evidence) · product C1 `c75bc0fa` serving  
**Production:** untouched  
**Working tree:** unrelated dirty paths preserved (~1012 before C2 commit). No reset/clean/stash.

---

## 1. Initial inspection

| Item | Value |
| --- | --- |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD | `28bedd9a` |
| Serving (pre-C2) | `c75bc0fa` / ECS image match |
| Dirty paths | ~1003–1012 (unrelated preserved) |

---

## 2. Library forensic map (verified in source)

| Area | Route | Purpose / model | Actions (actual handlers) | Reusable vs event | Misleading risk addressed |
| --- | --- | --- | --- | --- | --- |
| Available Inventory | `/library/inventory` | Catalog `inventory_items` | Create/edit/import; no Use Template | Catalog | Clarified: edit ≠ share / ≠ event list / ≠ EO |
| Offerings | `/library/offerings` | Catalog offerings | Create/edit; link to EO Templates | Catalog | Clarified: edit ≠ client selection / ≠ apply EO |
| Inventory Templates | `/library/inventory-templates` | `inventory_templates` | Edit, Duplicate, Archive, **Use** → `ensureEventInventory`, **Send** → `sendInventoryTemplate` (ensure + `shareEventInventory` + notify) | Template → event | Fixed C1 overclaim that share only happens on event; Use = draft only; Send = share shortcut then event tab |
| Event Order Templates | `/library/event-order-templates` | EO templates + choice groups | Edit, Use (`useEventOrderTemplate`), Send (`sendEventOrderTemplate`, gated) | Template → event | Emphasized Finalize/Share on event; Distinct from sales Packages |
| Packages | `/packages` (Library redirect) | Sales packages / Selected Package source | Edit/duplicate/preview — no EO Send | Sales | Removed “use on Event Orders” ambiguity; Distinct from EO Templates |
| Choices Templates | `/library/choices-templates` | Tombstone | `redirect` → EO Templates | N/A | Confirmed absent from hub; redirect retained |

**Retained:** Library Use/Send shortcuts (accurate labels). **Not removed:** any authoring routes.

---

## 3. Files changed (product)

- `app/(app)/library/page.tsx`
- `app/(app)/library/inventory/page.tsx`
- `app/(app)/library/inventory-templates/page.tsx`
- `app/(app)/library/event-order-templates/page.tsx`
- `app/(app)/packages/page.tsx`
- `components/event-inventory/inventory-template-list.tsx`
- `components/offerings/offerings-page-client.tsx`
- `lib/library/commercial-c2-library-clarity.test.ts`
- `docs/qa/commercial-workflow-consolidation/C2-STATUS.md` (+ harness/evidence on closure)

---

## 4. Tests (pre-deploy)

```text
npx tsx --test \
  lib/library/commercial-c2-library-clarity.test.ts \
  lib/library/library-templates-ia.test.ts \
  lib/event-setup/commercial-c1-terminology.test.ts \
  lib/event-order-templates/use-send.test.ts
```

**Result:** all pass (C2 suite 10/10; combined run 46+ including IA/C1/use-send).

---

## 5. Deployment / browser

*(Filled on closure after Sandbox deploy.)*

---

## 6. Confirmations

- Production untouched: **yes**
- Unrelated dirty preserved: **yes**
- No schema / selection merge / C3 shell: **yes**

---

## 7. Deferred

| Item | Why outside C2 |
| --- | --- |
| Event commercial workspace shell | C3 |
| Removing Library Send shortcuts | Useful when accurately labeled; C6 only if redundant after C3–C5 |
| Help-article Choices Templates sweep | Docs/help, not Library UI |
| Full Path A/B share + invoice browser | C4/C5; this phase is navigation-only (no outbound) |

---

## Verdict

**PARTIAL** until Sandbox serving SHA + browser harness green.
