# Template-card Edit label consistency — STATUS

**Verdict:** OPEN — awaiting Sandbox deploy + browser verify  
**Production:** untouched  

## Audit

See `AUDIT.md`. Five families still used `LIBRARY_LABELS.editActivities` on starter cards for the same editor route Inventory already labeled **Edit**.

## Fix

Replace starter card `editActivities` → `edit` (emphasis `edit`) in:
- Floor plans, Event Orders, Timelines, Playbooks, Questionnaires  
Remove unused `editActivities` from `components/library/labels.ts`.

## Tests

```bash
npx tsx --test lib/library/template-card-edit-label-consistency.test.ts lib/event-inventory/starter-edit-label.test.ts lib/timeline-templates/ownership-ux.test.ts
```

## Browser

```bash
EXPECTED_SHA=<sha> npx tsx docs/qa/template-card-edit-label-consistency/verify-browser.mts
```
