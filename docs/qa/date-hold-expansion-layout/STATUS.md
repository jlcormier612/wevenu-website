# Date hold expansion layout

**Status: IN PROGRESS** — fix committed; Sandbox deploy running; browser verify pending.

| Field | Value |
|-------|--------|
| Fix commit | `4be903b9` |
| Deploy | [38505806886](https://github.com/jlcormier612/wevenu-website/actions/runs/38505806886) |
| Target | Sandbox only |

## Root cause

`lead-owner-hold-row` placed `DateHoldsSection` in a `flex-1` sibling beside Sales owner. The open hold form lived inside that right column, so it expanded as a large right-hand panel while Sales owner stayed stranded left.

## Fix

1. Remove the `flex-1`/`sm:basis-0` wrapper around `DateHoldsSection` in `lead-detail.tsx`.
2. Compact `DateHoldsSection` root uses `display: contents` so the form can be a `basis-full w-full max-w-xl` flex child of the shared control row, expanding beneath Sales owner + Date hold controls.

## Verify

```bash
EXPECTED_SHA=4be903b9dde5e5a2eb1c545e058f9fe69163e059 npx tsx docs/qa/date-hold-expansion-layout/verify-browser.mts
```

Smoke: open Place hold → Cancel (no persistent hold).
