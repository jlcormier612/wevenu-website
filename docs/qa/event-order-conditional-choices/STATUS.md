# Event Order conditional choices — STATUS

**Verdict: GREEN** on serving Sandbox image `a68e8e97`.

## Serving (verified)

| Field | Value |
|-------|-------|
| Commit | `a68e8e9798b960f41f9058f50c62edb9c84f6ff1` |
| Image | `405254329873.dkr.ecr.us-east-1.amazonaws.com/htc-sandbox-venue-app:a68e8e9798b960f41f9058f50c62edb9c84f6ff1` |
| Digest | `sha256:535134b1609fdef6339a42aff8a3cb691500bcaab19b4e1caff54e70f9b4272a` |
| Migration | [40227553347](https://github.com/jlcormier612/wevenu-website/actions/runs/40227553347) **success** |
| Deploy | [40227555011](https://github.com/jlcormier612/wevenu-website/actions/runs/40227555011) **success** |
| Production | Untouched |

## Three harnesses (same serving image)

| Harness | Result | Evidence |
|---------|--------|----------|
| Conditional choices | **26/26 GREEN** | `browser-results.json`, `browser-run.log`, `persisted-state.json`, `shots/` |
| Default-template correction | **21/21 GREEN** | `default-template-run-a68e8e97.log` |
| Full Event Order journey | **61/61 GREEN** | `full-eo-run-a68e8e97-r2.log`, `full-eo-browser-results-a68e8e97.json` |

Summary: `closure-summary.json`

## Conditional proofs (required)

1. **Parent → dependent reveal** — Plated shows only Plated dinner details (+ fixture choice in disposable packet); Buffet hidden. Bar → Beer & Wine details. Template itself keeps **honest-empty** children (0 catalog options).
2. **Parent switch clears inactive children** — Plated → Buffet drops plated child from UI and persisted answers (`browser-no-stale-plated-child`).
3. **Server enforcement** — RPC rejects missing parent, missing active required child, and orphan inactive-child answers; accepts coherent plated+child. Portal submit persistence matches UI.
4. **Regressions** — default template 21/21; full EO 61/61 (including financial assertions). Customized Wedding Reception preserved; finalized EO `624eceef-…` revision 24 untouched.

## Model note

Conditional dependencies **required** additive `depends_on_option_ids` (not present before). Starters EO-D-01 / EO-D-02 wire dinner/bar parents to empty dependent scaffolds — no invented menu items.

## Harness fixes during verification (no redeploy)

- Conditional harness: use `?view=choices#choices` (not nonexistent `/p/.../choices`).
- Full EO harness: explicit Plated Dinner click; count only newly submitted packets (not historical `submitted_at`).
