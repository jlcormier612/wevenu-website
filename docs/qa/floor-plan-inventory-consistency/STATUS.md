# STATUS — Floor-plan / inventory consistency

**Verdict: GREEN / CLOSED**

| Item | Value |
|------|-------|
| Commit | `d9e25c77af78c5e46de46dc831eda8c190dab556` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40242707489 |
| Image | `htc-sandbox-venue-app:d9e25c77…` |
| Digest | `sha256:63e9cfdaf8f7f1c196deef86930675f4889022ca1119d02b4565a96f470c93c0` |
| Production | Untouched |

## Root cause

Placement IDs (C1/T1) were treated as the object’s commercial identity; inventory palette adds stamped inventory names into labels; properties did not surface item type vs placement vs link; cocktail capacity defaulted to round-table seats.

## Fix

Identity helpers + properties panel (item type, placement label, explicit inventory link), shape-aware placement labels/capacities on add, honest usage copy. No name-matching, no reservation engine, no bulk layout rewrite.

## Intentional limitations

- Unlinked starters remain unlinked until the venue links them.
- Inventory qty 0 until the venue configures stock.
- Placement counts are not automatic stock allocation.
