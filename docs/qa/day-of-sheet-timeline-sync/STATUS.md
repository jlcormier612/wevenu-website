# Day-of Sheet Timeline sync — STATUS

**Verdict:** IN PROGRESS — product committed; Sandbox deploy queued; browser acceptance pending exact serving SHA.

| Item | Value |
| --- | --- |
| Product commit | `ea1abda3fa3b31b59257c8c53e09a30bd0b3dc9e` |
| Deploy | [39711686152](https://github.com/jlcormier612/wevenu-website/actions/runs/39711686152) |
| Prior tip that was serving | `b910759d` (Timeline Save All / AM-PM) |
| Production | untouched |
| Dirty tree | preserved |

## Unit tests

```text
npx tsx --test lib/events/day-sheet-schedule.test.ts lib/timeline/chronological-order.test.ts lib/timeline/time-format.test.ts
→ 15/15 pass
```

## Browser (after serving == ea1abda3)

```text
EXPECTED_SHA=ea1abda3fa3b31b59257c8c53e09a30bd0b3dc9e \
  npx tsx scripts/qa/day-of-sheet-timeline-sync-browser.mts
```

## GREEN gate

Requires deploy success, live `dpl=` == `ea1abda3…`, harness PASS, delete/edit/add reflected on Day-of Sheet, unscheduled section, Library/control isolation.
