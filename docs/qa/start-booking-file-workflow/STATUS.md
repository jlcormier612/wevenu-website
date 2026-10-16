# Start booking file workflow revamp

**Status: GREEN** on Sandbox tip `f25c047b`  
**Environment:** Sandbox only  
**Production:** untouched  
**Gina:** not mutated (verification used Fancy disposable lead)

## Deploy / serving

| Item | Value |
|---|---|
| Commit | `f25c047b82fcd5401e6b4d89b0a4201f2b904d34` |
| Deploy | [38846604143](https://github.com/jlcormier612/wevenu-website/actions/runs/38846604143) **success** |
| Serving image | `htc-sandbox-venue-app:f25c047b82fcd5401e6b4d89b0a4201f2b904d34` |
| Task definition | `htc-sandbox-venue-app:775` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| `dpl` header | `f25c047b82fcd5401e6b4d89b0a4201f2b904d34` |

## Root cause (preserved)

After Start booking file, `linkedClientId` hid the Start CTA and no Continue/Resume existed. Workspace remained at `/clients/{id}`. See `AUDIT.md`, `gina-readonly.json`.

## Browser + DB verification (Fancy disposable)

Harness: `verify-browser.mts` → `browser-results.json` — **ALL PASS**

### A. Start → leave → Continue setup
- Disposable lead → Start booking file → client workspace
- Lead shows Continue setup; Start hidden
- Resume reopens **same** client ID; second resume → still 1 client
- Client `status=booking`; lead stays `new_inquiry`; no date holds

### B. Multi floor-plan templates
- Selected 2 templates in one Apply → 2 independent plans named from templates
- Blank + Duplicate still work (4 plans after blanks/dups)
- Persisted after reload

### C. Multi vendors
- Assigned 2 vendors in one submit with arrival/setup/load-in/internal notes
- Relist excludes already-assigned; no duplicate assignment rows
- `vendor_invitations` created during window: **0**

### D. Lifecycle
- Questionnaires copy: unavailable until Booked
- Still not Booked after all setup
- No holds created

Screenshots: `a-*`, `b-*`, `c-*`, `d-*` in this directory.

## Tests

```text
npx tsx --test lib/booking-journey/start-booking-file-resume.test.ts \
  lib/leads/booking-lifecycle.test.ts \
  lib/booking-journey/booking-started-semantics.test.ts \
  lib/booking-journey/spine-remediation.test.ts \
  lib/leads/lead-workspace-compaction.test.ts
```

**54/54 pass**

## Limitations

- Multi-template apply is sequential actions (not a single RPC); partial failure would leave earlier plans (not observed).
- Disposable fixture cleaned up after proof; Gina left untouched.
