# Luv Noticed stale attendance insight — STATUS

**STATUS:** NOT GREEN / BLOCKED — attendance proven on `149b7f5f`; writing-quality commit `5ad70d80` deploy in progress  
**Date:** 2026-10-15  

## Attendance fix

- **Commit:** `792e2a74b8c9563b53b0b045b60d4af91154d429`
- **Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38673294231 **SUCCESS**
- **Contained in serving:** `149b7f5fda1857b696de5fa1e91350bb5521cc0b` / `htc-sandbox-venue-app:756` (ancestor of attendance fix; inbound deploy https://github.com/jlcormier612/wevenu-website/actions/runs/38674625261 SUCCESS)

### Exact-runtime proof (attendance) on `149b7f5f`

- `EXPECTED_SHA=149b7f5f… npx tsx docs/qa/luv-noticed-stale-attendance/verify-runtime.mts` → **allPass**
- `EXPECTED_SHA=149b7f5f… npx tsx docs/qa/luv-noticed-stale-attendance/verify-browser.mts` → **allPass** (no stale unanswered copy on Rory lead)
- Message `07df6ca5-…` + tour notes intact; `needs_response` unchanged by evaluator/browser lead open
- Note: verify-runtime uses local evaluator against Sandbox data; browser proof confirms deployed UI lacks stale copy. Disposable QA inbound bodies are filtered for Rory silence eval only.

## Writing-quality follow-on

- **Audit:** `WRITING-QUALITY-AUDIT.md`
- Softens unresolved-question copy; no awkward “asked about Can I…”; no “still unanswered” / “don't see an answer recorded”
- Tests added under `completed-tour-intelligence.test.ts`
- Requires deploy of this writing-quality commit for exact-SHA UI confirmation of new phrasing

## Tests

```
npx tsx --test lib/luv/completed-tour-intelligence.test.ts \
  lib/luv/completed-tour-thoughts.test.ts \
  lib/luv/draft-context-boundary.test.ts \
  lib/luv/draft-discard-delete.test.ts \
  lib/luv/draft-proposal-factuality.test.ts \
  lib/conversations/inbox-needs-response.test.ts
```

**95/95 PASS** (includes attendance + writing-quality + privacy/factuality/discard + inbox)

## Production / Resend / DNS

Untouched. No customer sends.
