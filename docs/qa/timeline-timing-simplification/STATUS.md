# STATUS — Timeline timing simplification

**Verdict: IN PROGRESS — not GREEN**

## Deploy reality check (2026-10-26)

| Run | SHA | Venue-app | Notes |
|-----|-----|-----------|-------|
| [40256987860](https://github.com/jlcormier612/wevenu-website/actions/runs/40256987860) | `62fa1f9e…` (timeline tip) | **FAILED** | Same client `fs/promises` boundary as Merge Continue-gate; scheduler/workspace/marketing succeeded; Deploy skipped |
| [40258243938](https://github.com/jlcormier612/wevenu-website/actions/runs/40258243938) | `f5cc61e4…` (boundary fix; **contains** timeline as ancestor) | **in_progress** | Venue-app still building; other images pushed |
| Serving now | `8215db63…` | RUNNING | Last successful Merge Lead image — **does not** include timeline timing UX |

**Cannot** run browser against `EXPECTED_SHA=62fa1f9e…` — that venue-app image was never pushed.

Next proof when `f5cc61e4…` (or later tip containing timeline + boundary fix) is serving:

```bash
EXPECTED_SHA=<serving-sha> \
  npx tsx docs/qa/timeline-timing-simplification/verify-browser.mts
```

## Root causes (product)

1. Template editor: clock + raw Relative Time (min) without named anchor in the control.
2. Event setup: bare Day offset instead of calendar days.
3. Relative apply invented noon when Day-of schedule start was missing.

## Contract

See `TIMING-CONTRACT.md`. Specific clock default; relative = Day-of schedule start only; no noon invent.

## Unit

28 pass (`unit-test.log`). Browser not run on a serving image that includes this work.

## Production

**Untouched.**
