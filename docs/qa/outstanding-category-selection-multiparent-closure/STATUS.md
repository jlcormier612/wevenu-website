# Outstanding Category / Selection / Multi-Parent — Closure

**Overall verdict: GREEN**

**Verified serving ECS image:**  
`405254329873.dkr.ecr.us-east-1.amazonaws.com/htc-sandbox-venue-app:ee0e78101957f078df7e7886032e814a350d802b`

**Tip deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40768875416 — **success** (completed; no competing deploy started for this closure).

**Ancestry on serving tip `ee0e7810`:** includes `36c6fe71` (A), `14650062` (B), `fd4ded13` + display fix `ee0e7810` (C).

**Focused unit tests:** 38 pass / 0 fail — see `unit-tests.log`.

## Acceptance matrix

| Workstream and commit | Deployment run and status | Exact serving ECS SHA | Focused test results | Desktop browser results | 390px browser results | Persistence / integrity results | Relevant QA artifact paths | Final verdict |
|---|---|---|---|---|---|---|---|---|
| **A** Category integrity · `36c6fe71e9a4853cbe749f6a255929cca5818f90` | Tip deploy [40768875416](https://github.com/jlcormier612/wevenu-website/actions/runs/40768875416) success (also prior [40766349078](https://github.com/jlcormier612/wevenu-website/actions/runs/40766349078) for `36c6fe71`) | `ee0e78101957f078df7e7886032e814a350d802b` | category-identity + related: pass (in 38/38) | GREEN — Décor/Florals dropdown, return-to-categories, custom provision | GREEN — package categories reachable | Custom section → venue-scoped `offering_categories`; remove from template keeps shared category; Catering retained | `docs/qa/eo-template-category-integrity/` · `A-*-browser*` · `A-persisted-state.json` | **GREEN** |
| **B** Selection progress / finalize · `14650062ac87e89678e244f05dad93e138386008` | Included in tip deploy 40768875416 success | `ee0e78101957f078df7e7886032e814a350d802b` | selection-progress + validate-answers: pass | GREEN — exact-2 progress, max disable 3rd, submit block under-min | GREEN — portal-390 screenshot | Submitted answers hard=2 beer=3 wine=3; validate rejects incomplete/orphans; finalize uses same validator before EO mutations | `docs/qa/selection-progress-finalize/` · `B-selection-browser.log` · `B-browser-results.json` | **GREEN** |
| **C** Multi-parent catalog display · model `fd4ded13` + fix `ee0e7810` | Tip deploy 40768875416 success | `ee0e78101957f078df7e7886032e814a350d802b` | hierarchy multi-parent placements: pass | GREEN — one Offering, two placements under Buffet + Plated | GREEN — 2 placements at 390 | Two `offering_major_links`; remove one keeps other; EO options share offering_id @ $8/$6; cross-venue rejected. Whiskey DB still has both parents (see `whiskey-persisted.json`) | `docs/qa/offerings-multi-parent/` · `C-*-browser*` · `C-persisted-state.json` · `whiskey-persisted.json` | **GREEN** |

## Defects found during this closure pass

| Item | Product vs harness | Resolution |
|---|---|---|
| Category harness failed once when Catering card click raced hydration (`aria-pressed` stayed false → Continue with zero categories → review empty) | **Harness** | Retry until `aria-pressed=true` before Continue (no product change; serving tip unchanged) |
| Multi-parent catalog under only first parent | **Product** (already fixed in `ee0e7810`) | Re-verified GREEN on serving tip |

No new product defect required a redeploy for this closure.

## Safety

- Production was untouched.
- No production data or infrastructure was modified.
- Unrelated dirty and untracked work was preserved (no reset/stash/clean).
- No competing deployment was started during this closure (tip `ee0e7810` already serving).

## Note on HEAD vs serving

Local HEAD may include harness-only commit `8f3b8f2c` (and further harness tweaks). **Acceptance was run against serving `ee0e7810`**, which contains all three product workstreams. Harness hardenings do not need to be on ECS for these GREEN results.
