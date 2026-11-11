# Offerings multi-parent catalog display — STATUS

**Verdict: GREEN**

## Root cause (display defect)
Whiskey (Meadowbrook) already had **both** `offering_major_links` rows. Catalog helper nested multi-parent items **once** under the first parent by name. Fixed in `ee0e7810` to emit one placement under **each** associated major (same Offering record).

## Commit / serving
| Item | Value |
|---|---|
| Model commit | `fd4ded1388861e779ecb4123f418117b7900c02b` |
| Display fix | `ee0e78101957f078df7e7886032e814a350d802b` |
| ECS image | `htc-sandbox-venue-app:ee0e78101957f078df7e7886032e814a350d802b` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40768875416 |
| Migration | `20261425700000_offering_major_links.sql` (already applied) |

## Persisted Whiskey (pre-fix inspection)
- Offering `2ab70492-…` · venue Meadowbrook `05f16a15-…`
- Links: Guest Paid Bar Offering + Premium open bar
- Legacy `parent_offering_id` = Guest Paid Bar Offering

## Browser acceptance
```bash
EXPECTED_SHA=ee0e78101957f078df7e7886032e814a350d802b \
  npx tsx docs/qa/offerings-multi-parent/verify-browser.mts
→ GREEN — 20 pass / 0 fail
```

Evidence: `browser-results.json`, `browser-run.log`, `persisted-state.json`, `shots/offerings-both-parents-1280.png`, `shots/offerings-both-parents-390.png`.

### Proven
- One catalog row; two placements (`data-nest-under` buffet + plated)
- Labels `Under …Buffet` and `Under …Plated`
- Reopen keeps both checks; remove one parent → one placement; restore → two
- EO template two options share offering_id with distinct prices ($8 / $6)
- Cross-venue link rejected; unrelated catalog count unchanged

## Unit tests
`hierarchy.test.ts` — multi-parent placements under every major (incl. Whiskey-style bar case).

## Production
Untouched. Unrelated dirty work preserved.
