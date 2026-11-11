# Test results — Luv contextual intelligence

## Unit

```bash
npx tsx --test \
  lib/luv/observation-quality.test.ts \
  lib/luv/contextual-intelligence-factuality.test.ts \
  lib/dashboard-system/luv-entry.test.ts \
  lib/dashboard/phase3b-l1-critical-path.test.ts \
  lib/luv/pipeline-stage-evidence.test.ts \
  lib/tours/early-completion-lifecycle.test.ts
```

**95 pass / 0 fail** (`unit-test.log`) plus presence add-on in `presence-unit.log` (Calendar Focus + Tasks still surfaces Luv).

Includes:
- Failure A: Tasks Focus does not emit past-due aggregate; useful L1 still wins
- Failure B: scheduled ≠ all-set; confirmation requested ≠ confirmed; confirmed all-set OK
- Presence: Calendar Focus still surfaces Luv when overdue Tasks also exist
- Adjacent: completed/cancelled silence; pipeline stage still not evidence

## Browser (Sandbox serving `ad4d5b8b`)

Harness: `EXPECTED_SHA=ad4d5b8b52002a3a9154fe311d7d196878fb82e8 npx tsx docs/qa/luv-contextual-intelligence/verify-browser.mts`

**GREEN** — `browser-results.json` / `BROWSER-VERIFICATION.md`

| Check | Result |
|-------|--------|
| serving-sha / digest | PASS |
| A — no redundant overdue Luv | PASS |
| A — Focus still lists overdue | PASS |
| Presence — Luv when Calendar Focus | PASS |
| B — scheduled, confirmation actions, no all-set | PASS |
| B — confirmed persisted + UI | PASS |

Shots under `shots/`.
