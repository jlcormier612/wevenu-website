# Floor-plan template redesign — STATUS

**Verdict: NOT GREEN** — implementation ready to deploy; Sandbox verification pending.

## Starters (canonical masters)

| Key | Name | Contents |
| --- | --- | --- |
| FP-03 | Wedding Ceremony | Ceremony seating + arbor/aisle |
| FP-04 | Cocktail Hour | High-tops + bar |
| FP-02 | Wedding Reception | Dining, dance floor, service areas |
| FP-SR | Same-Room Ceremony + Reception Flip | Specialized static dual-reference (honest: no phase switch) |
| FP-05 | Blank Floor Plan | Zero objects |

Legacy **FP-01** combined canvas is no longer provisioned; existing venue copies remain intact.

## Files

- `lib/floor-plan-templates/starters.ts` (+ tests)
- `lib/floor-plan-templates/provision.ts` (comment)
- `lib/floor-plan-templates/types.ts` (comment)
- `components/floor-plan-templates/floor-plan-templates-section.tsx` (description + flip badge)
- `docs/qa/floor-plan-template-redesign/*`

## Safety

Production untouched. Existing event plans and customized/legacy templates not overwritten. Client submit-confirm dialog unchanged.
