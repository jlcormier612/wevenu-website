# Inventory Templates copy correction — STATUS

**Verdict:** OPEN — awaiting Sandbox deploy + browser verify  
**Production:** untouched  

## Before → after

| Block | Before | After |
|---|---|---|
| Page description | Packing lists + Use/Send + Event Order handoff + invoice | Approved short description only |
| LibraryHowItWorks | Repeated Use/Send draft language | Single Use / Send to client explanation |
| LibraryDependencyNote | Catalog + snapshot wording | Catalog + edit guidance (no Use/Send) |
| List footer paragraph | Third Use/Send + parallel payment stack | **Removed** |
| Send sheet confirm | “Event Order handoff” | Plain couple-review language |

## Tests

```bash
npx tsx --test lib/event-inventory/inventory-templates-page-copy.test.ts
```

## Browser

```bash
EXPECTED_SHA=<sha> npx tsx docs/qa/inventory-templates-copy-correction/verify-browser.mts
```
