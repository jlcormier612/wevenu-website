# Merge Lead UX / language verification — STATUS

**Status: GREEN**  
**Serving:** `8bc6afed` / TD `htc-sandbox-venue-app:813`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/39514538048  
**Production:** untouched

## Prior evidence classification
- `14bf79a6` / `:811` browser merge (manual ID paste) was real magic-link UI — still valid as merge-engine proof.
- Serving moved to `422eadcc` then **`8bc6afed`** (this UX pass). Re-verified on exact serving SHA.

## This pass
| Suite | Result |
|-------|--------|
| Unit (duplicate + merge + delete reconcile) | **52/52** |
| Duplicate modal + Merge CTA + conflict + tour reparent browser | **19/19** (`duplicate-ux-results.json`) |
| Two-tour merge with explicit cancel + slot rebook | **8/8** (`tour-cancel-merge-results.json`) |

## Copy / UX changes (commit `8bc6afed`)
- Possible-duplicate banner/modal: **Possible duplicate lead**; no manual copy/delete; Merge lead opens dialog with matched ID + auto-preview
- Soft-merged leads excluded from lead-received reporting totals (`getLeadsTrend`)
