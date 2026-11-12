# Performance change manifest

**Branch:** `perf/launch-remediation`  
**Based on:** `integrate/sandbox-release-candidate` / PR #33 @ `ee22f319`  
**Do not merge/deploy without explicit approval.**

| Wave | Commit scope | Depends on | Conflicts with #33? | Ready? |
| --- | --- | --- | --- | --- |
| B | Route `loading.tsx` + `HospitalityRouteLoading` | None beyond #33 tip | No | Yes |
| C2 | Dashboard Suspense islands + `cache()` | Wave B optional | No | Yes |
| C1 | Tab-scoped workspace data | Design approval | Possible touch of client/lead pages | **Blocked on design** |
| C3 | Demo script Claire IDs | Docs only | No | Doc done |
| D | Selective refresh/optimistic | #31 pattern | Case-by-case | Later |

Excluded: Stripe, Production, demo reseed, unapproved migrations, hospitality visual baseline overwrites.
