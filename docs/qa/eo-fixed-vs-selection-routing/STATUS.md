# EO fixed vs client-selection routing

**Status: IN PROGRESS** (implementation + unit tests; Sandbox browser pending deploy)

See `FORENSIC.md` for Phase 1 root cause.

## Fix summary

- Hide Library **Send to client** when `selectableGroupCount === 0`.
- Send sheet for fixed-only templates: notice + **Apply to event instead** (Use path).
- Server message: `SEND_REQUIRES_SELECTABLE_GROUPS_MESSAGE` (Path A guidance).
- Path B choice-group validation retained.

## Tests

```bash
npx tsx --test lib/event-order-templates/use-send.test.ts \
  lib/event-order-templates/selection-definition.test.ts
```

Browser: `EXPECTED_SHA=<sha> npx tsx docs/qa/eo-fixed-vs-selection-routing/verify-browser.mts`
