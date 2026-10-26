# Test results — Luv contextual intelligence

## Command

```bash
npx tsx --test \
  lib/luv/observation-quality.test.ts \
  lib/luv/contextual-intelligence-factuality.test.ts \
  lib/dashboard-system/luv-entry.test.ts \
  lib/dashboard/phase3b-l1-critical-path.test.ts \
  lib/luv/pipeline-stage-evidence.test.ts \
  lib/tours/early-completion-lifecycle.test.ts
```

## Result

**95 pass / 0 fail** (see `unit-test.log`)

Includes:
- Failure A: Tasks Focus does not emit past-due aggregate; useful L1 still wins
- Failure B: scheduled ≠ all-set; confirmation requested ≠ confirmed; confirmed all-set OK
- Adjacent: completed/cancelled silence; pipeline stage still not evidence
- Early tour completion Calendar aggregate still works (non-Tasks)

## Browser

Pending serving image of the fix commit — `verify-browser.mts` + `BROWSER-VERIFICATION.md`.
