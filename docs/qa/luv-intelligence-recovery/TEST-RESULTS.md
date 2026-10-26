# Test results — Luv intelligence recovery

## Unit

```bash
npx tsx --test \
  lib/luv/intelligence-recovery.test.ts \
  lib/luv/observation-quality.test.ts \
  lib/luv/contextual-intelligence-factuality.test.ts \
  lib/dashboard-system/luv-entry.test.ts
```

**61 pass / 0 fail** (`unit-test.log`)

Includes:
- Overdue task priority (oldest due) without past-due restatement
- Tasks-only silence when priority cannot be invented
- Confirmed tour celebration + logistics CTA
- Scheduled ≠ all-set (preserved)
- Live L1 still wins beside overdue tasks (preserved)

## Browser

Pending Sandbox serve of the recovery commit — `verify-browser.mts`.
