# STATUS — Timeline timing simplification

**Verdict: IN PROGRESS**

## Root causes

1. Template editor exposed clock time and raw “Relative Time (min)” together without naming the anchor in the control.
2. Event Timeline Setup used a bare “Day offset” number instead of event calendar days.
3. Relative apply invented **noon** when Day-of schedule start was missing.

## Contract

See `TIMING-CONTRACT.md`. Relative = Day-of schedule start only; bake at apply; specific clock is default.

## Code (local; pending Sandbox serve)

- `lib/timeline/timing-presentation.ts` (+ tests)
- `lib/timeline/constants.ts` — no noon invent
- `lib/timeline-templates/constants.ts` — plain labels
- `components/timeline-templates/timeline-template-editor.tsx` — timing modes
- `components/events/event-timeline-setup-editor.tsx` + panel/detail props — day selector
- `components/events/timeline-setup-card.tsx` — copy

## Tests

Unit: timing-presentation + relative-time-anchor (PASS locally). Browser: pending serving image.

## Production

Untouched.
