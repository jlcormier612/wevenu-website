# Event Order conditional choices — STATUS

**Verdict: GREEN / CLOSED**

All required checks passed on the same verified Sandbox serving image containing commit `a68e8e97…`. Fresh re-verification completed after independent ECS digest confirmation.

## Serving (independently verified)

| Field | Value |
|-------|-------|
| Commit | `a68e8e9798b960f41f9058f50c62edb9c84f6ff1` |
| Image | `405254329873.dkr.ecr.us-east-1.amazonaws.com/htc-sandbox-venue-app:a68e8e9798b960f41f9058f50c62edb9c84f6ff1` |
| Digest | `sha256:535134b1609fdef6339a42aff8a3cb691500bcaab19b4e1caff54e70f9b4272a` |
| Migration | [40227553347](https://github.com/jlcormier612/wevenu-website/actions/runs/40227553347) **success** |
| Deploy | [40227555011](https://github.com/jlcormier612/wevenu-website/actions/runs/40227555011) **success** (all builds + stack + Wait & verify) |
| Production | Untouched |

ECS task image/digest were read directly from the running Sandbox venue-app service and match the harness `EXPECTED_SHA` / recorded digest. Serving SHA was unchanged through the full EO run.

## Three harnesses (same image — re-verification)

| Harness | Result | Evidence |
|---------|--------|----------|
| Conditional choices | **26/26 GREEN** | `browser-run-rereverify.log`, `browser-results.json`, `persisted-state.json`, `shots/` |
| Default-template | **21/21 GREEN** | `default-template-run-a68e8e97-rereverify.log` |
| Full Event Order | **61/61 GREEN** | `full-eo-run-a68e8e97-rereverify.log`, `full-eo-browser-results-a68e8e97-rereverify.json` |

Also: `closure-summary.json`, `persisted-financial-after-rereverify.json`

## Conditional proofs

1. Parent → dependent reveal (Plated-only / Buffet-only / Bar); templates keep **honest-empty** children (0 invented catalog options).
2. Parent switch clears inactive children from UI and persisted answers.
3. RPC rejects missing parent, missing active required child, and orphan inactive-child answers; accepts coherent selections.
4. Portal submit / reopen persistence agrees with active billable state.

## Financial / parent-child persisted state (after full EO re-verify)

| Item | Value |
|------|-------|
| Plated Dinner lines | **1** |
| Buffet Dinner lines | **0** |
| Invoice / plan / portal payable | **$2,189.81** |
| Invoice freeze revision | **26** (authorized reopen → update draft → issue/freeze during harness; not a silent rewrite) |
| Finalized EO | `624eceef-…` remains `finalized` |

## Model

Conditional dependencies required additive `depends_on_option_ids` (mirrored as frozen `dependsOnOptionIds`). Starters EO-D-01 / EO-D-02 wire dinner/bar parents to empty dependent scaffolds.

## Unresolved blockers

None.
