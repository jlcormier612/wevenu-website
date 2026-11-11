# Event Order + Inventory + Client Selections + Billing

**Status: VERIFIED (GREEN)**  
**Sandbox only. Production untouched.**  
**No invites / questionnaire sends / customer emails during verification.**  
**Unrelated dirty working tree preserved.**

## Product commit (serving)

`fbd44c7399f78b7b1bcd07da004e51bee55d58a4`

| Item | Value |
| --- | --- |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/39825792468 (**success**) |
| Serving `data-dpl-id` | **exact match** `fbd44c7399f78b7b1bcd07da004e51bee55d58a4` |
| Fixture | event `ebf74f77-2944-474a-b735-48762ecb6842` · client `b4e2764b-…` · EO `624eceef-…` |
| Browser | **17 / 17 PASS** → `browser-results.json` |

## B. Setup-screen verdict

**DEFECT FOUND AND CORRECTED** (clarity only — data chain was already correct)

The Event Order setup screen configures the event **delivery working copy** (Included / Additional). That list matches what the couple sees read-only after Share. It is **not** the couple pick-list; pick-lists are Client selections when templates have choice groups. Pre-fix copy did not state that. Smallest fix: SheetDescription + Inventory Included badges / Share wording.

## C. Findings and corrections

| Defect | Root cause | Fix | Tests |
| --- | --- | --- | --- |
| Couple EO showed $ on Included priced lines | Portal rendered `amount` for all priced lines | `eventOrderPortalLineMoneyLabel` → "Included"; additional-only reference total | `lib/client-portal/event-order-portal-display.test.ts` |
| Inventory setup hid Included vs Additional | Customize UI omitted badges | Badges + operational/share copy | `inventory-eo-setup-editor.test.ts` |
| Inventory workspace looked chargeable for Included | Unit price shown for included | Em-dash for included; Share informational copy | source + browser |
| EO setup read as couple pick-list | Missing framing | Delivery list ≠ Client selections copy | `inventory-eo-setup-editor.test.ts` |

Non-defects retained: invoice filter excludes included; Share/Finalize do not invite or invoice; Library templates not mutated by setup; Client selections lifecycle intact.

## D. Workflow verification

| Item | Result |
| --- | --- |
| Setup + template framing | **VERIFIED** |
| Couple-facing offerings (delivery / Included label) | **VERIFIED** (staff draft preview; EO unshared) |
| Draft save / couple submit | **PARTIAL** — Client selections path unchanged; not re-exercised end-to-end this run |
| Venue confirm / request changes | **PARTIAL** — existing lifecycle retained; not re-clicked |
| Included vs optional Inventory | **VERIFIED** (28 Included badges in setup) |
| Operational quantities | **VERIFIED** (DB + setup) |
| Billing eligibility / no duplicate charge from browse | **VERIFIED** (included priced excluded; invoices 38→38) |
| Authorization / cross-event | **PARTIAL** — venue-scoped actions unchanged; no cross-event write observed |
| Read-only preview / side effects | **VERIFIED** (invites 27→27; templates unchanged) |

## E. Tests

```text
npx tsx --test lib/client-portal/event-order-portal-display.test.ts \
  lib/event-setup/inventory-eo-setup-editor.test.ts \
  lib/client-portal-preview/portal-preview-fidelity.test.ts \
  lib/invoices/eo-freeze-billable.test.ts \
  lib/client-choices/post-booking-lifecycle.test.ts \
  lib/event-orders/event-order-completeness.test.ts
→ 45 / 45 pass

EXPECTED_SHA=fbd44c73… npx tsx docs/qa/eo-inventory-selections-billing/verify-browser.mts
→ 17 / 17 PASS
```

## F. Screenshots

- `docs/qa/eo-inventory-selections-billing/shots/eo-setup-1280.png`
- `docs/qa/eo-inventory-selections-billing/shots/inventory-setup-1280.png`
- `docs/qa/eo-inventory-selections-billing/shots/inventory-workspace-1280.png`
- `docs/qa/eo-inventory-selections-billing/shots/portal-preview-eo-1280.png`
- `docs/qa/eo-inventory-selections-billing/shots/event-order-workspace-1280.png`

## G. Scope and safety

- Production untouched  
- Only task files committed (`fbd44c73` product + this evidence commit)  
- No external communications  
- No Library / invoice / payment-plan mutations from the browser pass  

## H. Remaining

Couple Client selections submit → venue finalize → Create Invoice click-path not re-driven this run (commercial unit tests already cover billable filters). Optional follow-up if a live selections fixture is needed for browser proof of that branch only.
