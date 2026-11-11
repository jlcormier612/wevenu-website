# STATUS — Timeline timing simplification

**Verdict: GREEN / CLOSED**

## Serving verification

| Item | Value |
|------|--------|
| Product commit | `62fa1f9e` (contained in tip) |
| Serving tip | `f5cc61e4429ebb69730888c7a579a300003e41a0` |
| Deploy | [40258243938](https://github.com/jlcormier612/wevenu-website/actions/runs/40258243938) success |
| Digest | `sha256:c84a42ca941112dd5eabf16265e24dae321453c202a0a531b4ba5159e5b61f65` |
| Browser | **GREEN** — `browser-results.json` / `browser-run-f5cc61e4.log` (re-verified 2026-10-26T02:53Z) |
| ECS (live) | image tag `f5cc61e4…`, digest `sha256:c84a42ca…61f65` |

`62fa1f9e` venue-app never pushed (client `fs/promises` boundary). Proof is on tip `f5cc61e4`, which contains the timing work plus the Merge Lead client/server boundary fix. Fixture event `ebf74f77…` restored to baseline `start_time=11:00:00`, `event_end_date=null`.

## Root causes (product)

1. Template editor: clock + raw Relative Time (min) without named anchor in the control.
2. Event setup: bare Day offset instead of calendar days.
3. Relative apply invented noon when Day-of schedule start was missing.

## Contract

See `TIMING-CONTRACT.md`. Specific clock default; relative = Day-of schedule start only; no noon invent.

## Browser coverage on `f5cc61e4`

- Day labels + relative phrase on template list
- Legacy dual-timing conflict banner + mode controls
- Named Day-of schedule start anchor; no raw “Relative Time (min)”
- UI add specific-time item persisted
- Relative bake → 15:30 from 16:00 start; day-2 offset preserved; dual prefers clock
- Missing start → no invent
- Event customize day control shows calendar label (not “Day offset”)
- Schedule tab shows specific + baked relative; template untouched after apply

## Unit

28 pass (`unit-test.log`).

## Production

**Untouched.**
