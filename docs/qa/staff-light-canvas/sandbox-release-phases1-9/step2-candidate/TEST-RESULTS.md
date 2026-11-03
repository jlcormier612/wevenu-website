# Step 2 — Test Results

## Focused Phase 1–9 suite

**Command:**

```bash
cd /Users/jensmac/Developer/htc-visual-p1-9-release
npx tsx --test \
  lib/library/library-guidance-calm.test.ts \
  lib/conversations/inbox-no-selection-calm.test.ts \
  lib/communication/color-distribution-phase3.test.ts \
  lib/theme/color-distribution-phase4.test.ts \
  lib/theme/color-distribution-phase5.test.ts \
  lib/theme/color-distribution-phase6.test.ts \
  lib/theme/color-distribution-phase7.test.ts \
  lib/theme/color-distribution-phase8.test.ts \
  lib/theme/color-distribution-phase9.test.ts \
  lib/setup-hub/stage-section-runs.test.ts
```

**Result:** `tests 61` · `suites 11` · **pass 61** · **fail 0**

Phase 10 tests were **not** run and are **not** in the candidate.

## Typecheck

```bash
npx tsc --noEmit -p tsconfig.json
```

**Exit:** 2  
**Errors:** 108 (baseline test-file noise on Sandbox-compatible tip)  
**Release-scope errors:** 0 (`NO_ERRORS_IN_RELEASE_SCOPE`)

Not weakened. Documented as known baseline failures per Step 1 verification plan §7.

## Production build

```bash
npm run build
```

**Exit:** 0 — `✓ Compiled successfully in 35.9s` (Next.js 16.2.9 Turbopack)

## CSS / style static gates

Presence and absence greps: **PASS** (see `CSS-EXTRACTION.md`, `EXCLUSION-VERIFICATION.md`).
