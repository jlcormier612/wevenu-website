# Client portal — vendor-selection button contrast

**Verdict: NOT GREEN** — fix committed; Sandbox deploy + browser proof pending.

Production untouched. Unrelated dirty tree preserved.

## Root cause

1. Shared `Button` `outline` / `ghost` variants had no resting `text-foreground`, so labels could inherit white (or other parent ink) onto `bg-background`.
2. Vendor Pick / Select fills hardcoded `text-white` on `var(--venue-primary)` — fails when primary resolves to soft sage in dark.
3. Dark `--primary-foreground: forest-sage` on soft-sage primary is ~4.21:1 (below AA for normal button text).

## Fix

| File | Change |
| --- | --- |
| `components/ui/button.tsx` | `outline` + `ghost` resting `text-foreground` |
| `components/portal/vendor-section.tsx` | Confirm Back = `secondary`; readable disabled; Pick/Select use `text-primary-foreground` |
| `app/globals.css` | Dark `--primary-foreground` mix toward black for ≥4.5:1 on soft sage |

## Verification

```text
npx tsx --test lib/portal/vendor-selection-contrast.test.ts \
  lib/portal/client-portal-contrast.test.ts
→ 8/8 pass

EXPECTED_SHA=<sha> npx tsx scripts/qa/vendor-selection-button-contrast.mts
```
