# Combined Sandbox acceptance matrix

**Serving:** `d9e25c77af78c5e46de46dc831eda8c190dab556`  
**Digest:** `sha256:63e9cfdaf8f7f1c196deef86930675f4889022ca1119d02b4565a96f470c93c0`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40242707489  
**Live `dpl=`:** confirmed on `https://app.sandbox.hellotocheers.com/login`

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Serving image contains package-led EO (`20e9e316`) | **PASS** | Ancestor of `d9e25c77`; `package-led-run.log` |
| 2 | Serving image contains category-first builder (`e7f7178e`) | **PASS** | Ancestor; `template-builder-run.log` |
| 3 | Serving image contains FP/inventory identity (`d9e25c77`) | **PASS** | Tip image; `floor-plan-run.log` |
| 4 | Package inclusions seeded as included custom + `package-selection:` notes | **PASS** | package-led harness |
| 5 | Inclusion reconcile idempotent; no invented Offering / auto package fee | **PASS** | package-led harness |
| 6 | Category nav, nested plated/buffet, preferred Offering filter, preview, persist | **PASS** | template-builder harness |
| 7 | Client plated↔buffet branch isolation + submit persistence | **PASS** | `conditional-choices-run.log` 26/26 |
| 8 | Placement label ≠ item type; cocktail seats=4; explicit link/unlink | **PASS** | floor-plan harness |
| 9 | No name-based inventory links; honest qty/used copy | **PASS** | floor-plan harness |
| 10 | EO ↔ invoice ↔ payable reconcile on Fancy fixture | **PASS** | financial: total **2189.81**, freeze **26** |
| 11 | Choice-tree / Offering-link / FP identity units | **PASS** | `unit-regression.log` **76/76** |
| 12 | Production untouched | **PASS** | Sandbox-only hosts + deploy |

## Intentional limitations (not defects)

- Fancy finalized invoice has **no payment schedule** (`schedules: null`) — reconcile skipped by design for that fixture.
- Starter floor-plan objects remain unlinked until the venue links them.
- Inventory `quantity_available=0` means unset stock, not allocatable inventory.
- Floor-plan placements do not reserve stock across events.
