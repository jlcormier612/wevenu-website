# Lead Merge — Status

**Status: GREEN**  
**Serving:** `14bf79a6` / TD `htc-sandbox-venue-app:811`  
**Image:** `htc-sandbox-venue-app:14bf79a6f04ad43a7dbd89c7a1e3d67b37918919`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/39509479089  
**Migration:** `20261420100000_lead_merge.sql` via https://github.com/jlcormier612/wevenu-website/actions/runs/39507787530  
**Production:** untouched

## Evidence
| Check | Result |
|-------|--------|
| Tour cancel releases slot + reparent probe | 8/8 (`probe-tour-slot-results.json`) |
| Merge RPC (fields, notes, tour, idempotent, cross-venue) | 9/9 (`probe-merge-rpc-results.json`) |
| Unit + regression suites | 53/53 then merge 15/15 |
| Browser Fancy disposable merge + redirect + DB | 9/9 (`browser-results.json`) |
| `/api/health` | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |

## Commits
- `743ccab4` — feature + migration
- `14bf79a6` — TS nullability fix (serving)
