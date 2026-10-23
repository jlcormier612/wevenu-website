# HTC Commercial Workflow Consolidation — C2 Status

**Phase:** C2 — Library Clarity  
**Status:** **GREEN / CLOSED**  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Product commit:** `bc9db11165beff5856507278faa5f2f0fb57d7a4`  
**Sandbox deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/39900346007 (success)  
**Serving SHA (ECS TD `:891`):** `…/htc-sandbox-venue-app:bc9db11165beff5856507278faa5f2f0fb57d7a4` (matches)  
**Health:** 200  
**Production:** untouched  
**Working tree:** unrelated dirty paths preserved (~1003 after C2 commit). No reset/clean/stash.

Built on C1 GREEN (`c75bc0fa` / C1-STATUS.md).

---

## 1. Initial inspection

| Item | Value |
| --- | --- |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD before C2 | `28bedd9a` |
| Serving before C2 | `c75bc0fa` |
| Dirty paths | ~1003–1012 unrelated preserved |

---

## 2. Library forensic map (code-traced)

| Area | Route | Purpose / model | Actions (handlers) | Effect | C2 clarification |
| --- | --- | --- | --- | --- | --- |
| Available Inventory | `/library/inventory` | Catalog `inventory_items` | Create/edit/import | Catalog only | Edit ≠ share / ≠ event list / ≠ EO |
| Offerings | `/library/offerings` | Offerings catalog | Create/edit | Catalog only | Edit ≠ client selection / ≠ apply EO |
| Inventory Templates | `/library/inventory-templates` | `inventory_templates` | **Use** → `ensureEventInventory`; **Send** → `sendInventoryTemplate` (ensure + `shareEventInventory` + notify) | Event draft / share | Use = no share; Send = share shortcut then event Inventory tab |
| Event Order Templates | `/library/event-order-templates` | EO templates + choice groups | **Use** / gated **Send** | Event EO / choices | Finalize & Share on event; Distinct from sales Packages |
| Packages | `/packages` | Sales packages | Edit/duplicate/preview | Booking / Selected Package | Not Event Order authoring; Distinct from EO Templates |
| Choices Templates | `/library/choices-templates` | Tombstone | redirect → EO Templates | None | Hub absent; redirect retained |

Shortcuts retained where accurate. No routes deleted. No handler behavior changes.

---

## 3. Before → after (copy)

| Surface | Before (issue) | After |
| --- | --- | --- |
| Hub Inventory Templates | “Use creates event inventory” (omits Send/share) | Use = draft; Send = also shares; no invoice |
| Inv Templates page (C1) | Implied share only on event (understated Library Send) | Use does not share; Send applies + shares; continue on event |
| Packages page | “use them on invoices and Event Orders” | Sales packages; Distinct from EO Templates; not EO authoring |
| Available Inventory / Offerings | Weak catalog vs event boundary | Explicit: catalog edits don’t share/select/apply EO |
| Hub / EO Templates | Good Path A/B | Added Distinct from sales Packages |

---

## 4. Files in product commit `bc9db111`

```
app/(app)/library/page.tsx
app/(app)/library/inventory/page.tsx
app/(app)/library/inventory-templates/page.tsx
app/(app)/library/event-order-templates/page.tsx
app/(app)/packages/page.tsx
components/event-inventory/inventory-template-list.tsx
components/offerings/offerings-page-client.tsx
lib/library/commercial-c2-library-clarity.test.ts
docs/qa/commercial-workflow-consolidation/C2-STATUS.md
docs/qa/commercial-workflow-consolidation/verify-browser-c2.mts
```

---

## 5. Tests

```text
npx tsx --test \
  lib/library/commercial-c2-library-clarity.test.ts \
  lib/library/library-templates-ia.test.ts \
  lib/event-setup/commercial-c1-terminology.test.ts \
  lib/event-order-templates/use-send.test.ts
```

**Result:** all pass (C2 10/10; combined IA/C1/use-send green).

---

## 6. Browser (live Sandbox @ `bc9db111`)

Harness: `verify-browser-c2.mts`  
Command: `EXPECTED_SHA=bc9db111… npx tsx docs/qa/commercial-workflow-consolidation/verify-browser-c2.mts`  
**Result: 20/20 PASS** · `browser-results-c2.json` · shots in `shots-c2/`

Verified: all five Library areas; Packages ≠ EO; Available Inventory editable; Inv Templates Use≠share / Send=share; EO Templates + choice-group authoring path retained in copy; Offerings catalog; no Choices Templates card; C1 commercial intro still present; EO invoice/payment language intact; hub @390. **No Use/Send/share/invoice clicks** (no outbound).

---

## 7. Confirmations

- Production untouched: **yes**
- Unrelated dirty preserved: **yes** (`event-task-list.tsx` and other docs/qa dirties unstaged)
- No schema / runtime merge / C3: **yes**

---

## 8. Deferred (outside C2)

| Item | Phase |
| --- | --- |
| Event commercial workspace shell | C3 |
| Progress checklist from statuses | C4 |
| Full Path A/B + invoice send browsers | C4/C5 |
| Remove Setup duplication after replacements | C6 |
| Help-article Choices Templates sweep | Docs |

---

## Verdict

**GREEN / CLOSED** — C2 Library clarity deployed at `bc9db111`, serving SHA confirmed, unit + 20/20 browser checks pass. **C3 not started.**
