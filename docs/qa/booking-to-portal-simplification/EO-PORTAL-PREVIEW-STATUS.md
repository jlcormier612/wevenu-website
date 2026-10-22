# Event Order completeness + Client portal preview — STATUS

**Verdict: IN PROGRESS** — product committed; Sandbox browser+DB proof pending on serving SHA.

Production untouched. Unrelated dirty tree preserved.

## Preflight

| Item | Value |
| --- | --- |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD at start | `b6ea3d30` (evidence) atop Floor product `cb25fb81` |
| Serving at start | `cb25fb81…` |
| Floor Plans lifecycle | GREEN (`FLOOR-WORKING-LAYOUT-STATUS.md`) |
| Dirty tree | ~900 unrelated paths preserved |

## Root cause — Event Order incompleteness

1. Fancy Setup Profile points at Library template **Ceremony + Reception** (`EO-D-02`, `d73d9734-…`).
2. That template had **6 sections and 0 offerings** — provision skipped recreating it once `source_master_key` existed, leaving an empty delivery shell.
3. `ensure` / `replace` copied the empty template into the event, so the event-specific editor correctly showed few/no lines.
4. Separately, `defaultApplySelections` omits priced optionals; setup package switch needed full package materialization with Included vs Additional preserved via `includedByDefault`.

## Fix

- `repairEmptyDeliveryStarterOfferings` fills EO-D-* templates that have sections but zero lines (idempotent; never touches templates that already have offerings).
- `packageStartingSelections` materializes **all** package offerings on setup/inherit/replace; optionals stay `isIncluded=false`.
- `ensureEventOrder` heals empty open/unshared event shells after repair.
- Copy path dedupes by section+description on merge/re-apply.
- Setup editor groups lines by section and shows Included/Additional.

## Preview architecture

- Staff route: `/clients/[id]/portal-preview?event=`
- Entry: Event setup → **Preview client portal** (before Release / Invite).
- Server loader `loadClientPortalPreview` — venue-scoped, read-only SELECTs + existing get* services.
- Distinguishes **Visible to client** vs **Preview — not yet released**.
- Does not use portal invite tokens; does not call release/invite/share/invoice/ensureWorkingLayout mutation paths.
- Reuses the same Event Order / Floor Plan visual patterns as the portal (shared SVG renderer for layouts).

## Tests (local)

```text
npx tsx --test lib/event-orders/event-order-completeness.test.ts \
  lib/event-order-templates/offerings.test.ts \
  lib/event-setup/inventory-eo-setup-editor.test.ts
→ 46 pass / 0 fail
```

## Browser / deploy

Pending after Sandbox deploy of this product commit. Harness:

```text
EXPECTED_SHA=<sha> npx tsx scripts/qa/event-order-portal-preview-acceptance.mts
```

Evidence outputs under this folder: `eo-portal-preview-results.json`, screenshots.
