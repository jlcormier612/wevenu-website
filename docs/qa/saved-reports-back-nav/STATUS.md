# Saved Reports back navigation — STATUS

**Verdict:** OPEN — awaiting Sandbox deploy + browser verify  
**Production:** untouched  

## Change

Saved Reports (`/reporting/saved`) is a Library collection (same shelf as Brochures). The Reports shell now shows `CollectionBackLink` → `/library` labeled **Templates** above the Reports heading **only** on that route. Other report tabs unchanged.

## Files

- `components/reporting/reports-layout-shell.tsx` (new)
- `app/(app)/reporting/layout.tsx`
- `lib/reporting/saved-reports-back-nav.test.ts` (new)
- `lib/brand/customer-facing-brand.test.ts` (Reports heading assertion follows shell)

## Tests (local)

```bash
npx tsx --test lib/reporting/saved-reports-back-nav.test.ts
```

## Browser verify (after serving tip)

```bash
EXPECTED_SHA=<sha> npx tsx docs/qa/saved-reports-back-nav/verify-browser.mts
```
