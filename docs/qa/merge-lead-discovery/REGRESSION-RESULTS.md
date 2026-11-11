# Regression results — Merge Lead discovery

## Unit / source

`npx tsx --test lib/leads/merge.test.ts` — **30/30 PASS** (committed with `5c7fc274`).

## Browser E2E (serving image)

Command:

```bash
EXPECTED_SHA=ad4d5b8b52002a3a9154fe311d7d196878fb82e8 \
  npx tsx docs/qa/merge-lead-discovery/verify-browser.mts
```

| Item | Value |
|------|--------|
| Result | **GREEN** — 29/29 checks |
| Serving image | `…/htc-sandbox-venue-app:ad4d5b8b52002a3a9154fe311d7d196878fb82e8` |
| Digest | `sha256:a25e67919ca7775ba51a7fda24e9c23cd081906bf3856316715cd44af3a122db` |
| Merge product commit | `5c7fc274` (ancestor of serving `ad4d5b8b`) |
| Deploy that landed merge | [40249911229](https://github.com/jlcormier612/wevenu-website/actions/runs/40249911229) success |
| Deploy currently serving | [40250604713](https://github.com/jlcormier612/wevenu-website/actions/runs/40250604713) success (`ad4d5b8b`) |

### Workflow coverage

| Check | Result |
|-------|--------|
| Search-first UI (no UUID-required) | PASS |
| Search by name (ambiguous matches) | PASS |
| Search by phone / email | PASS |
| Current lead excluded | PASS |
| Preview earliest survivor | PASS |
| Cancel → no soft-merge / identity preserved | PASS |
| Confirm controlled merge | PASS |
| Secondary soft-marked; phone filled; partner email kept | PASS |
| Tour reassociated (same row id, not recreate) | PASS |
| UI after reload | PASS |
| Self-merge / missing ID blocked | PASS |

Artifacts: `browser-results.json`, `browser-run.log`, `shots/`.
